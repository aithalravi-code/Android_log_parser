# Project Structure Documentation
**Last Updated:** 2025-12-07  
**Version:** 2.0 (After Reorganization)

## 📁 Directory Structure

```
Android_log_parser/
├── src/                          # Application Source Code
│   ├── index.html               # Main HTML entry point
│   ├── main.js                  # Core application logic (5500+ lines)
│   ├── styles.css               # Global styles and themes
│   ├── table-resize.js          # Table column resizing utility
│   ├── jszip.min.js             # ZIP file handling library
│   └── performance-tracker.js   # Performance monitoring utility
│
├── tests/                        # Test Suites
│   ├── e2e/                     # End-to-End Tests (Playwright)
│   │   ├── btsnoop_*.spec.js   # BTSnoop functionality tests
│   │   ├── dck_filter.spec.js  # DCK log filtering tests
│   │   ├── datetime_filter.spec.js # Date/time filter tests
│   │   ├── file_collapse.spec.js # File collapse tests
│   │   └── file-upload.spec.js # File upload tests
│   │
│   ├── integration/             # Integration Tests (Playwright)
│   │   └── performance.spec.js # Performance benchmarks
│   │
│   ├── unit/                    # Unit Tests (Vitest)
│   │   └── parsers.test.js     # Log parser tests
│   │
│   ├── fixtures/                # Test Data Files (NOT in git)
│   │   ├── *.zip               # Test log archives (17MB-30MB)
│   │   ├── *.log               # Test log files
│   │   └── expected-outputs/   # Expected test outputs
│   │
│   ├── scripts/                 # Test Helper Scripts
│   │   └── export-performance-metrics.js
│   │
│   └── setup.js                 # Test configuration
│
├── config/                       # Configuration Files
│   ├── playwright.config.js     # E2E test configuration
│   ├── playwright.integration.config.js # Integration test config
│   └── vitest.config.js         # Unit test configuration
│
├── docs/                         # Documentation
│   ├── BTSNOOP_*.md            # BTSnoop feature documentation
│   ├── TESTING_*.md            # Testing guides
│   ├── DELIVERABLES.md         # Project deliverables
│   └── ... (30+ markdown files)
│
├── results/                      # Test Results & Analysis (Docs only in git)
│   ├── PERFORMANCE_ANALYSIS.md # Performance benchmarks
│   ├── TEST_COVERAGE_ANALYSIS.md # Coverage analysis
│   ├── COMPREHENSIVE_ENHANCEMENT_SUMMARY.md
│   ├── GIT_CLEANUP_SUMMARY.md
│   ├── logs/                   # Log files (NOT in git)
│   ├── test-results/           # Test artifacts (NOT in git)
│   └── playwright-report/      # HTML reports (NOT in git)
│
├── .gitignore                    # Git ignore rules
├── package.json                  # NPM dependencies and scripts
├── package-lock.json            # Locked dependency versions
├── README.md                     # Project documentation
└── Android.code-workspace       # VS Code workspace settings
```

## 📊 Directory Details

### `src/` - Application Source Code
**Purpose:** Contains all application source code  
**Size:** ~5.5MB (including jszip.min.js)  
**Files:** 6 files  
**Tracked in Git:** ✅ Yes

**Key Files:**
- `main.js` - 5500+ lines of core logic
- `index.html` - Application entry point
- `styles.css` - All styling and themes
- `jszip.min.js` - ZIP handling (minified library)

### `tests/` - Test Suites
**Purpose:** All test code and test data  
**Size:** ~78MB (mostly fixtures)  
**Tracked in Git:** ✅ Code only, ❌ Fixtures excluded

**Subdirectories:**
- `e2e/` - End-to-end tests (Playwright)
  - 10+ test files
  - Multi-browser testing
  - Real user workflows

- `integration/` - Integration tests (Playwright)
  - Performance benchmarks
  - Real file testing
  - Memory leak detection

- `unit/` - Unit tests (Vitest)
  - Parser logic tests
  - Fast execution
  - Isolated testing

- `fixtures/` - Test data (NOT in git)
  - 3 ZIP files (17MB-30MB each)
  - Sample log files
  - Expected outputs

- `scripts/` - Helper scripts
  - Performance metric export
  - Test utilities

### `config/` - Configuration Files
**Purpose:** Test and build configuration  
**Size:** ~15KB  
**Files:** 3 files  
**Tracked in Git:** ✅ Yes

**Files:**
- `playwright.config.js` - E2E test config
- `playwright.integration.config.js` - Integration config
- `vitest.config.js` - Unit test config

### `docs/` - Documentation
**Purpose:** All project documentation  
**Size:** ~500KB  
**Files:** 30+ markdown files  
**Tracked in Git:** ✅ Yes

**Categories:**
- BTSnoop feature docs (10+ files)
- Testing guides (5+ files)
- Fix summaries (10+ files)
- Architecture docs (5+ files)

### `results/` - Test Results & Analysis
**Purpose:** Test outputs and analysis documents  
**Size:** ~200KB (docs only)  
**Tracked in Git:** ✅ Docs only, ❌ Results excluded

**Tracked (Markdown only):**
- Performance analysis
- Test coverage analysis
- Enhancement summaries
- Git cleanup summary

**Not Tracked:**
- Test result artifacts
- Playwright reports
- Log files
- Screenshots/videos

## 🎯 Design Principles

### 1. **Separation of Concerns**
- Source code in `src/`
- Tests in `tests/`
- Config in `config/`
- Docs in `docs/`

### 2. **Clean Git Repository**
- Only source code and docs tracked
- Test fixtures excluded (large files)
- Test results excluded (generated)
- Temporary files excluded

### 3. **Logical Organization**
- Related files grouped together
- Clear naming conventions
- Consistent structure

### 4. **Scalability**
- Easy to add new tests
- Easy to add new features
- Easy to find files

## 📝 File Naming Conventions

### Source Files
- `*.html` - HTML files
- `*.js` - JavaScript files
- `*.css` - CSS files
- `*.min.js` - Minified libraries

### Test Files
- `*.spec.js` - Test specifications (Playwright)
- `*.test.js` - Unit tests (Vitest)
- `*.config.js` - Configuration files

### Documentation
- `*.md` - Markdown documentation
- `*_SUMMARY.md` - Summary documents
- `*_ANALYSIS.md` - Analysis documents
- `*_GUIDE.md` - Guide documents

## 🚫 What's NOT in Git

### Excluded by `.gitignore`

**Test Fixtures:**
- `tests/fixtures/*.zip` - Test data (78MB)
- `tests/fixtures/bugreport-*` - Bugreport archives
- `tests/fixtures/dumpState_*` - System dumps

**Test Results:**
- `results/test-results/` - Test artifacts
- `results/playwright-report/` - HTML reports
- `results/logs/*.log` - Log files
- `test-results/` - Legacy results
- `coverage/` - Coverage reports

**Dependencies:**
- `node_modules/` - NPM packages
- `package-lock.json` - Lock file (optional)

**Build Outputs:**
- `dist/` - Build directory
- `build/` - Build directory

**Temporary Files:**
- `*.log` - Log files
- `*.pid` - Process IDs
- `test_*.txt` - Test outputs
- `*_debug*.txt` - Debug files

**IDE & OS:**
- `.vscode/` - VS Code settings
- `.idea/` - IntelliJ settings
- `.DS_Store` - macOS files
- `Thumbs.db` - Windows files

## 📊 Size Breakdown

| Directory | Size (Git) | Size (Disk) | Notes |
|-----------|-----------|-------------|-------|
| `src/` | ~5.5MB | ~5.5MB | All tracked |
| `tests/` | ~100KB | ~78MB | Code only in git |
| `config/` | ~15KB | ~15KB | All tracked |
| `docs/` | ~500KB | ~500KB | All tracked |
| `results/` | ~200KB | ~50MB | Docs only in git |
| **Total** | **~6.3MB** | **~134MB** | 95% reduction |

## 🔧 Maintenance

### Adding New Files

**Source Code:**
```bash
# Add to src/
touch src/new-feature.js
git add src/new-feature.js
```

**Tests:**
```bash
# Add to appropriate test directory
touch tests/e2e/new-feature.spec.js
git add tests/e2e/new-feature.spec.js
```

**Documentation:**
```bash
# Add to docs/
touch docs/NEW_FEATURE.md
git add docs/NEW_FEATURE.md
```

### Updating Structure

1. Move files to appropriate directories
2. Update imports/references
3. Update this documentation
4. Commit changes

### Cleaning Up

```bash
# Remove test results
npm run clean

# Remove node_modules
rm -rf node_modules

# Reinstall dependencies
npm install
```

## ✅ Verification

### Check Structure
```bash
# View directory tree
tree -L 2 -I 'node_modules|.git'

# Check git status
git status

# Check ignored files
git status --ignored
```

### Validate Tests
```bash
# Run all tests
npm run test:all

# Verify test files exist
ls tests/e2e/*.spec.js
ls tests/integration/*.spec.js
ls tests/unit/*.test.js
```

### Check Documentation
```bash
# List all docs
ls docs/*.md

# List all result docs
ls results/*.md
```

## 📚 Related Documentation

- [README.md](../README.md) - Project overview
- [.gitignore](../.gitignore) - Git ignore rules
- [GIT_CLEANUP_SUMMARY.md](../results/GIT_CLEANUP_SUMMARY.md) - Cleanup details
- [COMPREHENSIVE_ENHANCEMENT_SUMMARY.md](../results/COMPREHENSIVE_ENHANCEMENT_SUMMARY.md) - Enhancement summary

## 🎉 Summary

The project structure is now:
- ✅ Clean and organized
- ✅ Logically separated
- ✅ Well documented
- ✅ Git-optimized (6.3MB vs 134MB)
- ✅ Easy to maintain
- ✅ Scalable for growth

**Last Verified:** 2025-12-07 21:38 IST
