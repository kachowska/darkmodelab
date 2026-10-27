/* DEPTH25 — a multiplane 2.5D stage (owner 19 Oct 2026: «упор в 2.5D и моушн ахуенный»).
   Flat cards separated in Z, seen through a real CSS perspective camera. What WD (world.js) does not do and this does:
   depth of field per layer from its distance to the focus plane, motion blur from each layer's real screen velocity
   (anisotropic SVG blur), atmospheric haze behind the focus, contact shadows that grow with the gap to the layer behind,
   «explode» (layers separate in depth), layers that travel in Z (fly through the lens = seamless wipe),
   and a camera that runs one continuous Catmull-Rom path (velocity never drops to zero at a key, ease only at the ends)
   plus a pure-function handheld drift, so the frame is never static.

   D = DEPTH25.stage(host, {persp, a, b, focus, dof, maxBlur, mb, haze, hazeRange, hand, over})
   L = D.layer({z, html|src|el, x, y, sharp, shadow, haze, over, css})   content goes into L.c (author in 1920×1080 px)
   L.move(t, d, {z, x, y}, ease)        layer travels (e.g. z → +900 flies through the lens)
   D.cam(t, {x, y, z, ry, rx, rz, focus, sep})   camera key at time t (sep = depth separation multiplier, 1 = authored)
   DEPTH25.attach(tl, dur)              renders every stage from timeline time (seek-safe, deterministic)
   Conventions: z < 0 is far, z > 0 is near; camera z > 0 dollies forward. Everything is computed from time only. */
(function () {
  var DEPTH25 = (window.DEPTH25 = { all: [] });
  var NS = "http://www.w3.org/2000/svg", uid = 0;
  var P_KEYS = ["x", "y", "z", "ry", "rx", "rz", "focus", "sep"];
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(u) { return u * u * (3 - 2 * u); }
  function ease(name) { return name && gsap ? gsap.parseEase(name) : function (u) { return u; }; }
  function cr(p0, p1, p2, p3, u) { // Catmull-Rom (uniform) — continuous velocity through keys
    var u2 = u * u, u3 = u2 * u;
    return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
  }
  function hand(t, amp, seed) { // pure handheld: sum of incommensurate sines
    return amp * (Math.sin(t * 0.73 + seed) * 0.6 + Math.sin(t * 1.37 + seed * 2.1) * 0.3 + Math.sin(t * 2.91 + seed * 0.7) * 0.1);
  }

  function Stage(host, o) {
    o = o || {};
    this.P = o.persp || 1400; this.a = o.a == null ? -1e9 : o.a; this.b = o.b == null ? 1e9 : o.b;
    this.dofK = o.dof == null ? 0.011 : o.dof; this.maxBlur = o.maxBlur == null ? 9 : o.maxBlur;
    this.mbK = o.mb == null ? 0.32 : o.mb; this.maxMB = o.maxMB == null ? 14 : o.maxMB;
    this.hazeCol = o.haze || "rgba(236,226,206,1)"; this.hazeRange = o.hazeRange || 1800; this.hazeMax = o.hazeMax == null ? 0.45 : o.hazeMax;
    this.hand = o.hand == null ? 1 : o.hand; this.over = o.over || 1.6; this.fps = o.fps || 30;
    this.keys = []; this.layers = []; this.def = { x: 0, y: 0, z: 0, ry: 0, rx: 0, rz: 0, focus: o.focus || 0, sep: 1 };
    var root = (this.root = document.createElement("div"));
    root.style.cssText = "position:absolute;inset:0;overflow:hidden;perspective:" + this.P + "px;perspective-origin:960px 540px;" + (o.css || "");
    host.appendChild(root);
    var svg = (this.svg = document.createElementNS(NS, "svg"));
    svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.style.cssText = "position:absolute;width:0;height:0";
    this.defs = document.createElementNS(NS, "defs"); svg.appendChild(this.defs); root.appendChild(svg);
    var w = (this.w = document.createElement("div"));
    w.style.cssText = "position:absolute;left:960px;top:540px;width:0;height:0;transform-style:preserve-3d";
    root.appendChild(w);
    DEPTH25.all.push(this);
  }

  Stage.prototype.layer = function (o) {
    o = o || {};
    var over = o.over || this.over, z = o.z || 0, W = 1920 * over, H = 1080 * over;
    var s = (this.P - z) / this.P; // size compensation: authored 1920×1080 fills the frame at its depth from the start view
    var e = document.createElement("div");
    e.style.cssText = "position:absolute;left:" + (-W / 2) + "px;top:" + (-H / 2) + "px;width:" + W + "px;height:" + H + "px;transform-origin:50% 50%;will-change:transform,filter";
    var c = document.createElement("div"); // authoring frame: 1920×1080 centred inside the overscan
    c.style.cssText = "position:absolute;left:" + ((W - 1920) / 2) + "px;top:" + ((H - 1080) / 2) + "px;width:1920px;height:1080px;" + (o.css || "");
    e.appendChild(c);
    if (o.html) c.innerHTML = o.html;
    if (o.src) { var im = document.createElement("img"); im.src = o.src; im.decoding = "sync"; im.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:" + (o.fit || "contain"); c.appendChild(im); }
    if (o.el) c.appendChild(o.el);
    var hz = document.createElement("div"); // haze veil, only the layer's own pixels (mask = itself via mix-blend inside an isolated group)
    hz.style.cssText = "position:absolute;inset:0;pointer-events:none;opacity:0;background:" + this.hazeCol + ";mix-blend-mode:screen";
    if (o.haze !== false) c.appendChild(hz);
    var f = document.createElementNS(NS, "filter"), id = "d25f" + uid++;
    f.setAttribute("id", id); f.setAttribute("x", "-10%"); f.setAttribute("y", "-10%"); f.setAttribute("width", "120%"); f.setAttribute("height", "120%");
    f.setAttribute("color-interpolation-filters", "sRGB");
    var g = document.createElementNS(NS, "feGaussianBlur"); g.setAttribute("stdDeviation", "0 0"); f.appendChild(g); this.defs.appendChild(f);
    this.w.appendChild(e);
    var L = { e: e, c: c, hz: hz, g: g, fid: id, z0: z, x0: o.x || 0, y0: o.y || 0, s: o.scale || s, sharp: !!o.sharp,
      shadow: o.shadow == null ? true : o.shadow, mk: [], i: this.layers.length, last: "" };
    L.move = function (t, d, to, ez) { L.mk.push({ t: t, d: d, to: to, e: ease(ez || "power2.inOut") }); L.mk.sort(function (p, q) { return p.t - q.t; }); return L; };
    this.layers.push(L);
    this.layers.sort(function (p, q) { return p.z0 - q.z0; }); // far → near in DOM order (stable paint order without z-sorting bugs)
    var self = this; this.layers.forEach(function (l) { self.w.appendChild(l.e); });
    return L;
  };

  Stage.prototype.cam = function (t, k) { k = Object.assign({ t: t }, k); this.keys.push(k); this.keys.sort(function (p, q) { return p.t - q.t; }); return k; };

  Stage.prototype.camAt = function (t) { // continuous path through keys; smoothstep only on the first and last segments
    var K = this.keys, d = this.def, out = {}, i, n = K.length;
    if (!n) { for (i = 0; i < P_KEYS.length; i++) out[P_KEYS[i]] = d[P_KEYS[i]]; }
    else {
      var full = K.map(function (k) { var r = { t: k.t }; P_KEYS.forEach(function (p) { r[p] = k[p] == null ? null : k[p]; }); return r; });
      P_KEYS.forEach(function (p) { var last = d[p]; full.forEach(function (r) { if (r[p] == null) r[p] = last; else last = r[p]; }); });
      if (t <= full[0].t || n === 1) { var f0 = t <= full[0].t ? full[0] : full[n - 1]; P_KEYS.forEach(function (p) { out[p] = f0[p]; }); }
      else if (t >= full[n - 1].t) P_KEYS.forEach(function (p) { out[p] = full[n - 1][p]; });
      else {
        for (i = 0; i < n - 1 && t > full[i + 1].t; i++);
        var a = full[i], b = full[i + 1], u = (t - a.t) / Math.max(1e-6, b.t - a.t);
        if (i === 0 || i === n - 2) u = i === 0 && i === n - 2 ? smooth(u) : i === 0 ? u * u * (2 - u) : u * (1 + u - u * u); // ease in from rest / out to rest
        var pa = full[Math.max(0, i - 1)], pb = full[Math.min(n - 1, i + 2)];
        P_KEYS.forEach(function (p) { out[p] = cr(pa[p], a[p], b[p], pb[p], clamp(u, 0, 1)); });
      }
    }
    if (this.hand) { out.x += hand(t, 7 * this.hand, 1.1); out.y += hand(t, 5 * this.hand, 2.7); out.rz += hand(t, 0.25 * this.hand, 4.2); out.ry += hand(t, 0.35 * this.hand, 0.4); }
    return out;
  };

  Stage.prototype.layerAt = function (L, t) { // the layer's own Z/X/Y travel
    var z = L.z0, x = L.x0, y = L.y0;
    L.mk.forEach(function (m) {
      var u = clamp((t - m.t) / Math.max(1e-6, m.d), 0, 1); if (t < m.t) return; u = m.e(u);
      if (m.to.z != null) z = z + (m.to.z - z) * u; if (m.to.x != null) x = x + (m.to.x - x) * u; if (m.to.y != null) y = y + (m.to.y - y) * u;
    });
    return { x: x, y: y, z: z };
  };

  Stage.prototype.project = function (L, t, C) { // approximate screen centre of a layer (for motion blur velocity)
    var q = this.layerAt(L, t), z = q.z * C.sep, dist = this.P - (z + C.z);
    if (dist < 1) dist = 1;
    var k = this.P / dist;
    return { x: (q.x - C.x) * k, y: (q.y - C.y) * k, dist: dist, q: q, zz: z };
  };

  Stage.prototype.render = function (t) {
    var on = t >= this.a && t <= this.b; this.root.style.display = on ? "" : "none"; if (!on) return; // display, not visibility: a child with visibility:visible would override a hidden root (backward-seek bug, found by the critic 19 Oct)
    var C = this.camAt(t), Cp = this.camAt(t - 1 / this.fps), self = this;
    this.w.style.transform = "rotateZ(" + C.rz.toFixed(3) + "deg) rotateX(" + C.rx.toFixed(3) + "deg) rotateY(" + C.ry.toFixed(3) + "deg) translate3d(" + (-C.x).toFixed(2) + "px," + (-C.y).toFixed(2) + "px," + C.z.toFixed(2) + "px)";
    var focusZ = C.focus * C.sep, prevZ = null;
    this.layers.forEach(function (L) {
      var p = self.project(L, t, C), pp = self.project(L, t - 1 / self.fps, Cp);
      if (p.dist < 60) { L.e.style.visibility = "hidden"; return; } // passed the lens
      L.e.style.visibility = "visible";
      L.e.style.transform = "translate3d(" + p.q.x.toFixed(2) + "px," + p.q.y.toFixed(2) + "px," + p.zz.toFixed(2) + "px) scale(" + L.s.toFixed(4) + ")";
      var dz = Math.abs(p.zz - focusZ), dof = L.sharp ? 0 : Math.min(self.maxBlur, dz * self.dofK);
      // near the lens the blur grows fast (macro feel)
      if (!L.sharp && p.dist < 500) dof = Math.max(dof, Math.min(self.maxBlur * 1.6, (500 - p.dist) * 0.03));
      var vx = Math.abs(p.x - pp.x) + Math.abs(C.ry - Cp.ry) * 18, vy = Math.abs(p.y - pp.y) + Math.abs(C.rx - Cp.rx) * 18;
      var mx = Math.min(self.maxMB, vx * self.mbK), my = Math.min(self.maxMB, vy * self.mbK);
      var sx = Math.sqrt(dof * dof + mx * mx), sy = Math.sqrt(dof * dof + my * my);
      var hz = p.zz < focusZ ? Math.min(self.hazeMax, (focusZ - p.zz) / self.hazeRange * self.hazeMax) : 0;
      L.hz.style.opacity = hz.toFixed(3);
      var gap = prevZ == null ? 0 : Math.max(0, p.zz - prevZ), sh = L.shadow && gap > 0 ? Math.min(46, 6 + gap * 0.05) : 0;
      var key = sx.toFixed(1) + "|" + sy.toFixed(1) + "|" + sh.toFixed(0);
      if (key !== L.last) {
        L.g.setAttribute("stdDeviation", sx.toFixed(2) + " " + sy.toFixed(2));
        var fl = sx > 0.15 || sy > 0.15 ? "url(#" + L.fid + ")" : "";
        if (sh) fl += " drop-shadow(" + (sh * 0.25).toFixed(1) + "px " + (sh * 0.45).toFixed(1) + "px " + (sh * 0.6).toFixed(1) + "px rgba(20,14,8," + Math.min(0.55, 0.22 + sh * 0.008).toFixed(2) + "))";
        L.e.style.filter = fl || "none"; L.last = key;
      }
      prevZ = p.zz;
    });
  };

  DEPTH25.stage = function (host, o) { return new Stage(host, o); };
  DEPTH25.render = function (t) { DEPTH25.all.forEach(function (s) { s.render(t); }); };
  DEPTH25.attach = function (tl, dur) {
    var proxy = { t: 0 };
    tl.fromTo(proxy, { t: 0 }, { t: dur, duration: dur, ease: "none", immediateRender: false,
      modifiers: { t: function (v) { DEPTH25.render(+v); return v; } }, onUpdate: function () { DEPTH25.render(proxy.t); } }, 0);
  };
})();
