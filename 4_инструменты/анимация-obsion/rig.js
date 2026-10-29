/* rig.js — minimal cut-out puppet runtime (parts → nested joints → poses, 2-bone IK, spring tails, mouth swap). Seek-safe.
 *
 *   const R = RIG.build(container, rigJson, { scale: 0.5 });   // rigJson: {parts:{name:{src,parent,pivot:[px,py],at:[ax,ay],z}}, root:"pelvis", mouths:["mouth_0",...]}
 *   R.pose({ torso: -4, upper_arm_l: 30, forearm_l: -20 });    // degrees per joint (missing joints keep 0)
 *   R.ik("upper_arm_l", "forearm_l", [x, y], -1);              // place the wrist at a world point (bend sign ±1)
 *   R.spring("tail_1", t, { amp: 12, hz: 1.4, hl: 0.25, kick: tKick });   // closed-form secondary motion, no integration
 *   R.mouth(level0to1);                                         // swaps mouth_0..N by level (≥ 2 frames each is the caller's job)
 *   R.at(x, y, rot, s);                                         // root transform
 * Parts are <img> (or any element via part.el) absolutely positioned; pivots are fractions of the part image (0..1).
 * The rig never animates by itself: call it from your timeline / __seek(t) so every frame is a function of t.
 */
(function (G) {
  function build(host, spec, opt) {
    opt = opt || {}; const S = opt.scale || 1, P = {}, ang = {};
    const root = document.createElement("div"); root.style.cssText = "position:absolute;left:0;top:0;transform-origin:0 0"; host.appendChild(root);
    const order = []; const seen = {};
    (function add(name) { if (seen[name]) return; const p = spec.parts[name]; if (p.parent) add(p.parent); seen[name] = 1; order.push(name); })(spec.root);
    Object.keys(spec.parts).forEach(function add2(n) { if (seen[n]) return; const p = spec.parts[n]; if (p.parent && !seen[p.parent]) add2(p.parent); seen[n] = 1; order.push(n); });
    for (const n of order) {
      const p = spec.parts[n], box = document.createElement("div"), el = p.el || Object.assign(document.createElement("img"), { src: p.src, draggable: false });
      const w = (p.w || 100) * S, h = (p.h || 100) * S; box.style.cssText = `position:absolute;width:${w}px;height:${h}px;transform-origin:${p.pivot[0] * 100}% ${p.pivot[1] * 100}%;z-index:${p.z || 0}`;
      el.style.cssText += ";position:absolute;inset:0;width:100%;height:100%;pointer-events:none"; box.appendChild(el);
      const parent = p.parent ? P[p.parent] : null;
      if (parent) { const pp = spec.parts[p.parent]; box.style.left = (p.at[0] * pp.w * S - p.pivot[0] * w) + "px"; box.style.top = (p.at[1] * pp.h * S - p.pivot[1] * h) + "px"; parent.box.appendChild(box); }
      else { box.style.left = (-p.pivot[0] * w) + "px"; box.style.top = (-p.pivot[1] * h) + "px"; root.appendChild(box); }
      P[n] = { box, el, spec: p, w, h }; ang[n] = 0;
    }
    function set(n, deg) { ang[n] = deg; P[n].box.style.transform = `rotate(${deg.toFixed(3)}deg)`; }
    function len(a, b) { const pa = spec.parts[a], pb = spec.parts[b]; return Math.hypot((pb.at[0] - pa.pivot[0]) * pa.w, (pb.at[1] - pa.pivot[1]) * pa.h) * S; }
    const api = {
      parts: P,
      pose(map) { for (const n in map) if (P[n]) set(n, map[n]); return api; },
      at(x, y, rot, s) { root.style.transform = `translate(${x}px,${y}px) rotate(${rot || 0}deg) scale(${s || 1})`; return api; },
      /* two-bone IK in the upper bone's parent space: target is relative to the upper bone's pivot, rest direction = straight down */
      ik(upper, lower, target, bend) {
        const lp = spec.parts[lower], L1 = len(upper, lower), L2 = (lp.reach != null ? lp.reach : ((lp.hand != null ? lp.hand : 0.98) - lp.pivot[1])) * lp.h * S, dx = target[0], dy = target[1];
        const d = Math.min(Math.hypot(dx, dy), L1 + L2 - 1e-3), a = Math.atan2(dy, dx) - Math.PI / 2;
        const c1 = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)))), c2 = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2))));
        const sgn = bend || 1; set(upper, (a - sgn * c1) * 180 / Math.PI); set(lower, sgn * (Math.PI - c2) * 180 / Math.PI); return api;
      },
      /* closed-form damped sine after a kick (or a continuous sway when kick is undefined) */
      spring(n, t, o) {
        o = o || {}; const amp = o.amp || 8, hz = o.hz || 1.2, hl = o.hl || 0.25, base = o.base || 0;
        let v; if (o.kick == null) v = amp * Math.sin(2 * Math.PI * hz * t + (o.phase || 0));
        else { const dt = t - o.kick; v = dt < 0 ? 0 : amp * Math.exp(-Math.LN2 * dt / hl) * Math.sin(2 * Math.PI * hz * dt); }
        set(n, base + v); return api;
      },
      mouth(level) { const m = spec.mouths || []; if (!m.length) return api; const k = Math.max(0, Math.min(m.length - 1, Math.round(level * (m.length - 1))));
        m.forEach((n, i) => { if (P[n]) P[n].box.style.visibility = i === k ? "visible" : "hidden"; }); return api; },
      angles: ang,
    };
    return api;
  }
  /* placeholder parts (coloured rounded rects) so a rig can be blocked out before art exists */
  function placeholder(color, label) { const d = document.createElement("div"); d.style.cssText = `background:${color};border-radius:40% 40% 46% 46%;box-shadow:inset 0 -6px 0 rgba(0,0,0,.15)`; d.title = label || ""; return d; }
  G.RIG = { build, placeholder };
})(typeof window !== "undefined" ? window : globalThis);
