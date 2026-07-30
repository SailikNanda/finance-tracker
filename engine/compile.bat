@echo off
setlocal
pushd "%~dp0"
echo Compiling Finance Engine...
where gcc >nul 2>nul
if %errorlevel% neq 0 (
    echo GCC not found in PATH. Install MinGW-w64 or run from a Developer Command Prompt.
    popd
    exit /b 1
)
gcc -Wall -Wextra -O2 -c src/engine.c -Iinclude -o engine.o
if %errorlevel% neq 0 (
    echo Engine compile FAILED.
    popd
    exit /b 1
)
echo Engine compiled successfully ^^-^> engine.o
popd
endlocal
