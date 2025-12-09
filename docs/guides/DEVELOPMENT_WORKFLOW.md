# Development to Production Workflow

This guide explains how to develop features and promote them to production.

## Workflow Overview

```
Development/ (local only)
    ↓ develop & test
    ↓ verify quality
Production/ (tracked in Git)
    ↓ build
Production/dist/ (tracked in Git, ready to distribute)
```

## Step-by-Step Process

### 1. Develop in Development/

```bash
# Work on new features in Development/
cd Development/src/
# Edit files, experiment, prototype

# Test locally
npm run dev
# Opens from Production/ but you can test Development/ code separately
```

### 2. Test Thoroughly

```bash
# Run all tests
npm run test:unit
npm run test:regression
npm run test:all

# Manual testing
npm run dev
# Test the feature thoroughly
```

### 3. Promote to Production

```bash
# Copy stable code from Development/ to Production/
cp Development/src/new-feature.js Production/src/

# Or move entire feature
cp -r Development/src/components/NewComponent Production/src/components/
```

### 4. Build for Distribution

```bash
# Build production bundle
npm run build
# This creates Production/dist/ with optimized files

# Verify build works
cd Production/dist/
# Open index.html in browser to test
```

### 5. Commit to Git

```bash
# Stage Production code and dist
git add Production/src/
git add Production/dist/

# Commit
git commit -m "Add new feature: XYZ"

# Push
git push origin main
```

## What Gets Tracked in Git

✅ **Tracked:**
- `Production/src/` - Source code
- `Production/dist/` - Built files (ready to use)
- `Production/index.html` - Entry point

❌ **Not Tracked:**
- `Development/` - Local experiments only
- `temp/` - Scratchpad
- `TestData/` - Test fixtures
- `node_modules/` - Dependencies

## Distribution

Users can use the app by:

**Option 1: Clone and Use**
```bash
git clone <repo-url>
cd Android_log_parser/Production/dist/
# Open index.html in browser
```

**Option 2: Download Release**
```bash
# Download from GitHub Releases
# Extract ZIP
# Open Production/dist/index.html
```

**Option 3: GitHub Pages** (Optional)
```bash
# Serve Production/dist/ directly from GitHub Pages
# Users access via: https://username.github.io/repo-name/
```

## Tips

### Keep Development/ Clean
```bash
# Periodically clean up Development/
rm -rf Development/src/*
# Start fresh for new features
```

### Verify Before Promoting
```bash
# Checklist before moving to Production:
# ✅ All tests pass
# ✅ Code is documented
# ✅ No console errors
# ✅ Feature works as expected
# ✅ Code is optimized
```

### Build Verification
```bash
# After building, always test Production/dist/
cd Production/dist/
python3 -m http.server 8000
# Open http://localhost:8000
# Test thoroughly
```

## Example: Adding a New Feature

```bash
# 1. Develop
cd Development/src/
vim new-feature.js
# Write code

# 2. Test
npm run test:unit
npm run dev

# 3. Promote
cp Development/src/new-feature.js Production/src/

# 4. Build
npm run build

# 5. Verify
cd Production/dist/
# Test in browser

# 6. Commit
git add Production/
git commit -m "Add new feature"
git push
```

## Clean Script

```bash
# Clean all build artifacts and temp files
npm run clean

# This removes:
# - TestReports/
# - dist/ (root level, not Production/dist/)
# - coverage/
# - temp/*
```

## Summary

- **Develop** in `Development/` (not tracked)
- **Test** thoroughly
- **Promote** to `Production/` when stable
- **Build** to `Production/dist/`
- **Commit** both source and dist
- **Distribute** Production/dist/ to users

This workflow ensures:
- Clean separation of experimental vs stable code
- Easy distribution (users get ready-to-use files)
- Version control of both source and built files
- No build step required for end users
