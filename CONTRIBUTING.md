# Contributing to Android Log Parser

Thank you for your interest in contributing! This guide will help you get started.

## 🏗️ Development Setup

### Prerequisites
- Node.js 18+ and npm
- Git
- Modern browser (Chrome/Firefox/Safari)

### Setup Steps
```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/Android_log_parser.git
cd Android_log_parser

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev

# 4. Run tests
npm run test
```

## 📋 Code Style

### JavaScript
- **ES6+** modules and syntax
- **No semicolons** (consistent with existing code)
- **2 spaces** for indentation
- **camelCase** for variables and functions
- **PascalCase** for classes

### Example
```javascript
// Good
export function parseLogLine(line) {
    const parts = line.split(' ')
    return { timestamp, level, tag, message }
}

// Bad
export function parse_log_line(line) {
  var parts = line.split(' ');
  return { timestamp, level, tag, message };
}
```

### File Organization
```
Production/src/
├── core/          # State management
├── ui/            # UI components and tabs
├── utils/         # Utility functions
├── infra/         # Workers, DB
└── filters/       # Filtering logic
```

## 🧪 Testing Requirements

### Before Submitting
1. **All tests pass**: `npm run test`
2. **Coverage maintained**: Check `npm run coverage`
3. **Build succeeds**: `npm run build`
4. **Lint clean**: `npm run lint` (if configured)

### Writing Tests

#### Unit Tests (Vitest)
```javascript
// TestScripts/unit/myFeature.test.js
import { describe, it, expect } from 'vitest'
import { myFunction } from '../Production/src/utils/myModule.js'

describe('myFunction', () => {
    it('should process input correctly', () => {
        const result = myFunction('input')
        expect(result).toBe('expected')
    })
})
```

#### E2E Tests (Playwright)
```javascript
// TestScripts/regression/myFeature.spec.js
import { test, expect } from '@playwright/test'

test('should load and parse file', async ({ page }) => {
    await page.goto('/log_parser.html')
    
    const fileInput = page.locator('#logFilesInput')
    await fileInput.setInputFiles('TestData/sample.log')
    
    await expect(page.locator('.log-line').first()).toBeVisible()
})
```

### Coverage Goals
- **Functions**: ≥70% (required)
- **Lines**: ≥50% (goal)
- **Branches**: ≥50% (goal)

## 🔄 Workflow

### 1. Create a Branch
```bash
git checkout -b feature/my-new-feature
# or
git checkout -b fix/bug-description
```

### 2. Make Changes
- Write code following style guide
- Add tests for new functionality
- Update documentation if needed

### 3. Test Locally
```bash
# Run all tests
npm run test

# Check coverage
npm run coverage

# Test production build
npm run build
```

### 4. Commit
```bash
git add .
git commit -m "Add feature: description

- Detailed change 1
- Detailed change 2
- Fixes #123"
```

**Commit message format**:
- Use imperative mood ("Add feature" not "Added feature")
- Reference issues/PRs if applicable
- Keep first line under 72 characters
- Add details in body if needed

### 5. Push and Create PR
```bash
git push origin feature/my-new-feature
```

Then create a Pull Request on GitHub with:
- **Clear title** describing the change
- **Description** of what and why
- **Testing** steps taken
- **Screenshots** if UI changes
- **Related issues** linked

## 🤖 CI/CD

All PRs automatically run:
- ✅ Unit tests
- ✅ E2E tests (Chromium)
- ✅ Production build
- ✅ Coverage reporting

PRs to `main` also trigger deployment to GitHub Pages.

## 🐛 Reporting Bugs

### Before Reporting
1. Search existing issues
2. Try latest version
3. Check if it's reproducible

### Bug Report Template
```markdown
**Describe the bug**
Clear description of what happens

**To Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What should happen

**Screenshots**
If applicable

**Environment**
- Browser: [e.g., Chrome 120]
- OS: [e.g., Windows 11]
- Version: [e.g., commit hash or date]

**Log file**
Attach or link sample file that causes issue (if applicable)
```

## ✨ Feature Requests

Use GitHub Issues with the "enhancement" label:
- Describe the feature and use case
- Explain why it would be useful
- Suggest implementation approach (optional)
- Consider scope and complexity

## 📝 Documentation

### When to Update Docs
- New features added
- API changes
- Configuration changes
- Usage examples

### Documentation Files
- `README.md` - Overview and quick start
- `docs/USER_GUIDE.md` - User-facing features
- `docs/DEVELOPER_GUIDE.md` - Technical details
- `docs/API.md` - Code reference
- Inline comments for complex logic

## 🔍 Code Review Process

### What We Look For
✅ **Functional** - Does it work as described?
✅ **Tested** - Are there tests? Do they pass?
✅ **Style** - Follows code style guide?
✅ **Documentation** - Is it documented?
✅ **Performance** - No obvious performance issues?
✅ **Security** - No security vulnerabilities?

### Review Checklist
- [ ] Code builds successfully
- [ ] All tests pass
- [ ] Coverage maintained or improved
- [ ] Documentation updated
- [ ] No console errors
- [ ] Backwards compatible (or migration noted)

## 🚀 Release Process

(For maintainers)

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Run full test suite
4. Build production: `npm run build`
5. Test production build
6. Commit: `git commit -m "Release vX.Y.Z"`
7. Tag: `git tag vX.Y.Z`
8. Push: `git push && git push --tags`
9. GitHub Actions auto-deploys to Pages

## 💡 Tips for Contributors

### Good First Issues
Look for issues labeled `good-first-issue` - these are beginner-friendly.

### Getting Help
- **Stuck?** Ask in the PR or create a Discussion
- **Not sure?** Propose your approach first
- **Breaking change?** Discuss in an issue first

### Best Practices
- **Small PRs** - Easier to review, faster to merge
- **One concern per PR** - Don't mix features and fixes
- **Test edge cases** - Null values, empty arrays, large datasets
- **Think performance** - This app handles large files

## 📚 Resources

- [Vite Documentation](https://vitejs.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Chart.js Documentation](https://www.chartjs.org/)
- [Web Workers MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)

## 🙌 Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in the README

Thank you for making this project better! 🎉
