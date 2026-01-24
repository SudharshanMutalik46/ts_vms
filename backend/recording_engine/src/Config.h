#pragma once

#include <string>
#include <cstdint>

namespace vms {

/**
 * Configuration for the Recording Engine
 * Loaded from environment variables
 */
struct Config {
    // gRPC server port
    uint16_t grpc_port = 50051;
    
    // Base directory for recordings
    std::string recordings_dir = "/var/lib/vms/recordings";
    
    // Logging level (trace, debug, info, warn, error)
    std::string log_level = "info";
    
    // Default segment duration in seconds
    uint32_t segment_duration = 60;
    
    // Maximum concurrent recordings
    uint32_t max_cameras = 16;
    
    // FFmpeg executable path
    std::string ffmpeg_path = "ffmpeg";
    
    // Reconnect backoff settings
    uint32_t reconnect_initial_delay_ms = 1000;
    uint32_t reconnect_max_delay_ms = 30000;
    uint32_t reconnect_max_attempts = 10;
    
    /**
     * Load configuration from environment variables
     */
    static Config load();
    
    /**
     * Validate configuration
     * @return true if valid
     */
    bool validate() const;
};

} // namespace vms
