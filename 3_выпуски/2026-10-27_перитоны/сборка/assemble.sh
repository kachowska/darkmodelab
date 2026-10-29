#!/bin/bash
# склейка черновика: главы по порядку из music_plan.json (720p30), затем самопроверка
cd "$(dirname "$0")"
CH=$(python3 -c "import json;print(' '.join(json.load(open('music_plan.json'))['chapters']))" 2>/dev/null || echo hook intro ch1 ch2 ch3 ch4 ch5)   # порядок глав — из music_plan.json
for c in $CH; do echo "file '$c/${c}_draft.mp4'"; done > concat.txt
nice ffmpeg -loglevel error -y -threads 2 -f concat -safe 0 -i concat.txt -c:v libx264 -preset veryfast -crf 21 -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -ar 48000 -ac 2 _без-музыки.mp4 && echo ASSEMBLED
ffprobe -v error -show_entries format=duration -of csv=p=0 _без-музыки.mp4
python3 ../../../4_инструменты/анимация-obsion/watch.py _без-музыки.mp4 watch_full --fps 1 2>&1 | grep -E "Motion|holds|Static|frozen|Audio|Black"
# мастеринг громкости после склейки: AAC добавляет ~2–3 дБ пика на щелчках SFX, поэтому цель TP в WAV −4,5 (в mp4 выходит ≈ −2…−3)
if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q aac_at; then ACODEC="aac_at"; TP=-4.5; else ACODEC="aac"; TP=-4.5; fi
T=$(mktemp -d)
ffmpeg -loglevel error -y -i _без-музыки.mp4 -vn -ac 2 -ar 48000 $T/full.wav
python3 ../../../4_инструменты/анимация-obsion/loudness.py $T/full.wav $T/full_m.wav --tp $TP
ffmpeg -loglevel error -y -i _без-музыки.mp4 -i $T/full_m.wav -map 0:v -map 1:a -c:v copy -c:a $ACODEC -b:a 256k _без-музыки_m.mp4 && mv _без-музыки_m.mp4 _без-музыки.mp4
ffmpeg -hide_banner -i _без-музыки.mp4 -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:" | tail -2
rm -rf $T
