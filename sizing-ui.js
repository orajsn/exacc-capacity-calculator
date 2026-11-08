'use strict';
const S=window.ExaSizing;
const Q=window.ExaRequirements;
let sizingResults=null;
let sizingSourcePreview=null;

function requirementFields(c,i,known=false){
 const q={unsizedACDs:0,minRatio:2,...c.requirements},inventory=Q.source(c)==='database-inventory';
 return `<div class="workload-fields"><h4>Workload needs for this AVMC</h4><label>Sizing source<select data-requirement-source="${i}" aria-label="${escapeHTML(c.name)} sizing source"><option value="manual" ${!inventory?'selected':''}>Manual totals</option><option value="database-inventory" ${inventory?'selected':''}>Database inventory</option></select></label><div id="requirement-source-status-${i}" class="requirement-source-status" aria-live="polite">${requirementSourceStatus(c,i)}</div><p class="hint">${inventory?'Applied database totals are read-only here. Review the inventory again to update them.':'Enter totals across the workload, not ECPUs per VM. Manual totals stay independent of the database rows.'} ${known?'These are workload needs; editing them does not resize AVMC allocations. Choose workload sizing under Machine for hardware suggestions.':'Allocations will be calculated in Compare.'}</p><div class="sizing-fields">${[['ecpu','Workload ECPUs (total)',0,100000],['ramGB','RAM needed (GB)',0,1000000],['unsizedACDs','ACDs without sized workloads',0,c.slots],['minRatio','Minimum GB/ECPU',2,5]].map(([key,label,min,max])=>`<label>${label}<input type="number" min="${min}" max="${max}" step="${key==='unsizedACDs'?'1':'0.5'}" data-requirement="${i}" data-key="${key}" value="${q[key]??''}" ${inventory&&key!=='minRatio'?'readonly aria-readonly="true"':''} aria-label="${escapeHTML(c.name)} ${label}"></label>`).join('')}</div><label class="check"><input type="checkbox" data-incomplete="${i}" ${(inventory?q.userIncomplete:q.incomplete)?'checked':''}>${inventory?'Additional workload needs are missing beyond these database rows':'Some workload needs are still missing'}</label></div>`;
}
function requirementSourceStatus(c,i){
 const review=Q.status(c),inventory=review.source==='database-inventory';
 const note=inventory?review.stale?'Inventory sizing needs review · check totals and per-ACD CPU details before comparing hardware.':'Inventory totals applied · CPU/RAM inputs match.':'Manual totals selected.';
 const missing=review.inventory.requirements.incomplete?`<p class="hint">Inventory CPU/RAM is incomplete: ${review.missing.ecpu} missing ECPU value${review.missing.ecpu===1?'':'s'}, ${review.missing.ramGB} missing RAM value${review.missing.ramGB===1?'':'s'}${!review.inventory.counts.databases?'; no database rows':''}.</p>`:'';
 return `<p class="${review.stale?'buffer-warning':'hint'}"><strong>${note}</strong></p>${missing}<button type="button" data-review-inventory="${i}" ${review.canApply?'':'disabled'}>${inventory?'Review inventory totals':'Preview database totals'}</button>`;
}
function clearSourcePreview(){sizingSourcePreview=null;const box=$('sizing-source-preview');if(box){box.hidden=true;box.innerHTML='';}}
function renderRequirementSources(){
 if(sizingSourcePreview&&!Q.previewIsCurrent(sizingSourcePreview,state,active))clearSourcePreview();
 site().clusters.forEach((c,i)=>{const box=$('requirement-source-status-'+i);if(box)box.innerHTML=requirementSourceStatus(c,i);});
}
function previewInventorySizing(index){
 try{
  const c=site().clusters[index];sizingSourcePreview=Q.createPreview(state,active,index);
  const review=Q.status(c),box=$('sizing-source-preview'),inventory=review.inventory;
  if(!box)throw Error('The sizing review panel is unavailable. Reload this page.');
  const value=n=>n===null?'Not entered':fmt(n),delta=n=>n===null?'—':`${n>0?'+':''}${fmt(n)}`;
  const rows=[['ecpu','Workload ECPUs'],['ramGB','RAM needed (GB)'],['unsizedACDs','ACDs without sized workloads']];
  box.innerHTML=`<h3 tabindex="-1" id="sizing-source-heading">Review database totals · ${escapeHTML(c.name)}</h3><p class="hint">${escapeHTML(site().siteName||'Site not named')} / ${escapeHTML(site().name)} · ${inventory.counts.databases} database row${inventory.counts.databases===1?'':'s'} in ${inventory.counts.namedACDs} named ACD${inventory.counts.namedACDs===1?'':'s'} / ${c.slots} reserved slot${c.slots===1?'':'s'}.</p><div class="table-wrap"><table><thead><tr><th>Workload</th><th>${review.source==='database-inventory'?'Previously applied':'Current manual totals'}</th><th>Current inventory</th><th>Change</th></tr></thead><tbody>${rows.map(([key,label])=>`<tr><td>${label}</td><td>${value(review.applied[key])}</td><td>${fmt(inventory.requirements[key])}</td><td>${delta(review.delta[key])}</td></tr>`).join('')}</tbody></table></div>${inventory.requirements.incomplete?`<p class="issues warning">These are known values only. ${inventory.missing.ecpu} ECPU value${inventory.missing.ecpu===1?' is':'s are'} missing; ${inventory.missing.ramGB} RAM value${inventory.missing.ramGB===1?' is':'s are'} missing.${!inventory.counts.databases?' No database rows are entered.':''} Applying keeps this AVMC marked incomplete; blank inputs are not confirmed zeros.</p>`:''}<p class="hint">Minimum ${sizingSourcePreview.requirements.minRatio} GB/ECPU and your additional missing-workload flag are retained. ${review.source==='manual'?'Your manual totals are saved separately and restored if you choose Manual totals again. ':''}Database storage is separate from CPU/RAM sizing${inventory.missing.storageTB?`; ${inventory.missing.storageTB} storage value${inventory.missing.storageTB===1?' is':'s are'} missing`:''}.</p><p class="hint">${planningIntent(site())==='allocation'?'Applying saves workload totals only. It does not change the known-hardware mode, hardware choice, existing AVMC allocations or shared-storage allocation.':'Applying replaces this AVMC’s sizing inputs. Compare hardware in Compare again to calculate allocations.'} Peer copies are sized on their own machines.</p><div class="actions"><button type="button" id="apply-inventory-totals" class="primary">Apply database totals</button><button type="button" id="cancel-inventory-totals">Cancel</button></div>`;
  box.hidden=false;goGuideStep(2);box.scrollIntoView({behavior:'smooth',block:'center'});$('sizing-source-heading').focus({preventScroll:true});
  $('cancel-inventory-totals').onclick=clearSourcePreview;
  $('apply-inventory-totals').onclick=()=>{
   if(!Q.previewIsCurrent(sizingSourcePreview,state,active)){clearSourcePreview();message('Inputs or the active machine changed. Review the database totals again before applying.');return;}
   const candidate=sizingSourcePreview,allocationMode=planningIntent(site())==='allocation';
   try{
    const next=structuredClone(state);next.sites[active].clusters[candidate.clusterIndex].requirements=structuredClone(candidate.requirements);validateWorkspace(next);
    safeUpdate(()=>{site().clusters[candidate.clusterIndex].requirements=structuredClone(candidate.requirements);if(allocationMode)openWorkloadEditors.add(candidate.clusterIndex);else needsNewSizing();clearSourcePreview();},true);
    openClusterEditor(candidate.clusterIndex,false,true);
    $('requirements-box-'+candidate.clusterIndex)?.querySelector('[data-requirement-source]')?.focus({preventScroll:true});
    message(allocationMode?'Database totals applied to workload requirements. Known hardware and AVMC allocations are unchanged.':'Database totals applied. Missing CPU/RAM values remain flagged. Compare hardware again in Compare.');
   }catch(error){message(error.message);}
  };
 }catch(error){clearSourcePreview();message(error.message);}
}
function renderSizing(){
 const p=S.config(site());
 for(const [id,key] of [['sizing-extra','extraCPUPercent'],['sizing-min','minNodes'],['sizing-max','maxNodes']])$(id).value=p[key];
 site().clusters.forEach((c,i)=>{const box=$('requirements-box-'+i);if(box)box.innerHTML=requirementFields(c,i,planningIntent(site())==='allocation');});
 renderRequirementSources();
}
function clearSizingResults(){sizingResults=null;$('sizing-results').innerHTML='';}
function runSizing(){
 goGuideStep(3);
 cancelPreview();
 try{
  S.validate(site(),true);const suggestion=S.suggest(site(),M,P);sizingResults={signature:JSON.stringify(state),active,suggestion};
  const selected=suggestion.rows.filter(r=>r.fit).slice(0,12);
  const describe=r=>r?`${M.PROFILES[r.profile].label}, ${r.nodes} DB servers`:'No fit in the searched range';
  const adjustments=suggestion.minimum?.adjustments||[];
  const adjustmentHTML=adjustments.length?`<div class="adjustment-note"><strong>Additional database CPU allocations are proposed to meet RAM needs.</strong><ul>${adjustments.map(a=>`<li>${escapeHTML(a.name)}: ${fmt(a.requestedWorkloadECPU)} entered ECPUs → ${fmt(a.plannedWorkloadECPU)} proposed database ECPUs at ${a.memoryPerCPU} GB/ECPU. Validate the allocation for each ADB; spare AVMC CPU alone does not provide this memory.</li>`).join('')}</ul></div>`:'';
  const rejected=[...new Set(suggestion.rows.filter(r=>!r.fit).flatMap(r=>r.reason?[r.reason]:r.result?.errors||[]))];
  const rejectionsHTML=rejected.length?`<details><summary>Why some options do not fit</summary><ul>${rejected.slice(0,8).map(note=>`<li>${escapeHTML(note)}</li>`).join('')}</ul><p class="hint">These are examples across the searched shapes and server counts. Selected options above fit the capacity checks only.</p></details>`:'';
  $('sizing-results').innerHTML=`<p><strong>Smallest physical fit:</strong> ${describe(suggestion.minimum)}<br><strong>First option meeting buffer targets:</strong> ${describe(suggestion.withBuffers)}</p>${adjustmentHTML}${suggestion.incomplete?'<p class="issues warning">Known workloads only. Some needs are missing, so this is not a complete sizing recommendation.</p>':''}<p class="hint">Ranked by fewest DB servers, then the smaller memory tier. This is not a price comparison. Buffers remain optional targets.</p><div class="table-wrap"><table><thead><tr><th>DB-server option</th><th>ECPUs allocated</th><th>Memory allocated GB</th><th>Local allocated GB</th><th>Buffer targets</th><th></th></tr></thead><tbody>${selected.map(r=>`<tr><td>${M.PROFILES[r.profile].label} · ${r.nodes} servers</td><td>${fmt(r.cpu)}</td><td>${fmt(r.memory)}</td><td>${fmt(r.local)}</td><td>${r.meetsBuffers?'Met':'Below target · warning'}${r.requiresDatabaseCPUReview?'<br><small class="buffer-warning">Database CPU increase proposed</small>':''}</td><td><button data-size-profile="${r.profile}" data-size-nodes="${r.nodes}">Use this option</button></td></tr>`).join('')}</tbody></table></div>${rejectionsHTML}${!selected.length?'<p class="issues error">No option fits the entered requirements. Review workload inputs, other allocations or the DB-server range.</p>':''}`;
 }catch(error){clearSizingResults();$('sizing-results').textContent=error.message;}
 $('sizing-results').scrollIntoView({behavior:'smooth',block:'start'});
 $('sizing-results').focus({preventScroll:true});
}
function initSizing(){
 for(const [id,key] of [['sizing-extra','extraCPUPercent'],['sizing-min','minNodes'],['sizing-max','maxNodes']])$(id).addEventListener('input',()=>safeUpdate(()=>{site().sizing={...S.config(site()),[key]:$(id).value===''?NaN:Number($(id).value)};S.validate(site());needsNewSizing();}));
 $('sizing-inputs').oninput=event=>{
  const el=event.target;if(el.dataset.requirement===undefined)return;
  safeUpdate(()=>{const c=site().clusters[Number(el.dataset.requirement)],inventory=Q.source(c)==='database-inventory';if(inventory&&el.dataset.key!=='minRatio')return;c.requirements={ecpu:null,ramGB:null,unsizedACDs:0,minRatio:2,incomplete:false,...c.requirements,source:inventory?'database-inventory':'manual'};c.requirements[el.dataset.key]=el.value===''?null:Number(el.value);if(!inventory&&['ecpu','unsizedACDs'].includes(el.dataset.key))delete c.requirements.acdEcpus;S.validate(site());needsNewSizing();});
 };
 $('sizing-inputs').onchange=event=>{
  const el=event.target;
  if(el.dataset.requirementSource!==undefined){
   const i=Number(el.dataset.requirementSource),c=site().clusters[i];
   if(el.value==='database-inventory'){el.value=Q.source(c);previewInventorySizing(i);return;}
   safeUpdate(()=>{c.requirements=Q.useManual(c);needsNewSizing();clearSourcePreview();},true);
   $('requirements-box-'+i)?.querySelector('[data-requirement-source]')?.focus({preventScroll:true});
   message('Manual totals selected. Database rows no longer update or invalidate these workload totals.');return;
  }
  if(el.dataset.incomplete===undefined)return;
  safeUpdate(()=>{const c=site().clusters[Number(el.dataset.incomplete)],inventory=Q.source(c)==='database-inventory';c.requirements={ecpu:null,ramGB:null,unsizedACDs:0,minRatio:2,...c.requirements,incomplete:el.checked};if(inventory){c.requirements.userIncomplete=el.checked;c.requirements.incomplete=el.checked||Q.status(c).inventory.requirements.incomplete;}});
 };
 $('sizing-inputs').addEventListener('click',event=>{const button=event.target.closest('[data-review-inventory]');if(button)previewInventorySizing(Number(button.dataset.reviewInventory));});
 $('suggest-sizing').onclick=runSizing;
 $('sizing-results').onclick=event=>{
  const b=event.target.closest('[data-size-profile]');if(!b)return;
  if(!sizingResults||sizingResults.active!==active||sizingResults.signature!==JSON.stringify(state)){clearSizingResults();message('Inputs changed. Compare machines again.');return;}
  const row=sizingResults.suggestion.rows.find(r=>r.profile===b.dataset.sizeProfile&&r.nodes===Number(b.dataset.sizeNodes));
  if(!row||!row.fit)return;
  const before=snapshot();state.sites[active]=row.candidate;site().hardwareChosen=true;rememberChange(before);clearSizingResults();cancelPreview();render();goGuideStep(4);message('Option selected for this machine. Review the capacity and assumptions, then save the JSON.');
 };
}
