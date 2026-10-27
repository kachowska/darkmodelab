// layout_check.mjs <dir-or-index.html> [--step 0.5] — text QA for a seekable motion page (window.__seek / __duration).
// Every --step seconds: finds visible text boxes and reports (1) text outside a 5 % safe margin, (2) overlapping text boxes,
// (3) contrast < 4.5 between text colour and the nearest opaque background colour, (4) text smaller than 30 px.
// In 2.5D with rotation, text boxes are approximate: when in doubt, look at the frame. Intentional lens fly-throughs are allowed.
// Exit 1 if any issue. Needs Playwright (`npm i -D playwright` or PLAYWRIGHT_PATH). Nothing is played aloud.
import path from "path"; import fs from "fs"; import { createRequire } from "module";
const require = createRequire(import.meta.url);
let chromium; for (const p of ["playwright", process.env.PLAYWRIGHT_PATH].filter(Boolean)) { try { chromium = require(p).chromium; break; } catch (e) {} }
if (!chromium) { console.error("playwright not found: npm i -D playwright && npx playwright install chromium (or set PLAYWRIGHT_PATH)"); process.exit(2); }
const a = process.argv.slice(2); let src = path.resolve(a[0] || "."); if (fs.statSync(src).isDirectory()) src = path.join(src, "index.html");
const step = +(a[a.indexOf("--step") + 1] || 0.5) || 0.5;
const b = await chromium.launch({ args: ["--mute-audio"] }); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto("file://" + src, { waitUntil: "load" }); await p.evaluate(async () => { if (document.fonts) await document.fonts.ready; });
const dur = await p.evaluate(() => window.__duration || 10); const issues = [];
for (let t = 0; t <= dur + 1e-6; t += step) {
  const r = await p.evaluate((t) => {
    if (window.__seek) window.__seek(t);
    const W = innerWidth, H = innerHeight, mx = W * 0.05, my = H * 0.05, out = [];
    const lum = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; const [R, G, B] = m.slice(0, 3).map(v => { v = +v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * R + 0.7152 * G + 0.0722 * B; };
    const opaque = (e) => { const m = getComputedStyle(e).backgroundColor.match(/[\d.]+/g); return m && (m[3] === undefined || +m[3] > 0.9) ? getComputedStyle(e).backgroundColor : null; };
    // background = first opaque element painted UNDER the text centre (siblings included), not just the parent chain
    const bgOf = (el, q) => { const stack = document.elementsFromPoint(q.left + q.width / 2, q.top + q.height / 2);
      for (const e of stack) { if (e === el || el.contains(e)) continue; const c = opaque(e); if (c) return c; } return "rgb(255,255,255)"; };
    const effOpacity = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === "none" || s.visibility === "hidden") return 0; o *= +s.opacity; } return o; };
    const boxes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode; if (!n.textContent.trim()) continue; const el = n.parentElement, s = getComputedStyle(el);
      if (effOpacity(el) < 0.5) continue;
      const rg = document.createRange(); rg.selectNodeContents(n); const q = rg.getBoundingClientRect(); if (q.width < 2 || q.height < 2) continue;
      if (q.right < 0 || q.left > W || q.bottom < 0 || q.top > H) continue;
      const txt = n.textContent.trim().slice(0, 30), fs = parseFloat(s.fontSize) * (q.height / (parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.2) || 1);
      if (q.left < mx || q.right > W - mx || q.top < my || q.bottom > H - my) out.push(["margin", txt]);
      if (parseFloat(s.fontSize) < 30) out.push(["small", txt + " (" + s.fontSize + ")"]);
      const L1 = lum(s.color), L2 = lum(bgOf(el, q)); if (L1 != null && L2 != null) { const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); if (cr < 4.5) out.push(["contrast", txt + " " + cr.toFixed(2)]); }
      const blk = (e) => { while (e && getComputedStyle(e).display.startsWith("inline")) e = e.parentElement; return e; };
      boxes.push([q.left, q.top, q.right, q.bottom, txt, blk(el)]);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const A = boxes[i], B = boxes[j]; if (A[5] === B[5]) continue; { const iw = Math.min(A[2], B[2]) - Math.max(A[0], B[0]), ih = Math.min(A[3], B[3]) - Math.max(A[1], B[1]); if (iw > 0 && ih > 0 && iw * ih >= 0.25 * Math.min((A[2] - A[0]) * (A[3] - A[1]), (B[2] - B[0]) * (B[3] - B[1]))) out.push(["overlap", A[4] + " × " + B[4]]); } }
    return out;
  }, t);
  for (const x of r) issues.push(`${t.toFixed(1)}s ${x[0]}: ${x[1]}`);
}
await b.close();
const uniq = [...new Set(issues)];
console.log(uniq.length ? uniq.slice(0, 80).join("\n") + (uniq.length > 80 ? `\n… ${uniq.length - 80} more` : "") : "OK: no text outside margins, no overlaps, contrast ≥ 4.5, size ≥ 30 px");
process.exit(uniq.length ? 1 : 0);
