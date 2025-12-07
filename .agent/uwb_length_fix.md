# UWB Ranging Length Prefix Fix

## Issue
The user pointed out an incorrect interpretation of `Ranging_Session_RQ` (0x02, 0x03) payload.
The data `000a0100...` was interpreted with `000a` as the Protocol Version.
The user clarified that `000a` is the **Size** (Length) of the following data, and the rest is the actual message content.

## Fix
*   Updated `decodePayload` for UWB Subtypes `0x03` (Ranging_Session_RQ) and `0x04` (Ranging_Session_RS).
*   The parser now reads the first 2 bytes (4 hex chars) as `Length`.
*   Field mapping offsets were shifted by 4 chars (2 bytes) to align with the actual data start.
    *   **RQ**: `Length` (2B) -> `Protocol` (2B) -> `ConfigID` (2B) -> `SessionID` (4B) -> `PulseShape` (1B) -> `Channel` (1B).
    *   **RS**: `Length` (2B) -> `Multiplier` (1B) -> `Data` (Variable).

**Result:**
The payload is now parsed correctly: `Length: 0x000a`, `Protocol: 0x0100`, etc., matching the specification structure.
