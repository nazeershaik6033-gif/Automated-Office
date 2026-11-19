/* =====================================================================
   NOTING DESK · SYNC  (PC  <->  iPhone, fully offline)
   1. Pen-drive sync file – one .json file, same format as the normal
      backup (app:'NotingDesk', v:4), so even an older Noting Desk can
      restore it. Merging uses ndMerge: nothing is replaced, the newer
      edit wins, deleted items stay deleted.
   2. QR quick sync – the changes since the last send are compressed
      and shown as a loop of QR codes; the other device scans them with
      its camera. No cable, no internet.
   ===================================================================== */
(function(){
'use strict';
if(window.NDSYNC)return;
const q=(s,r)=>(r||document).querySelector(s);
const LS={dev:'ndsync_dev',last:'ndsync_last',dy:'ndsync_dyseen'};
const lsGet=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const WEB=/^https?:$/.test(location.protocol);
const h=s=>(typeof esc==='function'?esc(s):String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])));
const say=m=>{try{toast(m)}catch(e){console.log(m)}};
const pad=n=>String(n).padStart(2,'0');
const stamp=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
const when=t=>t?new Date(t).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'never';
const mb=n=>n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';

/* ---------------- this device ---------------- */
function dev(){let d=lsGet(LS.dev,null);if(!d||!d.id){d={id:Math.random().toString(36).slice(2,10),name:IOS?'iPhone':(/Android/i.test(navigator.userAgent)?'Phone':'PC')};lsSet(LS.dev,d)}return d}
function last(){return lsGet(LS.last,{sent:0,recv:0,from:'',fromSaved:''})}
function lastSet(o){lsSet(LS.last,Object.assign(last(),o));draw()}

/* diary rows carry no edit time – remember when this device first saw each row */
function dyStamp(){if(typeof DY==='undefined'||!DY||!Array.isArray(DY.rows))return {};let s=lsGet(LS.dy,null);const first=!s;s=s||{};let ch=first;const now=Date.now();
  for(const r of DY.rows){if(r&&r.id&&!s[r.id]){s[r.id]=first?1:now;ch=true}}if(ch)lsSet(LS.dy,s);return s}

/* ---------------- build a sync package (same shape as ndBackup v4) ---------------- */
async function build(opt){opt=opt||{};const since=+opt.since||0,withPdf=!!opt.pdf;
  const keep=r=>!since||((r&&(r.mod||r.t))||0)>since;
  const uc=[];for(const u of UC)if(keep(u))uc.push(await ndPack(u,'circ',withPdf));
  const ord=[];for(const r of COL.ord)if(keep(r))ord.push(await ndPack(r,'ord',withPdf));
  const mail=[];for(const r of COL.mail)if(keep(r))mail.push(await ndPack(r,'mail',withPdf));
  const spt=COL.spt.filter(keep).map(cleanRec);
  const history=(await hAll()).filter(x=>!since||(x.ts||0)>since);
  const seen=dyStamp();const diary=(typeof DY!=='undefined'&&DY)?{rows:(DY.rows||[]).filter(r=>!since||(seen[r.id]||0)>since),rj:DY.rj||[],auto:DY.auto}:null;
  const ovr=Object.values(CS.ovr||{}).filter(o=>!since||(o.mod||0)>since);
  let pohw=null;try{pohw=window.nd6PohwPack?nd6PohwPack():null;if(pohw&&since&&pohw.cases){const c={};for(const id in pohw.cases){const x=pohw.cases[id];if(((x&&x.savedAt)||0)>since)c[id]=x}pohw.cases=c}}catch(e){}
  const d=dev();let members=null;try{members=window.NDMEM?await NDMEM.pack(since):null}catch(e){console.warn('members',e)}
  let learnDocs=null;try{learnDocs=window.NDLEARN?NDLEARN.pack(since):null}catch(e){}
  return {app:'NotingDesk',v:4,members,learnDocs,saved:new Date().toISOString(),pdfs:withPdf,
    sync:{from:d.name,dev:d.id,since,kind:opt.kind||'file'},
    history,cfg:CFG,learned:(typeof LD!=='undefined'?LD:null),diary,circ:{uc,ovr},ord,mail,spt,deleted:DEL,
    nd2:{cfg:ND2,used:NDUSE,ui:(window.NDUI?NDUI.get():null)},pins:PIN,pohw};
}
function count(p){return (((p.members&&p.members.books)||[]).length+p.circ.uc.length+p.ord.length+p.mail.length+p.spt.length+p.history.length+((p.diary&&p.diary.rows.length)||0))}

/* ---------------- receive (file or QR) ---------------- */
async function receive(text,name){let j;try{j=JSON.parse(text)}catch(e){say('This is not an EPFO Desk sync file');return false}
  if(!j||(j.app!=='NotingDesk'&&j.app!=='NotingDeskData')){say('This is not an EPFO Desk sync or backup file');return false}
  await ndRestore(new File([text],name||'sync.json',{type:'application/json'}));
  dyStamp();lastSet({recv:Date.now(),from:(j.sync&&j.sync.from)||'backup file',fromSaved:j.saved||''});return true}

/* ---------------- 1. pen-drive file ---------------- */
async function fileOut(){const pdf=!!(q('#nsPdf')&&q('#nsPdf').checked);say('Preparing the sync file…');
  try{const p=await build({pdf,kind:'file'});const blob=new Blob([JSON.stringify(p)],{type:'application/json'});
    const nm=`EPFODesk_sync_${dev().name.replace(/[^A-Za-z0-9]+/g,'')}_${stamp(new Date())}.json`;
    saveBlob(blob,nm);lastSet({sent:Date.now()});
    say(`Sync file ready (${mb(blob.size)}) – ${IOS?'choose “Save to Files” and pick the pen drive':'save it on the pen drive'}`)}
  catch(e){console.error(e);alert('Could not make the sync file: '+(e.message||e))}}
function fileIn(){const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.multiple=true;
  i.onchange=async()=>{const fs=[...i.files].sort((a,b)=>a.lastModified-b.lastModified);for(const f of fs)await receive(await f.text(),f.name)};i.click()}

/* ---------------- 2. QR quick sync ---------------- */
const CH=620;                       /* characters per QR frame */
const b64=u=>{let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
const unb64=s=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u};
async function gz(str){if(typeof CompressionStream==='undefined')return null;return new Uint8Array(await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer())}
async function ungz(u){return await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text()}
let QS=null;   /* sender state   */
let QR=null;   /* receiver state */

function sinceOf(v){const L=last();if(v==='last')return L.sent||0;if(v==='1d')return Date.now()-864e5;if(v==='7d')return Date.now()-7*864e5;if(v==='30d')return Date.now()-30*864e5;return 0}
async function qrOut(){if(typeof qrcode!=='function'){say('QR maker is missing');return}
  const v=(q('#nsSince')||{}).value||'last';say('Packing the changes…');
  const p=await build({since:sinceOf(v),kind:'qr'});const n0=count(p);
  const json=JSON.stringify(p);const z=await gz(json);const data=z?'z'+b64(z):'j'+b64(new TextEncoder().encode(json));
  const sid=Math.random().toString(36).slice(2,6);const n=Math.ceil(data.length/CH);
  const frames=[];for(let i=0;i<n;i++)frames.push(`NDQ1|${sid}|${i+1}|${n}|${data.slice(i*CH,(i+1)*CH)}`);
  QS={frames,i:0,ms:300,timer:null,n0};
  const box=q('#nsQrOut');box.hidden=false;
  box.innerHTML=`<div class="ns-qrhead"><b>${n0} item${n0===1?'':'s'}</b> · ${n} QR code${n>1?'s':''} · ${mb(data.length)}${n>120?' <span class="ns-warn">– that is a lot; the pen-drive file is quicker</span>':''}</div>
    <canvas id="nsQrCv" width="560" height="560" aria-label="Sync QR code"></canvas>
    <div class="ns-row ns-c"><span id="nsQrN">1 / ${n}</span></div>
    <div class="ns-row ns-c"><button class="btn" type="button" id="nsSlow">🐢 Slower</button><button class="btn" type="button" id="nsPause">⏸ Pause</button><button class="btn" type="button" id="nsFast">🐇 Faster</button></div>
    <p class="hint">On the other device open <b>Sync ▸ Scan QR codes</b> and hold the camera steady on this code – the codes loop until every piece is caught, in any order.</p>
    <div class="ns-row ns-c"><button class="btn pri" type="button" id="nsQrDone">✓ Received on the other device</button><button class="btn" type="button" id="nsQrStop">Close</button></div>`;
  q('#nsSlow').onclick=()=>{QS.ms=Math.min(1500,QS.ms+150);qrLoop()};q('#nsFast').onclick=()=>{QS.ms=Math.max(120,QS.ms-80);qrLoop()};
  q('#nsPause').onclick=e=>{if(QS.timer){clearInterval(QS.timer);QS.timer=null;e.target.textContent='▶ Play'}else{qrLoop();e.target.textContent='⏸ Pause'}};
  q('#nsQrDone').onclick=()=>{lastSet({sent:Date.now()});qrStop();say('Marked as sent – next time only newer changes are sent')};
  q('#nsQrStop').onclick=qrStop;qrDraw();qrLoop();box.scrollIntoView({block:'nearest',behavior:'smooth'})}
function qrDraw(){const cv=q('#nsQrCv');if(!cv||!QS)return;const s=QS.frames[QS.i];
  const qr=qrcode(0,'L');qr.addData(s,'Byte');qr.make();const m=qr.getModuleCount(),quiet=4,cell=Math.floor(cv.width/(m+quiet*2)),off=Math.floor((cv.width-cell*m)/2);
  const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,cv.width,cv.height);g.fillStyle='#000';
  for(let r=0;r<m;r++)for(let c=0;c<m;c++)if(qr.isDark(r,c))g.fillRect(off+c*cell,off+r*cell,cell,cell);
  const n=q('#nsQrN');if(n)n.textContent=`${QS.i+1} / ${QS.frames.length}`}
function qrLoop(){if(!QS)return;clearInterval(QS.timer);if(QS.frames.length<2)return;QS.timer=setInterval(()=>{QS.i=(QS.i+1)%QS.frames.length;qrDraw()},QS.ms)}
function qrStop(){if(QS){clearInterval(QS.timer);QS=null}const b=q('#nsQrOut');if(b){b.hidden=true;b.innerHTML=''}}

async function qrIn(){if(typeof jsQR!=='function'){say('QR reader is missing');return}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){alert('This browser cannot use the camera here. Use the pen-drive sync file instead.');return}
  const box=q('#nsQrIn');box.hidden=false;
  box.innerHTML=`<div class="ns-cam"><video id="nsVid" playsinline muted autoplay></video><div class="ns-aim"></div></div>
    <div class="ns-prog"><i id="nsBar"></i></div><div class="ns-row ns-c"><span id="nsGot">Point the camera at the QR code on the other screen…</span></div>
    <div class="ns-row ns-c"><button class="btn" type="button" id="nsCamStop">Cancel</button></div>`;
  q('#nsCamStop').onclick=camStop;
  let st;try{st=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false})}
  catch(e){box.innerHTML=`<p class="ns-warn">Camera not available (${h(e.name||e.message||e)}). Allow camera access${IOS?' in Settings ▸ Safari ▸ Camera':''}, or use the pen-drive sync file.</p>`;return}
  const vid=q('#nsVid');vid.srcObject=st;try{await vid.play()}catch(e){}
  QR={st,sid:'',n:0,parts:new Map(),cv:document.createElement('canvas'),busy:false,timer:null};
  QR.timer=setInterval(scan,90)}
function scan(){if(!QR||QR.busy)return;const vid=q('#nsVid');if(!vid||vid.readyState<2)return;
  const vw=vid.videoWidth,vh=vid.videoHeight;if(!vw)return;const side=Math.min(vw,vh),S=Math.min(720,side);
  const cv=QR.cv;cv.width=S;cv.height=S;const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(vid,(vw-side)/2,(vh-side)/2,side,side,0,0,S,S);
  const im=g.getImageData(0,0,S,S);const r=jsQR(im.data,S,S,{inversionAttempts:'dontInvert'});if(!r||!r.data)return;ingest(r.data)}
function ingest(txt){if(!QR)QR={st:null,sid:'',n:0,parts:new Map(),busy:false,timer:null};
  const m=/^NDQ1\|([a-z0-9]+)\|(\d+)\|(\d+)\|(.*)$/s.exec(txt);if(!m)return;
  const [,sid,i,n,part]=m;if(sid!==QR.sid){QR.sid=sid;QR.n=+n;QR.parts=new Map()}
  if(!QR.parts.has(+i)){QR.parts.set(+i,part);try{navigator.vibrate&&navigator.vibrate(15)}catch(e){}}
  const got=QR.parts.size;const bar=q('#nsBar'),lab=q('#nsGot');if(bar)bar.style.width=(100*got/QR.n)+'%';
  const miss=[];for(let k=1;k<=QR.n&&miss.length<8;k++)if(!QR.parts.has(k))miss.push(k);
  if(lab)lab.textContent=got<QR.n?`Caught ${got} of ${QR.n}${miss.length&&got>QR.n*0.7?' – still waiting for '+miss.join(', ')+(miss.length===8?'…':''):''}`:'All caught – merging…';
  if(got===QR.n)finishScan()}
async function finishScan(){QR.busy=true;let data='';for(let k=1;k<=QR.n;k++)data+=QR.parts.get(k);camStop();QR=null;
  try{const u=unb64(data.slice(1));const text=data[0]==='z'?await ungz(u):new TextDecoder().decode(u);await receive(text,'QR sync')}
  catch(e){console.error(e);alert('The QR data could not be read: '+(e.message||e)+'\nPlease scan again.')}}
function camStop(){if(QR){clearInterval(QR.timer);try{QR.st&&QR.st.getTracks().forEach(t=>t.stop())}catch(e){}QR=null}const b=q('#nsQrIn');if(b){b.hidden=true;b.innerHTML=''}}

/* ---------------- 3. hand the PC copy over (from the iPhone app) ---------------- */
async function pcCopy(){say('Preparing Noting_Desk.html…');
  try{let html;try{const r=await fetch(location.href.split('#')[0],{cache:'force-cache'});html=await r.blob()}catch(e){html=null}
    if(!html||html.size<100000)html=new Blob(['<!doctype html>\n'+document.documentElement.outerHTML],{type:'text/html'});
    saveBlob(new Blob([html],{type:'text/html'}),'Noting_Desk.html');say('Copy it onto the pen drive and replace Noting_Desk.html on the office PC')}
  catch(e){alert('Could not prepare the file: '+(e.message||e))}}

/* ---------------- panel ---------------- */
const CSS=`
#nsMask{position:fixed;inset:0;background:rgba(10,16,28,.48);z-index:220;display:none;align-items:flex-end;justify-content:center;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
#nsMask.on{display:flex}
@media(min-width:760px){#nsMask{align-items:center}}
#nsPanel{background:var(--bg,#f3f1ec);color:var(--ink,#1d2433);width:100%;max-width:640px;max-height:92vh;overflow:auto;border-radius:20px 20px 0 0;padding:0 0 calc(18px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.25);animation:nsUp .22s ease-out}
@media(min-width:760px){#nsPanel{border-radius:18px;max-height:88vh}}
@keyframes nsUp{from{transform:translateY(40px);opacity:.4}to{transform:none;opacity:1}}
.ns-top{position:sticky;top:0;background:var(--bg,#f3f1ec);padding:10px 18px 8px;z-index:2;border-bottom:1px solid var(--line,#ddd)}
.ns-grab{width:40px;height:5px;border-radius:3px;background:var(--line,#ccc);margin:0 auto 8px}
.ns-top h3{margin:0;font-size:19px;display:flex;align-items:center;gap:8px}.ns-top h3 button{margin-left:auto}
.ns-st{font-size:12.5px;color:var(--muted,#667);margin-top:3px}
.ns-card{background:var(--panel,#fff);border:1px solid var(--line,#ddd);border-radius:14px;margin:12px 14px 0;padding:14px}
.ns-card h4{margin:0 0 4px;font-size:15.5px}.ns-card p{margin:0 0 10px;font-size:13.5px;color:var(--muted,#667);line-height:1.45}
.ns-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}.ns-c{justify-content:center}
.ns-row .btn{min-height:40px}
.ns-chk{display:flex;gap:8px;align-items:center;font-size:13.5px;font-weight:600}
.ns-card select,.ns-card input[type=text]{padding:8px 10px;border:1px solid var(--line,#ccc);border-radius:9px;background:var(--panel,#fff);color:var(--ink,#111);font:inherit}
#nsQrCv{display:block;width:min(100%,380px);height:auto;margin:10px auto 0;border-radius:12px;border:1px solid var(--line,#ddd);image-rendering:pixelated;background:#fff}
.ns-qrhead{text-align:center;font-size:13.5px;margin-top:6px}
.ns-warn{color:var(--warn,#a15c00);font-weight:600}
.ns-cam{position:relative;width:min(100%,380px);aspect-ratio:1;margin:10px auto 0;border-radius:14px;overflow:hidden;background:#000}
.ns-cam video{width:100%;height:100%;object-fit:cover}
.ns-aim{position:absolute;inset:12%;border:3px solid rgba(255,255,255,.85);border-radius:16px;box-shadow:0 0 0 999px rgba(0,0,0,.25)}
.ns-prog{height:8px;border-radius:5px;background:var(--line,#ddd);overflow:hidden;margin:12px auto 0;width:min(100%,380px)}.ns-prog i{display:block;height:100%;width:0;background:var(--ok,#1e7a4c);transition:width .2s}
.ns-dev{display:inline-flex;gap:6px;align-items:center;font-size:12.5px}
.ns-dev input{width:120px!important;padding:4px 8px!important;font-size:13px!important}
#nsPanel .hint{font-size:12.5px;color:var(--muted,#667);text-align:center;margin:8px 0 0}
`;
function ui(){if(q('#nsMask'))return;const st=document.createElement('style');st.id='ns-css';st.textContent=CSS;document.head.appendChild(st);
  const m=document.createElement('div');m.id='nsMask';m.innerHTML=`<div id="nsPanel" role="dialog" aria-modal="true" aria-labelledby="nsTitle"></div>`;document.body.appendChild(m);
  m.addEventListener('click',e=>{if(e.target===m)close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&m.classList.contains('on'))close()})}
function draw(){const p=q('#nsPanel');if(!p||!q('#nsMask').classList.contains('on'))return;const L=last(),d=dev(),other=d.name==='PC'?'iPhone':'PC';
  p.innerHTML=`<div class="ns-top"><div class="ns-grab"></div><h3 id="nsTitle">🔄 Sync with ${h(other)}<button class="btn" type="button" id="nsX" aria-label="Close">✕</button></h3>
    <div class="ns-st">This device: <span class="ns-dev"><input type="text" id="nsName" value="${h(d.name)}" maxlength="20" aria-label="Name of this device"></span> · last sent <b>${h(when(L.sent))}</b> · last received <b>${h(when(L.recv))}</b>${L.from?` from ${h(L.from)}`:''}</div></div>
  <div class="ns-card"><h4>💾 Pen-drive sync file</h4>
    <p>Makes one file with everything on this device, including your Excel data. Open it on the other device with <b>Open sync file</b> – it is <b>added</b> to what is there: the newer edit wins and deleted items stay deleted. Old backup files (<code>NotingDesk_backup_*.json</code>) can be opened here too.</p>
    <label class="ns-chk"><input type="checkbox" id="nsPdf"> Include the PDFs and attachments <small style="font-weight:400;color:var(--muted)">(bigger file)</small></label>
    <div class="ns-row"><button class="btn pri" type="button" id="nsFileOut">⬇ Create sync file</button><button class="btn" type="button" id="nsFileIn">⬆ Open sync / backup file</button></div></div>
  <div class="ns-card"><h4>📱 QR quick sync</h4>
    <p>For a few new entries – today's diary, a new e-mail, a noting. No cable: one screen shows QR codes, the other scans them. PDFs are not sent this way.</p>
    <div class="ns-row"><label class="ns-chk" for="nsSince">Send</label><select id="nsSince">
      <option value="last">changes since last send${L.sent?' ('+h(when(L.sent))+')':''}</option><option value="1d">changes in the last 24 hours</option><option value="7d">changes in the last 7 days</option><option value="30d">changes in the last 30 days</option><option value="all">everything (no PDFs)</option></select></div>
    <div class="ns-row"><button class="btn pri" type="button" id="nsQrGo">📤 Show QR codes</button><button class="btn" type="button" id="nsScan">📷 Scan QR codes</button></div>
    <div id="nsQrOut" hidden></div><div id="nsQrIn" hidden></div></div>
  ${WEB?`<div class="ns-card"><h4>🖥️ Copy for the office PC</h4><p>Saves this same app as <b>Noting_Desk.html</b> (about 14 MB) – put it on the pen drive and use it on the office PC instead of the old file. It works without internet. Version <b>${h(window.ND_APP_VER||'')}</b>.</p>
    <div class="ns-row"><button class="btn" type="button" id="nsPc">💾 Save Noting_Desk.html</button></div></div>`:`<div class="ns-card"><h4>ℹ️ Version</h4><p>EPFO Desk ${h(window.ND_APP_VER||'')} with iPhone sync. Your data on this PC is kept in this browser – keep making backups as before.</p></div>`}`;
  q('#nsX').onclick=close;q('#nsFileOut').onclick=fileOut;q('#nsFileIn').onclick=fileIn;q('#nsQrGo').onclick=qrOut;q('#nsScan').onclick=()=>{qrStop();qrIn()};
  if(q('#nsPc'))q('#nsPc').onclick=pcCopy;
  q('#nsName').onchange=e=>{const d=dev();d.name=(e.target.value||'').trim().slice(0,20)||d.name;lsSet(LS.dev,d);draw()}}
function open(){ui();dyStamp();q('#nsMask').classList.add('on');draw()}
function close(){qrStop();camStop();const m=q('#nsMask');if(m)m.classList.remove('on')}

/* ---------------- the Sync button ---------------- */
function button(){const rail=q('#rail');if(!rail||q('#mSync'))return;const b=document.createElement('button');b.id='mSync';b.type='button';b.title='Sync with iPhone / PC – pen drive or QR codes';
  b.innerHTML='<i>🔄</i><span>Sync</span><b class="d6t">Sync with iPhone / PC</b>';b.onclick=open;const sp=q('#rail .sp');rail.insertBefore(b,sp?sp.nextSibling:null)}
function boot(){button();
  /* the global search / command list also opens it */
  try{if(Array.isArray(window.NDCMDS))NDCMDS.push(['🔄','Sync','pen drive or QR codes with the iPhone / PC','sync iphone phone pc qr pendrive pen drive transfer',open])}catch(e){}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.NDSYNC={open,close,build,receive,dev,last,_ingest:ingest};
})();
