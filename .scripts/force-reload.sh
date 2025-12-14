#!/bin/bash

echo "🔄 Forcing Vite dev server to reload..."

# Touch the main files to trigger HMR
touch Production/src/filters/FilterManager.js
touch Production/src/ui/tabs/BtsnoopTab.js
touch Production/src/main.js

echo "✅ Files touched - Vite should hot-reload now"
echo ""
echo "If issues persist:"
echo "1. Hard refresh browser: Ctrl+Shift+R (or Cmd+Shift+R on Mac)"
echo "2. Clear browser cache"
echo "3. Or restart dev server: Ctrl+C then 'npm run dev'"
