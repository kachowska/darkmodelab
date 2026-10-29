#!/usr/bin/env python3
"""sticker.py <вырезка.png> [...] — вырезка → стикер: ровная белая обводка по силуэту (≈ 1,3 % размера),
сглаженная, без «лесенки», с белой подложкой внутри контура (сетка тарелки, просветы закрыты, как у наклейки).
Пишет рядом в папку стикеры/<имя>.png. Тень даёт CSS (.obj в dml.css). Вырезку делает cutout.py."""
import sys, pathlib
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as nd
PAPER = (246, 244, 238)
for arg in sys.argv[1:]:
    src = pathlib.Path(arg); im = Image.open(src).convert("RGBA"); A = np.asarray(im).astype(np.float32) / 255
    r = max(6, round(max(im.size) * .013)); pad = r * 3
    a = np.pad(A[..., 3], pad)
    sil = a > .35
    # силуэт без дыр и без мелких зазубрин: закрытие + заливка дыр + сглаживание контура
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    sil = cv2.morphologyEx(sil.astype(np.uint8), cv2.MORPH_CLOSE, k) > 0
    sil = nd.binary_fill_holes(sil)
    sil = cv2.GaussianBlur(sil.astype(np.float32), (0, 0), r * .6) > .5
    # обводка = расстояние до силуэта ≤ r, край со сглаживанием в 1 px
    d = nd.distance_transform_edt(~sil)
    outer = np.clip(r + .5 - d, 0, 1)
    base = np.zeros(outer.shape + (4,), np.float32); base[..., :3] = np.array(PAPER) / 255; base[..., 3] = outer
    fg = np.zeros_like(base); fg[pad:pad + im.height, pad:pad + im.width] = A
    out = fg[..., 3:4] * fg[..., :3] + (1 - fg[..., 3:4]) * base[..., :3]
    alpha = fg[..., 3] + (1 - fg[..., 3]) * base[..., 3]
    res = np.dstack([out, alpha])
    dst = src.parent / "стикеры" / src.name; dst.parent.mkdir(exist_ok=True)
    Image.fromarray((np.clip(res, 0, 1) * 255).astype(np.uint8), "RGBA").save(dst)
    print(dst, im.width + 2 * pad, "×", im.height + 2 * pad)
