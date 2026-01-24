#pragma once

#include <vector>
#include <cmath>
#include <algorithm>

namespace vms {
namespace ai {

/**
 * Point - 2D point with normalized coordinates [0,1].
 */
struct Point {
    float x = 0.0f;
    float y = 0.0f;
    
    Point() = default;
    Point(float x_, float y_) : x(x_), y(y_) {}
};

/**
 * Polygon - Arbitrary polygon for ROI definition.
 * Supports convex and concave polygons via Ray Casting algorithm.
 */
class Polygon {
public:
    Polygon() = default;
    explicit Polygon(const std::vector<Point>& vertices) : vertices_(vertices) {}
    
    /**
     * Check if a point is inside the polygon using Ray Casting.
     * O(N) complexity where N is number of vertices.
     */
    bool contains(const Point& p) const {
        if (vertices_.size() < 3) return false;
        
        int count = 0;
        size_t n = vertices_.size();
        
        for (size_t i = 0; i < n; i++) {
            const Point& v1 = vertices_[i];
            const Point& v2 = vertices_[(i + 1) % n];
            
            // Check if ray from p going right intersects edge v1-v2
            if ((v1.y > p.y) != (v2.y > p.y)) {
                // Calculate x-coordinate of intersection
                float x_intersect = (v2.x - v1.x) * (p.y - v1.y) / (v2.y - v1.y) + v1.x;
                if (p.x < x_intersect) {
                    count++;
                }
            }
        }
        
        return (count % 2) == 1;  // Odd = inside
    }
    
    /**
     * Check if bounding box center is inside polygon.
     */
    bool containsBboxCenter(float x, float y, float w, float h) const {
        Point center(x + w / 2.0f, y + h / 2.0f);
        return contains(center);
    }
    
    /**
     * Check if bounding box has sufficient overlap with polygon.
     * Uses approximation: checks if center is inside.
     * For production, could implement proper polygon-bbox intersection.
     */
    bool containsBbox(float x, float y, float w, float h, float min_overlap = 0.0f) const {
        // Simple approximation: center point check
        // For min_overlap > 0, we'd need full polygon-box intersection
        (void)min_overlap;  // Reserved for future use
        return containsBboxCenter(x, y, w, h);
    }
    
    void setVertices(const std::vector<Point>& vertices) { vertices_ = vertices; }
    const std::vector<Point>& getVertices() const { return vertices_; }
    bool isEmpty() const { return vertices_.empty(); }
    
    /**
     * Create a full-frame ROI (covers entire normalized space).
     */
    static Polygon fullFrame() {
        return Polygon({
            {0.0f, 0.0f},
            {1.0f, 0.0f},
            {1.0f, 1.0f},
            {0.0f, 1.0f}
        });
    }

private:
    std::vector<Point> vertices_;
};

/**
 * ROI - A named Region of Interest with a polygon.
 */
struct ROI {
    std::string id;
    std::string name;
    Polygon polygon;
    bool enabled = true;
};

} // namespace ai
} // namespace vms
