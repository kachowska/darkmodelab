# watch.py summary — pitch-C.mp4

- Span 0.0–46.0 s of 46.0 s · 1920×1080 · 3/1 fps · codec h264 yuv420p · audio yes
- Cuts: 0 · shots 1 · shot length mean 46.00 s, median 46.00 s, max 46.00 s
- Motion energy: mean 1.72, median 0.29; frames < 0.6 (near-static): 80.3 %
- Judder: sawtooth frames 1 of 135 moving → effective motion fps ≈ 3.0 (file 3); exact duplicates 0
- Low-motion time (energy < 0.6, NOT stillness): 36.7 s of 45.7 s; holds ≥ 1 s total 36.3 s
- Static holds ≥ 1 s: 11; longest 3.7–9.0, 9.7–15.0, 21.7–27.0, 15.7–21.0, 27.7–30.7
- Black intervals: 0 · frozen ≥ 1 s: 22
- Audio: -14.4 LUFS integrated, LRA 7.2 LU, true peak -1.9 dBFS, silences ≥ 0.4 s: 0

## Open these (mandatory before scoring)
- every `sheets/sheet_*.jpg` (whole video, in order)
- every `seams/cut_*.jpg` (each transition at 12 fps)
- `spectrogram.png` and `audio.json`
- the intervals in `holds.csv` and `freeze.csv`: watch them densely (re-run with --from/--to --fps 12)
