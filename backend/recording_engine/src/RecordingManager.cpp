#include "RecordingManager.h"
#include "Logger.h"
#include <random>
#include <sstream>
#include <iomanip>

namespace vms {

RecordingManager::RecordingManager(const Config& config)
    : m_config(config)
    , m_diskLayout(std::make_shared<DiskLayout>(config.recordings_dir))
{
    LOG_INFO("RecordingManager initialized with base dir: {}", config.recordings_dir);
}

RecordingManager::~RecordingManager() {
    LOG_INFO("RecordingManager shutting down, stopping all sessions");
    
    std::lock_guard<std::mutex> lock(m_mutex);
    for (auto& [id, session] : m_sessions) {
        session->stop();
    }
    m_sessions.clear();
}

std::string RecordingManager::generateSessionId() const {
    // Generate a UUID-like session ID
    static std::random_device rd;
    static std::mt19937 gen(rd());
    static std::uniform_int_distribution<uint32_t> dis(0, 0xFFFFFFFF);
    
    std::ostringstream ss;
    ss << std::hex << std::setfill('0');
    ss << std::setw(8) << dis(gen) << "-";
    ss << std::setw(4) << (dis(gen) & 0xFFFF) << "-";
    ss << std::setw(4) << ((dis(gen) & 0x0FFF) | 0x4000) << "-";
    ss << std::setw(4) << ((dis(gen) & 0x3FFF) | 0x8000) << "-";
    ss << std::setw(8) << dis(gen) << std::setw(4) << (dis(gen) & 0xFFFF);
    
    return ss.str();
}

std::string RecordingManager::startRecording(
    const std::string& cameraId,
    const std::string& rtspUrl,
    uint32_t segmentSeconds,
    const std::string& recordingsBaseDir
) {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    // Check if already recording
    auto it = m_sessions.find(cameraId);
    if (it != m_sessions.end()) {
        auto state = it->second->state();
        if (state != SessionState::STOPPED && state != SessionState::ERROR) {
            LOG_WARN("Camera {} already recording", cameraId);
            return "";
        }
        // Remove old session
        m_sessions.erase(it);
    }
    
    // Check max cameras limit
    if (m_sessions.size() >= m_config.max_cameras) {
        LOG_ERROR("Max camera limit ({}) reached", m_config.max_cameras);
        return "";
    }
    
    // Update disk layout if base dir changed
    if (!recordingsBaseDir.empty() && recordingsBaseDir != m_config.recordings_dir) {
        m_diskLayout = std::make_shared<DiskLayout>(recordingsBaseDir);
    }
    
    // Create session
    std::string sessionId = generateSessionId();
    uint32_t segDuration = segmentSeconds > 0 ? segmentSeconds : m_config.segment_duration;
    
    auto session = std::make_shared<Session>(
        cameraId,
        sessionId,
        rtspUrl,
        segDuration,
        m_diskLayout,
        m_config.ffmpeg_path
    );
    
    // Set callbacks
    session->setSegmentCallback([this](const SegmentInfo& info) {
        onSegmentWritten(info);
    });
    session->setStateCallback([this, cameraId](SessionState newState) {
        // We don't get oldState or msg from simplified Session callback
        onStateChanged(cameraId, SessionState::IDLE, newState, "");
    });
    session->setErrorCallback([this, cameraId, sessionId](const std::string& msg) {
        // Code is not passed, default to -1
        onError(cameraId, sessionId, -1, msg);
    });
    
    // Start session
    if (!session->start()) {
        LOG_ERROR("Failed to start session for camera {}", cameraId);
        return "";
    }
    
    m_sessions[cameraId] = session;
    LOG_INFO("Started recording for camera {} with session {}", cameraId, sessionId);
    
    return sessionId;
}

StopResult RecordingManager::stopRecording(const std::string& cameraId) {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    StopResult result;
    
    auto it = m_sessions.find(cameraId);
    if (it == m_sessions.end()) {
        LOG_WARN("No recording found for camera {}", cameraId);
        result.success = false;
        result.message = "No active recording found";
        return result;
    }
    
    result = it->second->stop();
    m_sessions.erase(it);
    
    LOG_INFO("Stopped recording for camera {}: merged={} path={}",
             cameraId, result.merged, result.final_file_path);
    return result;
}

RecordingManager::Status RecordingManager::getStatus(const std::string& cameraId) const {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    Status status;
    auto it = m_sessions.find(cameraId);
    if (it == m_sessions.end()) {
        return status;
    }
    
    status.found = true;
    status.state = it->second->state();
    status.sessionId = it->second->sessionId();
    status.lastError = it->second->lastError();
    
    auto stats = it->second->getStats();
    status.bytesWritten = stats.bytesWritten;
    status.segmentsWritten = stats.segmentsWritten;
    // status.uptimeSeconds = stats.uptime_seconds; // Not in SessionStats anymore
    // Calculate uptime manually if needed, or set to 0
    if (stats.startedAtMs > 0) {
        auto now = std::chrono::time_point_cast<std::chrono::milliseconds>(std::chrono::system_clock::now()).time_since_epoch().count();
        status.uptimeSeconds = (now - stats.startedAtMs) / 1000;
    } else {
        status.uptimeSeconds = 0;
    }
    
    return status;
}

std::vector<RecordingManager::ActiveInfo> RecordingManager::listActive() const {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    std::vector<ActiveInfo> result;
    result.reserve(m_sessions.size());
    
    for (const auto& [id, session] : m_sessions) {
        auto stats = session->getStats();
        result.push_back({
            id,
            session->sessionId(),
            session->state(),
            0,
            static_cast<int64_t>(stats.segmentsWritten)
        });
    }
    
    return result;
}

DiskLayout::DiskStats RecordingManager::getDiskStatus() const {
    return m_diskLayout->getDiskStats();
}

bool RecordingManager::popEvent(Event& event) {
    std::lock_guard<std::mutex> lock(m_eventMutex);
    if (m_eventQueue.empty()) {
        return false;
    }
    event = m_eventQueue.front();
    m_eventQueue.pop();
    return true;
}

bool RecordingManager::hasEvents() const {
    std::lock_guard<std::mutex> lock(m_eventMutex);
    return !m_eventQueue.empty();
}

void RecordingManager::onSegmentWritten(const SegmentInfo& info) {
    std::lock_guard<std::mutex> lock(m_eventMutex);
    Event evt;
    evt.type = Event::SEGMENT_WRITTEN;
    evt.segment = info;
    m_eventQueue.push(evt);
}

void RecordingManager::onStateChanged(const std::string& cameraId, SessionState oldState, SessionState newState, const std::string& msg) {
    std::lock_guard<std::mutex> lock(m_eventMutex);
    Event evt;
    evt.type = Event::STATE_CHANGED;
    evt.cameraId = cameraId;
    evt.oldState = oldState;
    evt.newState = newState;
    evt.message = msg;
    m_eventQueue.push(evt);
}

void RecordingManager::onError(const std::string& cameraId, const std::string& sessionId, int code, const std::string& msg) {
    std::lock_guard<std::mutex> lock(m_eventMutex);
    Event evt;
    evt.type = Event::RECORDING_ERROR;
    evt.cameraId = cameraId;
    evt.segment.sessionId = sessionId;
    evt.errorCode = code;
    evt.message = msg;
    m_eventQueue.push(evt);
}

} // namespace vms
