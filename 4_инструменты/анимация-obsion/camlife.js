/* camlife.js — the camera never stands still (owner 19 Oct 2026: «не было статичный кадр: камера чуть сместилась, отъехала,
 * приблизилась, делала акценты — только не навязчиво и нативно»). Seek-safe: everything is a pure function of t.
 *
 *   const cam = CAMLIFE.attach(document.querySelector('#stage'), {
 *     drift: { x: 6, y: 4, rot: 0.3, seed: 3 },               // px, px, deg — slow sine sums (0.04–0.13 Hz), never noise
 *     moves: [ [0, 1.00], [4, 1.06], [9, 1.00, -40, 10] ],     // [t, scale, x?, y?] keys; scale in LOG space, eased only at ends
 *     accents: [ [2.4, 0.035], [7.1, -0.02, 'x'] ],            // [t, amount, axis?] — closed-form spring punch (ζ≈0.45, ~0.35 s)
 *     focus: [ [0, '50% 50%'], [6, '30% 40%'] ],               // zoom centre follows what matters (smooth, never jumps)
 *     push: 0.03, period: 6                                    // with no moves: endless breathing 1 → 1.03 → 1 every 6 s (the never-static floor)
 *   });
 *   timeline.eventCallback('onUpdate', () => cam(timeline.time()));   // or call cam(t) from your __seek
 *
 * Drift alone (3–8 px at 0.04–0.13 Hz) moves < 1 px in 4 s: to the eye that is a freeze (measured by the critic, 19 Oct).
 * Visible calm life = a push/pull ≥ 2.5 % per shot + drift. Values: drift 3–8 px / 0.2–0.5° on 1080p; push-in 3–8 % per shot; accents 2–4 % (never on text being read);
 * a shot with no planned move still drifts. Gate: watch.py holds_total_s ≤ 0.5 s (except an intentional end hold) and mean motion energy ≥ 0.6.
 */
(function (G) {
  const mul = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ease = p => p < 0 ? 0 : p > 1 ? 1 : p * p * (3 - 2 * p);
  function track(keys, t, idx, def) {               // piecewise, smoothstep between keys (velocity 0 only at the ends of each move)
    if (!keys || !keys.length) return def;
    if (t <= keys[0][0]) return keys[0][idx] ?? def;
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t <= b[0]) { const p = ease((t - a[0]) / (b[0] - a[0])), va = a[idx] ?? def, vb = b[idx] ?? def;
        return idx === 1 ? va * Math.pow(vb / va, p) : va + (vb - va) * p; }     // scale interpolated in log space
    }
    return keys[keys.length - 1][idx] ?? def;
  }
  function spring(dt, amp) {                         // underdamped impulse: peak ~amp, settles in ~0.35 s
    if (dt < 0 || dt > 1.2) return 0; const z = 0.45, w = 2 * Math.PI * 3.2;
    return amp * Math.exp(-z * w * dt) * Math.sin(w * Math.sqrt(1 - z * z) * dt) * 1.6;
  }
  function attach(el, o) {
    o = o || {}; const d = Object.assign({ x: 5, y: 3.5, rot: 0.25, seed: 1 }, o.drift || {}); const r = mul(d.seed);
    const ph = Array.from({ length: 9 }, () => r() * 6.283), fq = [0.047, 0.089, 0.131, 0.061, 0.103, 0.071, 0.053, 0.117, 0.079];
    const sum = (k, t) => (Math.sin(t * fq[k] * 6.283 + ph[k]) + 0.5 * Math.sin(t * fq[k + 1] * 6.283 + ph[k + 1]) + 0.25 * Math.sin(t * fq[k + 2] * 6.283 + ph[k + 2])) / 1.75;
    const moves = o.moves && o.moves.length ? o.moves : [[o.shot ? o.shot[0] : 0, 1], [o.shot ? o.shot[1] : (o.dur || 6), 1 + (o.push == null ? 0.03 : o.push)]]; // never-static floor: a 3 % push per shot unless you give your own moves
    const W = () => el.offsetWidth || 1920, H = () => el.offsetHeight || 1080;
    const pct = (v, n) => /%/.test(v) ? parseFloat(v) / 100 * n : parseFloat(v);
    const fpx = (t) => { // focus point in px, smoothly interpolated between keys (no jump)
      const F = o.focus || [[0, '50% 50%']]; const P = F.map(k => { const q = String(k[1]).split(/\s+/); return [k[0], pct(q[0], W()), pct(q[1] || q[0], H())]; });
      if (t <= P[0][0]) return [P[0][1], P[0][2]];
      for (let i = 0; i < P.length - 1; i++) if (t <= P[i + 1][0]) { const p = ease((t - P[i][0]) / (P[i + 1][0] - P[i][0])); return [P[i][1] + (P[i + 1][1] - P[i][1]) * p, P[i][2] + (P[i + 1][2] - P[i][2]) * p]; }
      const L = P[P.length - 1]; return [L[1], L[2]];
    };
    el.style.transformOrigin = '0 0';
    return function (t) {
      let s = (o.moves && o.moves.length) ? track(moves, t, 1, 1) : 1 + (o.push == null ? 0.03 : o.push) * (1 - Math.cos(2 * Math.PI * t / (o.period || 6))) / 2, x = track(moves, t, 2, 0), y = track(moves, t, 3, 0), rot = 0;
      x += d.x * sum(0, t); y += d.y * sum(3, t); rot += d.rot * sum(6, t);
      for (const a of o.accents || []) { const v = spring(t - a[0], a[1]); if (a[2] === 'x') x += v * 400; else if (a[2] === 'y') y += v * 400; else s *= 1 + v; }
      const f = fpx(t), tx = x + (1 - s) * f[0], ty = y + (1 - s) * f[1]; // scale about the focus point via translation: origin never changes, so no jump
      el.style.transform = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) rotate(${rot.toFixed(3)}deg) scale(${s.toFixed(4)})`;
      return { x, y, rot, s };
    };
  }
  G.CAMLIFE = { attach, spring };
})(typeof window !== "undefined" ? window : globalThis);
