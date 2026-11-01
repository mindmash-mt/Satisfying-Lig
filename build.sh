#!/bin/sh
# src/ altındaki parçaları tek dosyalık index.html'de birleştirir.
set -e
cd "$(dirname "$0")"
{
  cat src/00_head.html
  for f in src/01_core.js src/02_sim.js src/03_fx_audio.js src/04_render.js src/05_app.js; do cat "$f"; echo; done
  printf '</script>\n</body>\n</html>\n'
} > index.html
echo "index.html oluşturuldu ($(wc -c < index.html) bayt)"
