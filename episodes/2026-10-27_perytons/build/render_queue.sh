#!/bin/bash
# последовательный рендер глав (по одной — иначе не хватает памяти)
cd "$(dirname "$0")"
while pgrep -f "render.cjs index.html" >/dev/null; do sleep 20; done
for c in "$@"; do rm -rf "$c/_frames"; ./render_ch.sh "$c"; done
