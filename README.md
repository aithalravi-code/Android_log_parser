# Android Log Parser

Advanced Android Log & BTSnoop Analyzer with comprehensive testing framework.

## Features

- **Log Analysis**: Parse and analyze Android logcat files
- **BTSnoop Support**: Bluetooth HCI packet analysis
- **CCC Analysis**: Car Connectivity Consortium protocol decoding
- **Performance Optimized**: Handle millions of log lines efficiently
- **Comprehensive Testing**: Unit, regression, and performance tests

## Project Structure

```
Android_log_parser/
├── Production/          # Production-ready source code
├── Development/         # Experimental features
├── TestScripts/         # Unit, regression, performance tests
├── TestReports/         # Test execution results
├── Skills/              # Project capabilities documentation
├── Specifications/      # Requirements and specs
├── .config/             # All configuration files
└── docs/                # Documentation
```

See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for detailed structure information.

## Quick Start

### Installation
```bash
npm install
```

### Development
```bash
npm run dev              # Start dev server
```

### Testing
```bash
npm run test:unit        # Run unit tests
npm run test:regression  # Run E2E tests
npm run test:all         # Run all tests
```

### Building
```bash
npm run build            # Build for production
```

## Documentation

- [Project Structure](PROJECT_STRUCTURE.md) - Detailed folder organization
- [Testing Guide](docs/guides/TESTING.md) - How to run and write tests
- [Architecture](docs/architecture/) - System design documentation

## Development Workflow

1. **Develop** features in `Development/`
2. **Test** thoroughly with unit and E2E tests
3. **Move** stable code to `Production/`
4. **Build** and deploy from `Production/`

## Contributing

1. Create features in `Development/`
2. Write tests in `TestScripts/`
3. Ensure all tests pass
4. Move to `Production/` when stable

## License

See LICENSE file for details.
