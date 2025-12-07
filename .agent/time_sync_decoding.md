# Time_Sync Message Decoding

## Issue
The user provided a specific CCC message payload (`050d...`) that was not being fully decoded.
This message corresponds to `Time_Sync` in the Supplementary Service category.

## Fix
1.  **Identification:** Identified `0x05` as "Supplementary Service" and `0x0D` as "Time_Sync" based on the CCC specification (Table 19-52).
2.  **Decoding Logic:** Implemented a parser for the 23-byte payload in `decodePayload` (`main.js`).
    *   `DeviceEventCount` (8 bytes)
    *   `UWB_Device_Time` (8 bytes)
    *   `UWB_Device_Time_Uncertainty` (1 byte)
    *   `UWB_Clock_Skew_Measurement_available` (1 byte)
    *   `Device_max_PPM` (2 bytes)
    *   `Success` (1 byte)
    *   `RetryDelay` (2 bytes)

**Result:**
The message `050d0017000000000000c2b6000000193d8fd99a6f010064010001` is now displayed with detailed parameter values in the CCC Analysis table.
