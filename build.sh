#!/bin/sh
# src/ altındaki parçaları tek dosyalık index.html'de birleştirir.
# Kullanım: ./build.sh [çıktı dosyası]   (varsayılan: index.html)
set -e
cd "$(dirname "$0")"
OUT="${1:-index.html}"
mkdir -p "$(dirname "$OUT")"
# SITE_URL: the site's absolute address (share cards need it: og:image, og:url); the Pages workflow passes its own
SITE_URL="${SITE_URL:-https://mindmash-mt.github.io/Satisfying-Lig/}"
# the favicon goes into the page as a data URI (it also shows in an index.html opened from disk)
ICON=$(tr -d '\n' < public/icon.svg | sed -e 's/  */ /g' -e "s/\"/'/g" -e 's/#/%23/g' -e 's/</%3C/g' -e 's/>/%3E/g')
{
  sed -e "s#__SITE_URL__#$SITE_URL#g" -e "s#__ICON_SVG__#$ICON#" src/00_head.html
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
# a site build (e.g. dist/index.html) gets the static files next to the page: manifest, icons, share image
OUTDIR=$(dirname "$OUT")
if [ "$(cd "$OUTDIR" && pwd)" != "$(pwd)" ]; then cp public/* "$OUTDIR"/; fi
echo "$OUT oluşturuldu ($(wc -c < "$OUT") bayt)"
