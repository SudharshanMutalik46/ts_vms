#pragma once

#include <spdlog/spdlog.h>
#include <string>

namespace vms {

class Logger {
public:
    static void init(const std::string& level);
    static void shutdown();
};

} // namespace vms

// Convenience macros
#define LOG_TRACE(...) spdlog::trace(__VA_ARGS__)
#define LOG_DEBUG(...) spdlog::debug(__VA_ARGS__)
#define LOG_INFO(...)  spdlog::info(__VA_ARGS__)
#define LOG_WARN(...)  spdlog::warn(__VA_ARGS__)
#define LOG_ERROR(...) spdlog::error(__VA_ARGS__)
#define LOG_CRITICAL(...) spdlog::critical(__VA_ARGS__)
