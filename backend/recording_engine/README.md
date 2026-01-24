# VMS Recording Engine (C++)

Production-grade video recording service using FFmpeg subprocess management.

## Prerequisites

### Ubuntu
```bash
# Install build tools
sudo apt update
sudo apt install -y build-essential cmake pkg-config

# Install gRPC and Protobuf
sudo apt install -y libgrpc++-dev libprotobuf-dev protobuf-compiler-grpc

# Install spdlog
sudo apt install -y libspdlog-dev

# Install FFmpeg
sudo apt install -y ffmpeg
```

### Windows (vcpkg)
```powershell
# Install vcpkg if not present
git clone https://github.com/microsoft/vcpkg.git
cd vcpkg
.\bootstrap-vcpkg.bat

# Install dependencies
.\vcpkg install grpc:x64-windows protobuf:x64-windows spdlog:x64-windows
```

## Build

### Ubuntu
```bash
cd backend/recording_engine
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)
```

### Windows
```powershell
cd backend\recording_engine
mkdir build
cd build
cmake .. -DCMAKE_TOOLCHAIN_FILE="C:\path\to\vcpkg\scripts\buildsystems\vcpkg.cmake"
cmake --build . --config Release
```

## Run

```bash
# Set environment variables
export GRPC_PORT=50051
export RECORDINGS_DIR=/var/lib/vms/recordings
export LOG_LEVEL=info

# Run the service
./recording_engine
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GRPC_PORT` | `50051` | gRPC server listen port |
| `RECORDINGS_DIR` | `/var/lib/vms/recordings` | Base directory for recordings |
| `LOG_LEVEL` | `info` | Logging level (trace, debug, info, warn, error) |
| `SEGMENT_DURATION` | `60` | Default segment duration in seconds |
| `MAX_CAMERAS` | `16` | Maximum concurrent recordings |

## Disk Layout

```
RECORDINGS_DIR/
└── cameras/
    └── <camera_id>/
        └── <YYYY>/
            └── <MM>/
                └── <DD>/
                    └── <session_id>/
                        ├── segment_000001.mp4
                        ├── segment_000002.mp4
                        └── session.json
```

## gRPC API

| Method | Description |
|--------|-------------|
| `StartRecording` | Start recording for a camera |
| `StopRecording` | Stop recording for a camera |
| `GetStatus` | Get recording status for a camera |
| `ListActive` | List all active recordings |
| `GetDiskStatus` | Get disk usage statistics |
| `StreamEvents` | Stream real-time events |

## Integration with Node.js

The Node.js API Gateway connects to this service via gRPC when `USE_NATIVE_RECORDING=true`. The REST API endpoints remain unchanged.

```
Node.js (REST) → gRPC Client → [gRPC] → Recording Engine → FFmpeg → Disk
```
