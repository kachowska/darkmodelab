# watch.py summary — pitch-A.mp4

- Span 0.0–46.0 s of 46.0 s · 1920×1080 · 3/1 fps · codec h264 yuv420p · audio yes
- Cuts: 0 · shots 1 · shot length mean 46.00 s, median 46.00 s, max 46.00 s
- Motion energy: mean 1.50, median 0.25; frames < 0.6 (near-static): 83.2 %
- Judder: sawtooth frames 0 of 135 moving → effective motion fps ≈ 3.0 (file 3); exact duplicates 0
- Low-motion time (energy < 0.6, NOT stillness): 38.0 s of 45.7 s; holds ≥ 1 s total 36.7 s
- Static holds ≥ 1 s: 8; longest 8.7–14.0, 20.7–26.0, 34.7–40.0, 14.7–20.0, 40.7–45.7
- Black intervals: 0 · frozen ≥ 1 s: 18
- Audio: -14.1 LUFS integrated, LRA 1.9 LU, true peak -1.4 dBFS, silences ≥ 0.4 s: 0

## Open these (mandatory before scoring)
- every `sheets/sheet_*.jpg` (whole video, in order)
- every `seams/cut_*.jpg` (each transition at 12 fps)
- `spectrogram.png` and `audio.json`
- the intervals in `holds.csv` and `freeze.csv`: watch them densely (re-run with --from/--to --fps 12)
