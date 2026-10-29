#!/usr/bin/env python3
"""Know Your Meme: описание + оригинал картинки. Использование: 4_инструменты/поиск-материалов/kym.py "<slug или название>" <out_dir>"""
import sys, re, pathlib, requests
from playwright.sync_api import sync_playwright
name, out = sys.argv[1], pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
url = f"https://knowyourmeme.com/memes/{slug}"
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.goto(url, wait_until="domcontentloaded", timeout=60000)
    text = pg.inner_text("body"); (out / f"{slug}.txt").write_text(f"{url}\n\n{text[:6000]}")
    img = pg.query_selector("meta[property='og:image']"); src = img.get_attribute("content") if img else None
    if src: (out / f"{slug}_original.jpg").write_bytes(requests.get(src, timeout=60).content)
    pg.screenshot(path=str(out / f"{slug}_page.png")); b.close()
print("→", out, "| оригинал:", bool(src))
