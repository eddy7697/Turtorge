@echo off
setlocal

set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

where pnpm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] pnpm was not found in PATH.
    echo Install pnpm 11 and try again.
    exit /b 1
)

where cargo >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Cargo was not found in PATH.
    echo Install the Rust MSVC toolchain and try again.
    exit /b 1
)

echo Synchronizing locked dependencies...
set "CI=true"
call pnpm install --frozen-lockfile --prefer-offline
if errorlevel 1 (
    echo.
    echo [ERROR] Dependency installation failed.
    exit /b 1
)

for /f %%I in ('powershell.exe -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HH-mm-ss_fff'"') do set "BUILD_STAMP=%%I"
if not defined BUILD_STAMP (
    echo [ERROR] Could not determine the build date.
    exit /b 1
)

set "CARGO_TARGET_DIR=%PROJECT_ROOT%artifacts\%BUILD_STAMP%"
if exist "%CARGO_TARGET_DIR%" (
    echo [ERROR] The output directory already exists:
    echo         %CARGO_TARGET_DIR%
    echo Nothing was overwritten.
    exit /b 1
)

echo Building the latest Turtorge standalone release...
echo Output directory: %CARGO_TARGET_DIR%
echo.

call pnpm --dir apps/desktop tauri build --no-bundle
if errorlevel 1 (
    echo.
    echo [ERROR] The Turtorge build failed.
    echo Partial build files may remain in:
    echo         %CARGO_TARGET_DIR%
    exit /b 1
)

set "OUTPUT_EXE=%CARGO_TARGET_DIR%\release\turtorge.exe"
if not exist "%OUTPUT_EXE%" (
    echo.
    echo [ERROR] The build completed without the expected executable:
    echo         %OUTPUT_EXE%
    exit /b 1
)

for %%F in (conpty.dll OpenConsole.exe) do (
    if not exist "%CARGO_TARGET_DIR%\release\%%F" (
        echo.
        echo [ERROR] The build completed without the sideloaded ConPTY host file:
        echo         %CARGO_TARGET_DIR%\release\%%F
        echo Without it Turtorge falls back to the Windows-inbox ConPTY, which corrupts TUI redraws.
        exit /b 1
    )
)

echo.
echo [SUCCESS] The latest standalone release is ready:
echo           %OUTPUT_EXE%
echo           Ship it together with conpty.dll and OpenConsole.exe from the same folder.
exit /b 0
