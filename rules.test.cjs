const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./model.js'),P=require('./planning.js'),S=require('./sizing.js'),R=require('./rules.js');
test('rule registry has stable unique IDs, dates, scope and public evidence links',()=>{
 assert.equal(R.MEMORY_CUTOFF,'2026-09-29');assert.equal(R.CHECKED,'2026-11-07');assert.equal(new Set(R.rules.map(x=>x.id)).size,R.rules.length);
 for(const r of R.rules){assert.equal(r.verifiedOn,R.CHECKED);assert.ok(r.scope.includes('Exadata Cloud@Customer'));assert.ok(r.label);assert.ok(r.notes);for(const url of r.sourceUrls)assert.match(url,/^https:\/\/docs\.oracle\.com\//);}
 assert.equal(R.get('avmc.local.v1').status,'documented');assert.equal(R.get('unknown'),null);assert.strictEqual(R.registry,R.rules);
 assert.ok(R.conflicts.some(x=>x.id==='memory-dates'));assert.ok(R.conflicts.some(x=>x.id==='local-examples'));
});
test('hardware fit cannot be mistaken for verified provisionability',()=>{
 const s=M.newSite(),a=R.assess(s,M.calculate(s),P);
 assert.equal(a.hardware.status,'fits-checked');assert.equal(a.provisioning.status,'not-verified');assert.match(a.provisioning.checks.join(' '),/reclaimable/);
 assert.equal(a.coverage.find(x=>x.id==='workload').state,'partial');assert.equal(a.coverage.find(x=>x.id==='failure').state,'outside-scope');
});
test('unknown hardware or unchecked compute is incomplete, not a green full fit',()=>{
 const s=M.newSite();s.planningIntent='workload';s.hardwareChosen=false;
 assert.equal(R.assess(s,M.calculate(s),P).hardware.status,'incomplete');
 s.hardwareChosen=true;s.checkCompute=false;assert.equal(R.assess(s,M.calculate(s),P).hardware.status,'incomplete');
});
test('hard limits take priority over buffers; a buffer alone remains advisory',()=>{
 const s=M.newSite();s.bufferPercent=80;let a=R.assess(s,M.calculate(s),P);assert.equal(a.hardware.status,'fits-with-warnings');
 s.nodes[0].otherLocal=2200;a=R.assess(s,M.calculate(s),P);assert.equal(a.hardware.status,'over-limit');assert.ok(a.hardware.errors.length);
});
test('memory-driven database CPU uplift appears in assessment and stale detail is suppressed',()=>{
 const s=M.newSite();s.clusters[0].slots=1;s.clusters[0].requirements={ecpu:200,ramGB:1200,minRatio:2,unsizedACDs:0};
 const next=S.build(s,'x11m-large',2,M);let a=R.assess(next,M.calculate(next),P);
 assert.equal(a.memoryAdjustments.length,1);assert.match(a.hardware.warnings.join(' '),/200 to 240/);
 next.clusters[0].requirements.ramGB=1000;a=R.assess(next,M.calculate(next),P);assert.equal(a.memoryAdjustments.length,0);
});
test('the rule assessment preserves existing low-CPU scope qualification',()=>{
 const s=M.newSite();s.clusters[0].cpu=20;s.clusters[0].allocationKind='existing';
 const a=R.assess(s,M.calculate(s),P);assert.equal(a.hardware.status,'fits-with-warnings');assert.equal(a.hardware.errors.length,0);
 assert.match(a.hardware.warnings.join(' '),/existing console/);assert.ok(a.conflicts.some(x=>x.id==='minimum-cpu'));
});
