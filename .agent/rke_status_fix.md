# RKE Status Text Interpretation

## Issue
The user requested text interpretations for numeric status codes in `Vehicle Status` messages (Tag 0x83). For example, `Status: 00` should indicate "Unlocked" for Central Locking logic.

## Fix
1.  **Added `RKE_STATUS_MAP`**:
    *   Defined a mapping for common Function IDs (Central Locking, Windows, Driving Readiness, Engine).
    *   Example: `0001` (Central Locking) -> `00`: Unlocked, `01`: Locked.
    *   Example: `0010` (Driving Readiness) -> `01`: Ready.
    *   Included a default fallback for unknown functions.
2.  **Updated `parseTLV`**:
    *   Added context tracking variable `currentFunctionId`.
    *   When Tag `80` (Function ID) is parsed, its value is stored.
    *   When Tag `83` (Status) is parsed, the code looks up the text description using `currentFunctionId` and the Status value.
    *   The output format is now `Value (Description)` (e.g., `01 (Locked)`).

**Result:**
Vehicle Status messages now provide human-readable descriptions for their status codes, significantly improving data comprehensibility.
