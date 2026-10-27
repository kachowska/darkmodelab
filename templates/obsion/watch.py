#!/usr/bin/env python3
"""watch.py — turn a video into evidence a critic can actually look at (stdlib + ffmpeg only).

Usage:
  python3 watch.py VIDEO OUTDIR [--fps 2] [--seam-fps 12] [--scene 0.30] [--from S] [--to S]

Writes to OUTDIR:
  probe.json            ffprobe streams/format
  sheets/sheet_NNN.jpg  contact sheets: --fps frames per second, 8x5 tiles per sheet, timestamp burned in
  seams/cut_NNN.jpg     12 fps strip of 0.5 s before → 0.5 s after every detected cut (judge the transition, not a still)
  cuts.csv              detected cuts (time, score) + shot lengths
  motion.csv            per-frame motion energy (mean abs luma difference to the previous frame, 0..255)
  holds.csv             intervals where motion energy < 0.6 for ≥ 1.0 s (static / dead air candidates)
  black.csv, freeze.csv ffmpeg blackdetect / freezedetect intervals
  audio.json            integrated LUFS, LRA, true peak, silences ≥ 0.4 s (if the file has audio)
  spectrogram.png       whole-file spectrogram (if audio)
  summary.md            the numbers in one page + which files to open first

The critic must OPEN the sheets/seams/spectrogram with its image viewer; this script only prepares them.
"""
import json, os, re, subprocess, sys, statistics as st

def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)

def args():
    a = sys.argv[1:]
    if len(a) < 2: print(__doc__); sys.exit(1)
    o = {"video": a[0], "out": a[1], "fps": 2.0, "seam_fps": 12.0, "scene": 0.30, "from": None, "to": None}
    i = 2
    while i < len(a):
        k = a[i].lstrip("-").replace("-", "_"); o[k] = float(a[i + 1]); i += 2
    return o

def tile(frames, folder, times, cols, rows, pattern, mark=None):
    """Tile frames into sheets with a timestamp on each tile; mark = time of a cut (red frame on the first tile after it)."""
    from PIL import Image, ImageDraw
    if not frames: return
    per = cols * rows; first = Image.open(os.path.join(folder, frames[0])); w, h = first.size
    for n in range(0, len(frames), per):
        chunk = frames[n:n + per]; c = min(cols, len(chunk)) if rows == 1 else cols
        sheet = Image.new("RGB", (c * w, ((len(chunk) - 1) // cols + 1) * h), (20, 20, 20)); d = ImageDraw.Draw(sheet)
        for k, f in enumerate(chunk):
            x, y = (k % cols) * w, (k // cols) * h; sheet.paste(Image.open(os.path.join(folder, f)), (x, y))
            t = times[n + k]; lab = f"{int(t//60)}:{t%60:05.2f}"
            d.rectangle([x + 4, y + 4, x + 8 + 7 * len(lab), y + 20], fill=(0, 0, 0)); d.text((x + 6, y + 6), lab, fill=(255, 255, 255))
            if mark is not None and t >= mark and (k == 0 or times[n + k - 1] < mark):
                d.rectangle([x, y, x + w - 1, y + h - 1], outline=(255, 40, 40), width=3)
        sheet.save(pattern.format(n // per if "{:03d}" in pattern else ""), quality=88)

def main():
    o = args(); v, out = o["video"], o["out"]
    os.makedirs(os.path.join(out, "sheets"), exist_ok=True); os.makedirs(os.path.join(out, "seams"), exist_ok=True)
    if not os.path.exists(v): sys.exit(f"no readable video: {v}")
    pr = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", v]).stdout or "{}")
    json.dump(pr, open(os.path.join(out, "probe.json"), "w"), indent=1)
    dur = float(pr.get("format", {}).get("duration", 0) or 0)
    if dur <= 0: sys.exit(f"no readable video: {v}")
    vs = next((s for s in pr.get("streams", []) if s.get("codec_type") == "video"), {})
    has_a = any(s.get("codec_type") == "audio" for s in pr.get("streams", []))
    t0 = o["from"] or 0.0; t1 = min(o["to"] or dur, dur); span = ["-ss", f"{t0}", "-to", f"{t1}"]
    W = int(vs.get("width", 1920)); H = int(vs.get("height", 1080)); vfps = vs.get("avg_frame_rate", "0/1")

    # 1) contact sheets with timestamps (frames via ffmpeg, tiling + labels via PIL; this ffmpeg has no drawtext)
    tw = 384; th = int(tw * H / W) if W else 216
    tmp = os.path.join(out, "_frames"); os.makedirs(tmp, exist_ok=True)
    run(["ffmpeg", "-loglevel", "error", "-y", *span, "-i", v, "-vf", f"fps={o['fps']},scale={tw}:{th}", os.path.join(tmp, "f%05d.jpg")])
    frames = sorted(os.listdir(tmp))
    tile(frames, tmp, [t0 + (i + 0.5) / o["fps"] for i in range(len(frames))], 8, 5, os.path.join(out, "sheets", "sheet_{:03d}.jpg"))
    for f in frames: os.remove(os.path.join(tmp, f))

    # 2) cuts (scdet) + motion energy (frame difference) in one decode at 1/4 size
    r = run(["ffmpeg", "-hide_banner", *span, "-i", v, "-vf",
             f"scale=480:-2,scdet=threshold={o['scene']*100:.1f},split[a][b];[b]tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG[m];[a][m]overlay",
             "-f", "null", "-"])
    log = r.stderr
    cuts = [(float(m.group(2)) + t0, float(m.group(1))) for m in re.finditer(r"lavfi\.scd\.score:\s*([\d.]+),\s*lavfi\.scd\.time:\s*([\d.]+)", log)]
    mot = [(float(m.group(1)) + t0, float(m.group(2))) for m in re.finditer(r"pts_time:([\d.]+)\s*\n.*?lavfi\.signalstats\.YAVG=([\d.]+)", log)]
    if not mot:  # fallback parser (metadata print puts frame line then key line)
        times = [float(x) for x in re.findall(r"frame:\d+\s+pts:\d+\s+pts_time:([\d.]+)", log)]
        vals = [float(x) for x in re.findall(r"lavfi\.signalstats\.YAVG=([\d.]+)", log)]
        mot = [(t + t0, y) for t, y in zip(times, vals)]
    with open(os.path.join(out, "cuts.csv"), "w") as f:
        f.write("time_s,score\n"); [f.write(f"{t:.3f},{s:.1f}\n") for t, s in cuts]
    with open(os.path.join(out, "motion.csv"), "w") as f:
        f.write("time_s,energy\n"); [f.write(f"{t:.3f},{y:.3f}\n") for t, y in mot]
    edges = [t0] + [t for t, _ in cuts] + [t1]; shots = [b - a for a, b in zip(edges, edges[1:]) if b - a > 0.04]

    # 3) static holds from motion energy
    holds, start = [], None
    for t, y in mot:
        if y < 0.6:
            start = t if start is None else start
        else:
            if start is not None and t - start >= 1.0: holds.append((start, t))
            start = None
    if start is not None and mot and mot[-1][0] - start >= 1.0: holds.append((start, mot[-1][0]))
    with open(os.path.join(out, "holds.csv"), "w") as f:
        f.write("start_s,end_s,len_s\n"); [f.write(f"{a:.2f},{b:.2f},{b-a:.2f}\n") for a, b in holds]

    # 4) seam strips around each cut (max 60): 1 s at --seam-fps, one row per cut
    for i, (t, _) in enumerate(cuts[:60]):
        a = max(0, t - 0.5)
        run(["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{a}", "-t", "1.0", "-i", v, "-vf", f"fps={o['seam_fps']},scale=320:-2", os.path.join(tmp, "s%03d.jpg")])
        fr = sorted(x for x in os.listdir(tmp) if x.startswith("s"))
        tile(fr, tmp, [a + (k + 0.5) / o["seam_fps"] for k in range(len(fr))], len(fr) or 1, 1, os.path.join(out, "seams", f"cut_{i:03d}" + "{}.jpg"), mark=t)
        for f in fr: os.remove(os.path.join(tmp, f))
    os.rmdir(tmp)

    # 5) black / freeze
    def detect(flt, key):
        rr = run(["ffmpeg", "-hide_banner", *span, "-i", v, "-vf", flt, "-an", "-f", "null", "-"]).stderr
        return re.findall(key, rr)
    blk = detect("blackdetect=d=0.25:pix_th=0.08", r"black_start:([\d.]+) black_end:([\d.]+)")
    frz = detect("freezedetect=n=0.002:d=1.0", r"freeze_start: ([\d.]+)[\s\S]*?freeze_end: ([\d.]+)")
    for name, rows in (("black.csv", blk), ("freeze.csv", frz)):
        with open(os.path.join(out, name), "w") as f:
            f.write("start_s,end_s\n"); [f.write(f"{float(a)+t0:.2f},{float(b)+t0:.2f}\n") for a, b in rows]

    # 6) audio
    au = {"has_audio": has_a}
    if has_a:
        rr = run(["ffmpeg", "-hide_banner", "-nostats", *span, "-i", v, "-vn", "-af", "ebur128=peak=true,silencedetect=n=-45dB:d=0.4", "-f", "null", "-"]).stderr
        g = lambda p: (re.findall(p, rr) or [None])[-1]
        au.update({"integrated_lufs": g(r"I:\s+(-?[\d.]+) LUFS"), "lra_lu": g(r"LRA:\s+([\d.]+) LU"), "true_peak_dbfs": g(r"Peak:\s+(-?[\d.]+) dBFS"),
                   "silences": [(float(a) + t0, float(b) + t0) for a, b in re.findall(r"silence_start: (-?[\d.]+)[\s\S]*?silence_end: ([\d.]+)", rr)]})
        run(["ffmpeg", "-loglevel", "error", "-y", *span, "-i", v, "-lavfi", "showspectrumpic=s=1600x600:legend=1:scale=log", os.path.join(out, "spectrogram.png")])
    json.dump(au, open(os.path.join(out, "audio.json"), "w"), indent=1)

    # 7) summary
    e = [y for _, y in mot] or [0]
    S = []
    S.append(f"# watch.py summary — {os.path.basename(v)}\n")
    S.append(f"- Span {t0:.1f}–{t1:.1f} s of {dur:.1f} s · {W}×{H} · {vfps} fps · codec {vs.get('codec_name')} {vs.get('pix_fmt')} · audio {'yes' if has_a else 'NO'}")
    if shots:
        S.append(f"- Cuts: {len(cuts)} · shots {len(shots)} · shot length mean {st.mean(shots):.2f} s, median {st.median(shots):.2f} s, max {max(shots):.2f} s")
    S.append(f"- Motion energy: mean {st.mean(e):.2f}, median {st.median(e):.2f}; frames < 0.6 (near-static): {100*sum(1 for y in e if y < 0.6)/len(e):.1f} %")
    # judder = «sawtooth» frames: a repeated frame barely differs from its predecessor while both neighbours do (works under lossy codecs)
    fpsv = eval(vfps) if '/' in vfps else float(vfps); saw = tot = 0
    for i in range(1, len(e) - 1):
        w = sorted(e[max(0, i - 15): i + 16])
        if w[len(w) // 2] > 0.03:
            tot += 1
            if e[i] < 0.3 * min(e[i - 1], e[i + 1]): saw += 1
    exact = sum(1 for y in e if y < 0.005)
    S.append(f"- Judder: sawtooth frames {saw} of {tot} moving → effective motion fps ≈ {fpsv*(1-saw/max(tot,1)):.1f} (file {fpsv:.0f}); exact duplicates {exact}")
    S.append(f"- Low-motion time (energy < 0.6, NOT stillness): {sum(1 for y in e if y < 0.6)/fpsv:.1f} s of {len(e)/fpsv:.1f} s; holds ≥ 1 s total {sum(b-a for a,b in holds):.1f} s")
    S.append(f"- Static holds ≥ 1 s: {len(holds)}" + ("; longest " + ", ".join(f"{a:.1f}–{b:.1f}" for a, b in sorted(holds, key=lambda h: h[0]-h[1])[:5]) if holds else ""))
    S.append(f"- Black intervals: {len(blk)} · frozen ≥ 1 s: {len(frz)}")
    if has_a:
        S.append(f"- Audio: {au['integrated_lufs']} LUFS integrated, LRA {au['lra_lu']} LU, true peak {au['true_peak_dbfs']} dBFS, silences ≥ 0.4 s: {len(au['silences'])}")
    S.append("\n## Open these (mandatory before scoring)\n- every `sheets/sheet_*.jpg` (whole video, in order)\n- every `seams/cut_*.jpg` (each transition at 12 fps)\n- `spectrogram.png` and `audio.json`\n- the intervals in `holds.csv` and `freeze.csv`: watch them densely (re-run with --from/--to --fps 12)")
    open(os.path.join(out, "summary.md"), "w").write("\n".join(S) + "\n")
    print("\n".join(S))

if __name__ == "__main__":
    main()
