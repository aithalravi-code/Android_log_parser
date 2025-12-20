# User Guide

Complete guide to using the Android Log Parser web application.

## Table of Contents
- [Getting Started](#getting-started)
- [File Upload](#file-upload)
- [Log Viewer](#log-viewer)
- [Filtering](#filtering)
- [Statistics](#statistics)
- [BTSnoop Analysis](#btsnoop-analysis)
- [CCC Digital Key](#ccc-digital-key)
- [Exporting](#exporting)
- [Tips & Tricks](#tips--tricks)

## Getting Started

### Access the App
Visit [https://aithalravi-code.github.io/Android_log_parser/](https://aithalravi-code.github.io/Android_log_parser/)

No installation required - works entirely in your browser!

### Supported Browsers
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## File Upload

### Drag and Drop
1. Drag your log file onto the upload area
2. Or click to browse and select file
3. Wait for parsing (progress shown)

### Supported Files
| Type | Extensions | Description |
|------|------------|-------------|
| **Logcat** | `.log`, `.txt` | Android system logs |
| **BTSnoop** | `.cfa`, `.log` | Bluetooth captures |
| **Bugreport** | `.zip` | Full Android bugreports |

### File Size Limits
- **Recommended**: Up to 100MB
- **Maximum**: Depends on browser (typically 500MB)
- Large files may take time to parse

## Log Viewer

### Main View
Once uploaded, logs appear in a scrollable list with:
- **Timestamp** - When the log occurred
- **Level** - V/D/I/W/E (Verbose/Debug/Info/Warning/Error)
- **Tag** - Component that logged the message
- **Message** - Log content

### Color Coding
- 🔴 **Error (E)** - Red
- 🟡 **Warning (W)** - Yellow
- 🔵 **Info (I)** - Blue
- 🟢 **Debug (D)** - Green
- ⚪ **Verbose (V)** - Gray

### Table Features
- **Sortable** - Click column headers to sort
- **Resizable** - Drag column dividers to resize
- **Copyable** - Click any cell to copy content
- **Virtual Scrolling** - Smooth even with millions of lines

## Filtering

### Log Level Filter
Click level buttons (V/D/I/W/E) to toggle visibility:
- **Green** = Shown
- **Gray** = Hidden
- Shows only logs matching selected levels

### Keyword Filter

#### Single Keyword
```
error
```
Shows all lines containing "error"

#### Multiple Keywords (OR)
```
error, warning, fail
```
Shows lines with ANY of these words

#### Multiple Keywords (AND)
Select "AND logic" toggle:
```
bluetooth + error
```
Shows only lines with BOTH "bluetooth" AND "error"

#### Wildcards
```
sensor*
```
Matches: sensor, sensors, sensorManager, etc.

### Live Search
Type in the search box for instant filtering across all columns.

### Time Range Filter
1. Click the time range icon
2. Select start time
3. Select end time  
4. Apply filter

Logs outside this range are hidden.

### Collapsible Sections
Click file headers to collapse/expand sections.

## Statistics

Navigate to **Stats** tab for dashboard with:

### Charts
- **CPU Usage** - Load percentage over time
- **Battery Level** - Percentage timeline
- **Temperature** - Device thermal data
- **Memory** - RAM usage (if available)

### Interaction
- **Zoom** - Mouse wheel or pinch
- **Pan** - Click and drag
- **Hover** - See exact values

### App Versions
Table showing:
- Package name
- Version code/name
- Installation source

## BTSnoop Analysis

For Bluetooth HCI captures:

### Packet Table
- **Time** - Packet timestamp
- **Direction** - Sending/Receiving
- **Type** - Command/Event/ACL
- **Data** - Hex dump

### Connection Events
Special table for connection parameters:
- Connection Handle
- BD_ADDR (Bluetooth Address)
- Interval, Latency, Timeout
- Role (Central/Peripheral)

### Filtering
- Filter by packet type
- Search by BD_ADDR
- Time range selection

### Export
Click **Export** to download as Excel with all packets.

## CCC Digital Key

For Car Connectivity Consortium logs:

### Message Table
- **Message Category** - Framework/SE/UWB/etc.
- **Message Type** - Specific command/event
- **Parameters** - Decoded values with units
- **Raw Data** - Hex payload

### Parameter Decoding
Automatic conversion to human-readable:
- **Time values** → µs (microseconds)
- **PPM** → ±XX ppm
- **Retry delays** → ms (milliseconds)

### Column Filtering
Type in column filter boxes to narrow results.

## Exporting

### Excel Export
1. Filter logs as desired
2. Click **Export to Excel**
3. Choose location to save
4. File includes all visible logs

### Format
Exported Excel contains columns:
- Timestamp
- Level
- PID/TID
- Tag
- Message

### Copy to Clipboard
Click any log line to copy its text.

## Tips & Tricks

### Performance
- **Large files**: Filter early to reduce displayed logs
- **Slow scrolling**: Clear unnecessary filters
- **Memory**: Reload page if browser slows down

### Keyboard Shortcuts
- `Ctrl+F` - Focus search box
- `Esc` - Clear search
- `Ctrl+A` - Select all (in tables)

### Workflow Examples

#### Debug App Crash
1. Upload log file
2. Filter to **Error** level only
3. Search for your app's package name
4. Look for exception stack traces

#### Analyze Bluetooth Issue
1. Upload BTSnoop file
2. Go to BTSnoop tab
3. Search for device BD_ADDR
4. Check connection events table
5. Export for detailed analysis

#### Monitor Performance
1. Upload bugreport
2. Go to Stats tab
3. Check CPU/Battery charts
4. Look for spikes or anomalies

### Common Issues

**"File too large"**
- Split file into smaller chunks
- Use more powerful computer/browser
- Try Chrome (best performance)

**"Nothing appears"**
- Check file format is correct
- Ensure log has valid timestamp format
- Look in browser console for errors

**"Slow performance"**
- Filter logs to reduce visible count
- Close other browser tabs
- Try incognito mode

### Privacy & Security
- ✅ All processing happens in your browser
- ✅ No data sent to servers
- ✅ Files stay on your computer
- ✅ Can use offline (after first load)

## Advanced Features

### IndexedDB Storage
Logs are saved locally for quick reload:
- Persists across sessions
- Click "Clear Data" to remove

### URL Parameters
Share specific views:
```
?file=log.txt&filter=error&level=EW
```

### Developer Console
Access advanced debugging:
```javascript
// Check app state
window._appState.getSnapshot()

// Force re-render
window.location.reload()
```

---

**Need help?** [Open an issue](https://github.com/aithalravi-code/Android_log_parser/issues) or check the [FAQ](FAQ.md).
