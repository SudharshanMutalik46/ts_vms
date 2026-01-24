#include <cstdlib>
#include <filesystem>
#include <memory>
#include <string>

#include <spdlog/spdlog.h>

#include "Config.h"
#include "GrpcServer.h"
#include "RecordingManager.h"

int main(int argc, char** argv) {
    spdlog::set_level(spdlog::level::info);

    spdlog::info("==============================================");
    spdlog::info("VMS Recording Engine v1.0.0");
    spdlog::info("==============================================");

    // Load config
    vms::Config cfg = vms::Config::load();

#ifdef _WIN32
    const std::string defaultMediaDir = "C:\\vms\\media";
#else
    const std::string defaultMediaDir = "/var/lib/vms";
#endif

    // Shared media root override
    const char* envMediaDir = std::getenv("VMS_MEDIA_DIR");
    const std::string mediaDir =
        envMediaDir ? std::string(envMediaDir) : defaultMediaDir;

    // Override recordings dir
    cfg.recordings_dir = mediaDir + "/recordings";

    // Ensure directories exist
    std::filesystem::create_directories(cfg.recordings_dir);
    std::filesystem::create_directories(mediaDir + "/snapshots");
    std::filesystem::create_directories(mediaDir + "/clips");

    // Validate config
    if (!cfg.validate()) {
        spdlog::error("Invalid configuration, exiting");
        return 1;
    }

    spdlog::info("Configuration:");
    spdlog::info("  gRPC Port: {}", cfg.grpc_port);
    spdlog::info("  Recordings Dir: {}", cfg.recordings_dir);
    spdlog::info("  Segment Duration: {}s", cfg.segment_duration);
    spdlog::info("  Max Cameras: {}", cfg.max_cameras);

    // Create RecordingManager as shared_ptr (REQUIRED)
    auto recordingManager =
        std::make_shared<vms::RecordingManager>(cfg);

    spdlog::info(
        "RecordingManager initialized with base dir: {}",
        cfg.recordings_dir
    );

    // Start gRPC server (constructor runs it)
    vms::GrpcServer server(cfg.grpc_port, recordingManager);

    spdlog::info(
        "gRPC server listening on 0.0.0.0:{}",
        cfg.grpc_port
    );

    // Block forever (GrpcServer owns lifecycle)
    std::this_thread::sleep_for(std::chrono::hours(24 * 365));

    return 0;
}
