#!/usr/bin/env python3
"""music_mix.py plan.json — музыкальная подложка из настоящих треков + звуки глав → общий звук ролика.
plan.json: {"video": "...mp4", "out": "...mp4", "xfade": 10, "music_lufs": -20, "sections": [{"file", "start", "in"}...],
            "chapters": [{"wav", "start", "dur"}...], "dips": [[t, dur, db]...], "fade_out": [t, dur], "duration": T}
Треки выравниваются по громкости (loudnorm), стыкуются медленным равномощным кроссфейдом, на мемах и раскрытиях
музыка мягко приглушается, в конце уходит; потом всё сводится, мастерится до −14 LUFS и подкладывается под видео."""
import json, subprocess, sys, os, tempfile, pathlib
P = json.load(open(sys.argv[1])); base = pathlib.Path(sys.argv[1]).parent
def run(a): subprocess.run(a, check=True)
def ab(p): return str((base / p).resolve())
T, X, S = P["duration"], P.get("xfade", 10), P["sections"]
tmp = tempfile.mkdtemp()
# 1) куски треков: стык по центру границы главы
segs = []
for i, s in enumerate(S):
    a = s["start"] - (X / 2 if i else 0); z = (S[i + 1]["start"] + X / 2) if i + 1 < len(S) else T
    out = f"{tmp}/s{i}.wav"; segs.append(out)
    run(["ffmpeg", "-v", "error", "-y", "-ss", str(s.get("in", 0)), "-t", f"{z - a:.3f}", "-i", ab(s["file"]),
         "-af", f"loudnorm=I={P.get('music_lufs', -20)}:TP=-3:LRA=11,aresample=48000,aformat=channel_layouts=stereo", f"{tmp}/s{i}.wav"])
# 2) медленные равномощные кроссфейды
inp = sum([["-i", f] for f in segs], []); fc = []; last = "0:a"
for i in range(1, len(segs)):
    lab = f"x{i}"; fc.append(f"[{last}][{i}:a]acrossfade=d={X}:c1=qsin:c2=qsin[{lab}]"); last = lab
# 3) приглушения (мемы, раскрытия) — плавные, и уход в конце
terms = []
for t, d, db in P.get("dips", []):
    g = 10 ** (db / 20); a, z = t - 0.4, t + d
    terms.append(f"(1-{1 - g:.4f}*min(1,max(0,(t-{a:.2f})/0.4))*min(1,max(0,({z + 1.2:.2f}-t)/1.2)))")
if P.get("fade_out"):
    ft, fd = P["fade_out"]; terms.append(f"min(1,max(0,({ft + fd:.2f}-t)/{fd:.2f}))")
vol = "*".join(terms) or "1"
fc.append(f"[{last}]volume=eval=frame:volume='{vol}'[m]")
run(["ffmpeg", "-v", "error", "-y"] + inp + ["-filter_complex", ";".join(fc), "-map", "[m]", "-t", f"{T:.3f}", f"{tmp}/music.wav"])
# 4) звуки глав подряд, каждая ровно своей длины
ci = sum([["-i", ab(c["wav"])] for c in P["chapters"]], [])
cf = "".join(f"[{i}:a]atrim=0:{c['dur']},aresample=48000,aformat=channel_layouts=stereo[c{i}];" for i, c in enumerate(P["chapters"]))
cf += "".join(f"[c{i}]" for i in range(len(P["chapters"]))) + f"concat=n={len(P['chapters'])}:v=0:a=1[s]"
run(["ffmpeg", "-v", "error", "-y"] + ci + ["-filter_complex", cf, "-map", "[s]", f"{tmp}/sfx.wav"])
# 5) сведение и мастеринг
run(["ffmpeg", "-v", "error", "-y", "-i", f"{tmp}/music.wav", "-i", f"{tmp}/sfx.wav", "-filter_complex",
     f"[0:a]volume={P.get('music_gain_db', 0)}dB[a];[1:a]volume={P.get('sfx_gain_db', 0)}dB[b];[a][b]amix=inputs=2:normalize=0:duration=longest[o]", "-map", "[o]", f"{tmp}/mix.wav"])
run([sys.executable, str(pathlib.Path(__file__).resolve().parents[2] / "4_инструменты/анимация-obsion/loudness.py"), f"{tmp}/mix.wav", f"{tmp}/mix_m.wav", "--tp", "-4.5"])
acodec = "aac_at" if "aac_at" in subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True).stdout else "aac"
run(["ffmpeg", "-v", "error", "-y", "-i", ab(P["video"]), "-i", f"{tmp}/mix_m.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", acodec, "-b:a", "256k", "-shortest", ab(P["out"])])
r = subprocess.run(["ffmpeg", "-hide_banner", "-i", ab(P["out"]), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
print("\n".join(l.strip() for l in r.splitlines() if l.strip().startswith(("I:", "Peak:"))))
