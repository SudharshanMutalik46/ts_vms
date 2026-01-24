#pragma once

#include "Logger.h"
#include "Geometry.h"


#include <string>
#include <unordered_map>
#include <vector>
#include <mutex>
#include <cmath>
#include <tuple>

namespace vms {
namespace ai {

/**
 * Direction of line crossing.
 */
enum class CrossingDirection {
    NONE,
    A_TO_B,      // Crossed from side A to side B
    B_TO_A       // Crossed from side B to side A
};

/**
 * Line definition for crossing detection.
 */
struct CrossingLine {
    std::string id;           // Unique line identifier
    float x1, y1;             // Start point (normalized 0-1)
    float x2, y2;             // End point (normalized 0-1)
    bool bidirectional = true; // Detect both directions
    std::string allowed_direction; // "A_TO_B", "B_TO_A", or empty for both
};

/**
 * Line crossing event.
 */
struct LineCrossEvent {
    CrossingDirection direction = CrossingDirection::NONE;
    std::string line_id;
    std::string class_label;  // e.g., "PERSON", "VEHICLE"
    std::string camera_id;
    int64_t timestamp_ms = 0;
    float object_x, object_y; // Position when crossing detected
    int track_id = 0;         // Unique tracking ID
};

/**
 * LineCrossMonitor - Detects when objects cross defined lines.
 * 
 * Algorithm:
 * 1. Track object positions across frames using simple centroid tracking
 * 2. For each tracked object, check if its movement vector intersects any line
 * 3. Determine crossing direction based on which side the object started
 * 
 * Thread-safe.
 */
class LineCrossMonitor {
public:
    struct Config {
        int min_track_frames = 1;        // Instant tracking (was 3)
        float max_movement_threshold = 0.5f; // Max distance per frame (NORMALIZED 0-1)
        int64_t track_timeout_ms = 2000; // Timeout for lost tracks
        int64_t debounce_ms = 1000;      // Minimum time between events for same object
    };

    explicit LineCrossMonitor(const Config& config = Config()) : config_(config) {}

    /**
     * Set crossing lines for a camera.
     */
    void setLines(const std::string& camera_id, const std::vector<CrossingLine>& lines) {
        std::lock_guard<std::mutex> lock(mutex_);
        camera_lines_[camera_id] = lines;
    }

    /**
     * Clear lines for a camera.
     */
    void clearLines(const std::string& camera_id) {
        std::lock_guard<std::mutex> lock(mutex_);
        camera_lines_.erase(camera_id);
        // Also clear tracking state for this camera
        for (auto it = object_tracks_.begin(); it != object_tracks_.end();) {
            if (it->first.rfind(camera_id + "::", 0) == 0) {
                it = object_tracks_.erase(it);
            } else {
                ++it;
            }
        }
    }

    /**
     * Update with current frame detections and check for line crossings.
     * 
     * @param camera_id Camera identifier
     * @param detections List of (class_label, center_x, center_y) tuples
     * @param now_ms Current timestamp
     * @return Vector of crossing events (may be empty)
     */
    std::vector<LineCrossEvent> update(
        const std::string& camera_id,
        const std::vector<std::tuple<std::string, float, float>>& detections,
        int64_t now_ms
    ) {
        std::lock_guard<std::mutex> lock(mutex_);
        std::vector<LineCrossEvent> events;

        // Get lines for this camera
        auto lines_it = camera_lines_.find(camera_id);
        if (lines_it == camera_lines_.end() || lines_it->second.empty()) {
            return events;
        }
        const auto& lines = lines_it->second;
        
        // Debug detection count
        // static int64_t last_log = 0;
        // if (now_ms - last_log > 5000) {
        //    LOG_INFO("Monitor: Camera {} has {} lines, processing {} detections", camera_id, lines.size(), detections.size());
        //    last_log = now_ms;
        // }

        // Simple tracking: match detections to existing tracks by proximity
        std::vector<bool> detection_matched(detections.size(), false);
        
        // Update existing tracks
        for (auto& [track_key, track] : object_tracks_) {
            if (track_key.rfind(camera_id + "::", 0) != 0) continue;
            
            // Find closest matching detection
            float min_dist = config_.max_movement_threshold;
            int best_idx = -1;
            
            for (size_t i = 0; i < detections.size(); i++) {
                if (detection_matched[i]) continue;
                
                const auto& [cls, x, y] = detections[i];
                if (cls != track.class_label) continue;
                
                float dist = std::sqrt(
                    (x - track.last_x) * (x - track.last_x) +
                    (y - track.last_y) * (y - track.last_y)
                );
                
                if (dist < min_dist) {
                    min_dist = dist;
                    best_idx = static_cast<int>(i);
                }
            }
            
            if (best_idx >= 0) {
                detection_matched[best_idx] = true;
                const auto& [cls, new_x, new_y] = detections[best_idx];
                
                // Check for line crossing between old and new position
                for (const auto& line : lines) {
                    auto crossing = checkLineCrossing(
                        track.last_x, track.last_y,
                        new_x, new_y,
                        line
                    );
                    
                    if (crossing != CrossingDirection::NONE) {
                        // Check debounce
                        if (now_ms - track.last_event_ms < config_.debounce_ms) {
                            continue; // Ignore rapid re-trigger
                        }

                        LineCrossEvent evt;
                        evt.direction = crossing;
                        evt.line_id = line.id;
                        evt.class_label = track.class_label;
                        evt.camera_id = camera_id;
                        evt.timestamp_ms = now_ms;
                        evt.object_x = new_x;
                        evt.object_y = new_y;
                        evt.track_id = track.track_id;
                        events.push_back(evt);

                        track.last_event_ms = now_ms;
                    }
                }
                
                // Update track
                track.last_x = new_x;
                track.last_y = new_y;
                track.last_seen_ms = now_ms;
                track.frame_count++;
            }
        }
        
        // Create new tracks for unmatched detections
        for (size_t i = 0; i < detections.size(); i++) {
            if (detection_matched[i]) continue;
            
            const auto& [cls, x, y] = detections[i];
            std::string track_key = camera_id + "::" + cls + "::" + 
                                    std::to_string(static_cast<int>(x * 1000)) + "_" +
                                    std::to_string(static_cast<int>(y * 1000));
            
            ObjectTrack new_track;
            new_track.class_label = cls;
            new_track.last_x = x;
            new_track.last_y = y;
            new_track.last_seen_ms = now_ms;
            new_track.frame_count = 1;
            new_track.track_id = track_id_counter_++; // Assign unique ID
            
            object_tracks_[track_key] = new_track;
        }
        
        // Cleanup stale tracks
        for (auto it = object_tracks_.begin(); it != object_tracks_.end();) {
            if (now_ms - it->second.last_seen_ms > config_.track_timeout_ms) {
                it = object_tracks_.erase(it);
            } else {
                ++it;
            }
        }
        
        return events;
    }

    void clear() {
        std::lock_guard<std::mutex> lock(mutex_);
        camera_lines_.clear();
        object_tracks_.clear();
    }

private:
    struct ObjectTrack {
        std::string class_label;
        float last_x = 0, last_y = 0;
        int64_t last_seen_ms = 0;
        int64_t last_event_ms = 0; // Debounce tracking
        int frame_count = 0;
        int track_id = 0;
    };

    /**
     * Check if movement from (x1,y1) to (x2,y2) crosses the line.
     * Returns crossing direction or NONE.
     */
    CrossingDirection checkLineCrossing(
        float px1, float py1,  // Previous position
        float px2, float py2,  // Current position
        const CrossingLine& line
    ) {
        // Line segment intersection algorithm
        float lx1 = line.x1, ly1 = line.y1;
        float lx2 = line.x2, ly2 = line.y2;
        
        // Direction vectors
        float d1x = px2 - px1, d1y = py2 - py1;
        float d2x = lx2 - lx1, d2y = ly2 - ly1;
        
        // Cross product
        float cross = d1x * d2y - d1y * d2x;
        if (std::abs(cross) < 1e-10f) return CrossingDirection::NONE; // Parallel
        
        // Parameters
        float t = ((lx1 - px1) * d2y - (ly1 - py1) * d2x) / cross;
        float u = ((lx1 - px1) * d1y - (ly1 - py1) * d1x) / cross;
        
        // Check if intersection is within both segments
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            // Determine direction based on which side the object came from
            // Using cross product to determine side
            float side_before = (lx2 - lx1) * (py1 - ly1) - (ly2 - ly1) * (px1 - lx1);
            
            if (side_before > 0) {
                return CrossingDirection::A_TO_B;
            } else {
                return CrossingDirection::B_TO_A;
            }
        }
        
        return CrossingDirection::NONE;
    }

    Config config_;
    std::unordered_map<std::string, std::vector<CrossingLine>> camera_lines_;
    std::unordered_map<std::string, ObjectTrack> object_tracks_;
    std::mutex mutex_;
    int track_id_counter_ = 1000; // Start IDs from 1000 for readability
};

} // namespace ai
} // namespace vms
