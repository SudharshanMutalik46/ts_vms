#include "Session.h"

#include "DiskLayout.h"
#include "Logger.h"

#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <map>
#include <sstream>
#include <thread>
#include <vector>

#ifdef _WIN32
    #ifndef WIN32_LEAN_AND_MEAN
        #define WIN32_LEAN_AND_MEAN
    #endif
    #ifndef NOMINMAX
        #define NOMINMAX
    #endif
    #include <windows.h>
    #ifdef ERROR
    #undef ERROR
    #endif
#else
    #include <signal.h>
    #include <sys/types.h>
    #include <sys/wait.h>
    #include <unistd.h>
#endif

namespace fs = std::filesystem;

namespace vms {

static uint64_t nowMs() {
    return (uint64_t)std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();
}

static std::string quoteIfNeeded(const std::string& s) {
    if (s.empty()) return "\"\"";
    if (s.find(' ') != std::string::npos || s.find('\t') != std::string::npos) {
        if (s.size() >= 2 && s.front() == '"' && s.back() == '"') return s;
        return "\"" + s + "\"";
    }
    return s;
}

static bool parseSegmentIndex(const std::string& filename, int& outIdx) {
    // expected: segment_000001.mp4
    const std::string prefix = "segment_";
    if (filename.rfind(prefix, 0) != 0) return false;

    size_t dot = filename.find('.');
    std::string numPart = (dot == std::string::npos)
        ? filename.substr(prefix.size())
        : filename.substr(prefix.size(), dot - prefix.size());

    if (numPart.empty()) return false;
    for (char c : numPart) {
        if (!std::isdigit((unsigned char)c)) return false;
    }

    outIdx = std::stoi(numPart);
    return true;
}

Session::Session(
    const std::string& cameraId,
    const std::string& sessionId,
    const std::string& rtspUrl,
    int segmentSeconds,
    std::shared_ptr<DiskLayout> diskLayout,
    const std::string& ffmpegPath
)
    : m_cameraId(cameraId),
      m_sessionId(sessionId),
      m_rtspUrl(rtspUrl),
      m_segmentSeconds(segmentSeconds),
      m_diskLayout(std::move(diskLayout)),
      m_ffmpegPath(ffmpegPath)
{
}

Session::~Session() {
    // best-effort cleanup
    if (state() == SessionState::RECORDING || state() == SessionState::STARTING) {
        (void)stop();
    }
}

bool Session::start() {
    std::lock_guard<std::mutex> lk(m_stateMutex);

    if (m_state.load() == SessionState::RECORDING || m_state.load() == SessionState::STARTING) {
        setErrorInternal("Session already started");
        return false;
    }

    m_stopRequested.store(false);
    m_seenSegments.clear();
    m_lastSegmentIdx = -1;
    m_restartAttempts = 0;

    {
        std::lock_guard<std::mutex> slk(m_statsMutex);
        m_stats = SessionStats{};
        m_stats.startedAtMs = nowMs();
    }

    setStateInternal(SessionState::STARTING);

    // Ensure output directory exists
    fs::path sessionDir = m_diskLayout->buildSessionDir(m_cameraId, m_sessionId);
    if (!m_diskLayout->ensureDir(sessionDir)) {
        setStateInternal(SessionState::ERROR);
        setErrorInternal("Failed to create session directory: " + sessionDir.string());
        return false;
    }

    // Output template for ffmpeg
    fs::path outTemplate = sessionDir / "segment_%06d.mp4";
    std::string cmd = buildFfmpegCommand(outTemplate.string());

    if (!startFFmpeg(cmd)) {
        setStateInternal(SessionState::ERROR);
        return false;
    }

    setStateInternal(SessionState::RECORDING);

    // monitor thread
    m_workerThread = std::thread(&Session::workerLoop, this);
    return true;
}

StopResult Session::stop() {
    StopResult result;

    m_stopRequested.store(true);
    setStateInternal(SessionState::STOPPING);

    stopFFmpeg();

    if (m_workerThread.joinable()) {
        m_workerThread.join();
    }

    std::string finalRel;
    uint64_t finalSize = 0;
    std::string msg;

    bool merged = mergeSegments(finalRel, finalSize, msg);

    result.success = true;
    result.merged = merged;
    result.message = msg;
    result.final_file_path = finalRel;
    result.final_size_bytes = finalSize;

    setStateInternal(SessionState::STOPPED);
    return result;
}

Status Session::getStatus() const {
    Status st;
    {
        std::lock_guard<std::mutex> lk(m_stateMutex);
        st.session_id = m_sessionId;
        st.camera_id = m_cameraId;
        st.state = m_state.load();
        st.last_error = m_lastError;
        st.ffmpeg_pid = m_ffmpegPid;
        st.restart_attempts = m_restartAttempts;
    }
    {
        std::lock_guard<std::mutex> lk(m_statsMutex);
        st.bytes_written = m_stats.bytesWritten;
        st.segments_written = m_stats.segmentsWritten;
        st.started_at_ms = m_stats.startedAtMs;
    }
    return st;
}

SessionState Session::state() const {
    return m_state.load();
}

std::string Session::sessionId() const { return m_sessionId; }
std::string Session::cameraId() const { return m_cameraId; }

std::string Session::lastError() const {
    std::lock_guard<std::mutex> lk(m_stateMutex);
    return m_lastError;
}

SessionStats Session::getStats() const {
    std::lock_guard<std::mutex> lk(m_statsMutex);
    return m_stats;
}

void Session::setSegmentCallback(SegmentCallback cb) { m_segmentCallback = std::move(cb); }
void Session::setStateCallback(StateCallback cb) { m_stateCallback = std::move(cb); }
void Session::setErrorCallback(ErrorCallback cb) { m_errorCallback = std::move(cb); }

void Session::setStateInternal(SessionState s) {
    SessionState prev = m_state.exchange(s);
    (void)prev;

    if (m_stateCallback) {
        m_stateCallback(s);
    }
}

void Session::setErrorInternal(const std::string& err) {
    {
        std::lock_guard<std::mutex> lk(m_stateMutex);
        m_lastError = err;
    }
    if (m_errorCallback) {
        m_errorCallback(err);
    }
}

std::string Session::buildFfmpegCommand(const std::string& outputTemplate) const {
    // NOTE: don't log this full command if you consider RTSP URL sensitive.
    // Segment command:
    // ffmpeg -hide_banner -loglevel error -rtsp_transport tcp -i <rtsp>
    //   -c copy -f segment -reset_timestamps 1 -segment_time N <template>
    std::ostringstream ss;
    ss << quoteIfNeeded(m_ffmpegPath)
       << " -hide_banner -loglevel error"
       << " -rtsp_transport tcp"
       << " -i " << quoteIfNeeded(m_rtspUrl)
       << " -c copy"
       << " -f segment"
       << " -reset_timestamps 1"
       << " -segment_time " << m_segmentSeconds
       << " " << quoteIfNeeded(outputTemplate);

    return ss.str();
}

bool Session::startFFmpeg(const std::string& cmd) {
#ifdef _WIN32
    STARTUPINFOA si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si));
    ZeroMemory(&pi, sizeof(pi));
    si.cb = sizeof(si);

    // CreateProcess needs a mutable buffer for the command line
    std::string cmdLine = cmd;

    BOOL ok = CreateProcessA(
        nullptr,
        cmdLine.data(),
        nullptr,
        nullptr,
        FALSE,
        CREATE_NO_WINDOW,
        nullptr,
        nullptr,
        &si,
        &pi
    );

    if (!ok) {
        DWORD e = GetLastError();
        setErrorInternal("CreateProcessA(ffmpeg) failed, error=" + std::to_string((unsigned long)e));
        return false;
    }

    m_ffmpegPid = (int)pi.dwProcessId;
    m_ffmpegHandle = (void*)pi.hProcess;

    CloseHandle(pi.hThread);

    LOG_INFO("FFmpeg started (pid={}) for session {}", m_ffmpegPid, m_sessionId);
    return true;
#else
    pid_t pid = fork();
    if (pid < 0) {
        setErrorInternal("fork() failed starting ffmpeg");
        return false;
    }
    if (pid == 0) {
        execl("/bin/sh", "sh", "-c", cmd.c_str(), (char*)nullptr);
        _exit(127);
    }
    m_ffmpegPid = (int)pid;
    LOG_INFO("FFmpeg started (pid={}) for session {}", m_ffmpegPid, m_sessionId);
    return true;
#endif
}

void Session::stopFFmpeg() {
#ifdef _WIN32
    HANDLE h = (HANDLE)m_ffmpegHandle;
    if (!h) return;

    // terminate (simple + reliable for now)
    TerminateProcess(h, 0);
    WaitForSingleObject(h, 5000);
    CloseHandle(h);

    m_ffmpegHandle = nullptr;
    m_ffmpegPid = -1;
#else
    if (m_ffmpegPid <= 0) return;
    ::kill((pid_t)m_ffmpegPid, SIGTERM);
    int status = 0;
    ::waitpid((pid_t)m_ffmpegPid, &status, 0);
    m_ffmpegPid = -1;
#endif
}

int Session::monitorFFmpeg() {
#ifdef _WIN32
    HANDLE h = (HANDLE)m_ffmpegHandle;
    if (!h) return -1;

    DWORD wait = WaitForSingleObject(h, 0);
    if (wait == WAIT_TIMEOUT) return -1;

    DWORD exitCode = 0;
    if (!GetExitCodeProcess(h, &exitCode)) exitCode = 1;

    CloseHandle(h);
    m_ffmpegHandle = nullptr;
    m_ffmpegPid = -1;

    return (int)exitCode;
#else
    if (m_ffmpegPid <= 0) return -1;

    int status = 0;
    pid_t r = ::waitpid((pid_t)m_ffmpegPid, &status, WNOHANG);
    if (r == 0) return -1; // still running

    int code = 1;
    if (WIFEXITED(status)) code = WEXITSTATUS(status);

    m_ffmpegPid = -1;
    return code;
#endif
}

void Session::workerLoop() {
    fs::path sessionDir = m_diskLayout->buildSessionDir(m_cameraId, m_sessionId);

    // track size stability to avoid emitting segments while still being written
    std::map<int, std::pair<uint64_t, int>> sizeStable; // idx -> {lastSize, stableCount}

    while (!m_stopRequested.load()) {
        // scan dir for new segments
        for (const auto& entry : fs::directory_iterator(sessionDir)) {
            if (!entry.is_regular_file()) continue;

            const std::string name = entry.path().filename().string();
            int idx = -1;
            if (!parseSegmentIndex(name, idx)) continue;

            uint64_t sz = 0;
            std::error_code ec;
            sz = (uint64_t)fs::file_size(entry.path(), ec);
            if (ec) continue;

            auto it = sizeStable.find(idx);
            if (it == sizeStable.end()) {
                sizeStable[idx] = { sz, 0 };
                continue;
            }

            if (it->second.first == sz) {
                it->second.second += 1;
            } else {
                it->second.first = sz;
                it->second.second = 0;
            }

            // stable for 2 cycles => consider complete
            if (it->second.second >= 2 && m_seenSegments.find(idx) == m_seenSegments.end()) {
                m_seenSegments.insert(idx);

                {
                    std::lock_guard<std::mutex> lk(m_statsMutex);
                    m_stats.bytesWritten += sz;
                    m_stats.segmentsWritten += 1;
                    m_stats.lastSegmentAtMs = nowMs();
                }

                SegmentInfo info;
                info.cameraId = m_cameraId;
                info.sessionId = m_sessionId;
                info.segmentIndex = idx;
                info.sizeBytes = sz;

                // approximate timestamps from start time
                uint64_t startedAt = 0;
                {
                    std::lock_guard<std::mutex> lk(m_statsMutex);
                    startedAt = m_stats.startedAtMs;
                }
                info.startTimestampMs = startedAt + (uint64_t)(idx * m_segmentSeconds) * 1000ULL;
                info.endTimestampMs = info.startTimestampMs + (uint64_t)m_segmentSeconds * 1000ULL;

                // prefer relative path for DB portability
                fs::path fullSegPath = m_diskLayout->buildSegmentPath(m_cameraId, m_sessionId, idx);
                std::string relStr = m_diskLayout->getRelativePath(fullSegPath);
                fs::path rel(relStr);
                info.filePath = rel.string();

                if (m_segmentCallback) {
                    m_segmentCallback(info);
                }
            }
        }

        // detect unexpected exit
        int exitCode = monitorFFmpeg();
        if (exitCode != -1 && !m_stopRequested.load()) {
            setStateInternal(SessionState::ERROR);
            setErrorInternal("FFmpeg exited unexpectedly with code=" + std::to_string(exitCode));
            LOG_WARN("FFmpeg exited unexpectedly for session {} (code={})", m_sessionId, exitCode);
            return;
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(500));
    }
}

bool Session::mergeSegments(std::string& outFinalRelative, uint64_t& outSizeBytes, std::string& outMessage) {
    fs::path sessionDir = m_diskLayout->buildSessionDir(m_cameraId, m_sessionId);
    if (!fs::exists(sessionDir)) {
        outMessage = "Session directory missing; nothing to merge";
        return false;
    }

    std::vector<fs::path> segments;
    for (const auto& entry : fs::directory_iterator(sessionDir)) {
        if (!entry.is_regular_file()) continue;
        const std::string name = entry.path().filename().string();
        int idx = -1;
        if (!parseSegmentIndex(name, idx)) continue;
        segments.push_back(entry.path());
    }

    if (segments.empty()) {
        outMessage = "No segments found; nothing to merge";
        return false;
    }

    std::sort(segments.begin(), segments.end());

    // create concat list
    fs::path listFile = sessionDir / "concat_list.txt";
    {
        std::ofstream ofs(listFile.string(), std::ios::binary);
        if (!ofs) {
            outMessage = "Failed to create concat list file";
            return false;
        }

        for (const auto& seg : segments) {
            // concat demuxer format: file 'path'
            ofs << "file '" << seg.string() << "'\n";
        }
    }

    fs::path finalFile = sessionDir / "final.mp4";

    std::ostringstream cmd;
    cmd << quoteIfNeeded(m_ffmpegPath)
        << " -hide_banner -loglevel error -y"
        << " -f concat -safe 0"
        << " -i " << quoteIfNeeded(listFile.string())
        << " -c copy "
        << quoteIfNeeded(finalFile.string());

    int rc = std::system(cmd.str().c_str());
    if (rc != 0 || !fs::exists(finalFile)) {
        outMessage = "Merge failed (ffmpeg rc=" + std::to_string(rc) + ")";
        return false;
    }

    std::error_code ec;
    outSizeBytes = (uint64_t)fs::file_size(finalFile, ec);
    if (ec) outSizeBytes = 0;

    // relative final file path for portability
    fs::path finalDirFull = m_diskLayout->buildSessionDir(m_cameraId, m_sessionId);
    std::string finalDirRel = m_diskLayout->getRelativePath(finalDirFull);
    fs::path finalRel = fs::path(finalDirRel) / "final.mp4";
    outFinalRelative = finalRel.string();

    outMessage = "Merged " + std::to_string(segments.size()) + " segments into final.mp4";
    return true;
}

} // namespace vms
