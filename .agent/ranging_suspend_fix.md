# Ranging Suspend and Tag Context Fix

## Issues
1.  **Ranging Suspend Response (0x0208)**: Decoding for "Accepted" or "Declined" (Delayed) was missing.
2.  **Tag Ambiguity**: Tag `0x86` was being incorrectly decoded as `Endpoint_ePK` in RKE messages (where it means "Full Update Flag"), because it was globally mapped for AUTH0 (where it means "Endpoint ePK").
3.  **Correct Decoding**: User reported `03110006057f74028600` showed `Endpoint_ePK` erroneously.

## Fix
1.  **Context-Aware TLV Parsing**:
    *   Updated `parseTLV` to accept a `tagMap` argument.
    *   Defined `COMMON_TAGS`, `APDU_TAGS`, and `RKE_TAGS`.
    *   `APDU_TAGS` maps `86` to `Endpoint_ePK`.
    *   `RKE_TAGS` maps `86` to `Full_Update_Flag` (and handles boolean logic for length 0).
    *   Updated `decodePayload` to pass `APDU_TAGS` for SE/AUTH messages and `RKE_TAGS` for RKE messages.
2.  **Implemented `Ranging_Suspend_RS`**:
    *   Subtype `0x08` of Type `0x02`.
    *   Decodes status `00` as "Accepted" and `01` as "Delayed".

**Result:**
*   RKE messages now correctly identify tags (e.g., `86` as Flag).
*   AUTH messages still identify `86` as Endpoint ePK.
*   Ranging Suspend responses are clearly decoded.
