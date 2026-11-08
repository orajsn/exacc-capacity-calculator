'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('./review.js'),M=require('./model.js'),P=require('./planning.js'),T=require('./topology.js'),X=require('./scenarios.js'),Q=require('./requirements.js');
const clone=value=>structuredClone(value);
function machine(name='Production',site='DC',uid='machine-a'){
 const s=M.newSite(name);s.siteName=site;s.uid=uid;s.planningIntent='allocation';s.clusters[0].uid='avmc-'+uid;s.clusters[0].name='Core';s.clusters[0].slots=2;
 s.clusters[0].topology={acds:[group('Payments','App',16,64,1),group('Reporting','Reports',4,8,1)]};return s;
}
function group(name,db,ecpu,ramGB,storageTB){const a=T.newACD(name);a.adbs=[{...T.newADB(db),ecpu,ramGB,storageTB}];return a;}
function workspace(sites=[machine()]){const state={schema:'exacc-capacity/v1',project:{name:'Proposal',notes:'Working assumptions'},ruleSet:{version:'working-rules',checked:'2026-11-08',scope:'Allocation planning'},sites};T.ensureIds(state);return state;}
function saved(state,name){const option=X.capture(state,name,'option',M);state.alternatives=[...(state.alternatives||[]),option];return option;}
const compare=(state,ids=[])=>R.comparePlans(state,ids,M,P,T,X,Q);
const header='site,machine,avmc,acd,adb,role,ecpu,ram_gb,storage_tb,independent_switchover,cpu_unit';
const csvCell=value=>/[",\r\n]/.test(String(value??''))?'"'+String(value??'').replace(/"/g,'""')+'"':String(value??'');
function csvRow(values){return values.map(csvCell).join(',');}
function inventoryRows(s){return s.clusters.flatMap(c=>(c.topology?.acds||[]).flatMap(a=>a.adbs.map(d=>[s.siteName,s.name,c.name,a.name,d.name,a.role,d.ecpu,d.ramGB,d.storageTB,d.independentSwitchover?'yes':'no','ECPU'])));}
function imported(before,rows,mode='replace-active'){const preview=X.previewCSV(header+'\n'+rows.map(csvRow).join('\n'));assert.deepEqual(preview.errors,[]);return X.buildCSVImport(before,preview,{mode,siteIndex:0},M,T).candidate;}
const diff=(before,after,mode='replace-active')=>R.inventoryDiff(before,after,{mode,siteIndex:0},T);

test('three-plan review keeps counts and provenance detached, without mutating any scenario',()=>{
 const state=workspace(),a=saved(state,'Smaller'),b=saved(state,'Later');a.notes='Original sizing assumption';a.ruleSet={version:'historical',checked:'2026-01-01',scope:'Earlier rules'};delete b.ruleSet;b.sites[0].clusters[0].slots=3;
 const before=JSON.stringify(state),result=compare(state,[a.id,b.id]);assert.equal(JSON.stringify(state),before);assert.equal(result.plans.length,3);assert.deepEqual(result.plans[0].counts,{machines:1,avmcs:1,reservedSlots:2,namedACDs:2,adbs:2});assert.equal(result.plans[2].counts.reservedSlots,3);assert.equal(result.plans[0].notes,'Working assumptions');assert.equal(result.plans[1].notes,'Original sizing assumption');assert.equal(result.plans[1].ruleSet.version,'historical');assert.equal(result.plans[2].ruleSet,null);assert.equal(result.machines.length,1);assert.equal(result.machines[0].matchBasis,'id');
 result.plans[1].ruleSet.version='Changed output';result.plans[0].machines[0].resources[0].nodes[0].free=0;assert.equal(JSON.stringify(state),before);
});
test('capacity remains per machine and per node even when other machines have spare capacity',()=>{
 const state=workspace([machine(),machine('Recovery','DR','machine-dr')]);state.sites[0].nodes[0].otherLocal=2000;const result=compare(state),local=result.plans[0].machines[0].resources.find(r=>r.name==='Local storage');assert.ok(local.free>0);assert.equal(local.status,'Over capacity');assert.equal(local.shortages.length,1);assert.equal(local.shortages[0].nodeId,1);assert.ok(local.shortages[0].shortfall>0);assert.equal(result.plans[0].status,'error');assert.equal(result.plans[0].machines[1].status,'fit');assert.equal(Object.hasOwn(result.plans[0],'resources'),false);
});
test('disabled compute, incomplete shared storage and unselected hardware remain explicitly unknown',()=>{
 const state=workspace(),s=state.sites[0];s.checkCompute=false;s.planning={storageCapacity:100};let result=compare(state),resources=result.plans[0].machines[0].resources;
 for(const name of ['CPU','Memory estimate','Exadata storage (manual)']){const r=resources.find(r=>r.name===name);assert.equal(r.checked,false);for(const key of ['capacity','allocated','free','buffer','after','percent'])assert.equal(r[key],null);assert.deepEqual(r.nodes,[]);}assert.equal(resources[0].checked,true);
 assert.deepEqual(result.plans[0].machines[0].hardware,{profile:'x11m-standard',label:'X11M Standard',dbServers:2});
 s.planningIntent='workload';s.hardwareChosen=false;result=compare(state);assert.equal(result.plans[0].status,'unknown');assert.equal(result.machines[0].cells[0].selected,false);assert.equal(result.plans[0].machines[0].hardware,null);assert.ok(result.plans[0].machines[0].resources.every(r=>!r.checked&&r.free===null));
});
test('stale inventory is visible as review metadata while the saved allocation stays readable',()=>{
 const state=workspace(),c=state.sites[0].clusters[0];c.requirements=Q.inventoryRequirements(c);const before=compare(state).plans[0].machines[0].resources;c.topology.acds[0].adbs[0].ecpu=32;const result=compare(state).plans[0].machines[0];assert.equal(result.review.staleRequirements,1);assert.deepEqual(result.resources,before);
});
test('exact machine IDs reserve their columns before unique-name fallback can steal them',()=>{
 const state=workspace([machine('First','DC','a'),machine('Second','DC','b')]),a=saved(state,'Prior');a.sites[0].uid='b';a.sites[0].name='First';a.sites[1].uid='legacy';a.sites[1].name='Second';
 const result=compare(state,[a.id]),first=result.machines.find(row=>row.cells[0]?.machineId==='a'),second=result.machines.find(row=>row.cells[0]?.machineId==='b');assert.equal(first.cells[1],null);assert.equal(second.cells[1].machineId,'b');assert.equal(second.cells[1].matchBasis,'id');assert.ok(result.machines.some(row=>!row.cells[0]&&row.cells[1]?.machineId==='legacy'));
});
test('unique legacy names are qualified, ambiguous names and blank names are not inferred',()=>{
 const state=workspace(),a=saved(state,'Legacy');a.sites[0].uid='regenerated';let result=compare(state,[a.id]);assert.equal(result.machines.length,1);assert.equal(result.machines[0].matchBasis,'name');assert.match(result.machines[0].relationship,/verify identity/);assert.ok(result.warnings.some(w=>/legacy assumptions/.test(w)));
 state.sites.push(machine('Production','DC','another'));result=compare(state,[a.id]);assert.equal(result.machines.length,3);assert.ok(result.warnings.some(w=>/Duplicate/.test(w)));
 const blank=workspace();blank.sites[0].name='';const option=saved(blank,'Blank');option.sites[0].uid='different';assert.equal(compare(blank,[option.id]).machines.length,2);
});
test('snapshot-only machines join only by exact IDs and never merely by matching names or array positions',()=>{
 const state=workspace(),a=saved(state,'A'),b=saved(state,'B');a.sites=[machine('Snapshot machine','DR','snapshot-one')];b.sites=[machine('Snapshot machine','DR','snapshot-two')];let result=compare(state,[a.id,b.id]);assert.equal(result.machines.length,3);assert.equal(result.machines.filter(row=>!row.cells[0]).length,2);assert.ok(result.warnings.some(w=>/Snapshot-only/.test(w)));
 b.sites[0].uid='snapshot-one';result=compare(state,[a.id,b.id]);assert.equal(result.machines.length,2);const row=result.machines.find(row=>!row.cells[0]);assert.equal(row.cells[1].machineId,'snapshot-one');assert.equal(row.cells[2].machineId,'snapshot-one');assert.equal(row.matchBasis,'id');
});
test('cross-option stable identity with conflicting working-name candidates is left unmatched',()=>{
 const state=workspace([machine('One','DC','a'),machine('Two','DC','b')]),a=saved(state,'A'),b=saved(state,'B');a.sites=[machine('One','DC','c')];b.sites=[machine('Two','DC','c')];const result=compare(state,[a.id,b.id]);assert.equal(result.machines.length,3);assert.ok(result.machines.some(row=>!row.cells[0]&&row.cells[1]?.machineId==='c'&&row.cells[2]?.machineId==='c'));assert.ok(result.warnings.some(w=>/different working-machine/.test(w)));
});
test('review rejects unsupported option selections and reports invalid inputs without a fake fit',()=>{
 const state=workspace(),a=saved(state,'Saved');assert.throws(()=>compare(state,[a.id,a.id]),/two different/);assert.throws(()=>compare(state,['missing']),/existing/);assert.throws(()=>compare(state,['a','b','c']),/two different/);state.sites[0].clusters[0].cpu=NaN;const result=compare(state);assert.equal(result.plans[0].status,'error');assert.equal(result.plans[0].machines[0].resources[0].checked,false);assert.ok(result.plans[0].machines[0].errors.length);
});
test('invalid current slot inputs make machine and whole-plan reserved counts unknown',()=>{
 for(const slots of [NaN,0,1.5,17,Infinity,undefined,'2']){
  const state=workspace([machine(),machine('Recovery','DR','machine-dr')]),option=saved(state,'Valid saved design');state.sites[0].clusters[0].slots=slots;const result=compare(state,[option.id]);
  assert.equal(result.plans[0].counts.reservedSlots,null);assert.equal(result.plans[0].machines[0].counts.reservedSlots,null);assert.equal(result.machines[0].cells[0].counts.reservedSlots,null);assert.equal(result.plans[0].machines[1].counts.reservedSlots,2);assert.equal(result.plans[1].counts.reservedSlots,4);assert.equal(result.plans[0].status,'error');
 }
 const empty=workspace();empty.sites[0].clusters=[];assert.equal(compare(empty).plans[0].counts.reservedSlots,0,'a valid empty plan has a known zero reserved slots');
});

test('same-content CSV replacement is unchanged despite fresh nested IDs and case/space differences',()=>{
 const before=workspace(),source=JSON.stringify(before),rows=inventoryRows(before.sites[0]).map(row=>row.map((v,i)=>i<5?' '+String(v).toUpperCase()+' ':v)),after=imported(before,rows),result=diff(before,after);assert.notEqual(after.sites[0].clusters[0].topology.acds[0].id,before.sites[0].clusters[0].topology.acds[0].id);assert.deepEqual([result.summary.added,result.summary.removed,result.summary.changed,result.summary.unchanged],[0,0,0,2]);assert.deepEqual(result.groups,[]);assert.deepEqual(result.slotChanges,[]);assert.equal(JSON.stringify(before),source);assert.equal(result.scope,'whole-plan');
});
test('CSV numeric changes distinguish unknown from zero and count missing inputs over the whole plan',()=>{
 const before=workspace(),d=before.sites[0].clusters[0].topology.acds[0].adbs[0];d.ecpu=null;d.ramGB=null;d.storageTB=null;const rows=inventoryRows(before.sites[0]);rows[0][6]=0;rows[0][8]=0;const after=imported(before,rows),result=diff(before,after),changed=result.rows.find(r=>r.kind==='changed');assert.deepEqual(changed.changes.map(c=>c.field),['ecpu','storageTB']);assert.deepEqual(changed.missingBefore,['ecpu','ramGB','storageTB']);assert.deepEqual(changed.missingAfter,['ramGB']);assert.deepEqual(result.summary.missingBefore,{rows:1,ecpu:1,ramGB:1,storageTB:1});assert.deepEqual(result.summary.missingAfter,{rows:1,ecpu:0,ramGB:1,storageTB:0});assert.ok(result.warnings.some(w=>/full before\/candidate/.test(w)));
});
test('actual replacement records role, independent-switchover and peer-confirmation loss',()=>{
 const before=workspace(),d=before.sites[0].clusters[0].topology.acds[0].adbs[0];d.peerSettingsConfirmed=true;const rows=inventoryRows(before.sites[0]);rows[0][5]='primary';rows[0][9]='yes';const result=diff(before,imported(before,rows)),row=result.rows.find(r=>r.path.adb==='App');assert.deepEqual(row.changes.map(c=>c.field),['role','independentSwitchover','peerSettingsConfirmed']);assert.equal(row.after.peerSettingsConfirmed,false);assert.ok(result.groups.some(g=>g.changes.some(c=>c.field==='role')));
});
test('inventory addition shows new rows, new groups and actual reserved-slot increases',()=>{
 const before=workspace(),rows=[['DC','Production','Core','New group','New DB','unprotected',8,32,1,'no','ECPU']],after=imported(before,rows,'add'),result=diff(before,after,'add');assert.equal(result.summary.added,1);assert.equal(result.summary.unchanged,2);assert.equal(result.summary.changed,0);assert.deepEqual(result.slotChanges.map(r=>[r.kind,r.before,r.after]),[['changed',2,3]]);assert.ok(result.groups.some(g=>g.kind==='added'&&g.path.acd==='New group'));assert.equal(before.sites[0].clusters[0].slots,2);
});
test('empty removed ACD groups remain visible even though they have no database diff row',()=>{
 const before=workspace(),c=before.sites[0].clusters[0];c.slots=3;c.topology.acds.push(T.newACD('Empty group'));const result=diff(before,imported(before,[inventoryRows(before.sites[0])[0]]));assert.equal(result.summary.removed,1);const empty=result.groups.find(g=>g.path.acd==='Empty group');assert.equal(empty.kind,'removed');assert.equal(empty.before.adbs,0);assert.equal(empty.after,null);assert.deepEqual(result.slotChanges,[],'CSV replacement retains allocated slots');
});
test('renames and moves are removed/added paths rather than inferred database identities',()=>{
 const before=workspace(),rows=inventoryRows(before.sites[0]);rows[0][3]='Different group';rows[0][4]='Renamed DB';const result=diff(before,imported(before,rows));assert.deepEqual([result.summary.added,result.summary.removed,result.summary.changed,result.summary.unchanged],[1,1,0,1]);assert.ok(result.rows.some(r=>r.kind==='removed'&&r.path.adb==='App'));assert.ok(result.rows.some(r=>r.kind==='added'&&r.path.adb==='Renamed DB'));assert.ok(result.warnings.some(w=>/identity is not inferred/.test(w)));
});
test('replacement exposes cleared peer links on the other machine too',()=>{
 const before=workspace(),primary=before.sites[0].clusters[0].topology.acds[0],dr=machine('Recovery','DR','machine-dr');primary.role='primary';dr.clusters[0].topology.acds=[group('Payments DR','App',16,64,1)];dr.clusters[0].topology.acds[0].role='standby';before.sites.push(dr);T.ensureIds(before);T.linkPeers(before,primary.id,dr.clusters[0].topology.acds[0].id);
 const after=imported(before,inventoryRows(before.sites[0])),result=diff(before,after),other=result.rows.find(r=>r.path.site==='DR');assert.equal(other.kind,'changed');assert.ok(other.changes.some(c=>c.field==='peerLinks'&&c.before.length===1&&c.after.length===0));assert.ok(result.groups.some(g=>g.path.site==='DR'&&g.changes.some(c=>c.field==='peerLinks')));assert.equal(result.summary.totalBefore,3);assert.equal(result.summary.totalAfter,3);
 const equivalent=clone(before),map=new Map();for(const s of equivalent.sites)for(const c of s.clusters)for(const a of c.topology.acds){map.set(a.id,'new-'+a.id);a.id='new-'+a.id;for(const d of a.adbs)d.id='new-'+d.id;}for(const s of equivalent.sites)for(const c of s.clusters)for(const a of c.topology.acds){if(a.peerId)a.peerId=map.get(a.peerId);if(a.peerIds)a.peerIds=a.peerIds.map(id=>map.get(id));}const unchanged=diff(before,equivalent);assert.equal(unchanged.summary.changed,0);assert.equal(unchanged.summary.unchanged,3);
});
test('duplicate database or parent paths are explicitly ambiguous rather than matched by IDs',()=>{
 const before=workspace(),c=before.sites[0].clusters[0],duplicate={...clone(c.topology.acds[0].adbs[0]),id:T.id('adb'),name:' app '};c.topology.acds[0].adbs.push(duplicate);let result=diff(before,clone(before));assert.equal(result.summary.ambiguous,2);assert.equal(result.rows.find(r=>r.kind==='ambiguous').before,null);assert.ok(result.ambiguous.some(a=>a.type==='database'&&a.beforeCount===2));
 const parent=workspace(),cluster=parent.sites[0].clusters[0];cluster.slots=3;cluster.topology.acds.push(group(' payments ','Second database',2,4,1));const added=imported(parent,[['DC','Production','Core','Reporting','Extra','unprotected',1,2,1,'no','ECPU']],'add');result=diff(parent,added,'add');assert.equal(result.summary.ambiguous,2);assert.equal(result.summary.added,1);assert.ok(result.ambiguous.some(a=>a.type==='group'&&a.beforeCount===2));
});
test('links to duplicate peer name paths are not treated as equivalent identities',()=>{
 const before=workspace(),c=before.sites[0].clusters[0];c.slots=3;const primary=c.topology.acds[0],peer=c.topology.acds[1],other=group(' reporting ','Other DB',4,8,1);primary.role='primary';peer.role='standby';other.role='standby';c.topology.acds.push(other);primary.peerIds=[peer.id];const after=clone(before);after.sites[0].clusters[0].topology.acds[0].peerIds=[other.id];const result=diff(before,after),row=result.rows.find(r=>r.path.adb==='App');assert.equal(row.kind,'changed');assert.ok(row.changes.some(change=>change.field==='peerLinks'));assert.match(row.after.peerLinks[0],/Ambiguous peer path/);assert.ok(result.ambiguous.some(item=>item.type==='group'));
});
test('both review operations accept deeply frozen input without modifying it',()=>{
 const before=workspace(),option=saved(before,'Frozen option'),after=imported(before,inventoryRows(before.sites[0]));function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}freeze(before);freeze(after);assert.doesNotThrow(()=>compare(before,[option.id]));assert.doesNotThrow(()=>diff(before,after));
});
test('diff is detached, preserves raw display text, and scales across all rows without UI truncation',()=>{
 const before=workspace(),c=before.sites[0].clusters[0];c.slots=5;c.topology.acds=Array.from({length:5},(_,i)=>{const a=T.newACD('Group '+i);a.adbs=Array.from({length:1000},(_,j)=>({...T.newADB('DB '+j),ecpu:1,ramGB:2,storageTB:null}));return a;});const after=clone(before);after.sites[0].clusters[0].topology.acds[4].adbs[999].ramGB=3;let reads=0;
 for(const state of [before,after])for(const a of state.sites[0].clusters[0].topology.acds)for(const d of a.adbs){const name=d.name;Object.defineProperty(d,'name',{get(){reads++;return name;},enumerable:true});}
 const result=diff(before,after);assert.equal(result.rows.length,5000);assert.equal(result.summary.changed,1);assert.equal(result.summary.unchanged,4999);assert.equal(result.summary.missingAfter.storageTB,5000);assert.ok(reads<50000,'name lookup stays bounded per input record');result.rows[0].after.ecpu=999;assert.equal(before.sites[0].clusters[0].topology.acds[0].adbs[0].ecpu,1);
 const text=workspace();text.sites[0].clusters[0].topology.acds[0].adbs[0].name='<script>literal</script>';assert.equal(diff(text,clone(text)).rows[0].path.adb,'<script>literal</script>');
});
