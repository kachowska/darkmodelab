// render.cjs — frame-exact render of a deterministic HTML animation to MP4 (no real-time screen recording: it judders).
// Usage: node render.cjs <dir-or-index.html> [--secs 20] [--fps 60] [--w 1920] [--h 1080] [--audio mix.wav] [--out out.mp4] [--from S] [--no-loudnorm]
// Audio: --audio file, or the page's window.__audioWav() (sfx.js). Either is mastered to −14 LUFS / −1.5 dBTP (loudness.py) and muxed as AAC.
// The page must expose ONE of:
//   window.__seek(t)  (preferred: one load, then seek per frame)   or   window.__frame(t)
//   or honour ?t=<seconds> on load (slow fallback: reload per frame).
// Optional: window.__duration (seconds) is used when --secs is not given; window.__ready (Promise) is awaited after load.
// Playwright: `npm i -D playwright && npx playwright install chromium`, or point PLAYWRIGHT_PATH at an existing install.
const path = require("path"), fs = require("fs"), { execSync } = require("child_process");
// AAC encoder: Apple AudioToolbox (aac_at) keeps true peak; ffmpeg's native aac overshot +5 dB on a −5 dBTP mix (measured 20 Oct)
const AAC = (() => { try { return execSync("ffmpeg -hide_banner -encoders 2>/dev/null").toString().includes("aac_at") ? "-c:a aac_at -b:a 256k" : "-c:a aac -b:a 320k -af lowpass=f=16000"; } catch (e) { return "-c:a aac -b:a 320k -af lowpass=f=16000"; } })();
function pw() {
  for (const p of ["playwright", process.env.PLAYWRIGHT_PATH].filter(Boolean)) {
    try { return require(p); } catch (e) {}
  }
  throw new Error("playwright not found: npm i -D playwright && npx playwright install chromium");
}
const a = process.argv.slice(2), JPG = process.argv.includes("--jpeg"), opt = (k, d) => { const i = a.indexOf("--" + k); return i >= 0 ? a[i + 1] : d; };
(async () => {
  // a folder/file (file://) or --serve: start a local static server for pages that use ES modules (file:// blocks them)
  let src = path.resolve(a[0] || "."); if (fs.statSync(src).isDirectory()) src = path.join(src, "index.html");
  let srv = null, httpBase = null;
  if (a.includes("--serve")) { const http = require("http"), root = path.dirname(src); const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".wav": "audio/wav", ".woff2": "font/woff2" };
    srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split("?")[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); r.end(d); }); });
    await new Promise(ok => srv.listen(0, "127.0.0.1", ok)); httpBase = `http://127.0.0.1:${srv.address().port}/${path.basename(src)}`; }
  const dir = path.dirname(src), fps = +opt("fps", 60), W = +opt("w", 1920), H = +opt("h", 1080);
  const out = path.resolve(opt("out", path.join(dir, "render.mp4"))), audio = opt("audio", "");
  const fr = path.join(dir, "_frames"); fs.rmSync(fr, { recursive: true, force: true }); fs.mkdirSync(fr);
  const R720 = a.includes("--r720"); const url = t => (httpBase || ("file://" + src)) + "?t=" + t.toFixed(5) + "&render=1" + (R720 ? "&r720=1" : "");
  const { chromium } = pw(); const b = await chromium.launch({ args: ["--mute-audio", "--use-gl=angle", "--use-angle=metal", "--enable-gpu-rasterization", "--ignore-gpu-blocklist"] }); /* GPU: 1.95x faster, measured 19 Oct */ const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  // NO SOUND during render (owner rule): silence every media element and WebAudio.
  await p.addInitScript(() => { const pl = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { this.muted = true; return pl.call(this); }; });
  await p.goto(url(0), { waitUntil: "load" });
  await p.evaluate(async () => { if (document.fonts) await document.fonts.ready; if (window.__ready) await window.__ready; });
  const api = await p.evaluate(() => typeof window.__seek === "function" ? "__seek" : typeof window.__frame === "function" ? "__frame" : "");
  const from0 = +opt("from", 0); const secs = +(opt("secs", 0) || Math.max(0, (await p.evaluate(() => window.__duration || 0)) - from0) || 20);
  const from = +opt("from", 0); const n = Math.round(secs * fps);
  for (let i = 0; i < n; i++) {
    const t = from + i / fps;
    if (api) await p.evaluate(async ([f, t]) => { const r = window[f](t); if (r && r.then) await r; return 0; }, [api, t]); // Dark Mode Lab: __seek может вернуть Promise (кадры клипов и гифок)
    else { await p.goto(url(t), { waitUntil: "load" }); await p.evaluate(() => document.fonts && document.fonts.ready); }
    await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await p.screenshot(JPG ? { path: path.join(fr, `f${String(i).padStart(6, "0")}.jpg`), type: "jpeg", quality: 93 } : { path: path.join(fr, `f${String(i).padStart(6, "0")}.png`) }); // --jpeg: быстрее для черновиков
    if (i % (fps * 2) === 0) process.stdout.write(`\r${i}/${n}`);
  }
  // Procedural audio from the page itself (sfx.js): window.__audioWav() → base64 WAV, rendered offline (never played aloud).
  let pageAudio = "";
  if (!audio && await p.evaluate(() => typeof window.__audioWav === "function")) {
    const b64 = await p.evaluate(async () => await window.__audioWav());
    pageAudio = path.join(dir, "audio.raw.wav"); fs.writeFileSync(pageAudio, Buffer.from(b64, "base64"));
  }
  await b.close(); if (srv) srv.close();
  let mixIn = audio ? path.resolve(audio) : pageAudio;
  if (mixIn && !a.includes("--no-loudnorm")) { // master to −14 LUFS / −1.5 dBTP: compressor → searched gain → oversampled limiter (loudness.py)
    const norm = path.join(dir, "audio.wav");
    const res = execSync(`python3 "${path.join(__dirname, "loudness.py")}" "${mixIn}" "${norm}"`).toString().trim();
    console.log("\nloudness " + res); mixIn = norm;
  }
  if (mixIn && from > 0) { // window render: cut the matching audio span
    const cut = path.join(dir, "audio.window.wav");
    execSync(`ffmpeg -loglevel error -y -ss ${from} -t ${secs} -i "${mixIn}" "${cut}"`); mixIn = cut;
  }
  const aud = mixIn ? `-i "${mixIn}" ${AAC} -map 0:v -map 1:a` : "";
  execSync(`ffmpeg -loglevel error -y -framerate ${fps} -i "${fr}/f%06d.${JPG ? "jpg" : "png"}" ${aud} -vf "scale=out_color_matrix=bt709:out_range=tv,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv" -c:v libx264 -preset veryfast -crf 16 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -r ${fps} -t ${(n / fps).toFixed(3)} -movflags +faststart "${out}"`);
  if (mixIn && !a.includes("--no-loudnorm") && !(+opt("from", 0) > 0)) { // AAC can overshoot the WAV true peak by ~3 dB on dense limited mixes: measure the MP4 and, if TP > −1 dBTP, re-master the WAV with a lower ceiling and remux (loudness stays at −14)
    const meas = f => { const r = require("child_process").spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", f, "-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" }).stderr; const m = r.match(/Peak:\s+(-?[\d.]+) dBFS/g); return m ? parseFloat(m[m.length - 1].split(/\s+/)[1]) : -99; };
    let tp = meas(out), ceil = -2.0;
    for (let k = 0; k < 3 && tp > -1; k++) {
      ceil -= (tp + 1.5); const src = pageAudio || path.resolve(audio), norm = path.join(dir, "audio.wav"), tmp = out.replace(/\.mp4$/, ".tp.mp4");
      execSync(`python3 "${path.join(__dirname, "loudness.py")}" "${src}" "${norm}" --tp ${ceil.toFixed(2)}`);
      execSync(`ffmpeg -loglevel error -y -i "${out}" -i "${norm}" -map 0:v -map 1:a -c:v copy ${AAC} -t ${(n / fps).toFixed(3)} -movflags +faststart "${tmp}"`);
      fs.renameSync(tmp, out); tp = meas(out);
    }
    console.log("\nmp4 true peak " + tp + " dBTP (wav ceiling " + ceil.toFixed(2) + ")");
  }
  fs.rmSync(fr, { recursive: true, force: true });
  const info = { out, api: api || "reload ?t", frames: n, fps, secs, audio: mixIn ? path.basename(mixIn) : false, errors: errs.slice(0, 20) };
  fs.writeFileSync(out.replace(/\.mp4$/, ".render.json"), JSON.stringify(info, null, 1));
  console.log("\n" + JSON.stringify(info));
})();
