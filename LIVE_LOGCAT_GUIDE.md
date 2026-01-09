# Live Logcat Streaming - User Guide

## Overview
The Live Logcat feature allows you to connect to an Android device via USB and stream logcat output directly in your browser, with real-time filtering and file capture capabilities.

## Browser Requirements
**Supported Browsers:**
- ✅ Chrome/Chromium (Desktop & Android) - v61+
- ✅ Microsoft Edge (Desktop) - v79+
- ✅ Opera (Desktop & Android) - v45+
- ❌ Firefox - Not supported (no WebUSB)
- ❌ Safari - Not supported (no WebUSB)

**Additional Requirements:**
- HTTPS connection (or localhost for development)
- USB debugging enabled on Android device
- Physical USB connection

## Setup

### 1. Enable USB Debugging on Android Device
1. Go to **Settings** → **About phone**
2. Tap **Build number** 7 times to enable Developer Options
3. Go to **Settings** → **Developer options**
4. Enable **USB debugging**
5. Connect device via USB cable

### 2. Open Application
1. Open the Android Log Viewer in a supported browser
2. Navigate to the sidebar
3. Look for the **📱 Live Logcat (USB)** section

## Usage

### Connecting to Device
1. Click **🔌 Connect Device** button
2. Browser will show a device picker dialog
3. Select your Android device from the list
4. Click **Connect**
5. Device info (model, Android version) will be displayed

### Starting Logcat Stream
1. Once connected, click **▶️ Start Logcat**
2. You'll be asked if you want to save logs to a file:
   - **OK**: Choose a file location (logs will be saved continuously)
   - **Cancel**: Stream without saving to file
3. Logs will start appearing in the main log view
4. Duration timer and line count will update in real-time

### Controlling the Stream
- **⏸️ Pause**: Stop displaying new logs (but continue capturing)
- **▶️ Resume**: Resume displaying logs
- **⏹️ Stop**: Stop streaming completely
- **💾 Save to File**: Save captured logs to a file
- **🗑️ Clear Buffer**: Clear the in-memory log buffer

### Filtering Live Logs
All existing filters work with live logs:
- **Log Level Filters**: Filter by Verbose, Debug, Info, Warn, Error, Fatal
- **Keyword Search**: Search for specific keywords
- **Time Range**: Filter by time range (for captured logs)

### Disconnecting
1. Click **Stop** if streaming
2. Click **Disconnect** button
3. Device will be safely disconnected

## Features

### Real-Time Filtering
- Logs are filtered in real-time as they arrive
- All existing filter options work seamlessly
- Auto-scroll keeps you at the bottom of the log stream

### File Capture
Two modes available:
1. **Continuous Save** (Chrome 86+):
   - Select file location once
   - Logs are written continuously to the file
   - File is automatically closed when you stop streaming

2. **Manual Save** (All browsers):
   - Click **💾 Save to File** at any time
   - Choose location and filename
   - Saves all captured logs to date

### Auto-Save
- Logs are automatically saved every 5 minutes (if file save is enabled)
- Prevents data loss during long captures

### Buffer Management
- Keeps last 50,000 lines in memory
- Older lines are automatically discarded
- Use **Clear Buffer** to reset manually

## File Naming
Saved files use the format: `logcat_YYYYMMDD_HHMMSS.txt`

Example: `logcat_20231223_193045.txt`

## Troubleshooting

### "WebUSB not supported" Warning
- You're using an unsupported browser (Firefox or Safari)
- Switch to Chrome, Edge, or Opera

### Device Not Appearing in Picker
- Ensure USB debugging is enabled
- Try a different USB cable
- Reconnect the device
- Check that no other ADB tools are running (Android Studio, adb command line)

### Connection Fails
- Make sure device is unlocked
- Accept the "Allow USB debugging" prompt on the device
- Try revoking USB debugging authorizations and reconnecting

### Logs Not Appearing
- Check that the device is actually generating logs
- Try opening an app on the device to generate activity
- Verify filters aren't hiding all logs

### Performance Issues
- Reduce the number of active filters
- Clear the buffer periodically
- Pause streaming when not actively monitoring

## Tips

### Best Practices
1. **Start with filters**: Set up your filters before starting the stream
2. **Use pause wisely**: Pause when you need to analyze specific logs
3. **Save regularly**: Use manual save for important captures
4. **Clear buffer**: Clear the buffer when switching to a new test scenario

### Common Use Cases
1. **Bug Reproduction**: Start streaming, reproduce the bug, stop and save
2. **Performance Monitoring**: Filter for specific tags, monitor in real-time
3. **Crash Analysis**: Capture logs leading up to a crash
4. **Feature Testing**: Monitor logs while testing a specific feature

## Limitations
- Only one device can be connected at a time
- Requires physical USB connection (no wireless ADB)
- Browser must remain open and active
- Large log volumes may impact browser performance

## Security & Privacy
- All processing happens locally in your browser
- No data is sent to external servers
- Device access requires explicit user permission
- Limited to ADB protocol only (no file system access)
