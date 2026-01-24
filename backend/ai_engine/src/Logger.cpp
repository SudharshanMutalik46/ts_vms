#include "Logger.h"
#include <spdlog/sinks/stdout_color_sinks.h>
#include <spdlog/sinks/basic_file_sink.h>
#include <vector>

namespace vms {

void Logger::init(const std::string& level) {
    auto console_sink = std::make_shared<spdlog::sinks::stdout_color_sink_mt>();
    auto file_sink = std::make_shared<spdlog::sinks::basic_file_sink_mt>("ai_engine.log", true);
    
    std::vector<spdlog::sink_ptr> sinks {console_sink, file_sink};
    
    auto logger = std::make_shared<spdlog::logger>("ai_engine", sinks.begin(), sinks.end());
    
    // Set pattern: [Time] [Level] Message
    logger->set_pattern("[%Y-%m-%d %H:%M:%S.%e] [%^%l%$] %v");
    
    spdlog::set_default_logger(logger);
    
    // Set level
    if (level == "trace") spdlog::set_level(spdlog::level::trace);
    else if (level == "debug") spdlog::set_level(spdlog::level::debug);
    else if (level == "info") spdlog::set_level(spdlog::level::info);
    else if (level == "warn") spdlog::set_level(spdlog::level::warn);
    else if (level == "error") spdlog::set_level(spdlog::level::err);
    else spdlog::set_level(spdlog::level::info);
}

void Logger::shutdown() {
    spdlog::shutdown();
}

} // namespace vms
