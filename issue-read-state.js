/* Production contract installed by sql/01_APPLY_ALL.sql:
 * qa_issue_read_states(p_job_ids text[]) returns [{job_id,issue_id,revision,is_unread}].
 * qa_mark_issue_read(p_job_id text,p_issue_id uuid,p_seen_revision text) acknowledges
 * only the version actually displayed. Auth.uid(), access checks and event versions
 * must be enforced in SQL. No user ID is accepted from the browser.
 * qa_vnext_job_detail must return read_revision on each visible issue.
 * Until SQL is installed, missing state is UNKNOWN, never falsely marked as read.
 */
(()=>{'use strict';
const stateKey=(jobId,issueId)=>JSON.stringify([String(jobId),String(issueId)]);
window.QAReadState={
 key:stateKey,
 async load(jobIds){
  const states=new Map();let available=true;
  for(let offset=0;offset<jobIds.length;offset+=100){
   try{const {data,error}=await QA.client.rpc('qa_issue_read_states',{p_job_ids:jobIds.slice(offset,offset+100)});
    if(error||!Array.isArray(data)){available=false;continue;}
    for(const r of data)states.set(stateKey(r.job_id,r.issue_id),r);
   }catch{available=false;}
  }return {states,available};
 },
 async markOpened(detail){
  if(document.visibilityState==='hidden')return;
  let target='';try{if(location.hash.startsWith('#issue-'))target=decodeURIComponent(location.hash.slice(7));}catch{return;}
  const issues=new Map();
  for(const a of detail.assignments||[])for(const i of a.issues||[]){
   if(i.read_revision&&(!target||String(i.issue_id)===target))issues.set(String(i.issue_id),i.read_revision);
  }
  await Promise.allSettled([...issues].map(([issueId,revision])=>QA.client.rpc('qa_mark_issue_read',{
   p_job_id:String(detail.job_id),p_issue_id:issueId,p_seen_revision:String(revision)
  })));
 }
};
})();
