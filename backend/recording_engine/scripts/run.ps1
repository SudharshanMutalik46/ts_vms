# Run Recording Engine (Windows)
# Expects binary at build/RelWithDebInfo/recording_engine.exe

$exePath = "../../build/RelWithDebInfo/recording_engine.exe"

if (!(Test-Path $exePath)) {
    Write-Error "Recording engine binary not found at $exePath"
    Write-Host "Please build the project first."
    exit 1
}

$env:RECORDING_ENGINE_PORT = "50051"
$env:RECORDINGS_PATH = "../../backend/api_gateway/src/runtime/recordings"

Write-Host "Starting Recording Engine on port 50051..."
& $exePath
