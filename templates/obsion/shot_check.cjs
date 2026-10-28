// shot_check.cjs <page.html> — проверка «мелькающих» кадров: сцены и сочетания, которые видны меньше 1,8 с подряд.
// Перебивка не должна съедать сцену: сцену видно ≥ 2,5 с до перебивки и ≥ 2 с после (DML.inserts держит это сам для больших перебивок).
const {chromium}=require('playwright');const path=require('path');
(async()=>{const [page]=process.argv.slice(2);const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});
await p.goto('file://'+path.resolve(page)+'?render=1');await p.evaluate(async()=>{await window.__ready});
const r=await p.evaluate(async()=>{const D=window.__duration;const vis=e=>{for(let x=e;x&&x!==document.body;x=x.parentElement){const s=getComputedStyle(x);if(s.display==='none'||s.visibility==='hidden'||+s.opacity<0.15)return false;}return true;};
 const out=[];for(let t=0;t<D;t+=0.1){tl.seek(t,false);const sc=[...document.querySelectorAll('.sc,.ins')].filter(vis).map(e=>e.id||e.className.split(' ').pop()+'@'+[...document.querySelectorAll('.ins')].indexOf(e)).join('+');out.push([+t.toFixed(1),sc]);}return {D,out};});
await b.close();
// runs
const runs=[];let cur=null;for(const [t,s] of r.out){if(!cur||cur.s!==s){if(cur)runs.push(cur);cur={s,a:t,z:t};}cur.z=t+0.1;}runs.push(cur);
console.log(JSON.stringify(runs.filter(x=>x.z-x.a<1.8&&x.s).map(x=>[x.a,+(x.z-x.a).toFixed(1),x.s])));})();
