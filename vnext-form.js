/* Complain VNext multi-issue form. Requires migrations 13..20.
   Creates one legacy-compatible parent plus all routing in one DB transaction.
   Media is uploaded afterwards and may require retry if network fails. */
(()=>{'use strict';
 if(new URLSearchParams(location.search).has('edit'))return;
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const problems=[];let seq=0,receivers=[],createdId='',createdCode='',requestId='',busy=false;
 const err=e=>e?.message||String(e);
 function status(msg,bad=false){const el=$('vnStatus');el.textContent=msg;el.style.color=bad?'#b91c1c':'#126332';}
 function rpc(name,args){return QA.client.rpc(name,args).then(({data,error})=>{if(error)throw error;return data;});}
 const style=document.createElement('style');style.textContent=`
 .vn-card{border:1px solid #d9e2ea;border-radius:11px;background:#fff;padding:15px;margin:12px 0}
 .vn-row{display:flex;gap:12px;flex-wrap:wrap}.vn-row>*{flex:1;min-width:180px}
 .vn-checks{display:flex;flex-wrap:wrap;gap:9px}.vn-checks label{border:1px solid #dae1ea;display:flex;align-items:center;gap:7px;padding:8px 10px;border-radius:8px;font-weight:400}
 .vn-checks input{width:auto}.vn-card textarea{min-height:82px}.vn-btn{border:1px solid #bdcad6;border-radius:8px;padding:10px 13px;cursor:pointer;background:#f1f5f9}
 .vn-files{font-size:12px;color:#526276}.vn-note{font-size:13px;color:#5b6675}
 .vn-source-choice{background:#f8fafc;border:2px solid #f59e0b;border-radius:10px;padding:10px 12px;margin:10px 0 14px}
 .vn-source-choice h3{font-family:Arial,sans-serif;font-size:16px;font-weight:600;margin:0 0 8px;color:#14274c}
 .vn-source-choice.chosen{border-color:#9db0c8;background:#f8fafc}
  .vn-source-buttons{display:grid;grid-template-columns:repeat(2,minmax(160px,1fr));gap:10px;margin:0}
 .vn-source-buttons button{background:white;color:#183153;border:2px solid #c0cedf;border-radius:8px;padding:9px 10px;min-height:46px;font-family:Arial,sans-serif;font-size:16px;font-weight:600;line-height:1.35;cursor:pointer;transition:background .15s,border-color .15s,box-shadow .15s}
 .vn-source-buttons button.active{background:#14274c;color:#fff;border-color:#14274c;box-shadow:0 0 0 3px #b8d1f3}
 .vn-source-buttons button:focus-visible{outline:3px solid #f59e0b;outline-offset:3px}
 @media(max-width:480px){.vn-source-buttons{grid-template-columns:1fr}.vn-source-buttons button{min-height:44px}}
 .vn-checks label{font-size:13px;font-weight:700;position:relative;cursor:pointer}.vn-checks label:has(input:checked){background:#14274c;color:#fff;border-color:#14274c}.vn-checks input{position:absolute;opacity:0;width:0;height:0}
 .vn-file-grid{display:flex;flex-wrap:wrap;gap:9px;margin:10px 0}.vn-file-item{width:125px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:9px;padding:6px}.vn-file-item img,.vn-file-item video{width:100%;height:78px;object-fit:contain;border-radius:6px;background:white}.vn-file-item textarea{width:100%;font-size:12px;min-height:53px;resize:vertical}.vn-file-item button{font-size:12px;padding:4px 7px}.vn-file-item span{display:block;height:78px;text-align:center;padding-top:20px;color:#64748b}
 /* V38: visual spacing inside each issue only; no changes to form logic */
 .vn-card{padding:20px 18px;margin:16px 0}
 .vn-card > .vn-row:first-child{margin-bottom:18px}
 .vn-card > .vn-row:first-child h3{margin:0;line-height:1.5}
 .vn-card > label{display:block;margin:0 0 18px;line-height:1.55}
 .vn-card > label > .vn-category,.vn-card > label > .vn-detail{display:block;margin-top:8px;margin-bottom:0}
 .vn-card > strong{display:block;line-height:1.55;margin:2px 0 11px}
 .vn-card > .vn-checks{margin-bottom:20px}
 .vn-card > .vn-row:not(:first-child){margin-bottom:12px}
 .vn-card > .vn-row:not(:first-child) label{line-height:1.5;margin-bottom:0}
 .vn-card > .vn-row:not(:first-child) input[type=file]{margin-top:9px}
 .vn-card > .vn-files{margin:12px 0 10px}
 .vn-card > .vn-file-grid{margin:12px 0 2px}
 .vn-card .vn-file-item textarea{margin-top:7px}
 `;document.head.append(style);
 function create(){return {id:++seq,images:[],video:[],notes:{},category:'',description:'',departments:[]};}
 problems.push(create());
 const oldProblem=$('problemDetail')?.closest('.card');if(!oldProblem)return;
 const panel=document.createElement('section');panel.className='card';panel.id='vnPanel';
 panel.innerHTML=`<div class="section-title">2. ปัญหาและฝ่ายรับเรื่อง</div><p class="vn-note">เพิ่มได้หลายปัญหา เลือกหลายฝ่ายต่อปัญหา และใช้เลขงานร่วมกัน</p>
 <div id="vnHeader" class="vn-row"><label>ประเภทงาน<select id="vnSource"><option value="" selected>-- เลือกประเภทงาน --</option><option value="PRODUCTION">Production</option><option value="AFTERSALES">Aftersales</option></select></label><label>Customer Name<input id="vnCustomer" maxlength="200"></label><label>Country<input id="vnCountry" maxlength="120"></label></div>
 <label>Remark<textarea id="vnRemark" maxlength="20000" placeholder="หมายเหตุ (ถ้ามี)"></textarea></label>
 <div id="vnProblems"></div><button type="button" class="vn-btn" id="vnAdd">+ เพิ่มปัญหา</button>
 <p id="vnStatus" role="status" aria-live="polite"></p>`;
 oldProblem.before(panel);oldProblem.style.display='none';
 // V38 creates its own new-job header; keep legacy hidden fields for DB compatibility.
 for(const id of ['issuerName','fromDepartment','toDepartment','priority','impact','location','downtimeMin','customerNameInput','countryInput']){
  const el=$(id);if(el?.closest('.field'))el.closest('.field').style.display='none';
 }
 const top=$('serialNo')?.closest('.card');const vnHeader=$('vnHeader');if(top&&vnHeader)top.append(vnHeader);
 const remark=$('vnRemark')?.closest('label');if(top&&remark)top.append(remark);
 const source=$('vnSource');source.value='';source.selectedIndex=0;source.parentElement.style.display='none';
 const chooser=document.createElement('div');chooser.className='vn-source-choice';chooser.innerHTML='<h3>เลือกประเภทงาน *</h3>';
 const buttons=document.createElement('div');buttons.className='vn-source-buttons';
 [['PRODUCTION','Production'],['AFTERSALES','Aftersales']].forEach(([key,name])=>{
  const b=document.createElement('button');b.type='button';b.textContent=name;b.dataset.value=key;
  b.onclick=()=>{source.value=key;chooser.classList.add('chosen');[...buttons.children].forEach(x=>{x.classList.toggle('active',x.dataset.value===key);x.setAttribute('aria-pressed',String(x.dataset.value===key))})};
  buttons.append(b);
 });chooser.append(buttons);top?.insertBefore(chooser,top.querySelector('.grid'));[...buttons.children].forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
 $('toDepartment').closest('.field').style.display='none';$('toDepartment').required=false;
 $('category').required=false;$('problemDetail').required=false;
 const oldImages=$('imageInput').closest('.card');oldImages.style.display='none';
 const baseSubmit=$('submitBtn');baseSubmit.textContent='แจ้งงาน';
 // Reset browser-restored source selection for a NEW job only (edit mode exits above).
 source.value='';source.selectedIndex=0;
 window.addEventListener('pageshow',()=>{source.value='';source.selectedIndex=0;chooser.classList.remove('chosen');[...buttons.children].forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});});
 function save(){for(const el of $('vnProblems').querySelectorAll('[data-issue]')){const i=problems.find(p=>p.id===+el.dataset.issue);if(!i)continue;i.category=el.querySelector('.vn-category').value;i.description=el.querySelector('.vn-detail').value;i.departments=[...el.querySelectorAll('.vn-dept:checked')].map(c=>c.value);}}
 function render(){const host=$('vnProblems');host.replaceChildren();problems.forEach((p,i)=>{
  const box=document.createElement('article');box.className='vn-card';box.dataset.issue=p.id;
  const opt=[...$('category').options].filter(x=>x.value).map(x=>`<option value="${esc(x.value)}">${esc(x.textContent)}</option>`).join('');
  box.innerHTML=`<div class="vn-row" style="align-items:center"><h3>ปัญหา ${i+1}</h3>${problems.length>1?'<button type="button" class="vn-btn vn-remove">ลบปัญหานี้</button>':''}</div>
  <label>ประเภทปัญหา *<select class="vn-category" required><option value="">-- เลือก Category --</option>${opt}</select></label>
  <label>รายละเอียดปัญหา *<textarea class="vn-detail" maxlength="20000" required></textarea></label>
  <strong>ฝ่ายรับเรื่อง * (เลือกได้มากกว่า 1)</strong><div class="vn-checks">${receivers.filter(x=>x.enabled).map(x=>`<label><input class="vn-dept" type="checkbox" value="${esc(x.code)}">${esc(x.code)}</label>`).join('')}</div>
  <div class="vn-row"><label>ภาพประกอบ (ไม่เกิน 5 ภาพ)<input type="file" accept="image/jpeg,image/png,image/webp" class="vn-images" multiple></label><label>วิดีโอ (ไม่เกิน 1 คลิป)<input type="file" accept="video/mp4,video/webm" class="vn-video"></label></div>
  <p class="vn-files"></p><div class="vn-file-grid"></div>`;
  box.querySelector('.vn-category').value=p.category;box.querySelector('.vn-detail').value=p.description;
  for(const ch of box.querySelectorAll('.vn-dept'))ch.checked=p.departments.includes(ch.value);
  box.querySelector('.vn-images').onchange=e=>{try{const files=[...e.target.files];window.QAMediaPicker.validate([...p.images,...p.video,...files]);p.images.push(...files);updateFiles();}catch(e){status(e.message,true);}finally{e.target.value='';}};
  box.querySelector('.vn-video').onchange=e=>{try{const files=[...e.target.files];window.QAMediaPicker.validate([...p.images,...p.video,...files]);p.video.push(...files);updateFiles();}catch(e){status(e.message,true);}finally{e.target.value='';}};
  let previewUrls=[];function updateFiles(){previewUrls.forEach(u=>URL.revokeObjectURL(u));previewUrls=[];box.querySelector('.vn-files').textContent=`${p.images.length} รูป · ${p.video.length} วิดีโอ`;
  const grid=box.querySelector('.vn-file-grid');grid.replaceChildren();
  const files=[...p.images.map((f,i)=>({f,kind:'image',i})),...p.video.map((f,i)=>({f,kind:'video',i}))];
  files.forEach(({f,kind,i})=>{
   const id=kind+'-'+i;const item=document.createElement('div');item.className='vn-file-item';
   const src=URL.createObjectURL(f);previewUrls.push(src);const media=document.createElement(kind==='image'?'img':'video');media.src=src;media.title='คลิกเพื่อดูตัวอย่าง';
   if(kind==='image')media.onclick=()=>window.open(src,'_blank','noopener');else{media.controls=true;media.preload='metadata';}
   const note=document.createElement('textarea');note.placeholder='หมายเหตุ';note.maxLength=2000;note.value=p.notes[id]||'';note.oninput=()=>p.notes[id]=note.value;
   item.append(media,note);
   if(kind==='image'&&window.V38ImageEditor){const edit=document.createElement('button');edit.type='button';edit.textContent='แก้ไขรูป';edit.onclick=async()=>{try{const result=await window.V38ImageEditor.edit(f);if(result){p.images[i]=result;updateFiles()}}catch(e){status('แก้ไขรูปไม่สำเร็จ: '+err(e),true)}};item.append(edit)}
   const remove=document.createElement('button');remove.type='button';remove.textContent='ลบ';remove.onclick=()=>{if(kind==='image'){p.images.splice(i,1);const next={};for(let x=0;x<p.images.length;x++)next['image-'+x]=p.notes['image-'+(x>=i?x+1:x)]||'';next['video-0']=p.notes['video-0']||'';p.notes=next;}else{p.video.splice(i,1);delete p.notes['video-0'];}updateFiles()};item.append(remove);
   grid.append(item);
  });
 }
  updateFiles();box.querySelector('.vn-remove')?.addEventListener('click',()=>{save();problems.splice(problems.indexOf(p),1);render();});host.append(box);
 });window.QA?.applyPermissions?.();}
 $('vnAdd').onclick=()=>{save();problems.push(create());render();};
 function collect(){save();if(!['PRODUCTION','AFTERSALES'].includes($('vnSource').value))throw new Error('กรุณาเลือกประเภทงาน Production หรือ Aftersales ก่อนแจ้งงาน');if(!receivers.some(x=>x.enabled))throw new Error('ยังไม่ได้กำหนดฝ่ายรับเรื่องใน Settings');
 const issues=problems.map((p,i)=>{if(!p.category||!p.description.trim()||p.departments.length===0)throw new Error(`ปัญหา ${i+1}: กรอกประเภท รายละเอียด และฝ่ายรับเรื่องให้ครบ`);
 return {category_code:p.category,description:p.description.trim(),departments:p.departments};});
 const header={serialNo:$('serialNo').value.trim(),priority:$('priority').value||'NORMAL',impact:$('impact').value.trim(),location:$('location').value.trim(),downtimeMin:$('downtimeMin').value||'',
 customerName:$('vnCustomer').value.trim(),country:$('vnCountry').value.trim(),remark:$('vnRemark').value.trim(),sourceType:$('vnSource').value};
 return {issues,header};}
 async function uploadMedia(jobId){for(let n=0;n<problems.length;n++){
 const issue=problems[n];if(!issue.uploaded)issue.uploaded=new Map();
 for(const file of [...issue.images,...issue.video]){
  const kind=file.type.startsWith('image/')?'IMAGE':'VIDEO';
  // Track by the File object itself; two files may share the same name and size.
  const noteKey=(kind==='IMAGE'?'image-':'video-')+(kind==='IMAGE'?issue.images.indexOf(file):issue.video.indexOf(file));
  let attachmentId=issue.uploaded.get(file);
  if(!attachmentId){
   const ext=file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)||'bin';
   const path=`${QA.profile.user_id}/${crypto.randomUUID()}.${ext}`;
   const {error:upError}=await QA.client.storage.from('qa-vnext-media').upload(path,file,{contentType:file.type,upsert:false});
   if(upError)throw new Error(`ใบงาน ${jobId} บันทึกแล้ว แต่ไฟล์ ${file.name} ยังไม่สำเร็จ: ${upError.message}`);
   let registered;
   try{
    registered=await rpc('qa_vnext_register_attachment',{p_job_id:jobId,p_scope:'ISSUE',p_issue_number:n+1,p_assignment_id:null,p_kind:kind,p_path:path,p_mime_type:file.type,p_size_bytes:file.size});
   }catch(e){
    // Remove the orphaned object if the database registration failed.
    const {error:cleanupError}=await QA.client.storage.from('qa-vnext-media').remove([path]);
    if(cleanupError)throw new Error(`ลงทะเบียนไฟล์ไม่สำเร็จ (${e.message}); ลบไฟล์ค้างไม่สำเร็จ (${cleanupError.message})`);
    throw e;
   }
   attachmentId=registered?.attachment_id;
   if(!attachmentId)throw new Error(`ลงทะเบียนไฟล์ ${file.name} แล้ว แต่ไม่พบรหัสไฟล์แนบ`);
   issue.uploaded.set(file,attachmentId);
  }
  // Retry a failed note update without re-uploading the already registered file.
  if(issue.notes[noteKey]?.trim())await rpc('qa_v38_media_set_note',{p_attachment_id:attachmentId,p_note:issue.notes[noteKey].trim()});
 }
} }

 async function loadScreenshot(){if(window.html2canvas)return;
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('ไม่สามารถโหลดตัวสร้างภาพ LINE'));document.head.append(s);});}
 function categoryDisplayName(code){const option=[...$('category').options].find(o=>o.value===code);return option?.textContent?.trim()||'ไม่พบชื่อประเภทปัญหา';}
 async function makeJobImage(jobId){await loadScreenshot();
  const matching=problems.map((p,i)=>({p,i}));
  const host=document.createElement('div');host.style.cssText='position:absolute;left:0;top:0;width:960px;background:#fff;padding:36px;font:18px Arial,Tahoma,sans-serif;line-height:1.65;z-index:999999;color:#172337';
  const heading=document.createElement('div');heading.innerHTML='<h1 style="font-size:29px;line-height:1.35;margin:0 0 15px">Complain &amp; Action Tracking</h1><div style="font-size:18px;margin:0 0 22px;line-height:1.6"><b>ใบแจ้งงาน:</b> '+esc(jobId)+'<span style="display:inline-block;margin-left:24px"><b>ประเภทงาน:</b> '+esc($('vnSource').value)+'</span></div>';
  host.append(heading);
  const hdr=document.createElement('div');hdr.style.cssText='padding:20px 22px;border:1px solid #d1d5db;border-radius:10px;margin-bottom:22px';
  const infoField=(name,value)=>'<div style="display:grid;grid-template-columns:134px minmax(0,1fr);column-gap:10px;align-items:start;line-height:1.6;overflow-wrap:anywhere"><b>'+name+'</b><span style="white-space:pre-wrap">'+esc(value||'-')+'</span></div>';
  hdr.innerHTML='<b style="display:block;font-size:20px;margin:0 0 16px">1. ข้อมูลการแจ้งเรื่อง</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:11px 22px">'+infoField('ประเภท:', $('vnSource').value)+infoField('Serial:', $('serialNo').value)+infoField('Customer:', $('vnCustomer').value)+infoField('Country:', $('vnCountry').value)+'</div><div style="margin-top:12px">'+infoField('Remark:', $('vnRemark').value)+'</div>';host.append(hdr);
  for(const {p,i} of matching){const block=document.createElement('section');block.style.cssText='padding:20px 22px;border:1px solid #d1d5db;border-radius:10px;margin-bottom:22px;page-break-inside:avoid';
   block.innerHTML='<b style="display:block;font-size:20px;margin-bottom:16px">2. รายละเอียดปัญหา '+(i+1)+'</b><div style="display:grid;gap:11px;margin-bottom:14px">'+infoField('Category:',categoryDisplayName(p.category))+infoField('ฝ่ายผู้แจ้ง:',String(QA.profile?.department||'').trim()||'-')+infoField('ฝ่ายรับเรื่อง:',p.departments.join(', '))+'</div><div style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65;margin:15px 0">'+esc(p.description)+'</div>';
   const row=document.createElement('div');row.style.cssText='display:flex;gap:10px;flex-wrap:wrap';
   for(const [fileIndex,f] of p.images.entries()){
    const item=document.createElement('div');item.style.cssText='width:170px;max-width:170px;break-inside:avoid;overflow-wrap:anywhere';
    const img=document.createElement('img');img.src=URL.createObjectURL(f);img.style.cssText='display:block;width:170px;height:125px;object-fit:contain;border:1px solid #d1d5db';item.append(img);
    const noteText=String(p.notes['image-'+fileIndex]||'').trim();
    if(noteText){const note=document.createElement('div');note.textContent=noteText;note.style.cssText='white-space:pre-wrap;font-size:14px;margin-top:5px;color:#334155';item.append(note);}
    row.append(item);
   }
   for(const [fileIndex,f] of p.video.entries()){
    const item=document.createElement('div');item.style.cssText='max-width:250px;break-inside:avoid;overflow-wrap:anywhere;font-size:14px';
    const label=document.createElement('strong');label.textContent='วิดีโอแนบ '+(fileIndex+1);item.append(label);
    const noteText=String(p.notes['video-'+fileIndex]||'').trim();
    if(noteText){const note=document.createElement('div');note.textContent=noteText;note.style.cssText='white-space:pre-wrap;margin-top:5px';item.append(note);}
    row.append(item);
   }
   block.append(row);host.append(block);
  }
  document.body.append(host);
  try{const imgs=[...host.querySelectorAll('img')];await Promise.all(imgs.map(img=>new Promise(r=>{if(img.complete)r();else{img.onload=r;img.onerror=r;}})));
   const c=await html2canvas(host,{scale:1,backgroundColor:'#fff',useCORS:true,logging:false});return c.toDataURL('image/png').split(',')[1];
  }finally{for(const img of host.querySelectorAll('img'))URL.revokeObjectURL(img.src);host.remove();}}
 async function notifyLine(jobId){
  status('กำลังสร้างภาพใบงานรวมทุกปัญหาและส่ง LINE ตามประเภทงาน...');
  const png=await makeJobImage(createdCode||jobId);
  const {data,error}=await QA.client.functions.invoke('vnext-new-job-line',{body:{job_id:jobId,png_base64:png}});
  if(error)throw new Error('บันทึกใบงานและไฟล์แนบแล้ว แต่ส่ง LINE ไม่สำเร็จ: '+err(error));
  if(data?.error)throw new Error(data.error);
  if(data?.skipped)throw new Error(data.reason||'LINE group not configured');
  if(!data?.sent)throw new Error('LINE did not confirm delivery');
 }
 // Once persisted, edits to the draft cannot change the already-created DB job.
 // Keep the submit button available exclusively for attachment / LINE retries.
 function lockSavedDraft(){
  // Some V38 fields were moved into the original header card, outside panel.
  // Freeze the entire form, not only the problems panel.
  for(const el of $('jobForm').querySelectorAll('input,select,textarea,button')){
   if(el===baseSubmit)continue;
   el.disabled=true;
  }
  baseSubmit.textContent='ลองส่งไฟล์แนบ / LINE อีกครั้ง';
 }
 async function submit(e){e.preventDefault();e.stopImmediatePropagation();if(busy)return;
 if(new URLSearchParams(location.search).has('edit')){status('ใบงานเก่าใช้การแก้ไขเดิม กรุณากลับไปหน้าใบงาน',true);return;}
 busy=true;baseSubmit.disabled=true;try{
  let jobId=createdId;
  if(!jobId){const {header,issues}=collect();requestId=requestId||crypto.randomUUID();
   status('กำลังบันทึกใบงานและส่งเข้าทุกแผนก...');
   const result=await rpc('qa_vnext_create_job',{p_data:header,p_issues:issues,p_files:[],p_request_id:requestId});
   jobId=String(result?.jobId||'');createdCode=String(result?.carCode||jobId);if(!jobId)throw new Error('ไม่พบหมายเลขงานที่บันทึก');createdId=jobId;
   sessionStorage.setItem('qa-vnext-latest',jobId);
   lockSavedDraft();
  }
  status(`สร้างใบงาน ${createdCode||jobId} แล้ว กำลังบันทึกไฟล์แนบ...`);
  await uploadMedia(jobId);
  let lineWarning='';
  try{await notifyLine(jobId);}catch(lineError){lineWarning=err(lineError);}
  if(lineWarning)sessionStorage.setItem('qa-v38-line-warning:'+jobId,lineWarning);
  status('บันทึกใบงานสำเร็จ กำลังเปิดรายละเอียด');
  location.replace('vnext-job.html?id='+encodeURIComponent(jobId));
 }catch(ex){status(err(ex)+(createdId?' — ระบบเก็บเลขงานไว้แล้ว อย่ากดสร้างซ้ำ กดปุ่มเดิมเพื่ออัปโหลดไฟล์อีกครั้ง':''),true);}
 finally{busy=false;baseSubmit.disabled=false;}}
 $('jobForm').addEventListener('submit',submit,true);
 async function init(){try{for(let i=0;i<140&&!QA.profile;i++)await new Promise(r=>setTimeout(r,100));if(!QA.profile)throw new Error('Login ไม่พร้อม');
 receivers=await rpc('qa_vnext_receivers',{});if(!Array.isArray(receivers))throw new Error('Receiving Settings ไม่พร้อม');
 render();}catch(e){status('VNext ใช้งานไม่ได้: '+err(e),true);baseSubmit.disabled=true;}}
 // The legacy category options load asynchronously.
 const o=new MutationObserver(()=>{save();render();});o.observe($('category'),{childList:true});
 init();
})();
