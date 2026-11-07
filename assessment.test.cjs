'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./model.js'),P=require('./planning.js'),A=require('./assessment.js');
const scenario=()=>({schema:'exacc-capacity/v1',sites:[M.newSite('Machine A')]});

test('a capacity fit remains qualified by provisioning and unchecked resources',()=>{
 const s=scenario(),r=A.assess(s,M,P);
 assert.equal(r.status,'partial');assert.match(r.headline,/provisioning is not confirmed/);
 assert.ok(r.unknowns.some(x=>x.code==='shared-storage'));
 assert.ok(r.unknowns.some(x=>x.code==='provisionability'));
 assert.equal(r.coverage.find(x=>x.id==='local').status,'supported');
 assert.equal(r.coverage.find(x=>x.id==='provisioning').status,'not-checked');
});

test('unselected hardware never exposes default free-capacity figures',()=>{
 const s=scenario();s.sites[0].planningIntent='workload';s.sites[0].hardwareChosen=false;
 const r=A.assess(s,M,P);assert.equal(r.status,'incomplete');assert.equal(r.machines[0].result,null);assert.equal(r.machines[0].constraints.length,0);
 const html=A.reportHTML(s,M,P,null,null,{generatedAt:'2026-11-07'});assert.match(html,/Hardware not selected/);assert.doesNotMatch(html,/2,878/);
});

test('a shortage on one node is not hidden by free capacity on another',()=>{
 const s=scenario();s.sites[0].nodes[0].otherLocal=2000;
 const r=A.assess(s,M,P),m=r.machines[0];assert.equal(r.status,'error');assert.ok(m.result.free>0);
 const deficit=m.hardErrors.find(x=>x.resource==='Local storage'&&x.nodeId===1);
 assert.ok(deficit.deficit>0);assert.match(m.nextAction,/DB 1/);assert.match(m.nextAction,/Free at least/);
});

test('buffer shortfall is advisory and not a hard capacity violation',()=>{
 const s=scenario();s.sites[0].bufferPercent=90;
 const r=A.assess(s,M,P);assert.equal(r.status,'warning');assert.equal(r.hardErrors.length,0);
 assert.ok(r.warnings.some(x=>x.code.startsWith('buffer-')));assert.ok(r.machines[0].result.free>0);
});

test('disabled compute and unconfirmed memory are explicit open checks',()=>{
 const s=scenario();s.sites[0].checkCompute=false;
 let r=A.assess(s,M,P);assert.ok(r.unknowns.some(x=>x.code==='compute-off'));assert.equal(r.machines[0].constraints.some(x=>x.resource==='CPU'),false);
 s.sites[0].checkCompute=true;delete s.sites[0].clusters[0].memoryRule;r=A.assess(s,M,P);assert.ok(r.unknowns.some(x=>x.code==='memory-history'));
});

test('sparse placements assess every selected node and VM slots',()=>{
 const s=scenario();s.sites[0]=M.resizeNodes(s.sites[0],3);s.sites[0].clusters[0].nodes=[2,3];s.sites[0].nodes[2].otherVMs=6;
 const r=A.assess(s,M,P),m=r.machines[0];assert.equal(m.constraints.find(x=>x.resource==='Local storage'&&x.nodeId===1).allocated,0);
 assert.equal(m.constraints.find(x=>x.resource==='VM slots'&&x.nodeId===3).deficit,1);assert.equal(r.status,'error');
});

test('topology errors and warnings retain their distinct meaning',()=>{
 const s=scenario(),T={inspect:()=>({errors:[{code:'peer',message:'Peer does not exist.',siteIndex:0}],warnings:[{code:'missing-cpu',message:'Database ECPU is missing.',siteIndex:0}],counts:{namedACDs:2,adbs:3}})};
 const r=A.assess(s,M,P,T);assert.equal(r.status,'error');assert.ok(r.hardErrors.some(x=>x.code==='peer'));assert.ok(r.warnings.some(x=>x.code==='missing-cpu'));assert.equal(r.totals.adbs,3);
 assert.equal(r.machines[0].status,'error');assert.match(r.machines[0].nextAction,/DR relationship/);
 assert.equal(r.hardErrors.filter(x=>x.code==='peer').length,1);
});

test('report escapes every user-authored name, notes and peer reference',()=>{
 const s=scenario();s.project={name:'<script>alert(1)</script>',notes:'<img src=x onerror=alert(1)>\nA & B'};
 s.sites[0].name='" onload="alert(1)';s.sites[0].clusters[0].name='<svg onload=x>';
 s.sites[0].clusters[0].topology={acds:[{id:'a',name:'<ACD>',role:'primary',peerIds:['<bad-peer>'],adbs:[{id:'d',name:'</td><script>x</script>',ecpu:0,ramGB:null,storageTB:0,independentSwitchover:true}]}]};
 const html=A.reportHTML(s,M,P,null,null,{generatedAt:'<date>'});assert.doesNotMatch(html,/<script|<img|<svg/);assert.match(html,/&lt;script&gt;/);assert.match(html,/A &amp; B/);assert.match(html,/&lt;bad-peer&gt;/);assert.match(html,/Not entered/);assert.match(html,/default-src 'none'/);
});
test('report header identifies customer, project, owner alias and the complete Plan ID',()=>{
 const s=scenario();s.project={id:'plan-5c69ea60-33cd-44f1-8ca4-fba9ae31140a',name:'2027 capacity plan',customer:'Example customer',owner:'JSN',notes:'Review storage.'};
 const html=A.reportHTML(s,M,P,null,null,{generatedAt:'2026-11-07'}),header=html.split('<header>')[1].split('</header>')[0];
 assert.match(header,/<dt>Customer<\/dt><dd>Example customer<\/dd>/);assert.match(header,/<dt>Project<\/dt><dd>2027 capacity plan<\/dd>/);assert.match(header,/<dt>Owner \/ alias<\/dt><dd>JSN<\/dd>/);assert.match(header,/<dt>Plan ID<\/dt><dd class="plan-id">plan-5c69ea60-33cd-44f1-8ca4-fba9ae31140a<\/dd>/);
 assert.match(html,/\.report-identity dd\{[^}]*overflow-wrap:anywhere/);assert.doesNotMatch(header,/signed in|authenticated|verified owner/i);
});
test('report treats identity labels as text even if invoked before metadata validation',()=>{
 const s=scenario();s.project={id:'<script>id</script>',name:'<svg onload=run()>',customer:'<img src=x onerror=run()>',owner:'" onload="run() & alias',notes:''};
 const html=A.reportHTML(s,M,P),header=html.split('<header>')[1].split('</header>')[0];
 assert.doesNotMatch(html,/<script|<svg|<img/);assert.match(header,/&lt;script&gt;id&lt;\/script&gt;/);assert.match(header,/&lt;img src=x onerror=run\(\)&gt;/);assert.match(header,/&quot; onload=&quot;run\(\) &amp; alias/);
});
test('report labels missing legacy identity without inventing an owner or Plan ID',()=>{
 for(const project of [undefined,{name:'Legacy proposal',notes:''},{name:' ',customer:' ',owner:'',notes:''}]){
  const s=scenario();if(project)s.project=project;const header=A.reportHTML(s,M,P).split('<header>')[1].split('</header>')[0];
  assert.match(header,/<dt>Customer<\/dt><dd>Not named<\/dd>/);assert.match(header,/<dt>Owner \/ alias<\/dt><dd>Not named<\/dd>/);assert.match(header,/<dt>Plan ID<\/dt><dd class="plan-id">Not assigned<\/dd>/);
  if(!project?.name?.trim())assert.match(header,/<h1>ExaC@C capacity plan<\/h1>/);
 }
});

test('rule metadata and source links are safe and included in the report',()=>{
 const R={VERSION:'rules-v2',CHECKED:'2026-11-07',SCOPE:'Autonomous only',rules:[{id:'r',label:'Rule',formula:'x < y',sourceUrls:['javascript:alert(1)','https://docs.oracle.com/example'],notes:[]}],conflicts:[{id:'c',label:'Doc difference',handling:'Confirm console.'}]};
 const s=scenario(),r=A.assess(s,M,P,null,R),html=A.reportHTML(s,M,P,null,R,{generatedAt:'2026-11-07'});
 assert.equal(r.meta.ruleVersion,'rules-v2');assert.ok(r.unknowns.some(x=>x.code==='rule-conflict-c'));assert.match(html,/rules-v2/);assert.match(html,/x &lt; y/);assert.doesNotMatch(html,/href="javascript:/);assert.match(html,/https:\/\/docs.oracle.com\/example/);
});

test('a saved rule version is not silently treated as current',()=>{
 const s=scenario();s.ruleSet={version:'old-rules',checked:'2026-09-17',scope:'Original scope'};
 const R={VERSION:'new-rules',CHECKED:'2026-11-07'},r=A.assess(s,M,P,null,R);
 assert.ok(r.unknowns.some(x=>x.code==='imported-rule-version'&&x.message.includes('recalculated with current rules')));
 assert.equal(r.importedRuleSet.version,'old-rules');assert.equal(s.ruleSet.version,'old-rules');
 assert.match(A.reportHTML(s,M,P,null,R),/Saved with rules old-rules/);
});

test('conventional records without applied allocation cannot appear complete',()=>{
 const s=scenario();s.sites[0].conventional={clusters:[{id:'v',name:'Legacy'}]};
 const C={inspect:()=>({pending:true,status:'partial',errors:[]})},r=A.assess(s,M,P,null,null,C);
 assert.equal(r.status,'incomplete');assert.ok(r.unknowns.some(x=>x.code==='conventional-pending'));
 assert.equal(r.coverage.find(x=>x.id==='conventional').status,'partial');
});

test('a conventional applied ledger remains visible after records are removed',()=>{
 const s=scenario();s.sites[0].conventional={clusters:[],applied:{version:1}};
 const C={inspect:()=>({pending:true,status:'partial',errors:[]})},r=A.assess(s,M,P,null,null,C);
 assert.equal(r.status,'incomplete');assert.ok(r.unknowns.some(x=>x.code==='conventional-pending'));
 assert.equal(r.coverage.find(x=>x.id==='conventional').status,'partial');
});

test('registry hard errors cannot be lost behind a passing model calculation',()=>{
 const s=scenario(),R={assess:()=>({hardware:{status:'over-limit',errors:['A registry constraint failed.'],warnings:[]}})};
 const r=A.assess(s,M,P,null,R);assert.equal(r.status,'error');assert.equal(r.machines[0].status,'error');
 assert.ok(r.hardErrors.some(x=>x.message==='A registry constraint failed.'));
});

test('a capacity deficit is counted once when the registry repeats the model error',()=>{
 const s=scenario();s.sites[0].nodes[0].otherLocal=2000;
 const R={assess:(_s,result)=>({hardware:{status:'over-limit',errors:[...result.errors,'One or more entered resource budgets exceed capacity.'],warnings:[]}})};
 const r=A.assess(s,M,P,null,R);assert.equal(r.hardErrors.length,1);
});

test('invalid numerical inputs remove technical totals and expose the correction',()=>{
 const s=scenario();s.sites[0].nodes[0].local=NaN;
 const r=A.assess(s,M,P);assert.equal(r.status,'error');assert.equal(r.machines[0].result,null);assert.match(r.machines[0].nextAction,/Correct/);
});

test('a downstream evaluator failure removes stale headroom hints',()=>{
 const s=scenario(),R={assess:()=>{throw Error('Invalid registry input.');}},r=A.assess(s,M,P,null,R);
 assert.equal(r.status,'error');assert.equal(r.machines[0].result,null);assert.equal(r.machines[0].limiting,null);
});

test('unlocated inventory errors mark machine next actions for review',()=>{
 const s=scenario(),T={inspect:()=>({errors:[{code:'duplicate',message:'Duplicate IDs.'}],warnings:[],counts:{}})},r=A.assess(s,M,P,T);
 assert.equal(r.machines[0].status,'error');assert.match(r.machines[0].nextAction,/plan-wide inventory/);
});

test('applied conventional allocations are counted once and documented in the report',()=>{
 const C=require('./conventional.js'),R=require('./rules.js'),s=scenario();
 s.sites[0].conventional={clusters:[{id:'vmc-1',name:'Conventional allocation',nodes:[1,2],localPerVM:100,cpuPerVM:40,memoryPerVM:200,cpuUnit:'ecpu',source:'console',notes:'Verified allocation'}],applied:null};
 s.sites[0]=C.applyToOther(s.sites[0]);
 const r=A.assess(s,M,P,null,R,C);assert.equal(r.machines[0].result.other,200);assert.equal(r.machines[0].result.free,2678);
 const html=A.reportHTML(s,M,P,null,R,{conventional:C,generatedAt:'2026-11-07'});
 assert.match(html,/Conventional allocation/);assert.match(html,/already counted in Other allocations/);assert.match(html,/Verified allocation/);
});

test('standalone report includes alternative decisions and per-node appendix',()=>{
 const s=scenario();s.alternatives=[{id:'a',name:'Year 2',kind:'year',sites:structuredClone(s.sites)}];
 const html=A.reportHTML(s,M,P,null,null,{generatedAt:'2026-11-07'});
 assert.match(html,/Executive summary/);assert.match(html,/Technical appendix/);assert.match(html,/Year 2/);assert.match(html,/DB 1/);assert.match(html,/Reserved ACD slots/);assert.doesNotMatch(html,/<script/);
});

test('executive report stays compact while the appendix retains complete issue detail',()=>{
 const s=scenario();s.project={name:'Plan',notes:'Detailed assumption <keep this>'};
 const T={inspect:()=>({errors:Array.from({length:5},(_,i)=>({code:`error-${i}`,message:`Correction detail ${i+1}`,siteIndex:0})),warnings:[{code:'warning',message:'Detailed advisory <review>',siteIndex:0}],counts:{}})};
 const R={VERSION:'current',conflicts:[{id:'rule',label:'Source difference',details:'Full source detail',handling:'Long confirmation text'}]};
 const html=A.reportHTML(s,M,P,T,R,{generatedAt:'2026-11-07'});
 const executive=html.split('<section id="executive-summary">')[1].split('</section>')[0];
 const appendix=html.split('<section class="technical" id="technical-appendix">')[1];
 assert.match(executive,/5<\/strong> corrections required/);assert.match(executive,/Showing 3 of 5 corrections/);
 assert.match(executive,/Correction detail 3/);assert.doesNotMatch(executive,/Correction detail 4|Detailed advisory|Long confirmation text|Detailed assumption/);
 for(const text of ['Correction detail 1','Correction detail 5','Detailed advisory &lt;review&gt;','Long confirmation text','Detailed assumption &lt;keep this&gt;','Full source detail'])assert.ok(appendix.includes(text),text);
});

test('resolved source distinctions are retained in the appendix without increasing open checks',()=>{
 const s=scenario(),R={conflicts:[{id:'resolved',label:'Resolved <date>',details:'Different announcement and formula dates.',handling:'Use the formula cutoff.',resolved:true},{id:'open',label:'Unresolved',handling:'Confirm the reservation.'}]};
 const r=A.assess(s,M,P,null,R);assert.equal(r.unknowns.some(x=>x.code==='rule-conflict-resolved'),false);assert.equal(r.unknowns.some(x=>x.code==='rule-conflict-open'),true);
 const html=A.reportHTML(s,M,P,null,R),appendix=html.split('<section class="technical" id="technical-appendix">')[1];
 assert.match(appendix,/Resolved &lt;date&gt;/);assert.match(appendix,/Resolved distinction/);assert.match(appendix,/Different announcement and formula dates/);
});

test('machine assessment labels use plain language',()=>{
 const s=scenario();s.sites.push(M.newSite('Machine B'));s.sites[1].bufferPercent=90;
 const html=A.reportHTML(s,M,P);assert.match(html,/>Open checks<\/td>/);assert.match(html,/>Review warnings<\/td>/);
 assert.doesNotMatch(html,/>partial<\/td>|>warning<\/td>/);
});

test('limiting VM capacity uses singular slot wording',()=>{
 const s=scenario();s.sites[0].nodes[0].otherVMs=4;
 const r=A.assess(s,M,P);assert.equal(r.machines[0].limiting.resource,'VM slots');
 assert.equal(r.machines[0].nextAction,'Tightest checked resource: VM slots on DB 1 (1 slot free).');
 assert.doesNotMatch(A.reportHTML(s,M,P),/1 VMs free/);
});

test('machine prefixes are added once and remain escaped',()=>{
 assert.equal(A.issueHTML({machine:'DC / Machine A',message:'DC / Machine A / AVMC 1: missing peer.'}),'DC / Machine A / AVMC 1: missing peer.');
 assert.equal(A.issueHTML({machine:'DC / Machine A',message:'DC / Machine AB: another group.'}),'<strong>DC / Machine A:</strong> DC / Machine AB: another group.');
 assert.equal(A.issueHTML({machine:'<machine>',message:'<machine>: <script>bad</script>'}),'&lt;machine&gt;: &lt;script&gt;bad&lt;/script&gt;');
});
