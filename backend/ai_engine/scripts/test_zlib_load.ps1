$Source = @"
using System;
using System.Runtime.InteropServices;

public class DllLoader {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr LoadLibrary(string lpFileName);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool FreeLibrary(IntPtr hModule);
}
"@

Add-Type -TypeDefinition $Source

$dll = Resolve-Path "zlibwapi.dll"
Write-Host "Testing LoadLibrary on: $dll"

$handle = [DllLoader]::LoadLibrary($dll)

if ($handle -ne [IntPtr]::Zero) {
    Write-Host "SUCCESS: zlibwapi.dll loaded successfully! (Handle: $handle)" -ForegroundColor Green
    [DllLoader]::FreeLibrary($handle)
}
else {
    $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    Write-Error "FAILURE: Could not load zlibwapi.dll. Error Code: $err"
}
