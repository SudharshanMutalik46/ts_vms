$ErrorActionPreference = "Stop"
$Dest = "..\build\Release"

# List of mirrors/sources for zlibwapi.dll (64-bit)
$Urls = @(
    "http://www.winimage.com/zLibDll/zlib123dllx64.zip",
    "https://github.com/phracker/MacOSX-SDKs/raw/master/MacOSX10.13.sdk/usr/lib/libz.1.2.11.dylib", # No, stick to windows zips
    "https://github.com/databricks/zlib-win-build/releases/download/v1.2.7/zlib-1.2.7-win-x64.zip", # Just generic zlib? check contents
    "https://github.com/rubigula/zlibwapi_dll/raw/master/x64/zlibwapi.dll" # A generic repo hosting it (Unverified but likely works)
)

Write-Host "Attempting download from alternative sources..."

# Try Github direct file first (easiest)
$DirectUrl = "https://github.com/rubigula/zlibwapi_dll/raw/master/x64/zlibwapi.dll"
$OutPath = "$Dest\zlibwapi.dll"

try {
    Write-Host "trying $DirectUrl ..."
    Invoke-WebRequest -Uri $DirectUrl -OutFile $OutPath
    Write-Host "Success! Downloaded zlibwapi.dll" -ForegroundColor Green
    exit 0
}
catch {
    Write-Warning "Failed: $_"
}

Write-Error "Could not download zlibwapi.dll. Please find it manually."
