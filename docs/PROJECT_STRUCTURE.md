# Android Log Parser - Project Structure

## Overview
This document describes the organization of the Android Log Parser project.

## Directory Structure

```
Android_log_parser/
├── Skills/                    # Project capabilities (Git tracked)
├── Specifications/            # Requirements & specs (Git tracked)
├── TestScripts/              # Test code (Git tracked)
│   ├── unit/                 # Unit tests
│   ├── regression/           # E2E regression tests
│   └── performance/          # Performance benchmarks
├── TestReports/              # Test execution results
│   ├── unit/                 # Unit test reports (not tracked)
│   ├── regression/           # Regression reports (not tracked)
│   ├── performance/          # Performance reports (not tracked)
│   └── summary/              # Summary reports (Git tracked)
├── TestData/                 # Test fixtures (not tracked)
│   ├── sample-logs/
│   ├── mock-data/
│   └── fixtures/
├── src/                      # Source code
├── config/                   # Configuration files
└── dist/                     # Build output
```

## Git Tracking

### Tracked
- ✅ Source code (`src/`)
- ✅ Test scripts (`TestScripts/`)
- ✅ Specifications (`Specifications/`)
- ✅ Skills documentation (`Skills/`)
- ✅ Summary reports (`TestReports/summary/`)
- ✅ Configuration (`config/`)

### Not Tracked
- ❌ Test data (`TestData/`)
- ❌ Detailed test reports (`TestReports/unit/`, `TestReports/regression/`, `TestReports/performance/`)
- ❌ Build outputs (`dist/`)
- ❌ Dependencies (`node_modules/`)

## Running Tests

```bash
# Unit tests
npm run test:unit

# Regression tests
npm run test:regression

# Performance tests
npm run test:performance

# All tests
npm run test:all
```

## Adding New Tests

**Unit Test:**
1. Create file in `TestScripts/unit/`
2. Name it `*.test.js`
3. Run with `npm run test:unit`

**Regression Test:**
1. Create file in `TestScripts/regression/`
2. Name it `*.spec.js`
3. Run with `npm run test:regression`

**Performance Test:**
1. Create file in `TestScripts/performance/`
2. Name it `*.perf.js`
3. Run with `npm run test:performance`

## Test Reports

Reports are generated in `TestReports/` after test execution:

- **Unit**: `TestReports/unit/`
- **Regression**: `TestReports/regression/`
- **Performance**: `TestReports/performance/`
- **Summary**: `TestReports/summary/` (tracked in Git)

## Benefits of This Structure

✅ **Clear Separation**: Each type of content has its own directory  
✅ **Git Efficiency**: Only essential files tracked  
✅ **Scalability**: Easy to add new test types  
✅ **Team Collaboration**: Clear organization for team members  
✅ **CI/CD Ready**: Standardized paths for automation
