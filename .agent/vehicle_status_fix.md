# Vehicle Status Decoding Fix (Category 0x04)

## Issue
The user reported that `Vehicle Status` (DK Event Category 04) events were not being parsed, showing raw data instead. This was due to:
1.  Missing explicit handler for Category 04.
2.  The default fallback logic checking for TLV markers (`startsWith('7F')`) failed because the input data was lowercase.

## Fix
1.  **Explicit Handler**: Added specific logic for `category === '04'` to use `parseTLV` with `RKE_TAGS`.
2.  **Case-Insensitive Check**: Updated the default fallback logic to convert data to uppercase before checking for `7F` or `30` prefixes.

**Result:**
Vehicle Status messages (e.g., `7f72...`) are now correctly parsed into their TLV components (e.g., `Function_Status_Response`, `Function_ID`, etc.).
