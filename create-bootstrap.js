/* Master categories for the one active multi-issue form. */
(()=>{'use strict';
document.addEventListener('DOMContentLoaded',async()=>{
 try{
  await QA.whenReady();
  const data=await QA.api.getSettings(),category=document.getElementById('category');
  for(const item of data.categories||[]){const option=document.createElement('option');option.value=item.code;option.textContent=item.name;category.append(option);}
 }catch(e){const box=document.getElementById('messageBox');box.textContent='โหลดประเภทปัญหาไม่สำเร็จ: '+(e?.message||String(e));box.style.display='block';box.setAttribute('role','alert');document.getElementById('submitBtn').disabled=true;}
});
})();
