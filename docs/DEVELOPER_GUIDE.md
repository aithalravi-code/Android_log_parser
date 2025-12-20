# Developer Guide

Complete guide for developers working on Android Log Parser.

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Git
- Modern browser (Chrome recommended for debugging)
- Code editor (VS Code recommended)

### Initial Setup
```bash
git clone https://github.com/aithalravi-code/Android_log_parser.git
cd Android_log_parser
npm install
npm run dev  # Start at http://localhost:5173
```

## Development Workflow

### 1. Development Server
```bash
npm run dev
```
- Runs Vite dev server on port 5173
- Hot Module Replacement (HMR) enabled
- Source maps for debugging
- Fast refresh on file changes

### 2. Building
```bash
npm run build
```
- Bundles to single `dist/log_parser.html` file
- Minification and tree-shaking
- Inlines all CSS/JS
- Production-ready output (562KB)

### 3. Testing
```bash
npm run test          # All tests
npm run test:unit     # Unit tests only
npm run test:regression  # E2E tests
npm run coverage      # With coverage report
```

## Code Organization

### State Management Pattern

**AppState** follows singleton + observer pattern:

```javascript
// Get global state instance
const appState = window._appState

// Read state (immutable snapshot)
const snapshot = appState.getSnapshot()
console.log(snapshot.filter.keywords)

// Update state (triggers subscribers)
appState.filter.setKeywords(['error', 'crash'])

// Subscribe to changes
appState.subscribe((newSnapshot) => {
    console.log('State updated:', newSnapshot)
})
```

**Three state modules**:
1. **LogState** - Log data, filtered indices
2. **FilterState** - Filter configuration, version tracking
3. **UIState** - Tab state, collapse state, loading flags

### Web Worker Communication

**Main Thread → Worker**:
```javascript
const worker = new Worker('./worker.js')
worker.postMessage({
    type: 'PARSE_LOGS',
    lines: logLines
})

worker.onmessage = (e) => {
    if (e.data.type === 'PARSED') {
        handleParsedLogs(e.data.logs)
    }
}
```

**Worker → Main Thread**:
```javascript
// In worker.js
self.onmessage = (e) => {
    if (e.data.type === 'PARSE_LOGS') {
        const parsed = parseLines(e.data.lines)
        self.postMessage({
            type: 'PARSED',
            logs: parsed
        })
    }
}
```

### Adding a New Tab

**1. Create tab module** (`Production/src/ui/tabs/MyTab.js`):
```javascript
export function setup(data) {
    console.log('[MyTab] Setup called')
    // Initialize tab, set up event listeners
}

export function render(data) {
    console.log('[MyTab] Rendering')
    const container = document.getElementById('myTabContainer')
    container.innerHTML = generateHTML(data)
}

export function reset() {
    // Clear state when tab is reset
}
```

**2. Register in main.js**:
```javascript
import * as MyTab from './ui/tabs/MyTab.js'

// In tab click handler
if (tabId === 'myTab') {
    MyTab.setup(appState.getSnapshot().log.lines)
}
```

**3. Add HTML** (in `log_parser.html`):
```html
<div id="myTab" class="tab-content">
    <div id="myTabContainer"></div>
</div>
```

**4. Add tests** (`TestScripts/unit/my_tab.test.js`):
```javascript
import { describe, it, expect } from 'vitest'
import { setup, render } from '../../Production/src/ui/tabs/MyTab.js'

describe('MyTab', () => {
    it('should setup correctly', () => {
        setup([])
        expect(document.getElementById('myTabContainer')).toBeDefined()
    })
})
```

### Adding a New Filter

**1. Update FilterState** (`core/state/FilterState.js`):
```javascript
class FilterState {
    constructor() {
        this.myNewFilter = ''
    }
    
    setMyNewFilter(value) {
        this.myNewFilter = value
        this.version++
        this.notify()
    }
}
```

**2. Implement in worker** (`infra/workers/filter.worker.js`):
```javascript
function runFilter(lines, config) {
    return lines.filter(line => {
        // Apply new filter
        if (config.myNewFilter && !line.includes(config.myNewFilter)) {
            return false
        }
        return true
    })
}
```

**3. Add UI control** (in HTML):
```html
<input type="text" id="myNewFilterInput" placeholder="My Filter">
```

**4. Wire up** (in main.js):
```javascript
document.getElementById('myNewFilterInput').addEventListener('input', (e) => {
    appState.filter.setMyNewFilter(e.target.value)
})
```

## Key Patterns

### Virtual Scrolling

Renders only visible rows:

```javascript
function renderVisibleRows(scrollTop, containerHeight) {
    const rowHeight = 24
    const startIndex = Math.floor(scrollTop / rowHeight)
    const endIndex = startIndex + Math.ceil(containerHeight / rowHeight)
    
    const visibleRows = allRows.slice(startIndex, endIndex)
    tbody.innerHTML = visibleRows.map(row => renderRow(row)).join('')
}
```

### Debouncing

Prevents excessive updates:

```javascript
let debounceTimer
function debounce(fn, delay) {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(fn, delay)
}

// Usage
searchInput.addEventListener('input', (e) => {
    debounce(() => {
        applySearch(e.target.value)
    }, 300)
})
```

### IndexedDB Operations

```javascript
import { saveData, loadData, clearData } from './infra/db.js'

// Save
await saveData('logs', logArray)

// Load
const logs = await loadData('logs')

// Clear
await clearData()
```

## Debugging

### Browser DevTools

**State inspection**:
```javascript
// In console
_appState.getSnapshot()
_appState.log.lines.length
_appState.filter.keywords
```

**Force reload**:
```javascript
location.reload()
```

**Clear IndexedDB**:
```javascript
clearData()
```

### Source Maps

Dev mode includes source maps for debugging original code.

### Performance Profiling

Use Chrome DevTools Performance tab:
1. Start recording
2. Trigger action (e.g., filter)
3. Stop recording
4. Analyze flame chart

## Common Tasks

### Update Dependencies
```bash
npm update
npm audit fix
```

### Add New Dependency
```bash
npm install package-name
```

For production dependency:
```bash
npm install --save package-name
```

### Code Formatting

Use Prettier (if configured):
```bash
npx prettier --write "Production/src/**/*.js"
```

### Linting

Use ESLint (if configured):
```bash
npx eslint Production/src
```

## Performance Tips

### 1. Use Web Workers
Move heavy processing off main thread:
- Parsing
- Filtering
- Data transformation

### 2. Virtual Scrolling
Don't render all rows:
- Render visible + buffer
- Update on scroll
- Reuse DOM elements

### 3. Debounce User Input
Delay expensive operations:
- Search: 300ms
- Filter: 200ms
- Resize: 100ms

### 4. Lazy Load
Load data on demand:
- Tab content when first viewed
- Charts when visible
- Export when requested

### 5. Efficient Data Structures
- Use Map/Set for lookups
- Typed arrays for large datasets
- Immutable snapshots prevent bugs

## Security Considerations

### Input Sanitization
Always escape HTML:
```javascript
import { escapeHtml } from './utils/html.js'

const safe = escapeHtml(userInput)
element.innerHTML = safe
```

### No eval()
Never use `eval()` or `Function()` constructor with user data.

### Content Security Policy
Single-file build has inline scripts, so CSP needs `unsafe-inline`.

## Build Configuration

### Vite Config (`vite.config.js`)

```javascript
export default defineConfig({
    build: {
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            },
        },
    },
    plugins: [
        viteSingleFile(), // Bundle to single HTML
    ],
})
```

## Troubleshooting

### Dev Server Won't Start
```bash
# Clear cache
rm -rf node_modules/.vite
npm install
```

### Tests Failing
```bash
# Clear test cache
npm run test -- --clearCache
```

### Build Issues
```bash
# Clean build
rm -rf dist
npm run build
```

### Worker Not Loading
- Check worker path is correct
- Ensure worker file has no syntax errors
- Check browser console for errors

## Release Checklist

Before releasing:
- [ ] All tests pass
- [ ] Coverage meets thresholds
- [ ] Build succeeds
- [ ] Manual testing complete
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json

## Resources

- [Vite Docs](https://vitejs.dev/)
- [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [IndexedDB Guide](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Chart.js Docs](https://www.chartjs.org/docs/)

---

For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md).
For testing, see [TESTING.md](TESTING.md).
