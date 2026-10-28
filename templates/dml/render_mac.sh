#!/bin/bash
# Рендер выпуска на Маке: хук и главы параллельно (J одновременно, по умолчанию 3), затем склейка и мастеринг.
# Запуск: J=3 ./render_mac.sh   (черновик 720p30; кадры клипов — в media/, материалы — в ../source-media/)
cd "$(dirname "$0")"
J=${J:-3}
start=$(date +%s)
printf "%s\n" hook ch1 ch2 ch3 ch4 ch5 | xargs -P "$J" -I{} sh -c 'rm -rf {}/_frames; ./render_ch.sh {}'
./assemble.sh
echo "Всего: $(( ($(date +%s) - start) / 60 )) мин"
