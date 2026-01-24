#pragma once

#include "RecordingManager.h"
#include <grpcpp/grpcpp.h>
#include <memory>
#include <atomic>
#include <thread>

namespace vms {

/**
 * gRPC Server implementation
 * Handles all RPC calls and delegates to RecordingManager
 */
class GrpcServer {
public:
    GrpcServer(uint16_t port, std::shared_ptr<RecordingManager> manager);
    ~GrpcServer();
    
    /**
     * Start the gRPC server (blocking)
     */
    void run();
    
    /**
     * Start the gRPC server in background thread
     */
    void runAsync();
    
    /**
     * Shutdown the server
     */
    void shutdown();
    
    /**
     * Check if server is running
     */
    bool isRunning() const { return m_running.load(); }
    
private:
    uint16_t m_port;
    std::shared_ptr<RecordingManager> m_manager;
    std::unique_ptr<grpc::Server> m_server;
    std::atomic<bool> m_running{false};
    std::thread m_asyncThread;
};

} // namespace vms
