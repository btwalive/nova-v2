@echo off
title NOVA Bluetooth Disconnect Fix
color 0B
echo ========================================================
echo   NOVA BLUETOOTH 1-SECOND DISCONNECT AUTOMATED FIX
echo ========================================================
echo.
echo 1. Restarting Windows Audio & Bluetooth Driver Engines...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Restart-Service -Name Audiosrv, AudioEndpointBuilder, bthserv -Force -ErrorAction SilentlyContinue"

echo.
echo 2. Disabling USB Bluetooth Power Saving Selective Suspend...
reg add "HKLM\SYSTEM\CurrentControlSet\Services\BTHPORT\Parameters" /v "DisableSelectiveSuspend" /t REG_DWORD /d 1 /f >nul 2>&1

echo.
echo ========================================================
echo               CRITICAL FIX FOR AIRDOPES:
echo ========================================================
echo.
echo STEP A: Disable Power Saving on Bluetooth Adapter:
echo   1. Press Win + X -^> Device Manager.
echo   2. Expand Bluetooth -^> Right-click Intel(R) Wireless Bluetooth(R).
echo   3. Click Properties -^> Power Management tab.
echo   4. UNCHECK "Allow the computer to turn off this device to save power".
echo.
echo STEP B: Disable Handsfree Telephony Profile:
echo   1. Press Win + R -^> Type "control printers" -^> Press Enter.
echo   2. Right-click "Airdopes 311 Pro" -^> Properties.
echo   3. Click Services tab.
echo   4. UNCHECK "Handsfree Telephony" -^> Click Apply ^& OK.
echo.
echo ========================================================
echo SUCCESS! Re-connect your Airdopes 311 Pro now.
echo ========================================================
echo.
pause
