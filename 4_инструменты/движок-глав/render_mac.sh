#!/bin/bash
# Рендер выпуска на Маке: хук и главы параллельно (J одновременно, по умолчанию 3), затем склейка и мастеринг.
# Запуск: J=3 ./render_mac.sh   (черновик 720p30; кадры клипов — в media/, материалы — в ../материалы/)
cd "$(dirname "$0")"
J=${J:-3}
start=$(date +%s)
printf "%s\n" hook ch1 ch2 ch3 ch4 ch5 | xargs -P "$J" -I{} sh -c 'rm -rf {}/_frames; ./render_ch.sh {}'
./assemble.sh
# голос + настоящая музыка (если есть план): звуки глав без процедурной подложки, голос, треки с кроссфейдами и приглушением под голосом
if [ -f music_plan.json ]; then
  for c in hook ch1 ch2 ch3 ch4 ch5; do (cd $c && node ../../../../4_инструменты/анимация-obsion/audio_only.cjs index.html sfx.wav >/dev/null) & done; wait
  python3 ../../../4_инструменты/звук/music_mix.py music_plan.json
  python3 ../../../4_инструменты/звук/srt.py music_plan.json   # субтитры для YouTube рядом с роликом
fi
echo "Всего: $(( ($(date +%s) - start) / 60 )) мин"
