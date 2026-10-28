# Движок глав Dark Mode Lab (эталон — выпуск «Перитоны», 28.10.2026)

Копируется в `episodes/<выпуск>/build/` в начале сборки: `lib/` ← dml.js, dml.css, prep_media.py; в `build/` ← render_ch.sh, render_mac.sh, assemble.sh.

- `dml.js` — слова и тайминг под голос (`DML.words`, `wt('слово')`), клипы и гифки покадрово (`DML.seqs`), пыль и «дыхание» объектов, **перебивки** `DML.inserts(tl, EV, [[t, 'seq:имя' | 'файл', dur, 'full'|'tilt'|'circ', подпись, css]])`.
- `dml.css` — общие стили: документы, полароиды, мемы, старый телевизор, круги, перебивки.
- `prep_media.py spec.json` — клипы и гифки → кадры в `build/media/<имя>/` + `meta.js`.
- Глава = `build/chN/index.html` (эталоны — главы «Перитонов»): SENT → `DML.words`, сцены `show/ent/slam/meme`, камера `CAMLIFE`, звук `EV` + `SFX`, `window.__seek` возвращает `DML.seqs`.
- Перед рендером — `node templates/obsion/pace_check.cjs build/chN/index.html` (цели — раздел «Темп» библии стиля).
- Рендер на Маке: `J=4 build/render_mac.sh` (≈ 12 мин на выпуск 10 мин), склейка и мастеринг — `assemble.sh`.
- Первичная настройка Мака — `scripts/setup_mac_render.sh`.
