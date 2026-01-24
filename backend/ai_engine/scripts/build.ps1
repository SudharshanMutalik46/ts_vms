# Build AI Engine
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Join-Path $ScriptDir ".."
$BuildDir = Join-Path $ProjectRoot "build"

Write-Host "Building AI Engine in $ProjectRoot..." -ForegroundColor Cyan

# Clean build dir
if (Test-Path $BuildDir) {
    Write-Host "Cleaning previous build..." -ForegroundColor Gray
    Remove-Item -Path $BuildDir -Recurse -Force
}

New-Item -ItemType Directory -Path $BuildDir | Out-Null

Set-Location $BuildDir

# Vcpkg Toolchain Path
$VcpkgPath = "C:/Users/sudha/vcpkg/scripts/buildsystems/vcpkg.cmake"

# Configure
Write-Host "Configuring CMake..." -ForegroundColor Yellow
# Try to find a generator
if (Get-Command "ninja" -ErrorAction SilentlyContinue) {
    cmake -G "Ninja" -DCMAKE_BUILD_TYPE=Release -DCMAKE_TOOLCHAIN_FILE="$VcpkgPath" ..
}
else {
    cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_TOOLCHAIN_FILE="$VcpkgPath" ..
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "CMake configuration failed."
}

# Build
Write-Host "Compiling..." -ForegroundColor Yellow
cmake --build . --config Release

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build Complete!" -ForegroundColor Green
    
    # Critical Fix: Copy ONNX Runtime DLLs to output bin
    # prevents loading wrong version from System32
    Write-Host "Copying Runtime DLLs..." -ForegroundColor Gray
    Copy-Item "C:\onnxruntime\lib\onnxruntime*.dll" -Destination "Release" -Force
    
    # Copy cuDNN 9 for CUDA 12 DLLs (Required for GPU acceleration)
    # These are stored in a safe location to survive rebuilds
    $CudnnSource = "C:\Users\sudha\cudnn12"
    if (Test-Path $CudnnSource) {
        Write-Host "Copying cuDNN 9 DLLs from $CudnnSource..." -ForegroundColor Gray
        Copy-Item "$CudnnSource\cudnn*.dll" -Destination "Release" -Force -ErrorAction SilentlyContinue
        Copy-Item "$CudnnSource\zlibwapi.dll" -Destination "Release" -Force -ErrorAction SilentlyContinue
    }
    else {
        Write-Host "[WARN] cuDNN source folder not found: $CudnnSource" -ForegroundColor Yellow
        Write-Host "[WARN] GPU acceleration may not work. Copy cuDNN 9 DLLs manually." -ForegroundColor Yellow
    }
    
    # Copy cuBLAS from CUDA Toolkit (safe location)
    $CudaToolkit = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6\bin"
    if (Test-Path $CudaToolkit) {
        Write-Host "Copying cuBLAS from CUDA Toolkit..." -ForegroundColor Gray
        Copy-Item "$CudaToolkit\cublas64_12.dll" -Destination "Release" -Force -ErrorAction SilentlyContinue
        Copy-Item "$CudaToolkit\cublasLt64_12.dll" -Destination "Release" -Force -ErrorAction SilentlyContinue
        Copy-Item "$CudaToolkit\zlibwapi.dll" -Destination "Release" -Force -ErrorAction SilentlyContinue
    }
}
else {
    Write-Error "Build failed."
}
