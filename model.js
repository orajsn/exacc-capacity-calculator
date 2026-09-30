(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaCapacity=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const VERSION='1.4.2',CHECKED='2026-09-30';
 const SOURCES={formula:'https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/create-an-autonomous-exadata-vm-cluster.html',hardware:'https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/characteristics-of-infrastructure-shapes.html',limits:'https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/plan-and-observe-capacity-for-autonomous-ai-database-on.html',compute:'https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/compute-management-in-autonomous-ai-database-on-dedicated.html',vmc:'https://docs.oracle.com/en/engineered-systems/exadata-cloud-at-customer/ecccm/ecc-manage-vm-clusters.html'};
 const PROFILES={
  'x11m-standard':{label:'X11M Standard',image:184,local:2243,memory:1390,cpu:760,vms:6},
  'x11m-large':{label:'X11M Large',image:184,local:2243,memory:2090,cpu:760,vms:6},
  'x11m-xl':{label:'X11M Extra Large',image:184,local:2243,memory:2800,cpu:760,vms:6},
  'x11m-base':{label:'X11M Base',image:184,local:1084,memory:660,cpu:120,vms:2},
  custom:{label:'Custom / console values',image:184,local:2243,memory:1390,cpu:760,vms:6}
 };
 const clone=x=>JSON.parse(JSON.stringify(x));
 const number=(x,min,max,label,integer=false)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max||(integer&&!Number.isInteger(x)))throw new Error(`${label}: enter ${integer?'a whole number':'a number'} between ${min} and ${max}.`);return x;};
 function newSite(name='Machine 1',profile='x11m-standard',nodes=2){const p=PROFILES[profile];return{name,siteName:'Site 1',profile,image:p.image,bufferPercent:10,allowance:0,checkCompute:true,nodes:Array.from({length:nodes},(_,i)=>({id:i+1,local:p.local,memory:p.memory,cpu:p.cpu,maxVMs:p.vms,otherLocal:0,otherMemory:0,otherCPU:0,otherVMs:0})),clusters:[{name:'AVMC 1',slots:10,nodes:Array.from({length:nodes},(_,i)=>i+1),cpu:160,memoryPerCPU:2,memoryRule:'current'}]};}
 function validate(site){
  if(!site||typeof site!=='object'||!PROFILES[site.profile])throw new Error('Unknown hardware profile.');
  if(typeof site.name!=='string'||site.name.length>80)throw new Error('Machine name must be at most 80 characters.');
  if(site.siteName!==undefined&&(typeof site.siteName!=='string'||site.siteName.length>80))throw new Error('Site name must be at most 80 characters.');
  number(site.image,0,1000,'VM image GB');number(site.bufferPercent,0,90,'Buffer percent');number(site.allowance,0,1000,'Extra allowance per VM');
  if(!Array.isArray(site.nodes)||site.nodes.length<2||site.nodes.length>32)throw new Error('Choose 2 to 32 DB servers.');
  if(site.profile==='x11m-base'&&site.nodes.length!==2)throw new Error('The X11M Base preset has exactly two DB servers. Use Custom for another verified configuration.');
  if(typeof site.checkCompute!=='boolean')throw new Error('Compute-check setting must be true or false.');
  if(!Array.isArray(site.clusters)||site.clusters.length>32)throw new Error('At most 32 AVMCs can be modelled.');
  const ids=new Set();site.nodes.forEach(n=>{number(n.id,1,32,'Server ID',true);if(ids.has(n.id))throw new Error('Duplicate server ID.');ids.add(n.id);for(const k of ['local','memory','cpu'])number(n[k],1,100000,`DB ${n.id} ${k}`);for(const k of ['otherLocal','otherMemory','otherCPU'])number(n[k],0,100000,`DB ${n.id} ${k}`);number(n.maxVMs,1,32,'VM limit',true);number(n.otherVMs,0,32,'Other VMs',true);});
  site.clusters.forEach((c,i)=>{if(typeof c.name!=='string'||c.name.length>80)throw new Error('AVMC name must be at most 80 characters.');number(c.slots,1,64,`AVMC ${i+1} slots`,true);number(c.cpu,0,10000,'ECPU per VM',true);number(c.memoryPerCPU,2,5,'Memory per ECPU');if(!Array.isArray(c.nodes)||c.nodes.length<2||new Set(c.nodes).size!==c.nodes.length||c.nodes.some(id=>!ids.has(id)))throw new Error(`${c.name}: select at least two distinct existing DB servers.`);});
  site.clusters.forEach(c => {
   if (c.memoryRule !== undefined && !['current', 'legacy', 'unknown'].includes(c.memoryRule)) throw Error('Choose a valid memory rule.');
   for (const key of ['legacyCreatedBeforeCutoff', 'legacyRatioUnchanged']) {
    if (c[key] !== undefined && typeof c[key] !== 'boolean') throw Error('Invalid legacy checklist.');
   }
   for (const key of ['observedMemory', 'observedLocal']) {
    if (c[key] !== undefined && c[key] !== null) number(c[key], 0, 10000000, key);
   }
  });
  return site;
 }
 function memorySizing(cluster) {
  const legacy = (cluster.cpu * cluster.memoryPerCPU + 40) * 1.02;
  // Decimal planning conversion: 300 MB = 0.3 GB. Reconcile console rounding.
  const currentRaw = (cluster.cpu * cluster.memoryPerCPU + 40 + 0.3 * cluster.cpu) * 1.02;
  const confirmedLegacy = cluster.memoryRule === 'legacy' &&
   cluster.legacyCreatedBeforeCutoff === true && cluster.legacyRatioUnchanged === true;
  const verified = cluster.memoryRule === 'current' || confirmedLegacy;
  const rule = confirmedLegacy ? 'legacy' : 'current';
  const perVM = confirmedLegacy ? legacy : Math.max(135, currentRaw);
  return {rule, verified, perVM, legacyPerVM: legacy, currentRawPerVM: currentRaw,
   label: confirmedLegacy ? 'Legacy confirmed' : verified ? 'Current rule' : 'Unconfirmed · current rule used'};
 }
 function clusterCost(cluster,image=184,allowance=0) {
  const v=cluster.nodes.length,n=cluster.slots;
  const perVM=image+(100+50*n)*1.03+2+allowance;
  const sizing=memorySizing(cluster);
  return {perVM,total:perVM*v,base:(image+105)*v,slots:51.5*n*v,allowance:allowance*v,
   cpu:cluster.cpu*v,memoryPerVM:sizing.perVM,memory:sizing.perVM*v,memorySizing:sizing};
 }
 function calculate(site){validate(site);const errors=[],warnings=[];const costs=site.clusters.map(c=>({...clusterCost(c,site.image,site.allowance),name:c.name}));
  site.clusters.forEach((c,i)=>{if(c.slots>16)errors.push(`${c.name}: ${c.slots} slots exceeds the 16-ACD limit per AVMC.`);if(site.checkCompute&&c.cpu<40)errors.push(`${c.name}: AVMC creation requires at least 40 ECPUs per VM.`);if(site.checkCompute&&!costs[i].memorySizing.verified)warnings.push(`${c.name}: memory rule unconfirmed; current rule used conservatively. Complete the legacy checklist if applicable.`);});
  const nodes=site.nodes.map(n=>{let used=0,cpu=0,memory=0,vms=0;site.clusters.forEach((c,i)=>{if(c.nodes.includes(n.id)){used+=costs[i].perVM;cpu+=c.cpu;memory+=costs[i].memoryPerVM;vms++;}});const buffer=n.local*site.bufferPercent/100,free=n.local-n.otherLocal-used;
   if(free< -1e-7)errors.push(`DB ${n.id}: local storage exceeds capacity by ${(-free).toFixed(1)} GB.`);else if(free+1e-7<buffer)warnings.push(`DB ${n.id}: remaining storage is below the ${site.bufferPercent}% planning buffer.`);
   if(vms+n.otherVMs>n.maxVMs)errors.push(`DB ${n.id}: ${vms+n.otherVMs} VMs exceeds the configured ${n.maxVMs}-VM limit.`);
   if(site.checkCompute&&cpu+n.otherCPU>n.cpu)errors.push(`DB ${n.id}: allocated ECPUs exceed server capacity.`);
   if(site.checkCompute&&memory+n.otherMemory>n.memory)errors.push(`DB ${n.id}: estimated memory exceeds server capacity.`);
   return{...n,used,free,buffer,afterBuffer:free-buffer,cpuUsed:cpu,memoryUsed:memory,vms};
  });
  const sum=k=>nodes.reduce((a,n)=>a+n[k],0);return{costs,nodes,errors,warnings,status:errors.length?'error':warnings.length?'warning':'fit',capacity:sum('local'),used:sum('used'),other:sum('otherLocal'),free:sum('free'),buffer:sum('buffer'),afterBuffer:sum('afterBuffer'),slots:site.clusters.reduce((a,c)=>a+c.slots,0)};
 }
 function combinations(site){validate(site);const rows=[];const vLimit=Math.min(...site.nodes.map(n=>Math.max(0,n.maxVMs-n.otherVMs)));const base=site.image+105+site.allowance;
  for(let v=1;v<=vLimit;v++){const slotBound=(withBuffer)=>Math.max(0,Math.min(v*16,...site.nodes.map(n=>Math.floor((n.local-n.otherLocal-(withBuffer?n.local*site.bufferPercent/100:0)-base*v+1e-8)/51.5))));const absolute=slotBound(false),buffered=slotBound(true),feasible=buffered>=v;
   const distribution=feasible?Array.from({length:v},(_,i)=>Math.floor(buffered/v)+(i<buffered%v?1:0)):[];
   rows.push({avmcs:v,absolute:absolute>=v?absolute:0,buffered:feasible?buffered:0,distribution,free:feasible?site.nodes.reduce((a,n)=>a+n.local-n.otherLocal-base*v-51.5*buffered,0):null});
  }return rows;
 }
 function importScenario(raw){if(!raw||raw.schema!=='exacc-capacity/v1'||!Array.isArray(raw.sites)||raw.sites.length<1||raw.sites.length>8)throw new Error('Use a calculator scenario JSON with 1 to 8 machines.');const sites=clone(raw.sites);sites.forEach(validate);sites.forEach(s=>{const p=PROFILES[s.profile];if(s.profile!=='custom'&&(s.image!==p.image||s.nodes.some(n=>n.local!==p.local||n.memory!==p.memory||n.cpu!==p.cpu||n.maxVMs!==p.vms)))s.profile='custom';});return{schema:'exacc-capacity/v1',sites};}
 function applyDesign(site, count, allocation) {
  validate(site);
  const row = combinations(site).find(r => r.avmcs === count);
  if (!row || !row.buffered) throw Error('This design does not fit local storage.');
  const preserve = count === site.clusters.length && site.clusters.every(c => c.nodes.length === site.nodes.length);
  if (!preserve) {
   if (!allocation) throw Error('For a different AVMC count or placement, enter replacement ECPUs per VM and memory per ECPU before applying.');
   number(allocation.cpu, 40, 10000, 'Replacement ECPUs per VM', true);
   number(allocation.memoryPerCPU, 2, 5, 'Replacement memory per ECPU');
  }
  const next = clone(site);
  next.clusters = row.distribution.map((slots, i) => preserve
   ? {...next.clusters[i], slots}
   : {name: `AVMC ${i + 1}`, slots, nodes: next.nodes.map(n => n.id), cpu: allocation.cpu, memoryPerCPU: allocation.memoryPerCPU, memoryRule: 'current'});
  validate(next);
  return next;
 }
 function resizeNodes(site, count) {
  validate(site);
  number(count, 2, 32, 'DB server count', true);
  const next = clone(site), profile = PROFILES[site.profile];
  next.nodes = next.nodes.slice(0, count);
  const ids = new Set(next.nodes.map(n => n.id));
  while (next.nodes.length < count) {
   let id = 1;
   while (ids.has(id)) id++;
   ids.add(id);
   next.nodes.push({id, local: profile.local, memory: profile.memory, cpu: profile.cpu, maxVMs: profile.vms, otherLocal: 0, otherMemory: 0, otherCPU: 0, otherVMs: 0});
  }
  next.clusters.forEach(c => {
   c.nodes = c.nodes.length === site.nodes.length
    ? next.nodes.map(n => n.id)
    : c.nodes.filter(id => ids.has(id));
  });
  // Reject invalid placement without corrupting the current design.
  validate(next);
  return next;
 }
 return{VERSION,CHECKED,SOURCES,PROFILES,newSite,clone,validate,clusterCost,calculate,combinations,importScenario,applyDesign,resizeNodes,memorySizing};
});
