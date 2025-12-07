# UI Consistency and DCK/CCC Analysis

## 1. UI Consistency Updates
**Issue:** The user requested that other buttons (like Log Level filters) match the new "AND/OR" button style and have fixed alignment.
**Fix:** Updated `.filter-icon` and `.log-level-filters` in `styles.css` to use a segmented control style (pill-shaped, light gray container, clean buttons).
**Code Change:**
```css
/* styles.css */
.log-level-filters {
    display: inline-flex;
    /* ... */
    background: #f1f3f4;
    border-radius: 8px;
}
.filter-icon {
    /* ... */
    background: transparent;
    border: none;
    /* ... */
}
```

## 2. Digital Car Key (CCC) Analysis
**Issue:** The user wanted insights into DCK messages, specifically breaking down the payload into Message Type, Subtype, and Payload based on CCC structure.
**Fix:**
1.  **Worker Parsing:** Added regex and parsing logic to the worker script in `main.js` to extract `Sending/Received: [hex]` messages.
    *   Assumed structure: `Type (1 byte) | Subtype (1 byte) | Payload`.
2.  **Consolidation:** Updated `processFiles` to consolidate `cccMessages` from all workers.
3.  **Rendering:** Added a new "Digital Car Key (CCC) Analysis" card to the Stats tab in `index.html` and implemented `renderCccStats` in `main.js` to display the data in a table.

**Code Change:**
```javascript
// main.js (Worker)
const cccRegex = /(?:Sending|Received):\s*\[([0-9a-fA-F]+)\]/;
// ... parsing logic ...
cccMessages.push({ type, subtype, payload, ... });

// main.js (Main Thread)
function renderCccStats(messages) {
    // ... renders table with Type, Subtype, Payload ...
}
```
