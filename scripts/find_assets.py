#!/usr/bin/env python3
"""
Поиск кандидатов картинок/гифок по сценам выпуска.
Вход:  episodes/<ep>/plan/scenes.json  →  [{"id":"s03","emotion":"absurd","queries":{"gif":["this is fine"],"photo":["wall street trading floor"],"commons":["New York Stock Exchange 2012"]}}, ...]
Выход: episodes/<ep>/source-media/candidates.md + папки candidates/ (только с --download).
Источники: Klipy (гифки + клипы-мемы из фильмов/сериалов mp4), Pixabay (фото/видео), Wikimedia Commons (история/документы, видео),
NASA Image and Video Library (видео/фото NASA — общественное достояние), Internet Archive (старые фильмы, Prelinger — общественное достояние). Ключи из .env.
Ключи сцены: gif, clip, photo, video, commons, commons_video, nasa, archive.
"""
import json, os, sys, pathlib, argparse, urllib.parse
import requests

ROOT = pathlib.Path(__file__).resolve().parents[1]

def load_env():
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1); os.environ.setdefault(k.strip(), v.strip())
load_env()
KLIPY = os.environ.get("KLIPY_API_KEY", "")
PIXABAY = os.environ.get("PIXABAY_API_KEY", "")
UA = {"User-Agent": "darkmodelab/0.1 (asset research; contact via github kachowska)"}

def klipy(q, n=6):
    if not KLIPY: return []
    r = requests.get(f"https://api.klipy.com/api/v1/{KLIPY}/gifs/search",
                     params={"q": q, "per_page": n}, headers=UA, timeout=20)
    if r.status_code != 200: return [{"error": f"klipy {r.status_code}"}]
    out = []
    for it in (r.json().get("data", {}).get("data") or []):
        f = it.get("file", {})
        url = (f.get("hd") or f.get("md") or f.get("sm") or {}).get("gif", {}).get("url") or it.get("url")
        out.append({"src": "klipy", "title": it.get("title", ""), "url": url, "page": it.get("url", ""), "license": "Klipy API terms"})
    return out

def pixabay(q, n=6, video=False):
    if not PIXABAY: return []
    base = "https://pixabay.com/api/videos/" if video else "https://pixabay.com/api/"
    r = requests.get(base, params={"key": PIXABAY, "q": q, "per_page": n, "safesearch": "true"}, headers=UA, timeout=20)
    if r.status_code != 200: return [{"error": f"pixabay {r.status_code}"}]
    out = []
    for h in r.json().get("hits", []):
        url = h.get("largeImageURL") or (h.get("videos", {}).get("medium", {}) or {}).get("url")
        out.append({"src": "pixabay", "title": h.get("tags", ""), "url": url, "page": h.get("pageURL", ""), "license": "Pixabay Content License"})
    return out

def commons(q, n=6):
    r = requests.get("https://commons.wikimedia.org/w/api.php", headers=UA, timeout=20, params={
        "action": "query", "format": "json", "generator": "search", "gsrsearch": q, "gsrnamespace": 6, "gsrlimit": n,
        "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 1600})
    if r.status_code != 200: return [{"error": f"commons {r.status_code}"}]
    out = []
    for p in (r.json().get("query", {}).get("pages", {}) or {}).values():
        ii = (p.get("imageinfo") or [{}])[0]; md = ii.get("extmetadata", {})
        out.append({"src": "commons", "title": p.get("title", ""), "url": ii.get("thumburl") or ii.get("url"),
                    "page": ii.get("descriptionurl", ""),
                    "license": (md.get("LicenseShortName", {}) or {}).get("value", "?"),
                    "author": (md.get("Artist", {}) or {}).get("value", "")})
    return out

def klipy_clips(q, n=6):
    """Клипы-мемы (фильмы, сериалы, шоу) — mp4, часто со звуком. Правило устава: ≤ 3 с, свой звук поверх."""
    if not KLIPY: return []
    r = requests.get(f"https://api.klipy.com/api/v1/{KLIPY}/clips/search", params={"q": q, "per_page": n}, headers=UA, timeout=20)
    if r.status_code != 200: return [{"error": f"klipy clips {r.status_code}"}]
    out = []
    for it in (r.json().get("data", {}).get("data") or []):
        f = it.get("file", {}) or {}
        out.append({"src": "klipy-clip", "title": it.get("title", ""), "url": f.get("mp4") or f.get("gif"), "page": it.get("url", ""),
                    "license": "Klipy API terms; чужой клип: ≤ 3 с, звук свой", "kind": "video"})
    return out

def commons_video(q, n=6):
    return [dict(x, src="commons-video", kind="video") for x in commons(q + " filetype:video", n)]

def nasa(q, n=6, media="video"):
    r = requests.get("https://images-api.nasa.gov/search", params={"q": q, "media_type": media}, headers=UA, timeout=30)
    if r.status_code != 200: return [{"error": f"nasa {r.status_code}"}]
    out = []
    for it in r.json().get("collection", {}).get("items", [])[:n]:
        d = (it.get("data") or [{}])[0]; nid = d.get("nasa_id", "")
        out.append({"src": "nasa", "title": d.get("title", ""), "url": it.get("href", ""), "page": f"https://images.nasa.gov/details/{nid}",
                    "license": "NASA — общественное достояние (логотипы и люди — с оговорками)", "kind": media})
    return out

def archive(q, n=6):
    r = requests.get("https://archive.org/advancedsearch.php", headers=UA, timeout=30, params={
        "q": f"({q}) AND mediatype:movies AND (collection:prelinger OR licenseurl:*publicdomain*)", "fl[]": ["identifier", "title", "licenseurl"], "rows": n, "output": "json"})
    if r.status_code != 200: return [{"error": f"archive {r.status_code}"}]
    return [{"src": "archive", "title": x.get("title", ""), "url": f"https://archive.org/download/{x['identifier']}", "page": f"https://archive.org/details/{x['identifier']}",
             "license": x.get("licenseurl") or "Prelinger — общественное достояние", "kind": "video"} for x in r.json()["response"]["docs"]]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode", help="папка выпуска, напр. episodes/2026-11-03_knight-capital")
    ap.add_argument("--download", action="store_true", help="скачать кандидатов (только после ОК пользователя)")
    a = ap.parse_args()
    ep = ROOT / a.episode
    scenes = json.loads((ep / "plan" / "scenes.json").read_text())
    lines = ["# Контактный лист кандидатов", "", "Ничего не скачано без --download. Выбери номера → скажи Claude.", ""]
    for s in scenes:
        lines.append(f"## {s['id']} · эмоция: {s.get('emotion','—')}")
        qs = s.get("queries", {})
        found = []
        for q in qs.get("gif", []):   found += klipy(q)
        for q in qs.get("photo", []): found += pixabay(q)
        for q in qs.get("video", []): found += pixabay(q, video=True)
        for q in qs.get("commons", []): found += commons(q)
        for q in qs.get("clip", []): found += klipy_clips(q)
        for q in qs.get("commons_video", []): found += commons_video(q)
        for q in qs.get("nasa", []): found += nasa(q)
        for q in qs.get("archive", []): found += archive(q)
        for i, f in enumerate(found, 1):
            if "error" in f: lines.append(f"- ⚠ {f['error']}"); continue
            lines.append(f"{i}. [{f['src']}] {f['title'][:60]} — {f['url']}  · лицензия: {f['license']}  · стр.: {f['page']}")
            if a.download and f.get("url"):
                d = ep / "source-media" / ("memes" if f["src"].startswith("klipy") else "real") / "candidates"; d.mkdir(parents=True, exist_ok=True)
                ext = pathlib.Path(urllib.parse.urlparse(f["url"]).path).suffix or ".bin"
                fn = d / f"{s['id']}_{f['src']}_{i}{ext}"
                try:
                    fn.write_bytes(requests.get(f["url"], headers=UA, timeout=60).content)
                except Exception as e:
                    lines.append(f"   ⚠ не скачалось: {e}")
        lines.append("")
    (ep / "source-media").mkdir(parents=True, exist_ok=True)
    (ep / "source-media" / "candidates.md").write_text("\n".join(lines))
    print("→", ep / "source-media" / "candidates.md")

if __name__ == "__main__": main()
