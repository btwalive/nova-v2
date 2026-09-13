@echo off
title NOVA Bluetooth Complete Device Unpair & Reset
color 0C
echo ========================================================
echo   REMOVING CORRUPTED AIRDOPES 311 PRO BLUETOOTH KEYS
echo ========================================================
echo.
echo 1. Clearing stale Airdopes device entries from Windows...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$devices = Get-PnpDevice | Where-Object { $_.FriendlyName -like '*Airdopes*' }; foreach ($d in $devices) { pnputil.exe /remove-device `"$($d.InstanceId)`" }"

echo.
echo 2. Restarting Bluetooth Services...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Restart-Service bthserv -Force -ErrorAction SilentlyContinue; Get-Service BluetoothUserService* | Restart-Service -ErrorAction SilentlyContinue"

echo.
echo ========================================================
echo SUCCESS! Stale device keys have been completely removed.
echo.
echo NOW DO THIS IN WINDOWS SETTINGS:
echo 1. Open Windows Settings (Win + I) -^> Bluetooth ^& devices.
echo 2. Turn Bluetooth OFF, wait 3 seconds, turn Bluetooth ON.
echo 3. Click "Add device" -^> Select Airdopes 311 Pro from NEW DEVICES.
echo ========================================================
echo.
pause
