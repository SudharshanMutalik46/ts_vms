#include "GrpcServer.h"
#include "Logger.h"

#include "recording_engine.grpc.pb.h"

#include <grpcpp/ext/proto_server_reflection_plugin.h>
#include <grpcpp/health_check_service_interface.h>
#include <google/protobuf/empty.pb.h>

#include <chrono>
#include <cstdlib>
#include <filesystem>
#include <iomanip>
#include <sstream>
#include <thread>

namespace vms {

using grpc::Server;
using grpc::ServerBuilder;
using grpc::ServerContext;
using grpc::ServerWriter;

namespace fs = std::filesystem;

static std::string sanitizeFileToken(std::string s) {
    for (char& c : s) {
        const bool ok =
            (c >= 'a' && c <= 'z') ||
            (c >= 'A' && c <= 'Z') ||
            (c >= '0' && c <= '9') ||
            (c == '-') || (c == '_');
        if (!ok) c = '_';
    }
    if (s.empty()) s = "event";
    return s;
}

static fs::path resolveMediaRoot(const std::string& snapshotsBaseDirFromReq) {
    // snapshots_base_dir is treated as MEDIA ROOT (preferred)
    // If caller mistakenly passes ".../snapshots", normalize to its parent.
    if (!snapshotsBaseDirFromReq.empty()) {
        fs::path p(snapshotsBaseDirFromReq);
        if (p.filename() == "snapshots") return p.parent_path();
        return p;
    }

    const char* envMediaDir = std::getenv("VMS_MEDIA_DIR");
    if (envMediaDir && std::string(envMediaDir).size() > 0) {
        return fs::path(envMediaDir);
    }

    // standard defaults if env var missing
#ifdef _WIN32
    return fs::path("C:\\vms\\media");
#else
    return fs::path("/var/lib/vms");
#endif
}

/**
 * gRPC Service Implementation
 */
class RecordingEngineServiceImpl final : public ::vms::recording::RecordingEngine::Service {
public:
    explicit RecordingEngineServiceImpl(std::shared_ptr<RecordingManager> manager)
        : m_manager(std::move(manager)) {}

    grpc::Status StartRecording(
        ServerContext* /*context*/,
        const ::vms::recording::StartRecordingRequest* request,
        ::vms::recording::StartRecordingResponse* response
    ) override {
        LOG_INFO("gRPC: StartRecording for camera {}", request->camera_id());

        std::string sessionId = m_manager->startRecording(
            request->camera_id(),
            request->rtsp_url(),
            request->segment_seconds(),
            request->recordings_base_dir()
        );

        if (sessionId.empty()) {
            response->set_started(false);
            response->set_message("Failed to start recording");
        } else {
            response->set_started(true);
            response->set_session_id(sessionId);
            response->set_message("Recording started");
        }

        return grpc::Status::OK;
    }

    grpc::Status StopRecording(
        ServerContext* /*context*/,
        const ::vms::recording::StopRecordingRequest* request,
        ::vms::recording::StopRecordingResponse* response
    ) override {
        LOG_INFO("gRPC: StopRecording for camera {}", request->camera_id());

        auto result = m_manager->stopRecording(request->camera_id());
        response->set_stopped(result.success);
        response->set_message(result.message);
        response->set_final_file_path(result.final_file_path);
        response->set_final_size_bytes(result.final_size_bytes);
        response->set_merged(result.merged);

        return grpc::Status::OK;
    }

    grpc::Status GetStatus(
        ServerContext* /*context*/,
        const ::vms::recording::StatusRequest* request,
        ::vms::recording::StatusResponse* response
    ) override {
        auto status = m_manager->getStatus(request->camera_id());

        response->set_state(static_cast<::vms::recording::RecordingState>(status.state));
        response->set_session_id(status.sessionId);
        response->set_last_error(status.lastError);
        response->set_bytes_written(status.bytesWritten);
        response->set_segments_written(status.segmentsWritten);
        response->set_uptime_seconds(status.uptimeSeconds);

        return grpc::Status::OK;
    }

    grpc::Status ListActive(
        ServerContext* /*context*/,
        const google::protobuf::Empty* /*request*/,
        ::vms::recording::ListActiveResponse* response
    ) override {
        auto activeList = m_manager->listActive();

        for (const auto& active : activeList) {
            auto* rec = response->add_recordings();
            rec->set_camera_id(active.cameraId);
            rec->set_session_id(active.sessionId);
            rec->set_state(static_cast<::vms::recording::RecordingState>(active.state));
            rec->set_uptime_seconds(active.uptimeSeconds);
            rec->set_segments_written(active.segmentsWritten);
        }

        return grpc::Status::OK;
    }

    grpc::Status CaptureSnapshot(
        ServerContext* /*context*/,
        const ::vms::recording::CaptureSnapshotRequest* request,
        ::vms::recording::CaptureSnapshotResponse* response
    ) override {
        LOG_INFO("gRPC: CaptureSnapshot for camera {} event {}", request->camera_id(), request->event_id());

        try {
            // 1) Resolve MEDIA ROOT + SNAP ROOT
            const fs::path mediaRoot = resolveMediaRoot(request->snapshots_base_dir());
            const fs::path snapRoot = mediaRoot / "snapshots";

            // 2) Date folder YYYY-MM-DD
            auto now = std::chrono::system_clock::now();
            auto in_time_t = std::chrono::system_clock::to_time_t(now);
            std::tm buf{};
#ifdef _WIN32
            localtime_s(&buf, &in_time_t);
#else
            localtime_r(&in_time_t, &buf);
#endif
            std::stringstream ss;
            ss << std::put_time(&buf, "%Y-%m-%d");
            const std::string dateStr = ss.str();

            // 3) Build full path: <mediaRoot>/snapshots/<camera>/<date>/<event>.jpg
            const std::string safeEvent = sanitizeFileToken(request->event_id());
            const fs::path snapshotDir = snapRoot / request->camera_id() / dateStr;
            const fs::path filename = fs::path(safeEvent + ".jpg");
            const fs::path fullPath = snapshotDir / filename;

            fs::create_directories(snapshotDir);

            // 4) FFmpeg command (do NOT log rtsp_url)
            std::string cmd =
                "ffmpeg -y -hide_banner -loglevel error -rtsp_transport tcp -timeout 5000000 -i \"";
            cmd += request->rtsp_url();
            cmd += "\" -frames:v 1 -q:v 2 \"";
            cmd += fullPath.string();
            cmd += "\"";

            LOG_INFO("gRPC: Executing snapshot capture -> {}", fullPath.string());
            const int ret = std::system(cmd.c_str());

            if (ret == 0 && fs::exists(fullPath)) {
                // Return RELATIVE path from mediaRoot: snapshots/<camera>/<date>/<event>.jpg
                fs::path rel;
                try {
                    rel = fs::relative(fullPath, mediaRoot);
                } catch (...) {
                    rel = fs::path("snapshots") / request->camera_id() / dateStr / filename;
                }

                response->set_ok(true);
                response->set_snapshot_path(rel.generic_string());
                response->set_size_bytes(static_cast<int64_t>(fs::file_size(fullPath)));
                response->set_message("Snapshot captured");
                LOG_INFO("gRPC: Snapshot success: {} bytes", response->size_bytes());
            } else {
                response->set_ok(false);
                response->set_message("FFmpeg failed with code: " + std::to_string(ret));
                LOG_ERROR("gRPC: Snapshot failed for camera {}", request->camera_id());
            }
        } catch (const std::exception& e) {
            response->set_ok(false);
            response->set_message(std::string("Exception: ") + e.what());
            LOG_ERROR("gRPC: Snapshot exception: {}", e.what());
        }

        return grpc::Status::OK;
    }

    grpc::Status GetDiskStatus(
        ServerContext* /*context*/,
        const google::protobuf::Empty* /*request*/,
        ::vms::recording::DiskStatusResponse* response
    ) override {
        auto stats = m_manager->getDiskStatus();

        response->set_free_bytes(stats.free_bytes);
        response->set_total_bytes(stats.total_bytes);
        response->set_used_bytes(stats.used_bytes);

        return grpc::Status::OK;
    }

    grpc::Status StreamEvents(
        ServerContext* context,
        const google::protobuf::Empty* /*request*/,
        ServerWriter<::vms::recording::Event>* writer
    ) override {
        LOG_INFO("gRPC: StreamEvents client connected");

        while (!context->IsCancelled()) {
            Event evt;
            if (m_manager->popEvent(evt)) {
                ::vms::recording::Event protoEvt;

                switch (evt.type) {
                case Event::SEGMENT_WRITTEN: {
                    auto* seg = protoEvt.mutable_segment_written();
                    seg->set_camera_id(evt.segment.cameraId);
                    seg->set_session_id(evt.segment.sessionId);
                    seg->set_file_path(evt.segment.filePath);
                    seg->set_start_timestamp_ms(evt.segment.startTimestampMs);
                    seg->set_end_timestamp_ms(evt.segment.endTimestampMs);
                    seg->set_size_bytes(evt.segment.sizeBytes);
                    seg->set_segment_index(evt.segment.segmentIndex);
                    break;
                }
                case Event::STATE_CHANGED: {
                    auto* sc = protoEvt.mutable_state_changed();
                    sc->set_camera_id(evt.cameraId);
                    sc->set_old_state(static_cast<::vms::recording::RecordingState>(evt.oldState));
                    sc->set_new_state(static_cast<::vms::recording::RecordingState>(evt.newState));
                    sc->set_message(evt.message);
                    break;
                }
                case Event::RECORDING_ERROR: {
                    auto* err = protoEvt.mutable_recording_error();
                    err->set_camera_id(evt.cameraId);
                    err->set_session_id(evt.segment.sessionId);
                    err->set_error_code(evt.errorCode);
                    err->set_message(evt.message);
                    break;
                }
                }

                if (!writer->Write(protoEvt)) {
                    LOG_WARN("gRPC: StreamEvents write failed");
                    break;
                }
            }

            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }

        LOG_INFO("gRPC: StreamEvents client disconnected");
        return grpc::Status::OK;
    }

private:
    std::shared_ptr<RecordingManager> m_manager;
};

// GrpcServer implementation

GrpcServer::GrpcServer(uint16_t port, std::shared_ptr<RecordingManager> manager)
    : m_port(port)
    , m_manager(std::move(manager)) {}

GrpcServer::~GrpcServer() {
    shutdown();
    if (m_asyncThread.joinable()) {
        m_asyncThread.join();
    }
}

void GrpcServer::run() {
    std::string serverAddress = "0.0.0.0:" + std::to_string(m_port);

    RecordingEngineServiceImpl service(m_manager);

    grpc::EnableDefaultHealthCheckService(true);
    grpc::reflection::InitProtoReflectionServerBuilderPlugin();

    ServerBuilder builder;
    builder.AddListeningPort(serverAddress, grpc::InsecureServerCredentials());
    builder.RegisterService(&service);

    m_server = builder.BuildAndStart();

    if (!m_server) {
        LOG_ERROR("Failed to start gRPC server on {}", serverAddress);
        return;
    }

    m_running = true;
    LOG_INFO("gRPC server listening on {}", serverAddress);

    m_server->Wait();
    m_running = false;
}

void GrpcServer::runAsync() {
    m_asyncThread = std::thread(&GrpcServer::run, this);
}

void GrpcServer::shutdown() {
    if (m_server) {
        LOG_INFO("Shutting down gRPC server");
        m_server->Shutdown();
    }
}

} // namespace vms
