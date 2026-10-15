(()=>{'use strict';
function fix(){const sels='a[href],button[data-page],button[onclick]';
 document.querySelectorAll(sels).forEach(a=>{
  if(a.closest('main,.main,.qa-app-content,.listpanel,.customer-result'))return;
  const raw=a.getAttribute('href')||'';let page='';try{page=new URL(raw,location.href).pathname.split('/').pop().toLowerCase()}catch{}
  const label=(a.innerText||a.textContent||'').trim();
  if(!((page==='job.html'&&!/[?&](id|job|jobId|job_id)=/i.test(raw))||(/^(ใบงาน|ข้อมูลใบงาน)$/).test(label)))return;
  a.setAttribute('href','customer.html');a.setAttribute('data-page','customer');a.setAttribute('aria-label','ข้อมูลลูกค้า');
  const leaf=[...a.querySelectorAll('span,.menu-label,.nav-label')].reverse().find(x=>/ใบงาน/.test(x.textContent||''));
  if(leaf)leaf.textContent='ข้อมูลลูกค้า';else for(const n of a.childNodes){if(n.nodeType===3&&/ใบงาน/.test(n.textContent)){n.textContent=n.textContent.replace(/ใบงาน/g,'ข้อมูลลูกค้า');break}}
 });}
let scheduled=false;function later(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;fix()})}
document.addEventListener('DOMContentLoaded',()=>{fix();new MutationObserver(later).observe(document.body,{childList:true,subtree:true})});
})();