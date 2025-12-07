# Additional Control Flow Values (Tables 15-42 & 15-43)

## Issue
The user requested the addition of values from "Table 15-42" and "15-43", which correspond to additional P1 and P2 parameters for the `CONTROL_FLOW` APDU command in the CCC Digital Key specification.

## Fix
1.  **Updated `CONTROL_FLOW_P1_MAP`**:
    *   Added `00` (Finished with Failure), `01` (Finished with Success), `40` (Application Specific) based on spec details found.
2.  **Updated `CONTROL_FLOW_P2_MAP`**:
    *   Added specific error codes referenced in Table 15-43/15-44 (e.g., `A0`: Key deleted, `B0`: Doors not closed, `04`: Invalid signature).
    *   Merged these with existing values to provide comprehensive decoding coverage.

**Result:**
The `CONTROL_FLOW` command payload (e.g., `P1=00 P2=A0`) will now decode into detailed, distinct error messages like "Finished with Failure (00) / Key deleted (A0)", aiding in precise troubleshooting.
