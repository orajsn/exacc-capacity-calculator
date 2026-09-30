'use strict';
const A = window.ExaAudit;
const auditFields = {'observed-memory':'observedMemory','observed-local':'observedLocal','reconcile-tolerance':'toleranceGB','candidate-cpu':'newCPU','candidate-ratio':'newRatio','candidate-slots':'newSlots'};

function memoryChecklist(c, i) {
 const rule = c.memoryRule || 'unknown';
 return `<div class="memory-rule" id="memory-checklist-${i}"><label>Memory sizing rule<select data-memory-rule="${i}" aria-label="${escapeHTML(c.name)} memory sizing rule">
  <option value="current" ${rule==='current'?'selected':''}>Current · new or memory ratio changed</option>
  <option value="legacy" ${rule==='legacy'?'selected':''}>Existing legacy · complete checklist</option>
  <option value="unknown" ${rule==='unknown'?'selected':''}>History unconfirmed · current estimate</option>
 </select></label>${rule==='legacy'?`<div class="legacy-checklist">
  <label class="check"><input type="checkbox" data-legacy="${i}" data-key="legacyCreatedBeforeCutoff" ${c.legacyCreatedBeforeCutoff?'checked':''}>Created before 22 September 2026</label>
  <label class="check"><input type="checkbox" data-legacy="${i}" data-key="legacyRatioUnchanged" ${c.legacyRatioUnchanged?'checked':''}>Memory per CPU unchanged since the formula rollout</label>
 </div>`:''}<p class="hint">${escapeHTML(M.memorySizing(c).label)}. A proposed memory-ratio edit switches to the current formula. Creation on the cutoff date needs console confirmation.</p></div>`;
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
  if(document.activeElement?.dataset?.observed===undefined) $('allocation-audit').innerHTML=`<div class="table-wrap"><table><thead><tr><th>AVMC</th><th>VMs / max ACDs</th><th>Memory rule</th><th>Estimated memory GB</th><th>Estimated local GB</th><th>Console memory GB</th><th>Console local GB</th></tr></thead><tbody>${s.clusters.map((c,i)=>`<tr><td>${escapeHTML(c.name)}</td><td>${c.nodes.length} / ${c.slots}</td><td>${r.costs[i].memorySizing.label}</td><td>${s.checkCompute?fmt(r.costs[i].memory):'Not checked'}</td><td>${fmt(r.costs[i].total)}</td><td><input type="number" min="0" step="0.1" data-observed="${i}" data-key="observedMemory" aria-label="${escapeHTML(c.name)} console memory GB" value="${c.observedMemory??''}"><small>${c.observedMemory==null||!s.checkCompute?'':`Difference: ${fmt(c.observedMemory-r.costs[i].memory)} GB`}</small></td><td><input type="number" min="0" step="0.1" data-observed="${i}" data-key="observedLocal" aria-label="${escapeHTML(c.name)} console local GB" value="${c.observedLocal??''}"><small>${c.observedLocal==null?'':`Difference: ${fmt(c.observedLocal-r.costs[i].total)} GB`}</small></td></tr>`).join('')}</tbody><tfoot><tr><th>AVMC estimates only</th><td colspan="2"></td><td>${s.checkCompute?fmt(r.costs.reduce((n,c)=>n+c.memory,0)):'Not checked'}</td><td>${fmt(r.used)}</td><td colspan="2">Console values are observations, not model overrides.</td></tr></tfoot></table></div>`;
  const totals=A.reconcile(s,r);
  $('reconciliation-results').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Infrastructure allocation</th><th>Model incl. other reservations</th><th>Console total</th><th>Unexplained GB (console − model)</th><th>Check</th></tr></thead><tbody>${totals.map(t=>`<tr><td>${t.resource==='memory'?'Memory':'Local storage'} GB</td><td>${show(t.estimate)}</td><td>${show(t.observed)}</td><td>${show(t.delta)}</td><td>${t.status}</td></tr>`).join('')}</tbody></table></div><p class="hint">Tolerance: ${a.toleranceGB} GB, chosen by you. A numerical match does not verify inventory completeness. Compare allocated resources from the same console snapshot; include conventional VMCs and other reservations above.</p>`;
  const candidate=A.candidate(s,r,M);
  $('candidate-results').innerHTML=`<p class="issues ${candidate.fits?'':'error'}"><strong>${candidate.status}.</strong> Per DB server: ${fmt(a.newCPU)} ECPUs · ${fmt(candidate.cost.memoryPerVM)} GB memory · ${fmt(candidate.cost.perVM)} GB local · 1 VM slot.</p><div class="table-wrap"><table><thead><tr><th>DB server</th><th>ECPUs to free</th><th>Memory GB to free</th><th>Local GB to free</th><th>VM slots to free</th></tr></thead><tbody>${candidate.rows.map(n=>`<tr><td>${n.id}</td><td>${n.cpuGap===null?'Not checked':fmt(n.cpuGap)}</td><td>${n.memoryGap===null?'Not checked':fmt(n.memoryGap)}</td><td>${fmt(n.localGap)}</td><td>${n.vmGap}</td></tr>`).join('')}</tbody></table></div><p class="hint">All DB servers in this machine are selected. This checks physical capacity without your optional growth reserves. Shared Exadata storage, quotas, CPU reservations inside ACDs and console scale-down minima still need validation. A result is not approval to provision or restart.</p>`;
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
