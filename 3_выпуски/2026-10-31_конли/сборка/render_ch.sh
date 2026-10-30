#!/bin/bash
# рендер главы: черновик 1280×720 30 fps (jpeg-кадры) или FINAL=1 — финал 1920×1080 60 fps (кадры сразу в ffmpeg, без папки кадров); затем самопроверка
cd "$(dirname "$0")/$1" || exit 1
if [ "$FINAL" = 1 ]; then OUT="$1_final.mp4"; ARGS="--fps 60 --w 1920 --h 1080 --pipe"; else OUT="$1_draft.mp4"; ARGS="--fps 30 --w 1280 --h 720 --r720 --jpeg"; fi
node ../../../../4_инструменты/анимация-obsion/render.cjs index.html $ARGS --out "$OUT" > render.log 2>&1
echo "$1 EXIT $?"; tail -c 250 render.log
python3 ../../../../4_инструменты/анимация-obsion/watch.py "$OUT" watch --fps 1 2>&1 | grep -E "Motion|holds|Static|frozen|Audio"
