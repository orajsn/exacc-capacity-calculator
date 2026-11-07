(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./requirements.js')):factory(root.ExaRequirements);if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaSizing=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Q){
 'use strict';
 const defaults={extraCPUPercent:50,minNodes:2,maxNodes:8};
 function config(site){return {...defaults,...site.sizing};}
 function number(value,min,max,label,integer=false){if(!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))throw Error(`${label}: enter ${min} to ${max}${integer?' as a whole number':''}.`);}
 function validate(site,requireAll=false){
  const p=config(site);number(p.extraCPUPercent,0,200,'Extra ECPU allowance');number(p.minNodes,2,32,'Minimum DB servers',true);number(p.maxNodes,p.minNodes,32,'Maximum DB servers',true);
  for(const c of site.clusters){
   const q=c.requirements;
   if(!q){if(requireAll)throw Error(`Enter workload requirements for ${c.name}.`);continue;}
   if(typeof q!=='object'||Array.isArray(q))throw Error('Workload requirements must be an object.');
   Q.validateMetadata(c);
   const inventory=Q.source(c)==='database-inventory'?Q.status(c):null,stale=!!inventory?.stale;
   if(requireAll&&stale)throw Error(`${c.name}: inventory totals changed. Review and apply the database totals in step 2 before comparing hardware.`);
   for(const [key,min,max,label,integer] of [['ecpu',0,100000,'Workload ECPUs',false],['ramGB',0,1000000,'Workload RAM',false],['unsizedACDs',0,stale?16:c.slots,'ACDs without sized workloads',true],['minRatio',2,5,'Minimum GB per ECPU',false]]){
    if(q[key]==null&&!requireAll)continue;number(q[key],min,max,`${c.name} ${label}`,integer);
   }
   if(q.ecpu===0&&q.ramGB>0&&(requireAll||!inventory?.missing.ecpu))throw Error(`${c.name}: enter ECPU demand before sizing memory.`);
   if(q.incomplete!==undefined&&typeof q.incomplete!=='boolean')throw Error('Workload completeness must be true or false.');
   if(q.acdEcpus!==undefined){
    if(!Array.isArray(q.acdEcpus)||(!stale&&q.acdEcpus.length!==c.slots))throw Error(`${c.name}: ACD CPU details must match the maximum ACD count.`);
    q.acdEcpus.forEach(v=>number(v,0,100000,'ACD workload ECPUs'));
    if(Math.abs(q.acdEcpus.reduce((a,b)=>a+b,0)-q.ecpu)>1e-7)throw Error(`${c.name}: ACD CPU details do not add up to workload ECPUs.`);
    if(q.acdEcpus.filter(v=>v===0).length!==q.unsizedACDs)throw Error(`${c.name}: the ACD count without sized workloads does not match its CPU details.`);
   }
  }
  if(requireAll&&!site.clusters.length)throw Error('Add at least one AVMC and enter its workload needs.');
  return p;
 }
 function allocationDetails(cluster,nodeCount,extraCPUPercent){
  number(nodeCount,2,32,'DB servers',true);number(extraCPUPercent,0,200,'Extra ECPU allowance');
  const q=cluster.requirements;
  if(!q)throw Error(`Enter workload requirements for ${cluster.name}.`);
  for(const [key,min,max] of [['ecpu',0,100000],['ramGB',0,1000000],['minRatio',2,5],['unsizedACDs',0,cluster.slots]])number(q[key],min,max,`${cluster.name} ${key}`,key==='unsizedACDs');
  if(q.ecpu===0&&q.ramGB>0)throw Error(`${cluster.name}: enter ECPU demand before sizing memory.`);
  const sizedACDs=cluster.slots-q.unsizedACDs;
  // The RAM input is a workload requirement, not the AVMC's internal-service memory.
  // Extra AVMC CPU alone does not increase an unchanged ADB's memory entitlement.
  const memoryPerCPU=Math.min(5,Math.ceil(Math.max(2,q.minRatio,q.ecpu?q.ramGB/q.ecpu:2)*2)/2);
  const plannedWorkloadECPU=Math.max(Math.ceil(q.ecpu),Math.ceil(q.ramGB/memoryPerCPU));
  const additionalWorkloadECPU=plannedWorkloadECPU-q.ecpu;
  const base=q.acdEcpus?q.acdEcpus.reduce((sum,v)=>sum+Math.max(v,8*nodeCount),0)+additionalWorkloadECPU
   :Math.max(plannedWorkloadECPU,8*nodeCount*sizedACDs)+8*nodeCount*q.unsizedACDs;
  const plannedCPUWithAllowanceECPU=base+plannedWorkloadECPU*extraCPUPercent/100;
  const cpu=Math.max(40,Math.ceil(plannedCPUWithAllowanceECPU/nodeCount));
  const notes=[];
  if(additionalWorkloadECPU>0)notes.push(`Plan at least ${plannedWorkloadECPU} total database ECPUs (${additionalWorkloadECPU} above the entered workload) at ${memoryPerCPU} GB/ECPU. Assign and validate these ECPUs at ADB level; spare AVMC CPU alone does not meet the RAM requirement.`);
  if(q.unsizedACDs)notes.push('ACDs without sized workloads receive only their creation CPU floor; future database requirements remain unknown.');
  return {allocation:{cpu,memoryPerCPU,memoryRule:'current'},detail:{requestedWorkloadECPU:q.ecpu,plannedWorkloadECPU,additionalWorkloadECPU,requestedRAMGB:q.ramGB,memoryPerCPU,needsDatabaseCPUIncrease:additionalWorkloadECPU>0,extraCPUPercent,baseWithACDFloorsECPU:base,plannedCPUWithAllowanceECPU,allocatedECPUPerVM:cpu,vmCount:nodeCount,requirementsSignature:JSON.stringify(q),scope:'aggregate-planning',notes}};
 }
 function allocation(cluster,nodeCount,extraCPUPercent){return allocationDetails(cluster,nodeCount,extraCPUPercent).allocation;}
 function currentSizingDetail(cluster){const d=cluster.sizingDetail;return d&&d.requirementsSignature===JSON.stringify(cluster.requirements)&&d.allocatedECPUPerVM===cluster.cpu&&d.memoryPerCPU===cluster.memoryPerCPU&&d.vmCount===cluster.nodes.length?d:null;}
 function build(site,profile,nodeCount,model){
  const p=validate(site,true),hardware=model.PROFILES[profile];
  if(!hardware||profile==='custom')throw Error('Choose a supported X11M preset.');
  if(profile==='x11m-base'&&nodeCount!==2)throw Error('X11M Base uses two DB servers.');
  const removed=site.nodes.slice(nodeCount);
  if(removed.some(n=>n.otherLocal||n.otherCPU||n.otherMemory||n.otherVMs))throw Error('Cannot omit DB servers with other allocations.');
  const next=model.clone(site);next.profile=profile;next.image=hardware.image;next.checkCompute=true;
  next.nodes=site.nodes.slice(0,nodeCount).map(n=>({...n,local:hardware.local,cpu:hardware.cpu,memory:hardware.memory,maxVMs:hardware.vms}));
  const ids=new Set(next.nodes.map(n=>n.id));
  while(next.nodes.length<nodeCount){let id=1;while(ids.has(id))id++;ids.add(id);next.nodes.push({id,local:hardware.local,cpu:hardware.cpu,memory:hardware.memory,maxVMs:hardware.vms,otherLocal:0,otherCPU:0,otherMemory:0,otherVMs:0});}
  next.clusters=site.clusters.map(c=>{const sized=allocationDetails(c,nodeCount,p.extraCPUPercent);if(sized.allocation.cpu>10000){const error=Error(`${c.name}: required CPU exceeds the calculator input range for ${nodeCount} DB servers.`);error.code='CANDIDATE_CPU_RANGE';throw error;}return {...model.clone(c),...sized.allocation,allocationKind:'new',sizingDetail:sized.detail,nodes:next.nodes.map(n=>n.id),legacyCreatedBeforeCutoff:false,legacyRatioUnchanged:false};});
  model.validate(next);return next;
 }
 function suggest(site,model,planning){
  const p=validate(site,true),rows=[];
  const profiles=['x11m-base','x11m-standard','x11m-large','x11m-xl'];
  for(let nodes=p.minNodes;nodes<=p.maxNodes;nodes++)for(const profile of profiles){
   if(profile==='x11m-base'&&nodes!==2)continue;
   let candidate;try{candidate=build(site,profile,nodes,model);}catch(e){if(e.message.startsWith('Cannot omit')||e.code==='CANDIDATE_CPU_RANGE'){rows.push({profile,nodes,candidate:null,result:null,fit:false,meetsBuffers:false,reason:e.message,cpu:null,memory:null,local:null});continue;}throw e;}
   const result=model.calculate(candidate);
   const budgets=planning.resources(candidate,result).filter(r=>r.unit!=='TB');
   rows.push({profile,nodes,candidate,result,fit:result.errors.length===0,meetsBuffers:result.errors.length===0&&budgets.every(r=>r.status==='Within buffer'),cpu:result.nodes.reduce((a,n)=>a+n.cpuUsed+n.otherCPU,0),memory:result.nodes.reduce((a,n)=>a+n.memoryUsed+n.otherMemory,0),local:result.used+result.other,requiresDatabaseCPUReview:candidate.clusters.some(c=>c.sizingDetail.needsDatabaseCPUIncrease),adjustments:candidate.clusters.filter(c=>c.sizingDetail.needsDatabaseCPUIncrease).map(c=>({name:c.name,...c.sizingDetail}))});
  }
  return {rows,minimum:rows.find(r=>r.fit)||null,withBuffers:rows.find(r=>r.meetsBuffers)||null,incomplete:site.clusters.some(c=>c.requirements.incomplete)};
 }
 return {config,validate,allocation,allocationDetails,currentSizingDetail,build,suggest};
});
