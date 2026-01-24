#pragma once

#include <string>

namespace vms {
namespace ai {

struct Config {
    // Server config
    std::string host = "0.0.0.0";
    int grpc_port = 50052;
    std::string log_level = "info";

    // Stub event generation config (Phase 5.3 - disabled when inference enabled)
    bool stub_enabled = false;  // Default OFF when inference available
    int stub_event_interval_ms = 3000;
    int stub_max_events_per_tick = 50;

    // Inference config (Phase 5.5)
    std::string model_path = "models/yolov8s.onnx";
    std::string model_type = "YOLOV8";
    int inference_threads = 4;
    int default_sample_fps = 20;            // Increased from 5 for smooth tracking
    float default_min_confidence = 0.10f;
    int default_min_event_interval_ms = 0;  // Disabled throttling (was 3000ms) to allow real-time position updates
    int default_max_detections = 20;

    // Load configuration from environment variables
    static Config load();

    // Validate configuration
    bool validate() const;
};

} // namespace ai
} // namespace vms
