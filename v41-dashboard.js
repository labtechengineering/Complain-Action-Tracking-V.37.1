(()=>{'use strict';
const $=id=>document.getElementById(id);
const statuses=[['IN_PROGRESS','กำลังดำเนินงาน','#f4ae3c'],['WAITING_REVIEW','รอตรวจสอบ','#268ae5'],['CLOSED','สำเร็จ','#2cbd7b']];
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').trim().toLowerCase();
const dt=j=>{const s=String(j.createdDateTime||'');const d=new Date(s.replace(' ','T'));return Number.isNaN(+d)?0:+d};
const timeText=j=>String(j.createdDateTime||'—');
function jobCarOrder(j){
 // The most recently allocated CAR goes first, independent of job timestamps.
 const m=String(j.carCode||'').match(/CAR[-\s]*(\d{4})[-\s]*(\d+)(?:-|$)/i);
 return m?{year:Number(m[1]),seq:Number(m[2])}:null;
}
function compareLatestIssueRows(a,b){
 const x=jobCarOrder(a.job),y=jobCarOrder(b.job);
 if(x&&y){if(x.year!==y.year)return y.year-x.year;if(x.seq!==y.seq)return y.seq-x.seq;}
 else if(x||y){return x?-1:1;}
 const issueDiff=Number(b.issue.issue_number||0)-Number(a.issue.issue_number||0);
 if(issueDiff)return issueDiff;const timeDiff=dt(b.job)-dt(a.job);return timeDiff||String(b.issue.issue_id||'').localeCompare(String(a.issue.issue_id||''));
}

let all=[],base=[],selected='all',selectedDept='',expanded=false,page=0,receiverCodes=null,receiverError='',assignmentLoadErrors=0,globalAggregate=null,summaryRequest=0;const pageSize=20;
function bangkokKey(j){const s=String(j.createdDateTime||'');let m=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:''}
function weekKey(v){const d=new Date(v+'T12:00:00+07:00');if(isNaN(+d))return '';const day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day+3);const first=new Date(Date.UTC(d.getUTCFullYear(),0,4));const n=1+Math.round(((d-first)/86400000-3+(first.getUTCDay()+6)%7)/7);return `${d.getUTCFullYear()}-W${String(n).padStart(2,'0')}`}
function periodMatch(j){const type=$('filter').value;if(type==='all')return true;const key=bangkokKey(j);if(!key)return false;if(type==='day')return key===$('day').value;if(type==='week')return weekKey(key)===$('week').value;if(type==='month')return key.slice(0,7)===$('month').value;return key.slice(0,4)===$('year').value}
// Work status is held by the receiving department, not qa_jobs.status.
// OPEN (not yet accepted), IN_PROGRESS, REWORK -> yellow. Only explicit
// requester acceptance (CLOSED) turns the department green.
function groupStatus(v){const s=String(v||'').toUpperCase();if(s==='WAITING_REVIEW')return 'WAITING_REVIEW';if(s==='CLOSED')return 'CLOSED';if(['OPEN','IN_PROGRESS','REWORK','ASSIGNED','PENDING'].includes(s))return 'IN_PROGRESS';return null;}
function enabledAssignments(j){return j.departmentAssignments||[];} // Include historical assignments even if receiver setting was disabled later.
// A countable work item is a unique issue in one department assignment.
// The same issue assigned to two departments represents two separately tracked actions.
function assignmentIssues(a){const found=new Set();return (a.issues||[]).filter(i=>{const key=String(i.issue_id??i.issue_number??'');if(!key||found.has(key))return false;found.add(key);return true;});}
// One issue gets one suffix across every receiving department. The suffix is the
// persisted issue_number, NOT an assignment's position in a viewer-specific list.
function displayIssueCode(j,assignment,issue){
 const key=String(issue.issue_id);
 const shared=j.issueCodes?.get(key);
 return shared||String(j.carCode||j.jobId||'—')+'-'+String(issue.issue_number||1).padStart(2,'0');
}
// Dashboard list: ONE issue_id per row, irrespective of how many departments receive it.
// Chart statistics intentionally continue counting issue x receiving department.
function issueRowsFor(j){
 const byIssue=new Map();
 for(const a of deptAssignments(j))for(const issue of assignmentIssues(a)){
  const key=String(issue.issue_id||issue.issue_number);
  let e=byIssue.get(key);
  if(!e){e={job:j,issue,assignments:[],departments:[],statuses:new Set()};byIssue.set(key,e);}
  e.assignments.push(a);if(!e.departments.includes(a.department))e.departments.push(a.department);
  if(a.chartStatus)e.statuses.add(a.chartStatus);
 }
 return [...byIssue.values()];
}
function entriesFor(j){return deptAssignments(j).flatMap(a=>assignmentIssues(a).map(issue=>({job:j,assignment:a,issue,chartStatus:a.chartStatus,department:a.department})));}
function issueRowStatus(e){const types=[...e.statuses];return types.length===1?types[0]:'MIXED';}

function deptAssignments(j){const p=window.QA?.profile||{}, dept=norm(p.department), scope=$('dashScope').value;const role=String(p.role||'').toLowerCase();let rows=enabledAssignments(j);
 // Lists for ordinary users and department admins contain ONLY assignments received by their department.
 if(role==='user'||role==='department_admin')rows=rows.filter(a=>norm(a.department)===dept);
 if(scope==='received')return rows.filter(a=>norm(a.department)===dept);
 if(scope==='mine'&&norm(j.createdBy)!==norm(p.user_id))return [];
 if(scope==='department_sent'&&norm(j.fromDepartment)!==dept)return [];
 if(scope==='review')return rows.filter(a=>a.chartStatus==='WAITING_REVIEW');
 if(scope==='closed')return rows.filter(a=>a.chartStatus==='CLOSED');
 return rows;
}
function searchMatch(j){const q=norm($('dashSearch').value);return !q||[j.carCode,j.jobId,j.customerName,j.country,j.serialNo,j.fromDepartment,j.toDepartment,j.problemDetail,j.status,j.location,j.category,...(j.departmentAssignments||[]).map(a=>a.department)].some(v=>norm(v).includes(q));}
function recount(rows){const counts={IN_PROGRESS:0,WAITING_REVIEW:0,CLOSED:0};for(const j of rows)for(const e of entriesFor(j))if(e.chartStatus)counts[e.chartStatus]++;return counts;}
function selectedGlobalCounts(){const c={IN_PROGRESS:0,WAITING_REVIEW:0,CLOSED:0};
 for(const row of globalAggregate?.departments||[]){if(c[row.status]!==undefined)c[row.status]+=Number(row.count)||0;}return c;}
function render(){base=all.filter(j=>periodMatch(j)&&searchMatch(j)&&deptAssignments(j).length>0);
 const counts=selectedGlobalCounts();
 $('nTotal').textContent=globalAggregate?Object.values(counts).reduce((a,b)=>a+b,0).toLocaleString('th-TH'):'—';
 $('nProgress').textContent=globalAggregate?counts.IN_PROGRESS.toLocaleString('th-TH'):'—';
 $('nReview').textContent=globalAggregate?counts.WAITING_REVIEW.toLocaleString('th-TH'):'—';
 $('nDone').textContent=globalAggregate?counts.CLOSED.toLocaleString('th-TH'):'—';
 $('period').textContent='';renderCharts(counts);renderRows();}

function matchingAssignments(j){return deptAssignments(j).filter(a=>(selected==='all'||a.chartStatus===selected)&&(!selectedDept||a.department===selectedDept));}
function listStatus(j,matching){const allInScope=deptAssignments(j);const relevant=selected==='all'&&!selectedDept?allInScope:matching;const types=[...new Set(relevant.map(a=>a.chartStatus).filter(Boolean))];if(types.length===1)return types[0];return 'MIXED';}
function listStatusText(j,matching){const st=listStatus(j,matching);if(st==='MIXED')return 'หลายสถานะ';return statuses.find(a=>a[0]===st)?.[1]||'ไม่ระบุ';}
function toggleChartFilter(status='',dept=''){
 selected=(selected===status&&selectedDept===dept)?'all':(status||'all');
 selectedDept=(selected==='all'&&!dept)?'':dept;
 expanded=false;page=0;renderCharts(selectedGlobalCounts());renderRows();
 document.getElementById('listTitle').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function renderCharts(counts){
 const depts=receiverCodes||[];
 const byDept=new Map(depts.map(d=>[d,{IN_PROGRESS:0,WAITING_REVIEW:0,CLOSED:0}]));
 for(const e of globalAggregate?.departments||[]){const x=byDept.get(e.department);if(x&&x[e.status]!==undefined)x[e.status]+=Number(e.count)||0;}
 const max=Math.max(1,...depts.map(d=>Object.values(byDept.get(d)).reduce((x,y)=>x+y,0)));
 const ticks=4;
 $('axis').innerHTML=Array.from({length:ticks+1},(_,i)=>`<span>${Math.round(max*(ticks-i)/ticks)}</span>`).join('');
 $('barLegend').innerHTML=statuses.map(([s,label,color])=>`<button type="button" class="legend-action ${selected===s&&!selectedDept?'selected':''}" data-chart-status="${s}" title="กรอง ${safe(label)}"><i style="background:${color}"></i>${label}</button>`).join('');
 $('plot').innerHTML=depts.length?depts.map(d=>{const cc=byDept.get(d),total=Object.values(cc).reduce((a,b)=>a+b,0);
 const seg=statuses.map(([s,label,color])=>{const n=cc[s]||0;return n?`<button type="button" class="bar-segment ${selected===s&&selectedDept===d?'selected':''}" data-chart-status="${s}" data-chart-dept="${safe(d)}" title="${safe(d)} / ${safe(label)}: ${n} ปัญหา" aria-label="กรอง ${safe(d)} สถานะ ${safe(label)} ${n} ปัญหา" style="background:${color};height:${n/max*178}px"></button>`:''}).join('');return `<div class="bar-item"><button class="bar-total chart-dept" data-chart-dept="${safe(d)}" title="กรองแผนก ${safe(d)}">${total}</button><div class="bar-stack">${seg}</div><button class="bar-label chart-dept" data-chart-dept="${safe(d)}" title="กรองแผนก ${safe(d)}">${safe(d)}</button></div>`}).join(''):`<div class="empty">${safe(receiverError||'ยังไม่ได้เปิดฝ่ายรับเรื่องใน Settings')}</div>`;
 const countTotal=statuses.reduce((sum,[s])=>sum+(counts[s]||0),0);
 let pos=0;const parts=statuses.map(([s,label,color])=>{const n=counts[s]||0,from=pos;pos+=countTotal?n/countTotal*100:0;return {s,label,color,n,from,to:pos}});
 $('donut').style.background=countTotal?`conic-gradient(${parts.filter(p=>p.n).map(p=>`${p.color} ${p.from}% ${p.to}%`).join(',')})`:'#e4e8ef';
 $('donutTotal').textContent=countTotal.toLocaleString('th-TH');
 $('donutLegend').innerHTML=parts.map(p=>`<button type="button" class="legend-row legend-action ${selected===p.s&&!selectedDept?'selected':''}" data-chart-status="${p.s}" title="คลิกเพื่อกรอง ${safe(p.label)}"><span><i class="dot" style="background:${p.color}"></i>${p.label}</span><b>${p.n} (${countTotal?(p.n/countTotal*100).toFixed(1):'0.0'}%)</b></button>`).join('');
 $('donut').dataset.parts=JSON.stringify(parts.filter(p=>p.n).map(({s,from,to})=>({s,from,to})));
 const note=$('chartSelection');if(note)note.textContent='';
}

function renderRows(){
 const label=(selectedDept?selectedDept+' · ':'')+(selected==='all'?'ปัญหาแจ้งล่าสุด':(statuses.find(a=>a[0]===selected)?.[1]||'ปัญหาที่เลือก'));
 $('listTitle').textContent=label+' (ตามสิทธิ์ผู้ใช้)';
 const filtered=base.flatMap(j=>issueRowsFor(j)).filter(e=>(selected==='all'||e.statuses.has(selected))&&(!selectedDept||e.departments.includes(selectedDept)))
 .sort(compareLatestIssueRows);
 const count=expanded?pageSize:6,pageCount=Math.max(1,Math.ceil(filtered.length/count));page=Math.max(0,Math.min(page,pageCount-1));
 const show=filtered.slice(page*count,(page+1)*count);
 $('jobRows').innerHTML=show.length?show.map(e=>{
  const j=e.job,i=e.issue,st=issueRowStatus(e),status=st==='MIXED'?'หลายสถานะ':(statuses.find(a=>a[0]===st)?.[1]||'ไม่ระบุ');
  const baseUrl=window.QA?.jobUrl?.(j.jobId)||'vnext-job.html?id='+encodeURIComponent(j.jobId);
  const url=baseUrl.split('#')[0]+'#issue-'+encodeURIComponent(String(i.issue_id));
  const route=`${j.fromDepartment||'—'} → ${e.departments.join(', ')||'—'}`;
  const problem=`ปัญหา ${i.issue_number??'—'}: ${i.description||j.problemDetail||'—'}`;
  const issueCode=displayIssueCode(j,e.assignments[0],i);
  const profile=window.QA?.profile||{};
  const pendingOwnDepartment=String(profile.role||'').toLowerCase()==='department_admin'&&e.assignments.some(a=>norm(a.department)===norm(profile.department)&&a.rawStatus==='IN_PROGRESS'&&Boolean(a.approvalRequestedAt));
  const headBadge=pendingOwnDepartment?'<span class="head-approval-flag" title="งานของแผนกคุณรอหัวหน้าอนุมัติ">⏳ รอคุณอนุมัติ</span>':'';
  return `<a class="job-row" href="${safe(url)}" title="เปิดปัญหา ${safe(issueCode)}"><span><b>${safe(issueCode)}</b>${headBadge}</span><span title="${safe(j.customerName)}">${safe(j.customerName||'ไม่ระบุ')}</span><span title="${safe(j.serialNo)}">${safe(j.serialNo||'—')}</span><span class="route" title="${safe(route)}">${safe(route)}</span><span title="${safe(problem)}">${safe(problem)}</span><span><i class="pill ${safe(st)}">${safe(status)}</i></span><span>${safe(timeText(j))}</span></a>`;
 }).join(''):'<div class="empty">ไม่พบรายการปัญหา</div>';
 $('viewAll').textContent=expanded?'แสดง 6 ปัญหาล่าสุด':'ดูทั้งหมด ('+filtered.length+')';$('pagination').hidden=!expanded||filtered.length<=pageSize;$('prevPage').disabled=page===0;$('nextPage').disabled=page>=pageCount-1;$('pageInfo').textContent=`หน้า ${page+1} / ${pageCount}`;
 document.querySelectorAll('.stat').forEach(el=>el.classList.toggle('active',el.dataset.status===selected));
}

function updatePeriod(){const v=$('filter').value;for(const k of ['day','week','month','year'])$(k).hidden=k!==v;page=0;render()}
function init(){const p=window.QA?.profile||{};if(['user','department_admin'].includes(String(p.role||'').toLowerCase())){const scope=$('dashScope');scope.value='received';for(const opt of scope.options){if(opt.value!=='received')opt.disabled=true;}scope.title='รายการปัญหาของแผนกที่ได้รับงานเท่านั้น';}$('welcome').textContent=`สวัสดี ${p.display_name||p.email||'ผู้ใช้งาน'} · ${p.department||'ระบบติดตามงาน'} — ยินดีต้อนรับ`;const now=new Date();const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const v=Object.fromEntries(parts.map(x=>[x.type,x.value]));const day=`${v.year}-${v.month}-${v.day}`;$('day').value=day;$('month').value=day.slice(0,7);$('year').value=v.year;$('week').value=weekKey(day);$('filter').addEventListener('change',()=>{updatePeriod();refreshSummary();});document.querySelector('.charts').addEventListener('click',ev=>{const target=ev.target.closest('[data-chart-status],[data-chart-dept]');if(target){toggleChartFilter(target.dataset.chartStatus||'',target.dataset.chartDept||'');return;}const ring=ev.target.closest('#donut');if(!ring||ev.target.closest('.donut-center'))return;const rect=ring.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,dx=ev.clientX-cx,dy=ev.clientY-cy,dist=Math.hypot(dx,dy);if(dist<rect.width*.32||dist>rect.width*.52)return;const angle=(Math.atan2(dx,-dy)*180/Math.PI+360)%360;const part=JSON.parse(ring.dataset.parts||'[]').find(p=>angle>=p.from*3.6&&angle<p.to*3.6);if(part)toggleChartFilter(part.s,'');});['day','week','month','year','dashScope'].forEach(id=>$(id).addEventListener('change',()=>{page=0;render();refreshSummary()}));$('dashSearch').addEventListener('input',()=>{page=0;render()});$('refresh').addEventListener('click',load);document.querySelectorAll('.stat').forEach(el=>el.addEventListener('click',()=>{selected=el.dataset.status;selectedDept='';expanded=false;page=0;renderCharts(recount(base));renderRows()}));$('viewAll').addEventListener('click',()=>{expanded=!expanded;page=0;renderRows()});$('prevPage').addEventListener('click',()=>{page--;renderRows()});$('nextPage').addEventListener('click',()=>{page++;renderRows()});load()}
// The same permission-checked RPC used by the detail page supplies assignment statuses.
// Deliberately fail the Dashboard load if any assignment detail fails; never show false zeros.
async function loadAssignments(jobs){
 const next=jobs.slice(),workers=Array.from({length:Math.min(6,next.length)},async()=>{
  while(next.length){const j=next.shift();const {data,error}=await window.QA.client.rpc('qa_vnext_job_detail',{p_job_id:String(j.jobId)});
   if(error)throw new Error(`${j.jobId}: ${error.message}`);
   if(!data||!Array.isArray(data.assignments)||data.assignments.some(a=>!Array.isArray(a.issues)))throw new Error(`${j.jobId}: API ไม่ส่งข้อมูลปัญหาแยกตามแผนก`);
   j.carCode=String(data.car_code||j.carCode||j.jobId);
   // Stable issue code is built from qa_issue_items.issue_number in qa_vnext_job_detail.
   // Dashboard does not require a second optional RPC merely to render a list.
   j.issueCodes=new Map();
   j.departmentAssignments=data.assignments.map(a=>({department:String(a.department_code||'').trim(),assignmentId:String(a.assignment_id||''),rawStatus:String(a.status||'').toUpperCase(),approvalRequestedAt:a.approval_requested_at||null,chartStatus:groupStatus(a.status),issues:Array.isArray(a.issues)?a.issues:[]}));
  }
 });await Promise.all(workers);
}
function dateRange(){const kind=$('filter').value;
 if(kind==='day')return {from:$('day').value,to:$('day').value};
 if(kind==='month'){const v=$('month').value;if(!/^\d{4}-\d{2}$/.test(v))return {from:null,to:null};const [y,m]=v.split('-').map(Number);return {from:v+'-01',to:new Date(Date.UTC(y,m,0)).toISOString().slice(0,10)};}
 if(kind==='year'){const y=Number($('year').value);return y>=2020&&y<=2100?{from:y+'-01-01',to:y+'-12-31'}:{from:null,to:null};}
 if(kind==='week'){const v=$('week').value,m=/^(\d{4})-W(\d{2})$/.exec(v);if(!m)return {from:null,to:null};const y=+m[1],w=+m[2],d=new Date(Date.UTC(y,0,4));d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7)+7*(w-1));const from=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+6);return {from,to:d.toISOString().slice(0,10)};}
 return {from:null,to:null};}
async function refreshSummary(){const seq=++summaryRequest;const dates=dateRange();
 try{const {data,error}=await window.QA.client.rpc('qa_dashboard_issue_summary',{
  p_scope:['user','department_admin'].includes(String(window.QA?.profile?.role||'').toLowerCase())?'all':$('dashScope').value,p_date_from:dates.from,p_date_to:dates.to});
  if(error)throw error;if(!data||!Array.isArray(data.departments))throw new Error('รูปแบบข้อมูลสถิติไม่ถูกต้อง');
  if(seq!==summaryRequest)return;globalAggregate=data;render();
 }catch(e){if(seq!==summaryRequest)return;globalAggregate=null;render();$('feedback').textContent='โหลดสถิติรวมไม่สำเร็จ: '+String(e?.message||e);}}
async function load(){
 $('feedback').textContent='กำลังโหลดสถิติรวมและรายการงานที่มีสิทธิ์ดู...';
 globalAggregate=null;
 try{
   const {data,error}=await window.QA.client.rpc('qa_vnext_receivers',{});if(error)throw error;
   if(!Array.isArray(data))throw new Error('Invalid receiver settings response');
   receiverCodes=[...new Set(data.filter(x=>x.enabled===true).map(x=>String(x.code||'').trim()).filter(Boolean))];receiverError='';
   await refreshSummary();
   // Read from an authenticated SECURITY DEFINER RPC that enforces receiving-department
   // access at the database. qa_search is owner-oriented and misses coworker-created jobs.
   const profile=window.QA?.profile||{};
   const {data:rows,error:listError}=await window.QA.client.rpc('qa_dashboard_department_issue_list');
   if(listError)throw new Error('รายการแผนก: '+listError.message);
   if(!Array.isArray(rows))throw new Error('รูปแบบรายการแผนกไม่ถูกต้อง');
   const localRole=['user','department_admin'].includes(String(profile.role||'').toLowerCase());
   const department=norm(profile.department);
   if(localRole&&!department)throw new Error('บัญชีผู้ใช้ยังไม่ได้กำหนดแผนก');
   all=rows.map(r=>({
     jobId:String(r.job_id||''),carCode:String(r.car_code||r.job_id||''),
     customerName:String(r.customer_name||''),country:String(r.country||''),
     serialNo:String(r.serial_no||''),fromDepartment:String(r.from_department||''),
     createdDateTime:String(r.created_at||''),issueCodes:new Map(),
     departmentAssignments:(r.assignments||[]).filter(a=>!localRole||norm(a.department_code)===department)
       .map(a=>({department:String(a.department_code||''),assignmentId:String(a.assignment_id||''),
          rawStatus:String(a.status||'').toUpperCase(),approvalRequestedAt:a.approval_requested_at||null,
          chartStatus:groupStatus(a.status),issues:Array.isArray(a.issues)?a.issues:[]}))
   })).filter(j=>j.departmentAssignments.length>0).sort((a,b)=>dt(b)-dt(a));
   page=0;render();
   $('feedback').textContent=`รายการที่มีสิทธิ์เข้าถึง ${all.reduce((n,j)=>n+issueRowsFor(j).length,0)} ปัญหา`;
 }catch(e){all=[];base=[];receiverError=String(e?.message||e);render();
   $('feedback').textContent='โหลดรายการที่มีสิทธิ์ดูไม่สำเร็จ: '+receiverError;
 }
}

if(!window.QA?.run){document.addEventListener('DOMContentLoaded',()=>{$('feedback').textContent='ไม่พบระบบ API กรุณาตรวจสอบ config.js และ supabase-api.js'});}else document.addEventListener('DOMContentLoaded',()=>{window.QA.run.withSuccessHandler(init).withFailureHandler(e=>{$('feedback').textContent=e?.message||String(e)}).getSettings()});
})();
