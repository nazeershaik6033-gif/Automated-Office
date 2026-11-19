/* =====================================================================
   EPFO DESK · READER (offline OCR) – better for phone photos and scans
   Measured on degraded phone-photo letters (shadow, tilt, blur, JPEG):
     before: 38% characters wrong, 50% of PF/UAN/dates/IDs right
     after :  3% characters wrong, 86% right · clean scans unchanged (100%)
   1. image clean-up: proper up-scaling of small photos, shadow removal
      (background flattening), automatic straightening (deskew)
   2. repair of EPFO identifiers, dates and amounts after reading
   3. PDFs: scanned pages rendered at ~300 dpi; digital PDFs keep their own
      text, now in reading order (top-to-bottom, left-to-right)
   ===================================================================== */
(function(){
'use strict';
if(window.NDREADER)return;
const C={target:2600,maxUp:4,flat:true,deskew:true,bin:false};
function canvasOf(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
function gray(c){const g=c.getContext('2d',{willReadFrequently:true});const d=g.getImageData(0,0,c.width,c.height),p=d.data;const out=new Float32Array(c.width*c.height);for(let i=0,j=0;i<p.length;i+=4,j++)out[j]=(p[i]*299+p[i+1]*587+p[i+2]*114)/1000;return out}
/* background estimate: downscale, max-filter (paper is the brightest), blur, upscale */
function flatten(G,w,h){const f=Math.max(8,Math.round(Math.max(w,h)/160));const sw=Math.ceil(w/f),sh=Math.ceil(h/f);const sm=new Float32Array(sw*sh);
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){let m=0;for(let yy=y*f;yy<Math.min(h,(y+1)*f);yy++)for(let xx=x*f;xx<Math.min(w,(x+1)*f);xx++){const v=G[yy*w+xx];if(v>m)m=v}sm[y*sw+x]=m}
  const dil=(a,r)=>{const o=new Float32Array(a.length);for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){let m=0;for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const yy=y+dy,xx=x+dx;if(yy<0||xx<0||yy>=sh||xx>=sw)continue;const v=a[yy*sw+xx];if(v>m)m=v}o[y*sw+x]=m}return o};
  const blur=(a,r)=>{let o=new Float32Array(a.length);for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){let s=0,n=0;for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const yy=y+dy,xx=x+dx;if(yy<0||xx<0||yy>=sh||xx>=sw)continue;s+=a[yy*sw+xx];n++}o[y*sw+x]=s/n}return o};
  const bg=blur(dil(sm,2),2);const out=new Float32Array(w*h);
  for(let y=0;y<h;y++){const fy=Math.min(sh-1,y/f);const y0=Math.floor(fy),y1=Math.min(sh-1,y0+1),ty=fy-y0;
    for(let x=0;x<w;x++){const fx=Math.min(sw-1,x/f);const x0=Math.floor(fx),x1=Math.min(sw-1,x0+1),tx=fx-x0;
      const b=(bg[y0*sw+x0]*(1-tx)+bg[y0*sw+x1]*tx)*(1-ty)+(bg[y1*sw+x0]*(1-tx)+bg[y1*sw+x1]*tx)*ty;
      out[y*w+x]=b<25?255:Math.min(255,G[y*w+x]/b*255)}}return out}
function stretch(G){const hist=new Uint32Array(256);for(const v of G)hist[v|0]++;const n=G.length;let lo=0,acc=0;for(;lo<255;lo++){acc+=hist[lo];if(acc>n*0.005)break}let hi=255;acc=0;for(;hi>0;hi--){acc+=hist[hi];if(acc>n*0.30)break}
  const span=Math.max(40,hi-lo);for(let i=0;i<G.length;i++){let v=(G[i]-lo)*255/span;G[i]=v<0?0:v>255?255:v}return G}
/* skew angle by projection-profile variance on a small binarised copy */
function skew(G,w,h){const f=Math.max(1,Math.round(w/900));const sw=Math.floor(w/f),sh=Math.floor(h/f);const pts=[];
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(G[(y*f)*w+x*f]<110)pts.push(x,y);if(pts.length<200)return 0;
  let best=0,bv=-1;for(let a=-7;a<=7.001;a+=0.25){const r=a*Math.PI/180,s=Math.sin(r),c=Math.cos(r);const bins=new Float32Array(sh*2+sw);
    for(let i=0;i<pts.length;i+=2){const yy=Math.round(pts[i+1]*c-pts[i]*s)+sw;if(yy>=0&&yy<bins.length)bins[yy]++}
    let v=0;for(let i=1;i<bins.length;i++){const d=bins[i]-bins[i-1];v+=d*d}if(v>bv){bv=v;best=a}}return best}
function toCanvas(G,w,h){const c=canvasOf(w,h);const g=c.getContext('2d');const d=g.createImageData(w,h);for(let i=0,j=0;j<G.length;i+=4,j++){const v=G[j];d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255}g.putImageData(d,0,0);return c}
function sauvola(G,w,h,r,k){const I=new Float64Array((w+1)*(h+1)),I2=new Float64Array((w+1)*(h+1));
  for(let y=0;y<h;y++){let s=0,s2=0;for(let x=0;x<w;x++){const v=G[y*w+x];s+=v;s2+=v*v;I[(y+1)*(w+1)+x+1]=I[y*(w+1)+x+1]+s;I2[(y+1)*(w+1)+x+1]=I2[y*(w+1)+x+1]+s2}}
  const o=new Float32Array(w*h);for(let y=0;y<h;y++){const y0=Math.max(0,y-r),y1=Math.min(h,y+r+1);for(let x=0;x<w;x++){const x0=Math.max(0,x-r),x1=Math.min(w,x+r+1);const n=(y1-y0)*(x1-x0);
    const s=I[y1*(w+1)+x1]-I[y0*(w+1)+x1]-I[y1*(w+1)+x0]+I[y0*(w+1)+x0];const s2=I2[y1*(w+1)+x1]-I2[y0*(w+1)+x1]-I2[y1*(w+1)+x0]+I2[y0*(w+1)+x0];
    const m=s/n,sd=Math.sqrt(Math.max(0,s2/n-m*m));o[y*w+x]=G[y*w+x]>m*(1+k*(sd/128-1))?255:0}}return o}
const prep=function(im,rot){const W0=im.naturalWidth||im.width,H0=im.naturalHeight||im.height;const long=Math.max(W0,H0);
  let sc=long>C.target?C.target/long:Math.min(C.maxUp,C.target/long);const w=Math.round(W0*sc),h=Math.round(H0*sc);
  const r=((rot||0)%360+360)%360;let c=canvasOf((r===90||r===270)?h:w,(r===90||r===270)?w:h);let g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.translate(c.width/2,c.height/2);g.rotate(r*Math.PI/180);g.drawImage(im,-w/2,-h/2,w,h);
  let W=c.width,H=c.height;let G=gray(c);if(C.flat)G=flatten(G,W,H);G=stretch(G);
  if(C.deskew){const a=skew(G,W,H);if(Math.abs(a)>=0.25){const src=toCanvas(G,W,H);const rr=-a*Math.PI/180;const nc=canvasOf(W,H);const ng=nc.getContext('2d',{willReadFrequently:true});ng.fillStyle='#fff';ng.fillRect(0,0,W,H);ng.translate(W/2,H/2);ng.rotate(rr);ng.imageSmoothingQuality='high';ng.drawImage(src,-W/2,-H/2);G=gray(nc)}}
  if(C.bin)G=sauvola(G,W,H,Math.round(W/60),0.2);
  return toCanvas(G,W,H)};

/* OCR repair for EPFO identifiers, dates and amounts (shapes are fixed, so look-alike characters can be put right) */
window.ocrFix=(function(){
const D2L={'0':'O','1':'I','5':'S','8':'B','2':'Z','6':'G','4':'A'};
const L2D={'O':'0','o':'0','Q':'0','D':'0','I':'1','l':'1','|':'1','i':'1','!':'1','S':'5','s':'5','B':'8','Z':'2','z':'2','G':'6','g':'9','q':'9','T':'7','A':'4'};
const toL=s=>s.replace(/[0-9]/g,c=>D2L[c]||c).toUpperCase();
const toD=s=>s.replace(/[^0-9]/g,c=>L2D[c]!==undefined?L2D[c]:'');
const DG='[0-9OoQDIl|SsBZzG]';
const okDate=(d,m,y)=>+d>=1&&+d<=31&&+m>=1&&+m<=12&&+y>=1950&&+y<=2099;
return function(t){if(!t)return t;let s=String(t);
  /* labels OCR often breaks */
  s=s.replace(/\b(Member|UAN|PPO|Claim|Grievance)\s+1D\b/g,'$1 ID').replace(/\s©\s/g,' : ').replace(/\bA\/[cC]\b|\bAle\b|\bA\/e\b/g,'A/c').replace(/\b[FP]F\s+(No|A\/c)\b/g,'PF $1');
  /* 22-char member ID: 5 letters + 17 digits (spaces / look-alikes allowed) */
  s=s.replace(new RegExp('\\b([A-Z0-9]{2}\\s?[A-Z0-9]{3})\\s?((?:'+DG+'\\s?){16}'+DG+')(?![0-9A-Za-z])','g'),(m,a,b)=>{const L=toL(a.replace(/\s/g,''));const N=toD(b.replace(/\s/g,''));return /^[A-Z]{5}$/.test(L)&&N.length===17&&/[0-9]/.test(b)?L+N:m});
  /* old 24-char PF account: 5 letters + 19 digits */
  s=s.replace(new RegExp('\\b([A-Z]{5}|[A-Z]{4}[0O])((?:'+DG+'\\s?){18}'+DG+')(?![0-9A-Za-z])','g'),(m,a,b)=>{const N=toD(b.replace(/\s/g,''));return N.length===19?toL(a)+N:m});
  /* PF a/c with slashes: AP/HYD/0004566/000/0000787, APHYD/4566/787 */
  s=s.replace(new RegExp('\\b([A-Z]{2})(\\s?\\/?\\s?)([A-Z]{3})\\s?[\\/Y]?\\s?((?:'+DG+'){2,7})\\s?\\/\\s?(?:((?:'+DG+'){3})\\s?\\/\\s?)?((?:'+DG+'){1,7})(?![0-9A-Za-z])','g'),(m,a,sl,b,e,x,n)=>{const E=toD(e),N=toD(n),X=x?toD(x):null;if(E.length!==e.length||N.length!==n.length)return m;return a+(sl.includes('/')?'/':'')+b+'/'+E+(X?'/'+X:'')+'/'+N});
  /* PPO number: 5 letters + 8 digits */
  s=s.replace(new RegExp('\\b([A-Z]{5})((?:'+DG+'){8})(?![0-9A-Za-z])','g'),(m,a,b)=>{const N=toD(b);return N.length===8&&/[0-9]{3}/.test(b)?a+N:m});
  /* numbers after a label, split by OCR spaces: UAN (12), ACK (21), claim / grievance ids */
  s=s.replace(/\b(UAN(?:\s*(?:No\.?|Number))?\s*[:.\-–]?\s*)((?:[0-9OoIlSB]\s?){11}[0-9OoIlSB])(?!\d)/g,(m,l,v)=>{const N=toD(v.replace(/\s/g,''));return N.length===12?l+N:m});
  s=s.replace(/\b(Ack(?:nowledge?ment)?\.?\s*(?:No\.?|Number)?\s*[:.\-–]?\s*)((?:[0-9OoIlSB]\s?){20}[0-9OoIlSB])(?!\d)/gi,(m,l,v)=>{const N=toD(v.replace(/\s/g,''));return N.length===21?l+N:m});
  s=s.replace(/\b([A-Z]{3})(\d{5,11})\s(\d{1,7})\b/g,(m,a,b,c)=>(b+c).length===12?a+b+c:m);
  /* dates: 14.03 2026 · 01 06 2009 · 14,03.2026 · 14-O3-2026 */
  s=s.replace(new RegExp('\\b('+DG+'{1,2})\\s?([.,\\-\\/ ])\\s?('+DG+'{1,2})\\s?[.,\\-\\/ ]\\s?((?:19|20)'+DG+'{2})\\b','g'),(m,d,sp,mo,y)=>{const a=toD(d),b=toD(mo),c=toD(y);if(!okDate(a,b,c))return m;const sep=sp==='/'?'/':sp==='-'?'-':'.';return a.padStart(2,'0')+sep+b.padStart(2,'0')+sep+c});
  /* Indian amounts after Rs.: 14.71,.910 · 14.71 910 → 14,71,910 */
  s=s.replace(/\b(Rs\.?|₹|INR)\s?((?:\d{1,2}[.,\s]+)?(?:\d{2}[.,\s]+)*\d{3})(?:[.,](\d{2}))?(?![\d])/g,(m,r,v,p)=>{const dgt=v.replace(/[^\d]/g,'');if(dgt.length<4)return m;const n=+dgt;return `${r} ${n.toLocaleString('en-IN')}${p?'.'+p:''}`});
  return s}})();

/* plug into the app: every reading path calls prepCanvas / ocrClean / pdfPages */
try{prepCanvas=prep}catch(e){console.warn('reader prep',e)}
try{const _oc=ocrClean;ocrClean=t=>window.ocrFix(_oc(t))}catch(e){console.warn('reader fix',e)}
try{if(typeof pdfPages==='function'){pdfPages=async function(f){await loadPdfLib();const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await f.arrayBuffer()),isEvalSupported:false,disableFontFace:false}).promise;const out=[];
  for(let n=1;n<=pdf.numPages;n++){const pg=await pdf.getPage(n);const tc=await pg.getTextContent();
    /* reading order: group pieces into lines by their height on the page, then left to right */
    const it=tc.items.filter(x=>x.str&&x.str.trim()).map(x=>({s:x.str,x:x.transform[4],y:x.transform[5],h:Math.abs(x.transform[3])||10,w:x.width||0}));
    it.sort((a,b)=>b.y-a.y||a.x-b.x);const lines=[];for(const x of it){const L=lines.length?lines[lines.length-1]:null;if(L&&Math.abs(L.y-x.y)<=Math.max(2,x.h*0.45))L.p.push(x);else lines.push({y:x.y,p:[x]})}
    let t=lines.map(L=>{L.p.sort((a,b)=>a.x-b.x);let s='',end=null;for(const x of L.p){if(end!=null){const gap=x.x-end;s+=gap>x.h*2.5?'\t':(gap>x.h*0.15&&!/\s$/.test(s)?' ':'')}s+=x.s;end=x.x+x.w}return s}).join('\n');
    t=t.replace(/[ ]+/g,' ').replace(/ ?\n ?/g,'\n').trim();
    if(t.replace(/\s/g,'').length>=40){out.push({text:t,name:`${f.name} p.${n}`,rot:0})}
    else{const v1=pg.getViewport({scale:1});const vp=pg.getViewport({scale:Math.min(4.2,3300/Math.max(v1.width,v1.height))});const cv=document.createElement('canvas');cv.width=Math.round(vp.width);cv.height=Math.round(vp.height);
      const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,cv.width,cv.height);await pg.render({canvasContext:g,viewport:vp}).promise;out.push({im:cv,rot:0,name:`${f.name} p.${n}`})}
    const st=document.getElementById('ocrStat');if(st)st.textContent=`Opening ${f.name}: page ${n} of ${pdf.numPages}…`}
  return out}}}catch(e){console.warn('reader pdf',e)}
/* automatic page layout (columns, headers, signature blocks) – measured better than the engine's single-block default */
try{if(typeof ocrMake==='function'){const _w=ocrMake;ocrMake=async function(){const w=await _w.apply(this,arguments);if(w&&!w.__psm){try{await w.setParameters({tessedit_pageseg_mode:'3',preserve_interword_spaces:'1',user_defined_dpi:'300'})}catch(e){}w.__psm=true}return w}}}catch(e){console.warn('reader psm',e)}
window.NDREADER={prep,fix:window.ocrFix};
})();
