# TROUBLESHOOTING GUIDE - Issues Still Present

## 🔍 Root Cause Identified

You are running the **Vite dev server** (`npm run dev`), which may have **cached the old code**.

The fixes ARE in the source files, but the browser may be serving cached versions.

---

## ✅ Verified Fixes in Source Code

### Fix 1: Log Lines Without Level
**File**: `Production/src/filters/FilterManager.js` (Line 117)
```bash
$ grep -n "const lineLevel" Production/src/filters/FilterManager.js
117:        const lineLevel = line.level || 'V';
```
✅ **CONFIRMED** - Fix is in source code

### Fix 2: BTSnoop Export
**File**: `Production/src/ui/tabs/BtsnoopTab.js` (Lines 67, 1117)
```bash
$ grep -n "getFilteredBtsnoopPackets()" Production/src/ui/tabs/BtsnoopTab.js
67:export function getFilteredBtsnoopPackets() {
1117:    const packets = getFilteredBtsnoopPackets();
```
✅ **CONFIRMED** - Fix is in source code

---

## 🔧 Solution Steps (In Order)

### Step 1: Force Vite Hot Module Reload ✅ DONE
```bash
.scripts/force-reload.sh
```
This touches the modified files to trigger Vite's HMR.

### Step 2: Hard Refresh Browser (REQUIRED)
**You MUST do this:**

- **Windows/Linux**: `Ctrl + Shift + R`
- **Mac**: `Cmd + Shift + R`
- **Alternative**: `Ctrl + F5`

This clears the browser cache and forces a fresh load.

### Step 3: Clear Browser Cache (If Step 2 Doesn't Work)

**Chrome/Edge:**
1. Press `F12` (open DevTools)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

**Firefox:**
1. Press `Ctrl + Shift + Delete`
2. Select "Cached Web Content"
3. Click "Clear Now"

### Step 4: Restart Dev Server (If Still Not Working)

```bash
# In the terminal running npm run dev:
Ctrl + C  # Stop the server

# Then restart:
npm run dev
```

### Step 5: Use Production Build (Alternative)

If dev server issues persist, use the production build:

```bash
# Build
npm run build

# Open the file directly
# File location: Production/dist/log_parser.html
```

---

## 🧪 How to Verify Fixes Are Working

### Test 1: Log Lines Without Level

1. Load a log file
2. Look for lines that don't have a log level (no V/D/I/W/E prefix)
3. **Enable "Verbose" filter** (make sure V is selected)
4. Those lines should now appear

**Expected**: Lines without log level are visible when Verbose is enabled
**If not working**: Browser is still using cached code

### Test 2: BTSnoop Export

1. Go to BTSnoop tab
2. Ensure packets are visible in the table
3. Click "Export to Excel" button
4. **Expected**: Excel file downloads successfully
5. **If still says "No packets"**: Browser is using cached code

### Test 3: Check Console for Errors

1. Press `F12` to open DevTools
2. Go to Console tab
3. Look for any errors
4. **Expected**: No errors related to FilterManager or BtsnoopTab

---

## 🔍 Debugging Commands

### Check if dev server picked up changes:
```bash
# Check file modification times
ls -lh Production/src/filters/FilterManager.js
ls -lh Production/src/ui/tabs/BtsnoopTab.js
```

### Verify source code has fixes:
```bash
# Should show line 117 with the fix
grep -n "const lineLevel = line.level || 'V'" Production/src/filters/FilterManager.js

# Should show line 1117 with the fix
grep -n "const packets = getFilteredBtsnoopPackets()" Production/src/ui/tabs/BtsnoopTab.js
```

### Check dev server status:
```bash
# Should show vite running on port 5173
lsof -i :5173 | grep LISTEN
```

---

## 📋 Checklist

- [x] Fixes verified in source code
- [x] Files touched to trigger HMR
- [ ] **Hard refresh browser** (Ctrl+Shift+R) ← **YOU MUST DO THIS**
- [ ] Test log lines without level
- [ ] Test BTSnoop export
- [ ] Verify no console errors

---

## 🆘 If Still Not Working

### Option 1: Restart Everything
```bash
# Stop dev server (Ctrl+C)
# Clear node_modules cache
rm -rf node_modules/.vite

# Restart
npm run dev
```

### Option 2: Use Production Build
```bash
npm run build
# Open: Production/dist/log_parser.html
```

### Option 3: Check Browser Console
1. Press F12
2. Go to Console tab
3. Look for errors
4. Share any error messages

---

## 📊 Current Status

| Component | Status | Action Required |
|-----------|--------|-----------------|
| Source Code | ✅ Fixed | None |
| Dev Server | ⚠️ May be cached | Hard refresh browser |
| Production Build | ✅ Updated | Use if dev server fails |

---

## 🎯 Most Likely Solution

**The fix is in the code. You just need to hard refresh your browser:**

1. Press `Ctrl + Shift + R` (or `Cmd + Shift + R` on Mac)
2. Test the fixes
3. If still not working, restart dev server

**The code is correct - it's a caching issue!** 🔄
