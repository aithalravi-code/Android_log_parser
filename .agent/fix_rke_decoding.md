# Fix for RKE System Event Decoding

## Issue
The user reported incorrect decoding for `RKE_System_Event` (0x11).
The parser was interpreting the length bytes (`00 18`) as part of the payload, causing the Indicator to be read as `00` instead of `04`, and the TLV parsing to start at the wrong offset.

## Fix
Updated `decodePayload` in `main.js` to skip the first 2 bytes (4 hex characters) of the payload string for Type 0x03 messages.
This accounts for the 2-byte Length field that is included in the raw payload string extracted by the worker.

**Result:**
*   Input: `03110018047f72...`
*   Old Output: `Ind: 0x00, Tag_18: ...` (Incorrect)
*   New Output: `Ind: 0x04, Function_Status_Response: { ... }` (Correct)
