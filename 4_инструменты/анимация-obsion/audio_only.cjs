// audio_only.cjs <page.html> <out.wav> — только звуковые эффекты главы (без процедурной музыки), длина = window.__duration.
// Нужен, когда музыка — настоящие треки, сведённые отдельно (4_инструменты/звук/music_mix.py).
const path = require("path"), fs = require("fs");
(async () => {
  const [page, out] = process.argv.slice(2);
  const { chromium } = require("playwright"); const b = await chromium.launch(); const p = await b.newPage();
  await p.goto("file://" + path.resolve(page) + "?render=1"); await p.evaluate(async () => { await window.__ready; });
  const b64 = await p.evaluate(async () => SFX.toWavBase64(await SFX.render(EV, window.__duration, { sfxDb: -3, tail: 0 })));
  fs.writeFileSync(out, Buffer.from(b64, "base64")); console.log(out, await p.evaluate(() => window.__duration)); await b.close();
})();
