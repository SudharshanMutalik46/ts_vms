# Force Local DLL Priority
$env:Path = "$PSScriptRoot\..\build\Release;C:\ffmpeg\bin;$env:Path"

# Clear potential conflicting CUDA paths (Force local usage)
$env:CUDA_PATH = "$PSScriptRoot\..\build\Release"
$env:CUDA_PATH_V13_1 = ""
$env:CUDNN_PATH = "$PSScriptRoot\..\build\Release"

$env:VMS_LOG_LEVEL = "info"
# $env:CUDNN_LOGINFO_DBG = "1" 
# $env:CUDNN_LOGDEST_DBG = "stdout"

# Default Model directory
# Default Model directory (Relative path)
$ModelDir = "$PSScriptRoot\..\models"

# Check for better models in order of accuracy
if (Test-Path "$ModelDir\yolov8s.onnx") {
    $env:AI_MODEL_PATH = "$ModelDir\yolov8s.onnx"
    Write-Host "Using Small Model (yolov8s) - Optimal for RTX 3050"
}
elseif (Test-Path "$ModelDir\yolov8m.onnx") {
    $env:AI_MODEL_PATH = "$ModelDir\yolov8m.onnx"
    Write-Host "Using Medium Model (yolov8m)"
}
else {
    $env:AI_MODEL_PATH = "$ModelDir\yolov8n.onnx"
    Write-Host "Using Nano Model (yolov8n)"
}

# Optimize Settings for Accountability
$env:AI_DEFAULT_MIN_CONFIDENCE = "0.10"  # Debug level
$env:AI_DEFAULT_SAMPLE_FPS = "8"

Write-Host "Starting AI Engine..."
& "$PSScriptRoot\..\build\Release\ai_engine.exe"
