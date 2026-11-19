/* =====================================================================
   EPFO DESK · MEMBERS  – search your Excel sheets by member number
   Type 787 (default establishment, e.g. APHYD/4566/787), 4566/787,
   APHYD00045660000000787, AP/HYD/0004566/000/0000787, a UAN, ACK No or
   a name. Every matching row of every sheet is shown, with a profile on top.
   Excel stays the master: the app only reads it.
   - PC: Excel files in the "Excel Data" folder next to Noting_Desk.html
     are re-read automatically when they change (every minute + on focus).
   - PC & iPhone: "Add / refresh Excel" button.
   - The data travels in the sync file / backup ("members" block).
   ===================================================================== */
(function(){
'use strict';
if(window.NDMEM)return;
const q=(s,r)=>(r||document).querySelector(s),qa=(s,r)=>[...(r||document).querySelectorAll(s)];
const h=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=m=>{try{toast(m)}catch(e){console.log(m)}};
const CK='epfo_mem_cfg',RK='epfo_mem_recent';
const lsGet=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const cfg=()=>Object.assign({estb:'4566',reg:'APHYD'},lsGet(CK,{}));
const pad=(n,l)=>String(n).padStart(l,'0');
const when=t=>t?new Date(t).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';

/* ---------------- storage (IndexedDB) ---------------- */
let DB=null,BOOKS=[],TOMB=[];
function idb(){return new Promise(res=>{try{const r=indexedDB.open('epfo_members',1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('books'))d.createObjectStore('books',{keyPath:'id'});if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta')};r.onsuccess=()=>res(r.result);r.onerror=()=>res(null)}catch(e){res(null)}})}
const tx=(st,mode,fn)=>new Promise((res,rej)=>{if(!DB){res(null);return}const t=DB.transaction(st,mode);const s=t.objectStore(st);const r=fn(s);t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error)});
const bPut=b=>tx('books','readwrite',s=>s.put(b));
const bDel=id=>tx('books','readwrite',s=>s.delete(id));
const bAll=()=>tx('books','readonly',s=>s.getAll());
const mGet=k=>tx('meta','readonly',s=>s.get(k));
const mPut=(k,v)=>tx('meta','readwrite',s=>s.put(v,k));

/* ---------------- member numbers ---------------- */
/* returns {e:estb,m:member,reg} for every way a member ID is written; null for estb-only codes */
function memKey(v,ctxE){if(v==null)return null;if(typeof v==='object')return null;let s=String(v).toUpperCase().replace(/\s+/g,'');if(!s)return null;let m;
  if((m=/^([A-Z]{5})(\d{7})(\d{3})(\d{7})$/.exec(s)))return{e:+m[2],m:+m[4],reg:m[1]};
  if((m=/^([A-Z]{2})\/?([A-Z]{3})\/0*(\d{1,7})\/(?:\d{3}\/)?0*(\d{1,7})$/.exec(s)))return{e:+m[3],m:+m[4],reg:m[1]+m[2]};
  if((m=/^([A-Z]{5})0*(\d{1,7})\/0*(\d{1,7})$/.exec(s)))return{e:+m[2],m:+m[3],reg:m[1]};
  if((m=/^0*(\d{1,7})\/0*(\d{1,7})$/.exec(s)))return{e:+m[1],m:+m[2],reg:''};
  if(ctxE&&(m=/^0*(\d{1,7})(?:\.0+)?$/.exec(s))&&+m[1]>0)return{e:+ctxE,m:+m[1],reg:''};
  return null}
const kOf=k=>k?k.e+'/'+k.m:'';
const digits=v=>String(v==null?'':v).replace(/\D/g,'');
const uanOf=v=>{const d=digits(v);return d.length===12?d:''};
const ackOf=v=>{const d=digits(v);return d.length>=15&&d.length<=24?d:''};
function fmtId(key,reg){const [e,m]=key.split('/');reg=reg||cfg().reg;return{short:`${reg}/${e}/${m}`,full:`${reg}${pad(e,7)}000${pad(m,7)}`}}

/* ---------------- reading a workbook ---------------- */
const HDRX=/s\.?\s*no|member|name|uan|ack|ppo|status|remark|type|date|amount|dd\b|pf|account|case|batch|stage|uo|cheque|demand|pension|service|transfer|source|issue/i;
const ROLE={
  memId:/member\s*-?\s*id|pf\s*(a\/?c|acc|account|no)|account\s*no|member\s*code/i,
  memNo:/member\s*(no|number)\b|^mem\.?\s*no/i,
  uan:/\buan/i, ack:/\back/i, name:/name/i};
function hdrRow(rows){let best=-1,bs=1;for(let i=0;i<Math.min(12,rows.length);i++){const r=rows[i]||[];let sc=0,n=0;for(const c of r){if(c==null||c==='')continue;n++;if(typeof c==='string'&&c.length<60&&HDRX.test(c))sc++}if(n>=2&&sc>bs){bs=sc;best=i}}return best}
function sheetOf(name,rows,ctxE){const hi=hdrRow(rows);const W=Math.max(0,...rows.map(r=>r.length));
  const hdr=[];for(let c=0;c<W;c++){const v=hi>=0?rows[hi][c]:null;hdr.push(v==null||v===''?'Column '+String.fromCharCode(65+(c%26)):String(v).replace(/\s+/g,' ').trim())}
  const data=rows.slice(hi+1).filter(r=>r&&r.some(c=>c!=null&&c!==''));
  const col={};for(const [role,rx] of Object.entries(ROLE)){const i=hdr.findIndex((t,ix)=>rx.test(t)&&!Object.values(col).includes(ix)&&!(role==='name'&&/file|sheet|estab|company|section/i.test(t)));if(i>=0)col[role]=i}
  /* no header found for the member column: look at the values */
  if(col.memId==null){for(let c=0;c<W;c++){if(Object.values(col).includes(c))continue;let ok=0,n=0;for(const r of data.slice(0,60)){const v=r[c];if(v==null||v==='')continue;n++;const k=memKey(v);if(k&&String(v).length>6)ok++}if(n>=3&&ok/n>=.6){col.memId=c;break}}}
  if(col.uan==null){for(let c=0;c<W;c++){if(Object.values(col).includes(c))continue;let ok=0,n=0;for(const r of data.slice(0,60)){const v=r[c];if(v==null||v==='')continue;n++;if(uanOf(v)&&/^1\d{11}$/.test(digits(v)))ok++}if(n>=3&&ok/n>=.7){col.uan=c;break}}}
  return{name,hdr,rows:data,col,ctxE}}
async function parseFile(f){if(typeof xlsxRead!=='function')throw new Error('Excel reader not available');
  const sheets=await xlsxRead(f);const ctxE=(/(?:^|\D)(\d{3,7})(?:\D|$)/.exec(f.name)||[])[1]||cfg().estb;
  return sheets.map(s=>sheetOf(s.name,s.rows,ctxE))}
const bid=n=>String(n||'').toLowerCase().replace(/\.xlsx$/,'').replace(/[^a-z0-9]+/g,'_');
async function importFile(f,src){const sheets=await parseFile(f);const id=bid(f.name);
  const b={id,name:f.name,size:f.size,lastModified:f.lastModified||Date.now(),importedAt:Date.now(),src,sheets};
  TOMB=TOMB.filter(t=>t.id!==id);await mPut('tomb',TOMB);
  const i=BOOKS.findIndex(x=>x.id===id);if(i>=0)BOOKS[i]=b;else BOOKS.push(b);await bPut(b);return b}
async function removeBook(id,silent){BOOKS=BOOKS.filter(b=>b.id!==id);await bDel(id);TOMB=TOMB.filter(t=>t.id!==id).concat([{id,t:Date.now()}]);await mPut('tomb',TOMB);if(!silent){reindex();draw()}}

/* ---------------- index ---------------- */
let IX=null;
function reindex(){const by=new Map(),uan=new Map(),ack=new Map(),names=new Map(),regs=new Map();const loose=[];
  const add=(k,ref)=>{if(!by.has(k))by.set(k,[]);by.get(k).push(ref)};
  BOOKS.forEach((b,bi)=>b.sheets.forEach((s,si)=>s.rows.forEach((r,ri)=>{const c=s.col;let k=null;
    if(c.memId!=null)k=memKey(r[c.memId]);if(!k&&c.memNo!=null)k=memKey(r[c.memNo],s.ctxE);
    const u=c.uan!=null?uanOf(r[c.uan]):'',a=c.ack!=null?ackOf(r[c.ack]):'';const ref={bi,si,ri};
    if(k){const key=kOf(k);add(key,ref);if(k.reg)regs.set(key,k.reg);if(u)uan.set(u,key);if(a)ack.set(a,key);
      if(c.name!=null&&r[c.name]){if(!names.has(key))names.set(key,new Set());names.get(key).add(String(r[c.name]).replace(/\s+/g,' ').trim().toUpperCase())}}
    else if(u||a)loose.push({u,a,ref})})));
  /* sheets without a member column (e.g. UO NOTE): link by UAN or ACK No */
  for(const x of loose){const key=(x.u&&uan.get(x.u))||(x.a&&ack.get(x.a));if(key)add(key,Object.assign({via:x.u&&uan.get(x.u)?'UAN':'ACK No'},x.ref));else{const k='?'+(x.u||x.a);add(k,x.ref)}}
  IX={by,uan,ack,names,regs}}

/* ---------------- search ---------------- */
function resolve(qs){qs=String(qs||'').trim();if(!qs||!IX)return{none:true};const c=cfg();const d=qs.replace(/\s/g,'');
  if(/^\d{1,7}$/.test(d))return{key:c.estb+'/'+(+d)};
  if(/^\d{12}$/.test(d)){const k=IX.uan.get(d);return k?{key:k,via:'UAN '+d}:{key:'?'+d,miss:'UAN '+d}}
  if(/^\d{15,24}$/.test(d)){const k=IX.ack.get(d);return k?{key:k,via:'ACK No '+d}:{key:'?'+d,miss:'ACK No '+d}}
  const k=memKey(d);if(k)return{key:kOf(k)};
  if(/[a-z]{2}/i.test(qs)){const tok=qs.toUpperCase().split(/\s+/).filter(Boolean);const out=[];
    for(const [key,set] of IX.names){const nm=[...set];if(nm.some(n=>tok.every(t=>n.includes(t))))out.push({key,name:nm[0],n:(IX.by.get(key)||[]).length})}
    out.sort((a,b)=>a.name.localeCompare(b.name));return{list:out,qs}}
  return{key:'',miss:qs}}

/* ---------------- values ---------------- */
const isDateH=t=>/date|\bdt\b|dated/i.test(t);
const isAmtH=t=>/amount|\brs\b|\(rs\)|demand|balance/i.test(t);
function serialDate(n){return new Date(Date.UTC(1899,11,30)+n*864e5)}
function fmtV(v,hd){if(v==null||v==='')return'';if(typeof v==='object'&&v.d){const [y,m,d]=v.d.split('-');return`${d}.${m}.${y}`}
  const s=String(v);
  if(isDateH(hd)&&/^\d{5}(\.\d+)?$/.test(s)&&+s>20000&&+s<80000){const d=serialDate(+s);return`${pad(d.getUTCDate(),2)}.${pad(d.getUTCMonth()+1,2)}.${d.getUTCFullYear()}`}
  if(isAmtH(hd)&&/^-?\d+(\.\d+)?$/.test(s)&&s.length<13){const n=+s;return n.toLocaleString('en-IN',{maximumFractionDigits:2})}
  if(/^-?\d+\.\d{6,}$/.test(s))return String(Math.round(+s*100)/100);
  return s}
const norm=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]+/g,'');

/* profile fields: label, header test, how to compare */
const PF=[
  ['Name',/^(member\s*-?\s*)?names?$|member\s*name/i],
  ['UAN',/\buan/i],['ACK No',/\back/i],['PPO No',/ppo/i],
  ['In service / Pensioner',/in\s*service|pensioner/i],['Transfer out / Local',/transfer|local/i],
  ['Batch',/^batch$/i],['Current stage',/stage/i],['Status',/status/i],['Type',/^type$/i],['Case',/^case$/i],['Remarks',/remark/i],
  ['Demand notice (Rs)',/demand/i],['DD / cheque no',/(dd|cheque)\W*(\/\s*cheque\s*)?(no|number)/i],['DD / cheque date',/(dd|cheque)\W*(\/\s*cheque\s*)?date/i],['DD amount (Rs)',/dd\s*amount|^amount$/i],['UO Note date',/uo\s*note\s*date/i]];
function rowsFor(key){return((IX&&IX.by.get(key))||[]).map(ref=>{const b=BOOKS[ref.bi],s=b.sheets[ref.si];return{b,s,r:s.rows[ref.ri],via:ref.via}})}
function profile(key,rows){const f=[];for(const [lab,rx] of PF){const vals=[];
    for(const x of rows){x.s.hdr.forEach((t,ci)=>{if(!rx.test(t))return;if(lab==='Name'&&/file|sheet/i.test(t))return;const raw=x.r[ci];const v=fmtV(raw,t);if(!v)return;vals.push({v,n:isAmtH(t)?String(+String(raw).replace(/[^\d.-]/g,'')):norm(v),src:`${x.b.name.replace(/\.xlsx$/i,'')} › ${x.s.name}`})})}
    if(!vals.length)continue;const uniq=[];for(const x of vals)if(!uniq.some(u=>u.n===x.n))uniq.push(x);
    f.push({lab,v:uniq[0].v,all:uniq,vals})}
  return f}

/* ---------------- UI ---------------- */
const CSS=`
#vMem{overflow:auto}
.mm{max-width:980px;margin:0 auto;padding:18px 18px 40px}
.mm-sb{display:flex;align-items:center;gap:0;background:var(--panel);border:1.5px solid var(--line);border-radius:16px;padding:4px 4px 4px 14px;box-shadow:0 6px 22px rgba(20,40,80,.07);position:sticky;top:0;z-index:4}
.mm-sb:focus-within{border-color:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 18%,transparent)}
.mm-pre{font-weight:700;color:var(--muted);white-space:nowrap;font-size:15px;cursor:pointer}
.mm-sb input{flex:1;min-width:0;border:0!important;outline:0;box-shadow:none!important;background:transparent!important;color:var(--ink);font-weight:600;font-size:18px!important;line-height:1.2;font-family:inherit;padding:12px 8px!important;border-radius:0!important}
.mm-sb.raw .mm-pre{display:none}
.mm-sb .btn{border-radius:12px;min-height:44px;padding:0 18px}
.mm-rec{display:flex;gap:6px;flex-wrap:wrap;margin:10px 2px 0}
.mm-rec button{border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:20px;padding:5px 12px;font-weight:600;font-size:12.5px;font-family:inherit;cursor:pointer}
.mm-empty{text-align:center;padding:40px 16px;color:var(--muted)}.mm-empty b{color:var(--ink);font-size:17px;display:block;margin:10px 0 4px}.mm-empty i{font-size:44px;font-style:normal}
.mm-prof{margin-top:16px;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 12%,var(--panel)),var(--panel) 60%);border:1px solid var(--line);border-radius:20px;padding:18px;box-shadow:0 8px 28px rgba(20,40,80,.08)}
.mm-ph{display:flex;gap:14px;align-items:center}
.mm-av{width:56px;height:56px;border-radius:18px;background:linear-gradient(135deg,#6f86c9,#3d5590);color:#fff;font-weight:800;font-size:20px;line-height:56px;font-family:inherit;text-align:center;flex:none;letter-spacing:.5px}
.mm-nm{font-size:21px;font-weight:800;letter-spacing:-.2px;line-height:1.2;color:var(--ink)}
.mm-ids{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.mm-id{border:1px solid var(--line);background:var(--panel);border-radius:9px;padding:3px 9px;font:600 12.5px ui-monospace,Menlo,Consolas,monospace;color:var(--ink);cursor:pointer}
.mm-id:active{transform:scale(.97)}
.mm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-top:16px}
.mm-f{background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:9px 12px;min-width:0}
.mm-f small{display:block;font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--muted)}
.mm-f span{display:block;font-weight:650;font-size:14.5px;margin-top:2px;word-break:break-word;color:var(--ink)}
.mm-f.diff{border-color:var(--warn,#a15c00);background:color-mix(in srgb,var(--warn,#a15c00) 8%,var(--panel))}
.mm-f.diff em{display:block;font-style:normal;font-size:11.5px;color:var(--warn,#a15c00);margin-top:3px;font-weight:600}
.mm-st{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;font-size:12.5px;color:var(--muted)}
.mm-h{margin:22px 2px 8px;font-size:13px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);display:flex;gap:8px;align-items:center}
.mm-rc{background:var(--panel);border:1px solid var(--line);border-radius:16px;margin:0 0 10px;overflow:hidden}
.mm-rc.warn{border-color:var(--warn,#a15c00)}
.mm-rh{display:flex;gap:8px;align-items:center;padding:10px 14px;background:color-mix(in srgb,var(--accent) 6%,var(--panel));border-bottom:1px solid var(--line);font-size:13px}
.mm-rh b{color:var(--ink)}.mm-rh span{color:var(--muted)}.mm-rc.warn .mm-rh{background:color-mix(in srgb,var(--warn,#a15c00) 10%,var(--panel))}
.mm-kv{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:2px 16px;padding:10px 14px 12px}
.mm-kv div{display:flex;gap:8px;padding:5px 0;border-bottom:1px dashed color-mix(in srgb,var(--line) 70%,transparent);font-size:13.5px;min-width:0}
.mm-kv dt{color:var(--muted);flex:0 0 42%;font-weight:600;font-size:12.5px}.mm-kv dd{margin:0;color:var(--ink);font-weight:600;word-break:break-word;flex:1}
.mm-list button{display:flex;width:100%;gap:10px;align-items:center;text-align:left;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:14px;padding:11px 14px;margin:0 0 8px;font:inherit;cursor:pointer}
.mm-list button small{margin-left:auto;color:var(--muted)}
.mm-files{margin-top:26px;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:4px 14px}
.mm-files summary{cursor:pointer;padding:10px 0;font-weight:700;font-size:14px;color:var(--ink)}
.mm-fl{display:flex;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--line);font-size:13px}
.mm-fl b{display:block;color:var(--ink)}.mm-fl span{color:var(--muted);font-size:12px}.mm-fl .btn{margin-left:auto}
.mm-tag{font-size:10.5px;font-weight:700;border-radius:6px;padding:1px 6px;background:var(--accent-2,#e8eef6);color:var(--accent,#1f4e79);margin-left:4px}
.mm-acts{display:flex;gap:8px;flex-wrap:wrap;padding:10px 0 12px;border-top:1px solid var(--line);align-items:center}
.mm-acts label{font-size:13px;font-weight:600;display:inline-flex;gap:6px;align-items:center;color:var(--ink)}
.mm-acts input{width:90px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink);font:inherit}
@media(max-width:900px){.mm{padding:12px 12px 30px}.mm-sb{top:0}.mm-grid{grid-template-columns:1fr 1fr}.mm-kv{grid-template-columns:1fr}.mm-nm{font-size:19px}}
`;
let LASTQ='';
function view(){if(q('#vMem'))return;const st=document.createElement('style');st.id='mm-css';st.textContent=CSS;document.head.appendChild(st);
  const sec=document.createElement('section');sec.className='view';sec.id='vMem';
  sec.innerHTML=`<div class="mm"><div class="mm-sb"><span class="mm-pre" id="mmPre" title="Default establishment – change below"></span><input id="mmQ" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search" placeholder="787 · 4566/787 · UAN · name" aria-label="Member number, UAN or name"><button class="btn pri" type="button" id="mmGo">Search</button></div>
    <div class="mm-rec" id="mmRec"></div><div id="mmOut"></div>
    <details class="mm-files" id="mmFiles"><summary id="mmFS"></summary><div id="mmFL"></div>
      <div class="mm-acts"><button class="btn pri" type="button" id="mmAdd">➕ Add / refresh Excel</button><button class="btn" type="button" id="mmScan" hidden>🔄 Check Excel Data folder now</button>
      <label>Default estb <input id="mmE" inputmode="numeric" maxlength="7"></label><label>Region <input id="mmR" maxlength="5" style="width:80px"></label></div></details></div>`;
  q('#views').appendChild(sec);
  const inp=q('#mmQ');let t=null;const raw=()=>q('.mm-sb').classList.toggle('raw',/[^\d\s]/.test(inp.value));inp.addEventListener('input',()=>{raw();clearTimeout(t);t=setTimeout(()=>search(inp.value,false),220)});
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){clearTimeout(t);search(inp.value,true);inp.blur()}});
  q('#mmGo').onclick=()=>search(inp.value,true);q('#mmPre').onclick=()=>{q('#mmFiles').open=true;q('#mmE').focus()};
  q('#mmAdd').onclick=pick;q('#mmScan').onclick=()=>scanFolder(true);
  const c=cfg();q('#mmE').value=c.estb;q('#mmR').value=c.reg;
  q('#mmE').onchange=e=>{const v=digits(e.target.value);if(v){lsSet(CK,Object.assign(cfg(),{estb:String(+v)}));draw();search(q('#mmQ').value,false)}};
  q('#mmR').onchange=e=>{const v=e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,5);if(v.length===5){lsSet(CK,Object.assign(cfg(),{reg:v}));draw()}};
  draw()}
function draw(){if(!q('#vMem'))return;const c=cfg();q('#mmPre').textContent=`${c.reg}/${c.estb}/`;
  const nRows=BOOKS.reduce((a,b)=>a+b.sheets.reduce((x,s)=>x+s.rows.length,0),0);
  q('#mmFS').textContent=`📂 Excel files (${BOOKS.length}) · ${IX?IX.by.size-[...IX.by.keys()].filter(k=>k[0]==='?').length:0} members · ${nRows} rows`;
  q('#mmFL').innerHTML=BOOKS.length?BOOKS.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(b=>`<div class="mm-fl"><div><b>${h(b.name)}<span class="mm-tag">${b.src==='folder'?'PC folder · auto':b.src==='sync'?'from sync':'added'}</span></b><span>${b.sheets.map(s=>`${h(s.name)} (${s.rows.length})`).join(' · ')}<br>file saved ${h(when(b.lastModified))} · read ${h(when(b.importedAt))}</span></div><button class="btn" type="button" data-rm="${h(b.id)}" aria-label="Remove ${h(b.name)}">✕</button></div>`).join(''):'<div class="mm-fl"><span>No Excel files yet.</span></div>';
  qa('[data-rm]',q('#mmFL')).forEach(x=>x.onclick=()=>{const b=BOOKS.find(y=>y.id===x.dataset.rm);if(b&&confirm(`Remove ${b.name} from EPFO Desk? (The Excel file itself is not touched.)`))removeBook(b.id)});
  q('#mmScan').hidden=!(typeof CF!=='undefined'&&CF.state==='ok');
  const rec=lsGet(RK,[]);q('#mmRec').innerHTML=rec.map(r=>`<button type="button" data-q="${h(r)}">${h(r)}</button>`).join('');qa('#mmRec button').forEach(b=>b.onclick=()=>{q('#mmQ').value=b.dataset.q;search(b.dataset.q,true)});
  if(!BOOKS.length)q('#mmOut').innerHTML=`<div class="mm-empty"><i>📊</i><b>Add your Excel files</b>Pick the .xlsx files (e.g. HANDOVER_TAKEOVER_4566, POHW Consolidated, DEO prepared).<br>${typeof CF!=='undefined'&&CF.state==='ok'?'Or put them in the <b>Excel Data</b> folder – they are read automatically.':'On the office PC you can also keep them in an <b>Excel Data</b> folder next to Noting_Desk.html.'}<br><br><button class="btn pri" type="button" onclick="NDMEM.pick()">➕ Add Excel files</button></div>`;
  else if(!q('#mmQ').value)q('#mmOut').innerHTML=`<div class="mm-empty"><i>🔎</i><b>Type a member number</b>e.g. <b>787</b> for ${h(c.reg)}/${h(c.estb)}/787 – or 4566/787, a UAN, ACK No or a name.</div>`;
  else search(q('#mmQ').value,false)}
function remember(s){s=String(s).trim();if(!s)return;let r=lsGet(RK,[]).filter(x=>x!==s);r.unshift(s);lsSet(RK,r.slice(0,8))}
function search(qs,commit){LASTQ=qs;try{q('.mm-sb').classList.toggle('raw',/[^\d\s]/.test(q('#mmQ').value))}catch(e){}const out=q('#mmOut');if(!out)return;if(!String(qs).trim()){draw();return}if(!IX)reindex();
  const r=resolve(qs);
  if(r.list){out.innerHTML=r.list.length?`<div class="mm-h">${r.list.length} name${r.list.length>1?'s':''} match “${h(r.qs)}”</div><div class="mm-list">${r.list.slice(0,60).map(x=>{const id=x.key[0]==='?'?x.key.slice(1):fmtId(x.key,IX.regs.get(x.key)).short;return`<button type="button" data-k="${h(x.key)}"><b>${h(x.name)}</b><span>${h(id)}</span><small>${x.n} row${x.n>1?'s':''}</small></button>`}).join('')}</div>`:`<div class="mm-empty"><i>🤷</i><b>No member named “${h(r.qs)}”</b></div>`;
    qa('.mm-list button',out).forEach(b=>b.onclick=()=>{const k=b.dataset.k;const v=k[0]==='?'?k.slice(1):(k.split('/')[0]===cfg().estb?k.split('/')[1]:k);q('#mmQ').value=v;search(v,true)});return}
  const key=r.key;const rows=key?rowsFor(key):[];
  if(!rows.length){out.innerHTML=`<div class="mm-empty"><i>🔎</i><b>No records for ${h(key&&key[0]!=='?'?fmtId(key).short:(r.miss||qs))}</b>Searched ${BOOKS.length} Excel file${BOOKS.length===1?'':'s'}.</div>`;return}
  if(commit)remember(qs);
  const reg=IX.regs.get(key)||cfg().reg;const id=key[0]==='?'?null:fmtId(key,reg);const f=profile(key,rows);
  const nm=(f.find(x=>x.lab==='Name')||{}).v||'';const ini=nm.split(/\s+/).filter(w=>w.length>1).slice(0,2).map(w=>w[0]).join('')||'#';
  const diffs=f.filter(x=>x.all.length>1&&x.lab!=='Name'&&x.lab!=='Remarks'&&x.lab!=='Status'&&x.lab!=='Type'&&x.lab!=='Case');
  const books=new Set(rows.map(x=>x.b.id)).size;
  const grid=f.filter(x=>x.lab!=='Name').map(x=>{const d=diffs.includes(x);return`<div class="mm-f${d?' diff':''}"><small>${h(x.lab)}</small><span>${h(x.v)}</span>${d?`<em title="${h(x.all.map(a=>a.v+' – '+a.src).join('\n'))}">⚠ differs: ${h(x.all.slice(1).map(a=>a.v).join(', '))}</em>`:''}</div>`}).join('');
  let html=`<div class="mm-prof"><div class="mm-ph"><div class="mm-av">${h(ini)}</div><div style="min-width:0"><div class="mm-nm">${h(nm||'(name not in sheets)')}</div>
     <div class="mm-ids">${id?`<button class="mm-id" type="button" data-cp="${h(id.short)}" title="Copy">${h(id.short)}</button><button class="mm-id" type="button" data-cp="${h(id.full)}" title="Copy">${h(id.full)}</button>`:`<button class="mm-id" type="button" data-cp="${h(key.slice(1))}">${h(key.slice(1))}</button>`}</div></div></div>
     <div class="mm-grid">${grid}</div><div class="mm-st">📄 ${rows.length} row${rows.length>1?'s':''} in ${books} file${books>1?'s':''}${diffs.length?` · <b style="color:var(--warn,#a15c00)">⚠ ${diffs.length} value${diffs.length>1?'s':''} differ between sheets</b>`:''}</div></div>`;
  const groups=new Map();for(const x of rows){const g=x.b.name+' › '+x.s.name;if(!groups.has(g))groups.set(g,[]);groups.get(g).push(x)}
  html+=`<div class="mm-h">Records</div>`;
  for(const [g,list] of groups){for(const x of list){const warn=/discrep|mismatch|issue/i.test(x.s.name)||x.r.some(c=>typeof c==='string'&&/differs|mismatch|discrepan/i.test(c));
    const kv=x.s.hdr.map((t,ci)=>{const v=fmtV(x.r[ci],t);if(!v||/^s\.?\s*no\.?$|^sl\.?\s*no/i.test(t))return'';return`<div><dt>${h(t)}</dt><dd>${h(v)}</dd></div>`}).join('');
    html+=`<div class="mm-rc${warn?' warn':''}"><div class="mm-rh">${warn?'⚠️':'📗'} <b>${h(x.b.name.replace(/\.xlsx$/i,''))}</b><span>› ${h(x.s.name)}${x.via?` · linked by ${h(x.via)}`:''}</span></div><dl class="mm-kv">${kv}</dl></div>`}}
  out.innerHTML=html;
  qa('[data-cp]',out).forEach(b=>b.onclick=()=>{try{navigator.clipboard.writeText(b.dataset.cp).then(()=>say('Copied '+b.dataset.cp))}catch(e){}})}

/* ---------------- adding files ---------------- */
function pick(){const i=document.createElement('input');i.type='file';i.multiple=true;i.accept='.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  i.onchange=async()=>{let n=0;for(const f of i.files){try{await importFile(f,'manual');n++}catch(e){alert(`Could not read ${f.name}: ${e.message||e}`)}}if(n){reindex();draw();say(`${n} Excel file${n>1?'s':''} read`);try{dfSaveSoon('state')}catch(e){}}};i.click()}

/* ---------------- PC: the "Excel Data" folder ---------------- */
async function folderDir(){if(typeof CF==='undefined'||typeof DF==='undefined'||CF.state!=='ok'||!DF.root)return null;
  try{for await(const [n,hd] of DF.root.entries())if(hd.kind==='directory'&&/^excel\s*data$/i.test(n.trim()))return hd;return await DF.root.getDirectoryHandle('Excel Data',{create:true})}catch(e){return null}}
let scanning=false;
async function scanFolder(manual){if(scanning)return;const d=await folderDir();if(!d){if(manual)say('Connect your Noting Desk folder first (Automate ▸ Folder)');return}scanning=true;let ch=0,bad=0;const seen=new Set();
  try{for await(const [n,hd] of d.entries()){if(hd.kind!=='file'||!/\.xlsx$/i.test(n)||n.startsWith('~$'))continue;const id=bid(n);seen.add(id);
      try{const f=await hd.getFile();const ex=BOOKS.find(b=>b.id===id);if(ex&&ex.lastModified===f.lastModified&&ex.size===f.size)continue;await importFile(f,'folder');ch++}catch(e){bad++;console.warn('excel',n,e)}}
    for(const b of BOOKS.filter(b=>b.src==='folder'&&!seen.has(b.id))){await removeBook(b.id,true);ch++}}
  finally{scanning=false}
  if(ch){reindex();draw();say(`Excel data updated (${ch} file${ch>1?'s':''})`);try{dfSaveSoon('state')}catch(e){}}else if(manual)say(bad?'Some files could not be read – close them in Excel and try again':'Excel data is up to date')}

/* ---------------- sync & backup ---------------- */
async function pack(since){since=+since||0;return{v:1,books:BOOKS.filter(b=>!since||b.importedAt>since||b.lastModified>since),tomb:TOMB}}
async function merge(m){if(!m||typeof m!=='object')return 0;let n=0;
  for(const t of m.tomb||[]){if(!t||!t.id)continue;const b=BOOKS.find(x=>x.id===t.id);if(b&&t.t>b.importedAt){await removeBook(b.id,true);n++}if(!TOMB.some(x=>x.id===t.id))TOMB.push(t)}
  await mPut('tomb',TOMB);
  for(const b of m.books||[]){if(!b||!b.id||!Array.isArray(b.sheets))continue;const tb=TOMB.find(t=>t.id===b.id);if(tb&&tb.t>b.importedAt)continue;
    const ex=BOOKS.find(x=>x.id===b.id);if(ex&&(ex.lastModified>b.lastModified||(ex.lastModified===b.lastModified&&ex.size===b.size)))continue;
    const nb=Object.assign({},b,{src:ex&&ex.src==='folder'?'folder':(b.src==='folder'?'sync':b.src)});if(ex)BOOKS[BOOKS.indexOf(ex)]=nb;else BOOKS.push(nb);await bPut(nb);n++}
  if(n){reindex();draw()}return n}
/* the normal backup and restore carry the Excel data too */
function hook(){
  if(typeof ndRestore==='function'&&!ndRestore.__mm){const _r=ndRestore;const w=async function(f){const t=await f.text();await _r(new File([t],f.name,{type:'application/json'}));
      try{const j=JSON.parse(t);if(j&&j.members){const n=await merge(j.members);if(n)say(`${n} Excel file${n>1?'s':''} updated from ${f.name}`)}}catch(e){}};w.__mm=true;ndRestore=w;try{histRestore=w}catch(e){}}
  if(typeof ndBackup==='function'&&!ndBackup.__mm){const w=async function(opt){opt=opt||{};if(!window.NDSYNC){return}const withPdf=opt.pdf!==undefined?opt.pdf:!((q('#aPdf')||{}).checked===false);say('Preparing the backup…');
      const p=await NDSYNC.build({pdf:withPdf,kind:'backup'});const blob=new Blob([JSON.stringify(p)],{type:'application/json'});saveBlob(blob,`NotingDesk_backup_${todayISO()}.json`);
      try{ND2.lastBackup=Date.now();nd2Save();ndChips();if(ndCurView==='auto')autoDraw()}catch(e){}
      say(`Backup downloaded (${(blob.size/1048576).toFixed(1)} MB) – keep it on the pen drive`)};w.__mm=true;ndBackup=w;try{histBackup=()=>ndBackup()}catch(e){}}}

/* ---------------- tab ---------------- */
function tab(){const rail=q('#rail');if(!rail||q('#mMem'))return;
  try{NDV.mem=['vMem','mMem','Members','Search your Excel sheets by member number – 787, 4566/787, UAN or name']}catch(e){}
  const b=document.createElement('button');b.id='mMem';b.type='button';b.dataset.v='mem';b.title='Members – search your Excel sheets';b.innerHTML='<i>👥</i><span>Members</span><b class="d6t">Members</b><em class="d6c"></em>';
  b.onclick=()=>{ndView('mem');setTimeout(()=>{if(window.innerWidth>900)q('#mmQ').focus()},40)};
  const note=q('#mNote');if(note&&note.parentNode)note.parentNode.insertBefore(b,note.nextSibling);else rail.insertBefore(b,rail.firstChild)}
function dockFix(){/* the dock re-orders its own tabs; keep Members right after Draft */const b=q('#mMem'),n=q('#mNote');if(b&&n&&b.previousElementSibling!==n)n.parentNode.insertBefore(b,n.nextSibling);
  const c=q('#mMem .d6c');if(c&&IX)c.textContent=String([...IX.by.keys()].filter(k=>k[0]!=='?').length||'')}

async function boot(){view();tab();hook();
  DB=await idb();BOOKS=(await bAll())||[];TOMB=(await mGet('tomb'))||[];reindex();draw();dockFix();
  setTimeout(()=>{dockFix();hook()},1600);setTimeout(()=>{scanFolder(false);dockFix()},4000);
  setInterval(()=>{if(!document.hidden)scanFolder(false)},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scanFolder(false)});
  window.addEventListener('focus',()=>scanFolder(false))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.NDMEM={pick,search,pack,merge,importFile,scanFolder,reindex,get books(){return BOOKS},resolve,memKey};
})();
