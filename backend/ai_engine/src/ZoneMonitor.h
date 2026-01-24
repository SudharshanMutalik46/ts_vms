#pragma once

#include "Geometry.h"
#include <string>
#include <unordered_map>
#include <vector>
#include <mutex>

namespace vms {
namespace ai {

/**
 * Event types that ZoneMonitor can trigger.
 */
enum class ZoneEventType {
    NONE,
    ENTRY,      // Zone transitioned from empty to occupied
    DWELL,      // Object has been in zone for > dwell_time
    EXIT        // Zone transitioned from occupied to empty
};

/**
 * ZoneEvent - Output from ZoneMonitor.
 */
struct ZoneEvent {
    ZoneEventType type = ZoneEventType::NONE;
    std::string zone_id;
    std::string class_label;    // e.g., "PERSON", "VEHICLE"
    std::string camera_id;
    int64_t start_time_ms = 0;  // When occupancy started
    int64_t current_time_ms = 0;
    int64_t dwell_duration_ms = 0;  // If DWELL event
};

/**
 * ZoneMonitor - State machine for zone occupancy and intrusion detection.
 * 
 * Tracks whether a zone is occupied per class and emits events:
 * - ENTRY: When zone becomes occupied
 * - DWELL: When occupancy exceeds threshold
 * - EXIT: When zone becomes empty (after grace period)
 * 
 * Thread-safe.
 */
class ZoneMonitor {
public:
    struct Config {
        int64_t dwell_time_ms = 5000;       // Time before DWELL event (5s)
        int64_t grace_period_ms = 1000;     // Grace period before EXIT (1s)
        int entry_frame_count = 2;          // Frames before ENTRY confirmed
    };

    explicit ZoneMonitor(const Config& config = Config()) : config_(config) {}

    /**
     * Update zone state based on current frame detections.
     * 
     * @param camera_id Camera identifier
     * @param zone_id Zone identifier
     * @param class_label Detection class (PERSON, VEHICLE)
     * @param count Number of detections of this class in zone (0 = empty)
     * @param now_ms Current timestamp
     * @return Vector of events triggered (may be empty, one, or multiple)
     */
    std::vector<ZoneEvent> update(
        const std::string& camera_id,
        const std::string& zone_id,
        const std::string& class_label,
        int count,
        int64_t now_ms
    ) {
        std::lock_guard<std::mutex> lock(mutex_);
        std::vector<ZoneEvent> events;
        
        std::string key = camera_id + "::" + zone_id + "::" + class_label;
        ZoneState& state = states_[key];
        
        bool is_occupied_now = (count > 0);
        
        if (!state.is_occupied && is_occupied_now) {
            // Transition: Empty -> Occupied
            state.pending_entry_frames++;
            
            if (state.pending_entry_frames >= config_.entry_frame_count) {
                // Confirmed ENTRY
                state.is_occupied = true;
                state.start_time = now_ms;
                state.last_seen_time = now_ms;
                state.dwell_fired = false;
                state.pending_entry_frames = 0;
                
                ZoneEvent evt;
                evt.type = ZoneEventType::ENTRY;
                evt.zone_id = zone_id;
                evt.class_label = class_label;
                evt.camera_id = camera_id;
                evt.start_time_ms = now_ms;
                evt.current_time_ms = now_ms;
                events.push_back(evt);
            }
        }
        else if (state.is_occupied && is_occupied_now) {
            // Still occupied
            state.last_seen_time = now_ms;
            state.pending_entry_frames = 0;
            
            // Check DWELL
            int64_t dwell_duration = now_ms - state.start_time;
            if (dwell_duration >= config_.dwell_time_ms && !state.dwell_fired) {
                state.dwell_fired = true;
                
                ZoneEvent evt;
                evt.type = ZoneEventType::DWELL;
                evt.zone_id = zone_id;
                evt.class_label = class_label;
                evt.camera_id = camera_id;
                evt.start_time_ms = state.start_time;
                evt.current_time_ms = now_ms;
                evt.dwell_duration_ms = dwell_duration;
                events.push_back(evt);
            }
        }
        else if (state.is_occupied && !is_occupied_now) {
            // Potentially transitioning to empty
            state.pending_entry_frames = 0;
            
            int64_t gone_duration = now_ms - state.last_seen_time;
            if (gone_duration >= config_.grace_period_ms) {
                // Confirmed EXIT
                ZoneEvent evt;
                evt.type = ZoneEventType::EXIT;
                evt.zone_id = zone_id;
                evt.class_label = class_label;
                evt.camera_id = camera_id;
                evt.start_time_ms = state.start_time;
                evt.current_time_ms = now_ms;
                evt.dwell_duration_ms = state.last_seen_time - state.start_time;
                events.push_back(evt);
                
                // Reset state
                state.is_occupied = false;
                state.start_time = 0;
                state.last_seen_time = 0;
                state.dwell_fired = false;
            }
        }
        else {
            // Empty -> Empty
            state.pending_entry_frames = 0;
        }
        
        return events;
    }

    /**
     * Clear all state.
     */
    void clear() {
        std::lock_guard<std::mutex> lock(mutex_);
        states_.clear();
    }

    /**
     * Clear state for a specific camera.
     */
    void clearCamera(const std::string& camera_id) {
        std::lock_guard<std::mutex> lock(mutex_);
        for (auto it = states_.begin(); it != states_.end();) {
            if (it->first.rfind(camera_id + "::", 0) == 0) {
                it = states_.erase(it);
            } else {
                ++it;
            }
        }
    }

    void setConfig(const Config& config) { config_ = config; }

private:
    struct ZoneState {
        bool is_occupied = false;
        int64_t start_time = 0;
        int64_t last_seen_time = 0;
        bool dwell_fired = false;
        int pending_entry_frames = 0;
    };

    Config config_;
    std::unordered_map<std::string, ZoneState> states_;
    std::mutex mutex_;
};

} // namespace ai
} // namespace vms
