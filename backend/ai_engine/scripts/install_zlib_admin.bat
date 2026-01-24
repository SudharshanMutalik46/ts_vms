@echo off
echo Requesting Admin Privileges to install zlibwapi.dll...

:: Check for permissions
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"

:: If error flag set, we do not have admin.
if '%errorlevel%' NEQ '0' (
    echo Requesting administrative privileges...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"

echo.
echo Installing zlibwapi.dll to SYSTEM...
echo Source: %CD%\zlibwapi.dll
echo.

copy /Y "zlibwapi.dll" "C:\Windows\System32\zlibwapi.dll"
if %errorlevel% neq 0 echo FAILED to copy to System32

if exist "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6\bin" (
    copy /Y "zlibwapi.dll" "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6\bin\zlibwapi.dll"
    if %errorlevel% neq 0 echo FAILED to copy to CUDA folder
)

echo.
echo =======================================================
echo Installation Complete.
echo You may verify the file exists in C:\Windows\System32
echo =======================================================
pause
