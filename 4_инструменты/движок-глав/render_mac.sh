#!/bin/bash
# Рендер выпуска на Маке: хук и главы параллельно (J одновременно, по умолчанию 3), затем склейка и мастеринг.
# Запуск: J=3 ./render_mac.sh — черновик 720p30;  FINAL=1 J=3 ./render_mac.sh — финал 1080p60 → готово/<final из music_plan.json>
cd "$(dirname "$0")"
J=${J:-3}
CH=$(python3 -c "import json;print(' '.join(json.load(open('music_plan.json'))['chapters']))" 2>/dev/null || echo hook intro ch1 ch2 ch3 ch4 ch5)   # порядок глав — из music_plan.json
start=$(date +%s)
printf "%s\n" $CH | xargs -P "$J" -I{} sh -c 'rm -rf {}/_frames; ./render_ch.sh {}'
./assemble.sh
# голос + настоящая музыка (если есть план): звуки глав без процедурной подложки, голос, треки с кроссфейдами и приглушением под голосом
if [ -f music_plan.json ]; then
  for c in $CH; do (cd $c && node ../../../../4_инструменты/анимация-obsion/audio_only.cjs index.html sfx.wav >/dev/null) & done; wait
  if [ "$FINAL" = 1 ]; then MIX="--video _без-музыки_финал.mp4 --out ../готово/$(python3 -c "import json;print(json.load(open('music_plan.json'))['final'])")"; else MIX=""; fi
  python3 ../../../4_инструменты/звук/music_mix.py music_plan.json $MIX
  python3 ../../../4_инструменты/звук/srt.py music_plan.json $( [ "$FINAL" = 1 ] && echo "../готово/$(python3 -c "import json;print(json.load(open('music_plan.json'))['final'].replace('.mp4','.srt'))")" )   # субтитры для YouTube рядом с роликом
fi
echo "Всего: $(( ($(date +%s) - start) / 60 )) мин"
