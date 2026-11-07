(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaAssessment=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const EPS=1e-7;
 const BASE_SOURCES={capacity:'https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/plan-and-observe-capacity-for-autonomous-ai-database-on.html',scaling:'https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/manage-autonomous-exadata-vm-clusters.html'};
 const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=n=>Number.isFinite(n)?Number(n).toLocaleString('en-US',{maximumFractionDigits:1}):'Not entered';
 const label=s=>`${s?.siteName||'Unspecified site'} / ${s?.name||'Unnamed machine'}`;
 const intent=s=>s?.planningIntent||(s?.clusters?.some(c=>c.requirements)?'workload':'allocation');
 const ready=s=>intent(s)==='allocation'||s?.hardwareChosen!==false;
 function issue(code,message,extra={}){return {code,message,...extra};}
 function unique(items){const found=new Set();return items.filter(x=>{const k=`${x.machineIndex??''}|${x.code}|${x.message}`;if(found.has(k))return false;found.add(k);return true;});}
 function metadata(M,R){
  const entries=Array.isArray(R?.rules)?R.rules:Array.isArray(R?.registry)?R.registry:[];
  return {calculatorVersion:String(M?.VERSION||'Unknown'),ruleVersion:String(R?.VERSION||`calculator-${M?.VERSION||'unknown'}`),verifiedOn:String(R?.CHECKED||M?.CHECKED||'Not recorded'),scope:String(R?.SCOPE||'Autonomous VM Cluster planning on Exadata Cloud@Customer'),rules:entries,conflicts:Array.isArray(R?.conflicts)?R.conflicts:[],sources:{...BASE_SOURCES,...M?.SOURCES}};
 }
 function collectTopology(state,T){
  if(T&&typeof T.inspect==='function'){
   try{return T.inspect(state);}catch(e){return {errors:[issue('topology-invalid',e.message)],warnings:[],groups:[],counts:{}};}
  }
  const groups=[],errors=[],warnings=[],seen=new Set();
  let namedACDs=0,adbs=0;
  for(const [machineIndex,s] of (state?.sites||[]).entries())for(const [clusterIndex,c] of (s.clusters||[]).entries()){
   const acds=c.topology?.acds;if(acds!==undefined&&!Array.isArray(acds)){errors.push(issue('topology-invalid',`${c.name}: ACD inventory is invalid.`,{machineIndex,clusterIndex}));continue;}
   for(const a of acds||[]){
    namedACDs++;const databases=Array.isArray(a.adbs)?a.adbs:[];adbs+=databases.length;
    if(a.id&&seen.has(a.id))errors.push(issue('topology-duplicate-id',`Duplicate ACD identifier in ${c.name}.`,{machineIndex,clusterIndex}));
    if(a.id)seen.add(a.id);
    groups.push({machineIndex,clusterIndex,acdId:a.id,acdName:a.name,adbs:databases});
   }
  }
  if(namedACDs)warnings.push(issue('topology-validation-unavailable','Named groups are shown, but detailed topology validation is not available in this report.'));
  return {errors,warnings,groups,counts:{namedACDs,adbs}};
 }
 function constraintsFor(site,result,rows){
  const constraints=[];
  for(const row of rows){
   const units=row.unit,resource=row.name==='Memory estimate'?'Memory':row.name==='Exadata storage (manual)'?'Shared database storage':row.name;
   const data=row.nodes?.length?row.nodes:[row];
   for(const n of data)constraints.push({resource,unit:units,nodeId:n.id??null,capacity:n.capacity,allocated:n.allocated,free:n.free,buffer:n.buffer,bufferPercent:n.percent,deficit:Math.max(0,-n.free),belowBuffer:n.free>=-EPS&&n.after< -EPS,headroomFraction:n.capacity?n.free/n.capacity:0});
  }
  for(const n of result.nodes)constraints.push({resource:'VM slots',unit:'VMs',nodeId:n.id,capacity:n.maxVMs,allocated:n.vms+n.otherVMs,free:n.maxVMs-n.vms-n.otherVMs,buffer:0,bufferPercent:0,deficit:Math.max(0,n.vms+n.otherVMs-n.maxVMs),belowBuffer:false,headroomFraction:(n.maxVMs-n.vms-n.otherVMs)/n.maxVMs});
  return constraints;
 }
 function nextAction(item){
  if(!item)return 'Review the remaining checks before provisioning.';
  const where=item.nodeId===null?'this machine':`DB ${item.nodeId}`;
  if(item.deficit>EPS)return item.resource==='VM slots'?`Remove or relocate at least ${fmt(item.deficit)} VM allocation${item.deficit===1?'':'s'} on ${where}, or review the server layout.`:`Free at least ${fmt(item.deficit)} ${item.unit} of ${item.resource.toLowerCase()} on ${where}, reduce allocations, or choose more capacity.`;
  if(item.belowBuffer)return `${item.resource} on ${where} fits, but is below the preferred buffer. Reduce the allocation or accept the smaller growth margin.`;
  return limitingText(item);
 }
 function limitingText(item){
  if(!item)return '';
  const where=item.nodeId===null?'the machine':`DB ${item.nodeId}`,value=item.deficit>EPS?item.deficit:item.free;
  const unit=item.resource==='VM slots'?`slot${Math.abs(value)===1?'':'s'}`:item.unit;
  return `Tightest checked resource: ${item.resource} on ${where} (${fmt(value)} ${unit} ${item.deficit>EPS?'short':'free'}).`;
 }
 function humanStatus(status){return {error:'Corrections required',incomplete:'Inputs incomplete',warning:'Review warnings',partial:'Open checks',fit:'Fits checked capacity'}[status]||'Review assessment';}
 function assessMachine(site,index,M,P,R,C){
  const out={index,uid:site?.uid||'',label:label(site),name:site?.name||'',siteName:site?.siteName||'',hardwareReady:ready(site),profile:site?.profile,shape:M?.PROFILES?.[site?.profile]?.label||'Unknown shape',nodeCount:site?.nodes?.length||0,avmcs:site?.clusters?.length||0,slots:(site?.clusters||[]).reduce((n,c)=>n+(Number.isFinite(c.slots)?c.slots:0),0),hardErrors:[],warnings:[],unknowns:[],resources:[],constraints:[],limiting:null,result:null,status:'incomplete',nextAction:''};
  const add=(list,code,text,extra={})=>out[list].push(issue(code,text,{machineIndex:index,machine:out.label,...extra}));
  try{M.validate(site);P.validate(site);}catch(e){add('hardErrors','invalid-input',e.message);out.nextAction='Correct the invalid input before using these figures.';out.status='error';return out;}
  if(!out.hardwareReady){add('unknowns','hardware-unselected','Choose a hardware option before using capacity figures.');out.nextAction='Enter workload needs, then compare and select hardware.';return out;}
  try{
   out.result=M.calculate(site);out.resources=P.resources(site,out.result);out.constraints=constraintsFor(site,out.result,out.resources);
   out.limiting=[...out.constraints].sort((a,b)=>a.headroomFraction-b.headroomFraction)[0]||null;
   out.result.errors.forEach((text,i)=>{
    // Structured per-node deficits below already carry these same violations.
    const match=/^DB (\d+):/.exec(text),resource=text.includes('local storage exceeds capacity')?'Local storage':text.includes('allocated ECPUs exceed')?'CPU':text.includes('estimated memory exceeds')?'Memory':text.includes('VMs exceeds')?'VM slots':null;
    if(match&&resource&&out.constraints.some(c=>c.nodeId===Number(match[1])&&c.resource===resource&&c.deficit>EPS))return;
    add('hardErrors',`model-limit-${i}`,text);
   });
   for(const c of out.constraints){
    const where=c.nodeId===null?'Machine':`DB ${c.nodeId}`;
    if(c.deficit>EPS)add('hardErrors',`capacity-${c.resource}-${c.nodeId}`,`${where}: ${c.resource.toLowerCase()} is short by ${fmt(c.deficit)} ${c.unit}.`,{resource:c.resource,nodeId:c.nodeId,deficit:c.deficit,unit:c.unit});
    else if(c.belowBuffer)add('warnings',`buffer-${c.resource}-${c.nodeId}`,`${where}: ${c.resource.toLowerCase()} fits, but is below the ${fmt(c.bufferPercent)}% buffer target.`,{resource:c.resource,nodeId:c.nodeId,unit:c.unit});
   }
   const p=P.config(site);
   if(!site.checkCompute)add('unknowns','compute-off','CPU and memory checks are off. The displayed capacity does not establish compute fit.');
   if(p.storageCapacity===null||p.storageAllocated===null)add('unknowns','shared-storage','Shared database storage has not been fully entered. Local storage is a separate resource.');
   else add('unknowns','shared-storage-manual','Shared database storage is a manual total. Storage-server sizing, internal reservations and backup capacity need separate confirmation.');
   if(site.profile==='custom')add('unknowns','custom-hardware','Custom hardware capacities and VM limits must be confirmed against the customer console.');
   if(site.checkCompute&&out.result.costs.some(c=>!c.memorySizing?.verified))add('unknowns','memory-history','One or more AVMC memory histories are unconfirmed. The current formula is used until eligibility is confirmed.');
   if(!site.clusters.length)add('unknowns','no-avmcs','No AVMCs are entered. Free infrastructure capacity alone is not a workload sizing.');
   if(site.clusters.some(c=>!c.requirements||c.requirements.incomplete||c.requirements.ecpu==null||c.requirements.ramGB==null))add('unknowns','workload-incomplete','Workload requirements are missing or incomplete. The check covers entered allocations only.');
   if(site.clusters.some(c=>!c.topology?.acds?.length))add('unknowns','named-inventory','Some AVMCs have no named ACD/ADB inventory. Reserved ACD slots do not prove deployed databases or independent switchover groups.');
   if(R&&typeof R.assess==='function'){
    const rule=R.assess(site,out.result,P);out.ruleAssessment=rule;
    for(const error of rule?.hardware?.errors||[]){
     const text=typeof error==='string'?error:error.message||String(error);
     if(out.result.errors.includes(text)||(text==='One or more entered resource budgets exceed capacity.'&&out.constraints.some(c=>c.deficit>EPS)))continue;
     add('hardErrors','rule-hardware',text);
    }
    if(rule?.hardware?.status==='over-limit'&&!out.hardErrors.length)add('hardErrors','rule-limit','The applicable rule registry reports a resource-limit violation. Review the rule details before using this plan.');
    for(const warning of rule?.hardware?.warnings||[]){
     const text=typeof warning==='string'?warning:warning.message||String(warning);
     if(out.result.warnings.includes(text)||text==='One or more preferred free-capacity targets are not met.')continue;
     add('warnings','rule-hardware',text);
    }
    for(const adjustment of rule?.memoryAdjustments||[])add('warnings','memory-adjustment',typeof adjustment==='string'?adjustment:adjustment.message||adjustment.notes?.join(' ')||'The sizing option requires a database CPU increase to provide the requested memory.');
   }
   // The explicit ledger is the only route from conventional inventory into Other values.
   if(site.conventional?.clusters?.length||site.conventional?.applied){
    const conventional=C?.inspect?C.inspect(site):null;out.conventional=conventional;
    if(conventional?.errors?.length)for(const e of conventional.errors)add('hardErrors','conventional-ledger',typeof e==='string'?e:e.message||'Check the conventional cluster allocation ledger.');
    if(!conventional||conventional.pending||conventional.status==='incomplete')add('unknowns','conventional-pending','Conventional VM cluster records are incomplete or not applied to Other allocations. Their full footprint is not established by these totals.');
    add('unknowns','conventional-scope','Conventional VMC checks use entered allocations only. Confirm filesystem/VM backup footprint, CPU units and mixed-service VM limits in the console.');
   }
   out.status=out.hardErrors.length?'error':out.unknowns.some(x=>x.code==='conventional-pending')?'incomplete':out.warnings.length?'warning':'partial';
   const shortage=out.constraints.filter(c=>c.deficit>EPS).sort((a,b)=>a.headroomFraction-b.headroomFraction)[0];
   out.nextAction=out.hardErrors.length&&!shortage?'Correct the model or inventory issues listed below.':nextAction(shortage||out.limiting);
  }catch(e){add('hardErrors','calculation-invalid',e.message);out.status='error';out.result=null;out.resources=[];out.constraints=[];out.limiting=null;delete out.ruleAssessment;out.nextAction='Correct the input before using these figures.';}
  out.hardErrors=unique(out.hardErrors);out.warnings=unique(out.warnings);out.unknowns=unique(out.unknowns);return out;
 }
 function coverageFrom(assessment,state,R){
  const machines=assessment.machines,anyReady=machines.some(m=>m.result),allReady=machines.length>0&&machines.every(m=>m.result),compute=allReady&&state.sites.every(s=>s.checkCompute),named=(assessment.topology.counts?.namedACDs||0)>0;
  const rows=[
   {id:'local',label:'AVMC local storage and per-server placement',status:allReady?'supported':anyReady?'partial':'not-checked',detail:'Calculated for the entered DB-server placements; each selected server must fit.'},
   {id:'compute',label:'Allocated CPU and memory',status:compute?'supported':anyReady?'partial':'not-checked',detail:'Checks AVMC allocations. Live utilization, ACD reservations and memory-rule eligibility are separate checks.'},
   {id:'hardware',label:'Hardware profiles',status:allReady&&state.sites.every(s=>s.profile!=='custom')?'supported':'partial',detail:'X11M presets are included. Other configurations require console capacity and service-limit confirmation.'},
   {id:'topology',label:'Named ACD/ADB groups and DR links',status:named?'partial':'not-checked',detail:named?'Entered names and peer relationships are checked as a proposed design. This is not a live OCI inventory or failover test.':'Enter named ACDs and databases to assess the proposed grouping.'},
   {id:'provisioning',label:'Immediate provisioning and scale-down permission',status:'not-checked',detail:'Confirm available, reserved and reclaimable CPUs, used storage, quotas and console minimums.'},
   {id:'shared-storage',label:'Shared Exadata storage and backup sizing',status:machines.some(m=>m.resources.some(r=>r.unit==='TB'))?'partial':'not-checked',detail:'Only manually entered usable/allocated storage is compared. Storage-server and backup sizing are separate.'},
   {id:'conventional',label:'Conventional VM clusters',status:state.sites.some(s=>s.conventional?.clusters?.length||s.conventional?.applied)?'partial':'not-checked',detail:'Entered console/proposal footprints may be counted through Other allocations. Autonomous formulas are not reused as conventional filesystem formulas.'},
   {id:'failure',label:'Node/site failure, RTO/RPO and application performance',status:'not-checked',detail:'No workload benchmark, recovery-time guarantee or automatic failure-capacity approval is produced.'},
   {id:'commercial',label:'Licensing, prices and deployment approval',status:'not-checked',detail:'A capacity comparison is not a quote, entitlement check or authorization to provision.'}
  ];
  const aliases={'cpu-memory':'compute',provisionability:'provisioning'};
  for(const r of R?.coverage||[]){if(!rows.some(x=>x.id===(aliases[r.id]||r.id)))rows.push({id:r.id,label:r.label,status:r.state==='supported'?'supported':r.state==='partial'?'partial':'not-checked',detail:r.description||''});}
  return rows;
 }
 function assess(state,M,P,T,R,C){
  if(!state||!Array.isArray(state.sites))throw Error('A scenario with a sites array is required.');
  const machines=state.sites.map((s,i)=>assessMachine(s,i,M,P,R,C));
  const topology=collectTopology(state,T),meta=metadata(M,R);
  for(const [name,url] of Object.entries(T?.SOURCES||{}))meta.sources[`topology-${name}`]=url;
  const normalizeTopology=(e,i,kind)=>{
   const row=typeof e==='string'?issue(`topology-${kind}-${i}`,e):issue(e.code||`topology-${kind}-${i}`,e.message||String(e),e);
   const index=row.machineIndex??row.siteIndex;
   if(Number.isInteger(index)&&machines[index]){row.machineIndex=index;row.machine=machines[index].label;}
   return row;
  };
  const topologyErrors=(topology.errors||[]).map((e,i)=>normalizeTopology(e,i,'error'));
  const topologyWarnings=(topology.warnings||[]).map((e,i)=>normalizeTopology(e,i,'warning'));
  for(const row of topologyErrors){const machine=machines[row.machineIndex];if(machine){machine.hardErrors=unique([...machine.hardErrors,row]);machine.status='error';machine.nextAction='Correct the named ACD/ADB inventory or DR relationship issues listed for this machine.';}}
  if(topologyErrors.some(row=>row.machineIndex===undefined))for(const machine of machines){machine.status='error';machine.nextAction='Resolve the plan-wide inventory issues before using this design.';}
  for(const row of topologyWarnings){const machine=machines[row.machineIndex];if(machine){machine.warnings=unique([...machine.warnings,row]);if(machine.status==='partial')machine.status='warning';}}
  const hardErrors=unique([...machines.flatMap(m=>m.hardErrors),...topologyErrors]);
  const warnings=unique([...machines.flatMap(m=>m.warnings),...topologyWarnings]);
  const ruleMismatch=state.ruleSet?.version&&state.ruleSet.version!==meta.ruleVersion?[issue('imported-rule-version',`Saved with rules ${state.ruleSet.version}; recalculated with current rules ${meta.ruleVersion}. Review the figures and rule changes before using this plan.`)]:[];
  const unknowns=unique([...machines.flatMap(m=>m.unknowns),...ruleMismatch,issue('provisionability','Capacity fit does not confirm that OCI can provision or resize now. Verify available, reserved and reclaimable CPU, used storage and console minimums.'),issue('availability-performance','Failure capacity, application performance, RTO/RPO and backup recovery are not verified.'),issue('commercial-approval','Licensing, pricing and deployment approval are outside this calculation.'),...meta.conflicts.filter(c=>c.resolved!==true).map(c=>issue(`rule-conflict-${c.id}`,`${c.label}: ${c.handling||c.details||'Confirm the applicable rule before provisioning.'}`))]);
  const pending=!machines.length||machines.some(m=>!m.hardwareReady||m.status==='incomplete');
  const status=hardErrors.length?'error':pending?'incomplete':warnings.length?'warning':'partial';
  const headline=status==='error'?'Correct the issues before using this plan':status==='incomplete'?'Complete the plan before assessing capacity':status==='warning'?'Fits checked capacity; review warnings and open checks':'Fits checked capacity; provisioning is not confirmed';
  const assessment={status,headline,meta,importedRuleSet:state.ruleSet||null,machines,hardErrors,warnings,unknowns,topology,totals:{machines:machines.length,avmcs:machines.reduce((n,m)=>n+m.avmcs,0),slots:machines.reduce((n,m)=>n+m.slots,0),namedACDs:topology.counts?.namedACDs||0,adbs:topology.counts?.adbs||0},coverage:[]};
  assessment.coverage=coverageFrom(assessment,state,R);return assessment;
 }
 function coverage(state,M,P,T,R,C){return assess(state,M,P,T,R,C).coverage;}
 function safeUrl(value){try{const u=new URL(String(value));return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
 function link(url,text){const safe=safeUrl(url);return safe?`<a href="${escape(safe)}" target="_blank" rel="noopener noreferrer">${escape(text||safe)}</a>`:escape(text||'Source link unavailable');}
 function issueHTML(item){
  const message=String(item.message??''),machine=String(item.machine||''),text=message.trimStart();
  const alreadyPrefixed=machine&&text.startsWith(machine)&&/^(?:$|[\s:/>→])/.test(text.slice(machine.length));
  return `${machine&&!alreadyPrefixed?`<strong>${escape(machine)}:</strong> `:''}${escape(message)}`;
 }
 function issueList(items,empty){return items.length?`<ul>${items.map(i=>`<li>${issueHTML(i)}</li>`).join('')}</ul>`:`<p class="muted">${escape(empty)}</p>`;}
 function coverageTable(rows){return `<table><thead><tr><th>Area</th><th>Coverage</th><th>Meaning</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escape(r.label)}</td><td>${escape(r.status.replace('-',' '))}</td><td>${escape(r.detail)}</td></tr>`).join('')}</tbody></table>`;}
 function projectIdentityHTML(project){
  const p=project&&typeof project==='object'?project:{};
  const rows=[['Customer',p.customer,'Not named'],['Project',p.name,'Not named'],['Owner / alias',p.owner,'Not named'],['Plan ID',p.id,'Not assigned']];
  return `<dl class="report-identity">${rows.map(([name,value,fallback])=>`<div><dt>${name}</dt><dd${name==='Plan ID'?' class="plan-id"':''}>${escape(typeof value==='string'&&value.trim()?value:fallback)}</dd></div>`).join('')}</dl>`;
 }
 function topologyHTML(state){
  const peers=new Map();for(const s of state.sites)for(const c of s.clusters||[])for(const a of c.topology?.acds||[])peers.set(a.id,`${label(s)} → ${c.name} → ${a.name}`);
  return state.sites.map(s=>`<section class="machine"><h3>${escape(label(s))}</h3>${(s.clusters||[]).map(c=>`<article class="group"><h4>${escape(c.name)} <span class="muted">· ${fmt(c.slots)} reserved ACD slots</span></h4>${c.topology?.acds?.length?c.topology.acds.map(a=>{
   const ids=a.role==='primary'?(a.peerIds||[a.peerId].filter(Boolean)):[a.peerId].filter(Boolean);
   return `<div class="acd"><h5>${escape(a.name)} <span class="muted">· ${escape(a.role||'role not entered')}</span></h5><p class="muted">Peer: ${ids.length?ids.map(id=>escape(peers.get(id)||`Unresolved reference ${id}`)).join('; '):'Not linked'}</p><table><thead><tr><th>Database</th><th>ECPU demand</th><th>RAM GB</th><th>Storage TB</th><th>Independent switchover requested</th></tr></thead><tbody>${(a.adbs||[]).map(d=>`<tr><td>${escape(d.name)}</td><td>${fmt(d.ecpu)}</td><td>${fmt(d.ramGB)}</td><td>${fmt(d.storageTB)}</td><td>${d.independentSwitchover===true?'Yes':'No'}</td></tr>`).join('')||'<tr><td colspan="5">No named databases entered.</td></tr>'}</tbody></table></div>`;
  }).join(''):'<p class="muted">Named ACD/ADB inventory not entered. The slot count is a reservation setting.</p>'}</article>`).join('')||'<p class="muted">No AVMCs entered.</p>'}</section>`).join('');
 }
 function conventionalHTML(site,C){
  const cfg=site.conventional;if(!cfg?.clusters?.length&&!cfg?.applied)return '';
  let check=null;try{check=C?.inspect?.(site);}catch{}
  const note=!check?'Conventional footprint confirmation is unavailable. Do not assume the records are included in Other allocations.':check.pending?'Edits to conventional VMC records are not fully reflected in the capacity totals. Totals retain the last explicitly included footprint until it is updated or removed.':check.errors?.length?'The conventional allocation ledger has errors. Reconcile it with Other allocations before using these totals.':'The explicitly included VMC footprint is already counted in Other allocations. It is not added again in this report.';
  return `<h4>Conventional VMC allocation records</h4><p class="muted">${escape(note)} Filesystem/VM backup footprint and mixed-service limits need console confirmation.</p><table><thead><tr><th>VMC</th><th>Source</th><th>DB servers</th><th>Local GB / VM</th><th>ECPU / VM</th><th>Memory GB / VM</th><th>Notes</th></tr></thead><tbody>${(Array.isArray(cfg.clusters)?cfg.clusters:[]).map(c=>`<tr><td>${escape(c.name)}</td><td>${escape(c.source)}</td><td>${escape((c.nodes||[]).join(', '))}</td><td>${fmt(c.localPerVM)}</td><td>${fmt(c.cpuPerVM)}</td><td>${fmt(c.memoryPerVM)}</td><td>${escape(c.notes||'')}</td></tr>`).join('')||'<tr><td colspan="7">No current VMC records. A previously included footprint may still remain in Other allocations.</td></tr>'}</tbody></table>${C?.SOURCES?`<p class="muted">${Object.entries(C.SOURCES).map(([name,url])=>link(url,`Conventional VMC ${name}`)).join(' · ')}</p>`:''}`;
 }
 function reportHTML(state,M,P,T,R,options={}){
  const a=assess(state,M,P,T,R,options.conventional),title=typeof state.project?.name==='string'&&state.project.name.trim()?state.project.name:'ExaC@C capacity plan',date=options.generatedAt||new Date().toISOString();
  const resources=a.machines.map(m=>`<tr><td>${escape(m.label)}</td><td>${escape(m.hardwareReady?`${m.shape} · ${m.nodeCount} DB servers`:'Hardware not selected')}</td><td>${m.avmcs} / ${m.slots}</td><td>${m.result?fmt(m.result.free):'Not checked'}</td><td>${escape(humanStatus(m.status))}</td><td>${escape(m.nextAction)}</td></tr>`).join('');
  const technical=a.machines.map(m=>`<section class="machine"><h3>${escape(m.label)}</h3>${m.constraints.length?`<table><thead><tr><th>Resource</th><th>Location</th><th>Capacity</th><th>Allocated</th><th>Free</th><th>Buffer target</th></tr></thead><tbody>${m.constraints.map(r=>`<tr><td>${escape(r.resource)} (${escape(r.unit)})</td><td>${r.nodeId===null?'Machine':`DB ${r.nodeId}`}</td><td>${fmt(r.capacity)}</td><td>${fmt(r.allocated)}</td><td class="${r.deficit>EPS?'negative':''}">${fmt(r.free)}</td><td>${fmt(r.buffer)} (${fmt(r.bufferPercent)}%)</td></tr>`).join('')}</tbody></table>`:'<p>Capacity is not calculated until the input and hardware choice are complete.</p>'}${m.result?`<h4>AVMC allocation estimates</h4><table><thead><tr><th>AVMC</th><th>DB servers</th><th>ACD slots</th><th>ECPUs / VM</th><th>GB / ECPU</th><th>Memory rule</th><th>Memory GB</th><th>Local GB</th></tr></thead><tbody>${m.result.costs.map((cost,i)=>{const c=state.sites[m.index].clusters[i];return `<tr><td>${escape(c.name)}</td><td>${escape(c.nodes.join(', '))}</td><td>${fmt(c.slots)}</td><td>${fmt(c.cpu)}</td><td>${fmt(c.memoryPerCPU)}</td><td>${escape(cost.memorySizing?.label||'Not established')}</td><td>${fmt(cost.memory)}</td><td>${fmt(cost.total)}</td></tr>`;}).join('')}</tbody></table>`:''}${conventionalHTML(state.sites[m.index],options.conventional)}</section>`).join('');
  const alternatives=(state.alternatives||[]).map(p=>{try{const v=assess({sites:p.sites},M,P,T,R,options.conventional);return `<tr><td>${escape(p.name)}</td><td>${escape(p.kind||'option')}</td><td>${v.totals.machines}</td><td>${v.totals.avmcs}</td><td>${v.totals.slots}</td><td>${escape(v.headline)}</td></tr>`;}catch(e){return `<tr><td>${escape(p.name)}</td><td colspan="5">Could not assess: ${escape(e.message)}</td></tr>`;}}).join('');
  const ruleRows=a.meta.rules.map(r=>`<tr><td>${escape(r.id)}<br><strong>${escape(r.label)}</strong></td><td>${escape(r.scope||a.meta.scope)}<br>${escape(r.formula||'')}<br>${escape(Array.isArray(r.notes)?r.notes.join(' '):r.notes||'')}</td><td>${escape(r.verifiedOn||a.meta.verifiedOn)}<br>${(r.sourceUrls||[]).map((url,i)=>link(url,`Source ${i+1}`)).join(' · ')}</td></tr>`).join('');
  const priority=e=>['invalid-input','calculation-invalid'].includes(e.code)?0:e.deficit>EPS?1:2;
  const topCorrections=[...a.hardErrors].sort((x,y)=>priority(x)-priority(y)).slice(0,3);
  const issueCounts=`<p class="issue-counts"><strong>${a.hardErrors.length}</strong> correction${a.hardErrors.length===1?'':'s'} required · <strong>${a.warnings.length}</strong> advisor${a.warnings.length===1?'y':'ies'} · <strong>${a.unknowns.length}</strong> open check${a.unknowns.length===1?'':'s'}</p>`;
  const executiveIssues=`${issueCounts}${topCorrections.length?`<h3>Priority corrections</h3>${issueList(topCorrections,'')}${a.hardErrors.length>topCorrections.length?`<p class="muted">Showing ${topCorrections.length} of ${a.hardErrors.length} corrections.</p>`:''}`:''}<p class="muted">Full corrections, warnings, assumptions and open checks are in the <a href="#technical-appendix">technical appendix</a>.</p>`;
  const detailedIssues=`<h3>Corrections required (${a.hardErrors.length})</h3>${issueList(a.hardErrors,'No violations found in the enabled capacity checks. Open checks below still apply.')}<h3>Advisory warnings (${a.warnings.length})</h3>${issueList(a.warnings,'No advisory warnings from the enabled checks.')}<h3>Open checks (${a.unknowns.length})</h3>${issueList(a.unknowns,'No additional checks recorded.')}`;
  const planNotes=state.project?.notes?`<h3>Plan assumptions and notes</h3><p class="notes">${escape(state.project.notes)}</p>`:'';
  const sourceNotes=a.meta.conflicts.length?`<h3>Source notes and differences</h3><ul>${a.meta.conflicts.map(c=>`<li><strong>${escape(c.label)}</strong> <span class="muted">(${c.resolved===true?'Resolved distinction':'Confirmation retained'})</span><br>${escape(c.details||'')}<br>${escape(c.handling||'')}${c.sourceUrls?.length?`<br>${c.sourceUrls.map((url,i)=>link(url,`Source ${i+1}`)).join(' · ')}`:''}</li>`).join('')}</ul>`:'';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer"><title>${escape(title)}</title><style>body{font:14px/1.6 Arial,sans-serif;color:#312d2a;margin:0;background:#f6f5f2}main{max-width:1150px;margin:auto;padding:36px;background:white}header{border-top:5px solid #b53c2b;padding-top:22px}h1{font-size:30px;line-height:1.2;margin:8px 0 14px}h2{font-size:22px;margin:32px 0 12px;border-top:1px solid #ddd6ce;padding-top:22px}h3{font-size:18px;margin:24px 0 12px}h4{font-size:15px;margin:20px 0 8px}h5{font-size:14px;margin:14px 0 6px}p{margin:8px 0 14px}.muted,small{color:#625b54;font-size:12px}.verdict{padding:18px;border-left:4px solid #9d7129;background:#fff7e6}.verdict.error{border-color:#a32d26;background:#fff1ef}.stats{display:flex;gap:24px;flex-wrap:wrap;margin:20px 0}.stats strong{display:block;font-size:24px}.issue-counts{padding:10px 14px;background:#f2efea;border-radius:5px}.report-identity{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,.8fr) minmax(0,1.3fr);gap:12px 16px;margin:18px 0}.report-identity>div{min-width:0}.report-identity dt{font-size:10px;font-weight:600;color:#625b54;text-transform:uppercase;letter-spacing:.4px}.report-identity dd{font-size:13px;margin:3px 0 0;overflow-wrap:anywhere}.report-identity .plan-id{font-family:Consolas,monospace;font-size:11px}table{width:100%;border-collapse:collapse;font-size:12px;margin:14px 0 22px}th{text-align:left;background:#f2efea;color:#625b54;font-size:11px}td,th{padding:10px;border-bottom:1px solid #ddd6ce;vertical-align:top}td{font-variant-numeric:tabular-nums}td,th{overflow-wrap:anywhere}.overview-table{table-layout:fixed}.overview-table td,.overview-table th{overflow-wrap:break-word;word-break:normal}li{margin-bottom:8px}a{color:#9d3528}.negative{color:#a32d26}.group{border:1px solid #ddd6ce;border-radius:6px;padding:0 18px 10px;margin:14px 0}.acd{border-top:1px solid #ddd6ce}.notes{white-space:pre-wrap}.machine{break-inside:auto}footer{border-top:1px solid #ddd6ce;margin-top:30px;padding-top:16px;font-size:11px;color:#625b54}@media(max-width:700px){.report-identity{grid-template-columns:repeat(2,minmax(0,1fr))}main{padding:20px}table{font-size:10px}td,th{padding:6px}}@media print{body{background:white}main{max-width:none;padding:0}h1{font-size:25px}h2,h3,h4{break-after:avoid}tr,.verdict,.group{break-inside:avoid}thead{display:table-header-group}a{color:inherit;text-decoration:none}table{font-size:9px}td,th{padding:5px}.print-tip{display:none}.technical{break-before:page}}</style></head><body><main><header><p class="muted">EXADATA CLOUD@CUSTOMER · PLANNING REPORT</p><h1>${escape(title)}</h1>${projectIdentityHTML(state.project)}<p class="muted">Generated ${escape(date)} · Calculator ${escape(a.meta.calculatorVersion)} · Rules ${escape(a.meta.ruleVersion)} · Sources checked ${escape(a.meta.verifiedOn)}</p><p class="print-tip">This file is self-contained. Use your browser’s Print / Save as PDF for a discussion copy. Keep the scenario JSON to resume editing.</p></header><section id="executive-summary"><h2>Executive summary</h2><div class="verdict ${escape(a.status)}"><strong>${escape(a.headline)}</strong><p>These are allocation estimates for the entered plan. They do not confirm live OCI provisioning permission or application performance.</p></div><div class="stats"><div><strong>${a.totals.machines}</strong>Machines</div><div><strong>${a.totals.avmcs}</strong>AVMCs</div><div><strong>${a.totals.slots}</strong>Reserved ACD slots</div><div><strong>${a.totals.namedACDs}</strong>Named ACDs</div><div><strong>${a.totals.adbs}</strong>Named databases</div></div><table class="overview-table"><colgroup><col style="width:14%"><col style="width:18%"><col style="width:10%"><col style="width:10%"><col style="width:16%"><col style="width:32%"></colgroup><thead><tr><th>Site / machine</th><th>Hardware</th><th>AVMCs / ACD slots</th><th>Free local GB</th><th>Assessment</th><th>Next action</th></tr></thead><tbody>${resources}</tbody></table>${executiveIssues}</section>${alternatives?`<section><h2>Saved alternatives</h2><p class="muted">All alternatives below are recalculated with this report’s rules. They are not historical results or a price comparison.</p><table><thead><tr><th>Alternative</th><th>Purpose</th><th>Machines</th><th>AVMCs</th><th>ACD slots</th><th>Assessment</th></tr></thead><tbody>${alternatives}</tbody></table></section>`:''}<section><h2>Proposed database grouping</h2><p class="muted">The hierarchy reflects the entered design. Reserved slots are shown separately from named ACDs. A named inventory is not evidence of a live Data Guard configuration.</p>${topologyHTML(state)}</section><section class="technical" id="technical-appendix"><h2>Technical appendix</h2>${planNotes}${detailedIssues}${technical}<h3>Coverage</h3>${coverageTable(a.coverage)}<h3>Rules and sources</h3><p>${escape(a.meta.scope)}. Buffers are user-selected planning targets; they are not hardware capacity.</p>${ruleRows?`<table><thead><tr><th>Rule</th><th>Scope and method</th><th>Checked / evidence</th></tr></thead><tbody>${ruleRows}</tbody></table>`:''}${sourceNotes}<ul>${Object.entries(a.meta.sources).map(([name,url])=>`<li>${link(url,name)}</li>`).join('')}</ul></section><footer>Independent planning aid. No Oracle endorsement or deployment approval is implied. This report may contain customer-entered information; share it only with the intended audience.</footer></main></body></html>`;
 }
 return {assess,coverage,metadata,reportHTML,escape,fmt,coverageTable,issueHTML,humanStatus,limitingText};
});
