#!/usr/bin/env python3
"""Гифка → кадры PNG + тайминг для покадрового рендера (гифки в render.cjs сами не играют).
Использование: 4_инструменты/поиск-материалов/gif_frames.py <file.gif> [<out_dir>]
Пишет <out_dir>/<name>/f000.png… и <name>.json: {"frames": N, "delays": [сек…], "dur": сек, "w":…, "h":…}.
В сцене: кадр = индекс по (t - t0) % dur — см. GIFS в build/*/index.html."""
import sys, json, pathlib
from PIL import Image, ImageSequence
src = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else src.parent / "_gif") / src.stem
out.mkdir(parents=True, exist_ok=True)
im = Image.open(src); delays = []
for i, fr in enumerate(ImageSequence.Iterator(im)):
    fr.convert("RGBA").save(out / f"f{i:03d}.png"); delays.append(max(0.02, (fr.info.get("duration") or 100) / 1000))
meta = {"frames": len(delays), "delays": delays, "dur": round(sum(delays), 3), "w": im.width, "h": im.height}
(out.parent / f"{src.stem}.json").write_text(json.dumps(meta))
print(src.name, "→", meta["frames"], "кадров,", meta["dur"], "с")
