(()=>{'use strict';const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const jobId=new URLSearchParams(location.search).get('id')||new URLSearchParams(location.search).get('job');let detail,media=[];let categoryNames=new Map();let receivingDepartments=[];let completedRounds=new Map();
async function loadCategoryNames(){const {data,error}=await QA.client.from('qa_settings').select('code,name').eq('setting_type','CATEGORY').range(0,999);if(error)throw error;categoryNames=new Map((data||[]).map(x=>[String(x.code),String(x.name||'')]));}
function categoryName(code){const key=String(code||'');return categoryNames.get(key)||'ไม่พบชื่อประเภทปัญหา';}
const setNote=(s,bad=false)=>{$('feedback').textContent=s;$('feedback').style.color=bad?'#b91c1c':'#166534';};
async function rpc(name,args){const {data,error}=await QA.client.rpc(name,args);if(error)throw error;return data;}
function label(s){return ({OPEN:'รอรับงาน',IN_PROGRESS:'กำลังดำเนินงาน',WAITING_REVIEW:'รอตรวจสอบ',CLOSED:'สำเร็จ',REWORK:'กำลังดำเนินงาน',CANCELLED:'ยกเลิก'})[s]||s;}
async function getUrl(path,download=false){const opts=download?{download:true}:undefined;const {data,error}=await QA.client.storage.from('qa-vnext-media').createSignedUrl(path,900,opts);if(error)throw error;return data.signedUrl;}
async function mediaFor(issueIds,assignmentId,canEdit=false){const permitted=media.filter(m=>(m.scope==='ISSUE'&&issueIds.includes(m.issue_id))||(m.scope==='ASSIGNMENT'&&m.assignment_id===assignmentId));
 if(!permitted.length)return '<p class="muted">ไม่มีไฟล์แนบ</p>';
 const cards=await Promise.all(permitted.map(async m=>{try{const view=await getUrl(m.storage_path),download=await getUrl(m.storage_path,true);
 const preview=m.kind==='IMAGE'?`<img src="${esc(view)}" alt="ภาพประกอบ">`:`<video controls preload="metadata" src="${esc(view)}"></video>`;
 const note=canEdit?`<label>หมายเหตุ<textarea class="media-note-input" data-attachment="${esc(m.attachment_id)}" maxlength="2000">${esc(m.note||'')}</textarea></label><button type="button" class="media-note-save" data-attachment="${esc(m.attachment_id)}">บันทึกหมายเหตุ</button>`:`<p class="media-note">${esc(m.note||'')}</p>`;
 return `<div class="media-item">${preview}${note}<a href="${esc(download)}" download target="_blank" rel="noopener">ดาวน์โหลด</a></div>`;
 }catch(e){return `<div class="media-item">ไม่สามารถสร้างลิงก์ไฟล์ได้: ${esc(e.message)}</div>`;}}));return `<div class="media">${cards.join('')}</div>`;}

// V49.7: one screenshot per persisted receiver-change event. The server selects
// the destination by qa_jobs.source_type, never by a client-supplied group.
async function ensureHtml2Canvas(){if(window.html2canvas)return;
 await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('โหลดเครื่องมือสร้างภาพไม่สำเร็จ'));document.head.append(s);});}
async function receiverChangePng(ev){await ensureHtml2Canvas();
 const issue=(detail.assignments||[]).flatMap(a=>a.issues||[]).find(i=>i.issue_id===ev.issue_id);
 const escField=(key,val)=>`<div style="display:flex;gap:12px;margin:8px 0"><b style="min-width:180px">${esc(key)}</b><span style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(val||'-')}</span></div>`;
 const host=document.createElement('div');host.style.cssText='position:absolute;left:0;top:0;width:900px;background:#fff;padding:38px 42px;font:19px Arial,Tahoma,sans-serif;line-height:1.6;color:#15233b;z-index:999999';
 host.innerHTML=`<h1 style="font-size:28px;margin:0 0 8px">Complain &amp; Action Tracking</h1><h2 style="font-size:24px;color:#b45309;margin:0 0 18px">${esc(ev.confirm_original?'ยืนยันฝ่ายรับเรื่องเดิม':'แจ้งแก้ไขแผนกรับผิดชอบ')}</h2>
 <section style="border:1px solid #cbd5e1;border-radius:12px;padding:22px">
 ${escField('เลขปัญหา',String(detail.car_code||jobId)+'-'+String(ev.issue_number||issue?.issue_number||1).padStart(2,'0'))}
 ${escField('เลขใบงาน',detail.car_code||jobId)}${escField('ประเภทงาน',detail.source_type)}
 ${escField('Serial Number',detail.serial_no)}${escField('ลูกค้า',detail.customer_name)}
 ${escField('ประเทศ',detail.country)}${escField('ฝ่ายผู้แจ้ง',detail.from_department)}
 ${escField('Category',categoryName(issue?.category_code))}
 ${escField('รายละเอียดปัญหา',issue?.description)}
 ${escField('ฝ่ายรับเรื่องเดิม',(ev.old_departments||[]).join(', '))}
 ${escField('ฝ่ายรับเรื่องใหม่',(ev.new_departments||[]).join(', '))}
 </section><div style="margin-top:16px;font-size:16px;color:#475569">นี่เป็นการแก้ไขใบแจ้งเดิม ไม่ใช่ใบงานใหม่</div>`;
 document.body.append(host);try{const canvas=await html2canvas(host,{scale:1,backgroundColor:'#fff',logging:false});return canvas.toDataURL('image/png').split(',')[1];}finally{host.remove();}
}
function receiverChangeRetryButton(ev){let b=document.getElementById('retryReceiverLine');
 if(!b){b=document.createElement('button');b.id='retryReceiverLine';b.type='button';b.className='secondary';$('feedback').insertAdjacentElement('afterend',b);}
 b.textContent='ส่ง LINE แจ้งแก้ไขอีกครั้ง';b.onclick=()=>notifyReceiverChange(ev);b.hidden=false;
}
async function notifyReceiverChange(ev){
 const btn=document.getElementById('retryReceiverLine');if(btn)btn.hidden=true;
 try{setNote('บันทึกการเปลี่ยนแผนกแล้ว กำลังส่งภาพแจ้ง LINE...');
  const png=await receiverChangePng(ev);
  const {data,error}=await QA.client.functions.invoke('vnext-receiver-change-line',{body:{event_id:ev.event_id,png_base64:png}});
  if(error)throw new Error(error.message||String(error));
  if(data?.error)throw new Error(data.error);
  if(data?.skipped)throw new Error(data.reason||'ยังไม่ตั้งค่ากลุ่ม LINE');
  if(!data?.sent)throw new Error('LINE ไม่ยืนยันการส่ง');
  sessionStorage.removeItem('qa-v49-pending-line:'+jobId);
  setNote(data.already_sent?'เปลี่ยนแผนกสำเร็จ และ LINE เหตุการณ์นี้ส่งไปแล้ว':'เปลี่ยนแผนกสำเร็จ และส่งภาพแจ้งแก้ไขเข้า LINE แล้ว');
 }catch(e){setNote('เปลี่ยนแผนกใน Supabase สำเร็จแล้ว แต่ LINE ยังไม่สำเร็จ: '+e.message,true);receiverChangeRetryButton(ev);}
}

async function render(){if(!jobId){setNote('ไม่พบหมายเลขงาน',true);return;}
 try{await loadCategoryNames();detail=await rpc('qa_vnext_job_detail',{p_job_id:jobId});media=await rpc('qa_vnext_media_list',{p_job_id:jobId});
 // Correction history is supplementary. An error here must never hide a job the user can otherwise read.
 let archived=[];let roundLoadWarning='';
 try{archived=await rpc('qa_v51_assignment_rounds',{p_job_id:jobId});}
 catch(roundError){roundLoadWarning='โหลดประวัติการแก้ไขไม่สำเร็จ: '+(roundError?.message||String(roundError));console.warn('Correction rounds unavailable:',roundError);}
 completedRounds=new Map();for(const row of (Array.isArray(archived)?archived:[])){const key=String(row.assignment_id);if(!completedRounds.has(key))completedRounds.set(key,[]);completedRounds.get(key).push(row);}
 if(roundLoadWarning)setNote(roundLoadWarning,true);
 detail.assignments=(detail.assignments||[]).filter(a=>(a.issues||[]).length>0);
 if(!Array.isArray(media))media=[];
 const pendingUnrelated=(detail.assignments||[]).filter(a=>a.unrelated_requested_at && ['OPEN','IN_PROGRESS','CANCELLED'].includes(a.status));
 const canResolveUnrelated=Boolean(detail.is_requester||QA.profile?.role==='system_admin')&&pendingUnrelated.length>0;
 if(detail.can_manage_issues||canResolveUnrelated){try{const rec=await rpc('qa_vnext_receivers',{});receivingDepartments=Array.isArray(rec)?rec.map(x=>({code:String(x.department_code||x.code||''),enabled:x.enabled!==false})).filter(x=>x.code&&x.enabled):[];}catch(_e){receivingDepartments=[];}}
 const editBtn=$('editRequestBtn');if(editBtn){editBtn.hidden=!(detail.can_manage_issues||canResolveUnrelated);editBtn.textContent=canResolveUnrelated?'จัดการงานไม่เกี่ยวข้อง':'แก้ไขใบแจ้ง';editBtn.onclick=()=>{const pending=document.querySelector('.unrelated-decision');if(canResolveUnrelated&&pending){pending.scrollIntoView({behavior:'smooth',block:'center'});pending.classList.add('issue-dept-highlight');return;}document.querySelectorAll('.issue-edit-controls').forEach(x=>x.hidden=false);const target=document.querySelector('.issue-edit-controls, .issue-reassign');if(target)target.scrollIntoView({behavior:'smooth',block:'center'});else setNote('งานนี้ไม่อยู่ในช่วงที่สามารถแก้ไขใบแจ้งได้',true);};}
 const pendingLine=sessionStorage.getItem('qa-v49-pending-line:'+jobId);if(pendingLine){try{receiverChangeRetryButton(JSON.parse(pendingLine));}catch(_e){sessionStorage.removeItem('qa-v49-pending-line:'+jobId);}}
 const warning=sessionStorage.getItem('qa-v38-line-warning:'+jobId);if(warning){setNote('บันทึกใบงานแล้ว แต่แจ้งเตือน LINE ไม่สำเร็จ: '+warning,true);sessionStorage.removeItem('qa-v38-line-warning:'+jobId);}
 $('details').innerHTML=`<h2>ข้อมูลการแจ้งเรื่อง</h2><div class="job-general-grid">
 <div class="job-general-field"><span class="job-general-label">ประเภทงาน:</span><span class="job-general-value">${esc(detail.source_type||'-')}</span></div>
 <div class="job-general-field"><span class="job-general-label">Serial Number:</span><span class="job-general-value">${esc(detail.serial_no||'-')}</span></div>
 <div class="job-general-field"><span class="job-general-label">ฝ่ายผู้แจ้ง:</span><span class="job-general-value">${esc(detail.from_department||'-')}</span></div>
 <div class="job-general-field"><span class="job-general-label">Customer Name:</span><span class="job-general-value">${esc(detail.customer_name||'-')}</span></div>
 <div class="job-general-field"><span class="job-general-label">Country:</span><span class="job-general-value">${esc(detail.country||'-')}</span></div>
 <div class="job-general-field job-general-wide"><span class="job-general-label">Remark:</span><span class="job-general-value">${esc(detail.requester_remark||'-')}</span></div>
 <div class="job-general-field job-general-wide job-general-date"><span class="job-general-label">วันที่สร้าง:</span><span class="job-general-value">${esc(detail.created_at?new Date(detail.created_at).toLocaleString('th-TH'):'-')}</span></div>
 </div>`;
 const list=$('assignments');list.replaceChildren();
 if(!detail.assignments?.length){list.innerHTML='<section class="sheet">ใบงานนี้ยังไม่มีรายละเอียดฝ่ายรับเรื่อง</section>';return;}
 // Section 2 is one permanent container. Every issue remains visible in order.
 const issueSheet=document.createElement('section');issueSheet.className='sheet issues-section';issueSheet.id='allIssues';
 issueSheet.innerHTML='<h2>2. รายละเอียดปัญหา</h2><div id="allIssueCards"></div>';
 list.append(issueSheet);
 const issueHost=issueSheet.querySelector('#allIssueCards');
 // Source of truth for issue display codes is one secured RPC, not each user's visible subset.
 const codeRows=await rpc('qa_issue_display_codes',{p_job_id:jobId});
 if(!Array.isArray(codeRows))throw new Error('ไม่พบข้อมูลเลขอ้างอิงปัญหา');
 const issueCodes=new Map(codeRows.map(x=>[String(x.assignment_id)+':'+String(x.issue_id),String(x.display_code)]));
 // Shared issue number: multiple departments must show exactly the same code.
 const issueCodeFor=(a,i)=>String(detail.car_code||detail.job_id)+'-'+String(i.issue_number||1).padStart(2,'0');
 const displayedIssues=new Set();
 for(const a of detail.assignments){
  const issueEditable=Boolean(detail.can_manage_issues);
  const deptGroup=document.createElement('div');deptGroup.className='issue-department-group';
  deptGroup.dataset.departmentCode=a.department_code;
  deptGroup.dataset.assignment=a.assignment_id;
  deptGroup.id='issue-dept-'+encodeURIComponent(a.assignment_id);
  const issueItems=[...(a.issues||[])].sort((x,y)=>Number(x.issue_number)-Number(y.issue_number));
  const cards=[];
  for(const i of issueItems){
   // An issue can be assigned to multiple departments. Show it in each department group,
   // so the flow button consistently takes the user to that department's issues.
   const uniqueKey=String(a.assignment_id)+':'+String(i.issue_id);
   if(displayedIssues.has(uniqueKey))continue;
   displayedIssues.add(uniqueKey);
   const pendingHere=(detail.is_requester||QA.profile?.role==='system_admin')&&a.unrelated_requested_at&&['OPEN','IN_PROGRESS','CANCELLED'].includes(a.status);
   const decision=pendingHere?`<div class="no-print unrelated-decision" data-issue-id="${esc(i.issue_id)}" data-assignment-id="${esc(a.assignment_id)}" data-version="${esc(a.version)}"><h4>↩ แผนกรับเรื่องแจ้งว่าไม่เกี่ยวข้อง</h4><p class="unrelated-explanation">แผนก ${esc(a.department_code)} แจ้งเหตุผล: ${esc(a.unrelated_reason||'-')}</p><p>เลือกดำเนินการอย่างใดอย่างหนึ่ง (เลข CAR และเลขปัญหาเดิมไม่เปลี่ยน)</p><div class="unrelated-decision-buttons"><button type="button" class="unrelated-change-toggle">แก้ไขฝ่ายรับงาน</button><button type="button" class="unrelated-keep-original secondary">ยืนยันฝ่ายรับงานเดิม</button></div><div class="unrelated-change-form" hidden><b>เลือกฝ่ายรับงานใหม่</b><div class="receiver-checkboxes">${receivingDepartments.map(d=>`<label style="display:inline-flex;gap:6px;margin:6px 14px 6px 0"><input type="checkbox" value="${esc(d.code)}" ${detail.assignments.some(a2=>a2.department_code===d.code&&(a2.issues||[]).some(x=>x.issue_id===i.issue_id))?'checked':''}>${esc(d.code)}</label>`).join('')}</div><p class="muted">เมื่อบันทึก ระบบจะส่งภาพแจ้งแก้ไขฝ่ายรับงานไปยัง LINE กลุ่มเดิม (${esc(detail.source_type)}) โดยอัตโนมัติ</p><button type="button" class="unrelated-change-save">ยืนยันแก้ฝ่ายรับงานและส่ง LINE</button></div></div>`:'';
   cards.push(`<article class="issue issue-card id="issue-${esc(i.issue_id)}" data-issue-id="${esc(i.issue_id)}"><h3><span class="issue-code">${esc(issueCodeFor(a,i))}</span> · ปัญหา ${esc(i.issue_number)} <span class="issue-category">${esc(categoryName(i.category_code))}</span></h3><p>${esc(i.description)}</p>${issueEditable?`<div class="no-print issue-edit-controls" hidden><label>แก้ไขรายละเอียดปัญหา<textarea class="issue-edit-description" data-issue-id="${esc(i.issue_id)}" maxlength="20000">${esc(i.description)}</textarea></label><button type="button" class="issue-edit-save" data-issue-id="${esc(i.issue_id)}">บันทึกการแก้ไขปัญหา</button></div>`:''}<b>ไฟล์แนบจากผู้แจ้ง</b>${await mediaFor([i.issue_id],null,issueEditable)}${issueEditable&&receivingDepartments.length?`<div class="no-print issue-reassign" data-issue-id="${esc(i.issue_id)}"><b>แก้ฝ่ายรับเรื่อง (ก่อนมีผู้รับงาน)</b><div class="receiver-checkboxes">${receivingDepartments.map(d=>`<label style="display:inline-flex;gap:6px;margin:6px 14px 6px 0"><input type="checkbox" value="${esc(d.code)}" ${detail.assignments.some(a2=>a2.department_code===d.code&&(a2.issues||[]).some(x=>x.issue_id===i.issue_id))?'checked':''}>${esc(d.code)}</label>`).join('')}</div><button type="button" class="issue-reassign-save" data-issue-id="${esc(i.issue_id)}">บันทึกเปลี่ยนแผนก</button></div>`:''}${decision}${issueEditable?`<div class="no-print"><label>เพิ่มไฟล์ของปัญหา ${esc(i.issue_number)}<input class="issueFiles" data-issue-number="${esc(i.issue_number)}" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple></label></div>`:''}</article>`);
  }
  deptGroup.innerHTML=`<h3 class="issue-dept-title">แผนก ${esc(a.department_code||'-')}</h3>${cards.join('')||'<p class="muted">ไม่มีรายการปัญหาสำหรับแผนกนี้</p>'}`;
  issueHost.append(deptGroup);
 }
 // Keep issue editing and attachment upload handlers attached to the single section 2.
 for(const button of issueSheet.querySelectorAll('.issue-edit-save'))button.addEventListener('click',async()=>{
  const issueId=button.dataset.issueId;
  const area=[...issueSheet.querySelectorAll('.issue-edit-description')].find(x=>x.dataset.issueId===issueId);
  if(!area||!area.value.trim()){setNote('กรุณากรอกรายละเอียดปัญหา',true);return;}
  button.disabled=true;
  try{await rpc('qa_v38_edit_issue_description',{p_issue_id:issueId,p_description:area.value.trim()});setNote('บันทึกการแก้ไขปัญหาเรียบร้อย');await render();}
  catch(e){setNote('แก้ไขปัญหาไม่สำเร็จ: '+e.message,true);button.disabled=false;}
 });
 for(const inp of issueSheet.querySelectorAll('.issueFiles'))inp.addEventListener('change',async()=>{
  const files=[...inp.files];inp.disabled=true;
  try{await uploadIssue(+inp.dataset.issueNumber,files);setNote('เพิ่มไฟล์แนบเรียบร้อย');await render();}
  catch(e){setNote('เพิ่มไฟล์ไม่สำเร็จ: '+e.message,true);}
  finally{inp.disabled=false;}
 });
 for(const button of issueSheet.querySelectorAll('.issue-reassign-save'))button.addEventListener('click',async()=>{
  const root=button.closest('.issue-reassign');const codes=[...root.querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value);
  if(!codes.length){setNote('เลือกแผนกรับเรื่องอย่างน้อย 1 แผนก',true);return;}
  if(!confirm('ยืนยันเปลี่ยนแผนกรับผิดชอบ? เลขปัญหาจะคงเดิม และจะส่งภาพแจ้งแก้ไขเข้า LINE กลุ่ม '+String(detail.source_type||'')+' หลังบันทึก'))return;
  button.disabled=true;try{const result=await rpc('qa_v49_change_issue_departments',{p_issue_id:button.dataset.issueId,p_departments:codes});
   if(!result.changed){await render();setNote('ไม่ได้เปลี่ยนแผนก (รายการที่เลือกเหมือนเดิม) จึงไม่ส่ง LINE ซ้ำ');}
   else if(result.event_id){
    const event={event_id:result.event_id,issue_id:button.dataset.issueId,issue_number:result.issue_number,old_departments:result.old_departments,new_departments:result.departments};
    sessionStorage.setItem('qa-v49-pending-line:'+jobId,JSON.stringify(event));
    await render();await notifyReceiverChange(event);
   }else{setNote('บันทึกแล้ว แต่ไม่มีเลขเหตุการณ์แจ้งเตือน กรุณาตรวจ SQL V49.7',true);}
  }
   catch(e){setNote('เปลี่ยนแผนกไม่สำเร็จ: '+e.message,true);button.disabled=false;}
 });
 // Unrelated return: exactly two explicit requester decisions for the affected issue.
 for(const root of issueSheet.querySelectorAll('.unrelated-decision')){
  const change=root.querySelector('.unrelated-change-form');
  root.querySelector('.unrelated-change-toggle').addEventListener('click',()=>{change.hidden=!change.hidden;if(!change.hidden)change.scrollIntoView({behavior:'smooth',block:'nearest'});});
  root.querySelector('.unrelated-keep-original').addEventListener('click',async()=>{
   if(!confirm('ยืนยันใช้ฝ่ายรับงานเดิมและส่งกลับให้แผนกเดิมดำเนินการ?'))return;
   const buttons=[...root.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
   try{setNote('กำลังยืนยันฝ่ายรับงานเดิม...');const result=await rpc('qa_v51_confirm_unrelated_original',{p_issue_id:root.dataset.issueId,p_assignment_id:root.dataset.assignmentId,p_expected_version:Number(root.dataset.version)});
    const event=result?.event_id?{event_id:result.event_id,issue_id:root.dataset.issueId,issue_number:result.issue_number,old_departments:result.old_departments,new_departments:result.new_departments,confirm_original:true}:null;
    if(event)sessionStorage.setItem('qa-v49-pending-line:'+jobId,JSON.stringify(event));
    await render();if(event)await notifyReceiverChange(event);else setNote('ยืนยันฝ่ายรับงานเดิมเรียบร้อย');
   }catch(e){setNote('ยืนยันฝ่ายรับงานเดิมไม่สำเร็จ: '+e.message,true);buttons.forEach(b=>b.disabled=false);}
  });
  root.querySelector('.unrelated-change-save').addEventListener('click',async()=>{
   const codes=[...root.querySelectorAll('.receiver-checkboxes input:checked')].map(x=>x.value);
   if(!codes.length){setNote('กรุณาเลือกฝ่ายรับเรื่องอย่างน้อยหนึ่งแผนก',true);return;}
   if(codes.includes(String(detail.assignments.find(a=>a.assignment_id===root.dataset.assignmentId)?.department_code||''))){setNote('ถ้าจะใช้แผนกเดิม ให้กด “ยืนยันฝ่ายรับงานเดิม” หรือเอาแผนกที่แจ้งว่าไม่เกี่ยวข้องออกก่อน',true);return;}
   if(!confirm('ยืนยันเปลี่ยนฝ่ายรับงาน? ระบบจะส่งภาพแจ้งแก้ไขเข้า LINE กลุ่ม '+String(detail.source_type||'')))return;
   const buttons=[...root.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
   try{setNote('กำลังเปลี่ยนฝ่ายรับงาน...');const result=await rpc('qa_v51_resolve_unrelated_change',{p_issue_id:root.dataset.issueId,p_assignment_id:root.dataset.assignmentId,p_expected_version:Number(root.dataset.version),p_departments:codes});
    if(!result?.event_id)throw new Error('ไม่มีเหตุการณ์ LINE หลังแก้แผนก');
    const event={event_id:result.event_id,issue_id:root.dataset.issueId,issue_number:result.issue_number,old_departments:result.old_departments,new_departments:result.new_departments};
    sessionStorage.setItem('qa-v49-pending-line:'+jobId,JSON.stringify(event));await render();await notifyReceiverChange(event);
   }catch(e){setNote('แก้ฝ่ายรับงานไม่สำเร็จ: '+e.message+(String(e.message).includes('ADMIN_ROLLBACK_REQUIRED')?' — ต้องให้ System Admin ย้อนสถานะการรับงานก่อน':'') ,true);buttons.forEach(b=>b.disabled=false);}
  });
 }
 // Response and approval areas stay as individual department panels below section 2.
 for(const a of detail.assignments){
 const mine=QA.profile?.department===a.department_code||QA.profile?.role==='system_admin';
 const head=QA.profile?.role==='system_admin'||(mine&&QA.profile?.role==='department_admin');
 const isRequester=detail.is_requester||QA.profile?.role==='system_admin';
 // Department heads of the reporting department are the only intended final reviewers.
 const isFinalReviewer=QA.profile?.role==='department_admin'&&String(QA.profile?.department||'').toLowerCase()===String(detail.from_department||'').toLowerCase();
 const el=document.createElement('section');el.className='sheet department-panel';
 el.dataset.assignment=a.assignment_id;el.dataset.departmentCode=a.department_code;
 const isResponsible=String(a.responsible_user||'')===String(QA.profile?.user_id||'');
 const responseEditable=mine&&isResponsible&&a.status==='IN_PROGRESS'&&!a.approval_requested_at;
 const pendingHeadReview=a.status==='IN_PROGRESS'&&Boolean(a.approval_requested_at);
 const showResponse=a.status!=='OPEN'||Boolean(a.responsible_user||a.accepted_at);
 // A requester should not see an empty Section 3 before the receiving department accepts.
 // Keep it available for the receiving department (including its acceptance controls).
 if(detail.is_requester && !mine && !showResponse)continue;
 const priorRounds=(completedRounds.get(String(a.assignment_id))||[]).slice().sort((x,y)=>Number(x.round_no)-Number(y.round_no));
 const roundNumber=(priorRounds.length?Math.max(...priorRounds.map(r=>Number(r.round_no)||0)):0)+1;
 // A previously rejected job without a saved archive is NOT safe to edit: its old text
 // may still reside in the current assignment. Preserve it until audited repair SQL runs.
 const hasLegacyUnarchivedFailure=a.status==='IN_PROGRESS'&&!!String(a.requester_review_reason||'').trim()&&!a.approval_requested_at&&priorRounds.length===0;
 const canEditCurrent=responseEditable&&!hasLegacyUnarchivedFailure;
 const afterRejection=priorRounds.length>0&&a.status==='IN_PROGRESS'&&!a.approval_requested_at;
 const earlier=priorRounds.map(r=>`<section class="response-prior-round"><h3>บันทึกการแก้ไขครั้งที่ ${esc(r.round_no)} (อ่านอย่างเดียว)</h3><p class="muted">ผู้ตรวจรับไม่ผ่าน: ${esc(r.rejection_reason||'-')}</p><p><b>รายละเอียดปัญหา:</b> ${esc(r.receiver_problem_detail||'-')}</p><p><b>วิเคราะห์สาเหตุ:</b> ${esc(r.problem_analysis||'-')}</p><p><b>การแก้ไข:</b> ${esc(r.corrective_action||'-')}</p><p><b>กำหนดเสร็จ:</b> ${esc(r.due_date||'-')}</p></section>`).join('');
 const oldDataNotice=hasLegacyUnarchivedFailure?'<div class="rework-unarchived">รายการนี้เคยตรวจรับไม่ผ่านก่อนที่ระบบบันทึกรอบจะพร้อม ข้อมูลการแก้ไขเดิมถูกล็อกเพื่อไม่ให้เขียนทับ กรุณาตรวจสอบและรัน SQL ซ่อมประวัติงานค้างเดิมก่อนเริ่มการแก้ไขครั้งที่ 2</div>':'';
 // Files attached in earlier rounds are view-only on rework; historical text is immutable in the DB.
 const responseMedia=showResponse?await mediaFor([],a.assignment_id,canEditCurrent&&priorRounds.length===0):'';
 el.innerHTML=`<h2>3. การดำเนินงาน — ${esc(a.department_code)} <span class="badge">${esc(label(a.status))}</span></h2>
 ${showResponse?`${earlier}${oldDataNotice}<h3>${priorRounds.length?'รายละเอียดการแก้ไขครั้งที่ '+roundNumber:'รายละเอียดการดำเนินการ'}</h3>${afterRejection?'<p class="rework-reminder">↩ ส่งกลับแก้ไข — กรุณากรอกข้อมูลการแก้ไขรอบใหม่ บันทึกครั้งก่อนอ่านได้อย่างเดียว</p>':''}<p><b>ผู้รับผิดชอบหลัก:</b> ${esc(a.responsible_name||a.responsible_user||'ยังไม่รับงาน')}</p>
 <div class="row"><label>วันกำหนดเสร็จ<input class="due" type="date" value="${esc(a.due_date||'')}" ${!canEditCurrent?'disabled':''}></label></div>
 <label class="field">รายละเอียดปัญหา<textarea class="recv" ${!canEditCurrent?'disabled':''}>${esc(a.receiver_problem_detail||'')}</textarea></label>
 <label class="field">วิเคราะห์สาเหตุ<textarea class="analysis" ${!canEditCurrent?'disabled':''}>${esc(a.problem_analysis||'')}</textarea></label>
 <label class="field">การแก้ไข<textarea class="fix" ${!canEditCurrent?'disabled':''}>${esc(a.corrective_action||'')}</textarea></label>
 <h3>ไฟล์แนบฝ่ายรับเรื่อง</h3>${responseMedia}
 ${a.unrelated_requested_at?`<p class="action-note">แจ้งไม่เกี่ยวข้อง: ${esc(a.unrelated_reason||'')} · รอผู้แจ้งยืนยัน</p>`:''}
 ${canEditCurrent?`<div class="no-print"><label>แนบรูป/วิดีโอ (สูงสุด 5 รูป และ 1 วิดีโอ)<input class="responseFiles" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple></label></div>`:''}
 <div class="no-print actions"></div>
 <h3>การตรวจสอบและอนุมัติ</h3><p>${pendingHeadReview?'<strong class="head-review-alert">⏳ รอหัวหน้าแผนกรับเรื่องอนุมัติ</strong>':a.approved_at?'อนุมัติเมื่อ '+esc(new Date(a.approved_at).toLocaleString('th-TH')):esc(label(a.status))}</p>` : ''}${!showResponse?'<div class="no-print actions"></div>':''}`;
 const actions=el.querySelector('.actions');
 function btn(text,action,color='secondary'){const b=document.createElement('button');b.textContent=text;b.className=color;b.onclick=()=>act(a,action,el);actions.append(b);}
 if(mine&&a.status==='OPEN'&&!a.unrelated_requested_at){if(QA.profile?.role==='system_admin'){const note=document.createElement('label');note.className='admin-accept-comment';note.textContent='หมายเหตุรับงานแทนแผนก';const area=document.createElement('textarea');area.className='admin-accept-input';area.placeholder='ข้อความถึงแผนกผู้รับเรื่อง';area.maxLength=2000;note.append(area);actions.append(note);}btn('รับงาน','ACCEPT');}
 if(canEditCurrent){btn('บันทึก','SAVE_DRAFT');if(QA.profile?.role==='department_admin')btn('ส่งงาน','HEAD_SEND');else btn('ส่งให้หัวหน้าตรวจสอบ','REQUEST_APPROVAL');}
 if(head&&pendingHeadReview){btn('อนุมัติและส่งงาน','APPROVE');btn('ส่งกลับให้แก้ไข','RETURN','danger');}
 // Only receivers from their own department may request "not related".
 // A system admin must use separately authorized admin controls, not act as
 // an arbitrary departmental recipient through this button.
 const mayMarkUnrelated=['user','department_admin'].includes(QA.profile?.role)&&
   String(QA.profile?.department||'').toLowerCase()===String(a.department_code||'').toLowerCase();
 if(mayMarkUnrelated&&a.status==='OPEN'&&!a.accepted_at&&!a.responsible_user&&!a.unrelated_requested_at&&!a.approval_requested_at)btn('ไม่เกี่ยวข้อง','UNRELATED_REQUEST','secondary');
 // Requester decisions for unrelated work are now inside section 2, beside the affected issue.
 if(isFinalReviewer&&a.status==='WAITING_REVIEW'){btn('ผ่าน','REQUESTER_PASS');btn('ไม่ผ่าน','REQUESTER_FAIL','danger');}
 // V49: system admin rollback is per assignment; SQL enforces transition/version/reason.
 if(QA.profile?.role==='system_admin'){const back=({IN_PROGRESS:'OPEN',WAITING_REVIEW:'IN_PROGRESS',REWORK:'WAITING_REVIEW',CLOSED:'WAITING_REVIEW',CANCELLED:'OPEN'})[a.status];if(back){const b=document.createElement('button');b.type='button';b.className='danger';b.textContent='ย้อนสถานะ → '+label(back);b.onclick=()=>adminRollback(a,back);actions.append(b);}}
 for(const btnNote of el.querySelectorAll('.media-note-save'))btnNote.addEventListener('click',async()=>{
  const input=[...el.querySelectorAll('.media-note-input')].find(x=>x.dataset.attachment===btnNote.dataset.attachment);
  if(!input)return;btnNote.disabled=true;try{await rpc('qa_v38_media_set_note',{p_attachment_id:btnNote.dataset.attachment,p_note:input.value});setNote('บันทึกหมายเหตุเรียบร้อย');}catch(e){setNote('บันทึกหมายเหตุไม่สำเร็จ: '+e.message,true)}finally{btnNote.disabled=false}
 });
 if(!canEditCurrent){for(const sel of ['.recv','.analysis','.fix']){const textarea=el.querySelector(sel);if(!textarea)continue;const plain=document.createElement('div');plain.className='read-text';plain.textContent=textarea.value||'-';textarea.replaceWith(plain)}}
 list.append(el);
 // Action bar is a separate sibling, outside the section 3 card.
 if(actions.children.length){const outside=document.createElement('div');outside.className='department-action-bar no-print';outside.dataset.assignment=a.assignment_id;outside.append(...Array.from(actions.childNodes));actions.remove();list.append(outside);}
 }
 renderTracker(detail);await renderHistory();
 }catch(e){setNote('อ่านใบงานไม่สำเร็จ: '+e.message,true);$('details').textContent='โปรดตรวจสิทธิ์ หรือกลับไปเปิดใบงานเดิม';}}
async function renderHistory(){
 const box=$('historyRows');box.replaceChildren();try{const events=await rpc('qa_v38_job_history',{p_job_id:jobId});
 const names={ACCEPT:'รับงาน',SAVE_DRAFT:'บันทึกการดำเนินการ',REQUEST_APPROVAL:'ส่งให้หัวหน้าอนุมัติ',HEAD_SEND:'หัวหน้าแผนกส่งงานโดยตรง',APPROVE:'หัวหน้าอนุมัติ',RETURN:'หัวหน้าไม่อนุมัติ',REQUESTER_PASS:'ผู้แจ้งตรวจรับผ่าน',REQUESTER_FAIL:'ผู้แจ้งไม่ผ่านการตรวจรับ',ADMIN_ROLLBACK:'System Admin ย้อนสถานะ',UNRELATED_REQUEST:'แจ้งไม่เกี่ยวข้อง',UNRELATED_CONFIRM:'ผู้แจ้งยืนยันถอดแผนก',UNRELATED_REJECT:'ผู้แจ้งคงแผนกไว้'};
 for(const e of events||[]){const div=document.createElement('div');div.className='history-row';div.textContent=new Date(e.created_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})+' · '+(e.department_code||'')+' · '+(names[e.action]||e.action);box.append(div)}
 if(!events?.length)box.textContent='ยังไม่มีประวัติการดำเนินงาน';
 }catch(e){box.textContent='ไม่สามารถโหลดประวัติ: '+e.message}
}
function renderTracker(d){
 const panels=[...document.querySelectorAll('.department-panel')];const all=d.assignments||[];
 const live=all.filter(a=>a.status!=='CANCELLED');
 const status=live.length&&live.every(a=>a.status==='CLOSED')?'CLOSED':live.some(a=>a.status==='OPEN'||a.status==='IN_PROGRESS'||a.status==='REWORK')?(live.some(a=>a.status==='IN_PROGRESS'||a.status==='REWORK'||a.status==='CLOSED'||a.status==='WAITING_REVIEW'||a.responsible_user)?'IN_PROGRESS':'OPEN'):live.some(a=>a.status==='WAITING_REVIEW')?'WAITING_REVIEW':'OPEN';
 const steps=['OPEN','IN_PROGRESS','WAITING_REVIEW','CLOSED'],current=steps.indexOf(status);
 $('jobTrackerNumber').textContent=d.car_code||d.job_id;
 document.querySelectorAll('[data-step]').forEach((el,i)=>{el.classList.toggle('done',i<current);el.classList.toggle('current',i===current)});
 document.querySelector('.tracker-stages')?.style.setProperty('--track-progress',String(current*100/3*0.75)+'%');
 const chips=$('departmentChips');chips.replaceChildren();
 all.forEach((a,i)=>{const b=document.createElement('button');b.type='button';b.textContent=a.department_code+' · '+label(a.status);b.onclick=()=>{const groups=[...document.querySelectorAll('.issue-department-group')];groups.forEach(g=>g.classList.toggle('issue-dept-highlight',g.dataset.assignment===String(a.assignment_id)));[...chips.children].forEach((c,j)=>c.classList.toggle('active',j===i));const match=groups.find(g=>g.dataset.assignment===String(a.assignment_id));const target=match||panels.find(p=>p.dataset.assignment===String(a.assignment_id));if(target){target.scrollIntoView({behavior:'smooth',block:'start'});target.classList.add('issue-dept-highlight');}};chips.append(b)});
}
const pendingAssignmentActions=new Set();
async function act(a,action,el){
 if(pendingAssignmentActions.has(a.assignment_id))return;
 if(action==='UNRELATED_REQUEST'&&!( ['user','department_admin'].includes(QA.profile?.role)&&String(QA.profile?.department||'').toLowerCase()===String(a.department_code||'').toLowerCase())){setNote('ไม่มีสิทธิ์กดไม่เกี่ยวข้องสำหรับแผนกนี้',true);return;}
 if(action==='UNRELATED_REQUEST'&&(a.status!=='OPEN'||a.accepted_at||a.responsible_user||a.approval_requested_at)){setNote('รับงานแล้วไม่สามารถกดไม่เกี่ยวข้องได้ หากต้องแก้ฝ่ายรับงานกรุณาติดต่อ System Admin เพื่อย้อนสถานะก่อน',true);return;}
 if(['REQUESTER_PASS','REQUESTER_FAIL'].includes(action)&&!(QA.profile?.role==='department_admin'&&String(QA.profile?.department||'').toLowerCase()===String(detail?.from_department||'').toLowerCase())){setNote('สิทธิ์ตรวจรับเป็นของหัวหน้าแผนกผู้แจ้งเท่านั้น',true);return;}
 let data={};if(['SAVE_DRAFT','REQUEST_APPROVAL','HEAD_SEND'].includes(action)){data={receiver_problem_detail:el.querySelector('.recv').value,problem_analysis:el.querySelector('.analysis').value,corrective_action:el.querySelector('.fix').value,due_date:el.querySelector('.due').value};}
 if(['REQUEST_APPROVAL','HEAD_SEND'].includes(action)&&el.querySelector('.responseFiles')?.files?.length){setNote('กรุณากดบันทึกร่างเพื่ออัปโหลดไฟล์แนบก่อน แล้วจึงส่งให้หัวหน้าตรวจสอบ',true);return;}
 if(['RETURN','REQUESTER_FAIL','UNRELATED_REQUEST'].includes(action)){const reason=prompt(action==='RETURN'?'ระบุเหตุผลที่ไม่อนุมัติ':action==='REQUESTER_FAIL'?'ระบุเหตุผลที่ไม่ผ่าน':'ระบุเหตุผลที่ไม่เกี่ยวข้อง');if(!reason?.trim())return;data={reason:reason.trim()};}
 if(action==='ACCEPT'&&QA.profile.role==='system_admin'){data={comment:el.querySelector('.admin-accept-input')?.value.trim()||''};}
 if(['APPROVE','REQUESTER_PASS','UNRELATED_CONFIRM'].includes(action)&&!confirm('ยืนยันการดำเนินการ?'))return;
 const actionBar=document.querySelector('.department-action-bar[data-assignment="'+CSS.escape(String(a.assignment_id))+'"]');
 const buttons=[...(actionBar?.querySelectorAll('button')||[])];
 pendingAssignmentActions.add(a.assignment_id);
 buttons.forEach(b=>{b.disabled=true;b.setAttribute('aria-busy','true');b.dataset.originalText=b.textContent;});
 const pressed=buttons.find(b=>b.dataset.originalText===({HEAD_SEND:'ส่งงาน',REQUEST_APPROVAL:'ส่งให้หัวหน้าตรวจสอบ',APPROVE:'อนุมัติและส่งงาน'}[action]||''));
 if(pressed)pressed.textContent='กำลังบันทึก...';
 try{setNote('กำลังบันทึก...');let expected=a.version;
 if(['REQUEST_APPROVAL','HEAD_SEND'].includes(action)){
   // Save visible edits first and use the newly returned version for the follow-up action.
   const saved=await rpc('qa_vnext_assignment_action',{p_assignment_id:a.assignment_id,p_action:'SAVE_DRAFT',p_expected_version:expected,p_data:data});
   expected=Number(saved.version);
   if(!Number.isInteger(expected)||expected<1)throw new Error('INVALID_SAVED_VERSION');
 }
 const {data:result,error}=await QA.client.rpc('qa_vnext_assignment_action',{p_assignment_id:a.assignment_id,p_action:action,p_expected_version:expected,p_data:['REQUEST_APPROVAL','HEAD_SEND'].includes(action)?{}:data});if(error)throw error;
 if(action==='SAVE_DRAFT'){const files=[...el.querySelector('.responseFiles')?.files||[]];if(files.length)await uploadResponse(a.assignment_id,files);}
 setNote('บันทึกสำเร็จ');await render();
 }catch(e){
  if(String(e.message||e).includes('VERSION_CONFLICT')){setNote('ข้อมูลใบงานถูกอัปเดตระหว่างเปิดหน้านี้ กำลังโหลดข้อมูลล่าสุด กรุณาตรวจสอบก่อนกดส่งงานอีกครั้ง',true);await render();}
  else setNote('ไม่สามารถบันทึกได้: '+e.message,true);
 }finally{pendingAssignmentActions.delete(a.assignment_id);buttons.forEach(b=>{b.disabled=false;b.removeAttribute('aria-busy');if(b.dataset.originalText)b.textContent=b.dataset.originalText;});}
}
async function adminRollback(a,target){
 if(QA.profile?.role!=='system_admin'){setNote('เฉพาะ System Admin เท่านั้น',true);return;}
 const reason=prompt('ระบุเหตุผลในการย้อนสถานะของแผนก '+a.department_code+' จาก '+label(a.status)+' ไป '+label(target)+' (จำเป็น)');
 if(reason===null)return;
 if(!reason.trim()){setNote('ต้องระบุเหตุผลในการย้อนสถานะ',true);return;}
 if(!confirm('ยืนยันย้อนสถานะแผนก '+a.department_code+'?\nระบบจะเก็บประวัติการย้อนสถานะ และไม่เปลี่ยนแปลงแผนกอื่น'))return;
 try{setNote('กำลังย้อนสถานะ...');await rpc('qa_vnext_admin_rollback_assignment',{p_assignment_id:a.assignment_id,p_target_status:target,p_expected_version:a.version,p_reason:reason.trim()});setNote('ย้อนสถานะเรียบร้อย');await render();}
 catch(e){setNote('ย้อนสถานะไม่สำเร็จ: '+e.message,true);}
}
async function uploadIssue(issueNumber,files){const imgs=files.filter(f=>f.type.startsWith('image/'));const vids=files.filter(f=>f.type.startsWith('video/'));
 if(imgs.length>5||vids.length>1||imgs.length+vids.length!==files.length)throw new Error('เลือกได้สูงสุด 5 รูปและ 1 วิดีโอ');
 for(const f of files){const limit=f.type.startsWith('image/')?5242880:52428800;if(f.size>limit)throw new Error('ขนาดไฟล์เกิน '+f.name);
 const path=`${QA.profile.user_id}/${crypto.randomUUID()}.${f.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)||'bin'}`;
 const {error}=await QA.client.storage.from('qa-vnext-media').upload(path,f,{contentType:f.type,upsert:false});if(error)throw error;
 try{await rpc('qa_vnext_register_attachment',{p_job_id:jobId,p_scope:'ISSUE',p_issue_number:issueNumber,p_assignment_id:null,p_kind:f.type.startsWith('image/')?'IMAGE':'VIDEO',p_path:path,p_mime_type:f.type,p_size_bytes:f.size});}catch(e){try{await QA.client.storage.from('qa-vnext-media').remove([path]);}catch{}throw e;}}}
async function uploadResponse(assignmentId,files){const images=files.filter(f=>f.type.startsWith('image/')),videos=files.filter(f=>f.type.startsWith('video/'));
 if(images.length>5||videos.length>1||files.length!==images.length+videos.length)throw new Error('แนบได้สูงสุด 5 รูปและ 1 วิดีโอ');
 for(const f of files){const isImage=f.type.startsWith('image/'),limit=isImage?5242880:52428800;
 if(f.size>limit)throw new Error('ไฟล์เกินขนาด '+f.name);
 const ext=f.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)||'bin';const path=`${QA.profile.user_id}/${crypto.randomUUID()}.${ext}`;
 const {error}=await QA.client.storage.from('qa-vnext-media').upload(path,f,{contentType:f.type,upsert:false});if(error)throw error;
 try{await rpc('qa_vnext_register_attachment',{p_job_id:jobId,p_scope:'ASSIGNMENT',p_issue_number:null,p_assignment_id:assignmentId,p_kind:isImage?'IMAGE':'VIDEO',p_path:path,p_mime_type:f.type,p_size_bytes:f.size});}catch(e){try{await QA.client.storage.from('qa-vnext-media').remove([path]);}catch{}throw e;}
 }}
// Structured A4 document: text stays selectable and sections may flow across pages.
// Detail and attachment data are already scoped by the server-side V38 RPCs.
async function exportStructuredPdf(preview){
 if(!detail)throw new Error('ยังโหลดข้อมูลใบงานไม่ครบ');
 const doc=preview.document;
 doc.open();doc.write('<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบงาน '+esc(detail.car_code||jobId)+'</title></head><body><p>กำลังจัดหน้าเอกสาร...</p></body></html>');doc.close();
 const css=`@page{size:A4;margin:12mm 13mm}*{box-sizing:border-box}body{font:10.5pt/1.32 Arial,Tahoma,sans-serif;color:#111;margin:0}header{display:flex;align-items:center;gap:15mm;border-bottom:2px solid #222;padding-bottom:7px;margin-bottom:8px}header img{width:46mm;max-height:19mm;object-fit:contain}header .heading{flex:1;text-align:center;font-weight:700;font-size:15pt}header .sub{font-size:12pt}.ref{text-align:right;font-size:9pt;margin:5px 0 8px}.section{margin:0 0 9px}.section-title{background:#d9edf7;border:1px solid #222;font-weight:bold;padding:5px 7px;font-size:11pt;break-after:avoid}table{width:100%;table-layout:fixed;border-collapse:collapse}td,th{border:1px solid #222;padding:5px 6px;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}th{width:22%;text-align:left;background:#fafafa}tr,.attachment,.signature{break-inside:avoid}.issue-head{font-weight:700;background:#f0f5f9}.attachments{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;padding:6px;border:1px solid #222;border-top:0}.attachment{border:1px solid #aab3bd;min-height:35mm;padding:4px;text-align:center}.attachment img{display:block;width:100%;height:27mm;object-fit:contain}.attachment .note{white-space:pre-wrap;text-align:left;font-size:8.5pt;padding-top:4px}.video-mark{font-size:9pt;color:#465464;margin:10mm auto}.signature{display:flex;gap:8mm;margin-top:16mm}.signature div{flex:1;text-align:center;border-top:1px solid #111;padding-top:5px}footer{font-size:8pt;text-align:right;margin-top:9px}@media screen{html{background:#e9eef4}body{width:210mm;min-height:297mm;background:white;margin:16px auto;padding:12mm 13mm;box-shadow:0 4px 22px #0002}.print-action{position:fixed;right:25px;top:20px;padding:12px 20px;background:#112549;color:white;border:0;border-radius:8px;cursor:pointer;font:14px Arial}}@media print{.print-action{display:none}}`;
 const head=doc.createElement('head');head.innerHTML='<meta charset="utf-8">';const style=doc.createElement('style');style.textContent=css;head.append(style);
 const body=doc.createElement('body');
 const add=(tag,text,parent=body,cls='')=>{const e=doc.createElement(tag);if(cls)e.className=cls;e.textContent=String(text??'-');parent.append(e);return e;};
 const section=(title)=>{const sec=doc.createElement('section');sec.className='section';body.append(sec);add('div',title,sec,'section-title');return sec;};
 const table=(parent,rows)=>{const t=doc.createElement('table');parent.append(t);for(const [a,b] of rows){const r=t.insertRow();const k=doc.createElement('th');k.textContent=a;r.append(k);const v=r.insertCell();v.textContent=String(b??'-');}return t;};
 const h=doc.createElement('header');body.append(h);const logo=doc.createElement('img');logo.src=new URL('labtech-logo.png',location.href).href;logo.alt='Labtech';h.append(logo);const hd=doc.createElement('div');hd.className='heading';hd.innerHTML='COMPLAINT & ACTION REQUEST<div class="sub">ใบแจ้งปัญหาและติดตามการแก้ไข</div>';h.append(hd);
 add('div',(detail.car_code||jobId)+'  ·  '+label(detail.status||''),body,'ref');
 table(section('1. ข้อมูลผู้แจ้ง'),[['เลขที่ใบงาน',detail.car_code||jobId],['ประเภทงาน',detail.source_type],['Serial Number',detail.serial_no],['ลูกค้า',detail.customer_name],['ประเทศ',detail.country],['ฝ่ายผู้แจ้ง',detail.from_department],['ผู้แจ้ง',detail.requester_name||detail.issuer_name||'-'],['หมายเหตุ',detail.requester_remark],['วันที่แจ้ง',detail.created_at?new Date(detail.created_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'-']]);
 let index=0;
 for(const a of detail.assignments||[]){
   const sec=section('2. รายละเอียดปัญหา / ฝ่ายรับเรื่อง '+a.department_code);
   for(const i of a.issues||[]){
     index++;table(sec,[['ปัญหาที่ '+index, 'ประเภท: '+categoryName(i.category_code)+'\n'+(i.description||'-')]]);
     const files=media.filter(m=>m.scope==='ISSUE'&&m.issue_id===i.issue_id);await addMedia(sec,files);
   }
   const work=section('3. การดำเนินการและผลตรวจสอบ — '+a.department_code);
   table(work,[['สถานะ',label(a.status)],['ผู้รับผิดชอบ',a.responsible_name||a.responsible_user||'-'],['ปัญหา',a.receiver_problem_detail],['วิเคราะห์สาเหตุ',a.problem_analysis],['การแก้ไขและป้องกัน',a.corrective_action],['กำหนดเสร็จ',a.due_date],['หัวหน้าอนุมัติ',a.approved_at?new Date(a.approved_at).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'}):'-']]);
   await addMedia(work,media.filter(m=>m.scope==='ASSIGNMENT'&&m.assignment_id===a.assignment_id));
 }
 if(!(detail.assignments||[]).length)add('p','ยังไม่มีรายละเอียดฝ่ายรับเรื่อง');
 const signatures=doc.createElement('div');signatures.className='signature';body.append(signatures);for(const title of ['ผู้แจ้ง / ผู้ตรวจรับ','ผู้รับผิดชอบ','หัวหน้าแผนก'])add('div',title,signatures);
 add('footer','พิมพ์เมื่อ '+new Date().toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}));
 const print=add('button','กำลังโหลดรูปภาพ...',body,'print-action');print.disabled=true;
 // Attach the DOM BEFORE waiting for images: detached img elements may never start loading.
 // Include the company logo in readiness checks, not only attachment images.
 doc.documentElement.replaceChildren(head,body);
 // The browser print dialog must not open until signed attachment images settle.
 // An unreadable image is replaced with an explicit marker, not silently omitted.
 const images=[logo,...body.querySelectorAll('.attachment img')];
 await Promise.all(images.map(im=>new Promise(resolve=>{
   if(im.complete){resolve();return;}
   im.addEventListener('load',resolve,{once:true});
   im.addEventListener('error',resolve,{once:true});
 // Do not trap the user in a disabled PDF print button on a stalled download.
 setTimeout(resolve,12000);
 })));
 let missing=0;
 for(const im of images){if(!im.naturalWidth){missing++;const warning=doc.createElement('div');warning.className='media-load-error';warning.textContent='ไม่สามารถแสดงภาพแนบนี้ได้';im.replaceWith(warning);}}
 print.disabled=false;print.textContent=missing?'พิมพ์ / บันทึกเป็น PDF (ภาพไม่ครบ '+missing+' รูป)':'พิมพ์ / บันทึกเป็น PDF';
 print.onclick=()=>preview.print();
 // Use signed URLs only for media that the requesting user is authorized to see.
 async function addMedia(parent,files){if(!files.length)return;const box=doc.createElement('div');box.className='attachments';parent.append(box);for(const file of files){const item=doc.createElement('div');item.className='attachment';box.append(item);if(file.kind==='IMAGE'){const im=doc.createElement('img');im.alt='ภาพประกอบ';try{im.src=await getUrl(file.storage_path)}catch{im.removeAttribute('src');im.alt='ไม่สามารถโหลดภาพ'}item.append(im);}else add('div','วิดีโอประกอบ',item,'video-mark');add('div',file.note||' ',item,'note');}}
}
$('pdfButton').onclick=()=>{const w=window.open('','_blank');if(!w){setNote('กรุณาอนุญาต Pop-up สำหรับ PDF',true);return;}exportStructuredPdf(w).catch(e=>{try{w.close()}catch{}setNote('Export PDF ไม่สำเร็จ: '+e.message,true)});};

function scrollToLinkedIssue(){
 const prefix='#issue-';if(!location.hash.startsWith(prefix))return;
 const issueId=decodeURIComponent(location.hash.slice(prefix.length));
 const el=[...document.querySelectorAll('.issue-card')].find(x=>x.dataset.issueId===issueId);
 if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.style.outline='2px solid #2563eb';el.style.outlineOffset='4px';}
}
async function boot(){for(let i=0;i<160&&!QA.profile;i++)await new Promise(r=>setTimeout(r,100));if(!QA.profile){setNote('Login ไม่พร้อม',true);return;}await render();scrollToLinkedIssue();}
boot();
})();
