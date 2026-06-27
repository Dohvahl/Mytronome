@echo off
setlocal

rem Run both test suites and report an overall pass/fail. We run both even if the
rem first fails, so you see every result in one go.
set "failed="

echo === TypeScript tests (npm test) ===
rem `call` is required here: npm is npm.cmd, and invoking one batch file from
rem another WITHOUT call hands off control and never returns — which is why the
rem dotnet line was being skipped before.
call npm test
if errorlevel 1 set "failed=1"

echo.
echo === .NET tests (test/PresetApi.Tests) ===
dotnet test test/PresetApi.Tests
if errorlevel 1 set "failed=1"

echo.
if defined failed (
  echo TESTS FAILED.
  exit /b 1
)
echo All tests passed.
exit /b 0
