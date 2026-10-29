#!/usr/bin/env python3
"""Скриншот страницы headless Chrome. Использование:
   4_инструменты/поиск-материалов/screenshot.py <url> <out.png> [--find "фраза"]   # --find: дополнительно снимает область вокруг фразы (out_zoom.png)
"""
import sys, argparse, pathlib
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser(); ap.add_argument("url"); ap.add_argument("out"); ap.add_argument("--find", default=None)
a = ap.parse_args(); out = pathlib.Path(a.out)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    pg.goto(a.url, wait_until="networkidle", timeout=60000)
    pg.screenshot(path=str(out), full_page=True)
    if a.find:
        loc = pg.get_by_text(a.find, exact=False).first
        try:
            loc.scroll_into_view_if_needed(); box = loc.bounding_box()
            if box:
                pg.screenshot(path=str(out.with_name(out.stem + "_zoom.png")), clip={
                    "x": max(0, box["x"] - 200), "y": max(0, box["y"] - 160), "width": min(1440, box["width"] + 400), "height": box["height"] + 320})
        except Exception as e: print("фраза не найдена:", e)
    b.close()
print("→", out)
