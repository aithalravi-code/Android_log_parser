# Fixes for Log Display and UI Formatting

## 1. Missing UID in Log Display
**Issue:** The log viewer was not displaying the UID (the 3rd value in the user's log format), only PID and TID.
**Fix:** Updated `renderVirtualLogs` in `main.js` to include the UID if it exists in the parsed log line, appending it after PID-TID.
**Code Change:**
```javascript
// main.js
<span class="log-pid-tid" style="color: ${pidColor};">${line.pid || ''}${line.tid ? '-' + line.tid : ''}${line.uid ? ' ' + line.uid : ''}</span>
```

## 2. "AND" Button Formatting
**Issue:** The "AND" logic button in the filter section was reported as not formatted correctly.
**Fix:** 
- Added `user-select: none` to prevent text selection on the buttons.
- Added a left border to the second button (`.logic-btn + .logic-btn`) to create a visual separator between "OR" and "AND", improving the segmented control look.
**Code Change:**
```css
/* styles.css */
.logic-btn {
    /* ... */
    user-select: none;
}

.logic-btn + .logic-btn {
    border-left: 1px solid #dadce0;
}
```
