#include "Logger.h"
#include <spdlog/sinks/stdout_color_sinks.h>
#include <spdlog/sinks/rotating_file_sink.h>
#include <algorithm>

namespace vms {

std::shared_ptr<spdlog::logger> Logger::s_logger = nullptr;

void Logger::init(const std::string& level) {
    // Create console sink
    auto console_sink = std::make_shared<spdlog::sinks::stdout_color_sink_mt>();
    console_sink->set_pattern("[%Y-%m-%d %H:%M:%S.%e] [%^%l%$] [%t] %v");
    
    // Create logger with console sink
    s_logger = std::make_shared<spdlog::logger>("vms", console_sink);
    
    // Set log level
    std::string lvl = level;
    std::transform(lvl.begin(), lvl.end(), lvl.begin(), ::tolower);
    
    if (lvl == "trace") {
        s_logger->set_level(spdlog::level::trace);
    } else if (lvl == "debug") {
        s_logger->set_level(spdlog::level::debug);
    } else if (lvl == "info") {
        s_logger->set_level(spdlog::level::info);
    } else if (lvl == "warn" || lvl == "warning") {
        s_logger->set_level(spdlog::level::warn);
    } else if (lvl == "error") {
        s_logger->set_level(spdlog::level::err);
    } else {
        s_logger->set_level(spdlog::level::info);
    }
    
    // Register as default
    spdlog::set_default_logger(s_logger);
    
    LOG_INFO("Logger initialized with level: {}", level);
}

std::shared_ptr<spdlog::logger> Logger::get() {
    if (!s_logger) {
        // Fallback to default logger
        return spdlog::default_logger();
    }
    return s_logger;
}

void Logger::shutdown() {
    if (s_logger) {
        s_logger->flush();
    }
    spdlog::shutdown();
}

} // namespace vms
