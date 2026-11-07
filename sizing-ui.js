'use strict';
const S=window.ExaSizing;
let sizingResults=null;

function requirementFields(c,i){
 const q={unsizedACDs:0,minRatio:2,...c.requirements};
 return `<div class="workload-fields"><h4>Workload needs for this AVMC</h4><p class="hint">Enter totals across the workload, not ECPUs per VM. Allocations will be calculated in step 3.</p><div class="sizing-fields">${[['ecpu','Workload ECPUs (total)',0,100000],['ramGB','RAM needed (GB)',0,1000000],['unsizedACDs','ACDs without sized workloads',0,c.slots],['minRatio','Minimum GB/ECPU',2,5]].map(([key,label,min,max])=>`<label>${label}<input type="number" min="${min}" max="${max}" step="${key==='unsizedACDs'?'1':'0.5'}" data-requirement="${i}" data-key="${key}" value="${q[key]??''}" aria-label="${escapeHTML(c.name)} ${label}"></label>`).join('')}</div><label class="check"><input type="checkbox" data-incomplete="${i}" ${q.incomplete?'checked':''}>Some workload needs are still missing</label></div>`;
}
function renderSizing(){
 const p=S.config(site());
 for(const [id,key] of [['sizing-extra','extraCPUPercent'],['sizing-min','minNodes'],['sizing-max','maxNodes']])$(id).value=p[key];
 site().clusters.forEach((c,i)=>{const box=$('requirements-box-'+i);if(box)box.innerHTML=requirementFields(c,i);});
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
  safeUpdate(()=>{const c=site().clusters[Number(el.dataset.requirement)];c.requirements={ecpu:null,ramGB:null,unsizedACDs:0,minRatio:2,incomplete:false,...c.requirements};delete c.requirements.topologySignature;c.requirements[el.dataset.key]=el.value===''?null:Number(el.value);if(['ecpu','unsizedACDs'].includes(el.dataset.key))delete c.requirements.acdEcpus;S.validate(site());needsNewSizing();});
 };
 $('sizing-inputs').onchange=event=>{const el=event.target;if(el.dataset.incomplete===undefined)return;safeUpdate(()=>{const c=site().clusters[Number(el.dataset.incomplete)];c.requirements={ecpu:null,ramGB:null,unsizedACDs:0,minRatio:2,...c.requirements,incomplete:el.checked};});};
 $('suggest-sizing').onclick=runSizing;
 $('sizing-results').onclick=event=>{
  const b=event.target.closest('[data-size-profile]');if(!b)return;
  if(!sizingResults||sizingResults.active!==active||sizingResults.signature!==JSON.stringify(state)){clearSizingResults();message('Inputs changed. Compare machines again.');return;}
  const row=sizingResults.suggestion.rows.find(r=>r.profile===b.dataset.sizeProfile&&r.nodes===Number(b.dataset.sizeNodes));
  if(!row||!row.fit)return;
  const before=snapshot();state.sites[active]=row.candidate;site().hardwareChosen=true;rememberChange(before);clearSizingResults();cancelPreview();render();goGuideStep(4);message('Option selected for this machine. Review the capacity and assumptions, then save the JSON.');
 };
}
