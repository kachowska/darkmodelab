#!/usr/bin/env python3
"""srt.py plan.json [out.srt] — субтитры для YouTube из точного тайминга голоса (в видео не вшиваются).
Берёт главы из music_plan.json, длины глав и начало голоса — из <глава>/timing.json, слова — из <глава>/voice_words.js.
По умолчанию пишет рядом с роликом: out из плана с расширением .srt. Строка — до 42 знаков, в титре до двух строк и до 7 с,
разрыв по знакам препинания, титр не висит дольше 1 с после последнего слова."""
import json, re, sys, pathlib
plan = pathlib.Path(sys.argv[1]); P = json.load(open(plan)); base = plan.parent
out = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else (base / P["out"]).with_suffix(".srt")
W, off = [], 0.0
for c in P["chapters"]:
    tm = json.load(open(base / c / "timing.json"))
    vw = base / c / "voice_words.js"
    if vw.exists():
        V = json.loads(re.search(r"window\.VOICE = (\{.*\});", vw.read_text(encoding="utf-8")).group(1))
        a = off + (tm.get("voice_at") or 0)
        W += [(w["w"], a + w["t"], a + w["e"]) for w in V["words"]]
    off += tm["dur"]
MAXL, MAXC, MAXD = 42, 84, 7.0
cues, cur = [], []
def flush():
    if cur: cues.append(list(cur)); cur.clear()
for i, x in enumerate(W):
    text = " ".join(w for w, _, _ in cur + [x])
    if cur and x[1] - cur[-1][2] > 1.0: flush()
    elif cur and (len(text) > MAXC or x[2] - cur[0][1] > MAXD):   # не влезает — режем по последней запятой, если она есть
        k = max([j for j, (w, _, _) in enumerate(cur) if re.search(r"[,:;—]$", w) and j >= 2] or [len(cur) - 1])
        rest = cur[k + 1:]; del cur[k + 1:]; flush(); cur.extend(rest)
    cur.append(x)
    nxt = W[i + 1] if i + 1 < len(W) else None
    if re.search(r"[.!?…]»?$", x[0]) or (re.search(r"[,:;—]$", x[0]) and len(" ".join(w for w, _, _ in cur)) > MAXC * .6) or not nxt: flush()
def lines(ws):
    s = " ".join(ws)
    if len(s) <= MAXL: return s
    best = min(range(1, len(ws)), key=lambda k: abs(len(" ".join(ws[:k])) - len(" ".join(ws[k:]))) - (3 if re.search(r"[,:;—]$", ws[k - 1]) else 0))
    return " ".join(ws[:best]) + "\n" + " ".join(ws[best:])
ts = lambda t: f"{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{int(t % 60):02d},{int(round(t % 1 * 1000)) % 1000:03d}"
srt = []
for n, c in enumerate(cues):
    a = c[0][1]; z = c[-1][2] + 0.25
    if n + 1 < len(cues): z = min(z, cues[n + 1][0][1] - 0.05)
    srt.append(f"{n + 1}\n{ts(a)} --> {ts(z)}\n{lines([w for w, _, _ in c])}\n")
out.write_text("\n".join(srt), encoding="utf-8")
print(out, len(cues), "титров,", len(W), "слов")
