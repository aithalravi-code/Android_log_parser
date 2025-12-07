# FINAL BTSNOOP SCROLL FIX

## Summary of Changes

I have applied a comprehensive set of fixes to resolve the "Jump to Packet 42" scroll issue.

### 1. Fixed "Timer Sabotage" (Critical)
**Issue**: Manual scrolling starts a timer to clear the scroll anchor. If you clicked a filter quickly after scrolling, this timer would fire *after* the new filter was applied, deleting the anchor.
**Fix**: Added `clearTimeout(window.btsnoopAnchorClearTimer)` immediately before applying the new scroll position.

### 2. Fixed "Zero Height" Clamping (Critical)
**Issue**: When the list grows from small (2k px) to large (200k px), the browser would clamp the scroll position to the old small height because the layout hadn't cached up.
**Fix**: Added `const _ = btsnoopLogContainer.scrollHeight` to force a synchronous layout update before scrolling.

### 3. Fixed "Empty Viewport"
**Issue**: Jumping to a new scroll position left the viewport empty until the next frame.
**Fix**: Called `renderBtsnoopVirtualLogs()` immediately after setting `scrollTop` to fill the view instantly.

### 4. Added Debug Logging
Added detailed console logs prefixed with `[BTSnoop Scroll]`.
- Check for "Scroll applied successfully"
- Check for warnings like "Scroll clamping detected!"

## Verification Steps

1. **Load BTSnoop File**: Use your large log file.
2. **Filter to SMP**: Uncheck everything else.
3. **Select Packet**: Click packet #5712 (or any middle packet).
4. **Enable CMD**: Click the CMD filter button.
5. **Verify**: The view should stay centered on #5712.

**If it fails**:
Open the browser console (F12) and check the logs.
- If you see `WARNING: Scroll clamping detected!`, the browser is still refusing the scroll height.
- If you see `Anchor packet ... not found`, the packet was filtered out (unlikely for CMD+SMP).

This combination of fixes addresses all known causes for this behavior.
