# Refactoring Plan: Modularization and Testability with Vite

## 1. Objective
Refactor the current monolithic `main.js` (~5000 lines) into a modular, maintainable, and testable architecture leveraging Vite's features. This will separate business logic from UI handling, enabling robust unit testing and easier feature development.

## 2. Target Architecture

We will adopt a layered architecture:

```
src/
├── core/               # Pure business logic (No DOM)
│   ├── parsers/        # Log parsing, BTSnoop parsing, CCC decoding
│   ├── filters/        # Filtering logic (moved from Worker/Main)
│   ├── models/         # Data structures (LogLine, Packet)
│   └── state/          # State management (Store pattern)
├── infra/              # Infrastructure
│   ├── db/             # IndexedDB wrapper
│   └── workers/        # Web Workers (Filter, Parser)
├── ui/                 # DOM manipulation & View logic
│   ├── components/     # Reusable UI components (VirtualList, chart helpers)
│   ├── tabs/           # Logic for specific tabs (Logs, Connectivity, Stats)
│   └── main.js         # Entry point (bootstrapper)
├── utils/              # Shared helpers (Date, String, Math)
└── styles/             # CSS files
```

## 3. Key Leverage Points of Vite

1.  **Native Worker Support**:
    *   **Current**: Worker code is a string inside `main.js`.
    *   **New**: `import FilterWorker from './infra/workers/filter.worker.js?worker'`
    *   **Benefit**: Syntax highlighting, imports within workers, separate testing.

2.  **Hot Module Replacement (HMR)**:
    *   Splitting `styles.css` and JS modules will allow tweaking UI or specific parsers without reloading the entire 100MB log file state.

3.  **ES Modules & Aliases**:
    *   Use `@/core/parsers/LogParser.js` imports.
    *   Tree-shaking for dependencies like `xlsx` and `chart.js`.

4.  **Vitest Integration**:
    *   **Current Unit Tests**: Limited.
    *   **New Strategy**: `core/` modules will be tested in isolation (Node environment, fast). `ui/` modules tested with JSDOM.

## 4. Migration Phase Plan

### Phase 1: Infrastructure & Utils Extraction (Low Risk)
*   **Goal**: Extract generic helpers and DB logic.
*   **Actions**:
    *   Create `src/infra/db.js` (Move indexedDB logic).
    *   Create `src/utils/` (Move `wildcardToRegex`, `logcatToDate`, formatting helpers).
    *   Create `src/ui/components/VirtualScroll.js` (Extract `renderVirtualLogs`).
*   **Test**: Add unit tests for Utils and DB.

### Phase 2: Worker & Core Logic Separation (Medium Risk)
*   **Goal**: Move inline worker code to a file and extract parsing logic.
*   **Actions**:
    *   Extract `filterWorkerCode` string to `src/infra/workers/filter.worker.js`.
    *   Import using Vite's worker suffix.
    *   Extract `processForBtsnoop`, `processForDashboardStats` to `src/core/processors/`.
*   **Test**: Unit test the worker logic (request/response) and processors.

### Phase 3: Domain Separation (High Impact)
*   **Goal**: Split the `main.js` logic by Feature/Tab.
*   **Actions**:
    *   Create `src/ui/tabs/ConnectivityTab.js` (Move `setupConnectivityTab`, `lazyLoadTab` ('connectivity') logic).
    *   Create `src/ui/tabs/BtsnoopTab.js`.
    *   Create `src/ui/tabs/CccTab.js`.
    *   Create `src/ui/tabs/StatsTab.js`.
    *   `main.js` becomes a coordinator that initializes these modules.

### Phase 4: State Management (Architecture Change)
*   **Goal**: Eliminate global variables (`let originalLogLines`, `let activeTechs`).
*   **Actions**:
    *   Implement a simple `Store` or `StateManager` singleton.
    *   Example: `AppState.logs.lines`, `AppState.filters.keywords`.
    *   Components subscribe to state changes or read from StateManager.

## 5. Testing Strategy

1.  **Unit Tests (`.test.js` next to source)**:
    *   **Parsers**: Input raw text line -> Output object.
    *   **Filters**: Input array + config -> Output indices.
    *   **Utils**: Standard IO tests.

2.  **Integration Tests**:
    *   Test interaction between `StateManager` and `IndexedDB`.
    *   Test Worker interaction.

3.  **UI/E2E Tests (Playwright)**:
    *   Maintain existing Playwright tests to ensure refactoring doesn't break user flows.

## 6. Immediate Next Step
Start **Phase 1**: Extract `infra/db.js` and `utils/`.
