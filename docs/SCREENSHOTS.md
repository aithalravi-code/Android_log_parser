# Screenshot Guide

This guide helps capture screenshots for documentation.

## Required Screenshots

### 1. Main Interface
**File**: `docs/images/main-interface.png`
- Show file upload area
- Display parsed logs with different levels colored
- Include filter panel
- Show tab navigation

**How to capture**:
1. Open `http://localhost:5173/log_parser.html`
2. Upload a sample log file (use `TestData/`)
3. Take full-window screenshot
4. Save as `docs/images/main-interface.png`

### 2. Filtering in Action
**File**: `docs/images/filtering.png`
- Show keyword filter with multiple terms
- Display level filter buttons (some active, some inactive)
- Show filtered results
- Include search box with text

**How to capture**:
1. Load logs
2. Apply filters (e.g., keywords: "error, warning", levels: E+W)
3. Screenshot the filter panel + results
4. Save as `docs/images/filtering.png`

### 3. BTSnoop Analysis
**File**: `docs/images/btsnoop.png`
- Show BTSnoop tab
- Display packet table with various types
- Show connection events table
- Include some selected rows

**How to capture**:
1. Upload BTSnoop file from `TestData/btsnoop/`
2. Switch to BTSnoop tab
3. Screenshot the full tab
4. Save as `docs/images/btsnoop.png`

### 4. Statistics Dashboard
**File**: `docs/images/stats.png`
- Show CPU chart with data
- Battery level chart
- Temperature chart
- App versions table

**How to capture**:
1. Upload bugreport with stats
2. Go to Stats tab
3. Wait for charts to render
4. Screenshot showing charts
5. Save as `docs/images/stats.png`

### 5. CCC Digital Key
**File**: `docs/images/ccc.png`
- Show CCC tab
- Display decoded messages
- Show parameter formatting with units
- Include column filters

**How to capture**:
1. Upload CCC log file
2. Go to CCC tab
3. Screenshot message table
4. Save as `docs/images/ccc.png`

### 6. Export Dialog
**File**: `docs/images/export.png`
- Show export button
- Display exported Excel file preview (optional)

**How to capture**:
1. Click export button
2. Screenshot the file save dialog
3. Save as `docs/images/export.png`

## Using Screenshots in Documentation

### Markdown Syntax
```markdown
![Main Interface](images/main-interface.png)
```

### With Caption
```markdown
**Figure 1: Main log viewer interface**

![Main Interface](images/main-interface.png)

The main interface shows parsed Android logs with color-coded levels and powerful filtering options.
```

### In Tables
```markdown
| Feature | Preview |
|---------|---------|
| **Log Filtering** | ![Filtering](images/filtering.png) |
| **BTSnoop** | ![BTSnoop](images/btsnoop.png) |
```

## Screenshot Tools

### Browser Built-in
- **Chrome**: F12 → Device Toolbar → Capture Screenshot
- **Firefox**: F12 → Screenshot button
- **Edge**: F12 → Device Emulation → Capture Screenshot

### OS Tools
- **Windows**: Windows + Shift + S
- **macOS**: Cmd + Shift + 4
- **Linux**: Screenshot tool (varies by DE)

### Browser Extensions
- **Awesome Screenshot**
- **Nimbus Screenshot**
- **GoFullPage** (for full-page captures)

## Optimization

After capturing, optimize images:

```bash
# Install imagemagick if needed
# sudo apt install imagemagick

# Resize large screenshots
convert main-interface.png -resize 1200x main-interface.png

# Compress PNG
pngquant --quality=80-90 main-interface.png

# Convert to WebP for better compression
convert main-interface.png main-interface.webp
```

## Automation (Optional)

Use Playwright to auto-capture screenshots:

```javascript
// TestScripts/screenshots/capture.js
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })

await page.goto('http://localhost:5173/log_parser.html')

// Upload file
await page.setInputFiles('#logFilesInput', 'TestData/sample.log')
await page.waitForSelector('.log-line')

// Capture
await page.screenshot({ path: 'docs/images/main-interface.png', fullPage: true })

await browser.close()
```

## Checklist

Once screenshots are captured, update:
- [ ] README.md - Add screenshots section
- [ ] docs/USER_GUIDE.md - Embed relevant screenshots
- [ ] docs/ARCHITECTURE.md - Add architecture diagrams
- [ ] Commit and push images

## Tips

✅ **DO**:
- Use consistent window size (1920x1080 recommended)
- Show realistic data (not empty screens)
- Include UI context (don't crop too tightly)
- Use dark/light mode consistently
- Compress images before committing

❌ **DON'T**:
- Include sensitive data in logs
- Use blurry or low-resolution images
- Show error states (unless documenting errors)
- Mix different UI themes
- Commit huge uncompressed images
