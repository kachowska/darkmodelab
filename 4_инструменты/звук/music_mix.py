#!/usr/bin/env python3
"""music_mix.py plan.json — общий звук ролика: голос + звуки глав + музыка из настоящих треков → готовый mp4.

plan.json (пути — от папки плана, обычно сборка/):
  "video": "_без-музыки.mp4", "out": "../готово/<выпуск>.mp4",
  "chapters": ["hook", "ch1", …]        — в каждой главе: timing.json {dur, voice_at} и sfx.wav (их пишет audio_only.cjs),
                                           voice.mp3 (4_инструменты/звук/voice.mjs) и voice_words.js — если глава озвучена
  "sections": [{"file", "chapter", "in"}] — трек начинается вместе с главой; стыки — медленный кроссфейд "xfade" с по центру границы
  "dips": [[глава, t, длительность, дБ]] — мягкое приглушение музыки на мемах и раскрытиях (время внутри главы)
  "fade_out": [глава, t, длительность]   — уход музыки в конце
  "music_lufs" −24 · "voice_lufs" −16 · "duck_db" −16 (музыка под голосом) · "sfx_gain_db" · "music_gain_db"
Под голосом музыка плавно уходит вниз (по точному таймингу слов, без «качелей» в коротких паузах) и поднимается в паузах
дольше 1,6 с; затем всё сводится, мастерится до −14 LUFS и подкладывается под видео."""
import json, subprocess, sys, tempfile, pathlib, re
P = json.load(open(sys.argv[1])); base = pathlib.Path(sys.argv[1]).parent
for k in ("video", "out"):   # --video / --out: другой источник и итог (финал 1080p60), пути от папки плана
    if "--" + k in sys.argv: P[k] = sys.argv[sys.argv.index("--" + k) + 1]
def run(a): subprocess.run(a, check=True)
def ab(p): return str((base / p).resolve())
CH = P["chapters"]; TM = [json.load(open(ab(f"{c}/timing.json"))) for c in CH]
ST = [sum(t["dur"] for t in TM[:i]) for i in range(len(CH))]; T = sum(t["dur"] for t in TM)
at = lambda ci, t: ST[ci] + t
X, S = P.get("xfade", 10), P["sections"]
tmp = tempfile.mkdtemp()
print(f"Ролик {T:.1f} с ·", " · ".join(f"{c} {ST[i]:.1f}+{TM[i]['dur']:.1f}" for i, c in enumerate(CH)))

# 1) голос: главы на свои места + отрезки речи для приглушения музыки
speech, vin, vf = [], [], []
for i, c in enumerate(CH):
    vw = base / c / "voice_words.js"
    if not (base / c / "voice.mp3").exists() or not vw.exists(): continue
    V = json.loads(re.search(r"window\.VOICE = (\{.*\});", vw.read_text(encoding="utf-8")).group(1))
    off = at(i, TM[i].get("voice_at") or 0)
    for w in V["words"]:
        a, z = off + w["t"], off + w["e"]
        if speech and a - speech[-1][1] < 1.6: speech[-1][1] = z
        else: speech.append([a, z])
    k = len(vin) // 2; vin += ["-i", ab(f"{c}/voice.mp3")]
    vf.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={int(off * 1000)}:all=1[v{k}]")
if vin:
    n = len(vin) // 2
    vf.append("".join(f"[v{k}]" for k in range(n)) + f"amix=inputs={n}:normalize=0:duration=longest,apad,atrim=0:{T:.3f},loudnorm=I={P.get('voice_lufs', -16)}:TP=-2:LRA=11,aresample=48000[v]")
    run(["ffmpeg", "-v", "error", "-y"] + vin + ["-filter_complex", ";".join(vf), "-map", "[v]", f"{tmp}/voice.wav"])

# 2) куски треков: стык по центру границы главы
starts = [at(s["chapter"], 0) for s in S]; segs = []
for i, s in enumerate(S):
    a = starts[i] - (X / 2 if i else 0); z = (starts[i + 1] + X / 2) if i + 1 < len(S) else T
    out = f"{tmp}/s{i}.wav"; segs.append(out)
    run(["ffmpeg", "-v", "error", "-y", "-ss", str(s.get("in", 0)), "-t", f"{z - a:.3f}", "-i", ab(s["file"]),
         "-af", f"loudnorm=I={P.get('music_lufs', -24)}:TP=-3:LRA=11,aresample=48000,aformat=channel_layouts=stereo", out])
# 3) медленные равномощные кроссфейды
inp = sum([["-i", f] for f in segs], []); fc = []; last = "0:a"
for i in range(1, len(segs)):
    lab = f"x{i}"; fc.append(f"[{last}][{i}:a]acrossfade=d={X}:c1=qsin:c2=qsin[{lab}]"); last = lab
# 4) громкость музыки: под голосом, на мемах, уход в конце
terms = []
if speech:
    g = 10 ** (P.get("duck_db", -16) / 20)
    env = "+".join(f"min(1,max(0,(t-{a - .5:.2f})/0.5))*min(1,max(0,({z + 1.0:.2f}-t)/1.0))" for a, z in speech)
    terms.append(f"(1-{1 - g:.4f}*min(1,{env}))")
for ci, t, d, db in P.get("dips", []):
    g = 10 ** (db / 20); a, z = at(ci, t) - 0.4, at(ci, t) + d
    terms.append(f"(1-{1 - g:.4f}*min(1,max(0,(t-{a:.2f})/0.4))*min(1,max(0,({z + 1.2:.2f}-t)/1.2)))")
if P.get("fade_out"):
    ci, ft, fd = P["fade_out"]; ft = at(ci, ft); terms.append(f"min(1,max(0,({ft + fd:.2f}-t)/{fd:.2f}))")
fc.append(f"[{last}]volume=eval=frame:volume='{'*'.join(terms) or '1'}'[m]")
open(f"{tmp}/music.fc", "w").write(";".join(fc))
run(["ffmpeg", "-v", "error", "-y"] + inp + ["-filter_complex_script", f"{tmp}/music.fc", "-map", "[m]", "-t", f"{T:.3f}", f"{tmp}/music.wav"])
# 5) звуки глав подряд, каждая ровно своей длины
ci_ = sum([["-i", ab(f"{c}/sfx.wav")] for c in CH], [])
cf = "".join(f"[{i}:a]apad,atrim=0:{TM[i]['dur']},aresample=48000,aformat=channel_layouts=stereo[c{i}];" for i in range(len(CH)))
cf += "".join(f"[c{i}]" for i in range(len(CH))) + f"concat=n={len(CH)}:v=0:a=1[s]"
run(["ffmpeg", "-v", "error", "-y"] + ci_ + ["-filter_complex", cf, "-map", "[s]", f"{tmp}/sfx.wav"])
# 6) сведение и мастеринг
mi = ["-i", f"{tmp}/music.wav", "-i", f"{tmp}/sfx.wav"] + (["-i", f"{tmp}/voice.wav"] if vin else [])
mf = f"[0:a]volume={P.get('music_gain_db', 0)}dB[a];[1:a]volume={P.get('sfx_gain_db', 0)}dB[b];" + ("[a][b][2:a]amix=inputs=3" if vin else "[a][b]amix=inputs=2") + ":normalize=0:duration=longest[o]"
run(["ffmpeg", "-v", "error", "-y"] + mi + ["-filter_complex", mf, "-map", "[o]", f"{tmp}/mix.wav"])
run([sys.executable, str(pathlib.Path(__file__).resolve().parents[2] / "4_инструменты/анимация-obsion/loudness.py"), f"{tmp}/mix.wav", f"{tmp}/mix_m.wav", "--tp", "-4.5"])
acodec = "aac_at" if "aac_at" in subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True).stdout else "aac"
run(["ffmpeg", "-v", "error", "-y", "-i", ab(P["video"]), "-i", f"{tmp}/mix_m.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", acodec, "-b:a", "256k", "-shortest", ab(P["out"])])
for name in ["voice", "music", "sfx"]:   # громкость дорожек — для проверки баланса
    f = f"{tmp}/{name}.wav"
    if pathlib.Path(f).exists():
        r = subprocess.run(["ffmpeg", "-hide_banner", "-i", f, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
        m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r); print(f"{name}: {m[-1] if m else '?'} LUFS")
r = subprocess.run(["ffmpeg", "-hide_banner", "-i", ab(P["out"]), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
print("\n".join(l.strip() for l in r.splitlines() if l.strip().startswith(("I:", "Peak:"))))
