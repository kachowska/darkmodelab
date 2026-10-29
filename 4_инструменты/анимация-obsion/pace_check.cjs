// pace_check.cjs <page.html> — проверка темпа до рендера: события в кадре в минуту, доля времени с видео,
// паузы ≥ 3 с без нового события (с долей видео и сценой), время мемов на экране. Вывод — JSON.
// Цели (Dark Mode Lab): событие каждые ≤ 2,5 с, видео/движущаяся вырезка ≥ 60 % времени, мем на экране ≥ 2,5 с.
// аудит темпа: моменты визуальных событий (старты твинов), паузы между ними, видео в кадре, время мемов на экране
const {chromium}=require('playwright');const path=require('path');
(async()=>{const [page]=process.argv.slice(2);const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});
await p.goto('file://'+path.resolve(page)+'?render=1');await p.evaluate(async()=>{await document.fonts.ready;await window.__ready});
const r=await p.evaluate(async()=>{
 const D=window.__duration;
 const starts=[...new Set(tl.getChildren(true,true,true).map(c=>Math.round(c.startTime()*10)/10))].filter(x=>x>0&&x<D).sort((a,b)=>a-b);
 const vis=e=>{for(let x=e;x&&x!==document.body;x=x.parentElement){const s=getComputedStyle(x);if(s.display==='none'||s.visibility==='hidden'||+s.opacity<0.05)return false;}return true;};
 const samples=[];
 for(let t=0;t<D;t+=0.2){await window.__seek(t);
   const vids=[...document.querySelectorAll('img.seq')].filter(e=>!e.closest('.meme')&&vis(e)).length;
   const memes=[...document.querySelectorAll('.meme')].filter(vis).map(e=>e.id);
   const sc=[...document.querySelectorAll('.sc')].filter(vis).map(e=>e.id).join('+');
   samples.push([Math.round(t*10)/10,vids,memes,sc]);}
 return {D,starts,samples};});
await b.close();
const {D,starts,samples}=r;
// паузы между событиями
const ev=[0,...starts,D];const gaps=[];
for(let i=1;i<ev.length;i++){const a=ev[i-1],z=ev[i];if(z-a>=3){const vid=samples.filter(s=>s[0]>=a&&s[0]<z&&s[1]>0).length/Math.max(1,samples.filter(s=>s[0]>=a&&s[0]<z).length);const mid=samples.find(s=>s[0]>=(a+z)/2)||samples[samples.length-1];gaps.push([a,z,+(z-a).toFixed(1),Math.round(vid*100),mid[3]]);}}
const memeT={};samples.forEach(s=>s[2].forEach(m=>{memeT[m]=memeT[m]||[s[0],s[0]];memeT[m][1]=s[0]+0.2;}));
const vidShare=Math.round(samples.filter(s=>s[1]>0).length/samples.length*100);
console.log(JSON.stringify({D,events:starts.length,perMin:+(starts.length/D*60).toFixed(1),vidShare,gaps,memes:Object.entries(memeT).map(([k,v])=>[k,v[0],+(v[1]-v[0]).toFixed(1)])}));
})();
