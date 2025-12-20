# API Reference

Code structure and API documentation for Android Log Parser.

## Core Modules

### AppState

Central state container managing application state.

**Location**: `Production/src/core/state/AppState.js`

#### Constructor
```javascript
const appState = new AppState()
```

#### Methods

**`getSnapshot()`**
```javascript
const snapshot = appState.getSnapshot()
// Returns: { log: {...}, filter: {...}, ui: {...} }
```
Returns immutable snapshot of current state.

**`subscribe(callback)`**
```javascript
const unsubscribe = appState.subscribe((snapshot) => {
    console.log('State changed:', snapshot)
})
// Later: unsubscribe()
```
Subscribe to state changes. Returns unsubscribe function.

**`reset()`**
```javascript
appState.reset()
```
Resets all state modules to defaults.

**`logState()`**
```javascript
appState.logState()
```
Logs current state snapshot to console (debugging).

### LogState

Manages log data and filtered indices.

**Location**: `Production/src/core/state/LogState.js`

#### Properties
- `lines: Array` - All log lines
- `filteredIndices: Array` - Indices of visible logs
- `stats: Object` - Statistics (battery, CPU, etc.)

#### Methods

**`setLines(lines)`**
```javascript
appState.log.setLines(parsedLogs)
```
Sets the log lines array.

**`setFilteredIndices(indices)`**
```javascript
appState.log.setFilteredIndices([0, 2, 5, 8])
```
Updates which logs are visible.

**`reset()`**
```javascript
appState.log.reset()
```
Clears all log data.

### FilterState

Manages filter configuration.

**Location**: `Production/src/core/state/FilterState.js`

#### Properties
- `keywords: Array` - Active keyword filters
- `isAndLogic: Boolean` - AND vs OR for keywords
- `activeLogLevels: Set` - Enabled log levels (V/D/I/W/E)
- `liveSearchQuery: String` - Live search text
- `timeRange: Object` - Start/end timestamps
- `version: Number` - Increments on changes

#### Methods

**`setKeywords(keywords)`**
```javascript
appState.filter.setKeywords(['error', 'crash'])
```

**`toggleLogLevel(level)`**
```javascript
appState.filter.toggleLogLevel('E')  // Toggle errors
```

**`setLiveSearchQuery(query)`**
```javascript
appState.filter.setLiveSearchQuery('bluetooth')
```

**`setTimeRange(start, end)`**
```javascript
appState.filter.setTimeRange('12:00:00', '13:00:00')
```

### UIState

Manages UI-specific state.

**Location**: `Production/src/core/state/UIState.js`

#### Properties
- `activeTab: String` - Current tab ID
- `isLoading: Boolean` - Loading state
- `tabsLoaded: Object` - Which tabs have loaded
- `collapseState: Object` - Collapsed sections

#### Methods

**`setActiveTab(tabId)`**
```javascript
appState.ui.setActiveTab('logsTab')
```

**`setLoading(isLoading)`**
```javascript
appState.ui.setLoading(true)
```

**`markTabLoaded(tabId)`**
```javascript
appState.ui.markTabLoaded('statsTab')
```

**`toggleCollapse(view, headerText)`**
```javascript
appState.ui.toggleCollapse('logView', 'file.log')
```

## UI Components

### Tab Modules

All tabs export these functions:

**`setup(data)`**
```javascript
import { setup } from './ui/tabs/StatsTab.js'
setup(appState.getSnapshot())
```
Initializes the tab with data.

**`render(data)`**
```javascript
import { render } from './ui/tabs/StatsTab.js'
render(statsData)
```
Renders the tab content.

**`reset()`**
```javascript
import { reset } from './ui/tabs/StatsTab.js'
reset()
```
Clears tab state.

### Specific Tabs

#### StatsTab
**Location**: `Production/src/ui/tabs/StatsTab.js`

**`processForDashboardStats(lines)`**
```javascript
const stats = processForDashboardStats(logLines)
// Returns: { cpuData, batteryData, tempData, ... }
```

#### BtsnoopTab
**Location**: `Production/src/ui/tabs/BtsnoopTab.js`

**`processForBtsnoop(lines, filename, rawFileContent)`**
```javascript
const packets = processForBtsnoop(lines, 'capture.cfa', buffer)
// Returns: { packets: [], connectionEvents: [] }
```

#### CccTab
**Location**: `Production/src/ui/tabs/CccTab.js`

**Constants exported**:
```javascript
import { CCC_CONSTANTS } from './ui/tabs/CccTab.js'
console.log(CCC_CONSTANTS.MESSAGE_TYPES)
```

## Workers

### Log Parser Worker

**Location**: `Production/src/infra/workers/logParser.worker.js`

#### Messages

**Parse request**:
```javascript
worker.postMessage({
    type: 'PARSE',
    lines: ['log line 1', 'log line 2'],
    filename: 'log.txt'
})
```

**Parse response**:
```javascript
{
    type: 'PARSED',
    logs: [
        { timestamp, level, pid, tid, tag, message },
        ...
    ],
    stats: { batteryData, cpuData, ... }
}
```

### Filter Worker

**Location**: `Production/src/infra/workers/filter.worker.js`

#### Messages

**Filter request**:
```javascript
worker.postMessage({
    type: 'FILTER',
    lines: logArray,
    config: {
        activeKeywords: ['error'],
        isAndLogic: false,
        activeLogLevels: new Set(['E', 'W']),
        timeRange: { start: null, end: null }
    }
})
```

**Filter response**:
```javascript
{
    type: 'FILTERED',
    filteredIndices: [0, 5, 12, ...]
}
```

## Utilities

### Logger

**Location**: `Production/src/utils/logger.js`

```javascript
import Logger from './utils/logger.js'

const logger = new Logger('MyModule', true) // name, isDev

logger.log('Message')
logger.info('Info')
logger.warn('Warning')
logger.error('Error')
logger.group('Group', () => {
    logger.log('Inner message')
})
logger.table([{ a: 1 }, { a: 2 }])
logger.time('operation')
logger.timeEnd('operation')
```

### Date Utilities

**Location**: `Production/src/utils/date.js`

**`parseTimestamp(timestampStr)`**
```javascript
import { parseTimestamp } from './utils/date.js'

const date = parseTimestamp('12-17 16:30:00.123')
// Returns: Date object
```

**`formatTimestamp(date)`**
```javascript
import { formatTimestamp } from './utils/date.js'

const str = formatTimestamp(new Date())
// Returns: '12-17 16:30:00.123'
```

### HTML Utilities

**Location**: `Production/src/utils/html.js`

**`escapeHtml(unsafe)`**
```javascript
import { escapeHtml } from './utils/html.js'

const safe = escapeHtml('<script>alert("xss")</script>')
// Returns: '&lt;script&gt;alert("xss")&lt;/script&gt;'
```

**`formatParam(label, value)`**
```javascript
import { formatParam } from './utils/html.js'

const html = formatParam('Interval', '0x0018 (30ms)')
// Returns: HTML with styled param
```

## Infrastructure

### Database (IndexedDB)

**Location**: `Production/src/infra/db.js`

**`saveData(key, data)`**
```javascript
import { saveData } from './infra/db.js'

await saveData('logs', logArray)
```

**`loadData(key)`**
```javascript
import { loadData } from './infra/db.js'

const logs = await loadData('logs')
// Returns: Stored data or null
```

**`clearData()`**
```javascript
import { clearData } from './infra/db.js'

await clearData()  // Clears all stores
```

### FilterManager

**Location**: `Production/src/filters/FilterManager.js`

**`applyMainFilters(lines, config)`**
```javascript
import { applyMainFilters } from './filters/FilterManager.js'

const filtered = applyMainFilters(logLines, {
    keywords: ['error'],
    logLevels: new Set(['E']),
    liveSearchQuery: '',
    timeRange: null,
    collapsedHeaders: new Set()
})
// Returns: Filtered log array
```

### ExportManager

**Location**: `Production/src/export/ExportManager.js`

**`exportToExcel(data, filename)`**
```javascript
import { exportToExcel } from './export/ExportManager.js'

exportToExcel(logArray, 'export.xlsx')
// Downloads Excel file
```

## Table Utilities

### table-sort.js

**`makeSortable(tableId, defaultColumn, defaultOrder)`**
```javascript
import { makeSortable } from './table-sort.js'

makeSortable('myTable', 0, 'desc')
```

### table-resize.js

**`makeTableResizable(tableId)`**
```javascript
import { makeTableResizable } from './table-resize.js'

makeTableResizable('myTable')
```

## Constants

### Log Levels
```javascript
const LOG_LEVELS = {
    V: 'Verbose',
    D: 'Debug',
    I: 'Info',
    W: 'Warning',
    E: 'Error'
}
```

### Log Line Regex
```javascript
// Matches: MM-DD HH:MM:SS.mmm PID TID L TAG : Message
const LOG_LINE_REGEX = /^(\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+([^:]+):\s*(.*)$/
```

## Events

### Custom Events

**State change**:
```javascript
document.addEventListener('stateChange', (e) => {
    console.log('State updated:', e.detail)
})
```

**Filter applied**:
```javascript
document.addEventListener('filterApplied', (e) => {
    console.log('Filter config:', e.detail)
})
```

## Global Objects

### window._appState
```javascript
// Globally accessible state instance
const state = window._appState.getSnapshot()
```

### window.selectedTableRows
```javascript
// Map of table IDs to selected row IDs
const selectedRow = window.selectedTableRows.get('myTable')
```

---

For usage examples, see [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md).
For architecture, see [ARCHITECTURE.md](ARCHITECTURE.md).
