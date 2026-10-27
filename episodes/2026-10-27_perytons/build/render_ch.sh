#!/bin/bash
# черновой рендер главы: 1280×720, 30 fps, jpeg-кадры; затем самопроверка
cd "$(dirname "$0")/$1" || exit 1
node ../../../../templates/obsion/render.cjs index.html --fps 30 --w 1280 --h 720 --r720 --jpeg --out "$1_draft.mp4" > render.log 2>&1
echo "$1 EXIT $?"; tail -c 250 render.log
python3 ../../../../templates/obsion/watch.py "$1_draft.mp4" watch --fps 1 2>&1 | grep -E "Motion|holds|Static|frozen|Audio"
