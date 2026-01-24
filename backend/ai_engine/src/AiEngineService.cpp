#include "AiEngineService.h"
#include "Logger.h"

#include <chrono>
#include <sstream>
#include <iomanip>
#include <algorithm>

#ifdef ENABLE_INFERENCE
#include <fstream>
#endif

namespace vms {
namespace ai {

AiEngineService::AiEngineService(const Config& config) : config_(config) {
#ifdef ENABLE_INFERENCE
    // Load ONNX model
    OnnxConfig onnx_config;
    onnx_config.model_path = config_.model_path;
    onnx_config.model_type = config_.model_type;
    onnx_config.num_threads = config_.inference_threads;
    onnx_config.confidence_threshold = config_.default_min_confidence;
    onnx_config.max_detections = config_.default_max_detections;
    
    inference_ = std::make_shared<OnnxInference>(onnx_config);
    
    if (inference_->isLoaded()) {
        LOG_INFO("AiEngineService initialized with ONNX inference (model={})", config_.model_path);
    } else {
        LOG_WARN("AiEngineService: ONNX model failed to load, falling back to stub mode");
    }
#else
    LOG_INFO("AiEngineService initialized (stub mode, no inference)");
#endif
}

AiEngineService::~AiEngineService() {
    stop();
}

void AiEngineService::start() {
    if (running_) return;
    running_ = true;
    
#ifdef ENABLE_INFERENCE
    if (inference_ && inference_->isLoaded()) {
        monitor_thread_ = std::thread(&AiEngineService::monitorLoop, this);
        LOG_INFO("Inference engine ready, pipelines will start on RegisterStream");
    } else if (config_.stub_enabled) {
        LOG_INFO("Stub mode enabled (inference not available)");
    }
#else
    if (config_.stub_enabled) {
        generator_thread_ = std::thread(&AiEngineService::event_generator_loop, this);
        LOG_INFO("Stub event generator started (interval={}ms)", config_.stub_event_interval_ms);
    }
#endif
}

void AiEngineService::stop() {
    if (!running_) return;
    running_ = false;
    
#ifdef ENABLE_INFERENCE
    // Stop all pipelines
    std::lock_guard<std::mutex> lock(pipelines_mutex_);
    for (auto& [camera_id, pipeline] : pipelines_) {
        if (pipeline) {
            pipeline->stop();
        }
    }
    pipelines_.clear();
    
    if (monitor_thread_.joinable()) {
        monitor_thread_.join();
    }
    LOG_INFO("All inference pipelines stopped");
#else
    cv_.notify_all();
    if (generator_thread_.joinable()) {
        generator_thread_.join();
    }
    LOG_INFO("Stub event generator stopped");
#endif
}

int64_t AiEngineService::now_ms() const {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();
}

std::string AiEngineService::generate_uuid() const {
    static thread_local std::mt19937 gen(std::random_device{}());
    static thread_local std::uniform_int_distribution<> hex_dist(0, 15);
    
    std::ostringstream ss;
    for (int i = 0; i < 32; ++i) {
        if (i == 8 || i == 12 || i == 16 || i == 20) ss << '-';
        ss << std::hex << hex_dist(gen);
    }
    return ss.str();
}

std::string AiEngineService::feature_to_event_type(const std::string& feature_code) const {
    // Standard features (match catalog exactly)
    if (feature_code == "MOTION") return "MOTION";
    if (feature_code == "INTRUSION") return "INTRUSION";
    if (feature_code == "LINE_CROSSING") return "LINE_CROSSING";
    if (feature_code == "PEOPLE_COUNTING") return "PEOPLE_COUNTING";
    if (feature_code == "PERSON") return "PERSON_DETECTED";
    
    // Premium features (match catalog exactly)
    if (feature_code == "ANPR") return "ANPR";
    if (feature_code == "FACE_RECOGNITION") return "FACE_RECOGNITION";
    if (feature_code == "OBJECT_LEFT") return "OBJECT_LEFT";
    if (feature_code == "CROWD_DETECTION") return "CROWD_DETECTION";
    if (feature_code == "FIRE_SMOKE") return "FIRE_SMOKE";
    if (feature_code == "HEAT_MAP") return "HEAT_MAP";
    if (feature_code == "VEHICLE") return "VEHICLE_DETECTED";
    
    // Legacy mappings for backward compatibility
    if (feature_code == "FACE") return "FACE_RECOGNITION";
    if (feature_code == "LPR") return "ANPR";
    
    // Default: use feature_code as event_type
    return feature_code;
}


void AiEngineService::broadcast_event(const AiEvent& event) {
    std::lock_guard<std::mutex> lock(subscribers_mutex_);

    // Remove inactive subscribers
    subscribers_.erase(
        std::remove_if(subscribers_.begin(), subscribers_.end(),
            [](Subscriber* s) { return !s->active.load(); }),
        subscribers_.end()
    );

    for (auto* sub : subscribers_) {
        // Filter by camera_ids if specified
        if (!sub->camera_filter.empty() && 
            sub->camera_filter.find(event.camera_id()) == sub->camera_filter.end()) {
            continue;
        }

        std::lock_guard<std::mutex> write_lock(sub->write_mutex);
        if (sub->active.load()) {
            if (!sub->writer->Write(event)) {
                sub->active = false;
                LOG_DEBUG("Subscriber disconnected (write failed)");
            }
        }
    }

    total_events_emitted_++;
    logStats();
}

void AiEngineService::broadcast_events(const std::vector<AiEvent>& events) {
    for (const auto& event : events) {
        broadcast_event(event);
    }
}

void AiEngineService::logStats() {
    int64_t now = now_ms();
    if (now - last_stats_log_time_ > 5000) { // Every 5 seconds
#ifdef ENABLE_INFERENCE
        std::lock_guard<std::mutex> lock(pipelines_mutex_);
        LOG_INFO("Stats: {} events total, {} active pipelines, {} subscribers", 
                 total_events_emitted_.load(), pipelines_.size(), subscribers_.size());
        
        for (const auto& [camera_id, pipeline] : pipelines_) {
            if (pipeline) {
                auto stats = pipeline->getStats();
                LOG_INFO("  Camera {}: decode_fps={:.1f}, infer_fps={:.1f}, infer_ms={:.1f}, events={}", 
                         camera_id, stats.decode_fps, stats.infer_fps, stats.avg_infer_ms, stats.events_emitted);
            }
        }
#else
        LOG_INFO("Stats: {} events total, {} subscribers", 
                 total_events_emitted_.load(), subscribers_.size());
#endif
        last_stats_log_time_ = now;
    }
}

#ifdef ENABLE_INFERENCE

FeatureConfig AiEngineService::parseConfigJson(const std::string& json, const FeatureConfig& defaults) const {
    FeatureConfig cfg = defaults;
    
    // Simple JSON parsing (avoiding external dependency)
    // Format: {"sample_fps":5,"min_confidence":0.6,...}
    if (json.empty() || json == "{}") return cfg;
    
    auto findInt = [&json](const std::string& key) -> std::pair<bool, int> {
        std::string pattern = "\"" + key + "\":";
        size_t pos = json.find(pattern);
        if (pos == std::string::npos) return {false, 0};
        pos += pattern.length();
        while (pos < json.size() && !std::isdigit(json[pos]) && json[pos] != '-') pos++;
        if (pos >= json.size()) return {false, 0};
        return {true, std::stoi(json.substr(pos))};
    };
    
    auto findFloat = [&json](const std::string& key) -> std::pair<bool, float> {
        std::string pattern = "\"" + key + "\":";
        size_t pos = json.find(pattern);
        if (pos == std::string::npos) return {false, 0.0f};
        pos += pattern.length();
        while (pos < json.size() && !std::isdigit(json[pos]) && json[pos] != '-' && json[pos] != '.') pos++;
        if (pos >= json.size()) return {false, 0.0f};
        return {true, std::stof(json.substr(pos))};
    };
    
    auto findString = [&json](const std::string& key) -> std::pair<bool, std::string> {
        std::string pattern = "\"" + key + "\":\"";
        size_t pos = json.find(pattern);
        if (pos == std::string::npos) return {false, ""};
        pos += pattern.length();
        size_t end = json.find('"', pos);
        if (end == std::string::npos) return {false, ""};
        return {true, json.substr(pos, end - pos)};
    };
    
    if (auto [found, val] = findInt("sample_fps"); found) cfg.sample_fps = val;
    if (auto [found, val] = findFloat("min_confidence"); found) cfg.min_confidence = val;
    if (auto [found, val] = findInt("min_event_interval_ms"); found) cfg.min_event_interval_ms = val;
    if (auto [found, val] = findInt("max_detections"); found) cfg.max_detections = val;
    if (auto [found, val] = findString("rtsp_transport"); found) cfg.rtsp_transport = val;
    if (auto [found, val] = findString("line_coords"); found) cfg.line_coords = val;
    
    return cfg;
}

void AiEngineService::startPipeline(const std::string& camera_id) {
    std::lock_guard<std::mutex> lock(pipelines_mutex_);
    
    // Check if already running
    if (pipelines_.find(camera_id) != pipelines_.end()) {
        LOG_DEBUG("Pipeline already running for camera {}", camera_id);
        return;
    }
    
    // Get stream info
    StreamInfo stream_info;
    FeatureConfig feature_config;
    {
        std::shared_lock<std::shared_mutex> state_lock(state_mutex_);
        auto stream_it = streams_.find(camera_id);
        if (stream_it == streams_.end()) {
            LOG_WARN("Cannot start pipeline: camera {} not registered", camera_id);
            return;
        }
        stream_info = stream_it->second;
        
        // Get first enabled feature config
        auto cfg_it = configs_.find(camera_id);
        if (cfg_it == configs_.end()) {
            LOG_WARN("Cannot start pipeline: no config for camera {}", camera_id);
            return;
        }
        
        bool has_enabled = false;
        for (const auto& [fc, cfg] : cfg_it->second) {
            if (cfg.enabled) {
                feature_config = cfg;
                has_enabled = true;
                break;
            }
        }
        
        if (!has_enabled) {
            LOG_WARN("Cannot start pipeline: No enabled features configuration found for camera {}", camera_id);
            return;
        }
    }
    
    // Create pipeline config
    VmsPipelineConfig pipeline_config;
    pipeline_config.camera_id = camera_id;
    pipeline_config.rtsp_url = stream_info.rtsp_url;
    pipeline_config.role = stream_info.role;
    pipeline_config.feature_code = feature_config.feature_code;
    pipeline_config.sample_fps = feature_config.sample_fps;
    pipeline_config.min_confidence = feature_config.min_confidence;
    pipeline_config.min_event_interval_ms = feature_config.min_event_interval_ms;
    pipeline_config.max_detections = feature_config.max_detections;
    pipeline_config.rtsp_transport = feature_config.rtsp_transport;
    pipeline_config.line_coords = feature_config.line_coords;
    
    // Create and start pipeline
    auto pipeline = std::make_unique<InferencePipeline>(pipeline_config, inference_);
    pipeline->start([this](const AiEvent& event) {
        onInferenceEvent(event);
    });
    
    pipelines_[camera_id] = std::move(pipeline);
    LOG_INFO("Started inference pipeline for camera {}", camera_id);
}

void AiEngineService::stopPipeline(const std::string& camera_id) {
    std::lock_guard<std::mutex> lock(pipelines_mutex_);
    
    auto it = pipelines_.find(camera_id);
    if (it != pipelines_.end()) {
        it->second->stop();
        pipelines_.erase(it);
        LOG_INFO("Stopped inference pipeline for camera {}", camera_id);
    }
}

void AiEngineService::updatePipeline(const std::string& camera_id) {
    // Check if any feature is enabled
    bool has_enabled = false;
    size_t feature_count = 0;
    {
        std::shared_lock<std::shared_mutex> lock(state_mutex_);
        auto cfg_it = configs_.find(camera_id);
        if (cfg_it != configs_.end()) {
            feature_count = cfg_it->second.size();
            for (const auto& [fc, cfg] : cfg_it->second) {
                if (cfg.enabled) {
                    has_enabled = true;
                    break;
                }
            }
        }
    }
    
    LOG_INFO("Updating pipeline for camera {}. Enabled={} (Features found: {})", 
             camera_id, has_enabled, feature_count);

    if (has_enabled) {
        // Restart pipeline with new config
        stopPipeline(camera_id);
        startPipeline(camera_id);
    } else {
        LOG_INFO("Stopping pipeline for camera {} (No enabled features)", camera_id);
        stopPipeline(camera_id);
    }
}

void AiEngineService::onInferenceEvent(const AiEvent& event) {
    broadcast_event(event);
}

#else // STUB MODE

std::string AiEngineService::build_metadata_json(const std::string& feature_code, StreamRole role) const {
    static thread_local std::mt19937 gen(std::random_device{}());
    static thread_local std::uniform_real_distribution<> pos_dist(0.1, 0.5);
    static thread_local std::uniform_real_distribution<> size_dist(0.1, 0.3);

    std::ostringstream ss;
    ss << std::fixed << std::setprecision(2);
    ss << "{";
    ss << "\"feature_code\":\"" << feature_code << "\",";
    ss << "\"source\":\"stub\",";
    ss << "\"model_id\":\"stub-v1\",";
    ss << "\"role\":\"" << (role == StreamRole::SUB ? "SUB" : "MAIN") << "\",";
    ss << "\"bbox\":{";
    ss << "\"x\":" << pos_dist(gen) << ",";
    ss << "\"y\":" << pos_dist(gen) << ",";
    ss << "\"w\":" << size_dist(gen) << ",";
    ss << "\"h\":" << size_dist(gen);
    ss << "}}";
    return ss.str();
}

std::vector<AiEvent> AiEngineService::generate_events() {
    std::vector<AiEvent> events;
    std::shared_lock<std::shared_mutex> lock(state_mutex_);

    int count = 0;
    for (const auto& [camera_id, stream_info] : streams_) {
        auto cfg_it = configs_.find(camera_id);
        if (cfg_it == configs_.end()) continue;

        for (const auto& [feature_code, feature_cfg] : cfg_it->second) {
            if (!feature_cfg.enabled) continue;
            if (count >= config_.stub_max_events_per_tick) break;

            AiEvent event;
            event.set_event_id(generate_uuid());
            event.set_camera_id(camera_id);
            event.set_event_type(feature_to_event_type(feature_code));
            
            static thread_local std::mt19937 gen(std::random_device{}());
            static thread_local std::uniform_real_distribution<> conf_dist(0.6, 0.95);
            event.set_confidence(static_cast<float>(conf_dist(gen)));
            
            event.set_event_time_ms(now_ms());
            event.set_metadata_json(build_metadata_json(feature_code, stream_info.role));
            event.set_model_id("stub-v1");
            event.set_frame_time_ms(now_ms());
            event.set_role(stream_info.role);

            events.push_back(std::move(event));
            count++;
        }
    }

    return events;
}

void AiEngineService::event_generator_loop() {
    LOG_INFO("Event generator thread started");

    while (running_) {
        auto events = generate_events();
        if (!events.empty()) {
            broadcast_events(events);
        }

        std::shared_lock<std::shared_mutex> lock(state_mutex_);
        cv_.wait_for(lock, std::chrono::milliseconds(config_.stub_event_interval_ms),
                     [this]() { return !running_.load(); });
    }

    LOG_INFO("Event generator thread exiting");
}

#endif // ENABLE_INFERENCE

// ============================================================================
// gRPC Method Implementations
// ============================================================================

grpc::Status AiEngineService::RegisterStream(grpc::ServerContext* context, 
                                           const RegisterStreamRequest* request, 
                                           RegisterStreamResponse* response) {
    std::unique_lock<std::shared_mutex> lock(state_mutex_);
    
    if (request->camera_id().empty()) {
        response->set_ok(false);
        response->set_message("camera_id is required");
        return grpc::Status::OK;
    }

    if (request->rtsp_url().empty()) {
        response->set_ok(false);
        response->set_message("rtsp_url is required");
        return grpc::Status::OK;
    }

    LOG_INFO("RegisterStream: camera_id={}, role={}", request->camera_id(), static_cast<int>(request->role()));

    StreamInfo info;
    info.rtsp_url = request->rtsp_url();
    info.role = request->role();
    info.registered_at_ms = now_ms();
    
    streams_[request->camera_id()] = info;

    response->set_ok(true);
    response->set_message("Stream registered");
    return grpc::Status::OK;
}

grpc::Status AiEngineService::Configure(grpc::ServerContext* context, 
                                      const ConfigureRequest* request, 
                                      ConfigureResponse* response) {
    if (request->camera_id().empty()) {
        response->set_ok(false);
        response->set_message("camera_id is required");
        return grpc::Status::OK;
    }

    if (request->feature_code().empty()) {
        response->set_ok(false);
        response->set_message("feature_code is required");
        return grpc::Status::OK;
    }

    LOG_INFO("Configure: camera_id={}, feature={}, enabled={}", 
             request->camera_id(), request->feature_code(), request->enabled());

    bool config_changed = false;

    {
        std::unique_lock<std::shared_mutex> lock(state_mutex_);
        
        // Check if config exists and is identical
        bool exists = false;
        if (configs_.count(request->camera_id()) && 
            configs_[request->camera_id()].count(request->feature_code())) {
            const auto& current = configs_[request->camera_id()][request->feature_code()];
            if (current.enabled == request->enabled() && 
                current.config_json == request->config_json()) {
                // strict string comparison for now, assuming client sends consistent JSON
                exists = true;
            }
        }

        if (!exists) {
            FeatureConfig config;
            config.enabled = request->enabled();
            config.config_json = request->config_json();
            config.feature_code = request->feature_code();
            config.updated_at_ms = now_ms();
            
            // Set defaults
            config.sample_fps = config_.default_sample_fps;
            config.min_confidence = config_.default_min_confidence;
            config.min_event_interval_ms = config_.default_min_event_interval_ms;
            config.max_detections = config_.default_max_detections;

    #ifdef ENABLE_INFERENCE
            config = parseConfigJson(request->config_json(), config);
    #endif

            configs_[request->camera_id()][request->feature_code()] = config;
            config_changed = true;
        }
    }

#ifdef ENABLE_INFERENCE
    // Update pipeline only if config changed
    if (config_changed && running_ && inference_ && inference_->isLoaded()) {
        updatePipeline(request->camera_id());
    } else if (!config_changed) {
        LOG_INFO("Configuration unchanged for camera {}, skipping pipeline restart", request->camera_id());
    }
#endif

    response->set_ok(true);
    response->set_message("Feature configured");
    return grpc::Status::OK;
}

grpc::Status AiEngineService::StreamEvents(grpc::ServerContext* context, 
                                         const StreamEventsRequest* request, 
                                         grpc::ServerWriter<AiEvent>* writer) {
    // Build camera filter set
    std::set<std::string> camera_filter;
    for (int i = 0; i < request->camera_ids_size(); ++i) {
        camera_filter.insert(request->camera_ids(i));
    }

    LOG_INFO("StreamEvents: client connected (filter_count={}, start_time_ms={})", 
             camera_filter.size(), request->start_time_ms());

    // Create subscriber
    Subscriber sub;
    sub.writer = writer;
    sub.camera_filter = camera_filter;
    sub.active = true;

    // Register subscriber
    {
        std::lock_guard<std::mutex> lock(subscribers_mutex_);
        subscribers_.push_back(&sub);
    }

    // Wait for disconnect
    while (!context->IsCancelled() && sub.active.load() && running_) {
        std::this_thread::sleep_for(std::chrono::milliseconds(500));
    }

    // Mark inactive
    sub.active = false;

    LOG_INFO("StreamEvents: client disconnected");
    return grpc::Status::OK;
}

// ... existing methods

void AiEngineService::monitorLoop() {
    LOG_INFO("Performance monitor thread started");
    while (running_) {
        logStats(); // Logs based on elapsed time inside
        std::this_thread::sleep_for(std::chrono::milliseconds(100)); // Check often
    }
    LOG_INFO("Performance monitor thread exiting");
}

} // namespace ai
} // namespace vms
