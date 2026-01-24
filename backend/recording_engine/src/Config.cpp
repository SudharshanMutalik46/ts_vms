#include "Config.h"
#include <cstdlib>
#include <filesystem>

namespace vms {

namespace {

std::string getEnv(const char* name, const std::string& defaultValue) {
    const char* value = std::getenv(name);
    return value ? std::string(value) : defaultValue;
}

uint32_t getEnvUInt(const char* name, uint32_t defaultValue) {
    const char* value = std::getenv(name);
    if (!value) return defaultValue;
    try {
        return static_cast<uint32_t>(std::stoul(value));
    } catch (...) {
        return defaultValue;
    }
}

uint16_t getEnvPort(const char* name, uint16_t defaultValue) {
    return static_cast<uint16_t>(getEnvUInt(name, defaultValue));
}

} // anonymous namespace

Config Config::load() {
    Config cfg;
    
    cfg.grpc_port = getEnvPort("GRPC_PORT", 50051);
    cfg.recordings_dir = getEnv("RECORDINGS_DIR", "/var/lib/vms/recordings");
    cfg.log_level = getEnv("LOG_LEVEL", "info");
    cfg.segment_duration = getEnvUInt("SEGMENT_DURATION", 60);
    cfg.max_cameras = getEnvUInt("MAX_CAMERAS", 16);
    cfg.ffmpeg_path = getEnv("FFMPEG_PATH", "ffmpeg");
    cfg.reconnect_initial_delay_ms = getEnvUInt("RECONNECT_INITIAL_DELAY_MS", 1000);
    cfg.reconnect_max_delay_ms = getEnvUInt("RECONNECT_MAX_DELAY_MS", 30000);
    cfg.reconnect_max_attempts = getEnvUInt("RECONNECT_MAX_ATTEMPTS", 10);
    
    return cfg;
}

bool Config::validate() const {
    if (grpc_port == 0) return false;
    if (recordings_dir.empty()) return false;
    if (segment_duration < 10 || segment_duration > 3600) return false;
    if (max_cameras == 0 || max_cameras > 64) return false;
    return true;
}

} // namespace vms
