# Android Log Parser

A comprehensive web-based Android log analysis tool for parsing, filtering, and visualizing Android logcat, BTSnoop, and bugreport files.

## 🌐 Live Demo

**Try it online**: [https://aithalravi-code.github.io/Android_log_parser/](https://aithalravi-code.github.io/Android_log_parser/)

## ✨ Features

### Core Functionality
- 📱 **Android Logcat Parser** - Advanced filtering by level, tag, keyword with AND/OR logic
- 🔵 **BTSnoop Analysis** - HCI packet capture visualization and filtering
- 📊 **Statistics Dashboard** - CPU, battery, temperature charts with time-series data
- 🔍 **Real-time Search** - Instant filtering across millions of log lines
- 📋 **Export Tools** - Download results as Excel/CSV
- 🎯 **CCC Digital Key** - Car Connectivity Consortium protocol analysis
- 🔐 **BLE Security** - Bluetooth Low Energy key management
- 📦 **Bugreport Support** - Extract and analyze complete Android bugreports

### Technical Highlights
- ⚡ **Fast** - Web Workers for background processing
- 💾 **Efficient** - Virtual scrolling for large datasets
- 🎨 **Modern UI** - Responsive design, sortable/resizable tables
- 🔒 **Private** - All processing happens client-side (no server)
- 📱 **Mobile-friendly** - Works on phones and tablets

## 🚀 Quick Start

### Online (No Installation)
1. Visit [the live demo](https://aithalravi-code.github.io/Android_log_parser/)
2. Drag & drop your Android log files
3. Start analyzing!

### Local Development
```bash
# Clone repository
git clone https://github.com/aithalravi-code/Android_log_parser.git
cd Android_log_parser

# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build
```

## 📖 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md) - System design and components
- [User Guide](docs/USER_GUIDE.md) - How to use all features
- [Developer Guide](docs/DEVELOPER_GUIDE.md) - Contributing and development
- [API Reference](docs/API.md) - Code structure and APIs
- [Testing Guide](docs/TESTING.md) - Running and writing tests

## 🧪 Testing

```bash
# Run all tests (unit + E2E)
npm run test

# Unit tests only (Vitest)
npm run test:unit

# E2E regression tests (Playwright)
npm run test:regression

# Generate coverage report
npm run coverage
```

### Test Coverage
- **Functions**: 72.36% ✅
- **Lines**: 40.92% (unit) + ~30% (E2E) = **~70% combined**
- **E2E Tests**: 24 comprehensive browser tests

## 💻 Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | Vanilla JavaScript (ES6+), Vite |
| **Build** | Vite, single-file output |
| **Charts** | Chart.js |
| **Storage** | IndexedDB (client-side) |
| **Workers** | Web Workers for parsing |
| **Testing** | Vitest (unit), Playwright (E2E) |
| **Export** | SheetJS (XLSX) |

## 📁 Supported File Types

| Type | Extensions | Description |
|------|------------|-------------|
| **Logcat** | `.log`, `.txt` | Android system logs |
| **BTSnoop** | `.cfa`, `.log` | Bluetooth HCI captures |
| **Bugreport** | `.zip` | Full Android bugreports |
| **CCC** | `.log`, `.txt` | Digital Key protocol logs |

## 🎯 Use Cases

- **Debug Android apps** - Filter logs by tag, level, time range
- **Analyze Bluetooth** - Inspect HCI commands/events, connection parameters
- **Monitor performance** - CPU, battery, temperature trends
- **Security analysis** - BLE key management, pairing processes
- **Car connectivity** - CCC Digital Key protocol debugging
- **Automated testing** - Parse test logs for CI/CD

## 🔧 Key Features Deep Dive

### Log Filtering
- **Multiple filters**: Level (V/D/I/W/E), tag, keyword, time range
- **Boolean logic**: AND/OR combinations for keywords
- **Live search**: Real-time filtering as you type
- **Collapsible sections**: Group by file, hide/show sections

### BTSnoop Analysis
- **Packet view**: All HCI commands, events, ACL data
- **Connection tracking**: Link Handle → BD_ADDR mapping
- **Parameter decoding**: Human-readable connection parameters
- **Export**: Save filtered packets to Excel

### Statistics Dashboard
- **CPU usage**: Timeline with load percentages
- **Battery stats**: Level, temperature, voltage trends
- **App versions**: Package version tracking
- **Heat map**: Thermal zones over time

### CCC Digital Key
- **Message decoding**: Framework, SE, UWB messages
- **Parameter formatting**: Physical units (µs, ppm, ms)
- **Crypto visualization**: SPAKE2+, authentication flows
- **Session tracking**: Ranging session lifecycle

## 🌟 Screenshots

*Coming soon - Add screenshots of main features*

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Code style guide
- Development workflow
- Testing requirements
- Pull request process

## 📝 License

See [LICENSE](LICENSE) file for details.

## 🐛 Issues & Support

- **Bug reports**: [Open an issue](https://github.com/aithalravi-code/Android_log_parser/issues)
- **Feature requests**: [Suggest a feature](https://github.com/aithalravi-code/Android_log_parser/issues/new)
- **Questions**: Check [Discussions](https://github.com/aithalravi-code/Android_log_parser/discussions)

## 🗺️ Roadmap

- [ ] Real-time USB log streaming
- [ ] Advanced regex filtering
- [ ] Custom log format parsers
- [ ] Saved filter presets
- [ ] Session persistence
- [ ] Multi-file comparison view

## 📈 Performance

| Metric | Value |
|--------|-------|
| **Build size** | 562 KB (176 KB gzipped) |
| **Parse speed** | 10,000 lines in ~6ms |
| **Filter speed** | 100,000 logs in ~5ms |
| **File support** | Up to 500MB (browser dependent) |

## 🙏 Acknowledgments

Built with modern web technologies and open-source libraries:
- Vite for blazing-fast builds
- Chart.js for beautiful visualizations
- Vitest & Playwright for comprehensive testing
- SheetJS for Excel export functionality

---

**Made with ❤️ for Android developers and debuggers**
