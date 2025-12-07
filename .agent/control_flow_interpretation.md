# CONTROL_FLOW Text Interpretation

## Issue
The user requested text interpretation for the data `0100` following `803C` in `CONTROL_FLOW` messages. It was previously displayed as generic "Data".

## Fix
*   Updated `decodePayload` for `CONTROL_FLOW` (`803C`) commands.
*   Now explicitly parses `P1` (Byte 1) and `P2` (Byte 2).
*   Added provisional text mapping for `P1`:
    *   `01` -> `01 (ACK/Proceed)`
    *   `00` -> `00 (Pause/Stop)`

**Result:**
The payload `0100` is now displayed as `P1: 01 (ACK/Proceed) P2: 00`, fulfilling the request for text interpretation.
