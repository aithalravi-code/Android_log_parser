# Advanced Android Log & BTSnoop Analyzer

A powerful, local-first web application designed for deep analysis of Android Bugreports, System Logs, and Bluetooth HCI Logs (BTSnoop). Built with a focus on **Digital Car Key (CCC)** diagnostics, performance, and privacy.

## 🚀 Key Features

### 1. High-Performance Log Parsing
-   **Zero-Server Architecture**: Runs slightly locally in your browser. No data is ever uploaded to a server.
-   **Large Layout Support**: Uses **Web Workers** for parsing and **IndexedDB** for storage, allowing it to handle huge log files (hundreds of MBs) without freezing the UI.
-   **Virtual Scrolling**: Efficiently renders only visible log lines, enabling smooth scrolling through millions of log entries.

### 2. Specialized BTSnoop (HCI) Analysis
-   **Full Packet Decoding**: Parses `btsnoop_hci.log` files natively.
-   **Visual Protocol Analysis**: Decodes HCI Commands, Events, ACL Data, L2CAP, and SMP (Security Manager Protocol) packets.
-   **Security Key Extraction**: Automatically extracts and correlates **IRK** (Identity Resolving Key) and **LTK** (Long Term Key) for debugging encrypted BLE connections.
-   **Sequence Visualization**: Displays packet exchanges in a readable, color-coded table format.

### 3. Digital Car Key (CCC) Diagnostics
-   **Protocol Decoding**: specialized parsing for CCC Digital Key standards (Release 3).
-   **UWB & NFC Analysis**: Decodes complex UWB (Ultra Wideband) ranging sessions, SP0/SP1 packets, and NFC APDUs.
-   **Session Tracking**: Correlates ranging setup, session management, and secure channel establishment.
-   **Stats & Highlights**: Dedicated dashboard for success/failure rates, ranging performance, and error distribution.

### 4. Advanced Filtering & Search
-   **Multi-Core Filtering**: Filter by Log Level (V, D, I, W, E), Tag, PID/TID, or custom keywords.
-   **Time-Travel**: Precise date/time range filtering with a visual slider.
-   **Connectivity Hub**: Dedicated tabs for **BLE**, **NFC**, and **Discovery** related logs, with pre-configured filters for common Android subsystems.

### 5. Data Visualization
-   **Interactive Charts**: CPU Load, Battery Temperature, and Logic State graphs over time.
-   **Excel Export**: Export filtered logs, BTSnoop packets, or statistical summaries to XLSX for reporting.

---

## 🛠 Architecture & Design

This project follows a **"Thick Client"** architecture, treating the browser as a full-fledged application platform.

### Core Components

1.  **`main.js` (The Controller)**
    *   Orchestrates the UI, manages state, and handles user interactions.
    *   Routes data between the UI, Storage, and Workers.
    *   Implements the "Virtual Scroller" logic to manipulate the DOM efficiently.

2.  **Web Workers (The Engine)**
    *   **Filtering Worker**: specialized in regex matching and text processing. Runs in the background to prevent UI jank during searches.
    *   **BTSnoop Worker**: A dedicated binary parser that processes raw HCI log bytes, interprets Bluetooth specs, and generates structured packet objects.

3.  **IndexedDB (The Memory)**
    *   Acts as a persistent buffer for large datasets.
    *   Stores parsed log lines and objects, allowing the tool to load files larger than the available RAM would typically allow for a simple web page.

4.  **Frontend (The View)**
    *   **Vanilla JS & CSS**: No heavy frameworks (React/Angular) to minimize overhead and maximize control over the render loop.
    *   **CSS Grid & Flexbox**: Responsive layouts that adapt to data density.

---

## 📖 How to Use

### 1. Loading Logs
You can load logs in two ways:
-   **ZIP Upload**: Drag & Drop a full `bugreport-*.zip` or `btsnoop_hci.log`. The tool will automatically unzip and find relevant files.
-   **Folder Open**: Select a directory containing extracted log files.

### 2. Navigating Tabs
-   **Logs**: The classic logcat view. Use the sidebar to filter by text, level, or time.
-   **Connectivity**: A focused view for Bluetooth, NFC, and UWB developers. Toggle specific layers (e.g., "SMP", "HAL") to reduce noise.
-   **BTSnoop**: The HCI packet analyzer. Only active if a `btsnoop_hci.log` was found.
-   **CCC Analysis**: The Digital Key dashboard. Shows high-level protocol exchanges and session stats.
-   **Stats**: Device health metrics (Battery, CPU, Thermal).

### 3. Filtering
-   **Logic**: Toggle between `AND` / `OR` logic for multiple search terms.
-   **Exclusion**: Prefix a term with `-` to exclude it (e.g., `-WifiHAL`).
-   **Columns**: In tables (BTSnoop/CCC), type in the header row input boxes to filter specific columns.

### 4. Exporting
-   Use the "Export to Excel" buttons in any tab to generate a report of the currency filtered view.

---

## 📂 Project Structure

```
├── index.html                      # Main application entry point
├── styles.css                      # Global styling and themes
├── main.js                         # Core application logic and state management
├── table-resize.js                 # Utility for resizable table columns
├── btsnoop-worker.js               # (Embedded in main.js) Binary parser for HCI logs
├── jszip.min.js                    # Library for handling ZIP files in browser
├── BTSNOOP_SCROLL_RESTORATION.md   # Documentation for scroll restoration feature
└── BTSNOOP_SCROLL_TEST_GUIDE.md    # Testing guide for scroll restoration
```

## 🔍 Advanced Features

### BTSnoop Scroll Restoration
The BTSnoop tab includes intelligent scroll restoration that preserves your viewing position when applying filters. See [BTSNOOP_SCROLL_RESTORATION.md](./BTSNOOP_SCROLL_RESTORATION.md) for implementation details and [BTSNOOP_SCROLL_TEST_GUIDE.md](./BTSNOOP_SCROLL_TEST_GUIDE.md) for testing instructions.

## 🤝 Contribution

This tool is designed for extensibility.
-   **Adding a new Decoder**: Update the `BTSnoop Worker` section in `main.js` to handle new OpCodes or Events.
-   **New Parsers**: Add regex rules in the proper `Tab` setup function in `main.js`.
