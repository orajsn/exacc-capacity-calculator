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
 const site=sample();site.clusters[0].requirements.ramGB=1200;assert.throws(()=>S.suggest(site,M,P),/more than 5/);
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
