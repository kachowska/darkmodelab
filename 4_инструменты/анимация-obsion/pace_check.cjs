// pace_check.cjs <page.html> [--max-gap 3.5] [--max-full 3.5] — проверка темпа и подачи до рендера. Вывод — JSON, код выхода 1 при нарушениях.
// Цели Dark Mode Lab (устав §4, §6; библия светлого стиля):
//  • крупное визуальное событие каждые ≤ 3,5 с. Событие — смена плана (сцены), новая улика / вырезка / видео / фото, движение предмета на столе,
//    прорисовка схемы (svg), перевод камеры (window.CAM_EVENTS = [t…], если глава их публикует). Появление текста событием НЕ считается.
//  • видео на весь кадр — короткими планами ≤ 3,5 с; дальше сцена возвращается на стол (видео внутри полароида/карточки — видео-сцена).
//  • фото на весь кадр без крупного события — ≤ 4 с.
//  • первый кадр (0,3 с) — якорь: документ, улика, полароид, схема или заголовок/штамп поверх кадра.
//  • живое видео (покадровые клипы img.seq, <video>) НА ЭКРАНЕ ≥ 70 % времени, и в каждом отрезке > 3,5 с без видео — нарушение;
//    элемент считается на экране, когда видна хотя бы 1,5 % кадра (стол может быть больше кадра — камера ездит по нему);
//  • видео и настоящая съёмка в кадре ≥ 70 % времени: видео, фото мест и людей, вырезки (картинки внутри .sheet/.doc — документы, они в долю не входят);
//    в главе есть вырезки (.cut / .stk / .cutout).
//  • мемы: время на экране.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const A = process.argv.slice(2), page = A[0], opt = (k, d) => { const i = A.indexOf('--' + k); return i >= 0 ? +A[i + 1] : d; };
  const MAXGAP = opt('max-gap', 3.5), MAXFULL = opt('max-full', 3.5), MAXSTILL = 4;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + path.resolve(page) + '?render=1'); await p.evaluate(async () => { await document.fonts.ready; await window.__ready; });
  const r = await p.evaluate(async () => {
    const D = window.__duration;
    // текст = элемент без картинок, видео и svg-графики внутри, с текстом
    const isText = e => e && e.nodeType === 1 && !(e.matches && e.matches('img,svg,video,canvas,.sc')) && !e.querySelector('img,svg,video,canvas') && (e.textContent || '').trim().length > 0;
    const real = [];
    tl.getChildren(true, true, false).forEach(c => {
      const T = c.targets ? c.targets() : []; if (!T.length) return;
      const st = Math.round(c.startTime() * 10) / 10; if (st <= 0 || st >= D) return;
      const nonText = T.some(e => !(e instanceof Element) ? false : !isText(e));
      if (nonText) real.push(st);
    });
    (window.CAM_EVENTS || []).forEach(t => real.push(Math.round(t * 10) / 10));
    const starts = [...new Set(real)].sort((a, b) => a - b);
    const vis = e => { for (let x = e; x && x !== document.body; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return false; } return true; };
    const cover = e => { const q = e.getBoundingClientRect(); const w = Math.max(0, Math.min(1920, q.right) - Math.max(0, q.left)), h = Math.max(0, Math.min(1080, q.bottom) - Math.max(0, q.top)); return w * h / (1920 * 1080); };
    const samples = [];
    for (let t = 0; t < D; t += 0.2) {
      await window.__seek(t);
      const imgs = [...document.querySelectorAll('img,video')].filter(e => !e.closest('.meme') && vis(e) && cover(e) > 0.015);
      const vids = imgs.filter(e => e.classList.contains('seq') || e.tagName === 'VIDEO');
      const fullV = vids.some(e => cover(e) > 0.8), fullP = imgs.some(e => !e.classList.contains('seq') && cover(e) > 0.8);
      const memes = [...document.querySelectorAll('.meme')].filter(vis).map(e => e.id);
      const sc = [...document.querySelectorAll('.sc')].filter(vis).map(e => e.id).join('+');
      const shoot = imgs.filter(e => !e.closest('.sheet,.doc')).length;
      samples.push([Math.round(t * 10) / 10, shoot, memes, sc, fullV, fullP, vids.length, imgs.length]);
    }
    await window.__seek(0.3);
    const anchorEls = [...document.querySelectorAll('.sheet,.doc,.pol,.ev,.cut,.stk,.cutout,.t-title,.t-stamp,.t-num,.t-quote,.h,.big,.pl,svg path')].filter(vis);
    const anchor = anchorEls.length > 0;
    const cuts = document.querySelectorAll('.cut,.stk,.cutout').length;
    return { D, starts, samples, anchor, anchorEls: anchorEls.slice(0, 3).map(e => e.className.baseVal != null ? 'svg' : e.className), cuts };
  });
  await b.close();
  const { D, starts, samples, anchor, cuts } = r, fail = [];
  // паузы между крупными событиями
  const ev = [0, ...starts, D], gaps = [];
  for (let i = 1; i < ev.length; i++) { const a = ev[i - 1], z = ev[i]; if (z - a > MAXGAP) { const mid = samples.find(s => s[0] >= (a + z) / 2) || samples[samples.length - 1]; gaps.push([a, z, +(z - a).toFixed(1), mid[3]]); } }
  if (gaps.length) fail.push(`паузы без крупного события > ${MAXGAP} с: ${gaps.length}`);
  // непрерывные интервалы видео / фото на весь кадр
  const runs = (k) => { const R = []; let s0 = null; samples.forEach(s => { if (s[k]) { if (s0 == null) s0 = s[0]; } else if (s0 != null) { R.push([s0, s[0]]); s0 = null; } }); if (s0 != null) R.push([s0, D]); return R.map(([a, z]) => [a, +z.toFixed(1), +(z - a).toFixed(1)]); };
  const fullVideo = runs(4).filter(x => x[2] > MAXFULL), fullPhoto = runs(5).filter(x => x[2] > MAXSTILL);
  if (fullVideo.length) fail.push(`видео на весь кадр дольше ${MAXFULL} с: ${fullVideo.length}`);
  // фото на весь кадр без крупного события дольше 4 с
  const stillLong = fullPhoto.filter(([a, z]) => { const inside = starts.filter(t => t > a && t < z); const pts = [a, ...inside, z]; return pts.some((t, i) => i && t - pts[i - 1] > MAXSTILL); });
  if (stillLong.length) fail.push(`фото на весь кадр без события дольше ${MAXSTILL} с: ${stillLong.length}`);
  if (!anchor) fail.push('первый кадр без якоря: нет документа, улики, схемы или заголовка на 0,3 с');
  const vidShare = Math.round(samples.filter(s => s[6] > 0).length / samples.length * 100), realShare = Math.round(samples.filter(s => s[1] > 0).length / samples.length * 100), docShare = Math.round(samples.filter(s => s[7] > 0 && !s[1]).length / samples.length * 100);
  const fullShare = Math.round(samples.filter(s => s[4]).length / samples.length * 100);
  if (realShare < 70) fail.push(`видео и настоящая съёмка в кадре ${realShare} % < 70 %`);
  if (vidShare < 70) fail.push(`живое видео на экране ${vidShare} % < 70 %`);
  const noVideo = (() => { const R = []; let s0 = null; samples.forEach(s => { if (!s[6]) { if (s0 == null) s0 = s[0]; } else if (s0 != null) { R.push([s0, s[0]]); s0 = null; } }); if (s0 != null) R.push([s0, D]); return R.map(([a, z]) => [a, +z.toFixed(1), +(z - a).toFixed(1)]).filter(x => x[2] > MAXGAP); })();
  if (noVideo.length) fail.push(`отрезки без видео в кадре > ${MAXGAP} с: ${noVideo.length}`);
  if (!cuts) fail.push('в главе нет вырезок (.cut / .stk / .cutout)');
  const memeT = {}; samples.forEach(s => s[2].forEach(m => { memeT[m] = memeT[m] || [s[0], s[0]]; memeT[m][1] = s[0] + 0.2; }));
  console.log(JSON.stringify({ D, events: starts.length, perMin: +(starts.length / D * 60).toFixed(1), vidShare, realShare, docOnlyShare: docShare, fullVideoShare: fullShare, anchor, cutouts: cuts,
    gaps, noVideo, fullVideo, fullPhotoStill: stillLong, memes: Object.entries(memeT).map(([k, v]) => [k, v[0], +(v[1] - v[0]).toFixed(1)]), fail }, null, 0));
  process.exit(fail.length ? 1 : 0);
})();
