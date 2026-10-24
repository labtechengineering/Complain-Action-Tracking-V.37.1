/* One status vocabulary for issue rows and the detail tracker.
 * Chart buckets remain separate: OPEN/REWORK can count under work in progress.
 */
(()=>{'use strict';
const labels={OPEN:'รอรับงาน',IN_PROGRESS:'กำลังดำเนินงาน',WAITING_REVIEW:'รอตรวจสอบ',CLOSED:'สำเร็จ',CANCELLED:'ยกเลิก',MIXED:'หลายสถานะ',UNKNOWN:'ไม่ทราบสถานะ'};
const canonical=value=>{const s=String(value||'').trim().toUpperCase();return s==='REWORK'?'IN_PROGRESS':Object.hasOwn(labels,s)&&!['MIXED','UNKNOWN'].includes(s)?s:'UNKNOWN';};
function aggregate(assignments){
 const states=assignments.map(a=>canonical(a.rawStatus??a.status));
 if(!states.length)return 'UNKNOWN';
 const active=states.filter(s=>s!=='CANCELLED'),scope=active.length?active:states;
 const distinct=[...new Set(scope)];return distinct.length===1?distinct[0]:'MIXED';
}
function issueFromHash(hash){try{return hash.startsWith('#issue-')?decodeURIComponent(hash.slice(7)):'';}catch{return '';}}
function scope(assignments,{issueId='',department='',assignmentIds=null}={}){
 if(department)return assignments.filter(a=>String(a.department_code??a.department??'').trim().toLowerCase()===department.trim().toLowerCase());
 if(assignmentIds)assignments=assignments.filter(a=>assignmentIds.includes(String(a.assignment_id??a.assignmentId)));
 if(issueId)return assignments.filter(a=>(a.issues||[]).some(i=>String(i.issue_id)===String(issueId)));
 return assignments;
}
window.QAStatus={canonical,aggregate,scope,issueFromHash,label:s=>labels[s]||labels.UNKNOWN,stage:s=>['OPEN','IN_PROGRESS','WAITING_REVIEW','CLOSED'].indexOf(s)};
})();
