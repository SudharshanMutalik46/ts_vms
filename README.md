# Techno VMS - AI-Powered Video Management System

Techno VMS is a high-performance Video Management System designed for real-time surveillance with advanced AI analytics. It features hardware-accelerated object detection, low-latency video streaming, and a modern dashboard interface.

## 🚀 Key Features

*   **Real-Time AI Detection**: Uses **YOLOv8** (ONNX) running on **CUDA (GPU)** for high-speed object detection (Person, Vehicle, etc.).
*   **Visual Analytics**: Displays detections with a "Green Box" overlay, featuring solid label backgrounds and confidence scores.
*   **Low Latency Streaming**: Optimized HTTP-FLV streaming pipeline.
    *   *Note*: Uses **CPU (`libx264`)** for video transcoding to ensure stability (prevents black screens).
    *   *Note*: Uses **GPU (CUDA)** for AI inference.
*   **Automated Optimization**: The AI Engine automatically resizes high-resolution RTSP streams to **640x640** during decoding to maximize FPS and minimize latency (~50ms).
*   **Smart Alerts**: Configurable zones and line-crossing detection (In/Out counting).

## 🛠️ Architecture

*   **Frontend**: React, TailwindCSS, Vite (Dashboard & Video Player).
*   **Backend (API Gateway)**: Node.js, Express (REST API, Stream Management).
*   **AI Engine**: C++17, ONNX Runtime (GPU), FFmpeg (Video Decoding).

## 📋 Prerequisites

*   **OS**: Windows 10/11 (Recommended).
*   **Node.js**: v18+ installed.
*   **GPU**: NVIDIA GPU with updated drivers (for AI acceleration).
*   **CUDA Toolkit**: v11.x or v12.x installed.
*   **C++ Build Tools**: Visual Studio 2019/2022 with C++ Desktop Development credentials.
*   **FFmpeg**: Installed and added to system PATH.

## ⚙️ Installation

### 1. Backend (API Gateway)
```bash
cd backend/api_gateway
npm install
```
*Configure `.env` if necessary (database credentials, secrets).*

### 2. Frontend (Dashboard)
```bash
cd frontend
npm install
```

### 3. AI Engine (C++)
The AI Engine requires building from source using CMake.
```bash
cd backend/ai_engine
mkdir build
cd build
cmake ..
cmake --build . --config Release
```
*Ensure `yolov8s.onnx` is placed in `backend/ai_engine/models/`.*

## ▶️ Running the System

You can use the helper script or run components individually.

### Quick Start (Windows)
Run the automated startup script:
```powershell
./start_vms.bat
```

### Manual Start

**Terminal 1: Backend**
```bash
cd backend/api_gateway
npm run dev
```

**Terminal 2: Frontend**
```bash
cd frontend
npm run dev
```

**Terminal 3: AI Engine**
```powershell
cd backend/ai_engine
powershell -ExecutionPolicy Bypass -File .\scripts\run.ps1
```

## 🔧 Troubleshooting

### Video is Black Screen?
*   The system falls back to **CPU encoding (`libx264`)** for the visual stream to prevent driver conflicts with the AI Engine.
*   Check if FFmpeg is installed and accessible.
*   Refresh the page to restart the FLV stream.

### Low FPS / High Latency?
*   The AI Engine is pre-configured to downscale video to **640x640**.
*   If latency persists, check if the **CUDA Execution Provider** is enabled in the AI Engine logs.
*   Ensure your camera is set to **H.264** (preferred) or H.265.

## 🤝 Contributing
1.  Fork the repository.
2.  Create a feature branch.
3.  Commit your changes.
4.  Push to the branch and start a Pull Request.
