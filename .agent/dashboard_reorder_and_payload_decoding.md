# Dashboard Reordering and Enhanced Payload Decoding

## 1. Dashboard Reordering
**Issue:** The user requested that CCC Analysis and BLE Data be prioritized at the top of the Stats tab.
**Fix:** Rearranged the HTML structure in `index.html` to place `#cccStatsCard` and `#highlightsCard` (renamed to "BLE & System Highlights") at the beginning of the dashboard grid.

## 2. Enhanced Payload Decoding
**Issue:** The user requested more insightful text information in the "Payload (Decoded)" column of the CCC Analysis table.
**Fix:** Implemented a `decodePayload` helper function in `renderCccStats` (`main.js`) that:
-   **UWB Ranging Service:** Extracts and labels `UWB Session ID` for `Ranging_Suspend_RQ` and `Ranging_Recovery_RQ`.
-   **DK Event Notification:** Decodes `Device Ranging Intent` codes (e.g., "High Confidence") based on the spec.
-   **Default:** Formats raw hex with spaces for better readability.

**Code Change:**
```javascript
// main.js
const decodePayload = (type, subtype, payload) => {
    // ... specific decoding logic ...
    if (type === 0x02 && subtype === 0x07) {
        return `UWB Session ID: 0x${payload.substring(4, 12)}`;
    }
    // ...
};
```
