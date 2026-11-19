/* =====================================================================
   EPFO DESK · iPHONE PHOTOS (HEIC / HEIF)
   iPhones save photos as HEIC. Chrome / Edge on Windows cannot open them,
   so a photo copied to the office PC by pen drive was refused. Every HEIC
   file is now turned into a JPEG the moment it is picked, dropped or
   pasted – fully offline (libheif 1.19.8, LGPL-3.0, embedded below as a
   separate replaceable script).
   ===================================================================== */
(function(){
'use strict';
if(window.NDHEIC)return;
const isHeicName=f=>/\.(heic|heif|hif)$/i.test(f.name||'')||/^image\/hei[cf](-sequence)?$/i.test(f.type||'');
async function isHeic(f){if(isHeicName(f))return true;if(f.type&&f.type!=='application/octet-stream')return false;
  try{const b=new Uint8Array(await f.slice(0,16).arrayBuffer());const s=String.fromCharCode(...b.slice(4,12));return /^ftyp(heic|heix|hevc|hevx|heim|heis|mif1|msf1)/.test(s)}catch(e){return false}}
let LIB=null;
async function lib(){if(LIB)return LIB;const el=document.getElementById('nd-heic-lib');if(!el)throw new Error('HEIC reader missing');
  if(typeof window.libheif==='undefined'){await new Promise((res,rej)=>{const s=document.createElement('script');s.src=URL.createObjectURL(new Blob([el.textContent],{type:'text/javascript'}));s.onload=res;s.onerror=()=>rej(new Error('HEIC reader could not start'));document.head.appendChild(s)})}
  let m=window.libheif();if(m&&typeof m.then==='function')m=await m;if(m&&m.ready)await m.ready;LIB=m;return m}
async function toJpeg(f){const m=await lib();const dec=new m.HeifDecoder();const imgs=dec.decode(new Uint8Array(await f.arrayBuffer()));if(!imgs||!imgs.length)throw new Error(f.name+': no picture inside this HEIC file');
  const out=[];for(let i=0;i<imgs.length;i++){const im=imgs[i];const w=im.get_width(),h=im.get_height();const cv=document.createElement('canvas');cv.width=w;cv.height=h;const g=cv.getContext('2d');const id=g.createImageData(w,h);
    await new Promise((res,rej)=>im.display(id,d=>d?res():rej(new Error(f.name+': could not decode'))));g.putImageData(id,0,0);try{im.free&&im.free()}catch(e){}
    const blob=await new Promise(r=>cv.toBlob(r,'image/jpeg',0.92));const base=(f.name||'photo').replace(/\.(heic|heif|hif)$/i,'');out.push(new File([blob],base+(imgs.length>1?'_'+(i+1):'')+'.jpg',{type:'image/jpeg',lastModified:f.lastModified||Date.now()}))}
  return out}
async function convertList(files){const out=[];let n=0;for(const f of files){if(await isHeic(f)){try{say(`Converting ${f.name} (iPhone photo)…`);out.push(...await toJpeg(f));n++}catch(e){console.warn(e);say((e&&e.message)||String(e));out.push(f)}}else out.push(f)}return{out,n}}
const say=m=>{try{toast(m)}catch(e){}};
const dtOf=list=>{const dt=new DataTransfer();list.forEach(f=>dt.items.add(f));return dt};

/* file pickers: show .heic files too (Windows does not count them as "image/*") */
function patchAccept(inp){const a=inp.getAttribute('accept')||'';if(/image\//.test(a)&&!/\.heic/i.test(a))inp.setAttribute('accept',a+',.heic,.heif,image/heic,image/heif')}
document.addEventListener('click',e=>{const t=e.target;if(t&&t.matches&&t.matches('input[type=file]'))patchAccept(t)},true);
const scanInputs=()=>document.querySelectorAll('input[type=file]').forEach(patchAccept);
/* picked files: convert first, then let the app see the JPEGs */
document.addEventListener('change',e=>{const inp=e.target;if(!inp||!inp.matches||!inp.matches('input[type=file]')||inp.__ndHeic||!inp.files||!inp.files.length)return;
  const files=[...inp.files];if(!files.some(isHeicName)&&!files.some(f=>!f.type))return;
  e.stopImmediatePropagation();e.preventDefault();
  (async()=>{const{out,n}=await convertList(files);inp.__ndHeic=true;try{if(n)inp.files=dtOf(out).files;inp.dispatchEvent(new Event('change',{bubbles:true}))}finally{inp.__ndHeic=false}})()},true);
/* dropped files */
window.addEventListener('drop',e=>{const dt=e.dataTransfer;if(!dt||!dt.files||!dt.files.length||e.__ndHeic)return;const files=[...dt.files];if(!files.some(isHeicName))return;
  e.stopImmediatePropagation();e.preventDefault();const target=e.target;
  (async()=>{const{out}=await convertList(files);const ev=new DragEvent('drop',{dataTransfer:dtOf(out),bubbles:true,cancelable:true,clientX:e.clientX,clientY:e.clientY});ev.__ndHeic=true;target.dispatchEvent(ev)})()},true);
/* anything else that opens a picture */
try{if(typeof loadImg==='function'){const _l=loadImg;loadImg=async function(f){if(f&&f instanceof Blob&&await isHeic(f)){const[j]=await toJpeg(f);return _l(j)}return _l(f)}}}catch(e){}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scanInputs);else scanInputs();
window.NDHEIC={isHeic,toJpeg,convertList};
})();
