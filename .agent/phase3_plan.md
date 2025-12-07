# Phase 3: Advanced Optimizations Plan

## Goal
Achieve native-like performance (60fps) even during heavy operations like filtering 1M+ log lines.

## 1. Web Workers for Heavy Lifting (High Priority)
Currently, filtering blocks the main thread. Even with 500ms debounce, a large regex filter freezes the UI for a few hundred ms.

**Implementation Plan:**
1. Create `filter.worker.js`.
2. Move `applyMainFilters` logic to the worker.
3. Use message passing to send lines -> worker -> filtered lines -> main thread.
4. **Impact**: Typing in search box will never lag. Spinner/Progress bar can animate smoothly while filtering happens.

## 2. Intersection Observer (Medium Priority)
Replace `scroll` event listener with `IntersectionObserver` for virtual scrolling.

**Implementation Plan:**
1. Use `IntersectionObserver` to detect which "spacer" divs are visible.
2. Render content only when spacers intersect.
3. **Impact**: Smoother scroll performance, less CPU usage during scrolling.

## 3. Service Worker (Low Priority - Nice to have)
Cache app shell for offline usage.

**Implementation Plan:**
1. Create `sw.js`.
2. Cache `index.html`, `main.js`, `styles.css`.
3. **Impact**: Instant load on subsequent visits (0 network), works offline.

## Recommended Start
Start with **Web Worker for Filtering**. This addresses the biggest remaining bottleneck (responsiveness during heavy filtering).

## Estimated Time
- Web Worker Setup: 2 hours
- Filter Logic Migration: 2 hours
- Testing & Debugging: 1 hour
- **Total**: 5 hours for this feature.
