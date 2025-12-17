# Android Log Parser

A comprehensive web-based Android log analysis tool for parsing, filtering, and visualizing Android logcat, BTSnoop, and bugreport files.

## 🌐 Live Demo

**Try it online**: [https://aithalravi-code.github.io/Android_log_parser/](https://aithalravi-code.github.io/Android_log_parser/)

## Features

- 📱 Parse Android logcat files with advanced filtering
- 🔵 BTSnoop packet analysis and visualization
- 📊 Statistics dashboard with charts (CPU, battery, temperature)
- 🔍 Real-time search and filtering
- 📋 Export to Excel/CSV
- 🎯 CCC (Car Connectivity Consortium) Digital Key analysis
- 🚀 Fast client-side processing (no server needed)

## Usage

### Online
Simply visit the [live demo](https://aithalravi-code.github.io/Android_log_parser/) and upload your log files.

### Local Development
```bash
npm install
npm run dev  # Start dev server at http://localhost:5173
```

### Production Build
```bash
npm run build  # Creates dist/log_parser.html (single file)
```

## Testing

```bash
npm run test              # Run all tests
npm run test:unit         # Unit tests only
npm run test:regression   # E2E tests (Playwright)
npm run coverage          # Generate coverage report
```

## Test Coverage

- **Function Coverage**: 72.36% ✅
- **Lines Coverage**: 40.92%
- **E2E Tests**: 24 comprehensive regression tests

## Tech Stack

- **Frontend**: Vanilla JavaScript, Vite
- **Charts**: Chart.js
- **Testing**: Vitest (unit), Playwright (E2E)
- **Export**: XLSX for Excel exports

## File Support

- Android logcat files (`.log`, `.txt`)
- BTSnoop files (`.cfa`, `.log`)
- Bugreport archives (`.zip`)
- CCC Digital Key logs

## License

See LICENSE file for details.

## Contributing

Contributions welcome! Please run tests before submitting PRs:
```bash
npm run test
```
