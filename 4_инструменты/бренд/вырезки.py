#!/usr/bin/env python3
"""вырезки.py <папка материалов выпуска> [имя …] — все вырезки выпуска заново: cutout.py по материалы/вырезки/источники.json
({"имя": {"src": "настоящие/фото.jpg", "box": [x0,y0,x1,y1], "keep": N}}), затем sticker.py → вырезки/стикеры/.
Запуск на Маке (нужно ≥ 8 ГБ памяти): .venv/bin/python 4_инструменты/бренд/вырезки.py 3_выпуски/<выпуск>/материалы"""
import sys, json, subprocess, pathlib
M = pathlib.Path(sys.argv[1]).resolve(); T = pathlib.Path(__file__).resolve().parent
spec = json.load(open(M / "вырезки" / "источники.json")); only = sys.argv[2:]
for name, e in spec.items():
    if only and name not in only: continue
    dst = M / "вырезки" / f"{name}.png"
    cmd = [sys.executable, str(T / "cutout.py"), str(M / e["src"]), str(dst), "--keep", str(e.get("keep", 1))]
    if e.get("box"): cmd += ["--box", ",".join(map(str, e["box"]))]
    subprocess.run(cmd, check=True)
    subprocess.run([sys.executable, str(T / "sticker.py"), str(dst)], check=True)
