# CI/CD Dev Server URL Issue

## Current Status
Working on fixing CI/CD test failures. User indicated "the dev url is wrong" but needs clarification on what the correct URL should be.

## Current Configuration

### Vite Config
- **Root**: `Production/src`
- **Dev Server Port**: 5173
- **File Location**: `Production/src/log_parser.html`

### Test Configuration
- **Base URL**: `http://localhost:5173`
- **Tests navigate to**: `/log_parser.html`
- **Full URL**: `http://localhost:5173/log_parser.html`

### CI/CD Workflow Attempts

#### Attempt 1 (Failed)
- Used `npm run build`
- **Issue**: Tests need dev server, not production build

#### Attempt 2 (Failed)
- Started dev server with `npm run dev &`
- Used `wait-on http://localhost:5173`
- **Issue**: Background process didn't persist + localhost IPv6 issue

#### Attempt 3 (Current - Not Yet Pushed)
- Using `nohup npm run dev > /dev/null 2>&1 &`
- Using `wait-on http://127.0.0.1:5173`
- **Status**: Committed but not pushed, waiting for clarification

## Questions for User

1. **What is the correct dev server URL?**
   - Should it be `http://localhost:5173/log_parser.html`?
   - Or a different path like `/` or `/index.html`?

2. **Is the issue with the URL path or the server startup?**
   - URL path problem?
   - Server not starting correctly in CI?

3. **Should we use a different approach?**
   - Serve from a different directory?
   - Use preview mode instead of dev mode?

## Next Steps (Pending User Input)
- Get clarification on correct URL
- Update CI/CD workflow accordingly
- Push fix and monitor results
