# Function ID Correction

## Issue
The user pointed out that Function ID `0010h` was incorrectly mapped to `Window_Control`.
The correct mapping is `Driving Readiness`.

## Fix
Updated `FUNCTION_IDS` in `main.js`:
*   Changed `0010` from `Window_Control` to `Driving_Readiness`.

**Result:**
Payloads containing `Function_ID: 0010` will now display as `0010 (Driving_Readiness)`.
