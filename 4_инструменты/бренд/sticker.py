#!/usr/bin/env python3
"""sticker.py <вырезка.png> [...] — вырезка → стикер: белая обводка по силуэту (≈ 1,2 % ширины), дырки внутри силуэта
(сетка тарелки, просветы) закрыты белой подложкой, как у вырезанной наклейки. Пишет рядом в папку стикеры/<имя>.png.
Тень даёт CSS (.obj в dml.css)."""
import sys, pathlib
import numpy as np
from PIL import Image
from scipy import ndimage as nd
for a in sys.argv[1:]:
    src = pathlib.Path(a); im = Image.open(src).convert("RGBA"); A = np.array(im)
    alpha = A[..., 3] > 40
    r = max(5, round(im.width * 0.012))
    disk = np.hypot(*np.mgrid[-r:r + 1, -r:r + 1]) <= r
    sil = nd.binary_fill_holes(nd.binary_closing(alpha, structure=disk, iterations=2))   # силуэт без дыр
    outer = nd.binary_dilation(sil, structure=disk)                                        # + обводка
    pad = r * 2; W, H = im.width + pad * 2, im.height + pad * 2
    out = np.zeros((H, W, 4), np.uint8)
    o = np.zeros((H, W), bool); o[pad:pad + im.height, pad:pad + im.width] = outer
    o = nd.binary_dilation(o, structure=disk, iterations=1) if False else o
    out[o] = [246, 244, 238, 255]
    base = Image.fromarray(out); base.alpha_composite(im, (pad, pad))
    dst = src.parent / "стикеры" / src.name; dst.parent.mkdir(exist_ok=True); base.save(dst)
    print(dst, base.size)
