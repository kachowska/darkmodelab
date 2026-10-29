#!/usr/bin/env python3
"""cutout.py <фото> <вырезка.png> [--box x0,y0,x1,y1] [--keep N] — аккуратная вырезка предмета из настоящего фото.

1. Маска — BiRefNet (rembg, модель birefnet-general; на Маке: .venv/bin/python 4_инструменты/бренд/cutout.py …) на кадре с запасом вокруг предмета.
2. Чистка: остаются только крупные части предмета (мелкие островки и пыль убираются), края уточняются
   по самому фото (guided filter) и чуть подтягиваются внутрь — без ореола фона.
3. Цвет краёв очищается от фона (pymatting estimate_foreground_ml) — нет серой или цветной каймы.
4. Обрезка по предмету + поле 2 %. Дальше — sticker.py (белая обводка).
--box  — где предмет на фото (по умолчанию всё фото); --keep — сколько крупных частей оставить (по умолчанию 1)."""
import sys, argparse, pathlib
import numpy as np, cv2
from PIL import Image
from rembg import new_session, remove
from pymatting import estimate_foreground_ml

ap = argparse.ArgumentParser(); ap.add_argument("src"); ap.add_argument("dst")
ap.add_argument("--box"); ap.add_argument("--keep", type=int, default=1); ap.add_argument("--model", default="birefnet-general")   # нужно ≥ 8 ГБ памяти: запускать на Маке через .venv/bin/python
a = ap.parse_args()
img = Image.open(a.src).convert("RGB"); W, H = img.size
if a.box:
    x0, y0, x1, y1 = map(int, a.box.split(",")); px, py = int((x1 - x0) * .08), int((y1 - y0) * .08)
    x0, y0, x1, y1 = max(0, x0 - px), max(0, y0 - py), min(W, x1 + px), min(H, y1 + py); img = img.crop((x0, y0, x1, y1))
if max(img.size) > 2000: img.thumbnail((2000, 2000), Image.LANCZOS)   # больше не нужно для ролика 1080p
rgb = np.asarray(img).astype(np.float32) / 255
mask = np.asarray(remove(img, session=new_session(a.model), only_mask=True)).astype(np.float32) / 255

# 1) только крупные части предмета
bin_ = (mask > .5).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(bin_, 8)
order = sorted(range(1, n), key=lambda i: -st[i, cv2.CC_STAT_AREA])
big = st[order[0], cv2.CC_STAT_AREA] if order else 0
keep = [i for i in order[:max(1, a.keep)]] + [i for i in order[a.keep:] if st[i, cv2.CC_STAT_AREA] > big * .08]
region = cv2.dilate(np.isin(lab, keep).astype(np.uint8), np.ones((9, 9), np.uint8))
mask *= region
# 2) края по фото и без ореола
guide = cv2.cvtColor((rgb * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)
r = max(2, round(min(img.size) / 400))
mask = cv2.ximgproc.guidedFilter(guide, mask, r, 1e-3)
mask = np.clip((mask - .12) / .8, 0, 1)
# 3) цвет краёв без фона
fg = estimate_foreground_ml(rgb.astype(np.float64), mask.astype(np.float64))
out = np.dstack([np.clip(fg, 0, 1), mask])
ys, xs = np.where(mask > .02)
pad = round(max(img.size) * .02)
y0, y1, x0, x1 = max(0, ys.min() - pad), min(mask.shape[0], ys.max() + pad), max(0, xs.min() - pad), min(mask.shape[1], xs.max() + pad)
Image.fromarray((out[y0:y1, x0:x1] * 255).astype(np.uint8), "RGBA").save(a.dst)
print(a.dst, x1 - x0, "×", y1 - y0)
