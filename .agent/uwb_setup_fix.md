# UWB Session Setup & RS Length Fix

## Issue
The user pointed out that `Ranging_Session_RS`, `Ranging_Session_Setup_RQ`, and `Ranging_Session_Setup_RS` were not handling the 2-byte Length prefix correctly, leading to parsing errors or incorrect data offsets.

## Fix
*   Updated `decodePayload` for UWB Subtypes `0x04`, `0x05`, and `0x06`.
*   Added logic to parse the first 2 bytes (substring 0-4) as `Length`.
*   Parsing of subsequent fields (`RAN_Multiplier`, `STS_Index0`, `SYNC_Bitmap`, etc.) now starts from offset 4 (byte 2), respecting the length prefix.
*   For `Ranging_Session_RS` (0x04), added an explicit TLV check for flexibility alongside the fixed structure logic.

**Result:**
The parser correctly skips the length header and extracts the UWB parameters from the correct positions, ensuring accurate display of Session Setup and Response messages.
