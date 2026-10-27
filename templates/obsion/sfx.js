/* sfx.js — procedural, deterministic sound for HTML motion (OBSION Motion). No samples, no network.
 * One EVENTS list drives picture and sound: SFX.render(events, duration) → AudioBuffer (OfflineAudioContext).
 *
 *   <script src="sfx.js"></script>
 *   const EVENTS = [[0.00,"riser",{dur:1.2}], [1.20,"impact",{size:1.2}], [1.25,"whoosh",{dur:.5,pan:[-.8,.8]}], [2.1,"pop"], ...];
 *   window.__audioWav = async () => SFX.toWavBase64(await SFX.render(EVENTS, window.__duration, {bed:{bpm:100,key:"A",mood:"warm"}}));
 *
 * render.cjs calls window.__audioWav() if present, writes audio.wav, normalises to −14 LUFS / −1 dBTP with ffmpeg and muxes.
 * Sounds (all take {gain, pan, seed} + their own options):
 *   whoosh{dur,size,pan:[from,to]} swish{dur} reverse{dur} pop{pitch} click{} tick{} bubble{} paper{dur} fold{} tear{dur}
 *   impact{size} thud{} riser{dur} downer{dur} glitch{dur} sparkle{n} chime{note} type{n,rate} shutter{} heartbeat{n} drone{dur,note}
 * Variation: every event gets a seeded ±4 % pitch/±1.5 dB jitter, so repeated sounds never sound copy-pasted.
 * Rules (see references/sound.md): transient on the contact frame (or ≤ 1 frame late), SFX under VO, music −18…−22 dB under VO.
 */
(function (G) {
  const SR = 48000;
  const mul = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const NOTE = { C: 261.63, "C#": 277.18, D: 293.66, "D#": 311.13, E: 329.63, F: 349.23, "F#": 369.99, G: 392.0, "G#": 415.3, A: 440.0, "A#": 466.16, B: 493.88 };
  const db = d => Math.pow(10, d / 20);

  function noiseBuf(ctx, dur, rnd, color) {
    const n = Math.max(1, Math.ceil(dur * SR)), b = ctx.createBuffer(1, n, SR), d = b.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = rnd() * 2 - 1;
      if (color === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (color === "pink") { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
      else d[i] = w;
    }
    return b;
  }
  // a voice = source → (filters) → gain(env) → panner → bus
  function chain(ctx, bus, src, t, o, nodes) {
    let n = src; for (const f of nodes || []) { n.connect(f); n = f; }
    const g = ctx.createGain(); g.gain.value = 0; n.connect(g);
    const p = ctx.createStereoPanner(); g.connect(p); p.connect(bus);
    const pan = o.pan;
    if (Array.isArray(pan)) { p.pan.setValueAtTime(pan[0], t); p.pan.linearRampToValueAtTime(pan[1], t + (o.dur || 0.5)); } else p.pan.value = pan || 0;
    return g;
  }
  function env(g, t, a, peak, d, curve) { // attack a s to peak, then decay d s
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 1e-4), t + Math.max(a, 0.001));
    g.gain.exponentialRampToValueAtTime(1e-4, t + a + Math.max(d, 0.005)); g.gain.setValueAtTime(0, t + a + d + 0.01);
  }
  function osc(ctx, type, f0, f1, t, dur) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  function nsrc(ctx, t, dur, rnd, color) { const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx, dur + 0.05, rnd, color); s.start(t); return s; }
  function bq(ctx, type, f, Q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (Q) b.Q.value = Q; return b; }

  const S = {
    whoosh(ctx, bus, t, o, r) { // air past the lens; size scales low end and length
      const dur = o.dur || 0.55, sz = o.size || 1, s = nsrc(ctx, t, dur, r, "pink"), f = bq(ctx, "bandpass", 300, 1.1);
      const pk = t + dur * (o.peak || 0.62);
      f.frequency.setValueAtTime(260 / sz, t); f.frequency.exponentialRampToValueAtTime(2600 / Math.sqrt(sz) * o.k, pk); f.frequency.exponentialRampToValueAtTime(500 / sz, t + dur);
      const g = chain(ctx, bus, s, t, Object.assign({ dur }, o), [f]);
      g.gain.setValueAtTime(1e-4, t); g.gain.exponentialRampToValueAtTime(0.9 * o.g, pk); g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
    },
    swish(ctx, bus, t, o, r) { S.whoosh(ctx, bus, t, Object.assign({}, o, { dur: o.dur || 0.22, size: 0.6, peak: 0.5 }), r); },
    reverse(ctx, bus, t, o, r) { S.whoosh(ctx, bus, t, Object.assign({}, o, { dur: o.dur || 0.7, peak: 0.95 }), r); },
    pop(ctx, bus, t, o, r) {
      const p = (o.pitch || 1) * o.k, s = osc(ctx, "sine", 620 * p, 170 * p, t, 0.07), g = chain(ctx, bus, s, t, o); env(g, t, 0.002, 0.8 * o.g, 0.09);
      const c = nsrc(ctx, t, 0.01, r), gc = chain(ctx, bus, c, t, o, [bq(ctx, "highpass", 2500)]); env(gc, t, 0.001, 0.25 * o.g, 0.008);
    },
    click(ctx, bus, t, o, r) {
      const c = nsrc(ctx, t, 0.006, r), g = chain(ctx, bus, c, t, o, [bq(ctx, "highpass", 2200)]); env(g, t, 0.0008, 0.5 * o.g, 0.006);
      const s = osc(ctx, "sine", 1900 * o.k, 1700 * o.k, t, 0.02), g2 = chain(ctx, bus, s, t, o); env(g2, t, 0.001, 0.25 * o.g, 0.018);
    },
    tick(ctx, bus, t, o) { const s = osc(ctx, "sine", 3100 * o.k, 3000 * o.k, t, 0.012), g = chain(ctx, bus, s, t, o); env(g, t, 0.0005, 0.3 * o.g, 0.01); },
    bubble(ctx, bus, t, o) { const s = osc(ctx, "sine", 380 * o.k, 1300 * o.k, t, 0.09), g = chain(ctx, bus, s, t, o); env(g, t, 0.004, 0.6 * o.g, 0.08); },
    paper(ctx, bus, t, o, r) { // rustle = crackle grains of band-passed noise
      const dur = o.dur || 0.4, n = Math.round(dur * 55);
      for (let i = 0; i < n; i++) {
        const tt = t + r() * dur, gl = 0.004 + r() * 0.012, s = nsrc(ctx, tt, gl, r), f = bq(ctx, "bandpass", 2800 + r() * 3600, 0.9);
        const g = chain(ctx, bus, s, tt, o, [f]); env(g, tt, 0.001, (0.15 + r() * 0.35) * o.g, gl);
      }
    },
    fold(ctx, bus, t, o, r) { S.paper(ctx, bus, t, Object.assign({}, o, { dur: 0.18 }), r); const s = osc(ctx, "sine", 140, 90, t + 0.12, 0.12), g = chain(ctx, bus, s, t + 0.12, o); env(g, t + 0.12, 0.003, 0.5 * o.g, 0.12); },
    tear(ctx, bus, t, o, r) {
      const dur = o.dur || 0.45, s = nsrc(ctx, t, dur, r, "pink"), f = bq(ctx, "bandpass", 1800, 0.9), lp = bq(ctx, "lowpass", 5500), am = ctx.createGain();
      const g = chain(ctx, bus, s, t, Object.assign({ dur }, o), [f, lp, am]);
      for (let i = 0; i < dur * 90; i++) am.gain.setValueAtTime(0.2 + r() * 0.8, t + i / 90);
      g.gain.setValueAtTime(1e-4, t); g.gain.exponentialRampToValueAtTime(0.7 * o.g, t + 0.03); g.gain.linearRampToValueAtTime(0.5 * o.g, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
    },
    impact(ctx, bus, t, o, r) { // transient + body + sub tail
      const sz = o.size || 1;
      const sub = osc(ctx, "sine", 62 * o.k, 34, t, 0.5 * sz), gs = chain(ctx, bus, sub, t, o); env(gs, t, 0.003, 0.95 * o.g, 0.45 * sz);
      const b = nsrc(ctx, t, 0.16, r, "brown"), gb = chain(ctx, bus, b, t, o, [bq(ctx, "lowpass", 900)]); env(gb, t, 0.002, 0.8 * o.g, 0.14 * sz);
      const c = nsrc(ctx, t, 0.01, r), gc = chain(ctx, bus, c, t, o, [bq(ctx, "highpass", 3000)]); env(gc, t, 0.0007, 0.35 * o.g, 0.01);
    },
    thud(ctx, bus, t, o, r) { S.impact(ctx, bus, t, Object.assign({}, o, { size: 0.5, g: o.g * 0.7 }), r); },
    riser(ctx, bus, t, o, r) {
      const dur = o.dur || 1.5, s = nsrc(ctx, t, dur, r), f = bq(ctx, "highpass", 200, 0.8);
      f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
      const g = chain(ctx, bus, s, t, o, [f]); g.gain.setValueAtTime(1e-4, t); g.gain.exponentialRampToValueAtTime(0.55 * o.g, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
      const sw = osc(ctx, "sawtooth", 180 * o.k, 760 * o.k, t, dur), lp = bq(ctx, "lowpass", 1400), g2 = chain(ctx, bus, sw, t, o, [lp]);
      g2.gain.setValueAtTime(1e-4, t); g2.gain.exponentialRampToValueAtTime(0.12 * o.g, t + dur); g2.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    },
    downer(ctx, bus, t, o, r) {
      const dur = o.dur || 1.0, s = osc(ctx, "sawtooth", 700 * o.k, 70, t, dur), lp = bq(ctx, "lowpass", 2400), g = chain(ctx, bus, s, t, o, [lp]);
      lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(200, t + dur); env(g, t, 0.01, 0.2 * o.g, dur);
    },
    glitch(ctx, bus, t, o, r) { // pitch steps from a hash of quantised time (10 Hz), never per-sample random
      const dur = o.dur || 0.22, steps = Math.max(2, Math.round(dur * 30));
      for (let i = 0; i < steps; i++) {
        const tt = t + i * dur / steps, s = osc(ctx, "square", 200 + Math.floor(r() * 8) * 180, 0, tt, dur / steps), g = chain(ctx, bus, s, tt, o, [bq(ctx, "bandpass", 1500, 2)]);
        env(g, tt, 0.001, (r() > 0.25 ? 0.18 : 0) * o.g + 1e-4, dur / steps * 0.8);
      }
    },
    sparkle(ctx, bus, t, o, r) {
      const n = o.n || 6; for (let i = 0; i < n; i++) {
        const tt = t + i * 0.035 + r() * 0.02, s = osc(ctx, "sine", (2200 + r() * 3200) * o.k, 0, tt, 0.25), g = chain(ctx, bus, s, tt, Object.assign({}, o, { pan: (r() * 2 - 1) * 0.6 }));
        env(g, tt, 0.002, 0.12 * o.g, 0.22);
      }
    },
    chime(ctx, bus, t, o) {
      const f = (o.freq || 880) * o.k; [1, 2.76, 5.4].forEach((m, i) => { const s = osc(ctx, "sine", f * m, 0, t, 1.2), g = chain(ctx, bus, s, t, o); env(g, t, 0.002, [0.35, 0.12, 0.05][i] * o.g, [1.2, 0.6, 0.3][i]); });
    },
    type(ctx, bus, t, o, r) { const n = o.n || 8, rate = o.rate || 14; for (let i = 0; i < n; i++) { const tt = t + i / rate + r() * 0.012; S.click(ctx, bus, tt, Object.assign({}, o, { k: 0.8 + r() * 0.3, g: o.g * 0.6 }), r); S.thud(ctx, bus, tt, Object.assign({}, o, { g: o.g * 0.15 }), r); } },
    shutter(ctx, bus, t, o, r) { S.click(ctx, bus, t, o, r); S.paper(ctx, bus, t + 0.01, Object.assign({}, o, { dur: 0.05, g: o.g * 0.6 }), r); S.click(ctx, bus, t + 0.045, Object.assign({}, o, { k: o.k * 0.8 }), r); },
    heartbeat(ctx, bus, t, o, r) { const n = o.n || 2; for (let i = 0; i < n; i++) { const b = t + i * 0.85; S.thud(ctx, bus, b, o, r); S.thud(ctx, bus, b + 0.22, Object.assign({}, o, { g: o.g * 0.6 }), r); } },
    drone(ctx, bus, t, o) {
      const dur = o.dur || 4, f = NOTE[o.note || "A"] / 4, lp = bq(ctx, "lowpass", 700, 0.7);
      [0.997, 1, 1.004, 2.002].forEach(m => { const s = osc(ctx, "sawtooth", f * m, 0, t, dur), g = chain(ctx, bus, s, t, Object.assign({ dur }, o), [lp]); g.gain.setValueAtTime(1e-4, t); g.gain.exponentialRampToValueAtTime(0.05 * o.g, t + Math.min(1.5, dur / 3)); g.gain.setValueAtTime(0.05 * o.g, t + dur - 0.8); g.gain.exponentialRampToValueAtTime(1e-4, t + dur); });
    },
  };

  // simple music bed: kick/hat/bass/pad, phrase of 4 bars, chords per mood. Fallback when no licensed track is available.
  const MOODS = { warm: [0, 5, 3, 4], tense: [0, 1, 0, 6], bright: [0, 4, 5, 3], dark: [0, 6, 5, 4] }; // degrees in a minor/major scale
  function bed(ctx, bus, dur, b, rnd) {
    const bpm = b.bpm || 100, beat = 60 / bpm, root = NOTE[b.key || "A"] / 2, minor = b.mood !== "bright";
    const scale = minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11], prog = MOODS[b.mood || "warm"] || MOODS.warm, start = b.start || 0, end = Math.min(dur, b.end || dur);
    const mbus = ctx.createGain(); mbus.gain.value = db(b.db == null ? -6 : b.db); mbus.connect(bus);
    for (let t = start, i = 0; t < end - 0.05; t += beat, i++) {
      const bar = Math.floor(i / 4), deg = prog[bar % prog.length], f = root * Math.pow(2, scale[deg % 7] / 12);
      if (b.drums !== false && t >= start + (b.dropAt || 0)) {
        S.impact(ctx, mbus, t, { g: i % 4 === 0 ? 0.55 : 0.4, k: 1, size: 0.35 }, rnd);
        [0, 0.5].forEach(h => { const tt = t + h * beat, s = nsrc(ctx, tt, 0.04, rnd), g = chain(ctx, mbus, s, tt, { pan: 0.25 }, [bq(ctx, "highpass", 8000)]); env(g, tt, 0.001, h ? 0.12 : 0.07, 0.035); });
      }
      const bs = osc(ctx, "triangle", f, 0, t, beat * 0.9), gb = chain(ctx, mbus, bs, t, {}, [bq(ctx, "lowpass", 400)]); env(gb, t, 0.005, 0.35, beat * 0.8);
      if (i % 4 === 0) [0, 2, 4].forEach(k => { const ff = root * 2 * Math.pow(2, scale[(deg + k) % 7] / 12); [0.996, 1.004].forEach(m => { const s = osc(ctx, "sawtooth", ff * m, 0, t, beat * 4), g = chain(ctx, mbus, s, t, { pan: m < 1 ? -0.3 : 0.3 }, [bq(ctx, "lowpass", 1100, 0.5)]); g.gain.setValueAtTime(1e-4, t); g.gain.exponentialRampToValueAtTime(0.035, t + beat); g.gain.exponentialRampToValueAtTime(1e-4, t + beat * 4); }); });
    }
  }

  async function render(events, duration, opt) {
    opt = opt || {}; const ctx = new OfflineAudioContext(2, Math.ceil((duration + (opt.tail || 0.5)) * SR), SR);
    const master = ctx.createGain(), comp = ctx.createDynamicsCompressor(), lim = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.15;
    lim.threshold.value = -2; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.05; lim.knee.value = 0;
    master.connect(comp); comp.connect(lim); lim.connect(ctx.destination); master.gain.value = db(opt.masterDb || -3);
    const sfxBus = ctx.createGain(); sfxBus.gain.value = db(opt.sfxDb || 0); sfxBus.connect(master);
    const rnd = mul(opt.seed || 7);
    if (opt.bed) bed(ctx, master, duration, opt.bed, mul((opt.seed || 7) + 99));
    for (const [t, name, o0] of events) {
      const fn = S[name]; if (!fn) { console.warn("sfx: unknown", name); continue; }
      const o = Object.assign({}, o0 || {}); const rr = mul(Math.floor(t * 1000) + (o.seed || 0) + 13);
      o.k = (o.k || 1) * (1 + (rr() * 2 - 1) * 0.04); o.g = (o.gain == null ? 1 : o.gain) * db((rr() * 2 - 1) * 1.5);
      fn(ctx, sfxBus, Math.max(0, t), o, rr);
    }
    return ctx.startRendering();
  }
  function toWav(buf) {
    const ch = buf.numberOfChannels, n = buf.length, out = new DataView(new ArrayBuffer(44 + n * ch * 2)); let p = 0;
    const w = s => { for (const c of s) out.setUint8(p++, c.charCodeAt(0)); }, u32 = v => { out.setUint32(p, v, true); p += 4; }, u16 = v => { out.setUint16(p, v, true); p += 2; };
    w("RIFF"); u32(36 + n * ch * 2); w("WAVE"); w("fmt "); u32(16); u16(1); u16(ch); u32(SR); u32(SR * ch * 2); u16(ch * 2); u16(16); w("data"); u32(n * ch * 2);
    const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(p, v < 0 ? v * 0x8000 : v * 0x7FFF, true); p += 2; }
    return out.buffer;
  }
  function toWavBase64(buf) { const b = new Uint8Array(toWav(buf)); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
  G.SFX = { render, toWav, toWavBase64, sounds: Object.keys(S), SR };
})(typeof window !== "undefined" ? window : globalThis);
