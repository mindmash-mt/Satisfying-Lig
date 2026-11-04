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
  # A changed fingerprint does not reset the league: the Pages workflow freezes it as the BASE (tools/live-base.js).
  FP=$(node tools/live-fingerprint.js 2>/dev/null) || FP="src-$(cat src/*.js | sha1sum | cut -c1-12)"
  printf "const BUILD_SIM_HASH = '%s';\n" "$FP"
  # LIVE_BASE=<file>: the frozen league state the new rules play on from (tools/live-base.js writes dist/live-base.json)
  if [ -n "${LIVE_BASE:-}" ] && [ -f "$LIVE_BASE" ]; then
    printf 'const BUILD_BASE = %s;\n' "$(sed 's#</#<\\/#g' "$LIVE_BASE")"
  else
    echo 'const BUILD_BASE = null;'
  fi
  # LIVE_START_FILE=<file>: the live league's start chosen at its first deploy + the old league's archive (tools/live-start.js)
  if [ -n "${LIVE_START_FILE:-}" ] && [ -f "$LIVE_START_FILE" ]; then
    printf 'const BUILD_START = %s;\n' "$(sed 's#</#<\\/#g' "$LIVE_START_FILE")"
  else
    echo 'const BUILD_START = null;'
  fi
  for f in src/01_core.js src/02_sim.js src/03_fx_audio.js src/04_render.js src/05_app.js src/06_offline.js src/07_live.js; do cat "$f"; echo; done
  printf '</script>\n</body>\n</html>\n'
} > "$OUT"
echo "$OUT oluşturuldu ($(wc -c < "$OUT") bayt)"
