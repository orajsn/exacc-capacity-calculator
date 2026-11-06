(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaSizing=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
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
   for(const [key,min,max,label,integer] of [['ecpu',0,100000,'Workload ECPUs',false],['ramGB',0,1000000,'Workload RAM',false],['unsizedACDs',0,c.slots,'ACDs without sized workloads',true],['minRatio',2,5,'Minimum GB per ECPU',false]]){
    if(q[key]==null&&!requireAll)continue;number(q[key],min,max,`${c.name} ${label}`,integer);
   }
   if(q.ecpu===0&&q.ramGB>0)throw Error(`${c.name}: enter ECPU demand before sizing memory.`);
   if(q.incomplete!==undefined&&typeof q.incomplete!=='boolean')throw Error('Workload completeness must be true or false.');
   if(q.acdEcpus!==undefined){
    if(!Array.isArray(q.acdEcpus)||q.acdEcpus.length!==c.slots)throw Error(`${c.name}: ACD CPU details must match the maximum ACD count.`);
    q.acdEcpus.forEach(v=>number(v,0,100000,'ACD workload ECPUs'));
    if(Math.abs(q.acdEcpus.reduce((a,b)=>a+b,0)-q.ecpu)>1e-7)throw Error(`${c.name}: ACD CPU details do not add up to workload ECPUs.`);
    if(q.acdEcpus.filter(v=>v===0).length!==q.unsizedACDs)throw Error(`${c.name}: the ACD count without sized workloads does not match its CPU details.`);
   }
  }
  if(requireAll&&!site.clusters.length)throw Error('Add at least one AVMC and enter its workload needs.');
  return p;
 }
 function allocation(cluster,nodeCount,extraCPUPercent){
  const q=cluster.requirements;
  const sizedACDs=cluster.slots-q.unsizedACDs;
  const base=q.acdEcpus?q.acdEcpus.reduce((sum,v)=>sum+Math.max(v,8*nodeCount),0)
   :Math.max(q.ecpu,8*nodeCount*sizedACDs)+8*nodeCount*q.unsizedACDs;
  const cpu=Math.max(40,Math.ceil((base+q.ecpu*extraCPUPercent/100)/nodeCount));
  const memoryPerCPU=Math.ceil(Math.max(2,q.minRatio,q.ecpu?q.ramGB/q.ecpu:2)*2)/2;
  if(memoryPerCPU>5)throw Error(`${cluster.name}: memory demand needs more than 5 GB/ECPU. Review the requested ECPUs or split the workload.`);
  return {cpu,memoryPerCPU,memoryRule:'current'};
 }
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
  next.clusters=site.clusters.map(c=>({...model.clone(c),...allocation(c,nodeCount,p.extraCPUPercent),nodes:next.nodes.map(n=>n.id),legacyCreatedBeforeCutoff:false,legacyRatioUnchanged:false}));
  model.validate(next);return next;
 }
 function suggest(site,model,planning){
  const p=validate(site,true),rows=[];
  const profiles=['x11m-base','x11m-standard','x11m-large','x11m-xl'];
  for(let nodes=p.minNodes;nodes<=p.maxNodes;nodes++)for(const profile of profiles){
   if(profile==='x11m-base'&&nodes!==2)continue;
   let candidate;try{candidate=build(site,profile,nodes,model);}catch(e){if(e.message.startsWith('Cannot omit'))continue;throw e;}
   const result=model.calculate(candidate);
   const budgets=planning.resources(candidate,result).filter(r=>r.unit!=='TB');
   rows.push({profile,nodes,candidate,result,fit:result.errors.length===0,meetsBuffers:result.errors.length===0&&budgets.every(r=>r.status==='Within buffer'),cpu:result.nodes.reduce((a,n)=>a+n.cpuUsed+n.otherCPU,0),memory:result.nodes.reduce((a,n)=>a+n.memoryUsed+n.otherMemory,0),local:result.used+result.other});
  }
  return {rows,minimum:rows.find(r=>r.fit)||null,withBuffers:rows.find(r=>r.meetsBuffers)||null,incomplete:site.clusters.some(c=>c.requirements.incomplete)};
 }
 return {config,validate,allocation,build,suggest};
});
