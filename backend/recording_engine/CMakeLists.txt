cmake_minimum_required(VERSION 3.16)
project(recording_engine VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# =============================================================================
# Options
# =============================================================================
option(BUILD_TESTS "Build unit tests" OFF)

# =============================================================================
# Find Dependencies
# =============================================================================

# Find Protobuf
find_package(Protobuf REQUIRED)
message(STATUS "Using Protobuf ${Protobuf_VERSION}")

# Find gRPC
find_package(gRPC CONFIG REQUIRED)
message(STATUS "Using gRPC ${gRPC_VERSION}")

# Find spdlog for logging
find_package(spdlog REQUIRED)
message(STATUS "Using spdlog")

# Find Threads
find_package(Threads REQUIRED)

# =============================================================================
# Generate Protobuf/gRPC sources
# =============================================================================
set(PROTO_FILES
    ${CMAKE_CURRENT_SOURCE_DIR}/proto/recording_engine.proto
)

# Get protoc and grpc_cpp_plugin paths.
# NOTE (Windows/Visual Studio multi-config): IMPORTED_LOCATION may be empty; prefer TARGET_FILE.
if(TARGET protobuf::protoc)
    set(PROTOC_EXECUTABLE $<TARGET_FILE:protobuf::protoc>)
else()
    set(PROTOC_EXECUTABLE ${Protobuf_PROTOC_EXECUTABLE})
endif()

if(TARGET gRPC::grpc_cpp_plugin)
    set(GRPC_CPP_PLUGIN $<TARGET_FILE:gRPC::grpc_cpp_plugin>)
else()
    get_target_property(GRPC_CPP_PLUGIN gRPC::grpc_cpp_plugin IMPORTED_LOCATION)
endif()

# Output directories
set(PROTO_GEN_DIR ${CMAKE_CURRENT_BINARY_DIR}/generated)
file(MAKE_DIRECTORY ${PROTO_GEN_DIR})

# Generate protobuf and grpc sources
set(PROTO_SRCS
    ${PROTO_GEN_DIR}/recording_engine.pb.cc
    ${PROTO_GEN_DIR}/recording_engine.grpc.pb.cc
)
set(PROTO_HDRS
    ${PROTO_GEN_DIR}/recording_engine.pb.h
    ${PROTO_GEN_DIR}/recording_engine.grpc.pb.h
)

add_custom_command(
    OUTPUT ${PROTO_SRCS} ${PROTO_HDRS}
    COMMAND ${PROTOC_EXECUTABLE}
        --proto_path=${CMAKE_CURRENT_SOURCE_DIR}/proto
        --cpp_out=${PROTO_GEN_DIR}
        --grpc_out=${PROTO_GEN_DIR}
        --plugin=protoc-gen-grpc=${GRPC_CPP_PLUGIN}
        ${PROTO_FILES}
    DEPENDS ${PROTO_FILES}
    COMMENT "Generating protobuf/gRPC sources"
)

# =============================================================================
# Main Executable
# =============================================================================
set(SOURCES
    src/main.cpp
    src/Config.cpp
    src/Logger.cpp
    src/DiskLayout.cpp
    src/Session.cpp
    src/RecordingManager.cpp
    src/ProcessSupervisor.cpp
    src/GrpcServer.cpp
    ${PROTO_SRCS}
)

add_executable(recording_engine ${SOURCES})

target_include_directories(recording_engine PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${PROTO_GEN_DIR}
)

target_link_libraries(recording_engine PRIVATE
    gRPC::grpc++
    gRPC::grpc++_reflection
    protobuf::libprotobuf
    spdlog::spdlog
    Threads::Threads
)

# =============================================================================
# Installation
# =============================================================================
install(TARGETS recording_engine
    RUNTIME DESTINATION bin
)

# =============================================================================
# Tests (optional)
# =============================================================================
if(BUILD_TESTS)
    enable_testing()
    # Add test targets here
endif()
