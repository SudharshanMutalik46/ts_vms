#pragma once

#include "OnnxInference.h"  // For Detection struct
#include <string>
#include <vector>
#include <unordered_set>
#include <algorithm>
#include <algorithm>

namespace vms {
namespace ai {

/**
 * ClassFilter - Filters detections to only allowed classes.
 * 
 * Default allowed classes for security: person, vehicle types.
 */
class ClassFilter {
public:
    ClassFilter() {
        // Default allow-list for security/VMS
        allowed_classes_ = {
            // People
            "person",
            // Vehicles
            "car", "motorcycle", "airplane", "bus", "train", "truck",
            // Personal Items
            "backpack", "suitcase",
            // All Animals (COCO dataset)
            "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe",
            // Potential weapons/suspicious items (Criminal Activity module)
            "knife", "scissors",
            // Fire-related markers (Fire Detection module placeholder)
            "fire hydrant"
        };
        buildLabelSet();
    }

    explicit ClassFilter(const std::vector<std::string>& allowed)
        : allowed_classes_(allowed) {
        buildLabelSet();
    }

    /**
     * Check if a detection's class is allowed.
     * @param label The class label (lowercase)
     * @return true if allowed
     */
    bool isAllowed(const std::string& label) const {
        std::string lower = label;
        std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
        return allowed_set_.count(lower) > 0;
    }

    /**
     * Filter a vector of detections in-place.
     */
    void filter(std::vector<Detection>& detections) const {
        detections.erase(
            std::remove_if(detections.begin(), detections.end(),
                [this](const Detection& d) { return !isAllowed(d.label); }),
            detections.end()
        );
    }

    /**
     * Map a class label to a feature code for event generation.
     * Returns multiple feature codes since one detection can trigger multiple modules.
     */
    std::string toFeatureCode(const std::string& label) const {
        std::string lower = label;
        std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
        
        // Primary mapping for basic detection
        if (lower == "person") return "PERSON";
        if (lower == "car" || lower == "truck" || lower == "bus" ||
            lower == "motorcycle" || lower == "bicycle" || lower == "train" || lower == "airplane") {
            return "VEHICLE";
        }
        // Animals
        if (lower == "bird" || lower == "cat" || lower == "dog" || lower == "horse" ||
            lower == "sheep" || lower == "cow" || lower == "elephant" || lower == "bear" ||
            lower == "zebra" || lower == "giraffe") {
            return "ANIMAL";
        }
        // Potential weapons/suspicious items for criminal activity
        if (lower == "knife" || lower == "scissors") {
            return "WEAPON";
        }
        // Fire-related (using fire hydrant as proxy since COCO doesn't have fire)
        if (lower == "fire hydrant") {
            return "FIRE_MARKER";
        }
        return "OTHER";
    }

    void setAllowedClasses(const std::vector<std::string>& classes) {
        allowed_classes_ = classes;
        buildLabelSet();
    }

private:
    void buildLabelSet() {
        allowed_set_.clear();
        for (const auto& c : allowed_classes_) {
            std::string lower = c;
            std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
            allowed_set_.insert(lower);
        }
    }

    std::vector<std::string> allowed_classes_;
    std::unordered_set<std::string> allowed_set_;
};

} // namespace ai
} // namespace vms
