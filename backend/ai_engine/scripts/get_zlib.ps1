$ErrorActionPreference = "Stop"
$Url = "http://www.winimage.com/zLibDll/zlib123dllx64.zip"
$ZipPath = "zlib.zip"
$Dest = "..\build\Release"

Write-Host "Downloading zlibwapi.dll (Required for cuDNN)..."
Invoke-WebRequest -Uri $Url -OutFile $ZipPath

Write-Host "Extracting..."
Expand-Archive -Path $ZipPath -DestinationPath "temp_zlib" -Force

Write-Host "Installing..."
Copy-Item "temp_zlib\dll_x64\zlibwapi.dll" -Destination $Dest -Force

# Cleanup
Remove-Item $ZipPath -Force
Remove-Item "temp_zlib" -Recurse -Force

Write-Host "Success! zlibwapi.dll installed."
