#pragma once
#ifndef VMS_AI_INFERENCEPIPELINE_H
#define VMS_AI_INFERENCEPIPELINE_H

#include "RtspDecoder.h"
#include <string>
#include "OnnxInference.h"
#include "TemporalEventFilter.h"
#include "ClassFilter.h"
#include "Geometry.h"
#include "ZoneMonitor.h"
#include "LineCrossMonitor.h"
#include "ai_engine.grpc.pb.h"

#include <memory>
#include <thread>
#include <atomic>
#include <mutex>
#include <functional>
#include <chrono>
#include <queue>

namespace vms {
namespace ai {

struct VmsPipelineConfig {
    std::string camera_id;
    std::string rtsp_url;
    StreamRole role = StreamRole::SUB;
    std::string feature_code = "PERSON";
    
    // Per-camera config (from config_json)
    int sample_fps = 5;
    float min_confidence = 0.6f;
    int min_event_interval_ms = 3000;
    int max_detections = 20;
    std::string rtsp_transport = "tcp";
    std::string line_coords = ""; // Format: "x1,y1,x2,y2"
    std::string roi_polygon = ""; // Format: "x1,y1,x2,y2,..."
};

// Callback for emitting events
using EventCallback = std::function<void(const AiEvent&)>;

class InferencePipeline {
public:
    explicit InferencePipeline(const VmsPipelineConfig& config,  
                               std::shared_ptr<OnnxInference> inference);
    ~InferencePipeline();

    void start(EventCallback callback);
    void stop();
    
    void updateConfig(const VmsPipelineConfig& config);
    
    bool isRunning() const { return running_; }

    // Stats
    struct Stats {
        double decode_fps;
        double infer_fps;
        double avg_infer_ms;
        int reconnect_count;
        int events_emitted;
        int frames_processed;
        int frames_dropped;
    };
    Stats getStats() const;

private:
    void processingLoop();
    void onFrame(const uint8_t* data, int width, int height, int64_t timestamp_ms);
    AiEvent createEvent(const InferenceResult& result, const std::string& event_type, const std::string& zone_id = "");
    std::string generateUuid() const;
    std::string buildMetadataJson(const InferenceResult& result, const std::string& zone_id = "") const;
    int64_t nowMs() const;

    VmsPipelineConfig config_;
    std::shared_ptr<OnnxInference> inference_;
    std::unique_ptr<RtspDecoder> decoder_;
    EventCallback event_callback_;

    // Thread control
    std::thread processing_thread_;
    std::atomic<bool> running_{false};
    
    // Frame queue (latest-frame-wins)
    mutable std::mutex frame_mutex_;
    std::vector<uint8_t> latest_frame_;
    int latest_width_ = 0;
    int latest_height_ = 0;
    int64_t latest_timestamp_ = 0;
    std::atomic<bool> has_new_frame_{false};

    // Rate limiting
    std::chrono::steady_clock::time_point last_infer_time_;
    std::chrono::steady_clock::time_point last_event_time_;

    // Stats
    std::atomic<int> events_emitted_{0};
    std::atomic<int> frames_processed_{0};
    std::atomic<int> frames_dropped_{0};
    std::atomic<double> avg_infer_ms_{0};
    double total_infer_ms_ = 0;
    int infer_count_ = 0;

    // Post-processing filters
    TemporalEventFilter temporal_filter_;
    ClassFilter class_filter_;
    
    std::vector<ROI> rois_;           // Regions of interest
    ZoneMonitor zone_monitor_;        // Zone state machine
    LineCrossMonitor line_cross_monitor_; // Line crossing detection
    std::vector<CrossingLine> crossing_lines_; // Configured crossing lines
};

} // namespace ai
} // namespace vms

#endif // VMS_AI_INFERENCEPIPELINE_H
