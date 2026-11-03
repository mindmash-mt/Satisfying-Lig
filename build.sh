#!/bin/sh
# src/ altındaki parçaları tek dosyalık index.html'de birleştirir.
# Kullanım: ./build.sh [çıktı dosyası]   (varsayılan: index.html)
set -e
cd "$(dirname "$0")"
OUT="${1:-index.html}"
{
  cat src/00_head.html
  # live league caches (localStorage, live-state.json) are only valid for the same RESULTS: fingerprint of the
  # simulation (tools/live-fingerprint.js). Without Node: a hash of the sources (always safe, but any edit drops the caches).
  FP=$(node tools/live-fingerprint.js 2>/dev/null) || FP="src-$(cat src/*.js | sha1sum | cut -c1-12)"
  printf "const BUILD_SIM_HASH = '%s';\n" "$FP"
  for f in src/01_core.js src/02_sim.js src/03_fx_audio.js src/04_render.js src/05_app.js src/06_offline.js src/07_live.js; do cat "$f"; echo; done
  printf '</script>\n</body>\n</html>\n'
} > "$OUT"
echo "$OUT oluşturuldu ($(wc -c < "$OUT") bayt)"
