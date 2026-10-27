#!/usr/bin/env python3
"""Клипы и гифки → кадры для покадрового рендера. spec.json: [{"name":"k01_moon","src":"clip_K01_...mp4","in":60,"dur":6,"fps":24,"w":960}]
Пути src — от source-media/real/. Пишет build/media/<name>/f0001.jpg… + meta.json."""
import json, sys, subprocess, pathlib, shutil
ROOT = pathlib.Path(__file__).resolve().parents[2]; REAL = ROOT / "source-media" / "real"; OUT = ROOT / "build" / "media"
for s in json.load(open(sys.argv[1])):
    d = OUT / s["name"]
    if (d / "meta.json").exists() and not s.get("force"): continue
    shutil.rmtree(d, ignore_errors=True); d.mkdir(parents=True)
    fps = s.get("fps", 24); w = s.get("w", 960); src = REAL / s["src"]
    vf = f"fps={fps},scale={w}:-2" + (",format=rgb24" if src.suffix == ".gif" else "")
    cmd = ["ffmpeg", "-v", "error", "-y"] + (["-ss", str(s["in"])] if s.get("in") else []) + ["-i", str(src)] + (["-t", str(s["dur"])] if s.get("dur") else []) + ["-vf", vf, "-q:v", "3", str(d / "f%04d.jpg")]
    subprocess.run(cmd, check=True)
    n = len(list(d.glob("f*.jpg"))); json.dump({"n": n, "fps": fps, "ext": ".jpg"}, open(d / "meta.json", "w")); print(s["name"], n, "кадров")
# общий meta.js для страниц (fetch не работает на file://)
M = {}
for d in sorted(OUT.iterdir()):
    if (d / "meta.json").exists(): M[d.name] = json.load(open(d / "meta.json"))
(OUT / "meta.js").write_text("window.MEDIA_META=" + json.dumps(M) + ";\n")
