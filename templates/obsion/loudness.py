#!/usr/bin/env python3
"""loudness.py IN.wav OUT.wav [--target -14] [--tp -1.5] — master a mix to a loudness target (stdlib + ffmpeg).
Sparse SFX mixes (clicks over a quiet bed) cannot reach −14 LUFS by gain alone: the peaks hit the ceiling first.
Chain: gentle glue compressor → gain → true-peak limiter; the gain is searched (≤ 6 passes) until integrated loudness
is within ±0.5 LU of the target and true peak ≤ tp. Prints the measured result as JSON."""
import json, re, subprocess, sys

def measure(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    i = re.findall(r"I:\s+(-?[\d.]+) LUFS", r); p = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r)
    return float(i[-1]) if i else -70.0, float(p[-1]) if p else 0.0

def render(src, dst, gain, tp):
    lim = 10 ** ((tp - 0.3) / 20)  # sample-peak ceiling a little under the true-peak target
    chain = f"acompressor=threshold=0.08:ratio=3:attack=8:release=150:knee=4,volume={gain:.2f}dB,aresample=192000,alimiter=limit={lim:.3f}:attack=0.5:release=80:level=false,alimiter=limit={lim:.3f}:attack=0.1:release=40:level=false,aresample=48000"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-af", chain, "-ar", "48000", dst], check=True)

def main():
    a = sys.argv[1:]; src, dst = a[0], a[1]
    target = float(a[a.index("--target") + 1]) if "--target" in a else -14.0
    tp = float(a[a.index("--tp") + 1]) if "--tp" in a else -2.0
    i0, _ = measure(src); gain = target - i0; best = None
    for _ in range(6):
        render(src, dst, gain, tp); i, p = measure(dst)
        best = (i, p, gain)
        if abs(i - target) <= 0.5 and p <= tp + 0.3: break
        gain += (target - i) * 1.1
        gain = min(gain, 40)
    print(json.dumps({"integrated_lufs": best[0], "true_peak_dbfs": best[1], "gain_db": round(best[2], 2), "target": target}))

if __name__ == "__main__":
    main()
