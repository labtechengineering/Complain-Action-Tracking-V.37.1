(()=>{'use strict';const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const jobId=new URLSearchParams(location.search).get('id')||new URLSearchParams(location.search).get('job');let detail,media=[];const responseQueues=new Map(),responseDrafts=new Map();let activePickers=[];let mediaRoundReady=false;let departmentHighlightTimer;let trackerDepartment=new URLSearchParams(location.search).get('department')||'';let categoryNames=new Map();let receivingDepartments=[];let completedRounds=new Map();
async function loadCategoryNames(){const {data,error}=await QA.client.from('qa_settings').select('code,name').eq('setting_type','CATEGORY').range(0,999);if(error)throw error;categoryNames=new Map((data||[]).map(x=>[String(x.code),String(x.name||'')]));}
function categoryName(code){const key=String(code||'');return categoryNames.get(key)||'ไม่พบชื่อประเภทปัญหา';}
const setNote=(s,bad=false)=>{$('feedback').textContent=s;$('feedback').style.color=bad?'#b91c1c':'#166534';};
async function rpc(name,args){const {data,error}=await QA.client.rpc(name,args);if(error)throw error;return data;}
function label(s){return QAStatus.label(QAStatus.canonical(s));}
const signedUrls=new Map();
async function getUrl(path,download=false){
 const key=JSON.stringify([path,download]),cached=signedUrls.get(key);
 if(cached&&cached.expires>Date.now())return cached.promise;
 const entry={expires:Date.now()+14*60*1000};
 entry.promise=(async()=>{const {data,error}=await QA.client.storage.from('qa-vnext-media').createSignedUrl(path,900,download?{download:true}:undefined);if(error)throw error;return data.signedUrl;})();
 signedUrls.set(key,entry);try{return await entry.promise;}catch(error){if(signedUrls.get(key)===entry)signedUrls.delete(key);throw error;}
}
async function loadMedia(){try{return {rows:await rpc('qa_v52_media_list',{p_job_id:jobId}),roundReady:true};}
 catch(error){if(!['PGRST202','42883'].includes(String(error.code||'')))throw error;return {rows:await rpc('qa_vnext_media_list',{p_job_id:jobId}),roundReady:false};}}

async function mediaFor(issueIds,assignmentId,canEdit=false,round=null){const permitted=media.filter(m=>(m.scope==='ISSUE'&&issueIds.includes(m.issue_id))||(m.scope==='ASSIGNMENT'&&m.assignment_id===assignmentId&&(round===null||Number(m.response_round||1)===Number(round))));
 if(!permitted.length)return '<p class="muted">ไม่มีไฟล์แนบ</p>';
 const cards=await Promise.all(permitted.map(async m=>{try{const [view,downloadLink]=await Promise.all([getUrl(m.storage_path),getUrl(m.storage_path,true).catch(()=>null)]),download=downloadLink||view;
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

function captureDetailFocus(){
 const fold=[...document.querySelectorAll('.issue-disclosure')].find(n=>n.open);
 const focused=fold?.querySelector('.workflow-focus');
 return {issueId:fold?.dataset.issueId,assignmentId:focused?.dataset.assignment,
  sourceOpen:[...document.querySelectorAll('.issue-department-group')].filter(g=>g._sourceDisclosure?.open).map(g=>g.dataset.assignment),
  historyOpen:[...document.querySelectorAll('.prior-round-disclosure')].filter(n=>n.open).map(n=>n.querySelector('summary')?.textContent)};
}
function guideDetail(context={}){
 const all=detail?.assignments||[],rights=a=>QAWorkflow.permissions(QA.profile,detail,a,{legacyLocked:a._legacyLocked===true});
 const actionable=all.filter(a=>QAWorkflow.notices(QA.profile,detail,[a]).some(n=>n.action));
 const pending=all.filter(a=>{const q=rights(a);return q.canResolveUnrelated||q.canFinalReview||q.canApprove;});
 const hashIssue=QAStatus.issueFromHash(location.hash);
 const initial=!context.action&&!context.navigate&&!context.issueId&&!context.assignmentId;
 // A read-only visit starts at the status flow. A URL department/hash alone
 // must not turn somebody else's update into an action for this user.
 if(initial&&!actionable.length){
  document.querySelectorAll('.workflow-focus').forEach(n=>{n.classList.remove('workflow-focus');n.querySelector(':scope > .workflow-focus-hint')?.remove();});
  return;
 }
 const candidates=initial?actionable:all;
 let issueId=context.issueId||hashIssue,assignment=all.find(a=>String(a.assignment_id)===String(context.assignmentId));
 // After finishing a review, lead to the next pending decision when there is one.
 if(['APPROVE','RETURN','REQUESTER_PASS','UNRELATED_CONFIRM'].includes(context.action)&&pending.length){assignment=pending[0];issueId=assignment.issues?.[0]?.issue_id;}
 if(!assignment&&issueId)assignment=candidates.find(a=>(a.issues||[]).some(i=>String(i.issue_id)===String(issueId))&&(!trackerDepartment||a.department_code===trackerDepartment));
 if(!assignment&&trackerDepartment)assignment=candidates.find(a=>a.department_code===trackerDepartment);
 if(!assignment)assignment=pending[0]||candidates.find(a=>rights(a).canEdit)||candidates.find(a=>rights(a).canAccept);
 if(!assignment)return;
 const folds=[...document.querySelectorAll('.issue-disclosure')];
 const applies=f=>f.dataset.assignmentIds.split(',').includes(String(assignment.assignment_id));
 const fold=folds.find(f=>applies(f)&&String(f.dataset.issueId)===String(issueId))||folds.find(applies);
 if(!fold)return;fold._openIssue();
 const group=[...fold.querySelectorAll('.issue-operation-group')].find(g=>g.dataset.assignment===String(assignment.assignment_id));
 const source=[...fold.querySelectorAll('.received-issues')].find(n=>n.querySelector('.unaccepted-actions')?.dataset.assignment===String(assignment.assignment_id))||
  [...document.querySelectorAll('.issue-department-group')].find(g=>g.dataset.assignment===String(assignment.assignment_id))?._sourceDisclosure;
 const q=rights(assignment),review=q.canApprove||q.canFinalReview,unrelated=q.canResolveUnrelated;
 if(source?.tagName==='DETAILS')source.open=review||(context.sourceOpen||[]).includes(String(assignment.assignment_id));
 for(const old of fold.querySelectorAll('.prior-round-disclosure'))old.open=(context.historyOpen||[]).includes(old.querySelector('summary')?.textContent);
 const panel=group?.querySelector('.department-panel');
 const returnResult=panel?.querySelector('.requester-return-result');
 const handoffResult=context.action==='ACCEPT'&&q.system&&QAWorkflow.awaitingDepartmentWork(assignment);
 const target=handoffResult?(source?.querySelector('.system-accept-note')||source):returnResult|| (unrelated?source?.querySelector('.unrelated-routing')||group?.querySelector('.unrelated-routing'):
   q.canAccept?source?.querySelector('.unaccepted-actions'):context.action==='SAVE_DRAFT'?panel?.querySelector('.department-action-bar')||panel:panel||group||source);
 if(!target)return;
 document.querySelectorAll('.workflow-focus').forEach(n=>{n.classList.remove('workflow-focus');n.querySelector(':scope > .workflow-focus-hint')?.remove();});
 target.classList.add('workflow-focus');target.dataset.assignment=assignment.assignment_id;target.tabIndex=-1;
 const hint=document.createElement('p');hint.className='workflow-focus-hint';hint.setAttribute('role','status');
 hint.textContent=unrelated?'รอคุณพิจารณาแผนกรับผิดชอบ':review?(q.canFinalReview?'รอคุณตรวจสอบรายละเอียดและไฟล์แนบ แล้วเลือกผลตรวจด้านล่าง':'รอคุณตรวจสอบรายละเอียดและไฟล์แนบ แล้วเลือกอนุมัติหรือส่งกลับด้านล่าง'):
  q.canAccept?'รับงานของแผนก '+assignment.department_code+' ได้ที่นี่':q.canEdit?(context.action==='SAVE_DRAFT'?'บันทึกแบบร่างแล้ว — ยังไม่ได้ส่งงาน กดส่งด้านล่างเมื่อพร้อม':'กรอกข้อมูลการดำเนินงานและแนบไฟล์ได้ที่นี่'):'ผลการดำเนินการล่าสุดของแผนก '+assignment.department_code;
 if(!returnResult&&!handoffResult)target.prepend(hint);
 target.focus?.({preventScroll:true});
 target.scrollIntoView?.({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth',block:'start'});
}

function detailState(state){const host=$('captureArea');if(host){host.dataset.detailState=state;host.setAttribute('aria-busy',String(state==='loading'));}const loading=$('detailLoading');if(loading)loading.hidden=state!=='loading';$('pdfButton').disabled=state!=='ready';}
async function render(requestedFocus={}){const focusContext={...captureDetailFocus(),...requestedFocus};detailState('loading');activePickers.forEach(p=>p.destroy());activePickers=[];clearTimeout(departmentHighlightTimer);if(!jobId){setNote('ไม่พบหมายเลขงาน',true);detailState('error');return false;}
 try{
 // These secured reads use the same job ID and do not depend on one another.
 // Settle every read so optional history errors cannot reject an unread promise.
 signedUrls.clear();
 const loaded=await Promise.allSettled([
  loadCategoryNames(),rpc('qa_vnext_job_detail',{p_job_id:jobId}),loadMedia(),
  rpc('qa_v51_assignment_rounds',{p_job_id:jobId}),rpc('qa_issue_display_codes',{p_job_id:jobId}),
  rpc('qa_v38_job_history',{p_job_id:jobId})
 ]);
 for(const index of [0,1,2,4])if(loaded[index].status==='rejected')throw loaded[index].reason;
 detail=loaded[1].value;if(QA.profile?.role==='viewer')detail.can_manage_issues=false;
 detail.assignments=QAWorkflow.visibleAssignments(QA.profile,detail,detail.assignments||[]);
 media=loaded[2].value.rows;mediaRoundReady=loaded[2].value.roundReady;
 const codeRows=loaded[4].value;
 // Correction history remains supplementary and may fail independently.
 let archived=loaded[3].status==='fulfilled'?loaded[3].value:[],roundLoadWarning='';
 if(loaded[3].status==='rejected'){const error=loaded[3].reason;roundLoadWarning='โหลดประวัติการแก้ไขไม่สำเร็จ: '+(error?.message||String(error));console.warn('Correction rounds unavailable:',error);}
 completedRounds=new Map();for(const row of (Array.isArray(archived)?archived:[])){const key=String(row.assignment_id);if(!completedRounds.has(key))completedRounds.set(key,[]);completedRounds.get(key).push(row);}
 if(roundLoadWarning)setNote(roundLoadWarning,true);
 detail.assignments=(detail.assignments||[]).filter(a=>(a.issues||[]).length>0);
 if(!Array.isArray(media))media=[];
 // Warm each distinct file once while the page is assembled; all links still
 // come from authenticated Storage signing, never a public or elevated client.
 const paths=[...new Set(media.map(m=>m.storage_path).filter(Boolean))];
 void Promise.allSettled(paths.flatMap(path=>[getUrl(path),getUrl(path,true)]));
 if(detail.can_manage_issues||detail.assignments.some(a=>QAWorkflow.permissions(QA.profile,detail,a).canResolveUnrelated)){try{const rec=await rpc('qa_vnext_receivers',{});receivingDepartments=Array.isArray(rec)?rec.map(x=>({code:String(x.department_code||x.code||''),enabled:x.enabled!==false})).filter(x=>x.code&&x.enabled):[];}catch(_e){receivingDepartments=[];}}
 const editBtn=$('editRequestBtn');if(editBtn){editBtn.hidden=!detail.can_manage_issues;editBtn.textContent='แก้ไขใบแจ้ง';editBtn.onclick=()=>{document.querySelector('.issue-disclosure')?._openIssue();document.querySelectorAll('.issue-edit-controls').forEach(x=>{x.hidden=false;for(let p=x.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});const target=document.querySelector('.issue-edit-controls, .issue-reassign');if(target)target.scrollIntoView({behavior:'smooth',block:'center'});else setNote('งานนี้ไม่อยู่ในช่วงที่สามารถแก้ไขใบแจ้งได้',true);};}
 const pendingLine=sessionStorage.getItem('qa-v49-pending-line:'+jobId);if(pendingLine){try{receiverChangeRetryButton(JSON.parse(pendingLine));}catch(_e){sessionStorage.removeItem('qa-v49-pending-line:'+jobId);}}
 const warning=sessionStorage.getItem('qa-v38-line-warning:'+jobId);if(warning){setNote('บันทึกใบงานแล้ว แต่แจ้งเตือน LINE ไม่สำเร็จ: '+warning,true);sessionStorage.removeItem('qa-v38-line-warning:'+jobId);}
 $('details').innerHTML=`<h2>1. ข้อมูลการแจ้งเรื่อง</h2><div class="job-general-grid">
 <div class="job-general-field"><span class="job-general-label">ประเภทงาน:</span><span class="job-general-value">${esc(detail.source_type||'-')}</span></div>
 <div class="job-general-field"><span class="job-general-label">Serial Number:</span><span class="job-general-value">${esc(detail.serial_no||'-')}</span></div>
 <div class="job-general-field"><span class="job-general-label">ฝ่ายผู้แจ้ง:</span><span class="job-general-value">${esc(detail.from_department||'-')}</span></div>
 <div class="job-general-field"><span class="job-general-label">Customer Name:</span><span class="job-general-value">${esc(detail.customer_name||'-')}</span></div>
 <div class="job-general-field"><span class="job-general-label">Country:</span><span class="job-general-value">${esc(detail.country||'-')}</span></div>
 <div class="job-general-field job-general-wide"><span class="job-general-label">Remark:</span><span class="job-general-value">${esc(detail.requester_remark||'-')}</span></div>
 <div class="job-general-field job-general-wide job-general-date"><span class="job-general-label">วันที่สร้าง:</span><span class="job-general-value">${esc(detail.created_at?new Date(detail.created_at).toLocaleString('th-TH'):'-')}</span></div>
 </div>`;
 const list=$('assignments');list.replaceChildren();
 if(!detail.assignments?.length){list.innerHTML='<section class="sheet">ใบงานนี้ยังไม่มีรายละเอียดฝ่ายรับเรื่อง</section>';renderTracker(detail);detailState('ready');return true;}
 // Section 2 is one permanent container. Every issue remains visible in order.
 const issueSheet=document.createElement('section');issueSheet.className='sheet issues-section';issueSheet.id='allIssues';
 issueSheet.innerHTML='<h2>2. รายละเอียดปัญหา</h2><div id="allIssueCards"></div>';
 list.append(issueSheet);
 const issueHost=issueSheet.querySelector('#allIssueCards');
 // Source of truth for issue display codes is one secured RPC, not each user's visible subset.
 if(!Array.isArray(codeRows))throw new Error('ไม่พบข้อมูลเลขอ้างอิงปัญหา');
 const issueCodes=new Map(codeRows.map(x=>[String(x.assignment_id)+':'+String(x.issue_id),String(x.display_code)]));
 // Shared issue number: multiple departments must show exactly the same code.
 const issueCodeFor=(a,i)=>String(detail.car_code||detail.job_id)+'-'+String(i.issue_number||1).padStart(2,'0');
 const displayedIssues=new Set();
 for(const a of detail.assignments){
  const issueEditable=Boolean(detail.can_manage_issues)&&!a.unrelated_requested_at;
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

   cards.push(`<article class="issue issue-card" id="issue-${esc(i.issue_id)}-${esc(a.assignment_id)}" data-issue-id="${esc(i.issue_id)}"><h3><span class="issue-code">${esc(issueCodeFor(a,i))}</span> · ปัญหา ${esc(i.issue_number)} <span class="issue-category">${esc(categoryName(i.category_code))}</span></h3><p>${esc(i.description)}</p>${issueEditable?`<div class="no-print issue-edit-controls" hidden><label>แก้ไขรายละเอียดปัญหา<textarea class="issue-edit-description" data-issue-id="${esc(i.issue_id)}" maxlength="20000">${esc(i.description)}</textarea></label><button type="button" class="issue-edit-save" data-issue-id="${esc(i.issue_id)}">บันทึกการแก้ไขปัญหา</button></div>`:''}<b>ไฟล์แนบจากผู้แจ้ง</b>${await mediaFor([i.issue_id],null,issueEditable)}${issueEditable&&receivingDepartments.length?`<div class="no-print issue-reassign" data-issue-id="${esc(i.issue_id)}" data-original-department="${esc(a.department_code)}"><b>เปลี่ยนฝ่ายรับเรื่องจาก ${esc(a.department_code)} (ก่อนมีผู้รับงาน)</b><div class="receiver-checkboxes">${receivingDepartments.map(d=>`<label style="display:inline-flex;gap:6px;margin:6px 14px 6px 0"><input type="radio" name="receiver-${esc(a.assignment_id)}-${esc(i.issue_id)}" value="${esc(d.code)}">${esc(d.code)}</label>`).join('')}</div><button type="button" class="issue-reassign-save" data-issue-id="${esc(i.issue_id)}">บันทึกเปลี่ยนแผนก</button></div>`:''}${issueEditable?`<div class="no-print"><label>เพิ่มไฟล์ของปัญหา ${esc(i.issue_number)}<input class="issueFiles" data-issue-number="${esc(i.issue_number)}" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple></label></div>`:''}</article>`);
  }
  deptGroup.innerHTML=`<h3 class="issue-dept-title">แผนก ${esc(a.department_code||'-')}</h3>${cards.join('')||'<p class="muted">ไม่มีรายการปัญหาสำหรับแผนกนี้</p>'}`;
  issueHost.append(deptGroup);
 }
 // Keep issue editing and attachment upload handlers attached to the single section 2.
 for(const button of issueSheet.querySelectorAll('.issue-edit-save'))button.addEventListener('click',async()=>{
  const issueId=button.dataset.issueId;
  const area=button.closest('.issue-card')?.querySelector('.issue-edit-description');
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
  const root=button.closest('.issue-reassign');
  const selected=root.querySelector('input[type="radio"]:checked');
  const original=root.dataset.originalDepartment;
  const issueId=button.dataset.issueId;
  if(!selected){setNote('กรุณาเลือกฝ่ายรับเรื่องใหม่สำหรับแผนก '+original,true);return;}
  const target=selected.value;
  // The existing RPC updates the complete receiver set for one issue. Preserve
  // every other department when the user changes this one department card.
  const current=[...new Set((detail.assignments||[])
    .filter(a=>(a.issues||[]).some(i=>String(i.issue_id)===String(issueId)))
    .map(a=>String(a.department_code)))];
  if(!current.includes(original)){setNote('ข้อมูลฝ่ายรับเรื่องเปลี่ยนไป กรุณาโหลดใบงานใหม่',true);return;}
  if(target===original){setNote('เลือกแผนกเดิม '+original+' จึงไม่มีการเปลี่ยนแปลงและไม่ส่ง LINE');return;}
  if(current.includes(target)){setNote('ปัญหานี้ส่งให้แผนก '+target+' อยู่แล้ว กรุณาเลือกแผนกอื่นเพื่อไม่ให้การมอบหมายซ้ำกัน',true);return;}
  const codes=current.map(x=>x===original?target:x);
  if(!confirm('ยืนยันเปลี่ยนฝ่ายรับเรื่องจาก '+original+' เป็น '+target+'?\nแผนกอื่นคงเดิม เลขปัญหาไม่เปลี่ยน และระบบจะแจ้ง LINE กลุ่ม '+String(detail.source_type||'')+' หลังบันทึก'))return;
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
 // Keep each response beside its own assignment issues; never guess a per-issue mapping.
 for(const a of detail.assignments){
 const rights=QAWorkflow.permissions(QA.profile,detail,a,{hasResponseFiles:media.some(m=>m.scope==='ASSIGNMENT'&&m.assignment_id===a.assignment_id)});
 const mine=rights.own||rights.system;
 const isRequester=detail.is_requester||QA.profile?.role==='system_admin';
 // Department heads of the reporting department are the only intended final reviewers.
 const isFinalReviewer=rights.canFinalReview;
 const el=document.createElement('section');el.className='sheet department-panel';
 el.dataset.assignment=a.assignment_id;el.dataset.departmentCode=a.department_code;
 const isResponsible=String(a.responsible_user||'')===String(QA.profile?.user_id||'');
 const responseEditable=rights.canEdit;
 const pendingHeadReview=a.status==='IN_PROGRESS'&&Boolean(a.approval_requested_at);
 const showResponse=!QAWorkflow.awaitingDepartmentWork(a)&&(a.status!=='OPEN'||Boolean(a.responsible_user||a.accepted_at));
 // A requester should not see an empty Section 3 before the receiving department accepts.
 // Keep it available for the receiving department (including its acceptance controls).
 if(detail.is_requester && !mine && !showResponse && !rights.canResolveUnrelated && !QAWorkflow.awaitingDepartmentWork(a))continue;
 const priorRounds=(completedRounds.get(String(a.assignment_id))||[]).slice().sort((x,y)=>Number(x.round_no)-Number(y.round_no));
 const roundNumber=(priorRounds.length?Math.max(...priorRounds.map(r=>Number(r.round_no)||0)):0)+1;
 // A previously rejected job without a saved archive is NOT safe to edit: its old text
 // may still reside in the current assignment. Preserve it until audited repair SQL runs.
 const hasLegacyUnarchivedFailure=a.status==='IN_PROGRESS'&&!!String(a.requester_review_reason||'').trim()&&!a.approval_requested_at&&priorRounds.length===0;
 a._legacyLocked=hasLegacyUnarchivedFailure;
 const canEditCurrent=responseEditable&&!hasLegacyUnarchivedFailure&&!(priorRounds.length&&!mediaRoundReady);
 const afterRejection=priorRounds.length>0&&a.status==='IN_PROGRESS'&&!a.approval_requested_at;
 const hasCurrentResponse=['receiver_problem_detail','problem_analysis','corrective_action'].some(k=>String(a[k]||'').trim())||media.some(m=>m.scope==='ASSIGNMENT'&&m.assignment_id===a.assignment_id&&Number(m.response_round||1)===roundNumber);
 const hideEmptyRework=afterRejection&&!canEditCurrent&&!hasCurrentResponse;
 const rejectedReason=String(a.requester_review_reason||priorRounds[priorRounds.length-1]?.rejection_reason||'').trim();
 const earlier=(await Promise.all(priorRounds.map(async r=>`<section class="response-prior-round"><h3>บันทึกการแก้ไขครั้งที่ ${esc(r.round_no)} (อ่านอย่างเดียว)</h3><p class="muted">ผู้ตรวจรับไม่ผ่าน: ${esc(r.rejection_reason||'-')}</p><p><b>รายละเอียดปัญหา:</b> ${esc(r.receiver_problem_detail||'-')}</p><p><b>วิเคราะห์สาเหตุ:</b> ${esc(r.problem_analysis||'-')}</p><p><b>การแก้ไข:</b> ${esc(r.corrective_action||'-')}</p><p><b>กำหนดเสร็จ:</b> ${esc(r.due_date||'-')}</p><h3>ไฟล์แนบการแก้ไขรอบนี้</h3>${mediaRoundReady?await mediaFor([],a.assignment_id,false,Number(r.round_no)):'<p class="muted">ต้องอัปเดตส่วนแยกรอบไฟล์แนบใน Supabase ก่อนแสดงประวัติไฟล์</p>'}</section>`))).join('');
 const oldDataNotice=hasLegacyUnarchivedFailure?'<div class="rework-unarchived">รายการนี้เคยตรวจรับไม่ผ่านก่อนที่ระบบบันทึกรอบจะพร้อม ข้อมูลการแก้ไขเดิมถูกล็อกเพื่อไม่ให้เขียนทับ กรุณาตรวจสอบและรัน SQL ซ่อมประวัติงานค้างเดิมก่อนเริ่มการแก้ไขครั้งที่ 2</div>':'';
 // Files attached in earlier rounds are view-only on rework; historical text is immutable in the DB.
 const systemAcceptNote=String(a.system_accept_comment||'').trim();
 const systemAcceptHtml=systemAcceptNote?'<aside class="system-accept-note"><h3>หมายเหตุจาก System Admin (รับงานแทน)</h3><p>'+esc(systemAcceptNote)+'</p></aside>':'';
 const responseMedia=showResponse?(priorRounds.length&&!mediaRoundReady?'<p class="action-note">ยังแยกไฟล์แนบตามรอบไม่ได้ ต้องติดตั้งส่วน Supabase ให้ครบก่อนเริ่มรอบใหม่</p>':await mediaFor([],a.assignment_id,canEditCurrent,roundNumber)):'';
 const issueNumbers=(a.issues||[]).map(i=>String(i.issue_number)).join(', ');
 const sharedResponse=(a.issues||[]).length>1;
 el.innerHTML=`<h3 class="response-title">การดำเนินงาน — ${esc(a.department_code)} · ปัญหา ${esc(issueNumbers)} <span class="badge">${esc(label(a.status))}</span></h3>${sharedResponse&&showResponse?'<p class="shared-response-note">คำตอบรวมของแผนกสำหรับปัญหา '+esc(issueNumbers)+' · คำตอบนี้ใช้ร่วมกันทุกข้อที่ระบุ</p>':''}
 ${systemAcceptHtml}
 ${showResponse?(hideEmptyRework?`${earlier}${oldDataNotice}<p class="requester-return-result" role="status"><strong>ตรวจสอบไม่ผ่าน — ส่งกลับแก้ไข</strong><span>${esc(rejectedReason||'รอแผนกดำเนินการแก้ไข')}</span></p><div class="no-print actions"></div>`:`${earlier}${oldDataNotice}<h3>${priorRounds.length?'รายละเอียดการแก้ไขครั้งที่ '+roundNumber:'รายละเอียดการดำเนินการ'}</h3>${afterRejection?'<p class="rework-reminder">↩ ส่งกลับแก้ไข — กรุณากรอกข้อมูลการแก้ไขรอบใหม่ บันทึกครั้งก่อนอ่านได้อย่างเดียว</p>':''}<p><b>ผู้รับผิดชอบหลัก:</b> ${esc(a.responsible_name||a.responsible_user||'ยังไม่รับงาน')}</p>
 <div class="row"><label>วันกำหนดเสร็จ<input class="due" type="date" value="${esc(a.due_date||'')}" ${!canEditCurrent?'disabled':''}></label></div>
 <label class="field">รายละเอียดปัญหา<textarea class="recv" ${!canEditCurrent?'disabled':''}>${esc(a.receiver_problem_detail||'')}</textarea></label>
 <label class="field">วิเคราะห์สาเหตุ<textarea class="analysis" ${!canEditCurrent?'disabled':''}>${esc(a.problem_analysis||'')}</textarea></label>
 <label class="field">การแก้ไข<textarea class="fix" ${!canEditCurrent?'disabled':''}>${esc(a.corrective_action||'')}</textarea></label>
 <h3>ไฟล์แนบฝ่ายรับเรื่อง</h3><div class="current-response-media">${responseMedia}</div>
 
 ${canEditCurrent?'<div class="response-picker no-print"></div><p class="response-draft-state no-print" role="status" aria-live="polite"></p>':''}
 <div class="no-print actions"></div>
 <h3>การตรวจสอบและอนุมัติ</h3><p>${pendingHeadReview?'<strong class="head-review-alert">⏳ รอหัวหน้าแผนกรับเรื่องอนุมัติ</strong>':a.approved_at?'อนุมัติเมื่อ '+esc(new Date(a.approved_at).toLocaleString('th-TH')):esc(label(a.status))}</p>`) : ''}${!showResponse?'<p class="operation-waiting">รอการรับเรื่อง/ดำเนินงาน</p><div class="no-print actions"></div>':''}`;
 if(a.unrelated_requested_at&&a.status!=='CANCELLED'){const note=document.createElement('p');note.className='shared-response-note';note.textContent='รอพิจารณาฝ่ายรับเรื่อง: '+(a.unrelated_reason||'แจ้งว่าไม่เกี่ยวข้อง');el.prepend(note);}
 const actions=el.querySelector('.actions');
 function btn(text,action,color='secondary'){const b=document.createElement('button');b.textContent=text;b.className=color;b.onclick=()=>act(a,action,el);actions.append(b);}
 if(rights.canAccept){if(QA.profile?.role==='system_admin'){const note=document.createElement('label');note.className='admin-accept-comment';note.textContent='หมายเหตุรับงานแทนแผนก (ไม่บังคับ · สูงสุด 2,000 ตัวอักษร)';const area=document.createElement('textarea');area.className='admin-accept-input';area.placeholder='พิมพ์ข้อความถึงแผนกผู้รับเรื่อง ข้อความจะบันทึกไว้ในรายละเอียดหลังรับงาน';area.maxLength=2000;note.append(area);actions.append(note);}btn(QA.profile?.role==='system_admin'?'รับงานแทนแผนก':'รับงาน','ACCEPT');}
 if(canEditCurrent){btn('บันทึกแบบร่าง','SAVE_DRAFT');if(rights.canHeadSend)btn('ส่งงาน','HEAD_SEND');if(rights.canRequestApproval)btn('ส่งให้หัวหน้าตรวจสอบ','REQUEST_APPROVAL');}
 if(rights.canApprove){btn('อนุมัติและส่งงาน','APPROVE');btn('ส่งกลับให้แก้ไข','RETURN','danger');}
 if(isFinalReviewer){btn('ผ่าน','REQUESTER_PASS');btn('ไม่ผ่าน','REQUESTER_FAIL','danger');}
 if(rights.canRequestUnrelated)btn('แจ้งไม่เกี่ยวข้องกับแผนก','UNRELATED_REQUEST','secondary');
 if(rights.canResolveUnrelated){
  const routing=document.createElement('div');routing.className='unrelated-routing no-print';
  routing.innerHTML='<h3>พิจารณาแผนกรับผิดชอบ</h3><div class="unrelated-choices"><label><input type="radio" name="unrelated-'+esc(a.assignment_id)+'" value="change"> เปลี่ยนแผนก</label><label><input type="radio" name="unrelated-'+esc(a.assignment_id)+'" value="cancel"> ยกเลิกงานแผนกนี้</label></div><div class="unrelated-target-fields" hidden><label>ปัญหาที่ต้องการเปลี่ยน<select class="unrelated-issue">'+a.issues.map(i=>'<option value="'+esc(i.issue_id)+'">ปัญหา '+esc(i.issue_number)+' · '+esc(i.description)+'</option>').join('')+'</select></label><label>ฝ่ายรับเรื่องใหม่<select class="unrelated-target"><option value="">เลือกแผนกใหม่</option>'+receivingDepartments.filter(d=>d.code!==a.department_code).map(d=>'<option value="'+esc(d.code)+'">'+esc(d.code)+'</option>').join('')+'</select></label></div>';
  for(const input of routing.querySelectorAll('input[type=radio]'))input.onchange=()=>{routing.querySelector('.unrelated-target-fields').hidden=input.value!=='change';};
  const confirmButton=document.createElement('button');confirmButton.type='button';confirmButton.textContent='ยืนยัน';confirmButton.onclick=()=>{const choice=routing.querySelector('input[type=radio]:checked')?.value;if(!choice){setNote('เลือกเปลี่ยนแผนกหรือยกเลิกงานแผนกนี้ก่อนยืนยัน',true);return;}if(choice==='change')resolveUnrelatedReceiver(a,routing,confirmButton);else act(a,'UNRELATED_CONFIRM',el);};routing.append(confirmButton);el.append(routing);
 }
 // V49: system admin rollback is per assignment; SQL enforces transition/version/reason.
 if(rights.system){const back=rights.rollbackTarget;if(back){const b=document.createElement('button');b.type='button';b.className='danger';b.textContent='ย้อนสถานะ → '+label(back);b.onclick=()=>adminRollback(a,back);actions.append(b);}}
 for(const btnNote of el.querySelectorAll('.media-note-save'))btnNote.addEventListener('click',async()=>{
  const input=[...el.querySelectorAll('.media-note-input')].find(x=>x.dataset.attachment===btnNote.dataset.attachment);
  if(!input)return;btnNote.disabled=true;try{await rpc('qa_v38_media_set_note',{p_attachment_id:btnNote.dataset.attachment,p_note:input.value});setNote('บันทึกหมายเหตุเรียบร้อย');}catch(e){setNote('บันทึกหมายเหตุไม่สำเร็จ: '+e.message,true)}finally{btnNote.disabled=false}
 });
 if(canEditCurrent){
  const key=String(a.assignment_id)+':'+roundNumber;el.dataset.queueKey=key;
  if(!responseQueues.has(key))responseQueues.set(key,[]);
  const entries=responseQueues.get(key),registeredIds=new Set(media.map(m=>String(m.attachment_id)));
  for(let i=entries.length-1;i>=0;i--)if(entries[i].attachmentId&&registeredIds.has(String(entries[i].attachmentId))&&entries[i].savedNote===(entries[i].note||''))entries.splice(i,1);
  const saved=responseDrafts.get(key);if(saved&&saved.version===a.version)for(const [selector,value] of Object.entries(saved.values))el.querySelector(selector).value=value;
  const state=el.querySelector('.response-draft-state');const sendTarget=rights.canHeadSend?'ส่งงาน':'ส่งให้หัวหน้าตรวจสอบ';
  const dirty=()=>{responseDrafts.set(key,{version:a.version,values:Object.fromEntries(['.recv','.analysis','.fix','.due'].map(q=>[q,el.querySelector(q).value]))});state.textContent='มีการแก้ไขที่ยังไม่ได้บันทึกแบบร่าง และยังไม่ได้'+sendTarget;state.dataset.state='unsaved';const empty=el.querySelector('.current-response-media > p.muted');if(empty)empty.hidden=entries.length>0;};
  const persisted=['receiver_problem_detail','problem_analysis','corrective_action','due_date'].some(k=>String(a[k]||'').trim())||media.some(m=>m.scope==='ASSIGNMENT'&&m.assignment_id===a.assignment_id&&Number(m.response_round||1)===roundNumber);
  state.textContent=persisted?'บันทึกแบบร่างแล้ว — ยังไม่ได้'+sendTarget:'ยังไม่มีแบบร่างที่บันทึก — กรอกข้อมูลแล้วกดบันทึกแบบร่าง หรือ'+sendTarget+'ได้เลย';state.dataset.state=persisted?'draft':'empty';
  for(const field of el.querySelectorAll('.recv,.analysis,.fix,.due'))field.addEventListener('input',dirty);
  const currentFiles=media.filter(m=>m.scope==='ASSIGNMENT'&&m.assignment_id===a.assignment_id&&Number(m.response_round||1)===roundNumber);
  activePickers.push(QAMediaPicker.mount(el.querySelector('.response-picker'),{entries,existing:()=>({images:currentFiles.filter(m=>m.kind==='IMAGE').length,videos:currentFiles.filter(m=>m.kind==='VIDEO').length}),onChange:dirty,onError:message=>setNote(message,true)}));
  if(saved&&saved.version===a.version||entries.length)dirty();
 }
 if(!canEditCurrent){for(const sel of ['.recv','.analysis','.fix']){const textarea=el.querySelector(sel);if(!textarea)continue;const plain=document.createElement('div');plain.className='read-text';plain.textContent=textarea.value||'-';textarea.replaceWith(plain)}}
 const group=[...issueHost.querySelectorAll('.issue-department-group')].find(g=>g.dataset.assignment===String(a.assignment_id));
 // A single-issue assignment has an unambiguous mapping. A multi-issue
 // assignment retains one clearly labelled shared response instead of duplicating it.
 const responseHost=group&&((a.issues||[]).length===1?group.querySelector('.issue-card'):group);
 (responseHost||issueHost).append(el);
 if(actions.children.length){const outside=document.createElement('div');outside.className='department-action-bar no-print';outside.dataset.assignment=a.assignment_id;outside.append(...Array.from(actions.childNodes));actions.remove();el.append(outside);}
 }
 organizeDetailPanels(issueSheet,issueHost);renderTracker(detail);await renderHistory(loaded[5]);detailState('ready');guideDetail(focusContext);return true;
 }catch(e){setNote('อ่านใบงานไม่สำเร็จ: '+e.message,true);$('details').textContent='โปรดตรวจสิทธิ์ หรือกลับไปเปิดใบงานเดิม';$('assignments').replaceChildren();detailState('error');return false;}}
// Each issue is one collapsed list row. Move bound assignment forms between
// issue folds so a shared response has exactly one live editor and one version.
function organizeDetailPanels(issueSheet,issueHost){
 const assignments=detail.assignments||[],issues=new Map(),groups=new Map(),sourceCards=new Map();
 for(const a of assignments)for(const i of a.issues||[]){const key=String(i.issue_id);if(!issues.has(key))issues.set(key,{issue:i,assignments:[]});issues.get(key).assignments.push(a);}
 const storage=document.createElement('div');storage.className='issue-response-storage';storage.hidden=true;
 const cardBank=document.createElement('div'),panelBank=document.createElement('div');storage.append(cardBank,panelBank);
 const attention=a=>{const text=QAWorkflow.reviewAttention(QA.profile,detail,a);return text?'<span class="review-attention"><span aria-hidden="true">●</span> '+esc(text)+'</span>':'';};
 const badge=a=>attention(a)+'<span class="issue-status '+esc(QAStatus.canonical(a.status))+'">'+esc(label(a.status))+'</span>';
 for(const original of [...issueHost.querySelectorAll('.issue-department-group')]){
  const a=assignments.find(x=>String(x.assignment_id)===original.dataset.assignment);if(!a)continue;
  const panel=original.querySelector('.department-panel');if(panel)panel.remove();
  for(const card of [...original.querySelectorAll('.issue-card')]){sourceCards.set(String(a.assignment_id)+':'+card.dataset.issueId,card);cardBank.append(card);}
  const group=document.createElement('section');group.className='issue-department-group issue-operation-group';group.id=original.id;group.dataset.assignment=a.assignment_id;group.dataset.departmentCode=a.department_code;
  group.innerHTML='<div class="operation-department-heading"><strong>'+esc(a.department_code)+'</strong>'+badge(a)+'</div>';
  const accepted=!QAWorkflow.awaitingDepartmentWork(a)&&(Boolean(a.accepted_at||a.responsible_user)||['IN_PROGRESS','WAITING_REVIEW','CLOSED'].includes(a.status)),q=QAWorkflow.permissions(QA.profile,detail,a);
  const sources=document.createElement(accepted?'details':'div');sources.className='received-issues';sources.innerHTML=(accepted?'<summary>ข้อมูลปัญหาและไฟล์จากผู้แจ้ง</summary>':'<h3>ข้อมูลปัญหาและไฟล์จากผู้แจ้ง</h3>')+'<div class="source-issue-holder"></div>';
  if(!accepted){
   const dept=document.createElement('strong');dept.className='source-department-label';dept.textContent=a.department_code;group._sourceDepartmentLabel=dept;group.append(sources);
   if(panel){panel.querySelector('.response-title')?.remove();panel.querySelectorAll('.operation-waiting').forEach(n=>n.remove());panel.className='unaccepted-actions';if(panel.querySelector('button,.system-accept-note'))sources.append(panel);}
  }else if(panel){panel.querySelector('.response-title')?.remove();if(q.own||q.system)panel.prepend(sources);else group.append(sources);group.append(panel);}else group.append(sources);
  group._sourceDisclosure=sources;group._sourceParent=sources.parentElement;group._accepted=accepted;
  groups.set(String(a.assignment_id),group);panelBank.append(group);
 }
 issueHost.replaceChildren();issueSheet.append(storage);
 const count=document.createElement('p');count.className='section-count';count.textContent=issues.size+' ปัญหา · '+assignments.length+' แผนก';issueSheet.querySelector('h2').after(count);
 const columns=document.createElement('div');columns.className='issue-list-columns';columns.innerHTML='<span>ปัญหา</span><span>แผนกรับผิดชอบ / สถานะ</span>';issueHost.append(columns);
 let activeIssue=null;const folds=[];
 for(const {issue:i,assignments:related} of [...issues.values()].sort((a,b)=>Number(a.issue.issue_number)-Number(b.issue.issue_number))){
  const fold=document.createElement('details');fold.className='issue-disclosure';fold.dataset.issueId=String(i.issue_id);fold.dataset.assignmentIds=related.map(a=>String(a.assignment_id)).join(',');
  fold.innerHTML='<summary aria-label="ปัญหา '+esc(i.issue_number)+': '+esc(i.description)+'"><span class="issue-row-number">'+esc(i.issue_number)+'.</span><span class="issue-row-description" title="'+esc(i.description)+'">'+esc(i.description)+'</span><span class="issue-row-departments">'+related.map(a=>'<span class="issue-department-state"><span class="issue-responsible-department">'+esc(a.department_code)+'</span>'+badge(a)+'</span>').join('')+'</span><span class="issue-row-chevron" aria-hidden="true"></span></summary>';
  const body=document.createElement('div');body.className='issue-disclosure-body';body.innerHTML='<p class="expanded-issue-description">'+esc(i.description)+'</p><div class="issue-source-before-work"></div><h3 class="issue-operations-title" hidden>การดำเนินงาน</h3><div class="issue-operation-host" hidden></div>';fold.append(body);
  const mount=()=>{
   if(activeIssue===fold)return;
   for(const other of folds)if(other!==fold)other.open=false;
   // Return the previous issue's controls to storage before attaching this issue.
   for(const group of groups.values()){
    for(const card of [...group._sourceDisclosure.querySelectorAll('.source-issue-holder > .issue-card')])cardBank.append(card);
    const sources=group._sourceDisclosure;group._sourceParent.prepend(sources);if(sources?.tagName==='DETAILS')sources.open=false;panelBank.append(group);
   }
   const host=body.querySelector('.issue-operation-host');
   for(const a of related){const group=groups.get(String(a.assignment_id));if(!group)continue;const card=sourceCards.get(String(a.assignment_id)+':'+String(i.issue_id));if(card){if(!group._accepted&&group._sourceDepartmentLabel)card.prepend(group._sourceDepartmentLabel);group._sourceDisclosure.querySelector('.source-issue-holder').append(card);}if(!group._accepted)body.querySelector('.issue-source-before-work').append(group._sourceDisclosure);else host.append(group);}
   const hasOperations=host.children.length>0;host.hidden=!hasOperations;body.querySelector('.issue-operations-title').hidden=!hasOperations;
   activeIssue=fold;
  };
  fold._openIssue=()=>{mount();fold.open=true;};
  fold.addEventListener('toggle',()=>{if(fold.open)mount();});
  // Mounted on demand; guideDetail opens the relevant fold after render is ready.
  folds.push(fold);issueHost.append(fold);
 }
 // Old correction rounds stay inside their assignment and start collapsed too.
 for(const prior of issueSheet.querySelectorAll('.response-prior-round')){const fold=document.createElement('details');fold.className='prior-round-disclosure';const title=prior.querySelector('h3'),summary=document.createElement('summary');summary.textContent=title?.textContent||'ประวัติการแก้ไข';title?.remove();fold.append(summary);prior.replaceWith(fold);fold.append(prior);}
 const history=$('jobHistory');if(history&&!history.querySelector('details')){const fold=document.createElement('details'),summary=document.createElement('summary');summary.textContent='ประวัติการดำเนินงาน';history.querySelector('h2')?.remove();fold.append(summary,$('historyRows'));history.append(fold);}
}
async function renderHistory(result){
 const box=$('historyRows');box.replaceChildren();try{if(result.status==='rejected')throw result.reason;const events=result.value;
 const names={ACCEPT:'รับงาน',SAVE_DRAFT:'บันทึกการดำเนินการ',REQUEST_APPROVAL:'ส่งให้หัวหน้าอนุมัติ',HEAD_SEND:'หัวหน้าแผนกส่งงานโดยตรง',APPROVE:'หัวหน้าอนุมัติ',RETURN:'หัวหน้าไม่อนุมัติ',REQUESTER_PASS:'ผู้แจ้งตรวจรับผ่าน',REQUESTER_FAIL:'ผู้แจ้งไม่ผ่านการตรวจรับ',ADMIN_ROLLBACK:'System Admin ย้อนสถานะ',UNRELATED_REQUEST:'แจ้งไม่เกี่ยวข้อง',UNRELATED_CONFIRM:'ผู้แจ้งยืนยันถอดแผนก',UNRELATED_REJECT:'ผู้แจ้งคงแผนกไว้'};
 for(const e of events||[]){const div=document.createElement('div');div.className='history-row';div.textContent=new Date(e.created_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})+' · '+(e.department_code||'')+' · '+(names[e.action]||e.action);box.append(div)}
 if(!events?.length)box.textContent='ยังไม่มีประวัติการดำเนินงาน';
 }catch(e){box.textContent='ไม่สามารถโหลดประวัติ: '+e.message}
}
function renderTracker(d){
 const all=d.assignments||[];
 const issueId=QAStatus.issueFromHash(location.hash);
 const requestedDepartment=trackerDepartment;
 const idsParam=new URLSearchParams(location.search).get('assignments');
 const assignmentIds=idsParam===null?null:idsParam.split(',').filter(Boolean);
 let selectedDepartment=all.some(a=>String(a.department_code).toLowerCase()===requestedDepartment.toLowerCase())?requestedDepartment:'';
 const chips=$('departmentChips');chips.replaceChildren();
 function updateTracker(){
  const assignments=QAStatus.scope(all,{issueId,department:selectedDepartment,assignmentIds});
  const status=QAStatus.aggregate(assignments),current=QAStatus.stage(status);
  $('jobTrackerNumber').textContent=d.car_code||d.job_id;
  const issue=all.flatMap(a=>a.issues||[]).find(i=>String(i.issue_id)===issueId);
  $('trackerScope').textContent=selectedDepartment?'สถานะแผนก '+selectedDepartment:issueId?(issue?'สถานะปัญหา '+String(d.car_code||d.job_id)+'-'+String(issue.issue_number||1).padStart(2,'0'):'ไม่พบปัญหาที่ระบุในลิงก์'):'สถานะรวมของใบงาน';
  $('trackerStatus').textContent=QAStatus.label(status);let attention=$('trackerAttention');if(!attention){attention=document.createElement('div');attention.id='trackerAttention';$('trackerStatus').after(attention);}attention.className='review-attention';attention.textContent=assignments.some(a=>QAWorkflow.reviewAttention(QA.profile,d,a))?'● '+[...new Set(assignments.map(a=>QAWorkflow.reviewAttention(QA.profile,d,a)).filter(Boolean))].join(' · '):'';
  $('jobTracker').classList.toggle('is-mixed',status==='MIXED');
  document.querySelectorAll('.tracker-stages [data-step]').forEach((el,i)=>{
   el.classList.toggle('done',current>=0&&i<current);el.classList.toggle('current',i===current);
   if(i===current)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');
  });
  document.querySelector('.tracker-stages')?.style.setProperty('--track-progress',String(Math.max(0,current)*25)+'%');
  [...chips.children].forEach(b=>{const selected=b.dataset.department===selectedDepartment;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
 }
 all.forEach(a=>{const b=document.createElement('button');b.type='button';b.dataset.department=a.department_code;b.textContent=a.department_code+' · '+label(a.status);b.setAttribute('aria-pressed','false');b.onclick=()=>{
  clearTimeout(departmentHighlightTimer);
  document.querySelectorAll('.issue-dept-highlight').forEach(g=>g.classList.remove('issue-dept-highlight'));
  selectedDepartment=selectedDepartment===a.department_code?'':a.department_code;
  trackerDepartment=selectedDepartment;updateTracker();
  if(!selectedDepartment)return;
  guideDetail({assignmentId:a.assignment_id,issueId,navigate:true});
 };chips.append(b)});
 updateTracker();
}
window.addEventListener('hashchange',()=>{if(detail){renderTracker(detail);guideDetail({issueId:QAStatus.issueFromHash(location.hash),navigate:true});}});

async function resolveUnrelatedReceiver(a,root,button){
 if(!QAWorkflow.permissions(QA.profile,detail,a).canResolveUnrelated){setNote('เฉพาะหัวหน้าฝ่ายผู้แจ้งหรือ System Admin เท่านั้นที่พิจารณาได้',true);return;}
 const issueId=root.querySelector('.unrelated-issue').value,target=root.querySelector('.unrelated-target').value;
 if(!target){setNote('กรุณาเลือกฝ่ายรับเรื่องใหม่',true);return;}
 const issue=a.issues.find(i=>String(i.issue_id)===issueId);if(!issue)return;
 const others=detail.assignments.filter(x=>x.assignment_id!==a.assignment_id&&x.issues.some(i=>String(i.issue_id)===issueId)).map(x=>x.department_code);
 const departments=[...new Set([...others,target])];
 if(!confirm('ย้ายเฉพาะปัญหา '+issue.issue_number+' จาก '+a.department_code+' ไป '+target+'?\nปัญหาข้ออื่นของแผนกนี้และฝ่ายรับเรื่องอื่นยังคงเดิม'))return;
 button.disabled=true;
 try{
  const result=await rpc('qa_v51_resolve_unrelated_change',{p_issue_id:issueId,p_assignment_id:a.assignment_id,p_expected_version:a.version,p_departments:departments});
  await render();
  
  if(result.event_id){const event={event_id:result.event_id,issue_id:issueId,issue_number:issue.issue_number,old_departments:result.old_departments,new_departments:result.new_departments};sessionStorage.setItem('qa-v49-pending-line:'+jobId,JSON.stringify(event));await notifyReceiverChange(event);}
  else setNote('เปลี่ยนฝ่ายรับเรื่องแล้ว');
 }catch(e){setNote('เปลี่ยนฝ่ายรับเรื่องไม่สำเร็จ: '+e.message,true);button.disabled=false;}
}
const pendingAssignmentActions=new Set();
async function act(a,action,el){
 if(pendingAssignmentActions.has(a.assignment_id))return;
 if(!QAWorkflow.allowed(action,QA.profile,detail,a,{legacyLocked:a._legacyLocked===true})){setNote('บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้ในสถานะปัจจุบัน',true);return;}
 let data={};if(['SAVE_DRAFT','REQUEST_APPROVAL','HEAD_SEND'].includes(action)){data={receiver_problem_detail:el.querySelector('.recv').value,problem_analysis:el.querySelector('.analysis').value,corrective_action:el.querySelector('.fix').value,due_date:el.querySelector('.due').value};}
 if(action==='UNRELATED_REQUEST'){const reason=prompt('แจ้งไม่เกี่ยวข้องกับแผนก '+a.department_code+' ก่อนรับงาน\nครอบคลุมปัญหา '+a.issues.map(i=>i.issue_number).join(', ')+' ที่แผนกนี้ได้รับ\nระบุเหตุผลเพื่อส่งให้หัวหน้าฝ่ายผู้แจ้งพิจารณา');if(!reason?.trim())return;data={reason:reason.trim()};}
 if(action==='UNRELATED_CONFIRM'&&!confirm('ยืนยันว่าแผนก '+a.department_code+' ไม่เกี่ยวข้องกับปัญหา '+a.issues.map(i=>i.issue_number).join(', ')+' ทั้งหมดที่แผนกนี้ได้รับ?\nจะยกเลิกเฉพาะการมอบหมายให้แผนกนี้ แผนกอื่นคงเดิม'))return;
 if(['RETURN','REQUESTER_FAIL'].includes(action)){const reason=prompt(action==='RETURN'?'ระบุเหตุผลที่ไม่อนุมัติ':'ระบุเหตุผลที่ไม่ผ่าน');if(!reason?.trim())return;data={reason:reason.trim()};}
 if(action==='ACCEPT'&&QA.profile.role==='system_admin'){data={comment:el.querySelector('.admin-accept-input')?.value.trim()||''};if(data.comment.length>2000){setNote('หมายเหตุรับงานแทนต้องไม่เกิน 2,000 ตัวอักษร',true);return;}}
 if(['APPROVE','REQUESTER_PASS','UNRELATED_REJECT'].includes(action)&&!confirm('ยืนยันการดำเนินการ?'))return;
 const actionBar=document.querySelector('.department-action-bar[data-assignment="'+CSS.escape(String(a.assignment_id))+'"]');
 const buttons=[...(actionBar?.querySelectorAll('button')||[])];
 pendingAssignmentActions.add(a.assignment_id);el.inert=true;
 buttons.forEach(b=>{b.disabled=true;b.setAttribute('aria-busy','true');b.dataset.originalText=b.textContent;});
 const pressed=buttons.find(b=>b.dataset.originalText===({HEAD_SEND:'ส่งงาน',REQUEST_APPROVAL:'ส่งให้หัวหน้าตรวจสอบ',APPROVE:'อนุมัติและส่งงาน'}[action]||''));
 if(pressed)pressed.textContent='กำลังบันทึก...';
 try{setNote('กำลังบันทึก...');let expected=a.version;let result;
 if(['SAVE_DRAFT','REQUEST_APPROVAL','HEAD_SEND'].includes(action)){
   const saved=await rpc('qa_vnext_assignment_action',{p_assignment_id:a.assignment_id,p_action:'SAVE_DRAFT',p_expected_version:expected,p_data:data});
   expected=Number(saved.version);if(!Number.isInteger(expected)||expected<1)throw new Error('INVALID_SAVED_VERSION');a.version=expected;
   const draft=responseDrafts.get(el.dataset.queueKey);if(draft)draft.version=expected;
   const state=el.querySelector('.response-draft-state');if(state){state.textContent='บันทึกข้อความแบบร่างแล้ว กำลังตรวจไฟล์แนบ — ยังไม่ได้ส่ง';state.dataset.state='draft';}
   await uploadResponse(a.assignment_id,responseQueues.get(el.dataset.queueKey)||[]);
   if(action==='SAVE_DRAFT')result=saved;
 }
 if(action!=='SAVE_DRAFT')result=await rpc('qa_vnext_assignment_action',{p_assignment_id:a.assignment_id,p_action:action,p_expected_version:expected,p_data:['REQUEST_APPROVAL','HEAD_SEND'].includes(action)?{}:data});
 if(el.dataset.queueKey){responseDrafts.delete(el.dataset.queueKey);responseQueues.delete(el.dataset.queueKey);}
 setNote(action==='SAVE_DRAFT'?(QAWorkflow.permissions(QA.profile,detail,a).canHeadSend?'บันทึกแบบร่างแล้ว — ยังไม่ได้ส่งงาน':'บันทึกแบบร่างแล้ว — ยังไม่ได้ส่งหัวหน้าตรวจสอบ'):['REQUEST_APPROVAL','HEAD_SEND'].includes(action)?'ส่งงานสำเร็จ':'บันทึกสำเร็จ');await render({assignmentId:a.assignment_id,action});
 }catch(e){
  if(String(e.message||e).includes('VERSION_CONFLICT')){setNote('ข้อมูลใบงานถูกอัปเดตระหว่างเปิดหน้านี้ กำลังโหลดข้อมูลล่าสุด กรุณาตรวจสอบก่อนกดส่งงานอีกครั้ง',true);await render({assignmentId:a.assignment_id});}
  else{const state=el.querySelector('.response-draft-state');if(state&&['SAVE_DRAFT','REQUEST_APPROVAL','HEAD_SEND'].includes(action)){state.textContent='บันทึก/ส่งงานยังไม่ครบ — ตรวจข้อความแจ้งข้อผิดพลาดแล้วกดอีกครั้ง ยังไม่ได้ส่ง';state.dataset.state='unsaved';}setNote('ไม่สามารถบันทึกได้: '+e.message,true);}
 }finally{el.inert=false;pendingAssignmentActions.delete(a.assignment_id);buttons.forEach(b=>{b.disabled=false;b.removeAttribute('aria-busy');if(b.dataset.originalText)b.textContent=b.dataset.originalText;});}
}
async function adminRollback(a,target){
 if(QA.profile?.role!=='system_admin'){setNote('เฉพาะ System Admin เท่านั้น',true);return;}
 const reason=prompt('ระบุเหตุผลในการย้อนสถานะของแผนก '+a.department_code+' จาก '+label(a.status)+' ไป '+label(target)+' (จำเป็น)');
 if(reason===null)return;
 if(!reason.trim()){setNote('ต้องระบุเหตุผลในการย้อนสถานะ',true);return;}
 if(!confirm('ยืนยันย้อนสถานะแผนก '+a.department_code+'?\nระบบจะเก็บประวัติการย้อนสถานะ และไม่เปลี่ยนแปลงแผนกอื่น'))return;
 try{setNote('กำลังย้อนสถานะ...');await rpc('qa_vnext_admin_rollback_assignment',{p_assignment_id:a.assignment_id,p_target_status:target,p_expected_version:a.version,p_reason:reason.trim()});setNote('ย้อนสถานะเรียบร้อย');await render({assignmentId:a.assignment_id});}
 catch(e){setNote('ย้อนสถานะไม่สำเร็จ: '+e.message,true);}
}
async function uploadIssue(issueNumber,files){const imgs=files.filter(f=>f.type.startsWith('image/'));const vids=files.filter(f=>f.type.startsWith('video/'));
 if(imgs.length>5||vids.length>1||imgs.length+vids.length!==files.length)throw new Error('เลือกได้สูงสุด 5 รูปและ 1 วิดีโอ');
 for(const f of files){const limit=f.type.startsWith('image/')?5242880:52428800;if(f.size>limit)throw new Error('ขนาดไฟล์เกิน '+f.name);
 const path=`${QA.profile.user_id}/${crypto.randomUUID()}.${f.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)||'bin'}`;
 const {error}=await QA.client.storage.from('qa-vnext-media').upload(path,f,{contentType:f.type,upsert:false});if(error)throw error;
 try{await rpc('qa_vnext_register_attachment',{p_job_id:jobId,p_scope:'ISSUE',p_issue_number:issueNumber,p_assignment_id:null,p_kind:f.type.startsWith('image/')?'IMAGE':'VIDEO',p_path:path,p_mime_type:f.type,p_size_bytes:f.size});}catch(e){try{await QA.client.storage.from('qa-vnext-media').remove([path]);}catch{}throw e;}}}
async function uploadResponse(assignmentId,entries){
 for(const entry of entries){const file=entry.file;QAMediaPicker.validate([file]);
  if(!entry.attachmentId){const ext=file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)||'bin',path=`${QA.profile.user_id}/${crypto.randomUUID()}.${ext}`;
   const {error}=await QA.client.storage.from('qa-vnext-media').upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;
   try{const registered=await rpc('qa_vnext_register_attachment',{p_job_id:jobId,p_scope:'ASSIGNMENT',p_issue_number:null,p_assignment_id:assignmentId,p_kind:file.type.startsWith('image/')?'IMAGE':'VIDEO',p_path:path,p_mime_type:file.type,p_size_bytes:file.size});if(!registered?.attachment_id)throw Error('ลงทะเบียนไฟล์แนบไม่สำเร็จ');entry.attachmentId=registered.attachment_id;}
   catch(e){try{await QA.client.storage.from('qa-vnext-media').remove([path]);}catch{}throw e;}
  }
  const note=entry.note||'';if(entry.savedNote!==note){if(note||entry.savedNote!==undefined)await rpc('qa_v38_media_set_note',{p_attachment_id:entry.attachmentId,p_note:note});entry.savedNote=note;}
 }
}
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
   if(QAWorkflow.awaitingDepartmentWork(a)){if(String(a.system_accept_comment||'').trim())table(sec,[['หมายเหตุจาก System Admin (รับงานแทน)',a.system_accept_comment]]);continue;}
   const work=add('div','',sec);add('h3','การดำเนินการและผลตรวจสอบ — '+a.department_code+' · ปัญหา '+(a.issues||[]).map(i=>i.issue_number).join(', '),work);if((a.issues||[]).length>1)add('p','คำตอบรวมของแผนกสำหรับปัญหาข้างต้น ข้อมูลเดิมยังไม่ได้แยกคำตอบรายข้อ',work);
   table(work,[['สถานะ',label(a.status)],['ผู้รับผิดชอบ',a.responsible_name||a.responsible_user||'-'],...(String(a.system_accept_comment||'').trim()?[['หมายเหตุจาก System Admin (รับงานแทน)',a.system_accept_comment]]:[]),['ปัญหา',a.receiver_problem_detail],['วิเคราะห์สาเหตุ',a.problem_analysis],['การแก้ไขและป้องกัน',a.corrective_action],['กำหนดเสร็จ',a.due_date],['หัวหน้าอนุมัติ',a.approved_at?new Date(a.approved_at).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'}):'-']]);
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

async function boot(){for(let i=0;i<160&&!QA.profile;i++)await new Promise(r=>setTimeout(r,100));if(!QA.profile){setNote('Login ไม่พร้อม',true);detailState('error');return;}if(await render())await window.QAReadState?.markOpened(detail);}
boot();
})();
