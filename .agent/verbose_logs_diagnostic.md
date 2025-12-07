# Log Level Filter Issue - Diagnostic

## Issue: Verbose Logs Missing in Specialized Tabs

### Root Cause
The **log level filters** in the left panel (V, D, I, W, E buttons) apply to **ALL tabs**, including:
- Main Logs tab
- BLE tab
- NFC tab  
- DCK tab
- Kernel tab

### Why Verbose Logs Are Missing

If you don't see Verbose (V) logs in the DCK/BLE/NFC/Kernel tabs, it's because:

**The "V" (Verbose) button in the left panel filter section is deactivated.**

### How to Fix

1. **Check the left panel** - Look for the log level filter buttons (V, D, I, W, E)
2. **Click the "V" button** to activate Verbose logs
3. **The button should be highlighted** when active
4. **All tabs will now show Verbose logs**

### Visual Guide

```
Left Panel → Filter Section:
┌─────────────────────────────┐
│ Log Level Filters           │
│ ┌───┬───┬───┬───┬───┐      │
│ │ V │ D │ I │ W │ E │      │ ← Click "V" to enable Verbose
│ └───┴───┴───┴───┴───┘      │
│   ↑                         │
│   Make sure this is active  │
└─────────────────────────────┘
```

### Current Behavior (By Design)

- **Log level filters are GLOBAL** - they affect all tabs
- **This is intentional** - allows you to filter out noise across all views
- **Default state**: All levels (V, D, I, W, E) are active

### Alternative: Per-Tab Log Level Filters

If you want **independent log level filters for each tab**, we would need to:

1. Create separate `activeLogLevels` variables for each tab
2. Update each tab's filter UI to control its own levels
3. Modify `applyMainFilters` to accept a log levels parameter

**This would be a larger change.** Let me know if you want this feature.

### Quick Check

**To verify this is the issue:**

1. Open the app
2. Look at the left panel
3. Check if the "V" button is highlighted/active
4. If not, click it
5. Verbose logs should now appear in all tabs

### Default State

By default, all log levels should be active:
```javascript
activeLogLevels = new Set(['V', 'D', 'I', 'W', 'E']);
```

If Verbose is missing, it means:
- You (or the app) deactivated it at some point
- The state might be persisted in IndexedDB

### Reset Filters

To reset all filters to default:

1. Click the **"Clear & Reset"** button in the left panel
2. This will reset log levels to all active (V, D, I, W, E)
3. All tabs will show all log levels again

---

## Summary

**Issue**: Verbose logs missing in DCK/BLE/NFC/Kernel tabs  
**Cause**: "V" button in left panel is deactivated  
**Fix**: Click the "V" button to activate Verbose logs  
**Scope**: Log level filters are global and affect all tabs

---

**Is the "V" button active in your left panel?** If not, that's why Verbose logs are missing.

If the "V" button IS active and you still don't see Verbose logs, then there might be a different issue. Let me know!
