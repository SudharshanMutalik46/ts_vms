#pragma once

#include "ai_engine.grpc.pb.h"
#include "Config.h"

#ifdef ENABLE_INFERENCE
#include "InferencePipeline.h"
#include "OnnxInference.h"
#endif

#include <mutex>
#include <shared_mutex>
#include <map>
#include <set>
#include <string>
#include <vector>
#include <thread>
#include <atomic>
#include <condition_variable>
#include <random>
#include <functional>
#include <memory>

namespace vms {
namespace ai {

// Structs to hold runtime state
struct StreamInfo {
    std::string rtsp_url;
    StreamRole role;
    int64_t registered_at_ms;
};

struct FeatureConfig {
    bool enabled;
    std::string config_json;
    std::string feature_code;
    int64_t updated_at_ms;

    // Parsed config
    int sample_fps = 5;
    float min_confidence = 0.6f;
    int min_event_interval_ms = 3000;
    int max_detections = 20;
    std::string rtsp_transport = "tcp";
    std::string line_coords = "";
};

// Subscriber handle for StreamEvents clients
struct Subscriber {
    grpc::ServerWriter<AiEvent>* writer;
    std::set<std::string> camera_filter; // empty = all cameras
    std::atomic<bool> active{true};
    std::mutex write_mutex;
};

class AiEngineService final : public AiEngine::Service {
public:
    explicit AiEngineService(const Config& config);
    ~AiEngineService() override;

    // gRPC Implementations
    grpc::Status RegisterStream(grpc::ServerContext* context,
                               const RegisterStreamRequest* request,
                               RegisterStreamResponse* response) override;

    grpc::Status Configure(grpc::ServerContext* context,
                           const ConfigureRequest* request,
                           ConfigureResponse* response) override;

    grpc::Status StreamEvents(grpc::ServerContext* context,
                              const StreamEventsRequest* request,
                              grpc::ServerWriter<AiEvent>* writer) override;

    // Lifecycle
    void start();
    void stop();

private:
    const Config& config_;

    // Thread-safe state (shared_mutex for read-heavy workloads)
    mutable std::shared_mutex state_mutex_;
    std::map<std::string, StreamInfo> streams_; // camera_id -> info
    std::map<std::string, std::map<std::string, FeatureConfig>> configs_; // camera_id -> (feature_code -> config)

    // Subscriber management
    std::mutex subscribers_mutex_;
    std::vector<Subscriber*> subscribers_;

#ifdef ENABLE_INFERENCE
    // Inference components
    std::shared_ptr<OnnxInference> inference_;
    std::map<std::string, std::unique_ptr<InferencePipeline>> pipelines_; // camera_id -> pipeline
    std::mutex pipelines_mutex_;

    // Performance monitoring thread
    std::thread monitor_thread_;
    void monitorLoop();

    void startPipeline(const std::string& camera_id);
    void stopPipeline(const std::string& camera_id);
    void updatePipeline(const std::string& camera_id);
    void onInferenceEvent(const AiEvent& event);
    FeatureConfig parseConfigJson(const std::string& json, const FeatureConfig& defaults) const;
#else
    // Stub event generator thread (fallback)
    std::thread generator_thread_;
    std::condition_variable_any cv_;

    std::vector<AiEvent> generate_events();
    void event_generator_loop();
    std::string build_metadata_json(const std::string& feature_code, StreamRole role) const;
#endif

    // Common helpers / state
    std::atomic<bool> running_{false};   // ✅ single source of truth for start/stop + stub loop
    int64_t now_ms() const;
    std::string generate_uuid() const;
    std::string feature_to_event_type(const std::string& feature_code) const;
    void broadcast_events(const std::vector<AiEvent>& events);
    void broadcast_event(const AiEvent& event);

    // Stats
    std::atomic<int64_t> total_events_emitted_{0};
    std::atomic<int64_t> last_stats_log_time_{0};
    void logStats();
};

} // namespace ai
} // namespace vms
