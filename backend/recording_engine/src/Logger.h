#pragma once

#include <spdlog/spdlog.h>
#include <memory>
#include <string>

namespace vms {

/**
 * Logger wrapper for consistent logging across the application
 * Uses spdlog under the hood
 */
class Logger {
public:
    /**
     * Initialize the logger
     * @param level Log level string (trace, debug, info, warn, error)
     */
    static void init(const std::string& level);
    
    /**
     * Get the main logger instance
     */
    static std::shared_ptr<spdlog::logger> get();
    
    /**
     * Shutdown and flush logs
     */
    static void shutdown();
    
private:
    static std::shared_ptr<spdlog::logger> s_logger;
};

// Convenience macros
#define LOG_TRACE(...) SPDLOG_LOGGER_TRACE(vms::Logger::get(), __VA_ARGS__)
#define LOG_DEBUG(...) SPDLOG_LOGGER_DEBUG(vms::Logger::get(), __VA_ARGS__)
#define LOG_INFO(...) SPDLOG_LOGGER_INFO(vms::Logger::get(), __VA_ARGS__)
#define LOG_WARN(...) SPDLOG_LOGGER_WARN(vms::Logger::get(), __VA_ARGS__)
#define LOG_ERROR(...) SPDLOG_LOGGER_ERROR(vms::Logger::get(), __VA_ARGS__)

} // namespace vms
