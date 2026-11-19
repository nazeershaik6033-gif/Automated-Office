/* =====================================================================
   EPFO DESK · LEARNING  – picks the right noting and fills it better
   1. Template choice = the app's keyword rules + "which of your own past
      notings is this most like" (5 nearest notings). Trained on the
      user's notings; tested on notings it had not seen:
        right template first time 51% -> 85%, in the top three 82% -> 94%.
      The model (nd-model.json) holds generic EPFO words only – no names,
      numbers or case details.
   2. Keeps learning: every noting you save is remembered as one more
      example for its template (on this device, travels in the sync file).
   3. PF a/c number: the member's own number (after "bearing", "PF a/c
      number", "PF code no") wins over transfer-in / previous accounts.
   4. Fills name, UAN, PPO, ACK No and DD details from your Members Excel
      data when the PF number or UAN is found.
   ===================================================================== */
(function(){
'use strict';
if(window.NDLEARN||typeof qDetect!=='function'||typeof qExtract!=='function')return;
const M=window.ND_MODEL||{docs:[],stop:[],k:5,beta:0.6};
const STOP=new Set(M.stop||[]);
const UK='nd_learn_docs';
const lsGet=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
function toks(t){const w=(String(t||'').toLowerCase().match(/[a-z][a-z-]+/g)||[]).filter(x=>!STOP.has(x));const o=w.slice();for(let i=0;i<w.length-1;i++)o.push(w[i]+'_'+w[i+1]);return o}

/* ---------------- nearest notings ---------------- */
let IDX=null;
function userDocs(){return lsGet(UK,[])}
function build(){const docs=(M.docs||[]).map((d,i)=>({c:d.c,w:d.w,src:'model',i})).concat(userDocs().map(d=>({c:d.c,w:d.w,src:'user'})));
  const df=new Map();for(const d of docs)for(const w of d.w)df.set(w,(df.get(w)||0)+1);
  const N=docs.length,idf=new Map();for(const [w,c] of df)idf.set(w,Math.log((N+1)/(c+0.5)));
  for(const d of docs){let n=0;const v=new Map();for(const w of d.w){const x=idf.get(w)||0;v.set(w,x);n+=x*x}n=Math.sqrt(n)||1;for(const [w,x] of v)v.set(w,x/n);d.v=v}
  IDX={docs,idf}}
function knn(text,skip){if(!IDX)build();const cnt=new Map();for(const w of toks(text))if(IDX.idf.has(w))cnt.set(w,(cnt.get(w)||0)+1);
  if(!cnt.size)return{};let n=0;const q=new Map();for(const [w,c] of cnt){const x=(1+Math.log(c))*IDX.idf.get(w);q.set(w,x);n+=x*x}n=Math.sqrt(n)||1;
  const sims=[];IDX.docs.forEach((d,i)=>{if(skip!=null&&d.src==='model'&&d.i===skip)return;let s=0;for(const [w,x] of q){const y=d.v.get(w);if(y)s+=x*y}sims.push([s/n,d.c])});
  sims.sort((a,b)=>b[0]-a[0]);const out={};for(const [s,c] of sims.slice(0,M.k||5))out[c]=(out[c]||0)+s;return out}
/* sharper keyword rules learned from real letters */
try{
  QDET.jd_eps=[[/\beps\b/i,2],[/\b58\s*(?:years?|yrs)\b|attain(?:ed|ing)\s+58|superannuat/i,2],[/remov|wrongly marked/i,2]];
  QDET.ob_adj=(QDET.ob_adj||[]).concat([[/divers?ion\s+(?:of\s+)?(?:\w+\s+){0,3}(?:EPS|EPF|pension|contribution)|(?:EPS|pension)\s+(?:contributions?|amounts?|credits?|entries)\s+(?:were\s+)?(?:posted|paid|remitted|credited)\s+(?:wrongly|erroneously|instead)|instead\s+of\s+(?:EPF|EPS|PF)\b|erroneous\s+(?:EPS|pension|contribution)|rectif\w+\s+of\s+(?:erroneous\s+)?(?:EPS|pension)|reallocat/i,4],[/\beps\b/i,1]]);
}catch(e){}
const DEATH_ONLY=['tr_death','tr_email','dc_office','dc_note','dc_letter','dc_pdf','dc_reject_letter','dc_eo_note','dc_check'];
const _qd=qDetect;
qDetect=function(text){const base=_qd.apply(this,arguments);let nn={};try{nn=knn(text,window.__ndLOO)}catch(e){console.warn('learn',e)}
  const m={};for(const x of base)m[x.id]=x.s;const have=new Set(T.map(t=>t.id));
  for(const c in nn){if(!have.has(c))continue;m[c]=(m[c]||0)+(M.beta||0.6)*10*nn[c]}
  /* templates that only make sense for a deceased member */
  try{if(!DEATH.test(String(text||'')))for(const c of DEATH_ONLY)if(m[c])m[c]*=0.3}catch(e){}
  return Object.entries(m).filter(([,s])=>s>0).map(([id,s])=>({id,s:Math.round(s*10)/10})).sort((a,b)=>b.s-a.s)};

/* ---------------- learning from saved notings ---------------- */
const hash=s=>{let h=0;for(let i=0;i<s.length;i+=3)h=(h*31+s.charCodeAt(i))|0;return h};
function learn(tpl,text){text=String(text||'').trim();if(!tpl||text.length<60||/^gen_/.test(tpl))return false;const w=[...new Set(toks(text))];if(w.length<8)return false;
  const L=userDocs().filter(d=>d.h!==hash(text));L.push({c:tpl,w,h:hash(text),t:Date.now()});lsSet(UK,L.slice(-400));IDX=null;try{dfSaveSoon('state')}catch(e){}return true}
if(typeof hPut==='function'){const _hp=hPut;hPut=function(h){try{if(h&&h.tpl&&h.kind!=='ibb'&&typeof S!=='undefined'&&S.__qtext)learn(h.tpl,S.__qtext)}catch(e){}return _hp.apply(this,arguments)}}
function pack(since){since=+since||0;return userDocs().filter(d=>!since||d.t>since)}
function merge(list){if(!Array.isArray(list)||!list.length)return 0;const L=userDocs();const hs=new Set(L.map(d=>d.h));let n=0;
  for(const d of list){if(!d||!d.c||!Array.isArray(d.w)||hs.has(d.h))continue;L.push(d);hs.add(d.h);n++}if(n){L.sort((a,b)=>(a.t||0)-(b.t||0));lsSet(UK,L.slice(-400));IDX=null}return n}
/* travels with the sync file and the backup */
if(typeof ndRestore==='function'){const _r=ndRestore;const w=async function(f){const t=await f.text();await _r(new File([t],f.name,{type:'application/json'}));try{const j=JSON.parse(t);if(j&&j.learnDocs)merge(j.learnDocs)}catch(e){}};w.__mm=_r.__mm;ndRestore=w;try{histRestore=w}catch(e){}}

/* ---------------- PF a/c number: the member's own ---------------- */
const PFRX=[/\b([A-Z]{5}\d{17})\b/g,/\b([A-Z]{2}\/?[A-Z]{3}\/\d{1,7}(?:\/\d{1,7}){1,2})\b/g,/\b([A-Z]{2}\/\d{2,7}\/\d{1,7})\b/g];
const OWN=/(?:bearing|pf\s*(?:a\/?c|account|acc)?\.?\s*(?:no|number|code(?:\s*no)?)?\.?|member\s*(?:id|pf\s*code\s*no)|p\s*f\s*a\/?c\s*no)\s*[.:–-]*\s*(?:number|no\.?)?\s*[.:–-]*\s*$/i;
const OTHER=/(?:transfer[\s-]*in|transferred|from\s+(?:pf|the)\b|previous|old\b|prior|earlier|past\s+service|merged|received\s+from|other|second|\(2\)|instead\s+of|new\s+pf)[^.\n]{0,45}$/i;
function pfPick(text){const t=String(text||'');const cands=[];
  for(const rx of PFRX){rx.lastIndex=0;let m;while((m=rx.exec(t))){const pre=t.slice(Math.max(0,m.index-70),m.index);let s=0;if(OWN.test(pre))s+=6;if(OTHER.test(pre))s-=6;cands.push({v:m[1],at:m.index,s})}}
  if(!cands.length)return null;cands.sort((a,b)=>b.s-a.s||a.at-b.at);return cands[0]}
const pfOk=v=>/^[A-Z]{2}\/?[A-Z]{3}\/\d|^[A-Z]{5}\d{17}$|^[A-Z]{2}\/\d+\/\d+$/.test(String(v||'').toUpperCase());
const _qx=qExtract;
qExtract=function(text){const r=_qx.apply(this,arguments);try{const F=r.F,src=r.src||{};
    const best=pfPick(text);
    if(best&&(!F.pf||!pfOk(F.pf)||best.s>0)){const v=normPf(best.v);if(v&&v!==F.pf){F.pf=v;src.pf='pattern';if(src.estCode!=='label'){F.estCode=estFromPf(v)||F.estCode}}}
    else if(F.pf&&!pfOk(F.pf)){delete F.pf}
    facts(String(text||''),F,src);
    fillXl(F,src)}catch(e){console.warn('learn extract',e)}return r};

/* ---------------- facts written the way EPFO letters and notings write them ---------------- */
const DT='(\\d{1,2}(?:st|nd|rd|th)?[./\\- ](?:\\d{1,2}|[A-Za-z]{3,9})[./\\-, ]+\\d{4})';
const NM="([A-Z][A-Za-z.'’]*(?:\\s+[A-Z][A-Za-z.'’]*){0,5})";
const SAL='(?:(?:Shri|Sri|Smt|Mr|Mrs|Ms|Kum)\\.?\\s*)';
function facts(t,F,src){let m;const set=(k,v,how)=>{v=String(v||'').trim().replace(/\s+/g,' ').replace(/[.,;:]+$/,'');if(!v)return;F[k]=v;src[k]=how||'pattern'};
  /* member's own service: "worked / has been working in|with|at <estb> (<code>) from <date> to <date|till date>" */
  const svc=new RegExp('\\b(?:Member|member|deceased member|He|She|he|she)\\b[^.\\n]{0,120}?\\b(?:has\\s+been\\s+working|is\\s+working|worked|has\\s+worked|working)\\s+(?:in|with|at)\\s+(?:the\\s+)?(?:establishment\\s+)?(?:M\\/s\\.?\\s*)?([^()\\n]{2,90}?)\\s*\\(([A-Z]{2}\\/?[A-Z]{3}\\/?\\d[\\d\\/]*)\\)?[^.\\n]{0,40}?\\bfrom\\s+'+DT+'(?:\\s+(?:to|till|upto|up to)\\s+'+DT+')?');
  if((m=svc.exec(t))){const est=m[1].replace(/\s*\($/,'').replace(/^(?:M\/s\.?\s*)/i,'').trim();if(est&&!/^(?:the|this|our)\b/i.test(est)&&est.length<80)set('estName',est);
    const d1=normDate(m[3]);if(d1){F.doj=d1;src.doj='pattern'}const d2=m[4]&&normDate(m[4]);if(d2){F.doe=d2;src.doe='pattern'}}
  else if((m=/\bM\/s\.?\s+([A-Z][^\n()]{2,90}?)\s+(?:with\s+(?:pf|PF|EPF|establishment|effect)|bearing|having|vide|from\s+\d|\(|,)/.exec(t))){const est=m[1].trim();if(!F.estName||(est.length>F.estName.length&&est.toUpperCase().startsWith(F.estName.toUpperCase().slice(0,6))))set('estName',est)}
  /* "the employee / member joined <estb> on <date>" */
  if(!src.doj||src.doj!=='label'){const jn=new RegExp('\\b(?:employee|member|he|she)\\s+(?:has\\s+)?(?:joined|was\\s+appointed\\s+in|was\\s+employed\\s+(?:in|with))\\s+(?:in\\s+|with\\s+|at\\s+)?(?:the\\s+)?(?:establishment\\s+)?(?:M\\/s\\.?\\s*)?([A-Z][^\\n]{2,80}?)\\s+(?:on|w\\.?e\\.?f\\.?|from|with\\s+effect\\s+from)\\s+'+DT,'i').exec(t);
    if(jn){const d=normDate(jn[2]);if(d){F.doj=d;src.doj='pattern'}const est=jn[1].replace(/[.,]$/,'').trim();if(est&&(!F.estName||src.estName!=='label'))set('estName',est)}}
  /* employer letterhead: a line in capitals ending in PVT LTD / LIMITED / LLP */
  if(!F.estName){const lh=/^\s*(?:M\/s\.?\s*)?([A-Z0-9&.,' ()-]{4,70}?\b(?:PVT\.?\s*LTD\.?|PRIVATE\s+LIMITED|LIMITED|LTD\.?|LLP|CORPORATION|INDUSTRIES|SERVICES))\s*$/m.exec(t);if(lh)set('estName',lh[1].trim())}
  /* letter date written as "Date: 10/09/2026" (also "te: 10/09/2026" when the scan cuts the edge) */
  if(!F.ld&&(m=new RegExp('^\\s*(?:Da)?te[d]?\\s*[:.]\\s*'+DT,'im').exec(t))){const d=normDate(m[1]);if(d)set('ld',d)}
  /* OB adjustment: which kind of diversion (matches the template's case types) */
  if(!F.ctype&&typeof CT!=='undefined'){const c=
      /rejoin/i.test(t)?5:/arrear/i.test(t)?4:
      /wage\s*ceiling|EPS\s+wages?\s+(?:correct|exceed|above)/i.test(t)&&/\b58\b/.test(t)?3:
      /instead\s+of\s+EPF|not\s+eligible\s+for\s+(?:EPS|pension)|no\s+EPS\s+wages|already\s+an?\s+EPF\s+member|excluded\s+employee|EPS\s+to\s+EPF|(?:from|out\s+of)\s+EPS\s+(?:to|into)\s+(?:EPF|ER|employer)/i.test(t)?2:
      /instead\s+of\s+EPS|EPF\s+to\s+EPS|eligible\s+for\s+EPS\s+membership|EPS\s+contributions?\s+not\s+(?:received|remitted|paid)/i.test(t)?1:
      /(?:after|crossed|attaining|attained)\s+(?:the\s+age\s+of\s+)?58|\b58\s*(?:years|yrs)/i.test(t)?0:-1;
    if(c>=0)set('ctype',CT[c])}
  /* period: "during the period February 2018 to August 2018" / "from 09/2014 to 10/2024" */
  if(!F.period){const MY='((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*[\\s,.-]*\\d{4}|\\d{1,2}\\/\\d{4}|\\d{1,2}[./-]\\d{1,2}[./-]\\d{4})';
    const pm=new RegExp('\\b(?:during|for|in)\\s+the\\s+period\\s+(?:from\\s+)?'+MY+'\\s+(?:to|till|upto|up\\s+to|-|–)\\s+'+MY,'i').exec(t)||new RegExp('\\b(?:EPS|pension)\\b[^.\\n]{0,80}?\\bfrom\\s+'+MY+'\\s+(?:to|till|upto)\\s+'+MY,'i').exec(t);
    if(pm)set('period',pm[1].replace(/\s+/g,' ')+' to '+pm[2].replace(/\s+/g,' '))}
  /* name after "in r/o" (also "Late X", no Sri/Smt) */
  if(!F.name||src.name!=='label'){const rn=new RegExp('\\b(?:in\\s+r\\/o|in\\s+respect\\s+of|r\\/o)\\s+(?:the\\s+)?(?:member\\s+|pensioner\\s+|deceased\\s+member\\s+)?(Late\\s+)?'+SAL+'?'+NM).exec(t);
    if(rn){let n=rn[2].replace(/\s+(?:bearing|having|with|for|who|is|has|vide|regarding|towards|along|placed|received|PF|UAN)\b.*$/,'').trim();
      if(n.split(/\s+/).length>=1&&n.length>2&&!/^(?:the|this|above|said|member|establishment|M\/s)$/i.test(n)&&(!F.name||F.name.length<n.length&&n.toUpperCase().includes(F.name.toUpperCase().split(' ')[0]))){set('name',n);if(rn[1]&&!F.dod)F.late=true}}}
  /* reason for exit */
  if(!F.rexit&&(m=/reason\s+(?:for|of)\s+(?:exit|leaving)\s+(?:is|was|:|-)?\s*([A-Za-z][A-Za-z ()-]{2,40}?)(?=[.,\n]|$)/i.exec(t)))set('rexit',m[1].trim());
  /* member's date of death written as "died on / expired on" */
  if(!F.dod&&(m=new RegExp('\\b(?:died|expired|passed away|death)\\s+(?:on|dated)\\s+'+DT,'i').exec(t))){const d=normDate(m[1]);if(d)set('dod',d)}
}

/* ---------------- from the Members Excel ---------------- */
function fillXl(F,src){if(!window.NDMEM||!NDMEM.books||!NDMEM.books.length)return;const p=(F.pf&&NDMEM.lookup(F.pf))||(F.uan&&NDMEM.lookup(F.uan));if(!p)return;
  const put=(k,v)=>{if(v&&!F[k]){F[k]=String(v);src[k]='excel'}};const f=p.f;
  put('name',f['Name']&&f['Name'].replace(/^(?:shri|sri|smt|mr|mrs|ms)\.?\s+/i,''));put('uan',f['UAN']);put('ppo',f['PPO No']);put('ack',f['ACK No']);
  put('dd',f['DD / cheque no']);put('ddd',f['DD / cheque date']);if(f['DD amount (Rs)'])F.__ddAmt=String(f['DD amount (Rs)']).replace(/[^\d.]/g,'');
  if(!F.pf&&p.id){F.pf=p.id.short;src.pf='excel'}F.__xl=p.rows}
try{Object.assign(QALIAS,{ack:QALIAS.ack||['ack'],dd:QALIAS.dd||['dd'],ddd:QALIAS.ddd||['ddd'],ctype:QALIAS.ctype||['ctype'],period:QALIAS.period||['period']})}catch(e){}
if(typeof qApply==='function'){const _qa=qApply;qApply=function(F){try{if(F&&F.__ddAmt&&!F.amt&&cur&&/^pohw/.test(cur.id))F.amt=F.__ddAmt}catch(e){}return _qa.apply(this,arguments)}}

/* ---------------- learn from a batch of Word notings ---------------- */
const START_NOTE=/^\s*AG\s*[-:–]?\s*\d/i,START_UO=/^\s*(?:No[.:]?|Sl\.?\s*no\.?\/)\s*\.?\s*TS\/RO/i;
const HEAD=/^(?:AG\b|AG\s*[-:–]|\[DEATH|Submitted\s*:?\s*$|No[.:]|Sl\.?no|U\.?\s*O\.?\s*NOTE|OFFICE NOTE|\*[\s*]*$|PF No\.|[A-Z]{2}\/?[A-Z]{3}\/\d|\d+\/\d+$)/i;
const CONC=/^\s*(?:In view of|If authorities agree|Hence|Therefore|Submitted for|Put up for|This issues|Encl|Asst\.?|Assistant|Accounts Officer|Section Supervisor|To\b|\(This issues)/i;
function splitNotings(lines){const out=[];let cur=null;const flush=()=>{if(cur&&cur.join(' ').length>150)out.push(cur);cur=null};
  lines.forEach((l,i)=>{const s=l.trim();let st=START_UO.test(s);if(!st&&START_NOTE.test(s)&&s.length<25){const nx=lines.slice(i+1,i+4).join(' ');st=/Submitted|[A-Z]{2}\/?[A-Z]{3}|\d{3,}\/\d/.test(nx)}if(st)flush();(cur=cur||[]).push(s)});flush();return out}
function factsPart(lines){const body=[];let started=false;for(const l of lines){if(!l)continue;if(!started&&HEAD.test(l))continue;started=true;if(CONC.test(l)&&body.length>1)break;body.push(l)}return body.join('\n')}
async function teachDocx(files,stat){let n=0,skip=0;const by={};
  for(const f of files){try{const z=await unzipDocx(await f.arrayBuffer());const L=xparas(xtxt(await z.get('word/document.xml')));
      for(const chunk of splitNotings(L)){const txt=factsPart(chunk);if(txt.length<80){skip++;continue}const sc=qDetect(txt);
        if(!sc.length||sc[0].s<4||(sc[1]&&sc[0].s-sc[1].s<1)){skip++;continue}if(learn(sc[0].id,txt)){n++;by[sc[0].id]=(by[sc[0].id]||0)+1}}}
    catch(e){console.warn(f.name,e);skip++}stat&&stat(`${f.name} read`)}
  return{n,skip,by}}
function teachUI(){const row=document.querySelector('#dlgLearn .qrow');if(!row||document.getElementById('lrnDocx'))return;
  const b=document.createElement('button');b.className='btn';b.id='lrnDocx';b.type='button';b.textContent='📚 Learn from Word notings';b.title='Pick .docx files with your notings – each noting becomes an example of its type, so the right template is chosen next time';
  b.onclick=()=>{const i=document.createElement('input');i.type='file';i.multiple=true;i.accept='.docx';i.onchange=async()=>{if(!i.files.length)return;toast('Reading your notings…');
      const r=await teachDocx([...i.files]);const name=id=>{const t=T.find(x=>x.id===id);return t?t.name:id};
      if(typeof ndModal==='function')ndModal('Learned from your notings',`<p><b>${r.n}</b> noting${r.n===1?'':'s'} added as examples${r.skip?` · ${r.skip} skipped (type not clear enough)`:''}.</p><ul>${Object.entries(r.by).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<li>${v} × ${esc(name(k))}</li>`).join('')}</ul><p class="hint">The app now has ${NDLEARN.size} example notings. They travel to the iPhone in the sync file.</p>`);
      else toast(`${r.n} notings learned`)};i.click()};
  row.insertBefore(b,document.getElementById('lrnWipe'))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',teachUI);else teachUI();setTimeout(teachUI,1500);

window.NDLEARN={knn,learn,pack,merge,pfPick,toks,teachDocx,splitNotings,rebuild:()=>{IDX=null},get size(){return(M.docs||[]).length+userDocs().length}};
})();
