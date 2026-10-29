/* Dark Mode Lab — общий движок глав (из хука): субтитры по темпу голоса, пыль, дыхание бумаги, кадры клипов и гифок.
   Всё — функция времени t (детерминированно). __seek может вернуть Promise: render.cjs ждёт декод кадров. */
if (/r720/.test(location.search)) document.documentElement.style.zoom = String(2 / 3);   // черновик 1280×720: в 2,25 раза меньше пикселей
window.DML = (function () {
  const $ = s => document.querySelector(s);
  function words(SENT, vo, wps) {               // [предложение, ключевые слова] → слова с временем
    const W = []; let t = vo;
    SENT.forEach((s, si) => { s[0].split(/\s+/).forEach(w => { W.push({ w, t, si, k: (s[1] || []).includes(w) }); t += (/[.!?:]$/.test(w) ? 1.35 : /[,—]$/.test(w) ? 1.1 : 1) / wps; }); t += 0.25; });
    const CH = []; let cur = [];
    W.forEach((x, i) => { cur.push(i); const nx = W[i + 1]; if ((cur.length >= 8 && /[,:.—!?]$/.test(x.w)) || cur.length >= 11 || !nx || nx.si !== x.si) { CH.push(cur); cur = []; } });
    const wt = (s, n) => { const L = W.filter(x => x.w.startsWith(s)); if (!L.length) throw new Error('нет слова ' + s); return L[n || 0].t; };
    const end = W.length ? W[W.length - 1].t + 0.6 : vo;
    return { W, CH, wt, end, wps };
  }
  function subs(el, V, t) {
    const { W, CH, wps } = V;
    if (!W.length || t < W[0].t - 0.05) { el.innerHTML = ''; return; }
    let ci = CH.findIndex(c => t < W[c[c.length - 1]].t + 1 / wps); if (ci < 0) ci = CH.length - 1;
    const c = CH[ci]; if (ci === CH.length - 1 && t > W[c[c.length - 1]].t + 1.2) { el.innerHTML = ''; return; }
    el.innerHTML = c.map(i => `<span class="${W[i].k ? 'k ' : ''}${t >= W[i].t ? 'on' : ''}">${W[i].w}</span>`).join(' ');
  }
  function dust(fg, n, seed) {
    let s = seed || 7; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const D = Array.from({ length: n || 14 }, () => { const d = document.createElement('div'); d.className = 'dust'; const r = 4 + R() * 16; d.style.width = d.style.height = r + 'px'; d.style.opacity = .1 + R() * .2; fg.appendChild(d); return { d, x: R() * 2100, y: R() * 1260, vx: (R() - .5) * 14, vy: -4 - R() * 8 }; });
    return t => D.forEach(o => { const x = ((o.x + o.vx * t) % 2100 + 2100) % 2100, y = ((o.y + o.vy * t) % 1260 + 1260) % 1260; o.d.style.transform = `translate(${x}px,${y}px)`; });
  }
  function floaters(sel) {                       // бумага и фото дышат (CSS translate/rotate не спорят с GSAP transform)
    const FL = [...document.querySelectorAll(sel || '.doc,.pol,.obj,.card,.circ,.crt,.meme')];
    return t => FL.forEach((e, i) => { const a = .9 + (i % 3) * .3, ph = i * 1.7; e.style.translate = `${(Math.sin(t * .37 * a + ph) * 4).toFixed(2)}px ${(Math.sin(t * .51 * a + ph * 1.3) * 6).toFixed(2)}px`; e.style.rotate = `${(Math.sin(t * .29 * a + ph) * .7).toFixed(3)}deg`; });
  }
  // кадры клипов и гифок: <img class="seq" data-seq="media/<name>" data-t0="12" data-in="0" data-loop="1">; meta: media/<name>/meta.json {n,fps}
  const META = {};
  async function loadMeta() { Object.assign(META, window.MEDIA_META || {}); }   // build/media/meta.js
  const vis = el => { for (let e = el; e && e.id !== 'frame'; e = e.parentElement) if (getComputedStyle(e).visibility === 'hidden' || getComputedStyle(e).display === 'none') return false; return true; };
  function seqs(t, base) {
    const P = [];
    document.querySelectorAll('img.seq').forEach(el => {
      const m = META[el.dataset.seq]; if (!m) return;
      const t0 = +el.dataset.t0 || 0, inn = +el.dataset.in || 0, rate = +(el.dataset.rate || 1);
      const el0 = WARP && WARP.now != null ? WARP.now - WARP.g(t0) : t - t0;   // с голосом клипы играют в реальном темпе
      let k = Math.floor((el0 * rate + inn) * m.fps); if (k < 0) k = 0;
      k = el.dataset.loop === '1' ? k % m.n : Math.min(k, m.n - 1);
      const src = base + el.dataset.seq + '/f' + String(k + 1).padStart(4, '0') + (m.ext || '.jpg');
      if (el.dataset.cur !== src && vis(el)) { el.dataset.cur = src; el.src = src; P.push(el.decode().catch(() => 0)); }
    });
    return P.length ? Promise.all(P) : null;
  }
  // врезки: короткие планы с видео или фото поверх сцены (перебивки), чтобы кадр менялся каждые 2–3 с.
  // list: [t, 'seq:<name>' | '<файл из материалы/настоящие>', dur, вид ('full'|'tilt'|'circ'), подпись, css-позиция (по желанию)]
  function inserts(tl, EV, list, base) {
    base = base || '../../материалы/настоящие/';
    const stage = document.getElementById('stage'), fg = document.getElementById('fg'), kinds = ['full', 'tilt', 'full', 'circ'];
    // смены сцен: сцену должно быть видно ≥ 2,5 с до перебивки и ≥ 2 с после неё, иначе кадр мелькает
    const cuts = [...new Set(tl.getChildren(false, true, false).filter(c => c.vars && c.vars.visibility === 'visible' && c.targets().some(e => e.classList && e.classList.contains('sc'))).map(c => +c.startTime().toFixed(2)))].sort((x, y) => x - y);
    list.forEach(([t, src, dur, kind, cap, pos], i) => {
      kind = kind || kinds[i % kinds.length];
      if (kind !== 'circ' && !pos) {   // полноэкранные и большие перебивки закрывают сцену — держим поля
        const c0 = Math.max(0, ...cuts.filter(c => c <= t + .01)), c1 = Math.min(1e9, ...cuts.filter(c => c > t + .01));
        t = Math.max(t, c0 + 2.5);
        if (t + dur > c1 - 2) { dur = c1 - 2 - t; if (dur < 1.6) { console.log('DML.inserts: пропуск', src, t.toFixed(1)); return; } }
      }
      const d = document.createElement('div'); d.className = 'ins ins-' + kind; d.style.visibility = 'hidden'; if (pos) d.style.cssText += ';' + pos;
      d.innerHTML = (src.startsWith('seq:') ? `<img class="seq" data-seq="${src.slice(4)}" data-t0="${t}" data-loop="1">` : `<img src="${base + src}">`) + (cap ? `<div class="inscap">${cap}</div>` : '');
      stage.insertBefore(d, fg);
      const im = d.firstChild;
      tl.set(d, { visibility: 'visible' }, t); tl.set(d, { visibility: 'hidden' }, t + dur + .35);
      if (kind === 'full') {
        tl.fromTo(d, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: .3, ease: 'power3.out' }, t);
        tl.to(d, { clipPath: 'inset(0% 0% 0% 100%)', duration: .3, ease: 'power3.in' }, t + dur);
        tl.fromTo(im, { scale: 1.14 }, { scale: 1, duration: dur + .35, ease: 'none' }, t);
      } else if (kind === 'tilt') {
        tl.fromTo(d, { x: 1500, rotation: 14 }, { x: 0, rotation: -3, duration: .42, ease: 'power3.out' }, t);
        tl.to(d, { x: -1700, rotation: -14, duration: .35, ease: 'power2.in' }, t + dur);
        tl.fromTo(im, { scale: 1.1 }, { scale: 1, duration: dur + .35, ease: 'none' }, t);
      } else {
        tl.fromTo(d, { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: .42, ease: 'back.out(1.4)' }, t);
        tl.to(d, { scale: 0, rotation: 30, duration: .28, ease: 'power2.in' }, t + dur);
      }
      EV.push([t, 'whoosh', { dur: .45, size: .8, gain: .35 }], [t + dur, 'swish', { gain: .3 }]);
    });
  }
  // ── голос. Глава собрана по расчётному темпу (W[i].t), настоящий голос (window.VOICE из voice_words.js, 4_инструменты/звук/voice.mjs)
  // говорит в своём. retime плавно переводит время главы на голос: каждое слово на экране совпадает со словом в голосе
  // (обычно точнее 0,1–0,2 с), скорость анимации меняется плавно и в пределах 0,4–2×. Звуки EV и длина главы пересчитываются,
  // клипы и гифки играют в реальном темпе. Голос начинается там же, где в главе первое слово: window.VOICE_AT.
  let WARP = null;
  function gauss(a, sig, h) {
    const N = a.length, R = Math.ceil(3 * sig / h), K = []; let ks = 0;
    for (let i = -R; i <= R; i++) { const v = Math.exp(-((i * h) ** 2) / (2 * sig * sig)); K.push(v); ks += v; }
    const o = new Float64Array(N);
    for (let k = 0; k < N; k++) { let s = 0; for (let i = -R; i <= R; i++) s += a[Math.min(N - 1, Math.max(0, k + i))] * K[i + R]; o[k] = s / ks; }
    return o;
  }
  function retime(W, EV, DUR, o) {
    const VO = window.VOICE; if (!VO || !W.length) return null;
    if (VO.words.length !== W.length) { console.warn('DML.retime: в голосе', VO.words.length, 'слов, в главе', W.length, '— переозвучьте главу'); return null; }
    o = Object.assign({ smin: .4, smax: 2, sig: .3, it: 25 }, o);
    const vo = W[0].t, n = W.length, h = 1 / 30;
    const A = [[0, 0]]; W.forEach((x, i) => A.push([vo + VO.words[i].t, x.t])); A.push([vo + VO.words[n - 1].e, W[n - 1].t + .4]);   // [новое время, старое]
    const N = Math.ceil((A[A.length - 1][0] + Math.max(20, DUR - W[n - 1].t + 5)) / h);
    const raw = new Float64Array(N);
    for (let k = 0, j = 0; k < N; k++) { const x = k * h; while (j < A.length - 2 && A[j + 1][0] < x) j++; const [x0, y0] = A[j], [x1, y1] = A[j + 1]; raw[k] = x > x1 ? y1 + (x - x1) : y0 + (y1 - y0) * (x - x0) / Math.max(1e-6, x1 - x0); }
    const clamp = f => { const g = new Float64Array(N); g[0] = f[0]; for (let k = 1; k < N; k++) g[k] = g[k - 1] + Math.min(o.smax, Math.max(o.smin, (f[k] - f[k - 1]) / h)) * h; return g; };
    let f = gauss(raw, o.sig, h);
    for (let r = 0; r < o.it; r++) { const g = clamp(f), c = gauss(raw.map((v, k) => v - g[k]), 1.2, h); f = g.map((v, k) => v + c[k]); }
    f = clamp(f);
    const F = t => { const x = Math.max(0, t / h), k = Math.min(N - 2, Math.floor(x)); return f[k] + (f[k + 1] - f[k]) * (x - k); };            // новое → старое
    const G = u => { let a = 0, b = N - 1; if (u >= f[b]) return b * h + (u - f[b]); while (b - a > 1) { const m = (a + b) >> 1; if (f[m] < u) a = m; else b = m; } return (a + (u - f[a]) / Math.max(1e-9, f[b] - f[a])) * h; };   // старое → новое
    WARP = { f: F, g: G, now: null };
    EV.forEach(e => { e[0] = +G(e[0]).toFixed(3); });
    const dur = Math.ceil(G(DUR) * 10) / 10, seek = window.__seek;
    window.__duration = dur; window.VOICE_AT = vo; window.WARP = WARP;
    window.__seek = t => { WARP.now = t; return seek(F(t)); };
    window.__audioWav = async () => SFX.toWavBase64(await SFX.render(EV, dur, { sfxDb: -3, tail: 0 }));
    return WARP;
  }
  return { $, words, subs, dust, floaters, loadMeta, seqs, inserts, retime };
})();
