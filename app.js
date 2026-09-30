'use strict';
const M=window.ExaCapacity,$=id=>document.getElementById(id),fmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:1});
let state={schema:'exacc-capacity/v1',sites:[M.newSite()]},active=0;
const site=()=>state.sites[active];
const fixedCapacity=new Set(['local','maxVMs','cpu','memory']);
const escapeHTML=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(text){$('message').textContent=text;$('message').hidden=!text;}
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function safeUpdate(fn, rerender = false) {
 const before = snapshot();
 try {
  fn();
  rememberChange(before);
  message('');
  if (rerender) render(); else results();
 } catch (e) {
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
function render(){const s=site();renderNavigation();$('site-name').value=s.name;$('location').value=s.siteName||'';$('profile').value=s.profile;$('node-count').value=s.nodes.length;$('buffer').value=s.bufferPercent;$('image').value=s.image;$('image').readOnly=s.profile!=='custom';$('allowance').value=s.allowance;$('compute').checked=s.checkCompute;
 const keys=['local','otherLocal','maxVMs','otherVMs','cpu','otherCPU','memory','otherMemory'];$('server-inputs').querySelector('tbody').innerHTML=s.nodes.map((n,i)=>`<tr><td>DB ${n.id}</td>${keys.map(k=>`<td><input aria-label="DB ${n.id} ${k}" type="number" min="0" step="${k.includes('VM')?'1':'0.5'}" value="${n[k]}" data-node="${i}" data-key="${k}" ${s.profile!=='custom'&&fixedCapacity.has(k)?'readonly aria-readonly="true" title="Fixed by the selected hardware shape"':''}></td>`).join('')}</tr>`).join('');
 renderClusterEditors(s);
 $('add-site').disabled=state.sites.length>=8;
 $('replacement-cpu').value='';
 $('replacement-ratio').value='';
 renderPlanning();renderAuditInputs();results();}
function overview() {
 $('overview').querySelector('tbody').innerHTML = state.sites.map((s, i) => {
  let r, summary;
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
function results(){overview();updateWorkflow();const s=site();let r;try{P.validate(s);r=M.calculate(s);}catch(e){message(e.message);$('results').innerHTML='<p class="issues error">Check the inputs to calculate this design.</p>';$('combinations').querySelector('tbody').innerHTML='';clearPlanning();clearAudit();clearResourceCards();return;}s.clusters.forEach((c,i)=>{const el=$('cost-'+i);if(el)el.innerHTML=`${fmt(r.costs[i].total)} <small>GB local · ${fmt(r.costs[i].perVM)} GB / VM</small>`;});
 const base=r.costs.reduce((a,c)=>a+c.base+c.allowance,0),slots=r.costs.reduce((a,c)=>a+c.slots,0),percent=n=>Math.max(0,100*n/Math.max(1,r.capacity));const label=r.errors.length?'Design exceeds a checked limit':r.warnings.length?'Fits local storage · review warnings':'Local storage fits';
 $('results').innerHTML=`<div class="summary-line"><h2 id="result-heading">${escapeHTML(s.siteName||'Unspecified site')} / ${escapeHTML(s.name)} · local storage</h2><span class="status ${r.status}">${label}</span></div><div class="metrics"><div class="metric"><span>Machine capacity</span><strong>${fmt(r.capacity)} GB</strong><small>${s.nodes.length} DB servers</small></div><div class="metric"><span>Allocated to AVMCs</span><strong>${fmt(r.used)} GB</strong><small>${s.clusters.length} AVMCs · ${r.slots} ACD slots</small></div><div class="metric"><span>Remaining local</span><strong class="${r.free<0?'negative':''}">${fmt(r.free)} GB</strong><small>After ${fmt(r.other)} GB other allocations</small></div><div class="metric"><span>Above / below buffer target</span><strong class="${r.free<0?'negative':r.afterBuffer<0?'buffer-warning':''}">${fmt(r.afterBuffer)} GB</strong><small>${s.bufferPercent}% buffer = ${fmt(r.buffer)} GB</small></div></div><div class="bar" role="img" aria-label="${fmt(r.used)} GB AVMC, ${fmt(r.other)} GB other allocations, ${fmt(r.free)} GB remaining"><span class="base-fill" style="width:${percent(base)}%"></span><span class="slot-fill" style="width:${percent(slots)}%"></span><span class="other-fill" style="width:${percent(r.other)}%"></span></div><div class="legend"><span><i class="base-fill"></i>AVMC base + allowance</span><span><i class="slot-fill"></i>ACD slots</span><span><i class="other-fill"></i>Other allocations</span><span><i class="free-fill"></i>Remaining</span></div>${r.errors.length||r.warnings.length?`<div class="issues ${r.errors.length?'error':''}"><ul>${[...r.errors,...r.warnings].map(x=>`<li>${escapeHTML(x)}</li>`).join('')}</ul></div>`:''}<h3>Capacity on each DB server</h3><div class="table-wrap"><table class="node-table"><thead><tr><th>DB server</th><th>Capacity GB</th><th>AVMC GB</th><th>Other GB</th><th>Free GB</th><th>VMs / limit</th>${s.checkCompute?'<th>ECPU used / capacity</th><th>Memory GB used / capacity</th>':''}</tr></thead><tbody>${r.nodes.map(n=>`<tr><td>DB ${n.id}</td><td>${fmt(n.local)}</td><td>${fmt(n.used)}</td><td>${fmt(n.otherLocal)}</td><td class="${n.free<0?'negative':''}">${fmt(n.free)}</td><td>${n.vms+n.otherVMs} / ${n.maxVMs}</td>${s.checkCompute?`<td>${fmt(n.cpuUsed+n.otherCPU)} / ${fmt(n.cpu)}</td><td>${fmt(n.memoryUsed+n.otherMemory)} / ${fmt(n.memory)}</td>`:''}</tr>`).join('')}</tbody></table></div><p class="hint">${s.checkCompute?'CPU and memory allocations are included. Database creation and workload performance still need separate checks.':'This section checks local storage. CPU, memory, shared database storage and workloads need separate checks.'}</p><details><summary>Local storage per AVMC</summary><div class="table-wrap"><table><thead><tr><th>AVMC</th><th>Servers</th><th>Base GB</th><th>ACD slots GB</th><th>Extra allowance GB</th><th>Total GB</th></tr></thead><tbody>${r.costs.map((c,i)=>`<tr><td>${escapeHTML(c.name)}</td><td>${s.clusters[i].nodes.join(', ')}</td><td>${fmt(c.base)}</td><td>${fmt(c.slots)}</td><td>${fmt(c.allowance)}</td><td>${fmt(c.total)}</td></tr>`).join('')}</tbody></table></div></details>`;
 planningResults(s,r);
 renderResourceCards(s,r);
 renderAudit(s,r);
 $('combinations').querySelector('tbody').innerHTML=M.combinations(s).map(row=>{
  const actions=!row.absolute?'<button class="apply" disabled>Cannot fit</button>'
   : `<button class="apply" data-apply="${row.avmcs}">${row.belowBuffer?'Preview · below buffer':'Preview option'}</button>${row.buffered&&row.absolute>row.buffered?`<button class="apply" data-apply="${row.avmcs}" data-full="true">Preview maximum</button>`:''}`;
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
  c[key]=value;
  if(key==='memoryPerCPU' && Number.isFinite(value)) {
   const checklist=$('memory-checklist-'+el.dataset.cluster);
   if(checklist)checklist.outerHTML=memoryChecklist(c,Number(el.dataset.cluster));
  }
 });
};
$('clusters').onchange = e => {
 const el=e.target;
 if(el.dataset.memoryRule!==undefined) safeUpdate(()=>{
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
$('clusters').onclick=e=>{const compute=e.target.closest('[data-compute-summary]');if(compute?.dataset.computeSummary!==undefined){e.preventDefault();toggleComputeEditor(Number(compute.dataset.computeSummary));return;}const summary=e.target.closest('[data-editor-summary]');if(summary?.dataset.editorSummary!==undefined){e.preventDefault();openClusterEditor(Number(summary.dataset.editorSummary),true);return;}const b=e.target.closest('[data-remove]');if(b)safeUpdate(()=>{site().clusters.splice(Number(b.dataset.remove),1);},true);};
$('add-cluster').onclick=()=>safeUpdate(()=>{if(site().clusters.length>=32)throw Error('At most 32 AVMCs can be modelled.');activeAVMCEditor=site().clusters.length;site().clusters.push({name:`AVMC ${site().clusters.length+1}`,slots:1,nodes:site().nodes.map(n=>n.id),cpu:40,memoryPerCPU:2,memoryRule:'current'});},true);
$('add-site').onclick=()=>safeUpdate(()=>{if(state.sites.length>=8)throw Error('Up to eight machines per scenario.');const next=M.newSite(`Machine ${state.sites.length+1}`);next.siteName=`Site ${state.sites.length+1}`;state.sites.push(next);active=state.sites.length-1;activeAVMCEditor=0;},true);
$('combinations').onclick = e => {
 const button = e.target.closest('[data-apply]');
 if (!button) return;
 try {
  showPreview(Number(button.dataset.apply), button.dataset.full === 'true');
 } catch (error) {
  message(error.message);
 }
};
$('save').onclick=()=>{try{state.sites.forEach(s=>{M.validate(s);P.validate(s);A.validate(s);});download('exacc-scenario.json',JSON.stringify({...state,calculatorVersion:M.VERSION},null,2),'application/json');savedSignature=JSON.stringify(state);savedLabel='JSON download requested · check your Downloads folder';updateWorkflow();message('JSON download requested: exacc-scenario.json. Check your browser Downloads or chosen folder. To resume later, use Open saved JSON. If you cancelled the download, save again before leaving; this page cannot confirm the file reached your laptop.');}catch(e){message(e.message);}};
$('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>250000)throw Error('Scenario file is too large (maximum 250 KB).');const next=M.importScenario(JSON.parse(await file.text()));next.sites.forEach(P.validate);next.sites.forEach(A.validate);const before=snapshot();state=next;active=0;activeAVMCEditor=0;rememberChange(before);savedSignature=JSON.stringify(state);savedLabel='Opened JSON · no new edits';cancelPreview();message('Resumed from your JSON file. Save scenario (.json) again after making changes to keep an updated copy on your laptop.');render();}catch(err){message(`Could not open scenario: ${err.message}`);}e.target.value='';};
$('print').onclick=()=>window.print();$('version').textContent=M.VERSION;$('checked').textContent=M.CHECKED;
$('sources').innerHTML=Object.entries({formula:'Oracle sizing formula',hardware:'Hardware capacities',limits:'ACD and AVMC limits',compute:'Compute management',vmc:'Conventional VMC scope'}).map(([key,label])=>`<a href="${M.SOURCES[key]}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`).join('');initPlanning();initAudit();initLayout();initWorkflow();render();
