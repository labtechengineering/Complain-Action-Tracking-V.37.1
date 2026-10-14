(()=>{'use strict';const $=id=>document.getElementById(id);
async function rpc(name,params){const {data,error}=await QA.client.rpc(name,params);if(error)throw error;return data;}
async function load(){const box=$('vnReceivers');if(!box||QA.profile?.role!=='system_admin')return;
 try{const rows=await rpc('qa_vnext_receivers',{});box.replaceChildren();
 for(const d of rows){const el=document.createElement('label');el.style.cssText='display:flex;gap:12px;align-items:center;padding:9px;border-bottom:1px solid #e5e7eb;cursor:pointer';
 const cb=document.createElement('input');cb.type='checkbox';cb.checked=!!d.enabled;cb.style.width='18px';
 cb.onchange=async()=>{cb.disabled=true;try{await rpc('qa_vnext_set_receiver',{p_code:d.code,p_enabled:cb.checked});}catch(e){cb.checked=!cb.checked;alert(e.message);}finally{cb.disabled=false;}};
 el.append(cb,document.createTextNode(d.code+' — '+d.name));box.append(el);}
 if(!rows.length)box.textContent='เพิ่มแผนกที่ Master Data ก่อน';
 }catch(e){box.textContent='โหลดฝ่ายรับเรื่องไม่สำเร็จ: '+e.message;}}
 async function boot(){for(let i=0;i<160&&!QA.profile;i++)await new Promise(r=>setTimeout(r,100));await load();}
 boot();
})();
