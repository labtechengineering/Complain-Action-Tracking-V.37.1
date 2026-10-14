/* Deep links from older LINE messages that still target job.html are
   upgraded to VNext only for routed multi-department jobs. */
(()=>{'use strict';const p=new URLSearchParams(location.search),id=p.get('job')||p.get('id');if(!id)return;
 (async()=>{for(let i=0;i<160&&!QA.profile;i++)await new Promise(r=>setTimeout(r,100));if(!QA.profile)return;
 try{const {data,error}=await QA.client.rpc('qa_vnext_job_detail',{p_job_id:id});if(!error&&Array.isArray(data?.assignments)&&data.assignments.length)location.replace('vnext-job.html?id='+encodeURIComponent(id));}catch{}})();
})();
