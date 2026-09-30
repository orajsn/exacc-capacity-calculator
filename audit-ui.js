'use strict';
const A = window.ExaAudit;
const auditFields = {'observed-memory':'observedMemory','observed-local':'observedLocal','reconcile-tolerance':'toleranceGB','candidate-cpu':'newCPU','candidate-ratio':'newRatio','candidate-slots':'newSlots'};

function memoryChecklist(c, i) {
 const rule = c.memoryRule || 'unknown';
 return `<div class="memory-rule" id="memory-checklist-${i}"><label>Memory formula<select data-memory-rule="${i}" aria-label="${escapeHTML(c.name)} memory formula">
  <option value="current" ${rule==='current'?'selected':''}>New AVMC or changed memory ratio</option>
  <option value="legacy" ${rule==='legacy'?'selected':''}>Older AVMC (complete the checks below)</option>
  <option value="unknown" ${rule==='unknown'?'selected':''}>Not sure (use the new formula)</option>
 </select></label>${rule==='legacy'?`<div class="legacy-checklist">
  <label class="check"><input type="checkbox" data-legacy="${i}" data-key="legacyCreatedBeforeCutoff" ${c.legacyCreatedBeforeCutoff?'checked':''}>Created before 22 September 2026</label>
  <label class="check"><input type="checkbox" data-legacy="${i}" data-key="legacyRatioUnchanged" ${c.legacyRatioUnchanged?'checked':''}>Memory per CPU unchanged since the formula rollout</label>
 </div>`:''}<p class="hint">${escapeHTML(M.memorySizing(c).label)}. Changing GB per ECPU switches to the new formula. For an AVMC created on 22 September 2026, confirm which formula applies in OCI.</p></div>`;
}

function renderAuditInputs() {
 const a=A.config(site());
 for(const [id,key] of Object.entries(auditFields)) $(id).value=a[key]===null?'':a[key];
}

function clearAudit() {
 for(const id of ['allocation-audit','reconciliation-results','candidate-results']) $(id).innerHTML='<p class="hint">Complete valid inputs to calculate.</p>';
}

function renderAudit(s,r) {
 try {
  const a=A.validate(s),show=value=>value===null?'Not entered':fmt(value);
  if(document.activeElement?.dataset?.observed===undefined) $('allocation-audit').innerHTML=`<div class="table-wrap"><table><thead><tr><th>AVMC</th><th>VMs / max ACDs</th><th>Memory formula</th><th>Estimated memory GB</th><th>Local storage estimate GB</th><th>Console memory GB</th><th>Console local GB</th></tr></thead><tbody>${s.clusters.map((c,i)=>`<tr><td>${escapeHTML(c.name)}</td><td>${c.nodes.length} / ${c.slots}</td><td>${r.costs[i].memorySizing.label}</td><td>${s.checkCompute?fmt(r.costs[i].memory):'Not checked'}</td><td>${fmt(r.costs[i].total)}</td><td><input type="number" min="0" step="0.1" data-observed="${i}" data-key="observedMemory" aria-label="${escapeHTML(c.name)} console memory GB" value="${c.observedMemory??''}"><small>${c.observedMemory==null||!s.checkCompute?'':`Difference: ${fmt(c.observedMemory-r.costs[i].memory)} GB`}</small></td><td><input type="number" min="0" step="0.1" data-observed="${i}" data-key="observedLocal" aria-label="${escapeHTML(c.name)} console local GB" value="${c.observedLocal??''}"><small>${c.observedLocal==null?'':`Difference: ${fmt(c.observedLocal-r.costs[i].total)} GB`}</small></td></tr>`).join('')}</tbody><tfoot><tr><th>AVMC estimates only</th><td colspan="2"></td><td>${s.checkCompute?fmt(r.costs.reduce((n,c)=>n+c.memory,0)):'Not checked'}</td><td>${fmt(r.used)}</td><td colspan="2">Console values are for comparison; they do not replace the estimates.</td></tr></tfoot></table></div>`;
  const totals=A.reconcile(s,r);
  $('reconciliation-results').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Resource</th><th>Calculated total, incl. other allocations</th><th>Console total</th><th>Difference in GB (console − estimate)</th><th>Check</th></tr></thead><tbody>${totals.map(t=>`<tr><td>${t.resource==='memory'?'Memory':'Local storage'} GB</td><td>${show(t.estimate)}</td><td>${show(t.observed)}</td><td>${show(t.delta)}</td><td>${t.status}</td></tr>`).join('')}</tbody></table></div><p class="hint">Allowed difference: ${a.toleranceGB} GB. Use values from the same console snapshot and include all other allocations. Matching totals alone do not prove the inventory is complete.</p>`;
  const candidate=A.candidate(s,r,M);
  $('candidate-results').innerHTML=`<p class="issues ${!s.checkCompute?'warning':candidate.fits?(candidate.verified?'fit':'warning'):'error'}"><strong>${candidate.status}.</strong> Per DB server: ${fmt(a.newCPU)} ECPUs · ${fmt(candidate.cost.memoryPerVM)} GB memory · ${fmt(candidate.cost.perVM)} GB local · 1 VM slot.</p><div class="table-wrap"><table><thead><tr><th>DB server</th><th>ECPUs to free</th><th>Memory GB to free</th><th>Local GB to free</th><th>VM slots to free</th></tr></thead><tbody>${candidate.rows.map(n=>`<tr><td>${n.id}</td><td>${n.cpuGap===null?'Not checked':fmt(n.cpuGap)}</td><td>${n.memoryGap===null?'Not checked':fmt(n.memoryGap)}</td><td>${fmt(n.localGap)}</td><td>${n.vmGap}</td></tr>`).join('')}</tbody></table></div><p class="hint">This checks all DB servers against available capacity. Your optional buffer does not block the result. Check shared storage, quotas, ACD CPU reservations and the console’s scale-down limits before provisioning or restarting.</p>`;
 } catch(error) {clearAudit();message(error.message);}
}

function initAudit() {
 for(const [id,key] of Object.entries(auditFields)) {
  const update=()=>safeUpdate(()=>{
  site().audit={...A.config(site()),[key]:$(id).value===''?(['observedMemory','observedLocal'].includes(key)?null:NaN):Number($(id).value)};
  A.validate(site());
 });
  $(id).addEventListener('input',update);
  $(id).addEventListener('change',update);
 }
 $('allocation-audit').oninput=event=>{
  const el=event.target;
  if(el.dataset.observed===undefined)return;
  safeUpdate(()=>{site().clusters[Number(el.dataset.observed)][el.dataset.key]=el.value===''?null:Number(el.value);});
 };
 $('allocation-audit').onchange=$('allocation-audit').oninput;
}
