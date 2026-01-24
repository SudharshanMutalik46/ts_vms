$Source = @"
using System;
using System.Runtime.InteropServices;

public class CudnnTest {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr LoadLibrary(string lpFileName);

    [DllImport("cudnn64_9.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern int cudnnCreate(ref IntPtr handle);

    [DllImport("cudnn64_9.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern IntPtr cudnnGetErrorString(int status);

    [DllImport("cudnn64_9.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern int cudnnGetVersion();
}
"@

# Add the type, but specify the directory so it finds the DLL
$DllPath = "$PSScriptRoot\..\build\Release"
$env:Path = "$DllPath;$env:Path"

try {
    Add-Type -TypeDefinition $Source
}
catch {
    Write-Host "Type already added or error defining type: $_"
}

Write-Host "Testing cuDNN Initialization..."
Write-Host "Looking in: $DllPath"

# Check if DLL exists
if (-not (Test-Path "$DllPath\cudnn64_9.dll")) {
    Write-Error "cudnn64_9.dll NOT FOUND in $DllPath"
    exit 1
}

try {
    $ver = [CudnnTest]::cudnnGetVersion()
    Write-Host "cuDNN Version: $ver"
}
catch {
    Write-Warning "Could not call cudnnGetVersion. DLL might not be loaded."
    Write-Host "Error: $_"
    exit 1
}

$handle = [IntPtr]::Zero
$status = [CudnnTest]::cudnnCreate([ref] $handle)

if ($status -eq 0) {
    Write-Host "SUCCESS: cudnnCreate passed! Handle: $handle" -ForegroundColor Green
}
else {
    Write-Error "FAILURE: cudnnCreate returned status $status (CUDNN_STATUS_NOT_INITIALIZED=1001)"
}
