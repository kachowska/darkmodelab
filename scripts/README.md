# Скрипты (запускаются на Маке, ключи из `.env`)

| Скрипт | Что делает |
|--------|------------|
| `find_assets.py` | По `plan/scenes.json` (сцена → запросы) ищет кандидатов в Klipy, Pixabay, Wikimedia Commons, складывает в `source-media/*/candidates/`, пишет `candidates.md` (контактный лист с источником и лицензией). Ничего не скачивает без `--download`. |
| `kym.py` | Know Your Meme: по названию мема читает страницу (описание, происхождение), сохраняет текст и снимает оригинал картинки headless Chrome. |
| `screenshot.py` | Headless Chrome: скриншот страницы по URL из `sources.csv` (полная страница + область с нужной фразой, если передана). |
| `new_episode.sh` | Копирует `episodes/_template` → `episodes/YYYY-MM-DD_<slug>/`. |

Установка: `pip3 install requests playwright && python3 -m playwright install chromium`
