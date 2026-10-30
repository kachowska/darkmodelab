#!/bin/bash
# склейка черновика: главы по порядку из music_plan.json (720p30), затем самопроверка
cd "$(dirname "$0")"
CH=$(python3 -c "import json;print(' '.join(json.load(open('music_plan.json'))['chapters']))" 2>/dev/null || echo hook intro ch1 ch2 ch3 ch4 ch5)   # порядок глав — из music_plan.json
if [ "$FINAL" = 1 ]; then SUF=final; V=_без-музыки_финал.mp4; else SUF=draft; V=_без-музыки.mp4; fi
for c in $CH; do echo "file '$c/${c}_$SUF.mp4'"; done > concat.txt
if [ "$FINAL" = 1 ]; then   # финал: главы одного формата — склейка без перекодирования
  nice ffmpeg -loglevel error -y -f concat -safe 0 -i concat.txt -c copy -movflags +faststart $V && echo ASSEMBLED
else
  nice ffmpeg -loglevel error -y -threads 2 -f concat -safe 0 -i concat.txt -c:v libx264 -preset veryfast -crf 21 -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -ar 48000 -ac 2 $V && echo ASSEMBLED
fi
ffprobe -v error -show_entries format=duration -of csv=p=0 $V
python3 ../../../4_инструменты/анимация-obsion/watch.py $V watch_full --fps 1 2>&1 | grep -E "Motion|holds|Static|frozen|Audio|Black"
[ "$FINAL" = 1 ] && exit 0   # финал: звук целиком делает music_mix.py
# мастеринг громкости после склейки: AAC добавляет ~2–3 дБ пика на щелчках SFX, поэтому цель TP в WAV −4,5 (в mp4 выходит ≈ −2…−3)
if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q aac_at; then ACODEC="aac_at"; TP=-4.5; else ACODEC="aac"; TP=-4.5; fi
T=$(mktemp -d)
ffmpeg -loglevel error -y -i $V -vn -ac 2 -ar 48000 $T/full.wav
python3 ../../../4_инструменты/анимация-obsion/loudness.py $T/full.wav $T/full_m.wav --tp $TP
ffmpeg -loglevel error -y -i $V -i $T/full_m.wav -map 0:v -map 1:a -c:v copy -c:a $ACODEC -b:a 256k _без-музыки_m.mp4 && mv _без-музыки_m.mp4 $V
ffmpeg -hide_banner -i $V -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:" | tail -2
rm -rf $T
