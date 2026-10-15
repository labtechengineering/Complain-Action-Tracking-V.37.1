(()=>{'use strict';
// UI-only: retain job.html for direct links, never replace a job detail URL.
const CUSTOMER='customer.html';
const targets='aside,nav,[role="navigation"],.sidebar,#sidebar,.side-nav,.nav-menu,.qa-sidebar,.qa-nav';
function menuRoots(){const roots=[...document.querySelectorAll(targets)];return roots.filter(el=>!el.closest('main,.main,.qa-app-content'));}
function isJobLabel(s){return /^(ใบงาน|ข้อมูลใบงาน|รายการใบงาน|Work Orders?|Jobs?)$/i.test((s||'').replace(/\s+/g,' ').trim());}
function labelNode(link){const nodes=[...link.querySelectorAll('span,.menu-label,.nav-label,.label,strong')].filter(x=>x.children.length===0);return nodes.find(x=>isJobLabel(x.textContent))||null;}
function changeLabel(link){let leaf=labelNode(link);if(leaf){leaf.textContent='ข้อมูลลูกค้า';return;}
 for(const n of link.childNodes){if(n.nodeType===3 && /ใบงาน|Work Orders?|Jobs?/i.test(n.textContent||'')){n.textContent=n.textContent.replace(/ใบงาน|ข้อมูลใบงาน|รายการใบงาน|Work Orders?|Jobs?/gi,'ข้อมูลลูกค้า');return;}}
 // If the name is nested in a generic node, leave icons in place.
 const leaves=[...link.querySelectorAll('*')].filter(n=>n.children.length===0 && isJobLabel(n.textContent));if(leaves.length)leaves[0].textContent='ข้อมูลลูกค้า';
}
function apply(){const roots=menuRoots();const candidates=roots.length?roots:[document.body];
 for(const root of candidates){for(const link of root.querySelectorAll('a[href],button,[role="link"],[role="menuitem"]')){
  if(link.closest('main,.main,.customer-result,.listpanel') || link.id==='customerRefresh')continue;
  const text=(link.innerText||link.textContent||'').replace(/\s+/g,' ').trim();const href=link.getAttribute('href')||'';
  let file='';try{file=new URL(href,location.href).pathname.split('/').pop().toLowerCase()}catch{}
  const bareJob=file==='job.html'&&!/[?&](?:id|job|jobId|job_id)=/i.test(href);
  const isTarget=isJobLabel(text)||bareJob||link.getAttribute('data-page')==='job' || link.getAttribute('data-page')==='jobs';
  if(!isTarget)continue;
  link.setAttribute('data-page','customer');link.setAttribute('aria-label','ข้อมูลลูกค้า');link.setAttribute('title','ข้อมูลลูกค้า');
  if(link.tagName==='A')link.setAttribute('href',CUSTOMER);
  else {link.removeAttribute('onclick');link.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();location.assign(CUSTOMER)},true)}
  changeLabel(link);
 }
 }
 // Mark sidebar customer menu as current when on the customer page.
 if(/customer\.html$/i.test(location.pathname))for(const a of document.querySelectorAll('a[href]')){try{if(new URL(a.href,location.href).pathname.endsWith('/customer.html')&&a.closest(targets)){a.setAttribute('aria-current','page')}}catch{}}
}
let queued=false;function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;apply()},0)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{apply();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true})});
else {apply();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true})}
// Intercept delegated sidebar navigation handlers that ignore the rewritten href.
document.addEventListener('click',e=>{const a=e.target.closest?.('a,button,[role="menuitem"]');if(!a||!a.closest(targets))return;const file=a.getAttribute('href')||'';if(a.getAttribute('data-page')==='customer'||/customer\.html(?:$|[?#])/i.test(file)){e.preventDefault();e.stopImmediatePropagation();location.assign(CUSTOMER)}},true);
})();