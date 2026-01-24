cmake_minimum_required(VERSION 3.16)
project(ai_engine VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# =============================================================================
# Options
# =============================================================================
option(ENABLE_INFERENCE "Enable real ONNX + FFmpeg inference" ON)
option(BUILD_TESTS "Build unit tests" OFF)

# =============================================================================
# Find Dependencies
# =============================================================================

# Protobuf
find_package(Protobuf REQUIRED)
message(STATUS "Using Protobuf ${Protobuf_VERSION}")

# gRPC
find_package(gRPC CONFIG REQUIRED)
message(STATUS "Using gRPC ${gRPC_VERSION}")

# spdlog
find_package(spdlog REQUIRED)
message(STATUS "Using spdlog")

# Threads
find_package(Threads REQUIRED)

# FFmpeg (required for ENABLE_INFERENCE)
if(ENABLE_INFERENCE)
    # Try pkg-config first
    find_package(PkgConfig QUIET)
    if(PkgConfig_FOUND)
        pkg_check_modules(FFMPEG IMPORTED_TARGET
            libavcodec
            libavformat
            libavutil
            libswscale
        )
    endif()

    if(NOT FFMPEG_FOUND)
        # Fallback: manual find
        set(FFMPEG_ROOT "C:/ffmpeg")
        
        find_path(AVCODEC_INCLUDE_DIR libavcodec/avcodec.h
            HINTS ${FFMPEG_ROOT}/include $ENV{FFMPEG_DIR}/include)
        find_library(AVCODEC_LIBRARY avcodec
            HINTS ${FFMPEG_ROOT}/lib $ENV{FFMPEG_DIR}/lib ${FFMPEG_ROOT}/bin)
        find_library(AVFORMAT_LIBRARY avformat
            HINTS ${FFMPEG_ROOT}/lib $ENV{FFMPEG_DIR}/lib ${FFMPEG_ROOT}/bin)
        find_library(AVUTIL_LIBRARY avutil
            HINTS ${FFMPEG_ROOT}/lib $ENV{FFMPEG_DIR}/lib ${FFMPEG_ROOT}/bin)
        find_library(SWSCALE_LIBRARY swscale
            HINTS ${FFMPEG_ROOT}/lib $ENV{FFMPEG_DIR}/lib ${FFMPEG_ROOT}/bin)

        if(AVCODEC_INCLUDE_DIR AND AVCODEC_LIBRARY)
            set(FFMPEG_FOUND TRUE)
            set(FFMPEG_INCLUDE_DIRS ${AVCODEC_INCLUDE_DIR})
            set(FFMPEG_LIBRARIES ${AVCODEC_LIBRARY} ${AVFORMAT_LIBRARY} ${AVUTIL_LIBRARY} ${SWSCALE_LIBRARY})
            message(STATUS "FFmpeg found manually: ${FFMPEG_INCLUDE_DIRS}")
        else()
            message(FATAL_ERROR "FFmpeg not found. Set FFMPEG_DIR or install FFmpeg dev packages.")
        endif()
    else()
        message(STATUS "FFmpeg found via pkg-config")
    endif()

    # ONNX Runtime
    set(ONNX_ROOT "C:/onnxruntime")
    find_path(ONNXRUNTIME_INCLUDE_DIR onnxruntime_cxx_api.h
        HINTS ${ONNX_ROOT}/include
              $ENV{ONNXRUNTIME_DIR}/include
              "C:/onnxruntime/include")
    find_library(ONNXRUNTIME_LIBRARY onnxruntime
        HINTS ${ONNX_ROOT}/lib
              $ENV{ONNXRUNTIME_DIR}/lib
              "C:/onnxruntime/lib")

    # Find CUDA Provider library (for GPU support)
    find_library(ONNXRUNTIME_CUDA_LIBRARY onnxruntime_providers_cuda
        HINTS ${ONNX_ROOT}/lib
              $ENV{ONNXRUNTIME_DIR}/lib
              "C:/onnxruntime/lib")

    if(ONNXRUNTIME_CUDA_LIBRARY)
        message(STATUS "ONNX Runtime CUDA Provider found: ${ONNXRUNTIME_CUDA_LIBRARY}")
        add_definitions(-DUSE_CUDA)
    else()
        message(STATUS "ONNX Runtime CUDA Provider NOT found (CPU only)")
    endif()

    if(NOT ONNXRUNTIME_INCLUDE_DIR OR NOT ONNXRUNTIME_LIBRARY)
        message(FATAL_ERROR "ONNX Runtime not found. Set ONNXRUNTIME_DIR or ONNXRUNTIME_ROOT.")
    endif()
    message(STATUS "ONNX Runtime: ${ONNXRUNTIME_INCLUDE_DIR}")
endif()

# =============================================================================
# Generate Protobuf/gRPC sources
# =============================================================================
set(PROTO_FILES
    ${CMAKE_CURRENT_SOURCE_DIR}/proto/ai_engine.proto
)

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

set(PROTO_GEN_DIR ${CMAKE_CURRENT_BINARY_DIR}/generated)
file(MAKE_DIRECTORY ${PROTO_GEN_DIR})

set(PROTO_SRCS
    ${PROTO_GEN_DIR}/ai_engine.pb.cc
    ${PROTO_GEN_DIR}/ai_engine.grpc.pb.cc
)
set(PROTO_HDRS
    ${PROTO_GEN_DIR}/ai_engine.pb.h
    ${PROTO_GEN_DIR}/ai_engine.grpc.pb.h
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
    COMMENT "Generating AI Engine protobuf/gRPC sources"
)

# =============================================================================
# Main Executable
# =============================================================================
set(SOURCES
    src/main.cpp
    src/Config.cpp
    src/Logger.cpp
    src/AiEngineService.cpp
    ${PROTO_SRCS}
)

if(ENABLE_INFERENCE)
    list(APPEND SOURCES
        src/RtspDecoder.cpp
        src/OnnxInference.cpp
        src/InferencePipeline.cpp
    )
endif()

add_executable(ai_engine ${SOURCES})

target_include_directories(ai_engine PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${PROTO_GEN_DIR}
)

if(ENABLE_INFERENCE)
    target_compile_definitions(ai_engine PRIVATE ENABLE_INFERENCE)
    target_include_directories(ai_engine PRIVATE
        ${FFMPEG_INCLUDE_DIRS}
        ${ONNXRUNTIME_INCLUDE_DIR}
    )
endif()

target_link_libraries(ai_engine PRIVATE
    gRPC::grpc++
    gRPC::grpc++_reflection
    protobuf::libprotobuf
    spdlog::spdlog
    Threads::Threads
)

if(ENABLE_INFERENCE)
    if(TARGET PkgConfig::FFMPEG)
        target_link_libraries(ai_engine PRIVATE PkgConfig::FFMPEG)
    else()
        target_link_libraries(ai_engine PRIVATE ${FFMPEG_LIBRARIES})
    endif()
    target_link_libraries(ai_engine PRIVATE ${ONNXRUNTIME_LIBRARY})
    if(ONNXRUNTIME_CUDA_LIBRARY)
        target_link_libraries(ai_engine PRIVATE ${ONNXRUNTIME_CUDA_LIBRARY})
    endif()
endif()

# =============================================================================
# Installation
# =============================================================================
install(TARGETS ai_engine RUNTIME DESTINATION bin)

# =============================================================================
# Tests (optional)
# =============================================================================
if(BUILD_TESTS)
    enable_testing()
endif()
