// layout_check.mjs <dir-or-index.html> [--step 0.5] — text QA for a seekable motion page (window.__seek / __duration).
// Every --step seconds: finds visible text boxes and reports (1) text outside a 5 % safe margin (card captions .pc/.t-src: cut by the frame edge while ≥ 50 % of the card is in frame; skipped while the camera moves — window.CAM_MOVES), (2) overlapping text boxes,
// (3) contrast < 4.5 between text colour and the nearest opaque background colour, (4) text smaller than 30 px.
// Dark Mode Lab (light-style bible): (5) more than 2 text blocks on screen at once (service line #top/#tag, source captions .t-src/.src/.cap/.pc and labels inside a schematic svg excluded),
// (6) more than one plate style at once (opaque-background text blocks with different background/border), (7) stock credits on screen
// (Pixabay, Unsplash, Pexels, «иллюстрация» — stock licences live in the catalog and the YouTube description), (8) tight plate padding (< 18 px vertical / < 30 px horizontal),
// (9) a source caption (.t-src/.src/.cap) outside a card closer than 14 px to a card (.sheet/.pol/.ev/.doc), (10) a document image covered by another object
// (> 3 % of its area — the upper card cuts the text of the lower one), (11) more than one fastener (.pclip/.tape) on a card, (12) a paper clip over the middle
// of a sheet (clips hold an outer edge), (13) text on the pink plate #F5B4AB in a colour other than ink #1B1B1F or red #E5392B,
// (14) the service line (#top, 70 px band) touched by a card, cut-out or text (while the camera rests — window.CAM_MOVES lists camera moves),
// (15) a fastener (.pclip/.tape) over the image of a document (.sheet/.doc) — fasteners sit on margins and corners, never on letters.
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
    if (window.__seek) window.__seek(t); window.__t = t;
    const W = innerWidth, H = innerHeight, mx = W * 0.05, my = H * 0.05, out = [];
    const lum = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; const [R, G, B] = m.slice(0, 3).map(v => { v = +v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * R + 0.7152 * G + 0.0722 * B; };
    const opaque = (e) => { const m = getComputedStyle(e).backgroundColor.match(/[\d.]+/g); return m && (m[3] === undefined || +m[3] > 0.9) ? getComputedStyle(e).backgroundColor : null; };
    // background = first opaque element painted UNDER the text centre (siblings included), not just the parent chain
    const bgOf = (el, q) => { const own = opaque(el); if (own) return own;   // плашка: фон самого блока текста
      const stack = document.elementsFromPoint(q.left + q.width / 2, q.top + q.height / 2);
      for (const e of stack) { if (e === el || el.contains(e)) continue; const c = opaque(e); if (c) return c; } return "rgb(255,255,255)"; };
    const effOpacity = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === "none" || s.visibility === "hidden") return 0; o *= +s.opacity; } return o; };
    const boxes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode; if (!n.textContent.trim()) continue; const el = n.parentElement, s = getComputedStyle(el);
      if (effOpacity(el) < 0.5) continue;
      const rg = document.createRange(); rg.selectNodeContents(n); const q = rg.getBoundingClientRect(); if (q.width < 2 || q.height < 2) continue;
      { const tp = document.elementFromPoint(Math.min(W - 1, Math.max(0, q.left + q.width / 2)), Math.min(H - 1, Math.max(0, q.top + q.height / 2))); const s1 = el.closest('.sc'), s2 = tp && tp.closest('.sc'); if (s1 && s2 && s1 !== s2) continue; }   // текст под следующей сценой (переход) не виден
      if (q.right < 0 || q.left > W || q.bottom < 0 || q.top > H) continue;
      const txt = n.textContent.trim().slice(0, 30), fs = parseFloat(s.fontSize) * (q.height / (parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.2) || 1);
      const service = el.closest('#top,#tag,.t-src,.src,.cap,.pc');   // служебная строка и подписи источников: свои поля и кегль 22–28 px по библии
      // поля: основной текст — 5 % кадра; подпись карточки (.pc/.t-src…) — целиком в кадре (≥ 8 px) или целиком за кадром; пока камера едет — не проверяем
      const camMoving = (window.CAM_MOVES || []).some(([a0, z0]) => window.__t >= a0 - .05 && window.__t <= z0 + .05);
      const fx = service ? 8 : mx, fy = service ? 8 : my;
      // подпись карточки, которая сама почти за кадром (видно < 50 %), не проверяем: в кадр попал край соседней карточки
      const card = service && el.closest('.pol,.sheet,.ev,.doc'), cr0 = card && card.getBoundingClientRect();
      const cardVis = cr0 ? Math.max(0, Math.min(W, cr0.right) - Math.max(0, cr0.left)) * Math.max(0, Math.min(H, cr0.bottom) - Math.max(0, cr0.top)) / Math.max(1, cr0.width * cr0.height) : 1;
      if (!camMoving && cardVis >= .5 && !el.closest('#top,#tag') && (q.left < fx || q.right > W - fx || q.top < fy || q.bottom > H - fy)) out.push(["margin", txt + ` [${Math.round(q.left)},${Math.round(q.top)},${Math.round(q.right)},${Math.round(q.bottom)}]`]);
      if (!service && parseFloat(s.fontSize) < 30) out.push(["small", txt + " (" + s.fontSize + ")"]);
      const L1 = lum(s.color), L2 = lum(bgOf(el, q)); if (L1 != null && L2 != null) { const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); if (cr < (parseFloat(s.fontSize) >= 48 ? 3 : 4.5)) out.push(["contrast", txt + " " + cr.toFixed(2)]); }   // крупный текст ≥ 48 px — порог 3 (WCAG AA large)
      const blk = (e) => { while (e && getComputedStyle(e).display.startsWith("inline")) e = e.parentElement; return e; };
      boxes.push([q.left, q.top, q.right, q.bottom, txt, blk(el)]);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const A = boxes[i], B = boxes[j]; if (A[5] === B[5]) continue; { const iw = Math.min(A[2], B[2]) - Math.max(A[0], B[0]), ih = Math.min(A[3], B[3]) - Math.max(A[1], B[1]); if (iw > 0 && ih > 0 && iw * ih >= 0.25 * Math.min((A[2] - A[0]) * (A[3] - A[1]), (B[2] - B[0]) * (B[3] - B[1]))) out.push(["overlap", A[4] + " × " + B[4]]); } }
    // (5)–(8): блоки текста — ближайший блочный предок, видимый, с непрозрачностью ≥ 0,5
    const svc = e => e.closest('#top,#tag,.t-src,.src,.cap,.pc,.inscap,.hud,svg');   // подписи внутри схемы (svg) — часть схемы, а не отдельный текст
    const blocks = [...new Set(boxes.map(x => x[5]).filter(e => e && !svc(e)))];
    const top = blocks.filter(e => !blocks.some(o => o !== e && o.contains(e)));
    if (top.length > 2) out.push(["texts>2", top.map(e => e.textContent.trim().slice(0, 18)).join(" | ")]);
    const plates = new Set();
    top.forEach(e => { const c = getComputedStyle(e), bg = c.backgroundColor, m = bg.match(/[\d.]+/g);
      if (m && (m[3] === undefined || +m[3] > 0.5) && !(+m[0] > 250 && +m[1] > 250 && +m[2] > 250 && c.borderStyle === "none")) {
        plates.add(bg + "|" + c.borderTopStyle + "|" + c.borderTopColor);
        if (parseFloat(c.paddingTop) < 18 || parseFloat(c.paddingLeft) < 30) out.push(["tight-padding", e.textContent.trim().slice(0, 24) + ` (${c.paddingTop} ${c.paddingLeft})`]); } });
    if (plates.size > 1) out.push(["plate-styles", plates.size + " вида плашек в кадре"]);
    // (9)–(13): стол — карточки, крепёж, подписи
    const visEl = e => effOpacity(e) >= 0.5 && (() => { const q = e.getBoundingClientRect(); return q.width > 2 && q.height > 2 && q.right > 0 && q.left < W && q.bottom > 0 && q.top < H; })();
    const CARD = ".sheet,.pol,.ev,.doc", cards = [...document.querySelectorAll(CARD)].filter(visEl);
    const R = e => e.getBoundingClientRect();
    [...document.querySelectorAll(".t-src,.src,.cap")].filter(visEl).filter(e => !e.closest(CARD)).forEach(c => { const q = R(c);
      cards.forEach(k => { const r = R(k); if (q.left - 14 < r.right && q.right + 14 > r.left && q.top - 14 < r.bottom && q.bottom + 14 > r.top) out.push(["src-collision", c.textContent.trim().slice(0, 26) + " × карточка"]); }); });
    cards.forEach(k => { [...k.querySelectorAll("img")].filter(i => !i.classList.contains("seq") && visEl(i)).forEach(im => {
      const q = R(im); let n = 0, cov = 0;
      for (let ix = 1; ix < 16; ix++) for (let iy = 1; iy < 10; iy++) { const x = q.left + q.width * ix / 16, y = q.top + q.height * iy / 10; if (x < 0 || y < 0 || x > W || y > H) continue; n++;
        const top = document.elementFromPoint(x, y); if (top && !k.contains(top) && !top.contains(k) && !top.closest(".tape,.pclip") && top.closest(".sc") === k.closest(".sc")) cov++; }   // фон под углом повёрнутого листа — не закрытие   // закрыто предметом той же сцены
      if (n && cov / n > 0.03) out.push(["doc-covered", (im.getAttribute("src") || "").split("/").pop().slice(0, 30) + ` закрыт на ${Math.round(cov / n * 100)} %`]); }); });
    const fast = [...document.querySelectorAll(".pclip,.tape")].filter(visEl);
    cards.forEach(k => { const r = R(k), m = 30; const on = fast.filter(f => { const q = R(f), cx = (q.left + q.right) / 2, cy = (q.top + q.bottom) / 2; return cx > r.left - m && cx < r.right + m && cy > r.top - m && cy < r.bottom + m; });
      if (on.length > 1 && on.every(f => k.closest(".sc") === f.closest(".sc"))) out.push(["fasteners>1", (k.id || k.className) + ": " + on.length]); });
    fast.filter(f => f.classList.contains("pclip")).forEach(f => { const q = R(f), cx = (q.left + q.right) / 2, cy = (q.top + q.bottom) / 2;
      cards.forEach(k => { const r = R(k); if (cx > r.left && cx < r.right && cy > r.top && cy < r.bottom) { const d = Math.min(cx - r.left, r.right - cx, cy - r.top, r.bottom - cy); if (d > 60) out.push(["clip-over-sheet", (f.id || "скрепка") + " над серединой " + (k.id || k.className)]); } }); });
    top.forEach(e => { const m = getComputedStyle(e).backgroundColor.match(/[\d.]+/g); if (!m) return; const [r, g, bb] = m.map(Number);
      if (r > 230 && g > 160 && g < 200 && bb > 150 && bb < 190) [e, ...e.querySelectorAll("*")].forEach(x => { if (!x.childNodes.length || ![...x.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
        const c = (getComputedStyle(x).color.match(/[\d.]+/g) || []).map(Number); const ink = Math.abs(c[0] - 27) + Math.abs(c[1] - 27) + Math.abs(c[2] - 31) < 40, red = Math.abs(c[0] - 229) + Math.abs(c[1] - 57) + Math.abs(c[2] - 43) < 40;
        if (!ink && !red) out.push(["plate-text-color", x.textContent.trim().slice(0, 20) + " " + getComputedStyle(x).color]); }); });
    // (14) верхняя служебная зона 70 px: пока камера стоит, в неё не заходят карточки, вырезки и текст
    const moving = (window.CAM_MOVES || []).some(([a, z]) => window.__t >= a - .05 && window.__t <= z + .05);
    if (!moving) { const topEls = [...document.querySelectorAll(".sheet,.pol,.ev,.doc,.cut,.stk,.cutout,.t-title,.t-num,.t-quote,.t-stamp,.pl")].filter(visEl).filter(e => !e.closest("#top,#tag"));
      const svcR = [...document.querySelectorAll("#top span,#tag")].map(e => e.getBoundingClientRect());
      topEls.forEach(e => { const r = R(e); if (r.top < 70 && r.bottom > 0) { const hitsLine = svcR.some(q => r.left < q.right + 16 && r.right > q.left - 16 && r.top < q.bottom + 16);
        out.push([hitsLine ? "top-line-collision" : "top-zone", (e.id || e.className) + ` верх ${Math.round(r.top)} px`]); } }); }
    // (15) крепёж поверх букв документа
    fast.forEach(f => { const q = R(f), cx = (q.left + q.right) / 2, cy = (q.top + q.bottom) / 2;
      cards.filter(k => k.matches(".sheet,.doc")).forEach(k => k.querySelectorAll("img").forEach(im => { const r = R(im); if (cx > r.left + 4 && cx < r.right - 4 && cy > r.top + 4 && cy < r.bottom - 4) out.push(["fastener-over-text", (f.id || f.className) + " на " + (k.id || "документе")]); })); });
    const all = boxes.map(x => x[4]).join(" ");
    if (/pixabay|unsplash|pexels|shutterstock|иллюстрация/i.test(all)) out.push(["stock-credit", (all.match(/[^|]{0,20}(pixabay|unsplash|pexels|shutterstock|иллюстрация)[^|]{0,12}/i) || [""])[0]]);
    return out;
  }, t);
  for (const x of r) issues.push(`${t.toFixed(1)}s ${x[0]}: ${x[1]}`);
}
await b.close();
const uniq = [...new Set(issues)];
const LIM = a.includes("--all") ? 1e9 : 80;
console.log(uniq.length ? uniq.slice(0, LIM).join("\n") + (uniq.length > LIM ? `\n… ${uniq.length - LIM} more (--all)` : "") : "OK: no text outside margins, no overlaps, contrast ≥ 4.5, size ≥ 30 px, ≤ 2 texts, one plate style, no stock credits, captions clear of cards, documents uncovered, one fastener per card, clips on edges, plate text ink/red");
process.exit(uniq.length ? 1 : 0);
