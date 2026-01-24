
$ErrorActionPreference = "Stop"

# Define Paths
$BuildDir = "$PSScriptRoot\..\build\Release"
$ModelDir = "$PSScriptRoot\..\models"
$ExePath = "$BuildDir\ai_engine.exe"

# Set Environment Variables
$env:Path = "$BuildDir;$env:Path"
$env:CUDA_PATH = "$BuildDir"
$env:CUDNN_PATH = "$BuildDir"
$env:VMS_LOG_LEVEL = "debug"  # Force debug log
$env:AI_MODEL_PATH = "$ModelDir\yolov8n.onnx"

Write-Host "Starting AI Engine for GPU Test..."
Write-Host "Exe: $ExePath"
Write-Host "Model: $env:AI_MODEL_PATH"

# Start the process
$Process = Start-Process -FilePath $ExePath -PassThru -NoNewWindow -RedirectStandardOutput "test_output.log" -RedirectStandardError "test_error.log"

# Wait a clearer amount of time for initialization
Start-Sleep -Seconds 20

# Kil it
if (-not $Process.HasExited) {
    Stop-Process -Id $Process.Id -Force
}

# Read output
Write-Host "--- STDOUT ---"
Get-Content "test_output.log" -ErrorAction SilentlyContinue
Write-Host "--- STDERR ---"
Get-Content "test_error.log" -ErrorAction SilentlyContinue
