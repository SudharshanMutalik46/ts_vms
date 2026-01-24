#include "InferencePipeline.h"
#include "Logger.h"

#include <sstream>
#include <cstdio>
#include <iomanip>
#include <random>
#include <cmath>
#include <cmath>
#include <unordered_set>
#include <tuple>

#include <vector>

namespace vms {
namespace ai {

InferencePipeline::InferencePipeline(const VmsPipelineConfig& config, 
                                     std::shared_ptr<OnnxInference> inference)
    : config_(config), inference_(std::move(inference)) {
    
    // Parse line_coords (x1,y1,x2,y2) if present
    // Parse line coordinates for Line Crossing (Phase 5.8)
    if (!config_.line_coords.empty()) {
        float x1, y1, x2, y2;
        if (sscanf(config_.line_coords.c_str(), "%f,%f,%f,%f", &x1, &y1, &x2, &y2) == 4) {
             CrossingLine line;
             line.id = "line1";
             line.x1 = x1;
             line.y1 = y1;
             line.x2 = x2;
             line.y2 = y2;
             line.bidirectional = true; 
             
             std::vector<CrossingLine> lines;
             lines.push_back(line);
             
             line_cross_monitor_.setLines(config_.camera_id, lines);
             LOG_INFO("Parsed Line Config: x1={:.3f}, y1={:.3f}, x2={:.3f}, y2={:.3f}", x1, y1, x2, y2);
        } else {
             LOG_WARN("Failed to parse line_coords: '{}'", config_.line_coords);
        }
    }
    // Parse ROI (Polygon) for Zone Monitor

    // Parse ROI (Polygon) for Zone Monitor
    // Only if line_coords is empty OR if we support both (here we assume line_coords = Line Crossing mode)
    if (config_.line_coords.empty() && !config_.roi_polygon.empty()) {
        // ... existing ROI parsing if any ...
    }

    // Configure ClassFilter based on feature_code
    if (config_.feature_code == "PERSON") {
        class_filter_.setAllowedClasses({
            "person" // Strict mode: Real person only. No proxies.
        });
    } else if (config_.feature_code == "VEHICLE") {
        class_filter_.setAllowedClasses({"car", "bus", "truck", "motorcycle", "bicycle"});
    } else if (config_.feature_code == "ANIMAL") {
        class_filter_.setAllowedClasses({"bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"});
    }
    // Else keep default (allows all)
}

InferencePipeline::~InferencePipeline() {
    stop();
}

void InferencePipeline::start(EventCallback callback) {
    if (running_) return;
    
    event_callback_ = std::move(callback);
    running_ = true;
    
    // Setup RTSP decoder
    RtspConfig rtsp_config;
    rtsp_config.rtsp_url = config_.rtsp_url;
    rtsp_config.camera_id = config_.camera_id;
    rtsp_config.transport = config_.rtsp_transport;
    
    decoder_ = std::make_unique<RtspDecoder>(rtsp_config);
    decoder_->start([this](const uint8_t* data, int w, int h, int64_t ts) {
        onFrame(data, w, h, ts);
    });

    // Start processing thread
    processing_thread_ = std::thread(&InferencePipeline::processingLoop, this);
    
    LOG_INFO("InferencePipeline started for camera {} ({}fps, conf>={})", 
             config_.camera_id, config_.sample_fps, config_.min_confidence);
}

void InferencePipeline::stop() {
    running_ = false;
    
    if (decoder_) {
        decoder_->stop();
        decoder_.reset();
    }
    
    if (processing_thread_.joinable()) {
        processing_thread_.join();
    }
    
    LOG_INFO("InferencePipeline stopped for camera {}", config_.camera_id);
}

void InferencePipeline::updateConfig(const VmsPipelineConfig& config) {
    std::lock_guard<std::mutex> lock(frame_mutex_);
    config_ = config;
    LOG_INFO("Pipeline config updated for camera {}: fps={}, conf={}",
             config_.camera_id, config_.sample_fps, config_.min_confidence);
}

void InferencePipeline::onFrame(const uint8_t* data, int width, int height, int64_t timestamp_ms) {
    std::lock_guard<std::mutex> lock(frame_mutex_);
    
    // Latest-frame-wins policy
    size_t frame_size = width * height * 3;  // BGR
    if (latest_frame_.size() != frame_size) {
        latest_frame_.resize(frame_size);
    }
    memcpy(latest_frame_.data(), data, frame_size);
    latest_width_ = width;
    latest_height_ = height;
    latest_timestamp_ = timestamp_ms;
    has_new_frame_ = true;
}

void InferencePipeline::processingLoop() {
    int target_interval_ms = 1000 / config_.sample_fps;
    
    while (running_) {
        auto loop_start = std::chrono::steady_clock::now();

        // One-time debug log for Mode
        static bool logged_mode = false;
        if (!logged_mode && has_new_frame_) {
             LOG_INFO("Pipeline Mode Check: Camera={}, LineCoords='{}', IsLineMode={}", 
                      config_.camera_id, config_.line_coords, !config_.line_coords.empty());
             logged_mode = true;
        }
        
        // Check if we have a new frame
        if (!has_new_frame_) {
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
            continue;
        }
        
        // Copy frame data under lock
        std::vector<uint8_t> frame_copy;
        int width, height;
        int64_t timestamp;
        {
            std::lock_guard<std::mutex> lock(frame_mutex_);
            if (!has_new_frame_) continue;
            
            frame_copy = latest_frame_;
            width = latest_width_;
            height = latest_height_;
            timestamp = latest_timestamp_;
            has_new_frame_ = false;
        }
        
        // Rate limit based on sample_fps
        auto now = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - last_infer_time_).count();
        if (elapsed < target_interval_ms) {
            frames_dropped_++;
            continue;
        }
        last_infer_time_ = now;
        
        // Run inference
        if (!inference_ || !inference_->isLoaded()) {
            continue;
        }
        
        int64_t now_ms = nowMs(); // Define now_ms for the scope
        
        auto result = inference_->run(frame_copy.data(), width, height, timestamp);
        frames_processed_++;
        
        // Update stats
        infer_count_++;
        total_infer_ms_ += result.infer_ms;
        avg_infer_ms_ = total_infer_ms_ / infer_count_;
        
        // DEBUG: Log raw detections from model
        if (!result.detections.empty()) {
            static int64_t last_raw_log = 0;
            // auto now_ms = ... (removed)
            if (now_ms - last_raw_log > 2000) {
                 // Log ALL objects to diagnose misclassification
                 std::string all_labels = "";
                 bool has_person = false;
                 for (const auto& det : result.detections) {
                     all_labels += det.label + "(" + std::to_string(static_cast<int>(det.confidence * 100)) + 
                          "%)[x=" + std::to_string(det.x) + ",y=" + std::to_string(det.y) + "] ";
                     if (det.label == "person") has_person = true;
                 }
                 LOG_INFO("[RAW DET] {} objects: {} | PersonFound={}", result.detections.size(), all_labels, has_person ? "YES" : "NO");
                 last_raw_log = now_ms;
            }
        }

        // Check if we have relevant detections
        // Phase 5.7.3: Use ClassFilter to filter detections
        std::vector<Detection> filtered_dets = result.detections;
        class_filter_.filter(filtered_dets);
        
        if (filtered_dets.empty()) continue;
        
        // Apply confidence filter
        filtered_dets.erase(
            std::remove_if(filtered_dets.begin(), filtered_dets.end(),
                [this](const Detection& d) { return d.confidence < config_.min_confidence; }),
            filtered_dets.end()
        );
        
        if (filtered_dets.empty()) continue;
        
        // --- STRICT FILTERING ---
        // Only allow actual "person" detections. 
        // We removed the "Smart Fix" (renaming backpack->person) because the 640x640 model 
        // is accurate enough to find the real person without false positives.
        
        // (Renaming and Secondary NMS blocks removed)
        
        // DEBUG TRACE
        static int64_t last_trace = 0;
        bool do_trace = (now_ms - last_trace > 2000);
        if (do_trace) {
            std::string labels;
            for(auto& d : filtered_dets) labels += d.label + " ";
            LOG_INFO("TRACE: Filtered Dets: {} (labels: {})", filtered_dets.size(), labels);
            last_trace = now_ms;
        }

        // Phase 5.7.4: ROI filtering and ZoneMonitor
        int64_t now_ms_inner = nowMs();
        
        // Get ROI (default to full frame if none configured)
        Polygon roi_polygon = Polygon::fullFrame();
        std::string zone_id = "default";
        if (!rois_.empty() && !rois_[0].polygon.isEmpty()) {
            roi_polygon = rois_[0].polygon;
            zone_id = rois_[0].id;
        }
        
        // Count detections per class inside ROI
        std::unordered_map<std::string, int> class_counts;
        std::unordered_map<std::string, std::vector<Detection>> class_detections;
        
        for (const auto& det : filtered_dets) {
            // Check if detection center is inside ROI
            if (roi_polygon.containsBboxCenter(det.x, det.y, det.w, det.h)) {
                std::string feature_code = class_filter_.toFeatureCode(det.label);
                class_counts[feature_code]++;
                class_detections[feature_code].push_back(det);
            }
        }
        
        if (do_trace) {
             LOG_INFO("TRACE: Class Counts: PERSON={}", class_counts["PERSON"]);
        }

        // Check if we are in Line Crossing Mode
        bool is_line_mode = !config_.line_coords.empty();

        // Update ZoneMonitor concurrently with Line Crossing Mode
        // This ensures we get continuous "PERSON_DETECTED" events for the bounding box UI
        // if (!is_line_mode) { <--- REMOVED CHECK to enable continuous detections
        if (true) {
             for (const auto& [feature_code, count] : class_counts) {

            auto zone_events = zone_monitor_.update(
                config_.camera_id, zone_id, feature_code, count, now_ms_inner
            );
            
            // Force continuous events for visualization
            if (zone_events.empty() && count > 0) {
                 ZoneEvent heartbeat;
                 heartbeat.type = ZoneEventType::NONE; // Will map to "detection"
                 heartbeat.zone_id = zone_id;
                 heartbeat.class_label = feature_code;
                 heartbeat.camera_id = config_.camera_id;
                 zone_events.push_back(heartbeat);
            }

            if (do_trace && !zone_events.empty()) {
                LOG_INFO("TRACE: ZoneEvents produced: {}", zone_events.size());
            }

            for (const auto& ze : zone_events) {
                // if (ze.type == ZoneEventType::NONE) continue; // Allow NONE for continuous detection
                
                // Build InferenceResult with detections
                InferenceResult filtered_result;
                filtered_result.frame_width = result.frame_width;
                filtered_result.frame_height = result.frame_height;
                filtered_result.frame_timestamp_ms = result.frame_timestamp_ms;
                filtered_result.infer_ms = result.infer_ms;
                filtered_result.detections = class_detections[feature_code];
                
                // Emit event
                std::string orig_feature = config_.feature_code;
                config_.feature_code = feature_code;
                
                // Rate Limiting (Phase 5.7.6)
                // Enforce global min_event_interval_ms
                bool allow_emit = true;
                auto now = std::chrono::steady_clock::now();
                auto elapsed_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
                    now - last_event_time_).count();
                
                if (elapsed_ms < config_.min_event_interval_ms) {
                    allow_emit = false;
                    if (do_trace) LOG_INFO("TRACE: Event throttled (elapsed={})", elapsed_ms);
                }
                
                if (allow_emit) {
                    // Map to existing event taxonomy (Phase 5.7.6)
                    // "person_intrusion", "vehicle_dwell", etc.
                    std::string event_type_final;
                    std::string prefix = feature_code; // e.g., "PERSON"
                    std::transform(prefix.begin(), prefix.end(), prefix.begin(), ::tolower);
                    
                    std::string suffix = "event";
                    switch (ze.type) {
                        case ZoneEventType::ENTRY: suffix = "intrusion"; break;
                        case ZoneEventType::DWELL: suffix = "dwell"; break;
                        case ZoneEventType::EXIT: suffix = "exit"; break;
                        default: suffix = "detection"; break;
                    }
                    
                    event_type_final = prefix + "_" + suffix;

                    AiEvent event = createEvent(filtered_result, event_type_final, zone_id);
                    // Legacy field override if needed, but createEvent handles it via logic or caller
                    // We passed event_type_final, so it will be used.
                    
                    if (event_callback_) {
                        event_callback_(event);
                        events_emitted_++;
                        last_event_time_ = now; // Update timestamp
                        LOG_INFO("TRACE: EVENT CALLBACK FIRED id={}", event.event_id());
                    }
                    
                    LOG_INFO("Event Emitted: {} (id={})", event_type_final, event.event_id());
                } else {
                    LOG_DEBUG("Event throttled: {} (elapsed={}ms < {}ms)", 
                              feature_code, elapsed_ms, config_.min_event_interval_ms);
                }
                
                config_.feature_code = orig_feature;
            }
        }

        
        }
        
        // Phase 5.8: Line Crossing Detection
        if (is_line_mode) {
             static int64_t last_line_log = 0;
             if (now_ms - last_line_log > 5000) {
                 LOG_INFO("LineMonitor Active: processing {} filtered objects", filtered_dets.size());
                 last_line_log = now_ms;
             }
        }


        
        // Also update ZoneMonitor with count=0 for classes not seen
        // to trigger EXIT after grace period
        std::vector<std::string> all_classes = {"PERSON", "VEHICLE"};
        for (const auto& cls : all_classes) {
            if (class_counts.find(cls) == class_counts.end()) {
                auto zone_events = zone_monitor_.update(
                    config_.camera_id, zone_id, cls, 0, now_ms
                );
                for (const auto& ze : zone_events) {
                    if (ze.type == ZoneEventType::EXIT) {
                        LOG_INFO("ZoneEvent: EXIT {} from zone {} camera {}", 
                                 cls, zone_id, config_.camera_id);
                    }
                }
            }
        }
        
        // Phase 5.8: Line Crossing Detection
        // Build detection tuples for line crossing monitor
        std::vector<std::tuple<std::string, float, float>> detection_tuples;
        for (const auto& det : filtered_dets) {
            std::string feature_code = class_filter_.toFeatureCode(det.label);
            float center_x = det.x + det.w / 2.0f;
            float center_y = det.y + det.h / 2.0f;
            detection_tuples.emplace_back(feature_code, center_x, center_y);
        }
        
        // Check for line crossings
        auto line_events = line_cross_monitor_.update(config_.camera_id, detection_tuples, now_ms);
        for (const auto& le : line_events) {
            if (le.direction == CrossingDirection::NONE) continue;
            
            // Build event type based on direction
            std::string direction_str = (le.direction == CrossingDirection::A_TO_B) ? "a_to_b" : "b_to_a";
            std::string class_lower = le.class_label;
            std::transform(class_lower.begin(), class_lower.end(), class_lower.begin(), ::tolower);
            std::string event_type = class_lower + "_line_crossing_" + direction_str;
            
            // Create a minimal InferenceResult for the event
            InferenceResult line_result;
            line_result.frame_width = result.frame_width;
            line_result.frame_height = result.frame_height;
            line_result.frame_timestamp_ms = result.frame_timestamp_ms;
            line_result.infer_ms = result.infer_ms;
            line_result.detections = filtered_dets; // Fix: Include detections so frontend can render bounding boxes
            
            AiEvent event = createEvent(line_result, event_type, std::string(le.line_id));
            
            // Inject track_id into metadata
            std::string meta = event.metadata_json();
            if (!meta.empty() && meta.back() == '}') {
                meta.pop_back();
                meta += ",\"track_id\":" + std::to_string(le.track_id) + "}";
                event.set_metadata_json(meta);
            }
            
            if (event_callback_) {
                event_callback_(event);
                events_emitted_++;
                last_event_time_ = std::chrono::steady_clock::now();
            }
            
            LOG_INFO("Line Crossing Event: {} line={} direction={}", 
                     le.class_label, le.line_id, direction_str);
        }
    }
}

std::string InferencePipeline::generateUuid() const {
    static thread_local std::mt19937 gen(std::random_device{}());
    static thread_local std::uniform_int_distribution<> hex_dist(0, 15);
    
    std::ostringstream ss;
    for (int i = 0; i < 32; ++i) {
        if (i == 8 || i == 12 || i == 16 || i == 20) ss << '-';
        ss << std::hex << hex_dist(gen);
    }
    return ss.str();
}

int64_t InferencePipeline::nowMs() const {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();
}

std::string InferencePipeline::buildMetadataJson(const InferenceResult& result, const std::string& zone_id) const {
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(2);
    
    ss << "{";
    ss << "\"source\":\"inference\",";
    ss << "\"feature_code\":\"" << config_.feature_code << "\",";
    if (!zone_id.empty()) {
        ss << "\"zone_id\":\"" << zone_id << "\",";
    }
    ss << "\"model_id\":\"yolov8n\",";
    ss << "\"role\":\"" << (config_.role == StreamRole::SUB ? "SUB" : "MAIN") << "\",";
    
    // Detections array (capped)
    ss << "\"detections\":[";
    int count = 0;
    for (const auto& det : result.detections) {
        if (count >= config_.max_detections) {
            ss << "{\"truncated\":true}";
            break;
        }
        if (count > 0) ss << ",";
        ss << "{";
        ss << "\"label\":\"" << det.label << "\",";
        ss << "\"conf\":" << det.confidence << ",";
        ss << "\"bbox\":{";
        ss << "\"x\":" << det.x << ",";
        ss << "\"y\":" << det.y << ",";
        ss << "\"w\":" << det.w << ",";
        ss << "\"h\":" << det.h;
        ss << "}}";
        count++;
    }
    ss << "],";
    
    // Frame info
    ss << "\"frame\":{";
    ss << "\"w\":" << result.frame_width << ",";
    ss << "\"h\":" << result.frame_height << ",";
    ss << "\"ts_ms\":" << result.frame_timestamp_ms;
    ss << "},";
    
    // Performance stats
    ss << "\"perf\":{";
    ss << "\"decode_ms\":" << (decoder_ ? decoder_->getAvgDecodeMs() : 0) << ",";
    ss << "\"infer_ms\":" << result.infer_ms << ",";
    // Calculate instantaneous FPS (1000ms / infer_time). Cap at 999 to avoid overflow/messy UI.
    int real_fps = (result.infer_ms > 0) ? (int)(1000.0 / result.infer_ms) : 0;
    ss << "\"fps\":" << real_fps;
    ss << "}";
    
    ss << "}";
    return ss.str();
}

AiEvent InferencePipeline::createEvent(const InferenceResult& result, const std::string& event_type, const std::string& zone_id) {
    AiEvent event;
    event.set_event_id(generateUuid());
    event.set_camera_id(config_.camera_id);
    
    // Set event type
    if (!event_type.empty()) {
        event.set_event_type(event_type);
    } else {
        // Fallback defaults
        if (config_.feature_code == "PERSON") event.set_event_type("PERSON_DETECTED");
        else if (config_.feature_code == "VEHICLE") event.set_event_type("VEHICLE_DETECTED");
        else event.set_event_type(config_.feature_code);
    }
    
    // Calculate aggregate confidence
    float max_conf = 0.0f;
    for (const auto& d : result.detections) {
        if (d.confidence > max_conf) max_conf = d.confidence;
    }
    event.set_confidence(max_conf);
    
    event.set_event_time_ms(nowMs());
    event.set_metadata_json(buildMetadataJson(result, zone_id));
    event.set_model_id("yolov8n");
    event.set_frame_time_ms(result.frame_timestamp_ms);
    event.set_role(config_.role);
    
    return event;
}

InferencePipeline::Stats InferencePipeline::getStats() const {
    Stats stats;
    stats.decode_fps = decoder_ ? decoder_->getDecodeFps() : 0;
    stats.infer_fps = (infer_count_ > 0 && total_infer_ms_ > 0) 
                      ? (1000.0 * infer_count_ / total_infer_ms_) : 0;
    stats.avg_infer_ms = avg_infer_ms_;
    stats.reconnect_count = decoder_ ? decoder_->getReconnectCount() : 0;
    stats.events_emitted = events_emitted_;
    stats.frames_processed = frames_processed_;
    stats.frames_dropped = frames_dropped_;
    return stats;
}

} // namespace ai
} // namespace vms
