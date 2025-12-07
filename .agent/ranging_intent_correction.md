# Ranging Intent Correction

## Issue
The user corrected the terminology for `RKE_System_Event` (0x11) with Indicator `03`.
It should be labeled "Ranging Intent" instead of "Ranging Instruction".

## Fix
Updated `main.js` to use "Ranging Intent".

**Result:**
`031100020302` -> "Ranging Intent (Level: Medium)"
