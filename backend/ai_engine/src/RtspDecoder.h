#pragma once

#include <string>
#include <functional>
#include <thread>
#include <atomic>
#include <mutex>
#include <chrono>

// Forward declarations for FFmpeg types
struct AVFormatContext;
struct AVCodecContext;
struct AVFrame;
struct AVPacket;
struct SwsContext;

namespace vms {
namespace ai {

// Callback for decoded frames
// Receives: BGR frame data, width, height, timestamp_ms
using FrameCallback = std::function<void(const uint8_t* data, int width, int height, int64_t timestamp_ms)>;

struct RtspConfig {
    std::string rtsp_url;
    std::string camera_id;
    std::string transport = "tcp";  // tcp or udp
    int reconnect_delay_ms = 2000;
    int max_reconnect_attempts = -1; // -1 = infinite
};

class RtspDecoder {
public:
    explicit RtspDecoder(const RtspConfig& config);
    ~RtspDecoder();

    // Start/stop the decode thread
    void start(FrameCallback callback);
    void stop();

    // Status
    bool isRunning() const { return running_; }
    bool isConnected() const { return connected_; }
    int getReconnectCount() const { return reconnect_count_; }

    // Stats
    double getDecodeFps() const { return decode_fps_; }
    double getAvgDecodeMs() const { return avg_decode_ms_; }

private:
    void decodeLoop();
    bool connect();
    void disconnect();
    bool decodeFrame();
    std::string redactUrl(const std::string& url) const;

    RtspConfig config_;
    FrameCallback callback_;

    // FFmpeg contexts (opaque pointers to avoid header pollution)
    AVFormatContext* format_ctx_ = nullptr;
    AVCodecContext* codec_ctx_ = nullptr;
    AVFrame* frame_ = nullptr;
    AVFrame* frame_bgr_ = nullptr;
    AVPacket* packet_ = nullptr;
    SwsContext* sws_ctx_ = nullptr;
    int video_stream_idx_ = -1;

    // Thread control
    std::thread decode_thread_;
    std::atomic<bool> running_{false};
    std::atomic<bool> connected_{false};
    std::atomic<int> reconnect_count_{0};

    // Stats
    std::atomic<double> decode_fps_{0.0};
    std::atomic<double> avg_decode_ms_{0.0};
    std::chrono::steady_clock::time_point last_frame_time_;
    int frame_count_ = 0;
    double total_decode_ms_ = 0;
};

} // namespace ai
} // namespace vms
