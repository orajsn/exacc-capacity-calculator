'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('./findings.js'),T=require('./topology.js'),M=require('./model.js'),P=require('./planning.js'),A=require('./assessment.js');
function scenario(){
 const s={sites:[M.newSite('Machine A'),M.newSite('Machine B')]};
 s.sites[0].clusters.push({...structuredClone(s.sites[0].clusters[0]),name:'Other AVMC'});
 s.sites.forEach((machine,si)=>machine.clusters.forEach((c,ci)=>{c.topology={acds:[{...T.newACD(`Group ${si}-${ci}`),adbs:[T.newADB('First'),T.newADB('Second')]}]};}));
 return T.ensureIds(s);
}
function row(s,code='adb_workload_missing'){
 const c=s.sites[0].clusters[0],a=c.topology.acds[0];return {code,siteIndex:0,clusterIndex:0,acdId:a.id,adbId:a.adbs[1].id,message:'Missing input'};
}
test('typed targets resolve the same machine, AVMC and database after reordering',()=>{
 const s=scenario(),target=F.targetFor(row(s),s),expected={siteUid:s.sites[0].uid,clusterUid:s.sites[0].clusters[0].uid,adbId:s.sites[0].clusters[0].topology.acds[0].adbs[1].id};
 s.sites.reverse();s.sites[1].clusters.reverse();s.sites[1].clusters[1].topology.acds[0].adbs.reverse();
 const resolved=F.resolveTarget(target,s);
 assert.equal(resolved.siteIndex,1);assert.equal(resolved.clusterIndex,1);assert.equal(resolved.siteUid,expected.siteUid);assert.equal(resolved.clusterUid,expected.clusterUid);assert.equal(resolved.adbId,expected.adbId);assert.equal(resolved.field,'ecpu');
});
test('deleted entities fall back only to their surviving parent, never a replacement at the index',()=>{
 const s=scenario(),target=F.targetFor(row(s),s),machine=s.sites[0],cluster=machine.clusters[0],acd=cluster.topology.acds[0];
 acd.adbs.splice(1,1);let r=F.resolveTarget(target,s);assert.equal(r.acdId,acd.id);assert.equal(r.adbId,undefined);assert.equal(r.field,undefined);
 cluster.topology.acds=[];r=F.resolveTarget(target,s);assert.equal(r.clusterUid,cluster.uid);assert.equal(r.acdId,undefined);assert.equal(r.field,undefined);
 machine.clusters.shift();r=F.resolveTarget(target,s);assert.equal(r.siteUid,machine.uid);assert.equal(r.clusterIndex,undefined);assert.equal(r.field,undefined);
 s.sites.shift();assert.equal(F.resolveTarget(target,s),null);
});
test('legacy objects without UIDs use object identity, not stale array positions',()=>{
 const s=scenario();s.sites.forEach(m=>{delete m.uid;m.clusters.forEach(c=>delete c.uid);});
 const target=F.targetFor(row(s),s);s.sites.reverse();s.sites[1].clusters.reverse();
 const r=F.resolveTarget(target,s);assert.equal(r.siteIndex,1);assert.equal(r.clusterIndex,1);
 s.sites.pop();assert.equal(F.resolveTarget(target,s),null);
 assert.equal(F.resolveTarget({siteIndex:0,panelId:'panel-machine'},s),null);
});
test('duplicate IDs never select an arbitrary match',()=>{
 const s=scenario(),target=F.targetFor(row(s),s);s.sites[1].uid=s.sites[0].uid;assert.equal(F.resolveTarget(target,s),null);
});
test('targets ignore injected selectors, panels and non-allowlisted fields',()=>{
 const s=scenario(),input={...row(s),panelId:'body',field:'[onclick]',selector:'script'},target=F.targetFor(input,s);
 assert.equal(target.panelId,'panel-topology');assert.equal(target.field,'ecpu');assert.equal(target.selector,undefined);
 assert.equal(F.resolveTarget({...target,panelId:'body'},s),null);
 assert.equal(F.resolveTarget({...target,field:'[onclick]'},s).field,undefined);
});
test('an ambiguous database issue opens the ACD without pretending its field is known',()=>{
 const s=scenario(),issue=row(s,'adb_name_missing');delete issue.adbId;
 const r=F.targetFor(issue,s);assert.ok(r.acdId);assert.equal(r.adbId,undefined);assert.equal(r.field,undefined);
});
test('missing RAM and peer settings link to the precise database input',()=>{
 const s=scenario(),c=s.sites[0].clusters[0],d=c.topology.acds[0].adbs[1];d.ecpu=2;
 assert.equal(F.targetFor(row(s),s).field,'ramGB');
 const target=F.targetFor(row(s,'peer_settings_unconfirmed'),s);assert.equal(target.adbId,d.id);assert.equal(target.field,'peerSettingsConfirmed');
 const role=F.targetFor(row(s,'independent_switchover_unprotected'),s);assert.equal(role.adbId,undefined);assert.equal(role.field,'role');
});
test('missing shared storage opens the missing capacity or allocated field',()=>{
 const s=scenario(),issue={code:'shared-storage',machineIndex:0};assert.equal(F.targetFor(issue,s).field,'storageCapacity');
 s.sites[0].planning={storageCapacity:100,storageAllocated:null};assert.equal(F.targetFor(issue,s).field,'storageAllocated');
});
test('a single AVMC CPU shortage targets its allocation and retains its UID after reorder',()=>{
 const s=scenario(),machine=s.sites[0];machine.clusters.length=1;const c=machine.clusters[0];c.cpu=800;
 const finding=A.assess(s,M,P,T).findings.corrections.find(x=>x.resource==='CPU'&&x.nodeId===1);
 assert.equal(finding.target.panelId,'panel-avmc');assert.equal(finding.target.clusterUid,c.uid);assert.equal(finding.target.field,'cpu');
 machine.clusters.unshift({...structuredClone(c),uid:'different-avmc',name:'Other AVMC',cpu:40});s.sites.reverse();
 const r=F.resolveTarget(finding.target,s);assert.equal(r.siteIndex,1);assert.equal(r.clusterIndex,1);assert.equal(r.clusterUid,c.uid);assert.equal(r.field,'cpu');
});
test('a shortage solely in Other allocations targets the machine allocation table',()=>{
 const s=scenario();s.sites[0]=M.resizeNodes(s.sites[0],3);s.sites[0].clusters.forEach(c=>{c.nodes=[2,3];});s.sites[0].nodes[0].otherCPU=800;
 const finding=A.assess(s,M,P,T).findings.corrections.find(x=>x.resource==='CPU'&&x.nodeId===1);
 assert.equal(finding.target.panelId,'panel-machine');assert.equal(finding.target.field,'other-allocations');assert.equal(finding.target.clusterUid,undefined);assert.equal(finding.target.siteUid,s.sites[0].uid);
 // Even with a placed AVMC, reducing that AVMC cannot cure Other > capacity.
 s.sites[0].clusters[0].nodes=[1,2];const r=A.assess(s,M,P,T).findings.corrections.find(x=>x.resource==='CPU'&&x.nodeId===1);assert.equal(r.target.panelId,'panel-machine');
});
test('multiple contributing AVMCs and mixed inputs do not imply a unique corrective field',()=>{
 const s=scenario(),machine=s.sites[0];machine.clusters.forEach(c=>{c.cpu=500;});
 let finding=A.assess(s,M,P,T).findings.corrections.find(x=>x.resource==='CPU'&&x.nodeId===1);
 assert.equal(finding.target.panelId,'panel-avmc');assert.equal(finding.target.clusterUid,undefined);assert.equal(finding.target.field,undefined);
 machine.clusters.length=1;machine.clusters[0].cpu=800;machine.nodes[0].otherCPU=10;
 finding=A.assess(s,M,P,T).findings.corrections.find(x=>x.resource==='CPU'&&x.nodeId===1);
 assert.equal(finding.target.panelId,'panel-avmc');assert.equal(finding.target.clusterUid,machine.clusters[0].uid);assert.equal(finding.target.field,undefined);
});
test('buffer warnings review their actual contributors and shared storage keeps its field',()=>{
 const s=scenario(),machine=s.sites[0];machine.clusters.length=1;machine.clusters[0].cpu=600;
 let finding=A.assess(s,M,P,T).findings.advisories.find(x=>x.resource==='CPU'&&x.nodeId===1);
 assert.equal(finding.target.panelId,'panel-avmc');assert.equal(finding.target.field,'cpu');
 s.sites[0]=M.resizeNodes(machine,3);s.sites[0].clusters[0].nodes=[2,3];s.sites[0].nodes[0].otherCPU=600;
 finding=A.assess(s,M,P,T).findings.advisories.find(x=>x.resource==='CPU'&&x.nodeId===1);assert.equal(finding.target.panelId,'panel-machine');
 s.sites[0].planning={storageCapacity:1,storageAllocated:2};finding=A.assess(s,M,P,T).findings.corrections.find(x=>x.resource==='Shared database storage');
 assert.equal(finding.target.panelId,'panel-capacity');assert.equal(finding.target.field,'storageAllocated');
});
test('outside-scope checks do not inflate missing-input counts or gain acknowledgement links',()=>{
 const s=scenario(),a=A.assess(s,M,P,T),f=a.findings;
 assert.ok(f.externalChecks.some(x=>x.code==='commercial-approval'));
 assert.ok(f.missingInputs.some(x=>x.code==='adb_workload_missing'&&x.target.adbId));
 assert.equal(f.missingInputs.some(x=>['provisionability','availability-performance','commercial-approval'].includes(x.code)),false);
 assert.ok(f.externalChecks.every(x=>x.target===null));
 const legacyCodes=new Set([...a.hardErrors,...a.warnings,...a.unknowns].map(x=>x.code));for(const code of ['provisionability','availability-performance','commercial-approval'])assert.ok(legacyCodes.has(code));
});
test('topology metadata locates the peer copy that is actually missing a value',()=>{
 const s=scenario(),p=s.sites[0].clusters[0].topology.acds[0],standby=s.sites[1].clusters[0].topology.acds[0];
 p.role='primary';standby.role='standby';p.adbs=[{...T.newADB('DB'),ecpu:4,ramGB:8,storageTB:1}];standby.adbs=[{...T.newADB('DB'),ecpu:null,ramGB:8,storageTB:1}];T.linkPeers(s,p.id,standby.id);
 const issue=T.inspect(s).warnings.find(x=>x.code==='peer_ecpu_unknown');assert.equal(issue.siteUid,s.sites[1].uid);assert.equal(issue.acdId,standby.id);assert.equal(issue.adbId,standby.adbs[0].id);
 assert.equal(F.targetFor(issue,s).siteIndex,1);
});
test('peer confirmations do not resolve external readiness or approval checks',()=>{
 const s=scenario(),p=s.sites[0].clusters[0].topology.acds[0],standby=s.sites[1].clusters[0].topology.acds[0];p.role='primary';standby.role='standby';
 p.adbs=[{...T.newADB('DB'),ecpu:4,ramGB:8,storageTB:1,peerSettingsConfirmed:true}];standby.adbs=[{...T.newADB('DB'),ecpu:4,ramGB:8,storageTB:1}];T.linkPeers(s,p.id,standby.id);
 let a=A.assess(s,M,P,T),finding=a.findings.missingInputs.find(x=>x.code==='peer_settings_unconfirmed');assert.equal(finding.target.adbId,standby.adbs[0].id);
 standby.adbs[0].peerSettingsConfirmed=true;a=A.assess(s,M,P,T);assert.equal(a.findings.missingInputs.some(x=>x.code==='peer_settings_unconfirmed'),false);
 for(const code of ['dr_readiness_unchecked','commercial-approval','provisionability'])assert.ok(a.findings.externalChecks.some(x=>x.code===code&&x.target===null),code);
});
test('rendered finding labels are escaped and buttons carry only numeric references',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),s=scenario(),summary={innerHTML:'',querySelectorAll(){return [];}},coverage={innerHTML:''};
 s.sites[0].name='<img src=x onerror=run()>';s.sites[0].clusters[0].name='<script>bad</script>';
 const ctx={window:{ExaAssessment:A,ExaTopology:T},state:s,M,P,$:id=>id==='assessment-summary'?summary:coverage,escapeHTML:A.escape};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('./assessment-ui.js'),'utf8'),ctx);vm.runInContext('renderAssessment()',ctx);
 assert.doesNotMatch(summary.innerHTML,/<img|<script/);assert.match(summary.innerHTML,/&lt;img/);assert.match(summary.innerHTML,/Review input/);
 for(const match of summary.innerHTML.matchAll(/data-finding-target="([^"]*)"/g))assert.match(match[1],/^\d+$/);
 assert.match(summary.innerHTML,/Missing information/);assert.match(summary.innerHTML,/Not checked in this estimate/);assert.match(summary.innerHTML,/does not establish Oracle approval/);
 // Reproduce the review case: valid allocations, one blank database RAM input,
 // and one stale inventory advisory. Singular counts must remain natural.
 s.sites.length=1;s.sites[0].clusters.length=1;const c=s.sites[0].clusters[0];c.topology.acds[0].adbs=[{...T.newADB('DB'),ecpu:20,ramGB:40,storageTB:1}];
 c.requirements=require('./requirements.js').inventoryRequirements(c);c.topology.acds[0].adbs[0].ramGB=null;
 vm.runInContext('renderAssessment()',ctx);
 assert.match(summary.innerHTML,/Fits checked capacity; workload inputs need review/);
 assert.match(summary.innerHTML,/>1<\/strong> missing input · <strong>1<\/strong> advisory\./);
});
