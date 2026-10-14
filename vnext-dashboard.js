(()=>{'use strict';const $=id=>document.getElementById(id);let rows=[],lastLabel='ทั้งหมด',dashboardRequestId=0;
const colors=['#F59E0B','#3B82F6','#16A34A'];
const num=v=>Number(v)||0;
async function rpc(name,args){const {data,error}=await QA.client.rpc(name,args);if(error)throw error;return data;}
function dateStr(d){return d.toISOString().slice(0,10);}
function bangkokNow(){return new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Bangkok'}));}
function initFilter(){const d=bangkokNow(),iso=dateStr(new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())));$('day').value=iso;$('month').value=iso.slice(0,7);$('year').value=d.getFullYear();
 const utc=new Date(iso+'T00:00:00Z');const wd=utc.getUTCDay()||7;utc.setUTCDate(utc.getUTCDate()+4-wd);
 const jan=new Date(Date.UTC(utc.getUTCFullYear(),0,1));const wk=Math.ceil((((utc-jan)/86400000)+1)/7);
 $('week').value=`${utc.getUTCFullYear()}-W${String(wk).padStart(2,'0')}`;
 $('filter').onchange=()=>{toggle();closeResults();};toggle();$('refresh').onclick=refresh;
 for(const id of ['day','week','month','year'])$(id).addEventListener('change',closeResults);
 document.querySelectorAll('.filter-card').forEach(el=>{const activate=()=>toggleResults('',el.dataset.status);el.addEventListener('click',activate);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}})});
 $('closeFiltered').onclick=closeResults;const exportBtn=$('exportExcel');if(exportBtn){exportBtn.hidden=!['system_admin','department_admin'].includes(QA.profile?.role);exportBtn.onclick=exportExcel;}}
function toggle(){for(const id of ['week','day','month','year'])$(id).hidden=id!==$('filter').value;}
function range(){const mode=$('filter').value;
 if(mode==='all')return null;
 let start,end;
 if(mode==='day'){const s=$('day').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw new Error('เลือกวันที่');start=new Date(s+'T00:00:00Z');end=new Date(start);end.setUTCDate(end.getUTCDate()+1);lastLabel='วันที่ '+s;}
 if(mode==='week'){const m=/^(\d{4})-W(\d{2})$/.exec($('week').value);if(!m)throw new Error('เลือกสัปดาห์');
 start=new Date(Date.UTC(+m[1],0,4));const dow=start.getUTCDay()||7;start.setUTCDate(start.getUTCDate()-dow+1+(+m[2]-1)*7);
 end=new Date(start);end.setUTCDate(start.getUTCDate()+7);lastLabel='สัปดาห์ '+dateStr(start)+' ถึง '+dateStr(new Date(end.getTime()-86400000));}
 if(mode==='month'){const m=/^(\d{4})-(\d{2})$/.exec($('month').value);if(!m)throw new Error('เลือกเดือน');start=new Date(Date.UTC(+m[1],+m[2]-1,1));end=new Date(Date.UTC(+m[1],+m[2],1));lastLabel='เดือน '+$('month').value;}
 if(mode==='year'){const y=+$('year').value;if(y<2020||y>2100)throw new Error('ปีไม่ถูกต้อง');start=new Date(Date.UTC(y,0,1));end=new Date(Date.UTC(y+1,0,1));lastLabel='ปี '+y;}
 // Endpoints interpret Thailand local midnight, not browser/UTC local midnight.
 function offset(d){return dateStr(d)+'T00:00:00+07:00';}
 return {p_start:offset(start),p_end:offset(end)};}
async function refresh(){
 const requestId=++dashboardRequestId;
 try{
  $('feedback').textContent='กำลังโหลดข้อมูล...';$('feedback').className='';
  const args=range();let label,data;
  if(!args){label='ทั้งหมด ณ '+new Date().toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});data=await rpc('qa_vnext_all_time_summary',{});}
  else{label=lastLabel;data=await rpc('qa_vnext_period_summary',args);}
  if(requestId!==dashboardRequestId)return;
  if(!Array.isArray(data))throw new Error('Dashboard data invalid');
  closeResults();rows=data;lastLabel=label;$('period').textContent=label;render();const exportBtn=$('exportExcel');if(exportBtn)exportBtn.disabled=false;
  $('feedback').textContent='ข้อมูลจาก Supabase · นับหนึ่งเลขงานต่อหนึ่งฝ่ายรับเรื่อง · ไม่รวมงานยกเลิก';
 }catch(e){if(requestId!==dashboardRequestId)return;
  rows=[];closeResults();$('period').textContent='ไม่สามารถโหลดข้อมูล';for(const id of ['nTotal','nProgress','nReview','nDone'])$(id).textContent='—';$('plot').replaceChildren();$('axis').replaceChildren();const exportBtn=$('exportExcel');if(exportBtn)exportBtn.disabled=true;
  $('feedback').textContent='โหลด Dashboard ไม่สำเร็จ: '+e.message;$('feedback').className='warning';}
}
function render(){const sum=key=>rows.reduce((a,r)=>a+num(r[key]),0);
 $('nTotal').textContent=sum('total').toLocaleString();$('nProgress').textContent=sum('in_progress').toLocaleString();$('nReview').textContent=sum('waiting_review').toLocaleString();$('nDone').textContent=sum('completed').toLocaleString();
 const plot=$('plot'),axis=$('axis');plot.replaceChildren();axis.replaceChildren();const top=Math.max(1,...rows.map(r=>num(r.total)));const max=Math.max(5,Math.ceil(top/5)*5);
 for(let t=4;t>=0;t--){const el=document.createElement('span');el.textContent=Math.round(max*t/4);axis.append(el);}
 if(!rows.length){plot.textContent='ยังไม่ได้กำหนดฝ่ายรับเรื่องใน Settings';return;}
 for(const r of rows){const item=document.createElement('div');item.className='item';const values=[num(r.in_progress),num(r.waiting_review),num(r.completed)],total=num(r.total);
 const totals=document.createElement('div');totals.className='total';totals.textContent=total||'0';
 const column=document.createElement('div');column.className='columns';column.style.height=(280*total/max)+'px';
 values.forEach((n,i)=>{if(n===0)return;const segment=document.createElement('div');segment.className='segment';segment.style.background=colors[i];segment.style.flex=n;segment.tabIndex=0;segment.setAttribute('role','button');segment.title=n+' งาน · คลิกแสดงรายการ';segment.textContent=n;const status=['IN_PROGRESS','WAITING_REVIEW','CLOSED'][i];const code=r.department_code;segment.onclick=()=>toggleResults(code,status);segment.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleResults(code,status)}};column.append(segment);});
 const label=document.createElement('div');label.className='dept';label.textContent=r.department_name||r.department_code;
 item.append(totals,column,label);plot.append(item);}}
function draw(){const data=rows,canvas=document.createElement('canvas');const width=Math.max(1080,180+data.length*140),height=760,scale=2;canvas.width=width*scale;canvas.height=height*scale;
 const c=canvas.getContext('2d');c.scale(scale,scale);c.fillStyle='#fff';c.fillRect(0,0,width,height);c.fillStyle='#172337';c.font='bold 28px Arial';c.fillText('Complain Dashboard',36,51);c.font='16px Arial';c.fillStyle='#526277';c.fillText(lastLabel,36,82);
 const labels=['งานทั้งหมด','กำลังดำเนินงาน','รอตรวจสอบ','สำเร็จ'],keys=['total','in_progress','waiting_review','completed'];
 keys.forEach((key,i)=>{const x=36+i*(width-72)/4,w=(width-72)/4-12;c.fillStyle='#f1f5f9';c.fillRect(x,110,w,116);c.fillStyle='#172337';c.font='15px Arial';c.fillText(labels[i],x+13,138);c.font='bold 36px Arial';c.fillText(String(data.reduce((a,r)=>a+num(r[key]),0)),x+13,193);});
 c.font='bold 23px Arial';c.fillStyle='#172337';c.fillText('จำนวนงานแยกตามฝ่ายรับเรื่อง',36,278);
 let lx=36;['กำลังดำเนินงาน','รอตรวจสอบ','สำเร็จ'].forEach((label,i)=>{c.fillStyle=colors[i];c.fillRect(lx,302,13,13);c.fillStyle='#344054';c.font='14px Arial';c.fillText(label,lx+18,314);lx+=155;});
 const left=80,top=350,base=672,chartW=width-120,max=Math.max(5,Math.ceil(Math.max(1,...data.map(r=>num(r.total)))/5)*5);
 for(let i=0;i<=4;i++){const y=base-(base-top)*i/4;c.strokeStyle='#e3e8ed';c.beginPath();c.moveTo(left,y);c.lineTo(width-32,y);c.stroke();c.fillStyle='#64748b';c.fillText(String(Math.round(max*i/4)),30,y+5);}
 data.forEach((r,i)=>{const bw=Math.min(75,chartW/(Math.max(1,data.length)*1.7)),x=left+(i+.5)*chartW/data.length-bw/2;
 let y=base;[num(r.in_progress),num(r.waiting_review),num(r.completed)].forEach((v,j)=>{if(!v)return;const h=(base-top)*v/max;y-=h;c.fillStyle=colors[j];c.fillRect(x,y,bw,h);if(h>=18){c.fillStyle='#fff';c.font='bold 14px Arial';c.textAlign='center';c.fillText(String(v),x+bw/2,y+h/2+5);c.textAlign='left';}});
 c.fillStyle='#172337';c.font='bold 14px Arial';c.textAlign='center';c.fillText(String(num(r.total)),x+bw/2,y-8);
 c.font='13px Arial';c.fillText(String(r.department_name||r.department_code).slice(0,20),x+bw/2,base+27);c.textAlign='left';});
 c.fillStyle='#64748b';c.font='12px Arial';c.fillText('งานทั้งหมด ณ เวลาที่สร้างรายงาน · จำนวนหนึ่งงานต่อหนึ่งฝ่ายรับเรื่อง',36,737);return canvas;}
let activeFilter=null,resultsRequestId=0;
function closeResults(){resultsRequestId++;activeFilter=null;const pane=$('filtered');if(pane)pane.hidden=true;document.querySelectorAll('.filter-card').forEach(x=>x.classList.remove('active'));}
function normStatus(v){const s=String(v||'').toUpperCase();return ['OPEN','IN_PROGRESS','REWORK'].includes(s)?'IN_PROGRESS':s;}
function withinPeriod(iso){const bounds=range();if(!bounds)return true;const millis=Date.parse(iso);return Number.isFinite(millis)&&millis>=Date.parse(bounds.p_start)&&millis<Date.parse(bounds.p_end);}
async function toggleResults(dept,status){const key=dept+'|'+status;if(activeFilter===key){closeResults();return}activeFilter=key;const requestId=++resultsRequestId;
 const pane=$('filtered');pane.hidden=false;$('filteredTitle').textContent=(dept?dept+' · ':'')+({all:'งานทั้งหมด',IN_PROGRESS:'กำลังดำเนินการ',WAITING_REVIEW:'รอตรวจสอบ',CLOSED:'สำเร็จ'}[status]||status);
 document.querySelectorAll('.filter-card').forEach(x=>x.classList.toggle('active',!dept&&x.dataset.status===status));
 const box=$('filteredResults');box.replaceChildren();box.textContent='กำลังค้นหา...';
 try{
  const scope=QA.profile.role==='system_admin'||QA.profile.role==='viewer'?'all':'received';
  const [legacy,vnext]=await Promise.allSettled([QA.api.getWorklist(scope,''),rpc('qa_vnext_worklist',{p_scope:scope,p_query:''})]);
  if(legacy.status==='rejected'||vnext.status==='rejected')throw new Error('โหลดรายการจากฐานข้อมูลไม่ครบ กรุณาลองใหม่');
  if(!Array.isArray(legacy.value?.jobs)||!Array.isArray(vnext.value))throw new Error('รูปแบบข้อมูลรายการใบงานไม่ถูกต้อง');
  const a=legacy.value.jobs;const b=vnext.value;
  const ids=new Set(b.map(x=>x.jobId));const all=[...a.filter(x=>!ids.has(x.jobId)),...b];
  const filtered=all.filter(x=>(!dept||String(x.toDepartment||'').split(/[;,|]/).map(s=>s.trim()).includes(dept))&&(status==='all'||normStatus(x.status)===status)&&withinPeriod(x.createdDateTime||x.created_at));
  if(requestId!==resultsRequestId)return;
  box.replaceChildren();if(!filtered.length){box.innerHTML='<div class="filtered-empty">ไม่พบใบงานในเงื่อนไขนี้</div>';return}
  for(const j of filtered){const a=document.createElement('a');a.className='filtered-card';a.href=j.vnext?'vnext-job.html?id='+encodeURIComponent(j.jobId):QA.jobUrl(j.jobId);
   const left=document.createElement('span');const strong=document.createElement('strong');strong.textContent=j.carCode||j.jobId;const sub=document.createElement('small');sub.style.display='block';sub.textContent=(j.fromDepartment||'-')+' → '+(j.toDepartment||'-');left.append(strong,sub);
   const right=document.createElement('span');right.style.textAlign='right';right.textContent=({OPEN:'กำลังดำเนินการ',IN_PROGRESS:'กำลังดำเนินการ',REWORK:'กำลังดำเนินการ',WAITING_REVIEW:'รอตรวจสอบ',CLOSED:'สำเร็จ'}[j.status]||j.status);const date=document.createElement('small');date.style.display='block';date.textContent=j.createdDateTime||'';right.append(date);a.append(left,right);box.append(a);}
  if(a.length>=200||b.length>=1000){const note=document.createElement('p');note.className='filtered-empty';note.textContent='แสดงรายการได้ไม่ครบทั้งหมด เนื่องจากข้อจำกัดจำนวนข้อมูลใน API';box.append(note)}
 }catch(e){if(requestId===resultsRequestId)box.textContent='ค้นหารายการไม่สำเร็จ: '+e.message}
}
// Retain V37 administrator Excel export; use the currently selected dashboard period.
async function exportExcel(){
 if(!['system_admin','department_admin'].includes(QA.profile?.role)){alert('ไม่มีสิทธิ์ Export ข้อมูล Dashboard');return;}
 if(!window.XLSX){alert('โหลด Excel library ไม่สำเร็จ กรุณารีเฟรชหน้า');return;}
 const btn=$('exportExcel');btn.disabled=true;
 try{
  const bounds=range();const now=new Date();
  const start=bounds?.p_start||'2000-01-01T00:00:00+07:00';
  const end=bounds?.p_end||new Date(now.getTime()+86400000).toISOString();
  const detail=await rpc('qa_dashboard_export',{p_start:start,p_end:end});
  if(!Array.isArray(detail))throw new Error('ข้อมูล Excel ไม่ถูกต้อง');
  const summary=[{หัวข้อ:'ช่วงเวลา',จำนวน:lastLabel},
   {หัวข้อ:'งานทั้งหมด',จำนวน:rows.reduce((a,r)=>a+num(r.total),0)},
   {หัวข้อ:'กำลังดำเนินการ',จำนวน:rows.reduce((a,r)=>a+num(r.in_progress),0)},
   {หัวข้อ:'รอตรวจสอบ',จำนวน:rows.reduce((a,r)=>a+num(r.waiting_review),0)},
   {หัวข้อ:'สำเร็จ',จำนวน:rows.reduce((a,r)=>a+num(r.completed),0)}];
  for(const r of rows)summary.push({หัวข้อ:'ฝ่ายรับเรื่อง '+(r.department_name||r.department_code),จำนวน:num(r.total)});
  const fmt=v=>{if(!v)return'';try{return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(v)).replace(',','')}catch{return String(v)}};
  const jobs=detail.map(r=>({
   'เลขใบงาน':r.job_id||'', 'วันที่แจ้ง':fmt(r.created_at),'สถานะ':r.status||'',
   'แผนกผู้แจ้ง':r.from_department||'', 'แผนกรับเรื่อง':r.to_department||'',
   'ผู้แจ้ง':r.requester||'', 'หมวดปัญหา':r.category||'', 'รายละเอียดปัญหา':r.problem_detail||'',
   'สถานที่':r.location||'', 'ผลกระทบ':r.impact||'',
   'ผู้รับงาน':r.accepted_by_name||'', 'วันที่รับงาน':fmt(r.accepted_at),
   'การแก้ไข':r.corrective_action||'', 'การป้องกัน':r.preventive_action||'',
   'วันที่เสร็จ':fmt(r.closed_at), 'แก้ไขล่าสุด':fmt(r.updated_at),
   'จำนวนไฟล์แนบ':Number(r.attachment_count||0),'ลิงก์ใบงาน':r.job_id?QA.jobUrl(r.job_id):''
  }));
  const book=XLSX.utils.book_new();
  const sheet1=XLSX.utils.json_to_sheet(summary),sheet2=XLSX.utils.json_to_sheet(jobs.length?jobs:[{'ไม่มีข้อมูล':''}]);
  sheet1['!cols']=[{wch:32},{wch:24}];sheet2['!cols']=Array.from({length:18},(_,i)=>({wch:i===8?50:23}));
  XLSX.utils.book_append_sheet(book,sheet1,'Summary');XLSX.utils.book_append_sheet(book,sheet2,'Job Data');
  const label=$('filter').value+'_'+new Date().toISOString().slice(0,10);
  XLSX.writeFile(book,'Complain_Action_Dashboard_'+label+'.xlsx');
 }catch(e){alert('Export Excel ไม่สำเร็จ: '+(e?.message||String(e)))}finally{btn.disabled=false;}
}
// Expose the same canvas renderer for optional authenticated image reporting.
window.QAVNextDashboard={renderCanvas:draw};
async function boot(){for(let i=0;i<160&&!QA.profile;i++)await new Promise(r=>setTimeout(r,100));if(!QA.profile){$('feedback').textContent='กรุณาเข้าสู่ระบบ';return;}initFilter();await refresh();}
boot();
})();
