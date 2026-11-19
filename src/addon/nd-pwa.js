/* =====================================================================
   NOTING DESK · iPHONE APP LAYER
   - installs as a Home-Screen app (manifest + service worker, offline)
   - files are saved through the iOS share sheet (Save to Files / pen drive)
   - phone bottom bar: 4 main tabs + "More" sheet with every tool
   On the office PC (file://) only the phone bar applies; the rest is inert.
   ===================================================================== */
(function(){
'use strict';
if(window.NDPWA)return;
const q=(s,r)=>(r||document).querySelector(s),qa=(s,r)=>[...(r||document).querySelectorAll(s)];
const IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const WEB=/^https?:$/.test(location.protocol);
const SA=()=>(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
const MOB=()=>window.innerWidth<=900;
const say=m=>{try{toast(m)}catch(e){}};
const de=document.documentElement;
if(IOS)de.classList.add('nd-ios');

/* ---------------- install: manifest + service worker ---------------- */
if(WEB){
  if(!q('link[rel=manifest]')){const l=document.createElement('link');l.rel='manifest';l.href='manifest.webmanifest';document.head.appendChild(l)}
  if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').then(reg=>{
      const ask=w=>{if(!w)return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)updBar(w)})};
      if(reg.waiting&&navigator.serviceWorker.controller)updBar(reg.waiting);reg.addEventListener('updatefound',()=>ask(reg.installing));
      setInterval(()=>reg.update().catch(()=>{}),6*3600e3)}).catch(e=>console.warn('sw',e))});
    let reloaded=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloaded)return;reloaded=true;location.reload()})}
  try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
}
function updBar(w){let b=q('#ndUpd');if(b)return;b=document.createElement('div');b.id='ndUpd';b.className='nd-bar';
  b.innerHTML='<span>✨ A new version of Noting Desk is ready.</span><button class="btn pri" type="button">Update now</button><button class="btn" type="button" aria-label="Later">Later</button>';
  document.body.appendChild(b);const[u,l]=qa('button',b);u.onclick=()=>{u.disabled=true;w.postMessage('skip')};l.onclick=()=>b.remove()}

/* ---------------- saving files on the iPhone ---------------- */
/* Safari in Home-Screen mode cannot "download"; the share sheet gives Save to Files (incl. a USB / OTG pen drive), Mail, WhatsApp … */
if(IOS||(WEB&&navigator.canShare&&/Android/i.test(navigator.userAgent))){
  const orig=typeof saveBlob==='function'?saveBlob:null;
  const share=async f=>{await navigator.share({files:[f],title:f.name})};
  const sheet=f=>{let m=q('#ndShare');if(!m){m=document.createElement('div');m.id='ndShare';m.className='nd-sheetmask';document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('on')})}
    const kb=f.size>=1048576?(f.size/1048576).toFixed(1)+' MB':Math.max(1,Math.round(f.size/1024))+' KB';
    m.innerHTML=`<div class="nd-sheet"><div class="nd-grab"></div><h3>📄 File ready</h3><p class="nd-fn">${(typeof esc==='function'?esc:String)(f.name)} · ${kb}</p>
      <button class="btn pri nd-big" type="button" id="ndShBtn">Save to Files / Share…</button><button class="btn nd-big" type="button" id="ndShOpen">Open</button><button class="btn nd-big" type="button" id="ndShX">Close</button>
      <p class="hint">In the share sheet choose <b>Save to Files</b>, then your pen drive or iPhone folder.</p></div>`;
    m.classList.add('on');
    q('#ndShBtn').onclick=async()=>{try{await share(f);m.classList.remove('on')}catch(e){if(e&&e.name!=='AbortError')alert('Could not share: '+(e.message||e))}};
    q('#ndShOpen').onclick=()=>{const u=URL.createObjectURL(f);window.open(u,'_blank');setTimeout(()=>URL.revokeObjectURL(u),60000)};
    q('#ndShX').onclick=()=>m.classList.remove('on')};
  window.ndSaveFile=async(blob,name)=>{const f=new File([blob],name,{type:blob.type||'application/octet-stream'});
    if(navigator.canShare&&navigator.canShare({files:[f]})){try{await share(f);return}catch(e){if(e&&e.name==='AbortError')return}/* needs a fresh tap */sheet(f);return}
    if(orig)orig(blob,name)};
  try{saveBlob=function(blob,name){window.ndSaveFile(blob,name)}}catch(e){console.warn('saveBlob',e)}
}

/* ---------------- things that only exist next to the PC file ---------------- */
if(WEB)document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#mPohw');if(!b)return;e.stopImmediatePropagation();e.preventDefault();
  say('PoHW Desk is a separate file on the office PC – its cases still travel in the sync file')},true);

/* ---------------- phone bottom bar: main tabs + More ---------------- */
const PRI=['mNote','mMail','mLib','mDiary'];
const LAB={mNote:'Draft',mLib:'Circulars',mOrd:'Orders',mMail:'E-mails',mAuto:'Automate',mIbb:'IBB',mHist:'History',mDiary:'Diary',mSport:'Sports',mTools:'Tools',btnLearn:'Learned',btnTeach:'Teach',btnSet:'Settings',mSync:'Sync',mPohw:'PoHW'};
function navBuild(){const rail=q('#rail');if(!rail)return;
  PRI.forEach(id=>{const b=q('#'+id);if(b)b.classList.add('ndm-pri')});
  let more=q('#ndMore');if(!more){more=document.createElement('button');more.id='ndMore';more.type='button';more.className='ndm-pri';more.title='All tools';more.innerHTML='<i>☰</i><span>More</span>';more.onclick=moreOpen;rail.appendChild(more)}
  navMark()}
function navMark(){const more=q('#ndMore');if(!more)return;const on=qa('#rail button.on').some(b=>!b.classList.contains('ndm-pri'));more.classList.toggle('on',on)}
function moreOpen(){let m=q('#ndMoreS');if(!m){m=document.createElement('div');m.id='ndMoreS';m.className='nd-sheetmask';document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('on')})}
  const btns=qa('#rail button').filter(b=>LAB[b.id]&&b.style.display!=='none'&&!(WEB&&b.id==='mPohw'));
  m.innerHTML=`<div class="nd-sheet"><div class="nd-grab"></div><h3>All tools</h3><div class="nd-tiles">${btns.map(b=>{const i=q('i',b),c=q('.d6c',b);
      return`<button type="button" class="nd-tile${b.classList.contains('on')?' on':''}" data-id="${b.id}"><i>${i?i.textContent:'•'}</i><span>${LAB[b.id]||((q('span',b)||{}).textContent||b.id)}</span>${c&&c.textContent?`<em>${c.textContent}</em>`:''}</button>`}).join('')}</div>
    <p class="hint">Noting Desk ${window.ND_APP_VER||''} · works offline</p></div>`;
  qa('.nd-tile',m).forEach(t=>t.onclick=()=>{m.classList.remove('on');const b=q('#'+t.dataset.id);if(b)b.click();setTimeout(navMark,50)});
  m.classList.add('on')}

/* ---------------- "install this app" hint in Safari ---------------- */
function installHint(){if(!(IOS&&WEB)||SA())return;try{if(localStorage.getItem('nd_inst_hide'))return}catch(e){}
  const b=document.createElement('div');b.id='ndInst';b.className='nd-bar';
  b.innerHTML='<span>📲 Install Noting Desk: tap <b>Share</b> <span aria-hidden="true">⬆︎</span> then <b>Add to Home Screen</b>. It then works offline.</span><button class="btn" type="button">OK</button>';
  document.body.appendChild(b);q('button',b).onclick=()=>{b.remove();try{localStorage.setItem('nd_inst_hide','1')}catch(e){}}}

function boot(){if(SA())document.body.classList.add('nd-standalone');if(WEB)document.body.classList.add('nd-web');
  navBuild();setTimeout(navBuild,1500);   /* the dock is rebuilt once the app has loaded */
  try{const mo=new MutationObserver(navMark);mo.observe(q('#rail'),{subtree:true,attributes:true,attributeFilter:['class']})}catch(e){}
  setTimeout(installHint,2500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.NDPWA={IOS,WEB,standalone:SA,more:moreOpen};
})();
