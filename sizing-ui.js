'use strict';
const S=window.ExaSizing;
let sizingResults=null;

function renderSizing(){
 const p=S.config(site());
 for(const [id,key] of [['sizing-extra','extraCPUPercent'],['sizing-min','minNodes'],['sizing-max','maxNodes']])$(id).value=p[key];
 $('sizing-inputs').innerHTML=site().clusters.map((c,i)=>{
  const q={unsizedACDs:0,minRatio:2,...c.requirements};
  return `<fieldset class="sizing-request"><legend>${escapeHTML(c.name)}</legend><div class="sizing-fields">${[['ecpu','Workload ECPUs (total)',0,100000],['ramGB','RAM needed (GB)',0,1000000],['unsizedACDs','ACDs without sized workloads',0,c.slots],['minRatio','Minimum GB/ECPU',2,5]].map(([key,label,min,max])=>`<label>${label}<input type="number" min="${min}" max="${max}" step="${key==='unsizedACDs'?'1':'0.5'}" data-requirement="${i}" data-key="${key}" value="${q[key]??''}" aria-label="${escapeHTML(c.name)} ${label}"></label>`).join('')}</div><label class="check"><input type="checkbox" data-incomplete="${i}" ${q.incomplete?'checked':''}>Some workload needs are still missing</label></fieldset>`;
 }).join('')||'<p class="hint">Add AVMCs above, then enter their workload needs here.</p>';
}
function clearSizingResults(){sizingResults=null;$('sizing-results').innerHTML='';}
function runSizing(){
 try{
  S.validate(site(),true);const suggestion=S.suggest(site(),M,P);sizingResults={signature:JSON.stringify(state),active,suggestion};
  const selected=suggestion.rows.filter(r=>r.fit).slice(0,12);
  const describe=r=>r?`${M.PROFILES[r.profile].label}, ${r.nodes} DB servers`:'No fit in the searched range';
  $('sizing-results').innerHTML=`<p><strong>Smallest physical fit:</strong> ${describe(suggestion.minimum)}<br><strong>First option meeting buffer targets:</strong> ${describe(suggestion.withBuffers)}</p>${suggestion.incomplete?'<p class="issues warning">Known workloads only. Some needs are missing, so this is not a complete sizing recommendation.</p>':''}<p class="hint">Ranked by fewest DB servers, then the smaller memory tier. This is not a price comparison. Buffers remain optional targets.</p><div class="table-wrap"><table><thead><tr><th>DB-server option</th><th>ECPUs allocated</th><th>Memory allocated GB</th><th>Local allocated GB</th><th>Buffer targets</th><th></th></tr></thead><tbody>${selected.map(r=>`<tr><td>${M.PROFILES[r.profile].label} · ${r.nodes} servers</td><td>${fmt(r.cpu)}</td><td>${fmt(r.memory)}</td><td>${fmt(r.local)}</td><td>${r.meetsBuffers?'Met':'Below target · warning'}</td><td><button data-size-profile="${r.profile}" data-size-nodes="${r.nodes}">Use this option</button></td></tr>`).join('')}</tbody></table></div>${!selected.length?'<p class="issues error">No option fits the entered requirements. Review workload inputs, other allocations or the DB-server range.</p>':''}`;
 }catch(error){clearSizingResults();$('sizing-results').textContent=error.message;}
}
function initSizing(){
 for(const [id,key] of [['sizing-extra','extraCPUPercent'],['sizing-min','minNodes'],['sizing-max','maxNodes']])$(id).addEventListener('input',()=>safeUpdate(()=>{site().sizing={...S.config(site()),[key]:$(id).value===''?NaN:Number($(id).value)};S.validate(site());}));
 $('sizing-inputs').oninput=event=>{
  const el=event.target;if(el.dataset.requirement===undefined)return;
  safeUpdate(()=>{const c=site().clusters[Number(el.dataset.requirement)];c.requirements={ecpu:null,ramGB:null,unsizedACDs:0,minRatio:2,incomplete:false,...c.requirements};c.requirements[el.dataset.key]=el.value===''?null:Number(el.value);if(['ecpu','unsizedACDs'].includes(el.dataset.key))delete c.requirements.acdEcpus;S.validate(site());});
 };
 $('sizing-inputs').onchange=event=>{const el=event.target;if(el.dataset.incomplete===undefined)return;safeUpdate(()=>{const c=site().clusters[Number(el.dataset.incomplete)];c.requirements={ecpu:null,ramGB:null,unsizedACDs:0,minRatio:2,...c.requirements,incomplete:el.checked};});};
 $('suggest-sizing').onclick=runSizing;
 $('sizing-results').onclick=event=>{
  const b=event.target.closest('[data-size-profile]');if(!b)return;
  if(!sizingResults||sizingResults.active!==active||sizingResults.signature!==JSON.stringify(state)){clearSizingResults();message('Inputs changed. Compare machines again.');return;}
  const row=sizingResults.suggestion.rows.find(r=>r.profile===b.dataset.sizeProfile&&r.nodes===Number(b.dataset.sizeNodes));
  if(!row||!row.fit)return;
  const before=snapshot();state.sites[active]=row.candidate;rememberChange(before);clearSizingResults();cancelPreview();render();message('Hardware and AVMC allocations updated in this plan. Check the console before provisioning.');
 };
}
