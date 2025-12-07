# CCC Specification Integration

## Overview
I analyzed the provided CCC Digital Key Technical Specification (Release 3) to extract message structures and definitions.

## Key Findings
1.  **Message Types (Byte 0):**
    *   0x00: Framework
    *   0x01: SE
    *   0x02: UWB Ranging Service
    *   0x03: DK Event Notification
    *   0x04: Vehicle OEM App
    *   0x05: Supplementary Service
    *   0x06: Head Unit Pairing

2.  **UWB Ranging Service (Type 0x02) Message IDs (Byte 1):**
    *   0x01/0x02: Ranging Capability RQ/RS
    *   0x03/0x04: Ranging Session RQ/RS
    *   0x05/0x06: Ranging Session Setup RQ/RS
    *   0x07/0x08: Ranging Suspend RQ/RS
    *   0x09/0x0A: Ranging Recovery RQ/RS
    *   0x0B/0x0C: Configurable Ranging Recovery RQ/RS

3.  **DK Event Notification (Type 0x03) Categories (Byte 1):**
    *   0x01: Command Complete
    *   0x02: Ranging Session Status Changed
    *   0x03: Device Ranging Intent
    *   0x04: Vehicle Status Change
    *   0x05: RKE Request

## Implementation
Updated `renderCccStats` in `main.js` to use `CCC_CONSTANTS` derived from these findings.
The table now displays descriptive names for Message Types and Subtypes/IDs instead of just hex values.

**Example Log:** `Sending: [020700046cc6ba83]`
*   **Type:** 0x02 -> "UWB Ranging Service"
*   **Subtype:** 0x07 -> "Ranging_Suspend_RQ"
*   **Payload:** `00046cc6ba83` (likely 4-byte UWB Session ID `6cc6ba83` with 2-byte length `0004`?)
