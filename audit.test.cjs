const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./model.js'),A=require('./audit.js'),P=require('./planning.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('current memory adds 300 MB per ECPU per VM while local storage is unchanged',()=>{
 const site=M.newSite(),c=site.clusters[0];
 near(M.clusterCost(c).memory,832.32);
 c.memoryRule='legacy';c.legacyCreatedBeforeCutoff=true;c.legacyRatioUnchanged=true;
 near(M.clusterCost(c).memory,734.4);
 near(M.clusterCost(c).total,1608);
});
test('legacy requires both checklist answers and unknown history is conservative',()=>{
 const c=M.newSite().clusters[0];c.memoryRule='legacy';c.legacyCreatedBeforeCutoff=true;
 assert.equal(M.memorySizing(c).verified,false);near(M.clusterCost(c).memory,832.32);
 c.legacyRatioUnchanged=true;assert.equal(M.memorySizing(c).verified,true);
 delete c.memoryRule;assert.equal(M.memorySizing(c).verified,false);
 near(M.clusterCost(c).memory,832.32);
});
test('new AVMC budgets 135 GB minimum per VM and shape-specific local storage',()=>{
 const site=M.newSite();site.clusters=[];
 const result=A.candidate(site,M.calculate(site),M);
 near(result.cost.memorySizing.currentRawPerVM,134.64);
 near(result.cost.memoryPerVM,135);near(result.cost.perVM,340.5);
 assert.equal(result.fits,true);
});
test('new candidate exposes shortages on each node even with positive aggregate spare memory',()=>{
 const site=M.newSite();site.clusters=[];site.nodes[0].otherMemory=1300;
 const result=A.candidate(site,M.calculate(site),M);
 near(result.rows[0].memoryGap,45);near(result.rows[1].memoryGap,0);
 assert.equal(result.fits,false);
 site.nodes[0].otherLocal=2000;site.nodes[0].otherCPU=750;site.nodes[0].otherVMs=6;
 const row=A.candidate(site,M.calculate(site),M).rows[0];
 near(row.localGap,97.5);near(row.cpuGap,30);assert.equal(row.vmGap,1);
});
test('console reconciliation includes other reservations and exposes unexplained differences',()=>{
 const site=M.newSite();site.nodes[0].otherMemory=20;site.nodes[0].otherLocal=30;
 site.audit={observedMemory:860,observedLocal:1638,toleranceGB:1};
 const rows=A.reconcile(site,M.calculate(site));
 near(rows[0].estimate,852.32);near(rows[0].delta,7.68);
 assert.equal(rows[0].status,'Difference to explain');assert.equal(rows[1].status,'Within entered tolerance');
});
test('blank, zero and unchecked reconciliation are distinct; unknown memory cannot be a verified match',()=>{
 const site=M.newSite();
 assert.equal(A.reconcile(site,M.calculate(site))[0].status,'Enter console total');
 site.audit={observedMemory:0};assert.equal(A.reconcile(site,M.calculate(site))[0].status,'Difference to explain');
 delete site.clusters[0].memoryRule;site.audit.observedMemory=832.32;
 assert.match(A.reconcile(site,M.calculate(site))[0].status,/unconfirmed/);
 site.checkCompute=false;assert.equal(A.reconcile(site,M.calculate(site))[0].estimate,null);
 assert.equal(A.candidate(site,M.calculate(site),M).fits,false);
});
test('a captured legacy reference stays fixed across an upgraded memory rule and JSON import',()=>{
 const site=M.newSite();Object.assign(site.clusters[0],{memoryRule:'legacy',legacyCreatedBeforeCutoff:true,legacyRatioUnchanged:true});
 site.baseline=P.capture(site,M.calculate(site));site.clusters[0].memoryRule='current';
 const restored=M.importScenario(JSON.parse(JSON.stringify({schema:'exacc-capacity/v1',sites:[site]}))).sites[0];
 near(restored.baseline.memory,734.4);near(P.compare(restored,M.calculate(restored)).find(r=>r.name==='Memory estimate').delta,97.92);
});
test('invalid audits and checklist data are rejected',()=>{
 const site=M.newSite();for(const audit of [{newCPU:0},{newSlots:17},{observedMemory:-1},{toleranceGB:NaN}]){site.audit=audit;assert.throws(()=>A.validate(site));}
 delete site.audit;site.clusters[0].memoryRule='unexpected';assert.throws(()=>M.validate(site));
 site.clusters[0].memoryRule='legacy';site.clusters[0].legacyRatioUnchanged='true';assert.throws(()=>M.validate(site));
});
