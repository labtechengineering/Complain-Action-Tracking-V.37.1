(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').trim().toLocaleLowerCase('th');
let entries=[];
const displayStatus=s=>({OPEN:'กำลังดำเนินงาน',IN_PROGRESS:'กำลังดำเนินงาน',REWORK:'กำลังดำเนินงาน',WAITING_REVIEW:'รอตรวจสอบ',CLOSED:'สำเร็จ',CANCELLED:'ไม่เกี่ยวข้อง'})[s]||'ไม่ระบุ';
const groupStatus=s=>['OPEN','IN_PROGRESS','REWORK'].includes(s)?'IN_PROGRESS':s;
function stamp(raw){if(!raw)return '—';const d=new Date(raw);if(Number.isNaN(+d))return '—';const a=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);const get=k=>a.find(x=>x.type===k)?.value||'';return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;}
function sortEntries(a,b){const parse=x=>{const m=String(x.car).match(/CAR-(\d{4})-(\d+)/i);return m?[+m[1],+m[2]]:[0,0]};const x=parse(a),y=parse(b);return y[0]-x[0]||y[1]-x[1]||b.number-a.number||String(b.date).localeCompare(String(a.date));}
function buildEntries(jobs){const list=[];
 for(const j of jobs){const byIssue=new Map();for(const a of j.assignments||[]){for(const i of a.issues||[]){const key=String(i.issue_id||i.issue_number);if(!key)continue;let row=byIssue.get(key);if(!row){row={jobId:j.job_id,car:String(j.car_code||j.job_id||''),id:i.issue_id,number:Number(i.issue_number)||1,description:String(i.description||''),name:String(j.customer_name||''),serial:String(j.serial_no||''),country:String(j.country||''),date:j.created_at,statuses:new Set(),departments:new Set()};byIssue.set(key,row);}row.statuses.add(groupStatus(String(a.status||'').toUpperCase()));row.departments.add(String(a.department_code||''));}}
 list.push(...byIssue.values());}
 return list.sort(sortEntries);
}
function render(){const serial=norm($('customerSerial').value),name=norm($('customerName').value),country=norm($('customerCountry').value);
 const filtered=entries.filter(j=>(!serial||norm(j.serial).includes(serial))&&(!name||norm(j.name).includes(name))&&(!country||norm(j.country).includes(country)));
 $('customerDataNotice').textContent='';$('customerTitle').textContent=`ประวัติที่ตรงกับการค้นหา ${filtered.length} ปัญหา`;
 if(!filtered.length){$('customerList').innerHTML='<div class="empty">ไม่พบข้อมูลที่ตรงกับเงื่อนไขค้นหา</div>';return;}
 const groups=new Map();for(const e of filtered){const key=e.name||'ยังไม่มีข้อมูล Customer name';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
 $('customerList').innerHTML=[...groups.entries()].sort((a,b)=>b[1].length-a[1].length).map(([customer,items])=>{const serials=new Set(items.map(x=>x.serial).filter(Boolean));const pending=items.filter(x=>![...x.statuses].every(s=>['CLOSED','CANCELLED'].includes(s))).length;
 return `<details class="customer-result"><summary>${esc(customer)} <small>· ${serials.size} เครื่อง · ${items.length} ปัญหา · ค้าง ${pending}</small></summary><div class="list-scroll"><div class="list-table"><div class="list-columns"><span>เลขที่ปัญหา</span><span>Customer name</span><span>Serial Number</span><span>Country</span><span>ปัญหา</span><span>สถานะ</span><span>วันที่แจ้ง</span></div>${items.map(j=>{const sts=[...j.statuses];const status=sts.length===1?displayStatus(sts[0]):'หลายสถานะ';const pill=sts.length===1?sts[0]:'UNKNOWN';const url='vnext-job.html?id='+encodeURIComponent(j.jobId)+'#issue-'+encodeURIComponent(String(j.id||''));const code=j.car+'-'+String(j.number).padStart(2,'0');return `<a class="job-row" href="${esc(url)}"><span><b>${esc(code)}</b></span><span>${esc(j.name||'ไม่ระบุ')}</span><span>${esc(j.serial||'—')}</span><span>${esc(j.country||'ไม่ระบุ')}</span><span title="${esc(j.description)}">${esc(j.description||'—')}</span><span><i class="pill ${esc(pill)}">${esc(status)}</i></span><span>${esc(stamp(j.date))}</span></a>`}).join('')}</div></div></details>`}).join('');
}
async function load(){ $('customerFeedback').textContent='กำลังโหลดข้อมูลใบงาน...';
 try{const {data,error}=await QA.client.rpc('qa_dashboard_department_issue_list');if(error)throw error;if(!Array.isArray(data))throw Error('INVALID_DASHBOARD_ISSUE_LIST');entries=buildEntries(data);render();$('customerFeedback').textContent=`โหลด ${entries.length} ปัญหา ตามสิทธิ์ผู้ใช้งาน`;
 }catch(e){entries=[];render();$('customerFeedback').textContent='โหลดไม่สำเร็จ: '+String(e?.message||e);}}
document.addEventListener('DOMContentLoaded',()=>{if(!window.QA?.run){$('customerFeedback').textContent='ไม่พบ API';return;}QA.run.withSuccessHandler(()=>{['customerSerial','customerName','customerCountry'].forEach(id=>$(id).addEventListener('input',render));$('customerRefresh').addEventListener('click',load);load();}).withFailureHandler(e=>{$('customerFeedback').textContent=e?.message||String(e);}).getSettings();});
})();