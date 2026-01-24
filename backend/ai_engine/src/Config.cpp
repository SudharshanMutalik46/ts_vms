#include "Config.h"
#include <cstdlib>
#include <iostream>

namespace vms {
namespace ai {

Config Config::load() {
    Config config;

    // Server config
    if (const char* env_host = std::getenv("AI_ENGINE_HOST")) {
        config.host = env_host;
    }

    if (const char* env_port = std::getenv("AI_ENGINE_PORT")) {
        config.grpc_port = std::stoi(env_port);
    }

    if (const char* env_log_level = std::getenv("LOG_LEVEL")) {
        config.log_level = env_log_level;
    }

    // Stub event config
    if (const char* env_stub = std::getenv("AI_STUB_ENABLED")) {
        config.stub_enabled = (std::string(env_stub) == "true" || std::string(env_stub) == "1");
    }

    if (const char* env_interval = std::getenv("AI_STUB_EVENT_INTERVAL_MS")) {
        config.stub_event_interval_ms = std::stoi(env_interval);
    }

    if (const char* env_max = std::getenv("AI_STUB_MAX_EVENTS_PER_TICK")) {
        config.stub_max_events_per_tick = std::stoi(env_max);
    }

    // Inference config
    if (const char* env_model = std::getenv("AI_MODEL_PATH")) {
        config.model_path = env_model;
    }

    if (const char* env_type = std::getenv("AI_MODEL_TYPE")) {
        config.model_type = env_type;
    }

    if (const char* env_threads = std::getenv("AI_INFERENCE_THREADS")) {
        config.inference_threads = std::stoi(env_threads);
    }

    if (const char* env_fps = std::getenv("AI_DEFAULT_SAMPLE_FPS")) {
        config.default_sample_fps = std::stoi(env_fps);
    }

    if (const char* env_conf = std::getenv("AI_DEFAULT_MIN_CONFIDENCE")) {
        config.default_min_confidence = std::stof(env_conf);
    }

    if (const char* env_event_int = std::getenv("AI_DEFAULT_MIN_EVENT_INTERVAL_MS")) {
        config.default_min_event_interval_ms = std::stoi(env_event_int);
    }

    if (const char* env_max_det = std::getenv("AI_DEFAULT_MAX_DETECTIONS")) {
        config.default_max_detections = std::stoi(env_max_det);
    }

    return config;
}

bool Config::validate() const {
    if (grpc_port <= 0 || grpc_port > 65535) {
        std::cerr << "Invalid gRPC port: " << grpc_port << std::endl;
        return false;
    }
    if (stub_event_interval_ms < 100) {
        std::cerr << "stub_event_interval_ms too low (min 100ms)" << std::endl;
        return false;
    }
    if (default_sample_fps < 1 || default_sample_fps > 30) {
        std::cerr << "Invalid sample_fps: " << default_sample_fps << " (must be 1-30)" << std::endl;
        return false;
    }
    return true;
}

} // namespace ai
} // namespace vms
