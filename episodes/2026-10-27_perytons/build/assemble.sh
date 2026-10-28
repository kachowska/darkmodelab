#!/bin/bash
# склейка черновика: хук + главы 1–5 (720p30), затем самопроверка
cd "$(dirname "$0")"
printf "file '%s'\n" hook/hook_draft.mp4 ch1/ch1_draft.mp4 ch2/ch2_draft.mp4 ch3/ch3_draft.mp4 ch4/ch4_draft.mp4 ch5/ch5_draft.mp4 > concat.txt
nice ffmpeg -loglevel error -y -threads 2 -f concat -safe 0 -i concat.txt -c:v libx264 -preset veryfast -crf 21 -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -ar 48000 -ac 2 perytons_draft_full.mp4 && echo ASSEMBLED
ffprobe -v error -show_entries format=duration -of csv=p=0 perytons_draft_full.mp4
python3 ../../../templates/obsion/watch.py perytons_draft_full.mp4 watch_full --fps 1 2>&1 | grep -E "Motion|holds|Static|frozen|Audio|Black"
# мастеринг громкости после склейки. На Маке — AAC от Apple (aac_at) держит пик, цель TP −2; иначе ffmpeg aac добавляет ~2–3 дБ, цель TP −4
if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q aac_at; then ACODEC="aac_at"; TP=-2; else ACODEC="aac"; TP=-4; fi
T=$(mktemp -d)
ffmpeg -loglevel error -y -i perytons_draft_full.mp4 -vn -ac 2 -ar 48000 $T/full.wav
python3 ../../../templates/obsion/loudness.py $T/full.wav $T/full_m.wav --tp $TP
ffmpeg -loglevel error -y -i perytons_draft_full.mp4 -i $T/full_m.wav -map 0:v -map 1:a -c:v copy -c:a $ACODEC -b:a 256k perytons_draft_full_m.mp4 && mv perytons_draft_full_m.mp4 perytons_draft_full.mp4
ffmpeg -hide_banner -i perytons_draft_full.mp4 -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:" | tail -2
rm -rf $T
