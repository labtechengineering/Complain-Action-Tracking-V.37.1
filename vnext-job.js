(()=>{'use strict';const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const jobId=new URLSearchParams(location.search).get('id')||new URLSearchParams(location.search).get('job');let detail,media=[];
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
async function render(){if(!jobId){setNote('ไม่พบหมายเลขงาน',true);return;}
 try{detail=await rpc('qa_vnext_job_detail',{p_job_id:jobId});media=await rpc('qa_vnext_media_list',{p_job_id:jobId});
 if(!Array.isArray(media))media=[];
 $('details').innerHTML=`<h2>ข้อมูลการแจ้งเรื่อง</h2><div class="job-general-grid">
 <div class="job-general-field"><span class="job-general-label">ประเภทงาน:</span><span class="job-general-value">${esc(detail.source_type||'-')}</span></div>
 <div class="job-general-field"><span class="job-general-label">Serial Number:</span><span class="job-general-value">${esc(detail.serial_no||'-')}</span></div>
 <div class="job-general-field"><span class="job-general-label">ฝ่ายผู้แจ้ง:</span><span class="job-general-value">${esc(detail.from_department||'-')}</span></div>
 <div class="job-general-field"><span class="job-general-label">Customer Name:</span><span class="job-general-value">${esc(detail.customer_name||'-')}</span></div>
 <div class="job-general-field"><span class="job-general-label">Country:</span><span class="job-general-value">${esc(detail.country||'-')}</span></div>
 <div class="job-general-field job-general-wide"><span class="job-general-label">Remark:</span><span class="job-general-value">${esc(detail.requester_remark||'-')}</span></div>
 <div class="job-general-field job-general-wide job-general-date"><span class="job-general-label">วันที่สร้าง:</span><span class="job-general-value">${esc(detail.created_at?new Date(detail.created_at).toLocaleString('th-TH'):'-')}</span></div>
 </div>`;
 const list=$('assignments');list.replaceChildren();if(!detail.assignments?.length){list.innerHTML='<section class="sheet">ใบงานนี้ยังไม่แยกเป็นหลายฝ่าย <a href="job.html?id='+encodeURIComponent(jobId)+'">เปิดหน้าใบงานเดิม</a></section>';return;}
 for(const a of detail.assignments){const mine=QA.profile?.department===a.department_code||QA.profile?.role==='system_admin';const head=QA.profile?.role==='system_admin'||(mine&&QA.profile?.role==='department_admin');
 const isRequester=detail.is_requester||QA.profile?.role==='system_admin';const el=document.createElement('section');el.className='sheet department-panel';el.dataset.assignment=a.assignment_id;
 const issueIds=(a.issues||[]).map(i=>i.issue_id);
 const issueEditable=Boolean(detail.can_manage_issues);const responseEditable=mine&&a.status==='IN_PROGRESS'&&!a.approval_requested_at;
 const blocks=await Promise.all((a.issues||[]).map(async(i,k)=>`<article class="issue"><h3>ปัญหา ${esc(i.issue_number)} — ${esc(i.category_code)}</h3><p>${esc(i.description)}</p>${issueEditable?`<div class="no-print"><label>แก้ไขรายละเอียดปัญหา<textarea class="issue-edit-description" data-issue-id="${esc(i.issue_id)}" maxlength="20000">${esc(i.description)}</textarea></label><button type="button" class="issue-edit-save" data-issue-id="${esc(i.issue_id)}">บันทึกการแก้ไขปัญหา</button></div>`:""}<b>ไฟล์แนบจากผู้แจ้ง</b>${await mediaFor([i.issue_id],null,issueEditable)}${issueEditable?`<div class=\"no-print\"><label>เพิ่มไฟล์ของปัญหา ${i.issue_number}<input class=\"issueFiles\" data-issue-number=\"${i.issue_number}\" type=\"file\" accept=\"image/jpeg,image/png,image/webp,video/mp4,video/webm\" multiple></label></div>`:''}</article>`));
 const responseMedia=await mediaFor([],a.assignment_id,responseEditable);
 el.innerHTML=`<h2>2. รายละเอียดปัญหา — ${esc(a.department_code)} <span class="badge">${esc(label(a.status))}</span></h2>${blocks.join('')}
 <h2>3. การดำเนินการของฝ่ายรับเรื่อง</h2><p><b>ผู้รับผิดชอบหลัก:</b> ${esc(a.responsible_name||a.responsible_user||'ยังไม่รับงาน')}</p>
 <div class="row"><label>วันกำหนดเสร็จ<input class="due" type="date" value="${esc(a.due_date||'')}" ${!responseEditable?'disabled':''}></label></div>
 <label class="field">รายละเอียดปัญหา<textarea class="recv" ${!responseEditable?'disabled':''}>${esc(a.receiver_problem_detail||'')}</textarea></label>
 <label class="field">วิเคราะห์สาเหตุ<textarea class="analysis" ${!responseEditable?'disabled':''}>${esc(a.problem_analysis||'')}</textarea></label>
 <label class="field">การแก้ไข<textarea class="fix" ${!responseEditable?'disabled':''}>${esc(a.corrective_action||'')}</textarea></label>
 <h3>ไฟล์แนบฝ่ายรับเรื่อง</h3>${responseMedia}
 ${a.unrelated_requested_at?`<p class="action-note">แจ้งไม่เกี่ยวข้อง: ${esc(a.unrelated_reason||'')} · รอผู้แจ้งยืนยัน</p>`:''}
 ${responseEditable?`<div class="no-print"><label>แนบรูป/วิดีโอ (สูงสุด 5 รูป และ 1 วิดีโอ)<input class="responseFiles" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple></label></div>`:''}
 <p class="muted">ผู้รับผิดชอบอัปเดตได้ร่วมกันในแผนก · หัวหน้าเป็นผู้อนุมัติ</p><div class="no-print actions"></div>
 <h3>4. การตรวจสอบและอนุมัติ</h3><p>${a.approved_at?'อนุมัติเมื่อ '+esc(new Date(a.approved_at).toLocaleString('th-TH')):esc(label(a.status))}</p>`;
 for(const button of el.querySelectorAll('.issue-edit-save'))button.addEventListener('click',async()=>{
  const issueId=button.dataset.issueId;
  const area=[...el.querySelectorAll('.issue-edit-description')].find(x=>x.dataset.issueId===issueId);
  if(!area||!area.value.trim()){setNote('กรุณากรอกรายละเอียดปัญหา',true);return;}
  button.disabled=true;
  try{await rpc('qa_v38_edit_issue_description',{p_issue_id:issueId,p_description:area.value.trim()});setNote('บันทึกการแก้ไขปัญหาเรียบร้อย');await render();}
  catch(e){setNote('แก้ไขปัญหาไม่สำเร็จ: '+e.message,true);button.disabled=false;}
 });
 for(const inp of el.querySelectorAll('.issueFiles'))inp.addEventListener('change',async()=>{const files=[...inp.files];inp.disabled=true;
  try{await uploadIssue(+inp.dataset.issueNumber,files);setNote('เพิ่มไฟล์แนบเรียบร้อย');await render();}catch(e){setNote('เพิ่มไฟล์ไม่สำเร็จ: '+e.message,true);}finally{inp.disabled=false;}});
 const actions=el.querySelector('.actions');
 function btn(text,action,color='secondary'){const b=document.createElement('button');b.textContent=text;b.className=color;b.onclick=()=>act(a,action,el);actions.append(b);}
 if(mine&&a.status==='OPEN'&&!a.unrelated_requested_at)btn('รับงาน','ACCEPT');
 if(responseEditable){btn('บันทึก','SAVE_DRAFT');btn('ส่งให้หัวหน้าตรวจสอบ','REQUEST_APPROVAL');}
 if(head&&a.status==='IN_PROGRESS'&&a.approval_requested_at){btn('อนุมัติ','APPROVE');btn('ไม่อนุมัติ','RETURN','danger');}
 if(mine&&!a.unrelated_requested_at&&['OPEN','IN_PROGRESS'].includes(a.status)&&!a.approval_requested_at)btn('ไม่เกี่ยวข้อง','UNRELATED_REQUEST','secondary');
 if(isRequester&&a.unrelated_requested_at){btn('ยืนยันลบแผนก','UNRELATED_CONFIRM','danger');btn('คงแผนกนี้ไว้','UNRELATED_REJECT','secondary');}
 if(isRequester&&a.status==='WAITING_REVIEW'){btn('ผ่าน','REQUESTER_PASS');btn('ไม่ผ่าน','REQUESTER_FAIL','danger');}
 for(const btnNote of el.querySelectorAll('.media-note-save'))btnNote.addEventListener('click',async()=>{
  const input=[...el.querySelectorAll('.media-note-input')].find(x=>x.dataset.attachment===btnNote.dataset.attachment);
  if(!input)return;btnNote.disabled=true;try{await rpc('qa_v38_media_set_note',{p_attachment_id:btnNote.dataset.attachment,p_note:input.value});setNote('บันทึกหมายเหตุเรียบร้อย');}catch(e){setNote('บันทึกหมายเหตุไม่สำเร็จ: '+e.message,true)}finally{btnNote.disabled=false}
 });
 if(!responseEditable){for(const sel of ['.recv','.analysis','.fix']){const textarea=el.querySelector(sel);if(!textarea)continue;const plain=document.createElement('div');plain.className='read-text';plain.textContent=textarea.value||'-';textarea.replaceWith(plain)}}
 list.append(el);
 }
 renderTracker(detail);await renderHistory();
 }catch(e){setNote('อ่านใบงานไม่สำเร็จ: '+e.message,true);$('details').textContent='โปรดตรวจสิทธิ์ หรือกลับไปเปิดใบงานเดิม';}}
async function renderHistory(){
 const box=$('historyRows');box.replaceChildren();try{const events=await rpc('qa_v38_job_history',{p_job_id:jobId});
 const names={ACCEPT:'รับงาน',SAVE_DRAFT:'บันทึกการดำเนินการ',REQUEST_APPROVAL:'ส่งให้หัวหน้าอนุมัติ',APPROVE:'หัวหน้าอนุมัติ',RETURN:'หัวหน้าไม่อนุมัติ',REQUESTER_PASS:'ผู้แจ้งตรวจรับผ่าน',REQUESTER_FAIL:'ผู้แจ้งไม่ผ่านการตรวจรับ',UNRELATED_REQUEST:'แจ้งไม่เกี่ยวข้อง',UNRELATED_CONFIRM:'ผู้แจ้งยืนยันถอดแผนก',UNRELATED_REJECT:'ผู้แจ้งคงแผนกไว้'};
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
 all.forEach((a,i)=>{const b=document.createElement('button');b.type='button';b.textContent=a.department_code+' · '+label(a.status);b.onclick=()=>{panels.forEach((p,j)=>{p.hidden=j!==i});[...chips.children].forEach((c,j)=>c.classList.toggle('active',j===i));panels[i]?.scrollIntoView({behavior:'smooth',block:'start'});};chips.append(b);panels[i].hidden=i!==0;b.classList.toggle('active',i===0)});
}
async function act(a,action,el){let data={};if(action==='SAVE_DRAFT'||action==='REQUEST_APPROVAL'){data={receiver_problem_detail:el.querySelector('.recv').value,problem_analysis:el.querySelector('.analysis').value,corrective_action:el.querySelector('.fix').value,due_date:el.querySelector('.due').value};}
 if(action==='REQUEST_APPROVAL'&&el.querySelector('.responseFiles')?.files?.length){setNote('กรุณากดบันทึกร่างเพื่ออัปโหลดไฟล์แนบก่อน แล้วจึงส่งให้หัวหน้าตรวจสอบ',true);return;}
 if(['RETURN','REQUESTER_FAIL','UNRELATED_REQUEST'].includes(action)){const reason=prompt(action==='RETURN'?'ระบุเหตุผลที่ไม่อนุมัติ':action==='REQUESTER_FAIL'?'ระบุเหตุผลที่ไม่ผ่าน':'ระบุเหตุผลที่ไม่เกี่ยวข้อง');if(!reason?.trim())return;data={reason:reason.trim()};}
 if(action==='ACCEPT'&&QA.profile.role==='system_admin'){const comment=prompt('หมายเหตุรับงานแทนแผนก (แสดงให้แผนกนั้นเห็น)')||'';data={comment};}
 if(['APPROVE','REQUESTER_PASS','UNRELATED_CONFIRM'].includes(action)&&!confirm('ยืนยันการดำเนินการ?'))return;
 try{setNote('กำลังบันทึก...');let expected=a.version;
 if(action==='REQUEST_APPROVAL'){
   // Save any visible edits before requesting review; never silently discard input.
   const saved=await rpc('qa_vnext_assignment_action',{p_assignment_id:a.assignment_id,p_action:'SAVE_DRAFT',p_expected_version:expected,p_data:data});expected=saved.version;
 }
 const {data:result,error}=await QA.client.rpc('qa_vnext_assignment_action',{p_assignment_id:a.assignment_id,p_action:action,p_expected_version:expected,p_data:action==='REQUEST_APPROVAL'?{}:data});if(error)throw error;
 if(action==='SAVE_DRAFT'){const files=[...el.querySelector('.responseFiles')?.files||[]];if(files.length)await uploadResponse(a.assignment_id,files);}
 setNote('บันทึกสำเร็จ');await render();}catch(e){setNote('ไม่สามารถบันทึกได้: '+e.message,true);}}
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
     index++;table(sec,[['ปัญหาที่ '+index, 'ประเภท: '+(i.category_code||'-')+'\n'+(i.description||'-')]]);
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

async function boot(){for(let i=0;i<160&&!QA.profile;i++)await new Promise(r=>setTimeout(r,100));if(!QA.profile){setNote('Login ไม่พร้อม',true);return;}await render();}
boot();
})();
