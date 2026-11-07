const test=require('node:test'),assert=require('node:assert/strict'),M=require('./model.js'),P=require('./planning.js'),S=require('./sizing.js');
function sample(){const s=M.newSite();s.clusters[0].slots=3;s.clusters[0].requirements={ecpu:200,ramGB:800,minRatio:4,unsizedACDs:1,acdEcpus:[120,80,0],incomplete:true};return s;}
test('workload sizing separates base CPU, ACD floors and explicit planning allowance',()=>{
 const c=sample().clusters[0];assert.deepEqual(S.allocation(c,2,50),{cpu:158,memoryPerCPU:4,memoryRule:'current'});
 assert.deepEqual(S.allocation(c,2,0),{cpu:108,memoryPerCPU:4,memoryRule:'current'});
});
test('suggestions are ranked, retain missing-workload flags and do not mutate the plan',()=>{
 const site=sample(),before=JSON.stringify(site),r=S.suggest(site,M,P);
 assert.equal(r.minimum.profile,'x11m-standard');assert.equal(r.minimum.nodes,2);assert.equal(r.incomplete,true);
 assert.ok(r.withBuffers.meetsBuffers);assert.equal(JSON.stringify(site),before);
 assert.ok(r.minimum.candidate.clusters[0].cpu>=40);
});
test('invalid requirements are not replaced by a successful recommendation',()=>{
 const site=sample();site.clusters[0].requirements.ramGB=-1;assert.throws(()=>S.suggest(site,M,P),/Workload RAM/);
 delete site.clusters[0].requirements;assert.throws(()=>S.suggest(site,M,P),/Enter workload/);
});
test('candidate hardware retains other reservations and cannot omit a used server',()=>{
 const site=sample();site.nodes[0].otherLocal=100;const next=S.build(site,'x11m-large',3,M);
 assert.equal(next.nodes[0].otherLocal,100);assert.equal(next.clusters[0].nodes.length,3);
 next.nodes[2].otherMemory=20;assert.throws(()=>S.build(next,'x11m-large',2,M),/Cannot omit/);
});
test('imported requirements survive schema round trip and support a minimum empty AVMC',()=>{
 const site=sample();Object.assign(site.clusters[0].requirements,{ecpu:0,ramGB:0,minRatio:2,unsizedACDs:3,acdEcpus:[0,0,0]});
 const imported=M.importScenario({schema:'exacc-capacity/v1',sites:[site]}).sites[0];
 assert.equal(S.allocation(imported.clusters[0],2,50).cpu,40);S.validate(imported,true);
});
test('high RAM proposes a visible database CPU increase rather than treating AVMC spare CPU as ADB memory',()=>{
 const site=sample(),original=M.clone(site);site.clusters[0].requirements.ramGB=1200;
 const input=M.clone(site),r=S.suggest(site,M,P),c=r.minimum.candidate.clusters[0],d=c.sizingDetail;
 assert.equal(d.requestedWorkloadECPU,200);assert.equal(d.plannedWorkloadECPU,240);assert.equal(d.additionalWorkloadECPU,40);
 assert.equal(d.memoryPerCPU,5);assert.equal(d.baseWithACDFloorsECPU,256);assert.equal(c.cpu,188);
 assert.equal(d.needsDatabaseCPUIncrease,true);assert.equal(r.minimum.requiresDatabaseCPUReview,true);
 assert.match(d.notes.join(' '),/ADB level/);assert.deepEqual(site,input);assert.deepEqual(c.requirements,input.clusters[0].requirements);
 assert.ok(c.cpu*c.nodes.length*d.memoryPerCPU>=1200);assert.notEqual(original.clusters[0].requirements.ramGB,site.clusters[0].requirements.ramGB);
});
test('memory-driven targets retain named database inputs and can be identified as stale after editing',()=>{
 const site=sample();site.clusters[0].requirements.ramGB=1200;
 site.clusters[0].topology={acds:[{id:'acd-1',name:'Apps',adbs:[{id:'adb-1',name:'App',ecpu:200,ramGB:1200}]}]};
 const c=S.build(site,'x11m-standard',2,M).clusters[0];
 assert.equal(c.topology.acds[0].adbs[0].ecpu,200);assert.ok(S.currentSizingDetail(c));
 c.requirements.ramGB=1400;assert.equal(S.currentSizingDetail(c),null);
});
test('an infeasible small node count does not abort the rest of the hardware search',()=>{
 const site=sample();site.sizing={minNodes:2,maxNodes:32,extraCPUPercent:0};
 Object.assign(site.clusters[0].requirements,{ecpu:16000,ramGB:32000,unsizedACDs:0,acdEcpus:[8000,4000,4000],minRatio:2});
 const r=S.suggest(site,M,P);assert.ok(r.minimum);assert.ok(r.minimum.nodes>2);assert.ok(r.rows.some(row=>!row.fit));
 Object.assign(site.clusters[0].requirements,{ecpu:100000,ramGB:200000,acdEcpus:[50000,25000,25000]});
 const impossible=S.suggest(site,M,P);assert.equal(impossible.minimum,null);assert.equal(impossible.rows[0].fit,false);assert.match(impossible.rows[0].reason,/input range/);
});
test('ACD floors and per-VM minimum remain independent of the optional CPU allowance',()=>{
 const site=sample(),q=site.clusters[0].requirements;Object.assign(q,{ecpu:2,ramGB:4,unsizedACDs:2,acdEcpus:[2,0,0],minRatio:2});
 assert.equal(S.allocation(site.clusters[0],2,0).cpu,40);
 site.clusters[0].slots=16;Object.assign(q,{ecpu:0,ramGB:0,unsizedACDs:16,acdEcpus:Array(16).fill(0)});
 assert.equal(S.allocation(site.clusters[0],2,0).cpu,128);
});
test('Base candidates keep the fixed two-node shape and respect asymmetric existing allocations',()=>{
 const site=sample();Object.assign(site.clusters[0].requirements,{ecpu:20,ramGB:40,minRatio:2,unsizedACDs:0,acdEcpus:[10,5,5]});
 assert.throws(()=>S.build(site,'x11m-base',3,M),/two DB servers/);
 site.nodes[0].otherCPU=100;const base=S.build(site,'x11m-base',2,M),r=M.calculate(base);
 assert.ok(r.errors.some(x=>x.includes('DB 1: allocated ECPUs')));assert.ok(r.nodes.reduce((sum,n)=>sum+n.cpu-n.cpuUsed-n.otherCPU,0)>0);
 const suggested=S.suggest(site,M,P);assert.equal(suggested.rows.find(row=>row.profile==='x11m-base').fit,false);
});
