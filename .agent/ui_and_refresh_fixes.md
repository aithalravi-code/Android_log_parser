# UI Improvements and Refresh Fixes

## 1. Cleaned up "Filter by Level" Buttons
**Issue:** The level filter buttons were not arranged cleanly.
**Fix:** Applied a flexbox layout with wrapping and gap to `.log-level-filters` in `styles.css`.
**Code Change:**
```css
.log-level-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 1rem;
}
```

## 2. Improved "OR" and "AND" Buttons
**Issue:** The logic buttons looked "odd" and "in a box".
**Fix:** Redesigned the buttons to look like a modern segmented control (pill-shaped, light gray background, white active state with shadow).
**Code Change:**
```css
.logic-toggle {
    display: inline-flex;
    background: #f1f3f4;
    border-radius: 8px;
    padding: 2px;
}
/* ... updated .logic-btn styles ... */
```

## 3. Fixed Data Refresh on Other Tabs
**Issue:** Data on other tabs (BLE, NFC, DCK) was not re-rendering correctly when filters changed or on refresh.
**Fix:** Updated `refreshActiveTab` in `main.js` to call `apply*Filters()` instead of just `render*VirtualLogs()`. This ensures that filters are re-applied to the source data before rendering.
**Code Change:**
```javascript
// main.js
case 'ble':
    if (!bleScrollListenerAttached) setupBleTab(); else applyBleFilters();
    break;
// ... same for 'nfc' and 'dck' ...
```
