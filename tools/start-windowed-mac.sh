#!/usr/bin/env bash
# Avvia BagIdea Office in una finestra normale su macOS (non come sfondo).
# Disattiva lo shim dello sfondo rinominandolo, poi avvia con BAGIDEA_WINDOWED=1.
# Per tornare allo sfondo: rinomina libwallpaper_shim.dylib.off in libwallpaper_shim.dylib
# e avvia con `bagidea start`.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHIM="$ROOT/shell/macos/libwallpaper_shim.dylib"
if [ -f "$SHIM" ]; then
  mv "$SHIM" "$SHIM.off"
  echo "Shim dello sfondo disattivato"
fi
BAGIDEA_WINDOWED=1 "$ROOT/bin/bagidea" start
