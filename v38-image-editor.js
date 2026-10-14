/* Client-side image annotator for V38 new-job attachments. No server writes occur until form submission. */
(()=>{'use strict';
 function edit(file){return new Promise((resolve,reject)=>{
  const objectUrl=URL.createObjectURL(file),img=new Image();
  img.onerror=()=>{URL.revokeObjectURL(objectUrl);reject(new Error('ไม่สามารถเปิดภาพ'))};
  img.onload=()=>{
   URL.revokeObjectURL(objectUrl);
   const scale=Math.min(1,1200/Math.max(img.naturalWidth,img.naturalHeight));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   const ctx=canvas.getContext('2d');if(!ctx){reject(new Error('Canvas ไม่พร้อม'));return}
   const wrapper=document.createElement('div');wrapper.className='v38-editor-backdrop';wrapper.innerHTML=`<div class="v38-editor" role="dialog" aria-modal="true" aria-label="แก้ไขภาพ"><div class="v38-editor-tools"><button type="button" data-tool="draw">วาด</button><button type="button" data-tool="line">เส้นตรง</button><button type="button" data-tool="text">ข้อความ</button><label>ขนาดอักษร <input type="range" min="12" max="80" value="28" class="v38-fontsize"><span class="v38-size">28</span></label><button type="button" data-tool="undo">ย้อนกลับ</button><button type="button" data-tool="save">บันทึกภาพ</button><button type="button" data-tool="cancel">ยกเลิก</button></div><div class="v38-editor-canvas"></div><p class="v38-editor-hint">ลากเพื่อวาดหรือขยับข้อความ · คลิกเครื่องมือ “ข้อความ” เพื่อเพิ่มข้อความ</p></div>`;
   const css=document.createElement('style');css.textContent=`.v38-editor-backdrop{position:fixed;inset:0;background:#091329b8;z-index:999999;display:grid;place-items:center;padding:12px}.v38-editor{max-width:96vw;max-height:96vh;overflow:auto;background:#fff;padding:16px;border-radius:15px;box-shadow:0 12px 45px #0003}.v38-editor-tools{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:12px}.v38-editor-tools button{border:1px solid #cbd5e1;background:#f1f5f9;color:#172337;border-radius:8px;padding:7px 12px;cursor:pointer}.v38-editor-tools button.active{background:#14274c;color:#fff}.v38-editor-tools label{font-size:12px;display:flex;align-items:center;gap:5px}.v38-editor-canvas{overflow:auto;max-height:70vh;background:#e5e7eb;display:flex;justify-content:center}.v38-editor-canvas canvas{max-width:100%;max-height:70vh;touch-action:none}.v38-editor-hint{font-size:12px;color:#64748b;margin:8px 0 0}`;
   document.head.append(css);document.body.append(wrapper);
   wrapper.querySelector('.v38-editor-canvas').append(canvas);
   let tool='draw',actions=[],history=[],drawing=null,selected=-1,dragging=false;
   function snapshot(){history.push(JSON.stringify(actions));if(history.length>80)history.shift()}
   function paint(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    for(const act of [...actions,...(drawing?[drawing]:[])]){
     ctx.save();ctx.strokeStyle='#e03131';ctx.fillStyle='#e03131';ctx.lineWidth=Math.max(2,Math.round(canvas.width/450));ctx.lineJoin='round';ctx.lineCap='round';
     if(act.tool==='draw'&&act.points?.length){ctx.beginPath();ctx.moveTo(...act.points[0]);for(const p of act.points.slice(1))ctx.lineTo(...p);ctx.stroke()}
     if(act.tool==='line'){ctx.beginPath();ctx.moveTo(act.x,act.y);ctx.lineTo(act.x2,act.y2);ctx.stroke()}
     if(act.tool==='text'){ctx.font=`bold ${act.size}px Arial,Tahoma,sans-serif`;ctx.fillText(act.text,act.x,act.y);if(selected===actions.indexOf(act)){const w=ctx.measureText(act.text).width;ctx.strokeStyle='#2563eb';ctx.lineWidth=1;ctx.strokeRect(act.x-4,act.y-act.size-3,w+8,act.size+10)}}
     ctx.restore();
    }
   }
   function at(event){const r=canvas.getBoundingClientRect();return {x:(event.clientX-r.left)*canvas.width/r.width,y:(event.clientY-r.top)*canvas.height/r.height}}
   function findText(pt){for(let i=actions.length-1;i>=0;i--){const a=actions[i];if(a.tool!=='text')continue;ctx.font=`bold ${a.size}px Arial`;const w=ctx.measureText(a.text).width;if(pt.x>=a.x-8&&pt.x<=a.x+w+8&&pt.y>=a.y-a.size-10&&pt.y<=a.y+12)return i}return -1}
   function setTool(next){tool=next;wrapper.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));selected=-1;paint()}
   canvas.addEventListener('pointerdown',event=>{const pt=at(event);canvas.setPointerCapture(event.pointerId);
    if(tool==='text'){selected=findText(pt);if(selected>=0){snapshot();dragging=true}else{const t=prompt('เพิ่มข้อความบนภาพ');if(t?.trim()){snapshot();const size=Number(wrapper.querySelector('.v38-fontsize').value);actions.push({tool:'text',text:t.trim().slice(0,300),x:pt.x,y:pt.y,size});selected=actions.length-1}paint()}return}
    snapshot();drawing=tool==='line'?{tool:'line',x:pt.x,y:pt.y,x2:pt.x,y2:pt.y}:{tool:'draw',points:[[pt.x,pt.y]]};paint();
   });
   canvas.addEventListener('pointermove',event=>{if(!canvas.hasPointerCapture(event.pointerId))return;const pt=at(event);
    if(dragging&&selected>=0){actions[selected].x=pt.x;actions[selected].y=pt.y;paint()}
    else if(drawing){if(drawing.tool==='line'){drawing.x2=pt.x;drawing.y2=pt.y}else drawing.points.push([pt.x,pt.y]);paint()}
   });
   const stop=()=>{if(drawing){actions.push(drawing);drawing=null}dragging=false;paint()};canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);
   const fontInput=wrapper.querySelector('.v38-fontsize');fontInput.addEventListener('input',()=>{wrapper.querySelector('.v38-size').textContent=fontInput.value;if(selected>=0&&actions[selected]?.tool==='text'){actions[selected].size=Number(fontInput.value);paint()}});
   function cleanup(output){wrapper.remove();css.remove();resolve(output)}
   wrapper.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{
    const action=b.dataset.tool;
    if(['draw','line','text'].includes(action))setTool(action);
    else if(action==='undo'){if(history.length){actions=JSON.parse(history.pop());selected=-1;paint()}}
    else if(action==='cancel')cleanup(null);
    else if(action==='save'){selected=-1;paint();canvas.toBlob(blob=>{if(!blob){reject(new Error('บันทึกภาพไม่สำเร็จ'));cleanup(null);return}cleanup(new File([blob],'annotated.png',{type:'image/png'}))},'image/png',0.94)}
   }));
   setTool('draw');paint();
  };
  img.src=objectUrl;
 })}
 window.V38ImageEditor={edit};
})();
