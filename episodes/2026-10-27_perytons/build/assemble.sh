#!/bin/bash
# склейка черновика: хук + главы 1–5 (720p30), затем самопроверка
cd "$(dirname "$0")"
printf "file '%s'\n" hook/hook_720.mp4 ch1/ch1_draft.mp4 ch2/ch2_draft.mp4 ch3/ch3_draft.mp4 ch4/ch4_draft.mp4 ch5/ch5_draft.mp4 > concat.txt
nice ffmpeg -loglevel error -y -threads 2 -f concat -safe 0 -i concat.txt -c:v libx264 -preset veryfast -crf 21 -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -ar 48000 -ac 2 perytons_draft_full.mp4 && echo ASSEMBLED
ffprobe -v error -show_entries format=duration -of csv=p=0 perytons_draft_full.mp4
python3 ../../../templates/obsion/watch.py perytons_draft_full.mp4 watch_full --fps 1 2>&1 | grep -E "Motion|holds|Static|frozen|Audio|Black"
