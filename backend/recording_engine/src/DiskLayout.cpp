#include "DiskLayout.h"
#include "Logger.h"
#include <chrono>
#include <iomanip>
#include <sstream>

namespace vms {

DiskLayout::DiskLayout(const std::string& baseDir) 
    : m_baseDir(std::filesystem::absolute(baseDir)) {
}

std::filesystem::path DiskLayout::buildSessionDir(
    const std::string& cameraId,
    const std::string& sessionId
) const {
    // Get current date
    auto now = std::chrono::system_clock::now();
    auto time = std::chrono::system_clock::to_time_t(now);
    auto tm = *std::localtime(&time);
    
    std::ostringstream year, month, day;
    year << std::setfill('0') << std::setw(4) << (tm.tm_year + 1900);
    month << std::setfill('0') << std::setw(2) << (tm.tm_mon + 1);
    day << std::setfill('0') << std::setw(2) << tm.tm_mday;
    
    // Build path: base/cameras/<camera_id>/<YYYY>/<MM>/<DD>/<session_id>/
    return m_baseDir / "cameras" / cameraId / year.str() / month.str() / day.str() / sessionId;
}

std::filesystem::path DiskLayout::buildSegmentPath(
    const std::string& cameraId,
    const std::string& sessionId,
    uint32_t segmentIndex
) const {
    auto sessionDir = buildSessionDir(cameraId, sessionId);
    
    // Format: segment_000001.mp4
    std::ostringstream filename;
    filename << "segment_" << std::setfill('0') << std::setw(6) << segmentIndex << ".mp4";
    
    return sessionDir / filename.str();
}

std::string DiskLayout::getRelativePath(const std::filesystem::path& fullPath) const {
    return std::filesystem::relative(fullPath, m_baseDir).string();
}

bool DiskLayout::ensureDir(const std::filesystem::path& dir) const {
    if (!isPathSafe(dir)) {
        LOG_ERROR("Unsafe path detected: {}", dir.string());
        return false;
    }
    
    try {
        if (!std::filesystem::exists(dir)) {
            std::filesystem::create_directories(dir);
            LOG_DEBUG("Created directory: {}", dir.string());
        }
        return true;
    } catch (const std::exception& e) {
        LOG_ERROR("Failed to create directory {}: {}", dir.string(), e.what());
        return false;
    }
}

bool DiskLayout::isPathSafe(const std::filesystem::path& path) const {
    try {
        auto canonical = std::filesystem::weakly_canonical(path);
        auto baseCanonical = std::filesystem::weakly_canonical(m_baseDir);
        
        // Check that path starts with base directory
        auto [baseIt, pathIt] = std::mismatch(
            baseCanonical.begin(), baseCanonical.end(),
            canonical.begin(), canonical.end()
        );
        
        return baseIt == baseCanonical.end();
    } catch (...) {
        return false;
    }
}

DiskLayout::DiskStats DiskLayout::getDiskStats() const {
    DiskStats stats;
    
    try {
        auto spaceInfo = std::filesystem::space(m_baseDir);
        stats.total_bytes = spaceInfo.capacity;
        stats.free_bytes = spaceInfo.available;
        stats.used_bytes = stats.total_bytes - stats.free_bytes;
    } catch (const std::exception& e) {
        LOG_ERROR("Failed to get disk stats: {}", e.what());
    }
    
    return stats;
}

} // namespace vms
