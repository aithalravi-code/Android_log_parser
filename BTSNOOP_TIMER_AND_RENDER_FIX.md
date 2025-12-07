# BTSnoop Scroll Fix: Timer Sabotage & Forced Render

## Symptom
"It does not work" - User reports that scroll restoration still fails, likely intermittently or when filtering after manual scrolling.

## Two Root Causes Discovered

### 1. The "Timer Sabotage" (Race Condition)
When a user manually scrolls, a "destruct timer" is started to clear the `btsnoopAnchorPacketNumber` after 100ms.
**Scenario**:
1. User manually scrolls (timer starts).
2. User clicks "Filter".
3. We set a new anchor and scroll.
4. **BAM!** The old timer from step 1 fires 50ms later and deletes our new anchor.
5. Next repaint/check sees no anchor and gives up.

### 2. The "Empty Viewport"
When we programmatically jump the scroll position (e.g. from 2,000px to 114,000px), the virtual scroller hasn't rendered those rows yet.
**Scenario**:
1. We set `scrollTop` to 114,000px.
2. The viewport looks at empty space.
3. The virtual scroller only updates on the *next* animation frame (via scroll event).
4. In that micro-gap, the browser might try to adjust the scroll or the user sees a white flash.

## The Solution

### Fix 1: Kill the Timer
In `renderBtsnoopPackets`, we now **unconditionally clear any pending anchor timers** before applying our restoration. This ensures we start with a clean slate.

```javascript
// CRITICAL: Clear any pending anchor-clear timers from previous manual scrolls!
clearTimeout(window.btsnoopAnchorClearTimer);
```

### Fix 2: Render Immediately
We forced a call to `renderBtsnoopVirtualLogs()` *immediately* after setting `scrollTop`, inside the same frame. This ensures the DOM is populated with the correct rows for the new position instantly.

```javascript
btsnoopLogContainer.scrollTop = targetScrollTop;
// CRITICAL: Force immediate re-render at the new position
renderBtsnoopVirtualLogs();
```

## Verification
1. **Manual Scroll + Filter**: Scroll manually, then quickly click a filter. The view should NOT jump.
2. **Big Jump**: Go from small list to huge list. View should instantly show data (no white flash).

## Why was this tricky?
Because it depended on user interaction speed (manual scroll vs filter click timing) and browser rendering order.
