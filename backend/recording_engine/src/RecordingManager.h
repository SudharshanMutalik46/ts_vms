#pragma once

#include "Session.h"
#include "DiskLayout.h"
#include "Config.h"
#include <map>
#include <memory>
#include <mutex>
#include <functional>
#include <queue>

namespace vms {

/**
 * Event types for streaming
 */
struct Event {
    enum Type { SEGMENT_WRITTEN, STATE_CHANGED, RECORDING_ERROR };
    Type type;
    SegmentInfo segment;
    std::string cameraId;
    SessionState oldState;
    SessionState newState;
    std::string message;
    int errorCode;
};

/**
 * Manages all active recording sessions
 * Thread-safe singleton-ish pattern
 */
class RecordingManager {
public:
    explicit RecordingManager(const Config& config);
    ~RecordingManager();
    
    // Non-copyable
    RecordingManager(const RecordingManager&) = delete;
    RecordingManager& operator=(const RecordingManager&) = delete;
    
    /**
     * Start recording for a camera
     * @return session_id on success, empty string on failure
     */
    std::string startRecording(
        const std::string& cameraId,
        const std::string& rtspUrl,
        uint32_t segmentSeconds,
        const std::string& recordingsBaseDir
    );
    
    /**
     * Stop recording for a camera
     * @return StopResult with merge status and final file path
     */
    StopResult stopRecording(const std::string& cameraId);
    
    /**
     * Get status of a camera's recording
     */
    struct Status {
        bool found = false;
        SessionState state = SessionState::STOPPED;
        std::string sessionId;
        std::string lastError;
        int64_t bytesWritten = 0;
        int64_t segmentsWritten = 0;
        int64_t uptimeSeconds = 0;
    };
    Status getStatus(const std::string& cameraId) const;
    
    /**
     * List all active recordings
     */
    struct ActiveInfo {
        std::string cameraId;
        std::string sessionId;
        SessionState state;
        int64_t uptimeSeconds;
        int64_t segmentsWritten;
    };
    std::vector<ActiveInfo> listActive() const;
    
    /**
     * Get disk status
     */
    DiskLayout::DiskStats getDiskStatus() const;
    
    /**
     * Pop next event from queue (for streaming)
     * @return true if event available
     */
    bool popEvent(Event& event);
    
    /**
     * Check if there are pending events
     */
    bool hasEvents() const;
    
private:
    std::string generateSessionId() const;
    void onSegmentWritten(const SegmentInfo& info);
    void onStateChanged(const std::string& cameraId, SessionState oldState, SessionState newState, const std::string& msg);
    void onError(const std::string& cameraId, const std::string& sessionId, int code, const std::string& msg);
    
    Config m_config;
    std::shared_ptr<DiskLayout> m_diskLayout;
    
    mutable std::mutex m_mutex;
    std::map<std::string, std::shared_ptr<Session>> m_sessions;
    
    mutable std::mutex m_eventMutex;
    std::queue<Event> m_eventQueue;
};

} // namespace vms
