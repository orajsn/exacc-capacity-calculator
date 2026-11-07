const test=require('node:test'),assert=require('node:assert/strict');
const T=require('./topology.js'),M=require('./model.js'),S=require('./sizing.js'),Q=require('./requirements.js');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const fresh=()=>({schema:'exacc-capacity/v1',sites:[M.newSite('Production'),M.newSite('Recovery'),M.newSite('Recovery 2')]});
function fixture(){
 const state=fresh();state.sites.forEach((s,i)=>{s.siteName=`Site ${i+1}`;s.clusters[0].slots=3;s.clusters[0].topology={acds:[T.newACD(i?'Standby':'Primary')]};const a=s.clusters[0].topology.acds[0];a.role=i?'standby':'primary';a.adbs=[{...T.newADB('Payments'),ecpu:100,ramGB:400,storageTB:2}];});
 T.ensureIds(state);return state;
}
const codes=(state,key='errors')=>T.inspect(state)[key].map(x=>x.code);

test('legacy machine files can omit all topology and gain stable IDs without invented ACDs',()=>{
 const state=fresh();assert.doesNotThrow(()=>T.validateState(state));T.ensureIds(state);const saved=JSON.stringify(state);T.ensureIds(state);
 assert.equal(JSON.stringify(state),saved);assert.equal(T.inspect(state).counts.namedACDs,0);assert.equal(state.sites[0].clusters[0].topology,undefined);
 assert.ok(codes(state,'warnings').includes('acd_inventory_missing'));
});
test('topology survives a scenario import round trip with unknown values preserved',()=>{
 const state=fixture();state.sites[0].clusters[0].topology.acds[0].adbs[0].ecpu=null;
 const imported=M.importScenario(JSON.parse(JSON.stringify(state)));T.validateState(imported);
 assert.equal(imported.sites[0].clusters[0].topology.acds[0].adbs[0].ecpu,null);
 assert.equal(imported.sites[0].uid,state.sites[0].uid);
});
test('structural validation rejects duplicate IDs, invalid roles and nonfinite metrics',()=>{
 let state=fixture();state.sites[1].uid=state.sites[0].uid;assert.throws(()=>T.validateState(state),/Duplicate topology ID/);
 state=fixture();state.sites[0].clusters[0].topology.acds[0].role='reader';assert.throws(()=>T.validateState(state),/role/);
 state=fixture();state.sites[0].clusters[0].topology.acds[0].adbs[0].ramGB=Infinity;assert.throws(()=>T.validateState(state),/non-negative/);
});
test('duplicate sibling names and named ACD counts above reserved slots are visible errors',()=>{
 const state=fixture(),c=state.sites[0].clusters[0],a=c.topology.acds[0];c.slots=1;
 c.topology.acds.push(T.newACD(' primary '));a.adbs.push({...T.newADB(' PAYMENTS '),ecpu:2,ramGB:4,storageTB:1});
 const found=codes(state);assert.ok(found.includes('duplicate_acd_name'));assert.ok(found.includes('duplicate_adb_name'));assert.ok(found.includes('named_acds_exceed_slots'));
});
test('database totals preserve missingness, apply ACD floors downstream and do not include DR copies',()=>{
 const state=fixture(),c=state.sites[0].clusters[0];c.topology.acds[0].adbs.push({...T.newADB('Future'),ecpu:null,ramGB:null,storageTB:null});
 T.linkPeers(state,c.topology.acds[0].id,state.sites[1].clusters[0].topology.acds[0].id);
 const totals=T.databaseTotals(c);assert.equal(totals.known.ecpu,100);assert.equal(totals.known.ramGB,400);assert.equal(totals.known.storageTB,2);assert.equal(totals.requirements.incomplete,true);
 assert.deepEqual(totals.requirements.acdEcpus,[100,0,0]);assert.equal(totals.requirements.unsizedACDs,2);assert.equal(totals.missing.ecpu,1);assert.equal(totals.storageComplete,false);
 c.requirements=totals.requirements;assert.doesNotThrow(()=>S.validate(state.sites[0],true));
 assert.equal(T.inspect(state).counts.primaryADBs,2);assert.equal(T.inspect(state).counts.standbyADBs,2);
});
test('explicit zero remains zero and is not a missing workload input',()=>{
 const state=fixture(),c=state.sites[0].clusters[0],d=c.topology.acds[0].adbs[0];d.ecpu=0;d.ramGB=0;d.storageTB=0;
 const totals=T.databaseTotals(c);assert.equal(totals.requirements.incomplete,false);assert.equal(totals.missing.ecpu,0);assert.equal(totals.known.ecpu,0);assert.equal(totals.requirements.unsizedACDs,3);
});
test('using individual inputs records a signature and detects later changes',()=>{
 const state=fixture(),c=state.sites[0].clusters[0];c.requirements=T.databaseTotals(c).requirements;
 assert.equal(codes(state,'warnings').includes('database_totals_stale'),false);
 c.topology.acds[0].adbs[0].ecpu=120;assert.ok(codes(state,'warnings').includes('database_totals_stale'));
});
test('a primary can link to two reciprocal standbys and cannot silently add a third',()=>{
 const state=fixture(),all=T.entries(state),p=all[0].acd,s1=all[1].acd,s2=all[2].acd;
 T.linkPeers(state,p.id,s1.id);T.linkPeers(state,p.id,s2.id);assert.deepEqual(p.peerIds,[s1.id,s2.id]);assert.equal(s1.peerId,p.id);assert.equal(T.inspect(state).counts.linkedPairs,2);assert.deepEqual(codes(state),[]);
 const third=T.newACD('Third');third.role='standby';state.sites[2].clusters[0].topology.acds.push(third);
 assert.throws(()=>T.linkPeers(state,p.id,third.id),/at most two/);assert.equal(third.peerId,'');
});
test('legacy singular primary peerId remains valid when reciprocal',()=>{
 const state=fixture(),all=T.entries(state);all[0].acd.peerId=all[1].acd.id;all[1].acd.peerId=all[0].acd.id;
 assert.equal(codes(state).includes('peer_not_reciprocal'),false);assert.equal(T.inspect(state).counts.linkedPairs,1);
});
test('missing, nonreciprocal, self and role-conflicting peer links are distinct findings',()=>{
 let state=fixture(),p=T.entries(state)[0].acd;p.peerIds=['missing-acd'];assert.ok(codes(state).includes('peer_missing'));
 state=fixture();let all=T.entries(state);all[0].acd.peerIds=[all[1].acd.id];assert.ok(codes(state).includes('peer_not_reciprocal'));
 state=fixture();p=T.entries(state)[0].acd;p.peerIds=[p.id];assert.ok(codes(state).includes('self_peer'));
 state=fixture();all=T.entries(state);all[0].acd.peerIds=[all[1].acd.id];all[1].acd.role='primary';assert.ok(codes(state).includes('peer_role_conflict'));
});
test('same-machine peers warn about the fault domain rather than inventing an unsupported service rule',()=>{
 const state=fixture(),c=state.sites[0].clusters[0],p=c.topology.acds[0],s=T.newACD('Local standby');s.role='standby';s.adbs=[{...T.newADB('Payments'),ecpu:100,ramGB:400,storageTB:2}];c.topology.acds.push(s);T.linkPeers(state,p.id,s.id);
 assert.ok(codes(state,'warnings').includes('peer_same_machine'));assert.equal(codes(state).includes('peer_same_machine'),false);
});
test('peer ADB CPU/storage mismatches are errors but missing peer values are unknown',()=>{
 const state=fixture(),all=T.entries(state),p=all[0].acd,s=all[1].acd;T.linkPeers(state,p.id,s.id);p.adbs[0].peerSettingsConfirmed=true;s.adbs[0].peerSettingsConfirmed=true;s.adbs[0].ecpu=80;s.adbs[0].storageTB=3;
 assert.ok(codes(state).includes('peer_ecpu_mismatch'));assert.ok(codes(state).includes('peer_storageTB_mismatch'));
 s.adbs[0].ecpu=null;s.adbs[0].storageTB=null;assert.equal(codes(state).includes('peer_ecpu_mismatch'),false);assert.ok(codes(state,'warnings').includes('peer_ecpu_unknown'));assert.ok(codes(state,'warnings').includes('peer_storageTB_unknown'));
});
test('different workload demand is a review item until both peer settings are explicitly confirmed',()=>{
 const state=fixture(),[p,s]=T.entries(state).map(e=>e.acd);T.linkPeers(state,p.id,s.id);s.adbs[0].ecpu=50;
 assert.equal(codes(state).includes('peer_ecpu_mismatch'),false);assert.ok(codes(state,'warnings').includes('peer_ecpu_review'));assert.ok(codes(state,'warnings').includes('dr_readiness_unchecked'));
 p.adbs[0].peerSettingsConfirmed=true;assert.equal(codes(state).includes('peer_ecpu_mismatch'),false);
});
test('empty named groups retain resource floors while explicitly flagging absent workload sizing',()=>{
 const state=fixture(),c=state.sites[0].clusters[0];c.topology.acds[0].adbs=[];
 assert.equal(T.databaseTotals(c).requirements.incomplete,true);assert.equal(T.databaseTotals(c).requirements.unsizedACDs,3);assert.ok(codes(state,'warnings').includes('acd_has_no_databases'));
});
test('independent switchover requests flag shared ACDs and missing protection separately',()=>{
 const state=fixture(),a=T.entries(state)[0].acd;a.role='unprotected';a.adbs[0].independentSwitchover=true;a.adbs.push(T.newADB('Reporting'));
 assert.ok(codes(state).includes('independent_switchover_shared_acd'));assert.ok(codes(state,'warnings').includes('independent_switchover_unprotected'));
});
test('clone gives all records fresh identities and never inherits a working DR relationship',()=>{
 const state=fixture(),p=T.entries(state)[0].acd,s=T.entries(state)[1].acd;T.linkPeers(state,p.id,s.id);state.sites[0].clusters[0].requirements=T.databaseTotals(state.sites[0].clusters[0]).requirements;
 const copy=T.cloneMachine(state.sites[0]);assert.notEqual(copy.uid,state.sites[0].uid);assert.notEqual(copy.clusters[0].uid,state.sites[0].clusters[0].uid);const a=copy.clusters[0].topology.acds[0];
 assert.notEqual(a.id,p.id);assert.notEqual(a.adbs[0].id,p.adbs[0].id);assert.equal(a.role,'unprotected');assert.equal(a.peerId,'');assert.equal(a.peerIds,undefined);assert.equal(copy.clusters[0].requirements.topologySignature,T.topologySignature(copy.clusters[0]));
 state.sites.push(copy);assert.doesNotThrow(()=>T.validateState(state));
});
test('unlinking a peer and changing its role remove both sides without changing other links',()=>{
 const state=fixture(),[p,s1,s2]=T.entries(state).map(e=>e.acd);T.linkPeers(state,p.id,s1.id);T.linkPeers(state,p.id,s2.id);T.setRole(state,s1.id,'unprotected');
 assert.deepEqual(p.peerIds,[s2.id]);assert.equal(s1.peerId,'');assert.equal(s2.peerId,p.id);
 T.unlinkPeer(state,p.id);assert.deepEqual(p.peerIds,[]);assert.equal(s2.peerId,'');
});

function ui(state){
 class Element{constructor(){this.innerHTML='';this.events={};}addEventListener(type,fn){this.events[type]=fn;}}
 const elements=new Map(['topology-editor','topology-review','topology-live-findings'].map(k=>[k,new Element()]));
 const ctx={ExaTopology:T,Q,state,active:0,$:id=>elements.get(id),site:()=>state.sites[0],planningIntent:s=>s.planningIntent||'workload',renderRequirementSources:()=>{},previewInventorySizing:index=>{ctx.preview=Q.createPreview(state,0,index);},fmt:n=>String(n),escapeHTML:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),message:text=>{ctx.lastMessage=text;},needsNewSizing:()=>{state.sites[0].hardwareChosen=false;},safeUpdate:(fn,full)=>{fn();if(full)ctx.renderTopologyEditor();}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'topology-ui.js'),'utf8'),ctx);ctx.initTopology();ctx.renderTopologyEditor();
 return {ctx,editor:elements.get('topology-editor'),review:elements.get('topology-review')};
}
test('topology editor keeps typed input stable and blank metrics remain unknown',()=>{
 const state=fixture(),c=state.sites[0].clusters[0];c.requirements=Q.inventoryRequirements(c);const a=T.entries(state)[0].acd,d=a.adbs[0],page=ui(state),html=page.editor.innerHTML;
 page.editor.events.input({target:{dataset:{acdId:a.id,adbId:d.id,topologyField:'ecpu'},value:''}});
 assert.equal(d.ecpu,null);assert.equal(page.editor.innerHTML,html);assert.equal(state.sites[0].hardwareChosen,false);assert.match(page.review.innerHTML,/CPU or RAM needs are missing/);
});
test('topology renders names inert and uses one surrounding disclosure supplied by the page',()=>{
 const state=fixture(),a=T.entries(state)[0].acd;a.name='<img src=x onerror=alert(1)>';a.adbs[0].name='<script>boom</script>';
 const page=ui(state);assert.match(page.editor.innerHTML,/&lt;img/);assert.doesNotMatch(page.editor.innerHTML,/<img src/);assert.match(page.review.innerHTML,/&lt;script&gt;/);assert.doesNotMatch(page.editor.innerHTML,/data-inventory-details="main"/);
});
test('database totals action previews the change without overwriting manual requirements',()=>{
 const state=fixture(),c=state.sites[0].clusters[0],original={ecpu:12,ramGB:24,unsizedACDs:0,minRatio:2};c.requirements={...original};const page=ui(state),a=c.topology.acds[0],d=a.adbs[0];
 page.editor.events.input({target:{dataset:{acdId:a.id,adbId:d.id,topologyField:'ecpu'},value:'120'}});assert.deepEqual(c.requirements,original);
 page.editor.events.click({target:{closest:()=>({dataset:{topologyAction:'use-totals',clusterIndex:'0'}})}});
 assert.deepEqual(c.requirements,original);assert.equal(page.ctx.preview.requirements.ecpu,120);assert.equal(page.ctx.preview.requirements.source,'database-inventory');assert.equal(Q.previewIsCurrent(page.ctx.preview,state,0),true);
});

test('inventory name and metadata edits preserve current sizing but CPU changes invalidate it',()=>{
 const state=fixture(),s=state.sites[0],c=s.clusters[0],a=c.topology.acds[0],d=a.adbs[0];s.hardwareChosen=true;c.requirements=Q.inventoryRequirements(c);const page=ui(state);
 for(const [field,value]of [['name','Renamed database'],['storageTB','3']])page.editor.events.input({target:{dataset:{acdId:a.id,adbId:d.id,topologyField:field},value}});
 page.editor.events.input({target:{dataset:{acdId:a.id,topologyField:'name'},value:'Renamed group'}});
 assert.equal(s.hardwareChosen,true);assert.equal(Q.status(c).stale,false);
 page.editor.events.input({target:{dataset:{acdId:a.id,adbId:d.id,topologyField:'ecpu'},value:'120'}});
 assert.equal(s.hardwareChosen,false);assert.equal(Q.status(c).stale,true);assert.equal(c.requirements.ecpu,100);
});

test('legacy applied inventory name and storage edits do not display a false stale-totals review warning',()=>{
 const state=fixture(),s=state.sites[0],c=s.clusters[0],a=c.topology.acds[0],d=a.adbs[0];s.hardwareChosen=true;c.requirements=T.databaseTotals(c).requirements;const page=ui(state);
 page.editor.events.input({target:{dataset:{acdId:a.id,adbId:d.id,topologyField:'name'},value:'Renamed legacy database'}});
 page.editor.events.input({target:{dataset:{acdId:a.id,adbId:d.id,topologyField:'storageTB'},value:'3'}});
 assert.equal(Q.status(c).stale,false);assert.equal(s.hardwareChosen,true);assert.doesNotMatch(page.review.innerHTML,/database rows changed after totals were copied/);
});

test('database edits stay independent of manual requirements and known hardware allocation',()=>{
 for(const mode of ['manual','inventory-known-hardware']){
  const state=fixture(),s=state.sites[0],c=s.clusters[0],a=c.topology.acds[0],d=a.adbs[0];s.hardwareChosen=true;
  c.requirements=mode==='manual'?{source:'manual',ecpu:12,ramGB:24,unsizedACDs:0,minRatio:2}:Q.inventoryRequirements(c);
  if(mode==='inventory-known-hardware')s.planningIntent='allocation';
  const before=JSON.stringify(c.requirements),page=ui(state);
  page.editor.events.input({target:{dataset:{acdId:a.id,adbId:d.id,topologyField:'ecpu'},value:'120'}});
  assert.equal(JSON.stringify(c.requirements),before);assert.equal(s.hardwareChosen,true);
  assert.equal(Q.status(c).stale,mode==='inventory-known-hardware');
 }
});
test('peer-settings confirmation is explicit and does not overwrite numeric demand',()=>{
 const state=fixture(),a=T.entries(state)[0].acd,d=a.adbs[0],page=ui(state);
 page.editor.events.change({target:{dataset:{acdId:a.id,adbId:d.id,topologyField:'peerSettingsConfirmed'},checked:true}});
 assert.equal(d.peerSettingsConfirmed,true);assert.equal(d.ecpu,100);assert.equal(d.storageTB,2);
});
test('confirmed configured ECPUs require the Dedicated ECPU minimum and whole-number increment',()=>{
 const state=fixture(),d=T.entries(state)[0].acd.adbs[0];d.ecpu=.5;
 assert.equal(codes(state).includes('invalid_configured_adb_ecpu'),false);d.peerSettingsConfirmed=true;assert.ok(codes(state).includes('invalid_configured_adb_ecpu'));
 d.ecpu=0;assert.ok(codes(state).includes('invalid_configured_adb_ecpu'));d.ecpu=2;assert.equal(codes(state).includes('invalid_configured_adb_ecpu'),false);
});
