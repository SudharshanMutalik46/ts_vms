#pragma once

#include <string>
#include <cstdint>
#include <atomic>
#include <thread>
#include <memory>
#include <functional>
#include <chrono>
#include <mutex>
#include <set>

// Windows headers (directly or indirectly) define ERROR as a macro.
// We use SessionState::ERROR, so undef it to avoid preprocessor substitution.
#ifdef ERROR
#undef ERROR
#endif

namespace vms {

class DiskLayout;

enum class SessionState {
    IDLE = 0,
    STARTING,
    RECORDING,
    STOPPING,
    STOPPED,
    ERROR
};

struct SegmentInfo {
    std::string cameraId;
    std::string sessionId;
    std::string filePath;   // relative to baseDir (recommended for portability)
    int segmentIndex = 0;
    uint64_t sizeBytes = 0;
    uint64_t startTimestampMs = 0;
    uint64_t endTimestampMs = 0;
};

struct SessionStats {
    uint64_t bytesWritten = 0;
    uint64_t segmentsWritten = 0;
    uint64_t startedAtMs = 0;
    uint64_t lastSegmentAtMs = 0;
};

struct StopResult {
    bool success = false;
    std::string message;
    std::string final_file_path;   // relative path if merged, else empty
    uint64_t final_size_bytes = 0;
    bool merged = false;
};

struct Status {
    std::string session_id;
    std::string camera_id;
    SessionState state = SessionState::IDLE;
    std::string last_error;
    int ffmpeg_pid = -1;
    int restart_attempts = 0;
    uint64_t bytes_written = 0;
    uint64_t segments_written = 0;
    uint64_t started_at_ms = 0;
};

using SegmentCallback = std::function<void(const SegmentInfo&)>;
using StateCallback   = std::function<void(SessionState)>;
using ErrorCallback   = std::function<void(const std::string&)>;

class Session {
public:
    Session(
        const std::string& cameraId,
        const std::string& sessionId,
        const std::string& rtspUrl,
        int segmentSeconds,
        std::shared_ptr<DiskLayout> diskLayout,
        const std::string& ffmpegPath
    );

    ~Session();

    bool start();
    StopResult stop();

    Status getStatus() const;
    SessionState state() const;
    std::string sessionId() const;
    std::string cameraId() const;
    std::string lastError() const;
    SessionStats getStats() const;

    void setSegmentCallback(SegmentCallback cb);
    void setStateCallback(StateCallback cb);
    void setErrorCallback(ErrorCallback cb);

private:
    void workerLoop();

    std::string buildFfmpegCommand(const std::string& outputTemplate) const;

    bool startFFmpeg(const std::string& cmd);
    void stopFFmpeg();
    int monitorFFmpeg();

    bool mergeSegments(std::string& outFinalRelative, uint64_t& outSizeBytes, std::string& outMessage);

    void setStateInternal(SessionState s);
    void setErrorInternal(const std::string& err);

private:
    // identity / config
    std::string m_cameraId;
    std::string m_sessionId;
    std::string m_rtspUrl;
    int m_segmentSeconds = 10;
    std::shared_ptr<DiskLayout> m_diskLayout;
    std::string m_ffmpegPath;

    // runtime state
    mutable std::mutex m_stateMutex;
    std::atomic<SessionState> m_state { SessionState::IDLE };
    std::string m_lastError;

    // callbacks
    SegmentCallback m_segmentCallback;
    StateCallback m_stateCallback;
    ErrorCallback m_errorCallback;

    // stats
    mutable std::mutex m_statsMutex;
    SessionStats m_stats;

    // thread/stop control
    std::atomic<bool> m_stopRequested { false };
    std::thread m_workerThread;

    // FFmpeg process
    int m_ffmpegPid = -1;

#ifdef _WIN32
    // Keep a process handle so we can stop/wait reliably.
    // Stored as void* to avoid including Windows headers in the header.
    void* m_ffmpegHandle = nullptr;
#endif

    // segment tracking
    std::set<int> m_seenSegments;
    int m_lastSegmentIdx = -1;

    // restart tracking
    int m_restartAttempts = 0;
};

} // namespace vms
