'use strict';
const M=window.ExaCapacity,C=window.ExaConventional,F=window.ExaScenarios,R=window.ExaRules,$=id=>document.getElementById(id),fmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:1});
let state={schema:'exacc-capacity/v1',ruleSet:{version:R.VERSION,checked:R.CHECKED,scope:R.SCOPE},sites:[newPlanningMachine()]},active=0;
const site=()=>state.sites[active];
const fixedCapacity=new Set(['local','maxVMs','cpu','memory']);
const escapeHTML=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function validateMachines(sites){sites.forEach(s=>{M.validate(s);P.validate(s);A.validate(s);S.validate(s);C.validate(s);});T.validateState({sites});}
function validateWorkspace(value){validateMachines(value.sites);F.validateExtras(value,M,validateMachines);return value;}
function importWorkspace(raw){
 const next=F.preserveExtras(M.importScenario(raw),raw,M,validateMachines);T.ensureIds(next);L.ensureIdentity(next);validateWorkspace(next);return next;
}
function workspaceForDownload(){
 L.ensureIdentity(state);
 validateWorkspace(state);
 const payload={...state,calculatorVersion:M.VERSION,ruleSet:{version:R.VERSION,checked:R.CHECKED,scope:R.SCOPE}};
 if(new Blob([JSON.stringify(payload,null,2)]).size>10000000)throw Error('This plan exceeds the 10 MB JSON limit. Remove saved alternatives or split the plan before downloading.');
 return payload;
}
function message(text){$('message').textContent=text;$('message').hidden=!text;}
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function safeUpdate(fn, rerender = false) {
 const before = snapshot();
 try {
  fn();
  T.ensureIds(state);
  if(rerender)validateWorkspace(state);
  rememberChange(before);
  message('');
  if (rerender) render(); else results();
 } catch (e) {
  if(rerender){state=before.state;active=before.active;cancelPreview();render();message(e.message);return;}
  rememberChange(before);
  message(e.message);
  overview();
  $('results').innerHTML = '<p class="issues error">Check the inputs to calculate this design.</p>';
  $('combinations').querySelector('tbody').innerHTML = '';
  clearPlanning();
  clearAudit();
  clearResourceCards();
 }
}
function render(){T.ensureIds(state);L.ensureIdentity(state);const s=site();renderNavigation();$('site-name').value=s.name;$('location').value=s.siteName||'';$('profile').value=s.profile;$('node-count').value=s.nodes.length;$('buffer').value=s.bufferPercent;$('image').value=s.image;$('image').readOnly=s.profile!=='custom';$('allowance').value=s.allowance;$('compute').checked=s.checkCompute;
 const keys=['local','otherLocal','maxVMs','otherVMs','cpu','otherCPU','memory','otherMemory'];$('server-inputs').querySelector('tbody').innerHTML=s.nodes.map((n,i)=>`<tr><td>DB ${n.id}</td>${keys.map(k=>`<td><input aria-label="DB ${n.id} ${k}" type="number" min="0" step="${k.includes('VM')?'1':'0.5'}" value="${n[k]}" data-node="${i}" data-key="${k}" ${s.profile!=='custom'&&fixedCapacity.has(k)?'readonly aria-readonly="true" title="Fixed by the selected hardware shape"':''}></td>`).join('')}</tr>`).join('');
 renderClusterEditors(s);
 $('add-site').disabled=state.sites.length>=8;
 $('replacement-cpu').value='';
 $('replacement-ratio').value='';
 renderPlanning();renderAuditInputs();renderSizing();renderTopologyEditor();renderConventional();renderScenarios();renderWorkloadImport();results();refreshTour();}
function overview() {
 $('overview').querySelector('tbody').innerHTML = state.sites.map((s, i) => {
  let r, summary;
  if(!hardwareReady(s))return `<tr><td>${escapeHTML(s.siteName||'Unspecified')}</td><td>${escapeHTML(s.name)}</td><td>Not selected</td><td>${s.clusters.length} / ${s.clusters.reduce((n,c)=>n+c.slots,0)}</td><td>—</td><td>—</td><td>Choose hardware in step 3</td></tr>`;
  try {
   r = M.calculate(s);
   summary = P.summary(s, r);
  } catch (e) {
   return `<tr><td>${escapeHTML(s.siteName || 'Unspecified')}</td><td>${escapeHTML(s.name)}</td><td colspan="5">Complete valid machine inputs</td></tr>`;
  }
  return `<tr>
   <td>${escapeHTML(s.siteName || 'Unspecified')}</td>
   <td>${escapeHTML(s.name)}</td>
   <td>${escapeHTML(M.PROFILES[s.profile].label)}</td>
   <td>${s.clusters.length} / ${r.slots}</td>
   <td>${fmt(r.capacity)}</td>
   <td class="${r.free < 0 ? 'negative' : ''}">${fmt(r.free)}</td>
   <td class="${summary.status === 'error' ? 'negative' : ''}">${escapeHTML(summary.text)}</td>
  </tr>`;
 }).join('');
}
function results(){overview();updateWorkflow();renderWorkloadImport();if(!$('panel-scenarios').hidden)renderScenarioComparison();const s=site();let r;try{P.validate(s);r=M.calculate(s);}catch(e){message(e.message);$('results').innerHTML='<p class="issues error">Check the inputs to calculate this design.</p>';$('combinations').querySelector('tbody').innerHTML='';clearPlanning();clearAudit();clearResourceCards();return;}s.clusters.forEach((c,i)=>{const el=$('cost-'+i);if(el)el.innerHTML=hardwareReady(s)?`${fmt(r.costs[i].total)} <small>GB local · ${fmt(r.costs[i].perVM)} GB / VM</small>`:'<small>Choose hardware in step 3</small>';});
 const base=r.costs.reduce((a,c)=>a+c.base+c.allowance,0),slots=r.costs.reduce((a,c)=>a+c.slots,0),percent=n=>Math.max(0,100*n/Math.max(1,r.capacity));const label=r.errors.length?'Design exceeds a checked limit':r.warnings.length?'Fits local storage · review warnings':'Local storage fits';
 $('results').innerHTML=`<div class="summary-line"><h2 id="result-heading">${escapeHTML(s.siteName||'Unspecified site')} / ${escapeHTML(s.name)} · local storage</h2><span class="status ${r.status}">${label}</span></div><div class="metrics"><div class="metric"><span>Machine capacity</span><strong>${fmt(r.capacity)} GB</strong><small>${s.nodes.length} DB servers</small></div><div class="metric"><span>Allocated to AVMCs</span><strong>${fmt(r.used)} GB</strong><small>${s.clusters.length} AVMCs · ${r.slots} ACD slots</small></div><div class="metric"><span>Remaining local</span><strong class="${r.free<0?'negative':''}">${fmt(r.free)} GB</strong><small>After ${fmt(r.other)} GB other allocations</small></div><div class="metric"><span>Above / below buffer target</span><strong class="${r.free<0?'negative':r.afterBuffer<0?'buffer-warning':''}">${fmt(r.afterBuffer)} GB</strong><small>${s.bufferPercent}% buffer = ${fmt(r.buffer)} GB</small></div></div><div class="bar" role="img" aria-label="${fmt(r.used)} GB AVMC, ${fmt(r.other)} GB other allocations, ${fmt(r.free)} GB remaining"><span class="base-fill" style="width:${percent(base)}%"></span><span class="slot-fill" style="width:${percent(slots)}%"></span><span class="other-fill" style="width:${percent(r.other)}%"></span></div><div class="legend"><span><i class="base-fill"></i>AVMC base + allowance</span><span><i class="slot-fill"></i>ACD slots</span><span><i class="other-fill"></i>Other allocations</span><span><i class="free-fill"></i>Remaining</span></div>${r.errors.length||r.warnings.length?`<div class="issues ${r.errors.length?'error':''}"><ul>${[...r.errors,...r.warnings].map(x=>`<li>${escapeHTML(x)}</li>`).join('')}</ul></div>`:''}<h3>Capacity on each DB server</h3><div class="table-wrap"><table class="node-table"><thead><tr><th>DB server</th><th>Capacity GB</th><th>AVMC GB</th><th>Other GB</th><th>Free GB</th><th>VMs / limit</th>${s.checkCompute?'<th>ECPU used / capacity</th><th>Memory GB used / capacity</th>':''}</tr></thead><tbody>${r.nodes.map(n=>`<tr><td>DB ${n.id}</td><td>${fmt(n.local)}</td><td>${fmt(n.used)}</td><td>${fmt(n.otherLocal)}</td><td class="${n.free<0?'negative':''}">${fmt(n.free)}</td><td>${n.vms+n.otherVMs} / ${n.maxVMs}</td>${s.checkCompute?`<td>${fmt(n.cpuUsed+n.otherCPU)} / ${fmt(n.cpu)}</td><td>${fmt(n.memoryUsed+n.otherMemory)} / ${fmt(n.memory)}</td>`:''}</tr>`).join('')}</tbody></table></div><p class="hint">${s.checkCompute?'CPU and memory allocations are included. Database creation and workload performance still need separate checks.':'This section checks local storage. CPU, memory, shared database storage and workloads need separate checks.'}</p><details><summary>Local storage per AVMC</summary><div class="table-wrap"><table><thead><tr><th>AVMC</th><th>Servers</th><th>Base GB</th><th>ACD slots GB</th><th>Extra allowance GB</th><th>Total GB</th></tr></thead><tbody>${r.costs.map((c,i)=>`<tr><td>${escapeHTML(c.name)}</td><td>${s.clusters[i].nodes.join(', ')}</td><td>${fmt(c.base)}</td><td>${fmt(c.slots)}</td><td>${fmt(c.allowance)}</td><td>${fmt(c.total)}</td></tr>`).join('')}</tbody></table></div></details>`;
 planningResults(s,r);
 renderResourceCards(s,r);
 renderAudit(s,r);
 $('combinations').querySelector('tbody').innerHTML=M.combinations(s).map(row=>{
  const actions=!row.absolute?'<button class="apply" disabled>Cannot fit</button>'
   : `<button class="apply" data-apply="${row.avmcs}" aria-label="Preview layout with ${row.avmcs} AVMC${row.avmcs===1?'':'s'}">${row.belowBuffer?'Preview · below buffer':'Preview option'}</button>${row.buffered&&row.absolute>row.buffered?`<button class="apply" data-apply="${row.avmcs}" data-full="true" aria-label="Preview maximum ACD slots with ${row.avmcs} AVMC${row.avmcs===1?'':'s'}">Preview maximum</button>`:''}`;
  return `<tr><td>${row.avmcs}</td><td>${row.absolute||'Cannot fit'}</td><td>${row.buffered||(row.absolute?'Below target':'Cannot fit')}</td><td>${row.distribution.join(' + ')||'—'}</td><td>${row.free===null?'—':fmt(row.free)}</td><td class="layout-actions">${actions}${row.belowBuffer?'<small class="buffer-warning">Fits storage; below your buffer target.</small>':''}</td></tr>`;
 }).join('')||'<tr><td colspan="6">No free VM slots. Check existing VM allocations above.</td></tr>';
}
$('profile').innerHTML=Object.entries(M.PROFILES).map(([id,p])=>`<option value="${id}">${p.label}</option>`).join('');
for(const [id,key] of [['buffer','bufferPercent'],['image','image'],['allowance','allowance']])$(id).addEventListener('input',()=>safeUpdate(()=>{if(key==='image'&&site().profile!=='custom')return;site()[key]=$(id).value===''?NaN:Number($(id).value);}));
$('location').onchange=()=>safeUpdate(()=>{site().siteName=$('location').value;},true);
for(const [id,key] of [['location','siteName'],['site-name','name']]) $(id).addEventListener('input',()=>safeUpdate(()=>{site()[key]=$(id).value;}));
$('site-name').onchange=()=>safeUpdate(()=>{site().name=$('site-name').value;},true);
$('profile').onchange=()=>safeUpdate(()=>{const s=site(),p=M.PROFILES[$('profile').value];s.profile=$('profile').value;if(s.profile!=='custom'){s.image=p.image;s.nodes.forEach(n=>Object.assign(n,{local:p.local,memory:p.memory,cpu:p.cpu,maxVMs:p.vms}));}},true);
$('node-count').onchange = () => {
 try {
  const next = M.resizeNodes(site(), Number($('node-count').value));
  const before = snapshot();
  state.sites[active] = next;
  rememberChange(before);
  message('');
  render();
 } catch (e) {
  $('node-count').value = site().nodes.length;
  message(e.message);
 }
};
$('compute').onchange=()=>safeUpdate(()=>{site().checkCompute=$('compute').checked;},true);
$('server-inputs').oninput=e=>{const el=e.target;if(el.dataset.node!==undefined)safeUpdate(()=>{if(site().profile!=='custom'&&fixedCapacity.has(el.dataset.key))return;site().nodes[Number(el.dataset.node)][el.dataset.key]=el.value===''?NaN:Number(el.value);});};
$('clusters').oninput = e => {
 const el=e.target;
 if(el.dataset.cluster===undefined)return;
 safeUpdate(()=>{
  const c=site().clusters[Number(el.dataset.cluster)], key=el.dataset.key;
  const value=key==='name'?el.value:(el.value===''?NaN:Number(el.value));
  if(key==='memoryPerCPU' && Number.isFinite(value) && value!==c.memoryPerCPU) {
   c.memoryRule='current';c.legacyRatioUnchanged=false;
  }
  if(key==='slots'&&c.requirements&&value!==c.slots&&window.ExaRequirements.source(c)!=='database-inventory'){delete c.requirements.acdEcpus;c.requirements.unsizedACDs=Math.min(c.requirements.unsizedACDs||0,Number.isFinite(value)?value:c.slots);c.requirements.incomplete=true;}
  c[key]=value;
  if(key==='slots')needsNewSizing();
  if(key==='name'||(key==='slots'&&Number.isInteger(value)&&value>0))renderSizing();
  if(key==='memoryPerCPU' && Number.isFinite(value)) {
   const checklist=$('memory-checklist-'+el.dataset.cluster);
   if(checklist)checklist.outerHTML=memoryChecklist(c,Number(el.dataset.cluster));
  }
 });
};
$('clusters').onchange = e => {
 const el=e.target;
 if(el.dataset.allocationKind!==undefined)safeUpdate(()=>{site().clusters[Number(el.dataset.allocationKind)].allocationKind=el.value;},true);
 else if(el.dataset.memoryRule!==undefined) safeUpdate(()=>{
  site().clusters[Number(el.dataset.memoryRule)].memoryRule=el.value;
 },true);
 else if(el.dataset.legacy!==undefined) safeUpdate(()=>{
  site().clusters[Number(el.dataset.legacy)][el.dataset.key]=el.checked;
 },true);
 else if(el.dataset.placement!==undefined) safeUpdate(()=>{
  const c=site().clusters[Number(el.dataset.placement)],n=Number(el.dataset.server);
  c.nodes=el.checked?[...c.nodes,n].sort((a,b)=>a-b):c.nodes.filter(id=>id!==n);
 });
};
$('clusters').onclick=e=>{const workload=e.target.closest('[data-workload-summary]');if(workload?.dataset.workloadSummary!==undefined){e.preventDefault();toggleWorkloadEditor(Number(workload.dataset.workloadSummary));return;}const compute=e.target.closest('[data-compute-summary]');if(compute?.dataset.computeSummary!==undefined){e.preventDefault();toggleComputeEditor(Number(compute.dataset.computeSummary));return;}const summary=e.target.closest('[data-editor-summary]');if(summary?.dataset.editorSummary!==undefined){e.preventDefault();openClusterEditor(Number(summary.dataset.editorSummary),true);return;}const b=e.target.closest('[data-remove]');if(b)safeUpdate(()=>{site().clusters.splice(Number(b.dataset.remove),1);needsNewSizing();},true);};
$('add-cluster').onclick=()=>{guideStep=2;safeUpdate(()=>{if(site().clusters.length>=32)throw Error('At most 32 AVMCs can be modelled.');activeAVMCEditor=site().clusters.length;site().clusters.push({name:`AVMC ${site().clusters.length+1}`,slots:1,nodes:site().nodes.map(n=>n.id),cpu:40,memoryPerCPU:2,memoryRule:'current',allocationKind:'new'});needsNewSizing();},true);};
$('add-site').onclick=()=>safeUpdate(()=>{if(state.sites.length>=8)throw Error('Up to eight machines per scenario.');const next=newPlanningMachine(`Machine ${state.sites.length+1}`,planningIntent(site()));state.sites.push(next);active=state.sites.length-1;activeAVMCEditor=0;guideStep=1;},true);
$('combinations').onclick = e => {
 const button = e.target.closest('[data-apply]');
 if (!button) return;
 try {
  showPreview(Number(button.dataset.apply), button.dataset.full === 'true');
 } catch (error) {
  message(error.message);
 }
};
let jsonImportGeneration=0;
$('plan-menu').addEventListener('click',event=>{
 if(event.target.closest('button'))$('plan-menu').open=false;
});
$('plan-menu').addEventListener('keydown',event=>{
 if(event.key==='Escape'){$('plan-menu').open=false;$('plan-menu').querySelector('summary').focus();}
});
$('import').addEventListener('change',()=>{$('plan-menu').open=false;});
$('dock-toggle').onclick=()=>{
 const expanded=$('dock-toggle').getAttribute('aria-expanded')!=='true';
 $('local-dock').dataset.expanded=String(expanded);
 $('dock-toggle').setAttribute('aria-expanded',String(expanded));
 $('dock-toggle').textContent=expanded?'Less':'More';
};
// Reserve the rendered bar height, including wrapped controls and warning text.
// Short viewports put the bar in normal flow and need no fixed-bar clearance.
if(typeof ResizeObserver!=='undefined'){
 const dock=$('local-dock'),updateDockClearance=()=>{
  const height=getComputedStyle(dock).position==='fixed'?Math.ceil(dock.getBoundingClientRect().height):0;
  document.documentElement.style.setProperty('--dock-clearance',`${height}px`);
 };
 const dockObserver=new ResizeObserver(updateDockClearance);dockObserver.observe(dock);
 window.addEventListener('resize',updateDockClearance);
}
$('save').onclick=()=>{try{const payload=workspaceForDownload(),name=planFilename(payload);download(name,JSON.stringify(payload,null,2),'application/json');savedSignature=JSON.stringify(state);savedLabel='Backup download requested · check your Downloads folder';updateWorkflow();message(`Backup download requested: ${name}. It includes the Plan ID, customer, owner and all machines. Check Downloads; if you cancelled, save again.`);}catch(e){message(e.message);}};
$('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;const generation=++jsonImportGeneration;try{if(file.size>10000000)throw Error('Scenario file is too large (maximum 10 MB).');const raw=JSON.parse(await file.text());if(generation!==jsonImportGeneration)return;const hadID=!!raw.project?.id,next=importWorkspace(raw);requestPlanTransition(async()=>{activatePlan(next,{sourceKept:true,label:'Opened plan file · not automatically saved on this device'});message(hadID?'Opened the JSON plan. Save on this device to add or update its local copy.':'This older file had no Plan ID. A new ID was assigned; download a backup to keep it, or save on this device.');});}catch(err){if(generation===jsonImportGeneration)message(`Could not open scenario: ${err.message}`);}e.target.value='';};
$('print').onclick=()=>{goGuideStep(4);window.print();};$('version').textContent=M.VERSION;$('checked').textContent=M.CHECKED;
$('sources').innerHTML=Object.entries({formula:'Oracle sizing formula',hardware:'Hardware capacities',limits:'ACD and AVMC limits',compute:'Compute management',vmc:'Conventional VMC scope'}).map(([key,label])=>`<a href="${M.SOURCES[key]}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`).join('');T.ensureIds(state);L.ensureIdentity(state);initPlanning();initAudit();initLayout();initSizing();initJourney();initTopology();initConventional();initScenarios();initWorkloadImport();initAssessment();initDrafts();initWorkflow();render();initEntryPoints();
