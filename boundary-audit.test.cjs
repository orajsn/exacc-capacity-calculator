'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./model.js'),P=require('./planning.js'),S=require('./sizing.js'),T=require('./topology.js'),Q=require('./requirements.js'),R=require('./review.js');
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);

// Synthetic values deliberately differ from the published hardware presets and
// customer workbooks. Expected balances are independent, hand-calculated totals.
function asymmetric(){
 const site=M.newSite('Synthetic machine','custom',3);
 Object.assign(site,{image:137,allowance:11,bufferPercent:12.5});
 site.nodes.forEach((n,i)=>Object.assign(n,{id:[2,5,8][i],local:[1800,1900,2000][i],otherLocal:[17,29,43][i],otherCPU:[3,5,7][i],otherMemory:[11,13,17][i]}));
 site.clusters=[
  {name:'Group A',slots:3,nodes:[2,8],cpu:64,memoryPerCPU:2.5,memoryRule:'current',allocationKind:'new'},
  {name:'Group B',slots:1,nodes:[5,8],cpu:48,memoryPerCPU:4,memoryRule:'current',allocationKind:'new'}
 ];return site;
}

test('independent asymmetric fixture conserves local, CPU, memory and placement per node',()=>{
 const site=asymmetric(),before=structuredClone(site),r=M.calculate(site),rows=P.resources(site,r);
 assert.equal(r.status,'fit');assert.deepEqual(site,before);
 assert.deepEqual(r.nodes.map(n=>n.used),[407.5,304.5,712]);
 assert.deepEqual(r.nodes.map(n=>n.cpuUsed),[64,48,112]);
 [223.584,251.328,474.912].forEach((value,i)=>near(r.nodes[i].memoryUsed,value));
 assert.equal(r.used,1424);assert.equal(r.other,89);assert.equal(r.capacity,5700);assert.equal(r.free,4187);assert.equal(r.buffer,712.5);assert.equal(r.afterBuffer,3474.5);assert.equal(r.slots,4);
 for(const n of r.nodes){near(n.local,n.used+n.otherLocal+n.free);near(n.free,n.buffer+n.afterBuffer);}
 for(const row of rows){near(row.capacity,row.allocated+row.free);near(row.free,row.buffer+row.after);near(row.allocated,row.nodes.reduce((sum,n)=>sum+n.allocated,0));}
 near(rows.find(r=>r.name==='CPU').allocated,239);near(rows.find(r=>r.name==='Memory estimate').allocated,990.824);
});

test('slot, CPU and allowance growth change only their placed reservations',()=>{
 const original=asymmetric(),before=M.calculate(original);
 const slots=structuredClone(original);slots.clusters[0].slots++;
 const sr=M.calculate(slots);near(sr.used-before.used,103);assert.deepEqual(sr.nodes.map((n,i)=>n.used-before.nodes[i].used),[51.5,0,51.5]);
 assert.deepEqual(sr.nodes.map(n=>n.cpuUsed),before.nodes.map(n=>n.cpuUsed));assert.deepEqual(sr.nodes.map(n=>n.memoryUsed),before.nodes.map(n=>n.memoryUsed));
 const cpu=structuredClone(original);cpu.clusters[0].cpu++;
 const cr=M.calculate(cpu);assert.equal(cr.used,before.used);assert.deepEqual(cr.nodes.map((n,i)=>n.cpuUsed-before.nodes[i].cpuUsed),[1,0,1]);
 [2.856,0,2.856].forEach((value,i)=>near(cr.nodes[i].memoryUsed-before.nodes[i].memoryUsed,value));
 const extra=structuredClone(original);extra.allowance+=7;const er=M.calculate(extra);near(er.used-before.used,28);assert.ok(er.nodes.every((n,i)=>n.free<=before.nodes[i].free));
});

test('current, legacy and unconfirmed history use independently calculated memory boundaries',()=>{
 const base={cpu:64,memoryPerCPU:2.5,memoryRule:'current'};
 near(M.memorySizing(base).perVM,223.584);
 const legacy={...base,memoryRule:'legacy',legacyCreatedBeforeCutoff:true,legacyRatioUnchanged:true};
 near(M.memorySizing(legacy).perVM,204);assert.equal(M.memorySizing(legacy).verified,true);
 for(const cluster of [{...base,memoryRule:'unknown'},{...base,memoryRule:undefined},{...legacy,legacyCreatedBeforeCutoff:false},{...legacy,legacyRatioUnchanged:false}]){
  const result=M.memorySizing(cluster);near(result.perVM,223.584);assert.equal(result.verified,false);assert.equal(result.rule,'current');
 }
 assert.equal(M.memorySizing({cpu:1,memoryPerCPU:2,memoryRule:'current'}).perVM,135);
 near(M.memorySizing({...legacy,cpu:1,memoryPerCPU:2}).perVM,42.84);
});

test('exact decimal CPU and memory boundaries fit while meaningful deficits fail',()=>{
 const site=M.newSite('Decimal boundary','custom');site.bufferPercent=0;site.planning={cpuBuffer:0,memoryBuffer:0};
 Object.assign(site.clusters[0],{cpu:40,memoryPerCPU:3.5});
 site.nodes.forEach(n=>Object.assign(n,{cpu:40.05,otherCPU:0.05,memory:195.89,otherMemory:0.05}));
 assert.deepEqual(M.calculate(site).errors,[]);
 for(const resource of ['cpu','memory']){
  const deficit=structuredClone(site);deficit.nodes[0][resource]-=0.000001;
  const result=M.calculate(deficit);assert.ok(result.errors.some(e=>e.includes(resource==='cpu'?'ECPUs':'memory')));
  assert.equal(P.resources(deficit,result).find(r=>r.name===(resource==='cpu'?'CPU':'Memory estimate')).status,'Over capacity');
 }
});

test('low-CPU history qualifications survive machine summaries and saved-plan review',()=>{
 for(const kind of ['existing','unknown',undefined]){
  const site=M.newSite();site.clusters[0].cpu=20;site.clusters[0].allocationKind=kind;site.clusters[0].name='remaining storage is below / memory rule unconfirmed';
  const summary=P.summary(site,M.calculate(site));assert.equal(summary.status,'warning');assert.match(summary.text,/existing console allocation/);assert.doesNotMatch(summary.text,/Fits the checked limits/);
  const review=R.comparePlans({sites:[site]},[],M,P,T,null,Q);assert.equal(review.plans[0].status,'warning');assert.match(review.plans[0].machines[0].label,/existing console allocation/);
 }
});

test('unsupported and inherited hardware profile names fail validation and JSON import',()=>{
 for(const profile of ['toString','constructor','__proto__','hasOwnProperty','unknown',null,{},['custom']]){
  const site=M.newSite();site.profile=profile;
  assert.throws(()=>M.calculate(site),/Unknown hardware profile/);
  const raw=JSON.parse(JSON.stringify({schema:'exacc-capacity/v1',sites:[site]}));assert.throws(()=>M.importScenario(raw),/Unknown hardware profile/);
 }
 const custom=M.newSite();custom.nodes[0].local=1999;assert.equal(M.importScenario({schema:'exacc-capacity/v1',sites:[custom]}).sites[0].profile,'custom');
});

test('malformed JSON structures and invalid placements never produce an accepted calculation',()=>{
 for(const raw of [null,{},[],{schema:'exacc-capacity/v1',sites:[]},{schema:'exacc-capacity/v1',sites:[null]},{schema:'exacc-capacity/v1',sites:[{}]}])assert.throws(()=>M.importScenario(raw));
 for(const placement of [[2],[2,2],[2,99],[],null,['2',8]]){
  const site=asymmetric();site.clusters[0].nodes=placement;assert.throws(()=>M.calculate(site),/distinct existing DB servers/);
 }
});

test('disabled and absent resource inputs remain unknown instead of zero free capacity',()=>{
 const site=asymmetric();site.checkCompute=false;site.clusters[0].cpu=10000;site.planning={storageCapacity:100};
 const r=M.calculate(site);assert.deepEqual(r.errors,[]);assert.deepEqual(P.resources(site,r).map(r=>r.name),['Local storage']);
 const review=R.comparePlans({sites:[site]},[],M,P,T,null,Q).plans[0].machines[0];
 for(const resource of review.resources.filter(r=>r.name!=='Local storage')){assert.equal(resource.checked,false);assert.equal(resource.free,null);assert.equal(resource.allocated,null);}
 site.planning.storageAllocated=0;const storage=P.resources(site,M.calculate(site)).find(r=>r.unit==='TB');assert.equal(storage.allocated,0);assert.equal(storage.free,100);
});

test('slot search agrees with exhaustive synthetic layouts at absolute and buffer boundaries',()=>{
 const site=M.newSite('Enumerated storage','custom');Object.assign(site,{image:137,allowance:11,bufferPercent:12.5});
 site.nodes.forEach((n,i)=>Object.assign(n,{local:[1235,1300][i],otherLocal:[17,53][i],maxVMs:4,otherVMs:1}));
 for(const row of M.combinations(site)){
  let absolute=0,buffered=0;
  function enumerate(slots){
   if(slots.length<row.avmcs){for(let n=1;n<=16;n++)enumerate([...slots,n]);return;}
   // For this fixture, a VM costs 253 GB plus 51.5 GB per slot.
   const used=slots.reduce((sum,n)=>sum+253+51.5*n,0),total=slots.reduce((a,b)=>a+b,0);
   if(site.nodes.every(n=>used+n.otherLocal<=n.local))absolute=Math.max(absolute,total);
   if(site.nodes.every(n=>used+n.otherLocal+n.local*0.125<=n.local))buffered=Math.max(buffered,total);
  }
  enumerate([]);assert.equal(row.absolute,absolute);assert.equal(row.buffered,buffered);
 }
});

test('synthetic workload sizing stays monotone across node floors and fractional demand',()=>{
 const cluster={name:'Synthetic workload',slots:3,requirements:{ecpu:28.5,ramGB:70,minRatio:2,unsizedACDs:1,acdEcpus:[28,0.5,0]}};
 const result=S.allocationDetails(cluster,3,50);
 // Floors: 28 + 24 + 24, plus 0.5 rounded workload ECPU; 50% of 29 is 14.5.
 assert.equal(result.detail.plannedWorkloadECPU,29);assert.equal(result.detail.baseWithACDFloorsECPU,76.5);assert.equal(result.detail.plannedCPUWithAllowanceECPU,91);assert.equal(result.allocation.cpu,40);assert.equal(result.allocation.memoryPerCPU,2.5);
 let previous=0;for(const demand of [0,0.5,16,24,28.5,100,250]){
  const c={name:'Monotonic workload',slots:3,requirements:{ecpu:demand,ramGB:2*demand,minRatio:2,unsizedACDs:2,acdEcpus:[demand,0,0]}};
  const cpu=S.allocation(c,3,50).cpu;assert.ok(cpu>=previous);previous=cpu;
 }
});
