(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaConventional=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const VERSION='console-footprint-v1',CHECKED='2026-11-07';
 const SOURCES={capacity:'https://docs.oracle.com/en/engineered-systems/exadata-cloud-at-customer/ecccm/ecc-system-config-options.html',storage:'https://docs.oracle.com/en/engineered-systems/exadata-cloud-at-customer/ecccm/ecc-manage-vm-clusters.html'};
 const KEYS=['otherLocal','otherCPU','otherMemory','otherVMs'];
 const FIELDS={localPerVM:'otherLocal',cpuPerVM:'otherCPU',memoryPerVM:'otherMemory'};
 const clone=value=>JSON.parse(JSON.stringify(value));
 const same=(a,b)=>Math.abs(a-b)<1e-7;
 function config(site){return site.conventional??{clusters:[],applied:null};}
 function text(value,max,label,empty=true){if(typeof value!=='string'||value.length>max||(!empty&&!value.trim()))throw Error(`${label}: enter ${empty?'text':'a name'} up to ${max} characters.`);}
 function quantity(value,label,nullable=false){if(nullable&&value===null)return;if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>10000000)throw Error(`${label}: enter a non-negative number or leave unknown inputs blank.`);}
 function validate(site){
  if(!site||!Array.isArray(site.nodes))throw Error('Choose a machine before entering VMC allocations.');
  const cfg=config(site),ids=new Set(site.nodes.map(n=>n.id));
  if(!cfg||typeof cfg!=='object'||Array.isArray(cfg)||!Array.isArray(cfg.clusters)||cfg.clusters.length>32)throw Error('Use up to 32 conventional VMC records per machine. This is a calculator limit.');
  const clusterIds=new Set(),names=new Set();
  cfg.clusters.forEach((c,i)=>{
   if(!c||typeof c!=='object'||Array.isArray(c))throw Error(`VMC ${i+1}: invalid allocation record.`);
   text(c.id,100,'VMC ID',false);if(clusterIds.has(c.id))throw Error('Conventional VMC IDs must be unique within the machine.');clusterIds.add(c.id);
   text(c.name,80,'VMC name',false);const name=c.name.trim().toLowerCase();if(names.has(name))throw Error(`VMC name is repeated: ${c.name}.`);names.add(name);
   if(!Array.isArray(c.nodes)||!c.nodes.length||new Set(c.nodes).size!==c.nodes.length||c.nodes.some(n=>!ids.has(n)))throw Error(`${c.name}: select distinct DB servers that exist in this machine.`);
   for(const key of Object.keys(FIELDS))quantity(c[key],`${c.name} ${key}`,true);
   if(c.cpuUnit!=='ecpu')throw Error(`${c.name}: use ECPU capacity units. OCPU values are not converted automatically.`);
   if(!['console','proposal'].includes(c.source))throw Error(`${c.name}: choose console allocation or proposal.`);
   if(c.notes!==undefined)text(c.notes,1000,'VMC notes');
  });
  if(cfg.applied!==undefined&&cfg.applied!==null){
   const a=cfg.applied;
   if(!a||typeof a!=='object'||a.version!==1||!Array.isArray(a.byNode)||!Array.isArray(a.expectedByNode)||!['added','adopted'].includes(a.mode))throw Error('Invalid conventional VMC allocation tracking.');
   text(a.signature,30000,'VMC allocation signature');
   for(const list of [a.byNode,a.expectedByNode]){
    const seen=new Set();
    if(list.length>32)throw Error('Too many tracked VMC DB servers.');
    for(const n of list){if(!n||!ids.has(n.id)||seen.has(n.id))throw Error('A tracked conventional VMC DB server is missing or duplicated.');seen.add(n.id);for(const key of KEYS)quantity(n[key],`Tracked DB ${n.id} ${key}`);if(!Number.isInteger(n.otherVMs))throw Error('Tracked VM counts must be whole numbers.');}
   }
   if(a.byNode.length!==a.expectedByNode.length||a.byNode.some(n=>!a.expectedByNode.some(e=>e.id===n.id)))throw Error('Conventional VMC tracking records do not match.');
   let tracked;try{tracked=JSON.parse(a.signature);}catch{throw Error('Invalid conventional VMC allocation signature.');}
   if(!Array.isArray(tracked)||tracked.length>32)throw Error('Invalid conventional VMC allocation signature.');
   const computed=new Map(),trackedIds=new Set();
   for(const record of tracked){
    if(!record||typeof record!=='object')throw Error('Invalid conventional VMC allocation signature.');
    text(record.id,100,'Tracked VMC ID',false);if(trackedIds.has(record.id))throw Error('Duplicate tracked VMC ID.');trackedIds.add(record.id);
    if(record.cpuUnit!=='ecpu'||!Array.isArray(record.nodes)||!record.nodes.length||new Set(record.nodes).size!==record.nodes.length||record.nodes.some(id=>!ids.has(id)))throw Error('Invalid tracked VMC placement or CPU unit.');
    for(const field of Object.keys(FIELDS))quantity(record[field],`Tracked ${field}`);
    for(const id of record.nodes){const row=computed.get(id)||{id,otherLocal:0,otherCPU:0,otherMemory:0,otherVMs:0};row.otherVMs++;for(const [field,key] of Object.entries(FIELDS))row[key]+=record[field];computed.set(id,row);}
   }
   if(computed.size!==a.byNode.length||a.byNode.some(n=>!computed.has(n.id)||KEYS.some(k=>!same(n[k],computed.get(n.id)[k]))))throw Error('Tracked VMC totals do not match their saved footprint.');
   if(a.byNode.some(n=>KEYS.some(k=>a.expectedByNode.find(e=>e.id===n.id)[k]+1e-7<n[k])))throw Error('Tracked VMC footprint exceeds its recorded Other totals.');
  }
  return cfg;
 }
 function signature(site){return JSON.stringify(config(site).clusters.map(c=>({id:c.id,nodes:[...c.nodes].sort((a,b)=>a-b),localPerVM:c.localPerVM,cpuPerVM:c.cpuPerVM,memoryPerVM:c.memoryPerVM,cpuUnit:c.cpuUnit})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0));}
 function contributions(site){
  const cfg=validate(site),missing=[];
  const nodes=site.nodes.map(n=>({id:n.id,otherLocal:0,otherCPU:0,otherMemory:0,otherVMs:0}));
  for(const c of cfg.clusters){
   for(const key of Object.keys(FIELDS))if(c[key]===null)missing.push(`${c.name}: ${key==='localPerVM'?'total local GB':key==='cpuPerVM'?'ECPUs':'memory GB'} per VM is unknown.`);
   for(const id of c.nodes){const node=nodes.find(n=>n.id===id);node.otherVMs++;for(const [field,key] of Object.entries(FIELDS))node[key]=node[key]===null||c[field]===null?null:node[key]+c[field];}
  }
  const totals={};for(const key of KEYS)totals[key]=nodes.some(n=>n[key]===null)?null:nodes.reduce((sum,n)=>sum+n[key],0);
  return {nodes,totals,complete:!missing.length,missing};
 }
 function ledgerErrors(site){
  const a=config(site).applied;if(!a)return [];
  const errors=[];
  for(const expected of a.expectedByNode){const current=site.nodes.find(n=>n.id===expected.id);if(!current){errors.push(`DB ${expected.id} no longer exists in the machine.`);continue;}if(KEYS.some(key=>!same(current[key],expected[key])))errors.push(`DB ${expected.id}: Other allocations changed after the VMC footprint was included. Reconcile them before updating or removing it.`);}
  return errors;
 }
 function inspect(site){
  try{
   const cfg=validate(site),c=contributions(site),errors=ledgerErrors(site),hasRecords=cfg.clusters.length>0;
   const pending=hasRecords?(!cfg.applied||cfg.applied.signature!==signature(site)):!!cfg.applied&&cfg.applied.byNode.some(n=>KEYS.some(k=>n[k]>0));
   const warnings=[...c.missing];
   if(pending)warnings.push(cfg.applied?'VMC edits are not reflected in the capacity totals yet.':'These VMC records are not included in capacity totals yet.');
   if(hasRecords){warnings.push('Conventional VMC filesystem and backup reservations are entered from console or proposal totals; no filesystem formula is applied.');warnings.push('Mixed-service VM limits and provisioning eligibility require console confirmation. The machine uses its current configured VM limits.');if(cfg.clusters.some(x=>x.source==='proposal'))warnings.push('Some conventional VMC allocations are proposed, not observed console values.');}
   return {status:errors.length?'error':hasRecords||pending?'partial':'not-used',errors,warnings,pending,applied:!!cfg.applied,clusters:cfg.clusters.length,totals:c.totals,complete:c.complete};
  }catch(e){return {status:'error',errors:[e.message],warnings:[],pending:true,applied:!!site?.conventional?.applied,clusters:site?.conventional?.clusters?.length||0,totals:null,complete:false};}
 }
 function requireOther(site){for(const n of site.nodes){for(const key of KEYS)quantity(n[key],`DB ${n.id} ${key}`);if(!Number.isInteger(n.otherVMs))throw Error('Other VM counts must be whole numbers.');}}
 function applyToOther(site,options={}){
  const cfg=validate(site),c=contributions(site);requireOther(site);
  if(!c.complete)throw Error('Enter all VMC resource values before including them. Unknown values cannot be counted as zero.');
  if(typeof options.alreadyIncluded!=='undefined'&&typeof options.alreadyIncluded!=='boolean')throw Error('Choose whether the VMC footprint is already included in Other allocations.');
  const adopt=options.alreadyIncluded===true;
  const conflicts=ledgerErrors(site);if(conflicts.length&&!adopt)throw Error(conflicts[0]);
  const next=clone(site);next.conventional=clone(cfg);
  for(const n of next.nodes){
   const added=c.nodes.find(x=>x.id===n.id),previous=cfg.applied?.byNode.find(x=>x.id===n.id);
   for(const key of KEYS){
    if(adopt){if(n[key]+1e-7<added[key])throw Error(`DB ${n.id}: Other ${key.slice(5)} is smaller than the listed VMC footprint. Correct the total before marking it already included.`);}
    else{const base=n[key]-(previous?.[key]||0);if(base< -1e-7)throw Error(`DB ${n.id}: cannot remove the tracked VMC contribution from Other allocations.`);n[key]=Math.max(0,base)+added[key];}
    if(n[key]>(key==='otherVMs'?32:100000))throw Error(`DB ${n.id}: the resulting Other allocation exceeds this calculator's supported input range.`);
   }
  }
  const byNode=c.nodes.filter(n=>KEYS.some(k=>n[k]!==0));
  next.conventional.applied={version:1,mode:adopt?'adopted':'added',byNode:clone(byNode),expectedByNode:byNode.map(x=>{const n=next.nodes.find(n=>n.id===x.id);return {id:n.id,...Object.fromEntries(KEYS.map(k=>[k,n[k]]))};}),signature:signature(next)};
  return next;
 }
 function removeFromOther(site){
  const cfg=validate(site);requireOther(site);if(!cfg.applied)return clone(site);
  const conflicts=ledgerErrors(site);if(conflicts.length)throw Error(conflicts[0]);
  const next=clone(site);for(const n of next.nodes){const previous=cfg.applied.byNode.find(x=>x.id===n.id);for(const key of KEYS){const value=n[key]-(previous?.[key]||0);if(value< -1e-7)throw Error(`DB ${n.id}: tracked VMC allocation exceeds Other allocations.`);n[key]=Math.max(0,value);}}
  next.conventional.applied=null;return next;
 }
 function newCluster(site){const names=new Set(config(site).clusters.map(c=>c.name.trim().toLowerCase()));let index=1;while(names.has(`vmc ${index}`))index++;return {id:`vmc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`,name:`VMC ${index}`,nodes:site.nodes.map(n=>n.id),localPerVM:null,cpuPerVM:null,memoryPerVM:null,cpuUnit:'ecpu',source:'console',notes:''};}
 return {VERSION,CHECKED,SOURCES,KEYS,config,validate,signature,contributions,inspect,applyToOther,removeFromOther,newCluster};
});
