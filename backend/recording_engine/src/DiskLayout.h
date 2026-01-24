#pragma once

#include <string>
#include <filesystem>

namespace vms {

/**
 * Manages disk layout for recordings
 * Ensures paths are safe (no traversal) and directories exist
 */
class DiskLayout {
public:
    explicit DiskLayout(const std::string& baseDir);
    
    /**
     * Build segment file path
     * @param cameraId Camera UUID
     * @param sessionId Session UUID
     * @param segmentIndex 1-based segment index
     * @return Full path to segment file
     */
    std::filesystem::path buildSegmentPath(
        const std::string& cameraId,
        const std::string& sessionId,
        uint32_t segmentIndex
    ) const;
    
    /**
     * Build session directory path
     * @param cameraId Camera UUID
     * @param sessionId Session UUID
     * @return Full path to session directory
     */
    std::filesystem::path buildSessionDir(
        const std::string& cameraId,
        const std::string& sessionId
    ) const;
    
    /**
     * Get relative path from base directory
     * @param fullPath Full path to file
     * @return Relative path string
     */
    std::string getRelativePath(const std::filesystem::path& fullPath) const;
    
    /**
     * Ensure directory exists
     * @param dir Directory path
     * @return true if directory exists or was created
     */
    bool ensureDir(const std::filesystem::path& dir) const;
    
    /**
     * Check if path is within base directory (traversal protection)
     * @param path Path to check
     * @return true if path is safe
     */
    bool isPathSafe(const std::filesystem::path& path) const;
    
    /**
     * Get disk usage statistics
     */
    struct DiskStats {
        uint64_t free_bytes = 0;
        uint64_t total_bytes = 0;
        uint64_t used_bytes = 0;
    };
    DiskStats getDiskStats() const;
    
    const std::filesystem::path& baseDir() const { return m_baseDir; }
    
private:
    std::filesystem::path m_baseDir;
};

} // namespace vms
