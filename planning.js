(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaPlanning=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const defaults={cpuBuffer:30,memoryBuffer:30,storageBuffer:30,storageCapacity:null,storageAllocated:null,adbECPU:null,sessionsPerECPU:75,sessionMode:'dedicated',sessionDemand:null};
 function config(site){return {...defaults,...site.planning};}
 function numeric(v,min,max,label){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`${label}: enter a number between ${min} and ${max}.`);}
 function validate(site){const p=config(site);for(const k of ['cpuBuffer','memoryBuffer','storageBuffer'])numeric(p[k],0,90,k);for(const k of ['storageCapacity','storageAllocated','adbECPU','sessionDemand'])if(p[k]!==null)numeric(p[k],k==='storageCapacity'||k==='adbECPU'?0.001:0,100000000,k);numeric(p.sessionsPerECPU,1,100000,'Sessions per ECPU');if(!['dedicated','shared','custom'].includes(p.sessionMode))throw Error('Choose a valid session assumption.');if(site.baseline){for(const k of ['local','cpu','memory','avmcs','slots'])numeric(site.baseline[k],0,1e9,`Baseline ${k}`);if(site.baseline.storage!==null)numeric(site.baseline.storage,0,1e9,'Baseline storage');if(typeof site.baseline.computeChecked!=='boolean')throw Error('Invalid baseline compute setting.');}return p;}
 function budget(capacity,allocated,percent){const free=capacity-allocated,buffer=capacity*percent/100,after=free-buffer;return {capacity,allocated,free,buffer,percent,after,status:free < -1e-7?'Over capacity':after < -1e-7?'Below buffer':'Within buffer'};}
 function resources(site,r){const p=validate(site),sum=(key)=>site.nodes.reduce((a,n)=>a+n[key],0);const rows=[{name:'Local storage',unit:'GB',...budget(r.capacity,r.used+r.other,site.bufferPercent),nodes:r.nodes.map(n=>({id:n.id,...budget(n.local,n.used+n.otherLocal,site.bufferPercent)}))}];
  if(site.checkCompute){for(const [name,unit,key,used,other,percent] of [['CPU','ECPU','cpu','cpuUsed','otherCPU',p.cpuBuffer],['Memory estimate','GB','memory','memoryUsed','otherMemory',p.memoryBuffer]]){const nodes=r.nodes.map(n=>({id:n.id,...budget(n[key],n[used]+n[other],percent)}));rows.push({name,unit,...budget(sum(key),nodes.reduce((a,n)=>a+n.allocated,0),percent),nodes});}}
  if(p.storageCapacity!==null&&p.storageAllocated!==null)rows.push({name:'Exadata storage (manual)',unit:'TB',...budget(p.storageCapacity,p.storageAllocated,p.storageBuffer),nodes:[]});
  return rows.map(row=>({...row,status:row.nodes.some(n=>n.status==='Over capacity')?'Over capacity':row.nodes.some(n=>n.status==='Below buffer')?'Below buffer':row.status}));
 }
 function sessions(site){const p=validate(site);if(p.adbECPU===null)return null;const estimated=Math.floor(p.adbECPU*p.sessionsPerECPU);return {estimated,demand:p.sessionDemand,remaining:p.sessionDemand===null?null:estimated-p.sessionDemand,requiredECPU:p.sessionDemand===null?null:Math.ceil(p.sessionDemand/p.sessionsPerECPU),rate:p.sessionsPerECPU};}
 function capture(site,r){const p=validate(site);return {local:r.used+r.other,cpu:r.nodes.reduce((a,n)=>a+n.cpuUsed+n.otherCPU,0),memory:r.nodes.reduce((a,n)=>a+n.memoryUsed+n.otherMemory,0),storage:p.storageAllocated,avmcs:site.clusters.length,slots:r.slots,computeChecked:site.checkCompute};}
 function compare(site,r){if(!site.baseline)return [];const now=capture(site,r);return [['AVMCs','avmcs','count'],['Maximum ACD slots','slots','count'],['Local allocation','local','GB'],['CPU allocation','cpu','ECPU'],['Memory estimate','memory','GB'],['Exadata allocation (manual)','storage','TB']].map(([name,key,unit])=>{const enabled=!['cpu','memory'].includes(key)||(site.checkCompute&&site.baseline.computeChecked);const before=enabled?site.baseline[key]:null,after=enabled?now[key]:null;return {name,unit,before,after,delta:before===null||after===null?null:after-before};});}
 function summary(site, result) {
  const rows = resources(site, result);
  const problems = rows.filter(row => row.status !== 'Within buffer');
  const details = problems.map(row => `${row.name}: ${row.status.toLowerCase()}`);
  if (result.errors.length) details.unshift('Exceeds checked limit');
  const unconfirmed = site.checkCompute && result.costs.some(c => !c.memorySizing.verified);
  if (unconfirmed) details.push('Memory rules unconfirmed; current estimate used');
  if (!site.checkCompute) details.push('CPU / memory not checked');
  const p = config(site);
  if (p.storageCapacity === null || p.storageAllocated === null) details.push('Exadata storage not checked');
  return {
   status: result.errors.length || rows.some(row => row.status === 'Over capacity') ? 'error'
    : problems.length || unconfirmed ? 'warning' : 'fit',
   text: [problems.length || result.errors.length || unconfirmed ? null : 'Within checked limits', ...details].filter(Boolean).join(' · ')
  };
 }
 return {defaults,config,validate,budget,resources,sessions,capture,compare,summary};
});
