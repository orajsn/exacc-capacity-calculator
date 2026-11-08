'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./model.js'),P=require('./planning.js'),S=require('./sizing.js'),T=require('./topology.js');
const X=require('./scenarios.js'),C=require('./conventional.js'),R=require('./rules.js'),A=require('./assessment.js'),D=require('./drafts.js');
const Q=require('./requirements.js'),F=require('./findings.js');
const Live=require('./live-capacity.js'),Starts=require('./starters.js'),L=require('./library.js');

function plan(names=['Production']){
 const value={schema:'exacc-capacity/v1',sites:names.map((name,index)=>{
  const s=M.newSite(name);s.siteName=index?'Recovery site':'Primary site';s.planningIntent='allocation';s.hardwareChosen=true;
  Object.assign(s.clusters[0],{slots:2,cpu:80,memoryPerCPU:4});return s;
 })};T.ensureIds(value);return value;
}
function databaseGroup(site,name='Payments',role='unprotected'){
 const c=site.clusters[0],a=T.newACD(name);a.role=role;a.adbs=[{...T.newADB('PaymentsDB'),ecpu:16,ramGB:64,storageTB:1}];
 c.topology={acds:[a]};c.requirements=T.databaseTotals(c).requirements;return a;
}
function validateSites(sites){sites.forEach(s=>{M.validate(s);P.validate(s);S.validate(s);C.validate(s);});T.validateState({sites});}
function validateAll(value){
 for(const sites of [value.sites,...(value.alternatives||[]).map(a=>a.sites)])validateSites(sites);
 return value;
}
function resume(raw){const value=X.preserveExtras(M.importScenario(raw),raw,M,validateSites);T.ensureIds(value);return validateAll(value);}
const assess=value=>A.assess(value,M,P,T,R,C);

test('same-content CSV replacement cannot turn per-ACD CPU floor overcommit into a hardware fit',()=>{
 const value=plan(),s=value.sites[0],c=s.clusters[0];s.siteName='DC';s.sizing={extraCPUPercent:0,minNodes:2,maxNodes:2};s.nodes.forEach(n=>n.otherCPU=555);c.name='Apps';
 c.topology={acds:[{...T.newACD('Heavy'),adbs:[{...T.newADB('Core'),ecpu:400,ramGB:800,storageTB:1}]},{...T.newACD('Small'),adbs:[{...T.newADB('Tiny'),ecpu:1,ramGB:2,storageTB:1}]}]};
 c.requirements=Q.inventoryRequirements(c);
 const standard=site=>S.suggest(site,M,P).rows.find(r=>r.profile==='x11m-standard');
 const before=standard(s);assert.equal(before.candidate.clusters[0].cpu,208);assert.equal(before.fit,false);
 const csv='site,machine,avmc,acd,adb,ecpu,ram_gb,storage_tb\nDC,Production,Apps,Heavy,Core,400,800,1\nDC,Production,Apps,Small,Tiny,1,2,1';
 const replaced=X.applyCSV(value,X.previewCSV(csv),{mode:'replace-active',siteIndex:0},M,T),next=resume(JSON.parse(JSON.stringify(replaced))).sites[0],after=standard(next);
 assert.equal(Q.status(next.clusters[0]).stale,false);assert.equal(after.candidate.clusters[0].cpu,208);assert.equal(after.fit,false);assert.deepEqual(after.result.errors,before.result.errors);
 // A previously damaged JSON from this import path must require review, too.
 delete next.clusters[0].requirements.acdEcpus;assert.equal(Q.status(next.clusters[0]).stale,true);assert.throws(()=>S.suggest(next,M,P),/Review and apply/);
 next.clusters[0].requirements=Q.inventoryRequirements(next.clusters[0]);const repaired=standard(next);
 assert.equal(repaired.candidate.clusters[0].cpu,208);assert.equal(repaired.fit,false);assert.deepEqual(repaired.result.errors,before.result.errors);
});

test('CSV inventory replacement does not reduce an independent manual CPU floor allocation',()=>{
 const value=plan(),s=value.sites[0],c=s.clusters[0];s.siteName='DC';s.sizing={extraCPUPercent:0,minNodes:2,maxNodes:2};s.nodes.forEach(n=>n.otherCPU=555);c.name='Apps';
 c.requirements={source:'manual',ecpu:401,ramGB:802,minRatio:2,unsizedACDs:0,acdEcpus:[400,1],incomplete:false};
 const standard=site=>S.suggest(site,M,P).rows.find(r=>r.profile==='x11m-standard'),before=standard(s);
 const csv='site,machine,avmc,acd,adb,ecpu,ram_gb,storage_tb\nDC,Production,Apps,Heavy,Core,400,800,1\nDC,Production,Apps,Small,Tiny,1,2,1';
 const replaced=X.applyCSV(value,X.previewCSV(csv),{mode:'replace-active',siteIndex:0},M,T),next=resume(JSON.parse(JSON.stringify(replaced))).sites[0],after=standard(next);
 assert.equal(Q.source(next.clusters[0]),'manual');assert.deepEqual(next.clusters[0].requirements.acdEcpus,[400,1]);assert.equal(before.candidate.clusters[0].cpu,208);assert.equal(after.candidate.clusters[0].cpu,208);assert.equal(after.fit,false);assert.deepEqual(after.result.errors,before.result.errors);
});

test('manual totals remain independent while applied inventory totals become stale after CPU or RAM edits',()=>{
 const value=plan(),s=value.sites[0],a=databaseGroup(s),c=s.clusters[0];
 c.requirements={source:'manual',ecpu:40,ramGB:160,unsizedACDs:0,minRatio:4,incomplete:false};
 const before=JSON.stringify(c.requirements);a.adbs[0].ecpu=20;
 assert.equal(JSON.stringify(c.requirements),before);assert.equal(Q.status(c).stale,false);
 assert.ok(assess(value).warnings.some(x=>x.code==='manual-inventory-difference'));
 c.requirements=Q.inventoryRequirements(c);assert.equal(c.requirements.ecpu,20);assert.equal(Q.status(c).stale,false);
 a.adbs[0].ramGB=80;assert.equal(c.requirements.ramGB,64);assert.equal(Q.status(c).stale,true);
 const review=assess(value);assert.equal(review.status,'partial');assert.equal(review.headline,'Fits checked capacity; workload inputs need review');assert.ok(review.machines[0].result);assert.ok(review.warnings.some(x=>x.code==='requirements-stale'));
 c.requirements=Q.useManual(c);assert.equal(c.requirements.ecpu,40);assert.equal(c.requirements.ramGB,160);assert.equal(Q.status(c).stale,false);
});

test('missing workload inputs preserve available allocation checks while unselected hardware remains incomplete',()=>{
 const value=plan(),s=value.sites[0],a=databaseGroup(s),c=s.clusters[0],allocation=M.calculate(s);a.adbs[0].ramGB=null;c.requirements=Q.inventoryRequirements(c);
 const review=assess(value);assert.equal(review.status,'partial');assert.equal(review.headline,'Fits checked capacity; workload inputs need review');assert.equal(review.machines[0].result.used,allocation.used);assert.ok(review.machines[0].constraints.length>0);
 assert.ok(review.findings.missingInputs.some(x=>x.code==='adb_workload_missing'));assert.ok(review.findings.missingInputs.some(x=>x.code==='workload-incomplete'));
 const report=A.reportHTML(value,M,P,T,R,{conventional:C,requirements:Q});assert.match(report,/AVMC allocation estimates/);assert.doesNotMatch(report,/Capacity is not calculated until the input and hardware choice are complete/);
 s.planningIntent='workload';s.hardwareChosen=false;const unselected=assess(value);assert.equal(unselected.status,'incomplete');assert.equal(unselected.machines[0].result,null);assert.equal(unselected.headline,'Complete the plan before assessing capacity');
 assert.match(A.reportHTML(value,M,P,T,R,{conventional:C,requirements:Q}),/Capacity is not calculated until the input and hardware choice are complete/);
});

test('rename, order, storage and DR metadata changes do not invalidate inventory CPU/RAM totals',()=>{
 const value=plan(),s=value.sites[0],a=databaseGroup(s),c=s.clusters[0];a.adbs.push({...T.newADB('LedgerDB'),ecpu:8,ramGB:32,storageTB:0.5});c.requirements=Q.inventoryRequirements(c);
 s.name='Renamed machine';c.name='Renamed AVMC';a.name='Renamed ACD';a.adbs[0].name='Renamed database';a.adbs[0].storageTB=3;a.adbs[0].independentSwitchover=true;a.adbs.reverse();
 assert.equal(Q.status(c).stale,false);assert.equal(assess(value).warnings.some(x=>x.code==='requirements-stale'),false);
 const restored=resume(JSON.parse(JSON.stringify(value)));assert.equal(Q.status(restored.sites[0].clusters[0]).stale,false);
});

test('inventory preview receipts expire after values, active machine or stable identities change',()=>{
 const value=plan(['Production','Recovery']);databaseGroup(value.sites[0]);databaseGroup(value.sites[1]);
 const receipt=Q.createPreview(value,0,0),before=JSON.stringify(value);assert.equal(Q.previewIsCurrent(receipt,value,0),true);assert.equal(Q.previewIsCurrent(receipt,value,1),false);
 assert.equal(JSON.stringify(value),before,'preview does not mutate the plan');
 value.sites[0].clusters[0].topology.acds[0].adbs[0].ecpu=32;assert.equal(Q.previewIsCurrent(receipt,value,0),false);
 const current=Q.createPreview(value,0,0);value.sites[0].clusters[0].uid='replacement-avmc';assert.equal(Q.previewIsCurrent(current,value,0),false);
});

test('findings carry exact machine, AVMC, ACD and database identities and safe field targets',()=>{
 const value=plan(['Production','Recovery']),a=databaseGroup(value.sites[1]),s=value.sites[1],c=s.clusters[0],d=a.adbs[0];d.ramGB=null;
 const review=assess(value),row=review.findings.missingInputs.find(x=>x.code==='adb_workload_missing'&&x.adbId===d.id);assert.ok(row);
 const target=row.target||F.targetFor(row,value);assert.equal(target.siteUid,s.uid);assert.equal(target.clusterUid,c.uid);assert.equal(target.acdId,a.id);assert.equal(target.adbId,d.id);assert.equal(target.field,'ramGB');assert.equal(target.step,2);
 value.sites.reverse();assert.equal(F.resolveTarget(target,value).siteIndex,0);
 c.topology.acds=[];const parent=F.resolveTarget(target,value);assert.equal(parent.clusterUid,c.uid);assert.equal(parent.acdId,undefined);assert.equal(parent.field,undefined);
 value.sites.splice(0,1);assert.equal(F.resolveTarget(target,value),null);
});

test('removed finding identities never target a replacement AVMC or ADB at the old array position',()=>{
 const value=plan(),a=databaseGroup(value.sites[0]),s=value.sites[0],c=s.clusters[0],d=a.adbs[0];
 const target=F.targetFor({code:'adb_workload_missing',machineIndex:0,clusterIndex:0,acdId:a.id,adbId:d.id},value);
 a.adbs[0]={...T.newADB('Replacement database'),ecpu:null,ramGB:null,storageTB:null};
 const acdTarget=F.resolveTarget(target,value);assert.equal(acdTarget.acdId,a.id);assert.equal(acdTarget.adbId,undefined);assert.equal(acdTarget.field,undefined);
 s.clusters[0]=M.newSite().clusters[0];T.ensureIds(value);
 const machineTarget=F.resolveTarget(target,value);assert.equal(machineTarget.clusterIndex,undefined);assert.equal(machineTarget.clusterUid,undefined);assert.equal(machineTarget.field,undefined);
});

test('live capacity keeps per-server CPU and memory shortages visible despite positive machine totals',()=>{
 const s=M.newSite();s.nodes[0].otherCPU=650;s.nodes[0].otherMemory=1100;const before=JSON.stringify(s),result=M.calculate(s);
 const machine=Live.build(s,result,P),server=Live.build(s,result,P,{scope:'node:1'}),metric=(view,id)=>view.metrics.find(m=>m.id===id);
 assert.equal(metric(machine,'cpu').free,550);assert.equal(metric(server,'cpu').free,-50);assert.ok(Math.abs(metric(machine,'memory').free-847.68)<1e-7);assert.ok(Math.abs(metric(server,'memory').free+126.16)<1e-7);
 assert.equal(machine.level,'error');assert.equal(server.level,'error');assert.match(machine.note,/DB 1/);assert.deepEqual(metric(machine,'cpu').affectedNodes,[1]);assert.deepEqual(metric(machine,'memory').affectedNodes,[1]);
 assert.equal(server.scopeLabel,'DB 1 only');assert.equal(JSON.stringify(s),before);
});

test('live capacity clears unchecked or unselected compute values and labels preview state separately',()=>{
 const s=M.newSite(),result=M.calculate(s);s.checkCompute=false;
 const off=Live.build(s,M.calculate(s),P),cpu=off.metrics.find(m=>m.id==='cpu'),memory=off.metrics.find(m=>m.id==='memory');
 assert.equal(cpu.checked,false);assert.equal(cpu.free,null);assert.equal(memory.checked,false);assert.equal(memory.free,null);assert.equal(off.metrics.find(m=>m.id==='local').free,2878);
 const unknown=Live.build(s,result,P,{ready:false});assert.equal(unknown.level,'draft');assert.ok(unknown.metrics.every(m=>!m.checked&&m.free===null));
 s.checkCompute=true;const preview=Live.build(s,result,P,{ready:false,preview:true,scope:'node:2'});assert.equal(preview.preview,true);assert.equal(preview.scope,'node:2');assert.equal(preview.metrics.find(m=>m.id==='cpu').free,600);
 assert.equal(Live.build(s,result,P,{scope:'node:999'}).scope,'machine');
});

test('live capacity does not claim a complete fit when manually checked shared storage is over capacity',()=>{
 const s=M.newSite();s.planning={storageCapacity:10,storageAllocated:12};const live=Live.build(s,M.calculate(s),P);
 assert.equal(live.level,'error');assert.match(live.note,/shared|Exadata/i);assert.doesNotMatch(live.note,/Meets the checked capacity/);
});

test('quick and example starters create separate valid plan identities and explicit illustrative content',()=>{
 const dependencies={model:M,topology:T,library:L,rules:R,requirements:Q},quick=Starts.create('quick',dependencies),example=Starts.create('example',dependencies);
 assert.notEqual(quick.project.id,example.project.id);assert.equal(quick.sites[0].clusters.length,0);assert.equal(quick.sites[0].checkCompute,false);assert.equal(quick.sites[0].planningIntent,'allocation');
 assert.equal(example.sites.length,2);assert.match(example.project.notes,/Illustrative/);assert.equal(T.inspect(example).counts.linkedPairs,1);
 assert.doesNotThrow(()=>validateAll(quick));assert.doesNotThrow(()=>validateAll(example));
 example.sites.forEach(s=>assert.equal(Q.status(s.clusters[0]).stale,false));
 const next=Starts.create('example',dependencies);assert.notEqual(next.project.id,example.project.id);assert.notEqual(next.sites[0].uid,example.sites[0].uid);
});

test('legacy JSON remains usable without inventing a database inventory or deployment approval',()=>{
 const raw={schema:'exacc-capacity/v1',sites:[M.newSite('Existing machine')]},expected=M.calculate(raw.sites[0]);
 const restored=resume(JSON.parse(JSON.stringify(raw))),a=assess(restored);
 assert.equal(a.machines[0].result.free,expected.free);assert.equal(a.totals.namedACDs,0);
 assert.ok(a.unknowns.some(i=>i.code==='named-inventory'));assert.ok(a.unknowns.some(i=>i.code==='provisionability'));
 assert.notEqual(a.status,'fit');assert.equal(raw.sites[0].uid,undefined);
});

test('new JSON retains topology, full alternatives and old-rule provenance without aliasing snapshots',()=>{
 const original=plan();databaseGroup(original.sites[0]);
 original.project={name:'Example capacity study',notes:'Growth is a planning assumption.'};
 original.ruleSet={version:'historical-rule-set',checked:'2026-09-01',scope:'Earlier AVMC planning rules'};
 original.alternatives=[X.capture(original,'Current design','option',M)];
 const restored=resume(JSON.parse(JSON.stringify(original)));
 assert.equal(restored.sites[0].clusters[0].topology.acds[0].id,original.sites[0].clusters[0].topology.acds[0].id);
 restored.sites[0].clusters[0].cpu=200;
 assert.equal(restored.alternatives[0].sites[0].clusters[0].cpu,80);
 assert.equal(original.sites[0].clusters[0].cpu,80);
 assert.ok(assess(restored).unknowns.some(i=>i.code==='imported-rule-version'));
 const loaded=X.restore(restored,restored.alternatives[0].id,M);
 assert.equal(loaded.sites[0].clusters[0].cpu,80);assert.equal(loaded.project.name,original.project.name);
});

test('exact machine identity is reserved before an earlier legacy name match can claim it',()=>{
 const value=plan(['Original name','Renamed machine']);
 value.sites.forEach(s=>{s.siteName='DC';});delete value.sites[0].uid;value.sites[1].uid='known-machine';
 const saved=structuredClone(value.sites[1]);saved.name='Original name';saved.clusters[0].cpu=120;
 const alternative={id:'previous-layout',name:'Before rename',kind:'option',createdAt:'2026-11-07T00:00:00Z',sites:[saved]};
 const before=JSON.stringify(value),rows=X.compare(value,alternative,M,P);
 assert.equal(rows.length,2);assert.equal(rows[0].relationship,'current only');assert.equal(rows[0].saved,null);
 const matched=rows.find(r=>r.machineId==='known-machine');assert.equal(matched.matchBasis,'id');assert.equal(matched.relationship,'matched');
 assert.equal(matched.resources.find(r=>r.name==='CPU').allocationChange,80);
 const reordered=X.compare({...value,sites:[value.sites[1],value.sites[0]]},alternative,M,P);
 assert.equal(reordered.find(r=>r.machineId==='known-machine').matchBasis,'id');
 assert.equal(reordered.find(r=>r.name==='Original name').relationship,'current only');
 assert.equal(JSON.stringify(value),before);
});

test('CSV missingness survives inventory import, sizing and the report',()=>{
 const value=plan(),s=value.sites[0];s.siteName='DC';s.clusters=[];
 const csv='site,machine,avmc,acd,adb,role,ecpu,ram_gb,storage_tb,cpu_unit\nDC,Production,Apps,ACD One,Known,unprotected,16,64,1,ECPU\nDC,Production,Apps,ACD One,Future,unprotected,,,,ECPU';
 const parsed=X.parseCSV(csv),preview=X.previewCSV(csv,X.defaultMapping(parsed.headers));
 assert.deepEqual(preview.errors,[]);
 const imported=X.applyCSV(value,preview,{mode:'add'},M,T),cluster=imported.sites[0].clusters[0];
 assert.equal(cluster.topology.acds[0].adbs[1].ecpu,null);assert.equal(value.sites[0].clusters.length,0);
 cluster.requirements=T.databaseTotals(cluster).requirements;assert.equal(cluster.requirements.incomplete,true);
 const suggestions=S.suggest(imported.sites[0],M,P);assert.equal(suggestions.incomplete,true);assert.ok(suggestions.minimum);
 imported.sites[0]=suggestions.minimum.candidate;imported.sites[0].hardwareChosen=true;
 const result=assess(imported);assert.ok(result.unknowns.some(i=>i.code==='workload-incomplete'));
 assert.match(A.reportHTML(imported,M,P,T,R,{conventional:C}),/Future/);
 assert.match(A.reportHTML(imported,M,P,T,R,{conventional:C}),/Not entered/);
});

test('restoring an earlier option exposes its rule provenance in the assessment',()=>{
 const value=plan();value.ruleSet={version:'earlier-rule-set',checked:'2026-09-01',scope:'Earlier planning rules'};
 value.alternatives=[X.capture(value,'Earlier proposal','option',M)];
 value.ruleSet={version:R.VERSION,checked:R.CHECKED,scope:R.SCOPE};
 const restored=X.restore(value,value.alternatives[0].id,M);
 assert.equal(restored.ruleSet.version,'earlier-rule-set');
 assert.ok(assess(restored).unknowns.some(i=>i.code==='imported-rule-version'&&i.message.includes('earlier-rule-set')));
 assert.equal(value.ruleSet.version,R.VERSION);
});

test('two standby links preserve separate machine allocations and do not duplicate primary demand',()=>{
 const value=plan(['Production','Recovery A','Recovery B']);
 const groups=value.sites.map((s,i)=>databaseGroup(s,i?'Standby group':'Primary group',i?'standby':'primary'));
 const before=value.sites.map(s=>M.calculate(s).used);
 T.linkPeers(value,groups[0].id,groups[1].id);T.linkPeers(value,groups[0].id,groups[2].id);
 const restored=resume(JSON.parse(JSON.stringify(value))),result=assess(restored);
 assert.equal(T.inspect(restored).counts.linkedPairs,2);assert.equal(result.totals.namedACDs,3);
 assert.deepEqual(result.machines.map(m=>m.result.used),before);
 assert.equal(restored.sites[0].clusters[0].requirements.ecpu,16);
 assert.equal(result.hardErrors.length,0);assert.ok(result.unknowns.some(i=>i.code==='availability-performance'));
});

test('independent switchover conflict remains visible even when every capacity calculation fits',()=>{
 const value=plan(),a=databaseGroup(value.sites[0]);a.adbs[0].independentSwitchover=true;
 a.adbs.push({...T.newADB('ReportingDB'),ecpu:4,ramGB:16,storageTB:0.2});
 assert.deepEqual(M.calculate(value.sites[0]).errors,[]);
 const result=assess(value);assert.equal(result.status,'error');
 assert.ok(result.hardErrors.some(i=>i.code==='independent_switchover_shared_acd'));
 assert.match(A.reportHTML(value,M,P,T,R,{conventional:C}),/ReportingDB/);
});

test('growth is a distinct option that keeps unknown database values and invalidates hardware claims',()=>{
 const value=plan(),a=databaseGroup(value.sites[0]);a.adbs.push({...T.newADB('FutureDB'),ecpu:null,ramGB:null,storageTB:null});
 value.sites[0].clusters[0].requirements=T.databaseTotals(value.sites[0].clusters[0]).requirements;
 const original=JSON.stringify(value),year=X.growth(value,{name:'Year 2',ecpuPercent:25,ramPercent:50},M,T);
 const grown=year.sites[0].clusters[0];assert.equal(JSON.stringify(value),original);assert.deepEqual(grown.requirements,value.sites[0].clusters[0].requirements);
 assert.equal(grown.topology.acds[0].adbs[0].ecpu,20);assert.equal(grown.topology.acds[0].adbs[0].ramGB,96);assert.equal(Q.status(grown).stale,true);
 assert.throws(()=>S.suggest(year.sites[0],M,P),/Review and apply/);
 assert.equal(year.sites[0].clusters[0].topology.acds[0].adbs[1].ecpu,null);
 assert.equal(year.sites[0].hardwareChosen,false);
 const comparison=X.compare(value,year,M,P);assert.equal(comparison[0].saved.selected,false);
 const result=assess({schema:value.schema,sites:year.sites});assert.equal(result.machines[0].result,null);
 grown.requirements=Q.inventoryRequirements(grown);assert.equal(grown.requirements.ecpu,20);assert.equal(grown.requirements.ramGB,96);assert.equal(grown.requirements.incomplete,true);assert.equal(Q.status(grown).stale,false);
});

test('migration overlap consumes both allocations, preserves the original and gives copies new identities',()=>{
 const value=plan(['Production','Recovery']),p=databaseGroup(value.sites[0],'Primary','primary'),s=databaseGroup(value.sites[1],'Standby','standby');
 T.linkPeers(value,p.id,s.id);const before=JSON.stringify(value),current=M.calculate(value.sites[0]);
 const overlap=X.migration(value,{name:'Transition',siteIndex:0,clusterIndexes:[0]},M,T),machine=overlap.sites[0],copy=machine.clusters[1];
 assert.equal(JSON.stringify(value),before);assert.equal(M.calculate(machine).used,current.used*2);
 assert.notEqual(copy.uid,machine.clusters[0].uid);assert.notEqual(copy.topology.acds[0].id,p.id);
 assert.equal(copy.topology.acds[0].role,'unprotected');assert.deepEqual(T.peerIds(copy.topology.acds[0]),[]);
 assert.doesNotThrow(()=>T.validateState({sites:overlap.sites}));
 assert.equal(T.inspect({sites:overlap.sites}).counts.linkedPairs,1);
});

test('conventional footprint stays counted once after JSON resume and snapshot restore',()=>{
 const value=plan(),s=value.sites[0];databaseGroup(s);
 s.conventional={clusters:[{id:'vmc-record',name:'Conventional workload',nodes:[1,2],localPerVM:400,cpuPerVM:80,memoryPerVM:200,cpuUnit:'ecpu',source:'console',notes:'Example observed allocation'}],applied:null};
 value.sites[0]=C.applyToOther(s);value.alternatives=[X.capture(value,'Mixed deployment','option',M)];
 const restored=resume(JSON.parse(JSON.stringify(value))),again=C.applyToOther(restored.sites[0]);
 assert.equal(M.calculate(again).other,800);assert.equal(M.calculate(again).used+M.calculate(again).other,1584);
 assert.equal(assess(restored).machines[0].result.other,800);
 const loaded=X.restore(restored,restored.alternatives[0].id,M);assert.equal(C.inspect(loaded.sites[0]).pending,false);
 assert.equal(M.calculate(loaded.sites[0]).other,800);
});

test('a mixed-service shortage on one server cannot be hidden by aggregate remaining storage',()=>{
 const value=plan(),s=value.sites[0];s.conventional={clusters:[{id:'single-node',name:'Large local footprint',nodes:[1],localPerVM:2200,cpuPerVM:40,memoryPerVM:100,cpuUnit:'ecpu',source:'proposal',notes:''}],applied:null};
 value.sites[0]=C.applyToOther(s);const result=assess(value),m=result.machines[0];
 assert.ok(m.result.free>0);assert.equal(result.status,'error');
 assert.ok(m.hardErrors.some(i=>i.resource==='Local storage'&&i.nodeId===1&&i.deficit>0));
 assert.match(m.nextAction,/DB 1/);
});

test('tampered conventional tracking inside a saved alternative fails the complete import boundary',()=>{
 const value=plan(),s=value.sites[0];
 s.conventional={clusters:[{id:'vmc-record',name:'Conventional workload',nodes:[1,2],localPerVM:400,cpuPerVM:80,memoryPerVM:200,cpuUnit:'ecpu',source:'console',notes:''}],applied:null};
 value.sites[0]=C.applyToOther(s);value.alternatives=[X.capture(value,'Baseline','option',M)];
 const tampered=JSON.parse(JSON.stringify(value));tampered.alternatives[0].sites[0].conventional.applied.byNode[0].otherLocal=1;
 assert.doesNotThrow(()=>resume(value));assert.throws(()=>resume(tampered));
 assert.equal(value.alternatives[0].sites[0].conventional.applied.byNode[0].otherLocal,400);
});

test('memory-led CPU uplift is retained as a conditional proposal and never edits entered database demand',()=>{
 const value=plan(),c=value.sites[0].clusters[0];databaseGroup(value.sites[0]);
 const d=c.topology.acds[0].adbs[0];d.ecpu=200;d.ramGB=1200;c.requirements=T.databaseTotals(c).requirements;
 const option=S.suggest(value.sites[0],M,P).minimum;assert.ok(option);assert.equal(option.requiresDatabaseCPUReview,true);
 assert.equal(option.candidate.clusters[0].topology.acds[0].adbs[0].ecpu,200);
 assert.equal(option.candidate.clusters[0].sizingDetail.plannedWorkloadECPU,240);
 value.sites[0]=option.candidate;const result=assess(value);
 assert.ok(result.warnings.some(i=>i.code==='memory-adjustment'));assert.notEqual(result.status,'fit');
});

test('reports remain self-contained and escaped after metadata and topology pass through JSON import',()=>{
 const value=plan(),a=databaseGroup(value.sites[0]);value.project={name:'<script>bad()</script>',notes:'A & B\n<img src=x onerror=bad()>'};
 a.adbs[0].name='</td><svg onload=bad()>';const restored=resume(JSON.parse(JSON.stringify(value)));
 const html=A.reportHTML(restored,M,P,T,R,{conventional:C,generatedAt:'2026-11-07'});
 assert.doesNotMatch(html,/<script|<img|<svg/);assert.match(html,/&lt;script&gt;/);assert.match(html,/A &amp; B/);
 assert.match(html,/Technical appendix/);assert.match(html,/default-src 'none'/);assert.match(html,new RegExp(R.VERSION.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('device recovery preserves the full project envelope and still passes the same import validation',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},draft=D.create(storage);
 const value=plan();databaseGroup(value.sites[0]);value.alternatives=[X.capture(value,'Baseline','option',M)];
 value.ruleSet={version:R.VERSION,checked:R.CHECKED,scope:R.SCOPE};assert.equal(draft.read().status,'empty');
 draft.write(value,M.VERSION,'2026-11-07T12:00:00Z');const restored=resume(draft.read().draft.scenario);
 assert.equal(restored.alternatives.length,1);assert.equal(T.inspect(restored).counts.namedACDs,1);
 assert.equal(restored.ruleSet.version,R.VERSION);draft.clear();assert.equal(draft.read().status,'empty');
});
