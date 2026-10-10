@echo off
rem LazyTyper - removes the panel. Your saved presets and settings are
rem removed too, but only if you say so. Rigs already in your projects keep
rem working: they are plain expressions.

setlocal EnableExtensions
title Uninstall LazyTyper
set "EXT_ROOT=%APPDATA%\Adobe\CEP\extensions"
set "DEST=%EXT_ROOT%\com.sohan.LazyTyper"
set "DATA=%APPDATA%\LazyTyper"

echo Removing the LazyTyper panel...
echo Close After Effects first.
echo.
pause

if not exist "%DEST%" (
  echo The panel was not installed.
  goto :data
)

dir /a:l /b "%EXT_ROOT%" 2>nul | findstr /i /x "com.sohan.LazyTyper" >nul
if not errorlevel 1 (rmdir "%DEST%") else (rmdir /s /q "%DEST%")

if exist "%DEST%" (
  echo [!] Could not remove it - After Effects is probably still open.
  goto :end
)
echo Removed the panel.

:data
if not exist "%DATA%" goto :done
echo.
echo LazyTyper keeps your saved presets and settings in
echo   %DATA%
echo Keep them if you might install LazyTyper again.
choice /c YN /m "Delete your presets and settings as well"
if errorlevel 2 goto :done
rmdir /s /q "%DATA%"
if exist "%DATA%" (
  echo [!] Could not remove it - close After Effects and try again.
) else (
  echo Removed your presets and settings.
)

:done
echo.
echo Typing rigs already in your projects keep working without the panel.

:end
echo.
pause
