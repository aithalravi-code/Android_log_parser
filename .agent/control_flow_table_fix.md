# CONTROL_FLOW Table 5-2 Implementation

## Issue
The user noted that previous interpretations of `CONTROL_FLOW` P1/P2 parameters were incorrect and requested adherence to "Table 5-2" (likely referencing the CCC Digital Key specifications for Control Flow codes).

## Fix
1.  **Implemented Mapping Tables**:
    *   `CONTROL_FLOW_P1_MAP`: Includes standard codes `10` (Continue), `11` (End), `12` (Abort).
    *   `CONTROL_FLOW_P2_MAP`: Includes standard codes `00` (Success), `01` (Timeout/Data), `0B` (Cert Verify Failed), etc.
2.  **Updated `decodePayload`**:
    *   Removed hardcoded "ACK/Proceed" logic.
    *   Now looks up P1 and P2 in their respective maps.
    *   Displays format: `Value (Description)` (e.g., `10 (Continue)`). Unknown codes display as `Hex (Hex)`.

**Result:**
The `CONTROL_FLOW` decoding mechanism is now aligned with standard CCC specifications structures, allowing correct interpretation of known values and easy extension for others.
