@echo off
title NOVA Bluetooth Real-Time Live Diagnostics
color 0A
echo =========================================================
echo    NOVA REAL-TIME BLUETOOTH CONNECTIVITY MONITOR & LOGGER
echo =========================================================
echo.
echo Starting Live Windows Event Log Monitor for Bluetooth...
echo Please try connecting your Airdopes 311 Pro now in Windows Settings!
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scratch\monitor_bluetooth_live.ps1"
pause
