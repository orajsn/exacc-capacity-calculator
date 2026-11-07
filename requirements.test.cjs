const test=require('node:test'),assert=require('node:assert/strict'),M=require('./model.js'),T=require('./topology.js'),Q=require('./requirements.js');
function sample(){
 const machine=M.newSite(),c=machine.clusters[0];c.slots=2;c.requirements={ecpu:300,ramGB:1000,unsizedACDs:1,minRatio:4,incomplete:true};
 const a=T.newACD('Payments');a.adbs=[{...T.newADB('Core'),ecpu:100,ramGB:400,storageTB:1}];c.topology={acds:[a]};
 const state={schema:'exacc-capacity/v1',sites:[machine]};T.ensureIds(state);return {state,machine,c,a,d:a.adbs[0]};
}
test('older scenarios infer inventory provenance from its applied signature and default to manual otherwise',()=>{
 const {c,d}=sample();assert.equal(Q.source(c),'manual');c.requirements=T.databaseTotals(c).requirements;delete c.requirements.source;
 assert.equal(Q.source(c),'database-inventory');assert.equal(Q.status(c).stale,false);
 d.ecpu=120;assert.equal(Q.status(c).stale,true);
 c.requirements.source='manual';assert.equal(Q.status(c).stale,false);assert.equal(Q.source(c),'manual');
});
test('inventory totals require review, preserve manual needs and keep explicit assumptions',()=>{
 const {c}=sample(),before=structuredClone(c),review=Q.status(c),next=Q.inventoryRequirements(c);
 assert.deepEqual(c,before);assert.deepEqual(review.delta,{ecpu:-200,ramGB:-600,unsizedACDs:0});
 assert.equal(next.source,'database-inventory');assert.equal(next.minRatio,4);assert.equal(next.userIncomplete,true);assert.equal(next.incomplete,true);
 c.requirements=next;assert.equal(Q.status(c).stale,false);c.requirements.minRatio=4.5;
 const manual=Q.useManual(c);assert.equal(manual.ecpu,300);assert.equal(manual.ramGB,1000);assert.equal(manual.minRatio,4.5);assert.equal(manual.incomplete,true);assert.equal(manual.source,'manual');assert.equal(manual.topologySignature,undefined);
});
test('only CPU/RAM quantities and ACD grouping stale applied inventory sizing',()=>{
 const {c,a,d}=sample();c.requirements=Q.inventoryRequirements(c);
 c.name='Renamed AVMC';a.name='New ACD name';d.name='New DB name';d.storageTB=20;a.role='primary';a.peerIds=['standby'];d.peerSettingsConfirmed=true;d.independentSwitchover=true;
 assert.equal(Q.status(c).stale,false);
 const copied=T.cloneMachine({clusters:[c]});assert.equal(Q.status(copied.clusters[0]).stale,false);
 d.ecpu=120;assert.equal(Q.status(c).stale,true);d.ecpu=100;assert.equal(Q.status(c).stale,false);
 const b=T.newACD('New group');b.adbs=[{...T.newADB('Reporting'),ecpu:40,ramGB:80}];c.topology.acds.push(b);c.requirements=Q.inventoryRequirements(c);
 c.topology.acds.reverse();assert.equal(Q.status(c).stale,false);
 a.adbs.push(b.adbs.pop());assert.equal(Q.status(c).inventory.known.ecpu,c.requirements.ecpu);assert.equal(Q.status(c).stale,true);
});
test('legacy inventory signature ignores metadata and storage edits but still tracks quantities',()=>{
 const {c,d}=sample();c.requirements=T.databaseTotals(c).requirements;d.storageTB=null;d.name='Renamed';
 assert.equal(Q.status(c).stale,false);d.ramGB=500;assert.equal(Q.status(c).stale,true);
});
test('missing CPU/RAM is flagged separately from explicit zero and clears after completing inventory',()=>{
 const {c,d}=sample();c.requirements.incomplete=false;d.ecpu=null;d.ramGB=null;
 c.requirements=Q.inventoryRequirements(c);assert.equal(c.requirements.incomplete,true);assert.equal(c.requirements.userIncomplete,false);assert.deepEqual(Q.status(c).missing,{ecpu:1,ramGB:1,storageTB:0});
 d.ecpu=0;d.ramGB=0;assert.equal(Q.status(c).stale,true);c.requirements=Q.inventoryRequirements(c);
 assert.equal(c.requirements.ecpu,0);assert.equal(c.requirements.incomplete,false);assert.equal(c.requirements.unsizedACDs,2);
});
test('inventory without named groups or with too many named ACDs cannot be applied',()=>{
 const {c}=sample();c.topology.acds=[];assert.equal(Q.status(c).canApply,false);assert.throws(()=>Q.inventoryRequirements(c),/named ACDs/);
 c.topology.acds=[T.newACD(),T.newACD(),T.newACD()];assert.equal(Q.status(c).canApply,false);
});
test('preview cannot be applied to another machine, cluster or any changed state',()=>{
 const {state,c}=sample(),before=structuredClone(state),preview=Q.createPreview(state,0,0);assert.deepEqual(state,before);assert.equal(Q.previewIsCurrent(preview,state,0),true);
 state.sites.push(T.cloneMachine(state.sites[0]));assert.equal(Q.previewIsCurrent(preview,state,0),false);assert.equal(Q.previewIsCurrent(preview,state,1),false);state.sites.pop();
 c.uid+='changed';assert.equal(Q.previewIsCurrent(preview,state,0),false);c.uid=before.sites[0].clusters[0].uid;
 c.topology.acds[0].adbs[0].ecpu=200;assert.equal(Q.previewIsCurrent(preview,state,0),false);
});
test('saved manual source survives portable JSON and malformed source metadata is rejected',()=>{
 const {c}=sample();c.requirements=Q.inventoryRequirements(c);const copy=JSON.parse(JSON.stringify(c));Q.validateMetadata(copy);assert.equal(Q.useManual(copy).ecpu,300);
 copy.requirements.source='guessed';assert.throws(()=>Q.validateMetadata(copy),/sizing source/);copy.requirements.source='database-inventory';copy.requirements.manualTotals.ecpu=-1;assert.throws(()=>Q.validateMetadata(copy),/saved manual ecpu/);
});
test('a claimed current signature cannot hide requirements that differ from the applied inventory totals',()=>{
 const {c}=sample();c.requirements=Q.inventoryRequirements(c);c.requirements.ecpu=500;
 assert.equal(Q.status(c).stale,true);
});
