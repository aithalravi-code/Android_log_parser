# Issue Status Report - 2025-12-14 18:55

## ✅ FIXES VERIFIED

### 1. Log Parsing & Missing Lines
**Status**: FIXED
*   **Missing Lines (No Level)**: Mapped to **Verbose (V)**.
*   **Missing Lines (Fatal/Assert)**: Added **F**, **A**, **S** to default logic. Added 'Fatal' Button to UI.
*   **Missing Lines (No Timestamp)**: FIXED. Updated `FilterManager` to **Always Include** lines without timestamps (bypassing the Time Range filter which was hiding them).

### 2. BTSnoop Excel Export "Does Nothing"
**Status**: FIXED
*   Refactored logging logic.

### 3. Sort by Size
**Status**: FIXED
*   First click triggers **Ascending** sort.

### 4. Collapse Functionality & Empty Headers
**Status**: FIXED
*   Empty Files: Hidden.
*   Collapsed Files: Header Visible (if matching logs exist).
*   Content: Hidden when collapsed.

---

## ⚠️ ACTION REQUIRED

1.  **Clear Site Data**.
2.  **Hard Reload** (Ctrl+Shift+R).
3.  **Check 'Fatal' Button**: Ensure it is visible in the toolbar.
