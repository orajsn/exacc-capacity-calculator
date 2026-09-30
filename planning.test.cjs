const test=require('node:test'),assert=require('node:assert/strict'),M=require('./model.js'),P=require('./planning.js');
test('legacy scenario keeps zero local buffer; new targets apply independently',()=>{const s=M.newSite();s.bufferPercent=0;delete s.planning;const rows=P.resources(s,M.calculate(s));assert.equal(rows[0].percent,0);assert.equal(rows[1].percent,30);assert.equal(rows[2].percent,30);assert.equal(rows.length,3);assert.equal(P.sessions(s),null);});
test('30 percent buffer is percent of capacity and permits exact boundary',()=>{const b=P.budget(100,70,30);assert.equal(b.after,0);assert.equal(b.status,'Within buffer');assert.equal(P.budget(100,71,30).status,'Below buffer');assert.equal(P.budget(100,101,0).status,'Over capacity');});
test('2 to 5 GB ratio adds memory without increasing CPU or local storage',()=>{const s=M.newSite();s.baseline=P.capture(s,M.calculate(s));s.clusters[0].memoryPerCPU=5;const changes=P.compare(s,M.calculate(s));assert.equal(changes.find(x=>x.name==='CPU allocation').delta,0);assert.equal(changes.find(x=>x.name==='Local allocation').delta,0);assert.ok(Math.abs(changes.find(x=>x.name==='Memory estimate').delta-979.2)<1e-7);});
test('CPU node overflow cannot hide behind spare capacity on other servers',()=>{const s=M.newSite('Four nodes','x11m-standard',4);s.clusters[0].nodes=[1,2];s.clusters[0].cpu=700;s.nodes[0].otherCPU=100;const row=P.resources(s,M.calculate(s)).find(x=>x.name==='CPU');assert.ok(row.free>0);assert.equal(row.status,'Over capacity');});
test('Exadata check requires both manual values; zero allocation is valid',()=>{const s=M.newSite();s.planning={storageCapacity:100};assert.equal(P.resources(s,M.calculate(s)).length,3);s.planning.storageAllocated=0;assert.equal(P.resources(s,M.calculate(s))[3].after,70);s.planning.storageAllocated=75;assert.equal(P.resources(s,M.calculate(s))[3].status,'Below buffer');});
test('session arithmetic uses one ADB and does not multiply by node count',()=>{const s=M.newSite('Many nodes','x11m-standard',4);s.planning={adbECPU:8,sessionDemand:1000};assert.equal(P.sessions(s).estimated,600);assert.equal(P.sessions(s).requiredECPU,14);s.planning.sessionsPerECPU=325;s.planning.sessionMode='shared';assert.equal(P.sessions(s).estimated,2600);assert.equal(P.sessions(s).remaining,1600);});
test('invalid inputs and corrupt baseline fail rather than produce healthy results',()=>{const s=M.newSite();for(const planning of [{cpuBuffer:-1},{memoryBuffer:NaN},{storageCapacity:0},{adbECPU:0},{sessionsPerECPU:0},{sessionMode:'other'}]){s.planning=planning;assert.throws(()=>P.validate(s));}delete s.planning;s.baseline={local:0};assert.throws(()=>P.validate(s));});
test('baseline survives round trip and does not recalculate with target',()=>{const s=M.newSite();s.baseline=P.capture(s,M.calculate(s));s.clusters[0].slots=16;const imported=M.importScenario(JSON.parse(JSON.stringify({schema:'exacc-capacity/v1',sites:[s]}))).sites[0];P.validate(imported);const delta=P.compare(imported,M.calculate(imported)).find(x=>x.name==='Local allocation');assert.equal(delta.before,1608);assert.equal(delta.after,2226);assert.equal(delta.delta,618);});
test('unchecked compute is excluded from capacity and baseline comparison',()=>{const s=M.newSite();s.checkCompute=false;s.baseline=P.capture(s,M.calculate(s));assert.equal(P.resources(s,M.calculate(s)).length,1);s.checkCompute=true;assert.equal(P.compare(s,M.calculate(s)).find(x=>x.name==='Memory estimate').delta,null);});

test('machine summary includes all enabled capacity and buffer failures', () => {
 const site = M.newSite();
 site.planning = {storageCapacity: 100, storageAllocated: 110, memoryBuffer: 90};
 const summary = P.summary(site, M.calculate(site));
 assert.equal(summary.status, 'error');
 assert.match(summary.text, /Shared database storage: over capacity/);
 assert.match(summary.text, /Memory \(estimated\): fits, but below buffer target/);
 site.planning.storageAllocated = 0;
 assert.equal(P.summary(site, M.calculate(site)).status, 'warning');
 site.planning.memoryBuffer = 30;
 site.clusters[0].cpu = 600;
 assert.match(P.summary(site, M.calculate(site)).text, /CPU: fits, but below buffer target/);
});

test('machine summary discloses unchecked resources and retains creation-limit failures', () => {
 const site = M.newSite();
 site.checkCompute = false;
 let summary = P.summary(site, M.calculate(site));
 assert.match(summary.text, /CPU \/ memory not checked/);
 assert.match(summary.text, /Shared database storage not checked/);
 site.clusters[0].slots = 17;
 summary = P.summary(site, M.calculate(site));
 assert.equal(summary.status, 'error');
 assert.match(summary.text, /Exceeds a hardware or service limit/);
});
