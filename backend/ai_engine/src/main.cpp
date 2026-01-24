#include "Config.h"
#include "Logger.h"
#include "AiEngineService.h"

#include <grpcpp/grpcpp.h>
#include <grpcpp/health_check_service_interface.h>
#include <grpcpp/ext/proto_server_reflection_plugin.h>

#include <csignal>
#include <iostream>
#include <memory>
#include <thread>
#include <atomic>

namespace {

std::unique_ptr<grpc::Server> g_server;
vms::ai::AiEngineService* g_service = nullptr;
std::atomic<bool> g_shutdown_requested{false};

void signalHandler(int signal) {
    LOG_INFO("Received signal {}, shutting down...", signal);
    g_shutdown_requested = true;
    if (g_service) {
        g_service->stop();
    }
    if (g_server) {
        g_server->Shutdown();
    }
}

} // anonymous namespace

int main(int argc, char* argv[]) {
    using namespace vms::ai;

    // 1. Load Config
    auto config = Config::load();
    
    // 2. Init Logger
    vms::Logger::init(config.log_level);

    LOG_INFO("==============================================");
#ifdef ENABLE_INFERENCE
    LOG_INFO("VMS AI Engine v1.0.0 (Phase 5.5 Real Inference)");
#else
    LOG_INFO("VMS AI Engine v1.0.0 (Stub Mode)");
#endif
    LOG_INFO("==============================================");

    if (!config.validate()) {
        LOG_ERROR("Invalid configuration");
        return 1;
    }

    LOG_INFO("Configuration:");
    LOG_INFO("  Host: {}", config.host);
    LOG_INFO("  Port: {}", config.grpc_port);
    LOG_INFO("  Log Level: {}", config.log_level);
#ifdef ENABLE_INFERENCE
    LOG_INFO("  Model Path: {}", config.model_path);
    LOG_INFO("  Model Type: {}", config.model_type);
    LOG_INFO("  Inference Threads: {}", config.inference_threads);
    LOG_INFO("  Default Sample FPS: {}", config.default_sample_fps);
    LOG_INFO("  Default Min Confidence: {}", config.default_min_confidence);
#else
    LOG_INFO("  Stub Enabled: {}", config.stub_enabled);
    LOG_INFO("  Stub Interval: {}ms", config.stub_event_interval_ms);
#endif

    // 3. Setup Signal Handlers
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    // 4. Build gRPC Server
    std::string server_address = config.host + ":" + std::to_string(config.grpc_port);
    AiEngineService service(config);
    g_service = &service;

    grpc::EnableDefaultHealthCheckService(true);
    grpc::reflection::InitProtoReflectionServerBuilderPlugin();

    grpc::ServerBuilder builder;
    builder.AddListeningPort(server_address, grpc::InsecureServerCredentials());
    builder.RegisterService(&service);

    g_server = builder.BuildAndStart();
    
    if (!g_server) {
        LOG_ERROR("Failed to start gRPC server on {}", server_address);
        return 1;
    }

    LOG_INFO("AI Engine Server listening on {}", server_address);

    // 5. Start inference/stub engine
    service.start();

    // 6. Wait for shutdown
    g_server->Wait();

    // 7. Cleanup
    service.stop();

    LOG_INFO("AI Engine shutdown complete");
    vms::Logger::shutdown();
    
    return 0;
}
