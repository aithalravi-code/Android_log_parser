# Architecture Overview

## System Design

Android Log Parser is a **client-side single-page application** (SPA) that processes Android logs entirely in the browser without requiring a backend server.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser (Main Thread)              │
├─────────────────────────────────────────────────────┤
│  UI Layer                                           │
│  ├── File Upload                                     │
│  ├── Tab Management (Logs, Stats, BTSnoop, CCC)    │
│  ├── Filtering Controls                             │
│  └── Export Functions                               │
├─────────────────────────────────────────────────────┤
│  State Management (AppState)                        │
│  ├── LogState                                        │
│  ├── FilterState                                     │
│  └── UIState                                         │
├─────────────────────────────────────────────────────┤
│  Core Logic                                          │
│  ├── FilterManager                                   │
│  ├── ExportManager                                   │
│  └── Tab Controllers                                 │
└─────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────┐
│              Web Workers (Background)                │
├─────────────────────────────────────────────────────┤
│  Log Parser Worker                                   │
│  └── Parses log lines, extracts metadata            │
├─────────────────────────────────────────────────────┤
│  Filter Worker                                       │
│  └── Applies filters without blocking UI            │
└─────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────┐
│               IndexedDB (Persistence)                │
│  └── Stores logs, filters, preferences              │
└─────────────────────────────────────────────────────┘
```

## Directory Structure

```
Production/src/
├── main.js                    # Application entry point
├── worker.js                  # Web Worker bootstrap
├── log_parser.html           # Main HTML file
│
├── core/                     # Core state management
│   └── state/
│       ├── AppState.js       # Central state container
│       ├── LogState.js       # Log data state
│       ├── FilterState.js    # Filter configuration
│       └── UIState.js        # UI-specific state
│
├── ui/                       # User interface
│   ├── tabs/
│   │   ├── BtsnoopTab.js    # BTSnoop packet viewer
│   │   ├── CccTab.js        # CCC Digital Key analyzer
│   │   ├── StatsTab.js      # Statistics dashboard
│   │   ├── ConnectivityTab.js
│   │   ├── DeviceEventsTab.js
│   │   └── BleKeysTab.js
│   ├── components/
│   │   └── VirtualList.js   # Virtual scrolling
│   ├── TooltipManager.js    # Tooltip system
│   └── colors.js            # Color constants
│
├── infra/                    # Infrastructure
│   ├── db.js                # IndexedDB operations
│   └── workers/
│       ├── logParser.worker.js  # Log parsing
│       └── filter.worker.js     # Filtering logic
│
├── filters/                  # Filtering system
│   └── FilterManager.js     # Filter orchestration
│
├── export/                   # Export functionality
│   └── ExportManager.js     # Excel/CSV export
│
├── utils/                    # Utilities
│   ├── logger.js            # Logging utility
│   ├── date.js              # Date parsing
│   ├── html.js              # HTML helpers
│   └── regex.js             # Regex patterns
│
├── table-sort.js            # Sortable tables
├── table-resize.js          # Resizable columns
├── styles.css               # Global styles
└── jszip.min.js            # ZIP processing
```

## Core Components

### 1. State Management

**AppState** (Singleton)
- Central state container following observer pattern
- Manages three state modules: Log, Filter, UI
- Provides reactive updates via `subscribe()`
- Immutable snapshots via `getSnapshot()`

```javascript
// Access global state
const appState = window._appState

// Subscribe to changes
appState.subscribe((snapshot) => {
    console.log('State changed:', snapshot)
})

// Update state
appState.filter.setKeywords(['error', 'warning'])
```

### 2. Web Workers

**Log Parser Worker**
- Parses raw log text into structured objects
- Extracts: timestamp, level, PID, TID, tag, message
- Identifies special log types (BTSnoop, CCC, Battery)
- Returns structured data to main thread

**Filter Worker**
- Applies filter criteria to log arrays
- Implements AND/OR keyword logic
- Time range filtering
- Returns filtered indices for virtual scrolling

### 3. Virtual Scrolling

Renders only visible log lines to handle large datasets:
- Calculates visible range based on scroll position
- Renders ~100 lines at a time
- Updates on scroll with debouncing
- Maintains smooth 60fps scrolling

### 4. IndexedDB Storage

Persistent client-side storage:
- **logs** store: Raw log data
- **filters** store: Saved filter presets
- **settings** store: User preferences
- **btsnoop** store: Cached packet data

## Data Flow

### File Upload Flow

```
User uploads file
    ↓
main.js reads file
    ↓
Send to logParser.worker.js
    ↓
Worker parses each line
    ↓
Return structured log objects
    ↓
Store in AppState.log
    ↓
Save to IndexedDB
    ↓
Render in UI (virtual scrolling)
```

### Filtering Flow

```
User changes filter
    ↓
Update AppState.filter
    ↓
Send config to filter.worker.js
    ↓
Worker filters log array
    ↓
Return filtered indices
    ↓
Update AppState.log.filteredIndices
    ↓
UI re-renders visible range
```

## Performance Optimizations

### 1. Web Workers
- Parsing and filtering in background threads
- Prevents UI blocking on large files
- Concurrent processing when possible

### 2. Virtual Scrolling
- Only renders visible DOM elements
- Handles millions of log lines
- Constant memory usage

### 3. Debouncing
- Filter input: 300ms delay
- Scroll events: 16ms (60fps)
- Search: 200ms delay

### 4. Lazy Loading
- Tabs load content on first view only
- Chart data computed on demand
- BTSnoop packets parsed incrementally

### 5. Efficient Data Structures
- Typed arrays for large datasets
- Map/Set for O(1) lookups
- Immutable snapshots prevent accidental mutations

## Build Process

### Development (Vite)
```
Source files (.js, .css)
    ↓
Vite dev server
    ↓
Hot Module Replacement (HMR)
    ↓
Browser with source maps
```

### Production (Single File)
```
Source files
    ↓
Vite build (Rollup)
    ↓
Bundle + Tree-shake
    ↓
Inline CSS/JS
    ↓
Single log_parser.html (562KB)
```

**Benefits of single-file build**:
- ✅ No CORS issues
- ✅ Works offline
- ✅ Easy deployment
- ✅ Fast loading (one request)

## Communication Patterns

### Main Thread ↔ Worker

**Post Message**
```javascript
// Main thread
worker.postMessage({
    type: 'PARSE_LOGS',
    lines: logLines
})

// Worker
self.onmessage = (e) => {
    if (e.data.type === 'PARSE_LOGS') {
        const parsed = parse(e.data.lines)
        self.postMessage({ type: 'PARSED', data: parsed })
    }
}
```

### State ↔ UI

**Observer Pattern**
```javascript
// UI subscribes to state changes
appState.subscribe((snapshot) => {
    if (snapshot.filter.version !== lastVersion) {
        reRenderLogs()
    }
})

// State notifies subscribers
class FilterState {
    setKeywords(keywords) {
        this.keywords = keywords
        this.version++
        this.notify()  // Triggers all subscribers
    }
}
```

## Security Considerations

### Client-Side Only
- ✅ No data sent to servers
- ✅ Files processed locally
- ✅ No authentication needed
- ⚠️ Limited to browser memory

### Input Validation
- File size limits (browser dependent)
- Content-type checking
- Sanitized HTML output (escapeHtml)
- No eval() or dangerous patterns

### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline'">
```

## Testing Architecture

### Unit Tests (Vitest)
- Test pure functions and classes
- Mock DOM and workers
- Fast execution (ms)
- Coverage: 72% functions

### E2E Tests (Playwright)
- Test full user workflows
- Real browser automation
- Slower execution (seconds)
- Coverage: DOM interactions

### Coverage Strategy
- **Unit tests**: Business logic, state, utils
- **E2E tests**: UI, integration, workflows
- **Combined**: ~70% total coverage

## Extension Points

### Adding a New Tab

1. Create tab file: `ui/tabs/MyTab.js`
2. Export `setup()` and `render()` functions
3. Register in `main.js` tab system
4. Add tab button in HTML
5. Add tests in `TestScripts/unit/`

### Adding a New Filter

1. Update `FilterState.js` with new property
2. Implement logic in `filter.worker.js`
3. Add UI controls in HTML
4. Update `FilterManager.js` coordination
5. Add tests covering new filter

### Adding New Log Parser

1. Add detection logic in `logParser.worker.js`
2. Create parser function
3. Return structured data format
4. Update display logic
5. Add test cases

## Deployment

### Static Hosting
- Output: Single HTML file
- Works on: GitHub Pages, Netlify, S3, etc.
- No server configuration needed

### CDN Considerations
- Gzip compression: 176KB (from 562KB)
- Browser caching: ETags, Cache-Control
- HTTPS: Required for modern features

---

For more details, see:
- [Developer Guide](DEVELOPER_GUIDE.md)
- [API Reference](API.md)
- [Testing Guide](TESTING.md)
