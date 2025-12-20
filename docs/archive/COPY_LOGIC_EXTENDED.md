# Result: Copy Row Logic Extended

Yes, I have extended the "Copy Entire Row" logic to **all** standard tables in the application.

## Enhancements
1.  **Generic Row Detection**: The `handleViewportInteraction` function now checks its context:
    *   **BTSnoop Virtual Rows**: Detects `btsnoop-row` and aggregates all `.btsnoop-cell` content.
    *   **Standard Tables**: Detects standard `<tr>` rows and aggregates all `<td>` content.
    *   **Virtual Log Lines**: Maintains default behavior (copies specific cell), as distinct fields (PID, Tag, Msg) are often copied individually.
    
2.  **Coverage**: This change automatically applies to:
    *   BTSnoop Log
    *   Device Events Table
    *   BLE Security Keys Table
    *   CCC Analysis Table
    *   Connection Events Table (now supported via generic `td` handling)

## Verification
- Validated via `tests/e2e/btsnoop_copy.spec.js` that the logic correctly aggregates row data.
- Verified code handles both `btsnoop-row` and `tr` classes cleanly.
