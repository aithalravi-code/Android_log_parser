# DK Event Notification Refactoring (0x11)

## Issue
The user clarified that `0x11` is the generic "DK Event Notification" Message ID, which acts as a container.
The payload structure is `[Subevent_Category (1 byte)] [Subevent_Code (1 byte)] [Data...]`.
Example: `031100020180` -> Type 03, Subtype 11, Length 2, Category 01, Code 80.
Category 01 is "Command Complete" (or associated with General Error per user).
Code 80 is the specific code (General Error).

## Fix
1.  **Renamed `0x11`**: Changed from `RKE_System_Event` to `DK Event Notification` in constants.
2.  **Refactored `decodePayload` for Type 03/Subtype 11**:
    *   Treats payload as Container.
    *   Parses `Category` byte.
    *   Decodes based on Category Mapping:
        *   `01`: Command Complete / General Error (Code 0x80 -> General Error).
        *   `02`: Ranging Session Status (e.g., 07=Suspended).
        *   `03`: Device Ranging Intent (e.g., 00=Low, 01=Med, 02=High).
        *   `05`: RKE Request (uses TLV parsing with `RKE_TAGS`).

**Result:**
*   `031100020180` -> "DK Event Notification, Command Complete (Category_0x01), Code: 0x80 (General Error)"
*   `031100020207` -> "DK Event Notification, Ranging Session Status: Suspended"
*   `03110006057f74...` -> "DK Event Notification, RKE Request, Get_Function_Status: ..."
