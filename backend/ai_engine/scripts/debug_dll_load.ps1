
$ErrorActionPreference = "Stop"

$header = @"
using System;
using System.Runtime.InteropServices;

public class NativeMethods {
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern IntPtr LoadLibrary(string lpFileName);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr GetProcAddress(IntPtr hModule, string procedureName);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool FreeLibrary(IntPtr hModule);
}
"@

Add-Type -TypeDefinition $header

$BinDir = "$PSScriptRoot\..\build\Release"
Set-Location $BinDir
$DllName = "cudnn64_9.dll"

Write-Host "Checking NVIDIA Driver Version:"
nvidia-smi | Select-Object -First 3
Write-Host "--------------------------------"
Write-Host "Attempting to load $DllName from $BinDir"

# Try loading
$handle = [NativeMethods]::LoadLibrary("$BinDir\$DllName")

if ($handle -eq [IntPtr]::Zero) {
    $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    Write-Host "FAILED. Error Code: $err"
    
    if ($err -eq 126) { Write-Host "Error 126: Module not found (A dependency is missing? zlibwapi.dll? vc_runtime?)" }
    if ($err -eq 193) { Write-Host "Error 193: Bad Image (32-bit vs 64-bit mismatch?)" }
}
else {
    Write-Host "SUCCESS: Loaded $DllName"
    [NativeMethods]::FreeLibrary($handle)
}

# Check existence of critical dependencies
Write-Host "`nChecking files in directory:"
Get-ChildItem -Path . -Filter "cudnn*.dll" | Select-Object Name, Length
Get-ChildItem -Path . -Filter "zlib*.dll" | Select-Object Name, Length

