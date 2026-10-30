/* UI rules follow the exported SQL plus the requested origin-head unrelated policy.
 * The new unrelated policy requires database/pending/02-unrelated-origin-head.sql.
 * SQL remains the authority; these rules never grant database permissions.
 */
(()=>{'use strict';
const norm=v=>String(v??'').trim().toLowerCase();
const value=(a,snake,camel)=>a[snake]??a[camel];
const state=a=>String(a.status??a.rawStatus??'').toUpperCase();
const requested=a=>!!value(a,'approval_requested_at','approvalRequestedAt');
const approved=a=>!!value(a,'approved_at','approvedAt');
const dept=a=>a.department_code??a.department;
function visibleAssignments(p,j,assignments){
 const role=norm(p.role);if(['system_admin','viewer'].includes(role))return assignments;
 if(!['user','department_admin'].includes(role)||!norm(p.department))return [];
 const origin=norm(j.from_department??j.fromDepartment)===norm(p.department);
 return assignments.filter(a=>origin||norm(dept(a))===norm(p.department));
}
function awaitingDepartmentWork(a){return state(a)==='IN_PROGRESS'&&!!value(a,'accepted_at','acceptedAt')&&!value(a,'responsible_user','responsibleUser');}
function permissions(p,j,a,{hasResponseFiles=false,legacyLocked=false}={}){
 const role=norm(p.role),active=p.active!==false&&(!p.approval_status||p.approval_status==='APPROVED');
 const system=active&&role==='system_admin',member=active&&['user','department_admin'].includes(role);
 const own=member&&!!norm(p.department)&&norm(p.department)===norm(dept(a));
 const origin=member&&!!norm(p.department)&&norm(p.department)===norm(j.from_department??j.fromDepartment);
 const responsible=!!p.user_id&&String(a.responsible_user??a.responsibleUser??'')===String(p.user_id);
 const owner=j.is_requester===true||j.isRequester===true||!!p.user_id&&String(j.created_by??j.createdBy??'')===String(p.user_id);
 const s=state(a),unrelated=!!value(a,'unrelated_requested_at','unrelatedRequestedAt');
 const canEdit=active&&own&&responsible&&s==='IN_PROGRESS'&&!requested(a)&&!unrelated&&!legacyLocked;
 const canHeadReview=role==='department_admin'&&own&&s==='IN_PROGRESS'&&requested(a)&&!approved(a)&&!unrelated;
 const canFinalReview=role==='department_admin'&&origin&&s==='WAITING_REVIEW'&&approved(a);
 let rollbackTarget=system?({IN_PROGRESS:'OPEN',WAITING_REVIEW:'IN_PROGRESS',REWORK:'WAITING_REVIEW',CLOSED:'WAITING_REVIEW',CANCELLED:'OPEN'})[s]||null:null;
 if(rollbackTarget==='OPEN'&&(hasResponseFiles||requested(a)||approved(a)||['receiver_problem_detail','problem_analysis','corrective_action'].some(k=>String(a[k]||'').trim())))rollbackTarget=null;
 return {own,origin,owner,system,responsible,
 canAccept:active&&(system||own)&&['OPEN','IN_PROGRESS'].includes(s)&&!a.responsible_user&&!a.responsibleUser&&!unrelated&&(!system||!value(a,'accepted_at','acceptedAt')),
 canEdit,canRequestApproval:canEdit&&role==='user',canHeadSend:canEdit&&role==='department_admin'&&own,
 canApprove:canHeadReview,canFinalReview,
 canRequestUnrelated:own&&s==='OPEN'&&!a.accepted_at&&!a.acceptedAt&&!a.responsible_user&&!a.responsibleUser&&!unrelated,
 canResolveUnrelated:active&&(system||role==='department_admin'&&origin)&&unrelated&&['OPEN','IN_PROGRESS'].includes(s),rollbackTarget};
}
function allowed(action,p,j,a,options){const q=permissions(p,j,a,options);return ({ACCEPT:q.canAccept,SAVE_DRAFT:q.canEdit,REQUEST_APPROVAL:q.canRequestApproval,HEAD_SEND:q.canHeadSend,APPROVE:q.canApprove,RETURN:q.canApprove,REQUESTER_PASS:q.canFinalReview,REQUESTER_FAIL:q.canFinalReview,UNRELATED_REQUEST:q.canRequestUnrelated,UNRELATED_CONFIRM:q.canResolveUnrelated,UNRELATED_REJECT:q.canResolveUnrelated})[action]===true;}
function notices(p,j,assignments){
 const notices=new Map(),add=(code,text,action=false)=>notices.set(code,{code,text,action});
 for(const a of visibleAssignments(p,j,assignments)){
  if(a.metadataLoaded===false&&!approved(a)&&!requested(a)&&!value(a,'unrelated_requested_at','unrelatedRequestedAt'))continue;
  const q=permissions(p,j,a),s=state(a);if(s==='CANCELLED')continue;const pending=requested(a)&&s==='IN_PROGRESS'&&!approved(a);
  if(q.canAccept&&!q.system)add('accept','รอคุณรับงาน',true);
  if(q.canApprove)add('head','รอคุณอนุมัติ',true);
  else if(pending&&q.own)add('head_pending','รอหัวหน้าอนุมัติ');
  if(q.canFinalReview)add('review','รอคุณตรวจสอบ',true);
  const rework=s==='IN_PROGRESS'&&!requested(a)&&!!value(a,'needs_rework','needsRework');
  const returned=s==='IN_PROGRESS'&&!requested(a)&&!!a.returnedFromHead;
  if(rework||returned){if(q.own)add('rework',returned?'หัวหน้าส่งกลับแก้ไข':'ส่งกลับแก้ไข',q.responsible);else if(q.origin)add('rework_wait','รอแผนกแก้ไข');}
  else if(q.canEdit&&!q.system)add('work','รอคุณดำเนินการ',true);
  const unrelated=!!value(a,'unrelated_requested_at','unrelatedRequestedAt');
  if(unrelated&&s!=='CANCELLED'){if(q.canResolveUnrelated)add('review','รอคุณตรวจสอบ',true);else if(q.origin||q.own||q.system)add('unrelated_wait','รอหัวหน้าฝ่ายผู้แจ้งพิจารณา');}

 }
 return [...notices.values()];
}
function reviewAttention(p,j,a){const q=permissions(p,j,a);return q.canFinalReview||q.canResolveUnrelated?'รอคุณตรวจสอบ':q.canApprove?'รอคุณอนุมัติ':'';}
window.QAWorkflow={norm,state,awaitingDepartmentWork,visibleAssignments,permissions,allowed,notices,reviewAttention};
})();
