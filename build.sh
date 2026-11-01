#!/bin/sh
# src/ altındaki parçaları tek dosyalık index.html'de birleştirir.
# Kullanım: ./build.sh [çıktı dosyası]   (varsayılan: index.html)
set -e
cd "$(dirname "$0")"
OUT="${1:-index.html}"
{
  cat src/00_head.html
  for f in src/01_core.js src/02_sim.js src/03_fx_audio.js src/04_render.js src/05_app.js src/06_offline.js; do cat "$f"; echo; done
  printf '</script>\n</body>\n</html>\n'
} > "$OUT"
echo "$OUT oluşturuldu ($(wc -c < "$OUT") bayt)"
