const test=require('node:test'),assert=require('node:assert/strict');
const X=require('./scenarios.js'),M=require('./model.js'),P=require('./planning.js'),S=require('./sizing.js'),T=require('./topology.js'),Q=require('./requirements.js');
const clone=x=>JSON.parse(JSON.stringify(x));
function workspace(){const s=M.newSite('Production');s.siteName='DC';s.uid='machine-a';s.clusters[0].uid='avmc-a';s.planningIntent='allocation';return {schema:'exacc-capacity/v1',sites:[s]};}
function topology(){return {acds:[{id:'acd-a',name:'Payments',role:'primary',peerId:'acd-dr',peerIds:['acd-dr'],adbs:[{id:'adb-a',name:'PaymentsDB',ecpu:16,ramGB:64,storageTB:1,independentSwitchover:true}]}]};}
const header='site,machine,avmc,acd,adb,role,ecpu,ram_gb,storage_tb,independent_switchover,cpu_unit';
const csv=(row='DC,Production,Core,Payments,PaymentsDB,unprotected,16,64,1,yes,ECPU')=>header+'\r\n'+row+'\r\n';

test('saved options contain full sites without recursive option lists or aliases',()=>{
 const w=workspace();w.project={name:'Plan',notes:'Review storage'};w.alternatives=[X.capture(w,'Starting plan','option',M)];
 const a=X.capture(w,'Year 2','year',M);assert.equal(a.sites.length,1);assert.equal(a.alternatives,undefined);
 a.sites[0].name='Changed';assert.equal(w.sites[0].name,'Production');
});
test('capture bounds option names and prevents ambiguous duplicate labels',()=>{
 const w=workspace();assert.throws(()=>X.capture(w,'','option',M),/non-empty/);
 w.alternatives=[X.capture(w,'Design A','option',M)];assert.throws(()=>X.capture(w,' design a ','option',M),/different name/);
 w.alternatives=Array.from({length:X.MAX_ALTERNATIVES},(_,i)=>({name:'Option '+i}));assert.throws(()=>X.capture(w,'Another','option',M),/at most 20/);
});
test('metadata validation preserves project, rules and alternatives and rejects malformed extras',()=>{
 const w=workspace();w.project={name:'Proposal',notes:'Check backup'};w.ruleSet={version:'rules-v2',checked:'2026-11-07',scope:'ExaC@C'};
 w.alternatives=[X.capture(w,'Saved','option',M)];const out=X.preserveExtras(M.importScenario(w),w,M);
 assert.deepEqual(out.project,w.project);assert.deepEqual(out.ruleSet,w.ruleSet);assert.deepEqual(out.alternatives[0].ruleSet,w.ruleSet);
 const bad=clone(w);bad.alternatives[0].alternatives=[];assert.throws(()=>X.validateExtras(bad,M),/invalid structure/);
 bad.alternatives=w.alternatives;bad.ruleSet.checked=42;assert.throws(()=>X.validateExtras(bad,M),/Rule-set check date/);
});
test('customer, owner and full Plan ID survive JSON import without changing their values',()=>{
 const w=workspace();w.project={id:'plan-5c69ea60-33cd-44f1-8ca4-fba9ae31140a',name:'2027 allocation',customer:'Example <Bank> & Co',owner:'José / JSN',notes:'Scope stays local.'};
 w.alternatives=[X.capture(w,'Before','option',M)];
 const raw=JSON.parse(JSON.stringify(w)),out=X.preserveExtras(M.importScenario(raw),raw,M);
 assert.deepEqual(out.project,w.project);assert.notEqual(out.project,w.project);assert.equal(out.alternatives.length,1);
});
test('legacy projects do not gain invented identity or owner fields during validation',()=>{
 const w=workspace();assert.equal(X.validateExtras(w,M).project,undefined);
 w.project={name:'Legacy proposal',notes:''};const project=X.validateExtras(w,M).project;
 assert.deepEqual(project,w.project);for(const key of ['id','customer','owner'])assert.equal(Object.hasOwn(project,key),false);
});
test('plan metadata rejects invalid IDs and type or length violations',()=>{
 for(const id of ['',null,42,{},'short','plan/one','plan:one','<script>','x'.repeat(81)])assert.throws(()=>X.validateProject({id,name:'Plan',notes:''}),/Plan ID/);
 for(const [field,value,pattern]of [['customer',{},/Customer name/],['customer','x'.repeat(121),/Customer name/],['owner',null,/Owner/],['owner','x'.repeat(81),/Owner/],['name','x'.repeat(121),/Project name/],['notes','x'.repeat(6001),/Project notes/]])assert.throws(()=>X.validateProject({name:'Plan',notes:'',[field]:value}),pattern);
 const p=X.validateProject({id:'PLAN_001',name:'x'.repeat(120),customer:'c'.repeat(120),owner:'o'.repeat(80),notes:'n'.repeat(6000)});assert.equal(p.id,'PLAN_001');
 assert.deepEqual(X.validateProject({name:'',notes:'',customer:'',owner:''}),{name:'',notes:'',customer:'',owner:''});
});
test('project metadata copies only declared fields and does not adopt JSON prototype keys',()=>{
 const project=JSON.parse('{"id":"plan-safe01","name":"Plan","notes":"","customer":"Example","owner":"JSN","__proto__":{"polluted":true},"unexpected":"value"}');
 const clean=X.validateProject(project);assert.equal(Object.getPrototypeOf(clean),Object.prototype);assert.equal(Object.hasOwn(clean,'__proto__'),false);assert.equal(Object.hasOwn(clean,'unexpected'),false);assert.equal({}.polluted,undefined);
});
test('growth, migration and repeated alternative restores remain within the current project identity',()=>{
 const w=workspace();w.project={id:'plan-current-001',name:'Current proposal',customer:'Example customer',owner:'JSN',notes:'Original notes'};
 w.sites[0].clusters[0].requirements={ecpu:80,ramGB:320,unsizedACDs:0,minRatio:4,incomplete:false};
 w.alternatives=[X.capture(w,'Initial','option',M),X.growth(w,{name:'Year 2',ecpuPercent:20,ramPercent:20},M),X.migration(w,{name:'Overlap',siteIndex:0,clusterIndexes:[0]},M)];
 w.project.name='Renamed proposal';w.project.owner='Second owner';w.project.notes='Revised assumptions';
 let current=w;
 for(const saved of w.alternatives){current=X.restore(current,saved.id,M);assert.deepEqual(current.project,w.project);assert.equal(current.project.id,'plan-current-001');assert.equal(current.alternatives.length,3);}
 current.project.customer='Changed only in restored copy';assert.equal(w.project.customer,'Example customer');
 const imported=X.preserveExtras(M.importScenario(w),JSON.parse(JSON.stringify(w)),M);assert.deepEqual(imported.project,w.project);
});
test('all alternative sites pass the caller supplied extension validator',()=>{
 const w=workspace();w.alternatives=[X.capture(w,'Saved','option',M)];w.alternatives[0].sites[0].untrustedExtension=true;
 assert.throws(()=>X.preserveExtras(M.importScenario(w),w,M,sites=>{if(sites.some(s=>s.untrustedExtension))throw Error('Invalid extension');}),/Invalid extension/);
});
test('restoring an option retains project and the saved option list but does not alias it',()=>{
 const w=workspace();w.project={name:'Example',notes:''};w.alternatives=[X.capture(w,'Before','option',M)];w.sites[0].clusters[0].slots=4;
 const restored=X.restore(w,w.alternatives[0].id,M);assert.equal(restored.sites[0].clusters[0].slots,10);assert.equal(restored.alternatives.length,1);assert.deepEqual(restored.project,w.project);
 restored.sites[0].clusters[0].slots=2;assert.equal(restored.alternatives[0].sites[0].clusters[0].slots,10);assert.equal(w.sites[0].clusters[0].slots,4);
});
test('restore uses the selected snapshot rule provenance and never unrelated working rules',()=>{
 const w=workspace();w.ruleSet={version:'old',checked:'2026-09-01',scope:'ExaC@C'};w.alternatives=[X.capture(w,'Old snapshot','option',M)];
 w.ruleSet={version:'new',checked:'2026-11-07',scope:'ExaC@C'};assert.equal(X.restore(w,w.alternatives[0].id,M).ruleSet.version,'old');
 delete w.alternatives[0].ruleSet;assert.equal(X.restore(w,w.alternatives[0].id,M).ruleSet,undefined);
});
test('comparison matches stable IDs across a rename and keeps per-machine resources separate',()=>{
 const w=workspace(),a=X.capture(w,'Alternative','option',M);a.sites[0].name='Renamed';a.sites[0].clusters[0].slots=5;
 const rows=X.compare(w,a,M,P);assert.equal(rows.length,1);assert.equal(rows[0].relationship,'matched');
 const local=rows[0].resources.find(r=>r.name==='Local storage');assert.equal(local.allocationChange,-515);
 assert.equal(local.saved.free-local.current.free,515);
});
test('comparison will not show stale hardware results for a growth draft',()=>{
 const w=workspace(),a=X.capture(w,'Unsized','year',M);a.sites[0].planningIntent='workload';a.sites[0].hardwareChosen=false;
 const row=X.compare(w,a,M,P)[0];assert.equal(row.saved.resources,null);assert.equal(row.saved.label,'Hardware selection needed');
 assert.ok(row.resources.every(r=>r.allocationChange===null));
});
test('ambiguous legacy machine names are not silently paired',()=>{
 const w=workspace();delete w.sites[0].uid;w.sites.push(clone(w.sites[0]));const a=X.capture(w,'Legacy','option',M);
 const rows=X.compare(w,a,M,P);assert.equal(rows.length,4);assert.equal(rows.filter(r=>r.relationship==='matched').length,0);
});
test('unique site/name fallback bridges regenerated legacy IDs and labels the assumption',()=>{
 const w=workspace(),a=X.capture(w,'Legacy identity','option',M);a.sites[0].uid='different-generated-id';
 const rows=X.compare(w,a,M,P);assert.equal(rows.length,1);assert.equal(rows[0].matchBasis,'name');assert.match(rows[0].relationship,/verify identity/);
});
test('growth creates an independent draft and leaves unknown database fields unknown',()=>{
 const w=workspace(),c=w.sites[0].clusters[0];c.topology=topology();c.topology.acds[0].adbs[0].ramGB=null;c.requirements={ecpu:16,ramGB:64,minRatio:2,unsizedACDs:9,incomplete:true,acdEcpus:[16,0,0,0,0,0,0,0,0,0]};
 c.topology.acds[0].adbs[0].peerSettingsConfirmed=true;const before=clone(w),a=X.growth(w,{name:'Year 2',ecpuPercent:25,ramPercent:50},M);
 assert.deepEqual(w,before);assert.equal(a.sites[0].clusters[0].requirements.ecpu,20);assert.equal(a.sites[0].clusters[0].requirements.ramGB,96);
 assert.equal(a.sites[0].clusters[0].topology.acds[0].adbs[0].ramGB,null);assert.equal(a.sites[0].clusters[0].topology.acds[0].adbs[0].peerSettingsConfirmed,false);assert.equal(a.sites[0].hardwareChosen,false);assert.equal(a.sites[0].planningIntent,'workload');S.validate(a.sites[0]);
});
test('growth aggregate ACD totals stay consistent under decimal rounding',()=>{
 const w=workspace();const c=w.sites[0].clusters[0];c.slots=3;c.requirements={ecpu:1,ramGB:4,acdEcpus:[.333333,.333333,.333334],unsizedACDs:0,minRatio:2};
 const a=X.growth(w,{name:'Fractional growth',ecpuPercent:33.3333,ramPercent:0},M);assert.doesNotThrow(()=>S.validate(a.sites[0]));
});
test('growth rejects unsupported percentages and no sized demand',()=>{
 const w=workspace();assert.throws(()=>X.growth(w,{name:'Bad',ecpuPercent:-1,ramPercent:0},M),/ECPU growth/);
 assert.throws(()=>X.growth(w,{name:'Unsized',ecpuPercent:20,ramPercent:20},M),/at least one sized workload/);
});
test('migration overlap doubles selected capacity and regenerates nested IDs without DR links',()=>{
 const w=workspace();w.sites[0].clusters[0].topology=topology();const before=clone(w),a=X.migration(w,{name:'Overlap',siteIndex:0,clusterIndexes:[0]},M);
 assert.deepEqual(w,before);assert.equal(a.sites[0].clusters.length,2);assert.equal(M.calculate(a.sites[0]).used,2*M.calculate(w.sites[0]).used);
 const c=a.sites[0].clusters[1],acd=c.topology.acds[0];assert.notEqual(c.uid,'avmc-a');assert.notEqual(acd.id,'acd-a');assert.notEqual(acd.adbs[0].id,'adb-a');assert.equal(acd.peerId,'');assert.equal(acd.peerIds,undefined);assert.equal(acd.role,'unprotected');
});
test('migration selection rejects nonexistent and duplicated cluster indexes',()=>{
 const w=workspace();assert.throws(()=>X.migration(w,{name:'X',siteIndex:0,clusterIndexes:[0,0]},M),/Choose at least/);
 assert.throws(()=>X.migration(w,{name:'X',siteIndex:1,clusterIndexes:[0]},M),/existing machine/);
});
test('CSV parser handles BOM, commas, quotes, CRLF and multiline cells',()=>{
 const parsed=X.parseCSV('\uFEFFsite,machine,avmc,acd,adb\r\nDC,"Main, A",Core,Container,"line1\nline2 ""quoted"""\r\n');
 assert.equal(parsed.rows[0].line,2);assert.equal(parsed.rows[0].cells[1],'Main, A');assert.equal(parsed.rows[0].cells[4],'line1\nline2 "quoted"');
});
test('CSV parser rejects malformed quotes and duplicate headers',()=>{
 assert.throws(()=>X.parseCSV('a,b\n"open,b'),/not closed/);assert.throws(()=>X.parseCSV('a,b\n"closed"tail,b'),/unexpected text/);assert.throws(()=>X.parseCSV('a,A\n1,2'),/unique/);
});
test('worksheet preparation pads missing cells, ignores only empty columns, and keeps source rows',()=>{
 const prepared=X.prepareWorksheetRows([['Title'],['site','machine','','avmc','acd','adb','ecpu'],['DC','Prod','','Core','ACD','DB'],[],['DC','Prod','','Core','ACD','DB2','4']],2);
 assert.deepEqual(prepared.sourceRows,[2,3,5]);assert.equal(prepared.rows[0].length,6);assert.equal(prepared.rows[1].length,6);assert.equal(prepared.rows[1][5],'');assert.match(prepared.warnings.join(' '),/empty worksheet column/);
});
test('blank worksheet headers remain explicitly unmapped Column N labels, never inferred field meanings',()=>{
 const prepared=X.prepareWorksheetRows([['site','','adb'],['DC','Prod','DB']]);assert.equal(prepared.rows[0][1],'Column 2');assert.equal(X.defaultMapping(prepared.rows[0]).machine,null);assert.match(prepared.warnings.join(' '),/No field meaning/);
});
test('CSV preview retains blank numeric values and distinguishes explicit zero',()=>{
 const preview=X.previewCSV(csv('DC,Production,Core,ACD,DB,unprotected,,0,,no,ECPU'));
 assert.deepEqual(preview.errors,[]);assert.equal(preview.rows[0].ecpu,null);assert.equal(preview.rows[0].ram_gb,0);assert.equal(preview.rows[0].storage_tb,null);assert.equal(preview.summary.incomplete,1);
});
test('CSV preview reports source line errors for duplicates, invalid values and roles',()=>{
 const preview=X.previewCSV(csv('DC,Production,Core,ACD,DB,primary,-1,64,1,maybe,OCPU\r\nDC,Production,Core,ACD,DB,standby,4,16,1,no,ECPU'));
 assert.ok(preview.errors.some(e=>e.line===2&&/unit/.test(e.message)));assert.ok(preview.errors.some(e=>e.line===2&&/ecpu/.test(e.message)));
 assert.ok(preview.errors.some(e=>e.line===3&&/Duplicate database/.test(e.message)));assert.ok(preview.errors.some(e=>/same ACD role/.test(e.message)));
});
test('CSV mapping is explicit for aliases and refuses implicit OCPU/vCPU conversion',()=>{
 const parsed=X.parseCSV('LOCATION,Machine Name,VM Cluster,Container Database,Database,CPU Demand\nDC,Prod,Core,ACD,DB,4');
 const mapping=X.defaultMapping(parsed.headers);mapping.ecpu=5;const preview=X.previewCSV(parsed,mapping);assert.equal(preview.rows[0].ecpu,4);assert.equal(preview.errors.length,0);
 const other=X.parseCSV('site,machine,avmc,acd,adb,ocpu\nDC,Prod,Core,ACD,DB,4');assert.ok(X.previewCSV(other).errors.some(e=>/OCPU/.test(e.message)));
 const map=X.defaultMapping(other.headers);map.ecpu=5;assert.ok(X.previewCSV(other,map).errors.some(e=>/cannot be imported/.test(e.message)));
});
test('CSV uses text as data and a downloaded template is readable',()=>{
 const p=X.previewCSV(csv('DC,Production,Core,ACD,"=HYPERLINK(""https://invalid"",""name"")",unprotected,4,16,,no,ECPU'));
 assert.equal(p.errors.length,0);assert.match(p.rows[0].adb,/^=HYPERLINK/);assert.equal(X.previewCSV(X.template()).errors.length,0);
});
test('CSV addition creates workload drafts and preserves unrelated plan extensions',()=>{
 const w=workspace();w.project={name:'Keep',notes:'Assumptions'};w.alternatives=[X.capture(w,'Before','option',M)];
 const p=X.previewCSV(csv('DR,Recovery,Core,Payments,PaymentsDB,standby,16,64,1,yes,ECPU'));
 const result=X.buildCSVImport(w,p,{mode:'add',siteIndex:0},M);assert.equal(w.sites.length,1);assert.equal(result.candidate.sites.length,2);
 const s=result.candidate.sites[1];assert.equal(s.hardwareChosen,false);assert.equal(s.clusters[0].requirements,undefined);assert.equal(s.clusters[0].topology.acds[0].peerId,'');assert.deepEqual(result.candidate.project,w.project);assert.equal(result.candidate.alternatives.length,1);
});
test('fresh import replaces only the untouched empty starting entry and reports it',()=>{
 const s=M.newSite('Machine 1');s.siteName='';s.clusters=[];s.planningIntent='workload';s.hardwareChosen=false;s.uid='fresh';
 const w={schema:'exacc-capacity/v1',sites:[s]},p=X.previewCSV(csv());
 const out=X.buildCSVImport(w,p,{mode:'add',siteIndex:0},M);assert.equal(out.candidate.sites.length,1);assert.equal(out.report.startingEntryReplaced,true);assert.match(out.warnings.join(' '),/empty starting entry/);assert.equal(w.sites[0].name,'Machine 1');
 for(const edit of [copy=>copy.sites[0].name='My machine',copy=>copy.sites[0].siteName='DC',copy=>copy.sites[0].bufferPercent=15,copy=>copy.sites[0].nodes[0].otherLocal=1,copy=>copy.sites[0].conventional={clusters:[],applied:null},copy=>copy.sites[0].planning={storageCapacity:100,storageAllocated:0}]){
  const changed=clone(w);edit(changed);const kept=X.buildCSVImport(changed,p,{mode:'add',siteIndex:0},M);assert.equal(kept.candidate.sites.length,2);assert.equal(kept.report.startingEntryReplaced,false);
 }
});
test('named customer metadata does not turn an otherwise untouched starting machine into inventory',()=>{
 const s=M.newSite('Machine 1');s.siteName='';s.clusters=[];s.planningIntent='workload';s.hardwareChosen=false;s.uid='starting-machine';
 const project={id:'plan-new-customer-001',name:'2027 plan',customer:'Example customer',owner:'JSN',notes:'Sizing assumptions belong to the whole plan.'};
 const w={schema:'exacc-capacity/v1',project,sites:[s]},out=X.buildCSVImport(w,X.previewCSV(csv()),{mode:'add',siteIndex:0},M);
 assert.equal(out.report.startingEntryReplaced,true);assert.equal(out.candidate.sites.length,1);assert.equal(out.candidate.sites[0].name,'Production');assert.deepEqual(out.candidate.project,project);assert.equal(w.sites[0].name,'Machine 1');
});
test('CSV merging will not replace an existing database silently',()=>{
 const w=workspace();w.sites[0].clusters[0].name='Core';w.sites[0].clusters[0].topology=topology();w.sites[0].clusters[0].topology.acds[0].role='unprotected';
 assert.throws(()=>X.applyCSV(w,X.previewCSV(csv()),{mode:'add',siteIndex:0},M),/already exists/);
});
test('active-machine replacement retains AVMC allocations and clears peer links to removed inventory',()=>{
 const w=workspace();w.sites[0].clusters[0].name='Core';w.sites[0].clusters[0].topology=topology();const dr=clone(w.sites[0]);dr.uid='machine-dr';dr.siteName='DR';dr.name='Recovery';dr.clusters[0].uid='avmc-dr';dr.clusters[0].topology.acds[0]={id:'acd-dr',name:'Peer',role:'standby',peerId:'acd-a',adbs:[]};w.sites.push(dr);
 const out=X.buildCSVImport(w,X.previewCSV(csv()),{mode:'replace-active',siteIndex:0},M);
 assert.equal(out.candidate.sites[0].clusters[0].slots,10);assert.equal(out.candidate.sites[0].clusters[0].cpu,160);assert.equal(out.candidate.sites[1].clusters[0].topology.acds[0].peerId,'');assert.equal(w.sites[1].clusters[0].topology.acds[0].peerId,'acd-a');assert.ok(out.warnings.some(s=>/peer link/.test(s)));
});
test('replacement requires explicit matching active-machine identity',()=>{
 const w=workspace(),p=X.previewCSV(csv('DR,Recovery,Core,ACD,DB,unprotected,4,16,,no,ECPU'));
 assert.throws(()=>X.applyCSV(w,p,{mode:'replace-active',siteIndex:0},M),/every row must match/);
});
test('CSV cannot exceed named-ACD cap or apply an erroneous preview',()=>{
 const rows=Array.from({length:17},(_,i)=>`DC,Prod,Core,ACD${i},DB${i},unprotected,4,16,,no,ECPU`);
 const p=X.previewCSV(header+'\n'+rows.join('\n'));assert.ok(p.errors.some(e=>/more than 16/.test(e.message)));
 assert.throws(()=>X.applyCSV(workspace(),p,{mode:'add'},M),/Resolve/);
});

test('CSV replacement retains applied inventory provenance and CPU floors until explicitly reapplied',()=>{
 for(const source of ['database-inventory','database-topology',undefined]){
  const w=workspace(),c=w.sites[0].clusters[0];c.name='Core';c.slots=2;c.topology=topology();
  c.topology.acds[0].role='unprotected';c.topology.acds[0].peerId='';delete c.topology.acds[0].peerIds;
  c.requirements=Q.inventoryRequirements(c);if(source===undefined)delete c.requirements.source;else c.requirements.source=source;
  const applied=clone(c.requirements),same=X.applyCSV(w,X.previewCSV(csv()),{mode:'replace-active',siteIndex:0},M,T).sites[0].clusters[0];
  assert.deepEqual(same.requirements,applied);assert.equal(Q.source(same),'database-inventory');assert.equal(Q.status(same).stale,false);
  const changed=X.applyCSV(w,X.previewCSV(csv('DC,Production,Core,Payments,PaymentsDB,unprotected,40,160,1,yes,ECPU')),{mode:'replace-active',siteIndex:0},M,T).sites[0];
  assert.deepEqual(changed.clusters[0].requirements,applied);assert.equal(Q.status(changed.clusters[0]).stale,true);assert.throws(()=>S.validate(changed,true),/Review and apply/);
  changed.clusters[0].requirements=Q.inventoryRequirements(changed.clusters[0]);assert.equal(changed.clusters[0].requirements.ecpu,40);assert.doesNotThrow(()=>S.validate(changed,true));
 }
});

test('growth and overlap preserve legacy inventory assumptions and saved manual totals',()=>{
 const w=workspace(),c=w.sites[0].clusters[0];c.slots=2;c.topology=topology();
 c.requirements={ecpu:80,ramGB:320,unsizedACDs:0,minRatio:4,incomplete:true};c.requirements=Q.inventoryRequirements(c);c.requirements.source='database-topology';
 const applied=clone(c.requirements),grown=X.growth(w,{name:'Future',ecpuPercent:25,ramPercent:50},M,T).sites[0].clusters[0];
 assert.deepEqual(grown.requirements,applied);assert.equal(grown.topology.acds[0].adbs[0].ecpu,20);assert.equal(grown.topology.acds[0].adbs[0].ramGB,96);
 assert.equal(Q.status(grown).stale,true);grown.requirements=Q.inventoryRequirements(grown);assert.equal(grown.requirements.ecpu,20);assert.equal(grown.requirements.ramGB,96);assert.equal(grown.requirements.userIncomplete,true);assert.equal(grown.requirements.incomplete,true);assert.deepEqual(grown.requirements.manualTotals,applied.manualTotals);
 const copied=X.migration(w,{name:'Overlap',siteIndex:0,clusterIndexes:[0]},M,T).sites[0].clusters[1];
 assert.equal(copied.requirements.userIncomplete,true);assert.deepEqual(copied.requirements.manualTotals,applied.manualTotals);assert.deepEqual(copied.requirements.acdEcpus,applied.acdEcpus);assert.equal(Q.status(copied).stale,false);
 c.topology.acds[0].adbs[0].ecpu=32;
 const staleCopy=X.migration(w,{name:'Stale overlap',siteIndex:0,clusterIndexes:[0]},M,T).sites[0].clusters[1];
 assert.equal(staleCopy.requirements.ecpu,16);assert.equal(Q.status(staleCopy).stale,true,'overlap must not silently apply changed inventory');
});

test('growth keeps the exact applied inventory snapshot for current and inferred source metadata',()=>{
 for(const explicitSource of [true,false]){
  const w=workspace(),c=w.sites[0].clusters[0];c.slots=2;c.topology=topology();c.requirements=Q.inventoryRequirements(c);if(!explicitSource){delete c.requirements.source;delete c.requirements.topologySignature;}
  const applied=clone(c.requirements),grown=X.growth(w,{name:'Future',ecpuPercent:25,ramPercent:50},M,T).sites[0];
  assert.deepEqual(grown.clusters[0].requirements,applied);assert.equal(Q.source(grown.clusters[0]),'database-inventory');assert.equal(Q.status(grown.clusters[0]).stale,true);assert.throws(()=>S.validate(grown,true),/Review and apply/);
  grown.clusters[0].requirements=Q.inventoryRequirements(grown.clusters[0]);assert.equal(grown.clusters[0].requirements.ecpu,20);assert.equal(grown.clusters[0].requirements.ramGB,96);assert.equal(Q.status(grown.clusters[0]).stale,false);
 }
});

test('CSV inventory edits preserve independent manual CPU details unless imported groups increase the slots',()=>{
 const w=workspace(),c=w.sites[0].clusters[0];c.name='Core';c.slots=2;c.requirements={source:'manual',ecpu:401,ramGB:802,minRatio:2,unsizedACDs:0,acdEcpus:[400,1],incomplete:false};
 const rows='DC,Production,Core,Heavy,CoreDB,unprotected,400,800,1,no,ECPU\nDC,Production,Core,Small,TinyDB,unprotected,1,2,1,no,ECPU';
 const same=X.applyCSV(w,X.previewCSV(csv(rows)),{mode:'replace-active',siteIndex:0},M,T).sites[0];
 assert.deepEqual(same.clusters[0].requirements.acdEcpus,[400,1]);assert.equal(same.clusters[0].requirements.ecpu,401);assert.equal(Q.source(same.clusters[0]),'manual');assert.equal(S.allocation(same.clusters[0],2,0).cpu,208);assert.doesNotThrow(()=>S.validate(same,true));
 const expanded=X.applyCSV(w,X.previewCSV(csv(rows+'\nDC,Production,Core,Future,FutureDB,unprotected,0,0,1,no,ECPU')),{mode:'replace-active',siteIndex:0},M,T).sites[0];
 assert.equal(expanded.clusters[0].slots,3);assert.equal(expanded.clusters[0].requirements.acdEcpus,undefined);assert.equal(expanded.clusters[0].requirements.ecpu,401);assert.equal(expanded.clusters[0].requirements.incomplete,true);assert.doesNotThrow(()=>S.validate(expanded,true));
 assert.deepEqual(c.requirements.acdEcpus,[400,1]);assert.equal(c.slots,2);
});
