#!/usr/bin/env bash
# Новый выпуск: 4_инструменты/новый-выпуск.sh <slug> [YYYY-MM-DD]
# Копирует 3_выпуски/_шаблон и кладёт в сборку движок глав (lib/ + скрипты рендера).
set -e
cd "$(dirname "$0")/.."
SLUG="${1:?slug}"; DATE="${2:-$(date +%F)}"
DST="3_выпуски/${DATE}_${SLUG}"
[ -e "$DST" ] && { echo "уже есть: $DST"; exit 1; }
cp -R 3_выпуски/_шаблон "$DST"
mkdir -p "$DST/сборка/lib" "$DST/сборка/media" "_черновики/${DATE}_${SLUG}"
cp 4_инструменты/движок-глав/{dml.js,dml.css,prep_media.py} "$DST/сборка/lib/"
cp 4_инструменты/движок-глав/{render_ch.sh,render_mac.sh,assemble.sh} "$DST/сборка/"
find "$DST" -name .gitkeep -delete
echo "создано: $DST  (черновики: _черновики/${DATE}_${SLUG})"
