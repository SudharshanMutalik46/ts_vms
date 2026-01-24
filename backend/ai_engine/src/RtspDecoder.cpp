#include "RtspDecoder.h"
#include "Logger.h"

extern "C" {
#include <libavformat/avformat.h>
#include <libavcodec/avcodec.h>
#include <libswscale/swscale.h>
#include <libavutil/imgutils.h>
}

#include <regex>

namespace vms {
namespace ai {

RtspDecoder::RtspDecoder(const RtspConfig& config) : config_(config) {}

RtspDecoder::~RtspDecoder() {
    stop();
}

std::string RtspDecoder::redactUrl(const std::string& url) const {
    // Redact credentials from URL for safe logging
    static std::regex cred_pattern("://([^:]+):([^@]+)@");
    return std::regex_replace(url, cred_pattern, "://***:***@");
}

void RtspDecoder::start(FrameCallback callback) {
    if (running_) return;
    
    callback_ = std::move(callback);
    running_ = true;
    decode_thread_ = std::thread(&RtspDecoder::decodeLoop, this);
    
    LOG_INFO("RtspDecoder started for camera {}", config_.camera_id);
}

void RtspDecoder::stop() {
    running_ = false;
    if (decode_thread_.joinable()) {
        decode_thread_.join();
    }
    disconnect();
    LOG_INFO("RtspDecoder stopped for camera {}", config_.camera_id);
}

bool RtspDecoder::connect() {
    disconnect();

    format_ctx_ = avformat_alloc_context();
    if (!format_ctx_) {
        LOG_ERROR("Failed to allocate format context");
        return false;
    }

    // Set RTSP options
    AVDictionary* opts = nullptr;
    // Force TCP for reliability with HEVC
    av_dict_set(&opts, "rtsp_transport", "tcp", 0);
    // av_dict_set(&opts, "rtsp_transport", config_.transport.c_str(), 0);

    av_dict_set(&opts, "stimeout", "10000000", 0);  // 10 second timeout
    av_dict_set(&opts, "analyzeduration", "10000000", 0); // Increase to 10s for HEVC stability
    av_dict_set(&opts, "probesize", "10000000", 0);       // Increase to 10MB
    // Low latency options - Relaxed for stability
    // av_dict_set(&opts, "fflags", "nobuffer", 0); 
    // av_dict_set(&opts, "flags", "low_delay", 0); // Disabled low_delay for better HEVC reference matching
    av_dict_set(&opts, "strict", "experimental", 0);
    // av_dict_set(&opts, "max_delay", "0", 0);       // Disabled for better B-frame/REF frame handling

    int ret = avformat_open_input(&format_ctx_, config_.rtsp_url.c_str(), nullptr, &opts);
    av_dict_free(&opts);

    if (ret < 0) {
        char errbuf[256];
        av_strerror(ret, errbuf, sizeof(errbuf));
        LOG_ERROR("Failed to open RTSP stream {}: {}", redactUrl(config_.rtsp_url), errbuf);
        avformat_free_context(format_ctx_);
        format_ctx_ = nullptr;
        return false;
    }

    if (avformat_find_stream_info(format_ctx_, nullptr) < 0) {
        LOG_ERROR("Failed to find stream info");
        disconnect();
        return false;
    }

    // Find video stream
    video_stream_idx_ = -1;
    for (unsigned i = 0; i < format_ctx_->nb_streams; i++) {
        if (format_ctx_->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_VIDEO) {
            video_stream_idx_ = i;
            break;
        }
    }

    if (video_stream_idx_ < 0) {
        LOG_ERROR("No video stream found");
        disconnect();
        return false;
    }

    // Setup decoder
    AVCodecParameters* codecpar = format_ctx_->streams[video_stream_idx_]->codecpar;
    const AVCodec* codec = avcodec_find_decoder(codecpar->codec_id);
    if (!codec) {
        LOG_ERROR("Unsupported codec");
        disconnect();
        return false;
    }

    codec_ctx_ = avcodec_alloc_context3(codec);
    avcodec_parameters_to_context(codec_ctx_, codecpar);
    
    if (avcodec_open2(codec_ctx_, codec, nullptr) < 0) {
        LOG_ERROR("Failed to open codec");
        disconnect();
        return false;
    }

    // Allocate frames
    frame_ = av_frame_alloc();
    frame_bgr_ = av_frame_alloc();
    packet_ = av_packet_alloc();

    // Setup scaler for BGR conversion
    // OPTIMIZATION: Resize to 640x640 directly during decode/convert
    // This saves massive bandwidth if the source is 1080p or 4K.
    // The AI model expects 640x640 anyway.
    int target_w = 640;
    int target_h = 640;
    
    sws_ctx_ = sws_getContext(
        codec_ctx_->width, codec_ctx_->height, codec_ctx_->pix_fmt,
        target_w, target_h, AV_PIX_FMT_BGR24,
        SWS_BILINEAR, nullptr, nullptr, nullptr
    );

    // Allocate BGR buffer for target size
    int num_bytes = av_image_get_buffer_size(AV_PIX_FMT_BGR24, target_w, target_h, 1);
    uint8_t* buffer = (uint8_t*)av_malloc(num_bytes);
    av_image_fill_arrays(frame_bgr_->data, frame_bgr_->linesize, buffer,
                         AV_PIX_FMT_BGR24, target_w, target_h, 1);

    connected_ = true;
    LOG_INFO("Connected to RTSP stream {} (src: {}x{}, target: {}x{}, linesize={})", 
             redactUrl(config_.rtsp_url), codec_ctx_->width, codec_ctx_->height, target_w, target_h, frame_bgr_->linesize[0]);
    
    return true;
}

void RtspDecoder::disconnect() {
    connected_ = false;

    if (sws_ctx_) {
        sws_freeContext(sws_ctx_);
        sws_ctx_ = nullptr;
    }
    if (frame_bgr_) {
        if (frame_bgr_->data[0]) av_free(frame_bgr_->data[0]);
        av_frame_free(&frame_bgr_);
    }
    if (frame_) av_frame_free(&frame_);
    if (packet_) av_packet_free(&packet_);
    if (codec_ctx_) avcodec_free_context(&codec_ctx_);
    if (format_ctx_) {
        avformat_close_input(&format_ctx_);
    }
    video_stream_idx_ = -1;
}

bool RtspDecoder::decodeFrame() {
    if (!format_ctx_ || !codec_ctx_) return false;

    auto start = std::chrono::steady_clock::now();

    while (running_) {
        int ret = av_read_frame(format_ctx_, packet_);
        if (ret < 0) {
            char errbuf[256];
            av_strerror(ret, errbuf, sizeof(errbuf));
            LOG_WARN("av_read_frame failed (error {}): {}", ret, errbuf);
            return false;
        }

        if (packet_->stream_index != video_stream_idx_) {
            av_packet_unref(packet_);
            continue;
        }

        ret = avcodec_send_packet(codec_ctx_, packet_);
        av_packet_unref(packet_);
        
        if (ret < 0) continue;

        ret = avcodec_receive_frame(codec_ctx_, frame_);
        if (ret == AVERROR(EAGAIN)) continue;
        if (ret < 0) return false;

        // Convert to BGR
        // Note: Destination height is 640
        sws_scale(sws_ctx_, frame_->data, frame_->linesize, 0, 
                  codec_ctx_->height, frame_bgr_->data, frame_bgr_->linesize);

        // Calculate timestamp
        // int64_t pts = frame_->best_effort_timestamp;
        // AVRational time_base = format_ctx_->streams[video_stream_idx_]->time_base;
        // int64_t timestamp_ms = av_rescale_q(pts, time_base, {1, 1000});
        
        // Force wall clock timestamp to avoid clock skew latency and measure system latency
        int64_t timestamp_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()
        ).count();

        // Update stats
        auto end = std::chrono::steady_clock::now();
        double decode_ms = std::chrono::duration<double, std::milli>(end - start).count();
        total_decode_ms_ += decode_ms;
        frame_count_++;
        avg_decode_ms_ = total_decode_ms_ / frame_count_;

        // Calculate FPS
        auto now = std::chrono::steady_clock::now();
        if (last_frame_time_.time_since_epoch().count() > 0) {
            double elapsed = std::chrono::duration<double>(now - last_frame_time_).count();
            if (elapsed > 0) {
                decode_fps_ = 1.0 / elapsed;
            }
        }
        last_frame_time_ = now;

        // Invoke callback with BGR frame
        if (callback_) {
            // Pass target dimensions (640x640)
            callback_(frame_bgr_->data[0], 640, 640, timestamp_ms);
        }

        return true;
    }
    return false;
}

void RtspDecoder::decodeLoop() {
    int reconnect_delay = config_.reconnect_delay_ms;

    while (running_) {
        if (!connected_) {
            if (!connect()) {
                reconnect_count_++;
                LOG_WARN("Reconnect attempt {} for camera {}", reconnect_count_.load(), config_.camera_id);
                std::this_thread::sleep_for(std::chrono::milliseconds(reconnect_delay));
                // Exponential backoff (max 30s)
                reconnect_delay = std::min(reconnect_delay * 2, 30000);
                continue;
            }
            reconnect_delay = config_.reconnect_delay_ms; // Reset on success
        }

        if (!decodeFrame()) {
            // Error handling is inside decodeFrame but we want cleaner logs
            // LOG_WARN("Decode failed for camera {}, reconnecting...", config_.camera_id);
            disconnect();
        }
    }
}

} // namespace ai
} // namespace vms
