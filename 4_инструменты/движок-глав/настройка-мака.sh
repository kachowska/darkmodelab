#!/bin/bash
# Подготовка Мака к рендеру роликов (один раз): Node + Playwright (Chromium) + ElevenLabs SDK + ffmpeg + Python 3.
set -e
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo "Нужен Node.js: brew install node"; exit 1; }
command -v ffmpeg >/dev/null || { echo "Нужен ffmpeg: brew install ffmpeg"; exit 1; }
command -v python3 >/dev/null || { echo "Нужен Python 3"; exit 1; }
[ -f package.json ] || npm init -y >/dev/null
npm install --silent playwright@1.63.0 @elevenlabs/elevenlabs-js   # обе в package.json: npm install без них удаляет «лишние» пакеты
npx playwright install chromium
echo "Готово: node $(node -v), ffmpeg $(ffmpeg -version | head -1 | cut -d' ' -f3), playwright 1.63.0"
