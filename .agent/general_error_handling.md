# General Error Handling (RKE)

## Issue
The user identified `031100020180` as a "General Error" message, which was not being parsed correctly.
It corresponds to `RKE_System_Event` (0x11) with Indicator `01`.

## Fix
Updated `main.js` to specifically handle Indicator `01` in `RKE_System_Event`:
*   Decodes as "General Error".
*   Displays the accompanying data (e.g., `80`) as "Data: 0x...".

**Result:**
`031100020180` -> "General Error (Data: 0x80)"
