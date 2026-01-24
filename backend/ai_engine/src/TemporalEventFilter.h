#pragma once

#include <string>
#include <unordered_map>
#include <chrono>
#include <mutex>

namespace vms {
namespace ai {

/**
 * TemporalEventFilter - Suppresses duplicate events within a time window.
 * 
 * Purpose: Prevent the same detection (e.g., "person") from generating
 * hundreds of events per second. Implements per-class-per-camera suppression.
 * 
 * Thread-safe: Yes (uses internal mutex).
 */
class TemporalEventFilter {
public:
    explicit TemporalEventFilter(int suppression_window_ms = 2000)
        : suppression_window_ms_(suppression_window_ms) {}

    /**
     * Check if an event should be emitted.
     * @param camera_id Camera identifier
     * @param class_label Detection class (e.g., "person", "car")
     * @param now_ms Current timestamp in milliseconds
     * @return true if event should be emitted, false if suppressed
     */
    bool shouldEmit(const std::string& camera_id, 
                    const std::string& class_label,
                    int64_t now_ms) {
        std::lock_guard<std::mutex> lock(mutex_);
        
        std::string key = camera_id + "::" + class_label;
        auto it = last_emit_times_.find(key);
        
        if (it == last_emit_times_.end()) {
            // First detection of this class on this camera
            last_emit_times_[key] = now_ms;
            return true;
        }
        
        int64_t elapsed = now_ms - it->second;
        if (elapsed >= suppression_window_ms_) {
            // Window expired, allow event
            it->second = now_ms;
            return true;
        }
        
        // Within suppression window, drop
        return false;
    }

    /**
     * Clear all state (e.g., on camera removal or reconfiguration).
     */
    void clear() {
        std::lock_guard<std::mutex> lock(mutex_);
        last_emit_times_.clear();
    }

    /**
     * Clear state for a specific camera.
     */
    void clearCamera(const std::string& camera_id) {
        std::lock_guard<std::mutex> lock(mutex_);
        for (auto it = last_emit_times_.begin(); it != last_emit_times_.end();) {
            if (it->first.rfind(camera_id + "::", 0) == 0) {
                it = last_emit_times_.erase(it);
            } else {
                ++it;
            }
        }
    }

    void setSuppressionWindow(int ms) { suppression_window_ms_ = ms; }
    int getSuppressionWindow() const { return suppression_window_ms_; }

private:
    int suppression_window_ms_;
    std::unordered_map<std::string, int64_t> last_emit_times_;
    std::mutex mutex_;
};

} // namespace ai
} // namespace vms
