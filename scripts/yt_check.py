#!/usr/bin/env python3
"""Проверка темы фильтром «ИИ-копии ещё не дошли»: сколько роликов вышло за N дней (EN и RU) и сколько они набрали.

Ключ: YOUTUBE_API_KEY в .env (YouTube Data API v3, бесплатно: 10 000 единиц в день; одна тема EN+RU ≈ 202 единицы).

Использование:
  scripts/yt_check.py topics.txt [--days 90] [--out lab/yt_check.md]
Формат topics.txt — по строке на тему, поля через « | »:
  Тема | EN-запрос | RU-запрос | слова-фильтр (необязательно, через запятую)
  Перитоны | perytons parkes microwave | перитоны микроволновка телескоп | peryton,перитон,parkes,microwave,микроволнов
Слова-фильтр: ролик засчитывается, только если в названии или описании есть хотя бы одно из них
(отсекает нерелевантную выдачу). Итог: таблица Markdown + вердикт по правилу ≤ 3 в каждом языке.
"""
import argparse, json, os, pathlib, sys, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
API = "https://www.googleapis.com/youtube/v3/"


def env_key():
    for line in (ROOT / ".env").read_text().splitlines() if (ROOT / ".env").exists() else []:
        if line.startswith("YOUTUBE_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"')
    return os.environ.get("YOUTUBE_API_KEY")


def get(path, **params):
    url = API + path + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)


def check(key, query, lang, days, words):
    after = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    s = get("search", key=key, part="snippet", q=query, type="video", maxResults=50,
            publishedAfter=after, relevanceLanguage=lang, order="relevance")
    items = s.get("items", [])
    if words:
        w = [x.lower() for x in words]
        items = [i for i in items if any(t in (i["snippet"]["title"] + " " + i["snippet"]["description"]).lower() for t in w)]
    if not items:
        return []
    ids = ",".join(i["id"]["videoId"] for i in items)
    v = get("videos", key=key, part="statistics,snippet", id=ids)
    out = []
    for it in v.get("items", []):
        out.append({"title": it["snippet"]["title"][:70], "channel": it["snippet"]["channelTitle"],
                    "date": it["snippet"]["publishedAt"][:10], "views": int(it["statistics"].get("viewCount", 0)),
                    "url": "https://youtu.be/" + it["id"]})
    return sorted(out, key=lambda x: -x["views"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("topics"); ap.add_argument("--days", type=int, default=90)
    ap.add_argument("--limit", type=int, default=3, help="порог роликов на язык")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    key = env_key()
    if not key:
        sys.exit("нет YOUTUBE_API_KEY в .env")
    rows, details = [], []
    for line in pathlib.Path(a.topics).read_text().splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        name, en, ru = parts[:3]
        words = [w.strip() for w in parts[3].split(",")] if len(parts) > 3 and parts[3] else []
        r_en, r_ru = check(key, en, "en", a.days, words), check(key, ru, "ru", a.days, words)
        ok = len(r_en) <= a.limit and len(r_ru) <= a.limit
        fmt = lambda r: f"{len(r)} (макс. {r[0]['views']:,})".replace(",", " ") if r else "0"
        rows.append(f"| {name} | {fmt(r_en)} | {fmt(r_ru)} | {'✅' if ok else '❌'} |")
        details.append(f"\n### {name}\n" + "\n".join(
            f"- {x['lang']} · {x['date']} · {x['views']:,} · {x['channel']} — {x['title']} · {x['url']}".replace(",", " ")
            for x in [dict(d, lang='EN') for d in r_en] + [dict(d, lang='RU') for d in r_ru]) or "\n(пусто)")
    stamp = datetime.now().strftime("%d.%m.%Y %H:%M")
    md = (f"## Проверка YouTube за {a.days} дней — {stamp}\n\n| Тема | EN свежих | RU свежих | Итог (≤ {a.limit}) |\n"
          "|------|-----------|-----------|---------|\n" + "\n".join(rows) + "\n" + "".join(details) + "\n")
    print(md)
    if a.out:
        p = ROOT / a.out
        p.write_text((p.read_text() if p.exists() else "") + "\n" + md)
        print("→", p)


if __name__ == "__main__":
    main()
