'use strict';
function assessmentNoun(count,singular,plural=singular+'s'){return count===1?singular:plural;}
function currentAssessment(){return window.ExaAssessment.assess(state,M,P,window.ExaTopology,window.ExaRules,window.ExaConventional,window.ExaRequirements);}
function machineVerdict(machine) {
 if (!machine.result) {
  return machine.hardErrors[0]?.message || (machine.hardwareReady
   ? 'Add a VM cluster to check your layout.'
   : 'Choose hardware to check whether this layout fits.');
 }
 const limiting = machine.limiting;
 if (limiting?.deficit > 1e-7) {
  const where = limiting.nodeId === null ? 'This machine' : 'DB server ' + limiting.nodeId;
  if (limiting.resource === 'VM slots') return where + ' exceeds its VM limit by ' + fmt(limiting.deficit) + '.';
  return `${where} is short by ${fmt(limiting.deficit)} ${limiting.unit} of ${limiting.resource.toLowerCase()}.`;
 }
 if (machine.hardErrors.length) return machine.hardErrors[0].message;
 if (!machine.avmcs) return 'Add a VM cluster to check your layout.';
 if (machine.status === 'error') return 'Resolve the plan-wide findings before using this layout.';
 if (machine.status === 'incomplete') return 'Complete the missing allocations to check capacity.';
 const checks = machine.resources.map(row => ({
  'Memory estimate':'estimated memory', 'CPU':'CPU', 'Exadata storage (manual)':'entered shared storage'
 }[row.name] || row.name.toLowerCase()));
 if (checks.length === 1 && checks[0] === 'local storage') return 'There is enough local storage for this layout.';
 return 'This layout fits within the available capacity for ' + checks.join(', ') + '.';
}

function calculationTrace(machine, site) {
 if (!machine.result) return '';
 const limiting = machine.limiting;
 const equation = limiting && limiting.resource !== 'Local storage'
  ? `<p><strong>${escapeHTML(limiting.resource)} · ${limiting.nodeId===null?'whole machine':'DB server '+limiting.nodeId}</strong><br>Capacity ${fmt(limiting.capacity)} − allocated ${fmt(limiting.allocated)} = ${fmt(limiting.free)} ${limiting.unit} remaining.</p>`
  : '';
 const rows = machine.result.nodes.map(node=>{
  const charges = site.clusters.flatMap((cluster,i)=>cluster.nodes.includes(node.id)
   ? [escapeHTML(cluster.name)+' '+fmt(machine.result.costs[i].perVM)+' GB'] : []);
  return `<tr><th scope="row">DB ${node.id}</th><td>${fmt(node.local)}</td><td>${charges.join(' + ') || '0 GB'}</td><td>${fmt(node.otherLocal)}</td><td>${fmt(node.free)}</td></tr>`;
 }).join('');
 const {capacity, used, other, free} = machine.result;
 const allocationSteps = machine.result.costs.map((cost,i)=>{
  const cluster=site.clusters[i], placements=cluster.nodes.length;
  return `<li><strong>${escapeHTML(cluster.name)}</strong> · ${fmt(cost.base/placements)} GB fixed + ${fmt(cost.slots/placements)} GB for ${cluster.slots} reserved ACD ${assessmentNoun(cluster.slots,'slot')}${cost.allowance?' + '+fmt(cost.allowance/placements)+' GB extra':''} = ${fmt(cost.perVM)} GB on each selected server.</li>`;
 }).join('');
 return `<details class="result-trace"><summary>View calculation</summary><p><strong>Local storage across this machine</strong><br>${fmt(capacity)} GB capacity − ${fmt(used)} GB for AVMCs − ${fmt(other)} GB for other allocations = <strong>${fmt(free)} GB remaining</strong>.</p><div class="table-wrap" tabindex="0" role="region" aria-label="Local storage calculation by server"><table><caption>Local storage (GB) · capacity minus AVMCs and other allocations</caption><thead><tr><th>Server</th><th>Capacity</th><th>AVMC allocations</th><th>Other</th><th>Remaining</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th scope="row">Machine total</th><td>${fmt(machine.result.capacity)}</td><td>${fmt(machine.result.used)}</td><td>${fmt(machine.result.other)}</td><td>${fmt(machine.result.free)}</td></tr></tfoot></table></div>${allocationSteps?`<details><summary>How AVMC storage is calculated</summary><ul>${allocationSteps}</ul></details>`:''}${equation}<a href="${M.SOURCES.formula}" target="_blank" rel="noopener">Oracle AVMC sizing formula</a></details>`;
}

function decisionResult(assessment, index, site) {
 const machine=assessment.machines[index];
 const pending=[];
 if (!site.checkCompute) pending.push('CPU and memory allocations');
 if (!machine.resources.some(row=>row.unit==='TB')) pending.push('shared database storage');
 if (machine.findings.missingInputs.length) {
  const first=machine.findings.missingInputs[0];
  pending.push(first.message);
 }
 if (machine.warnings.length) pending.push(machine.warnings[0].message);
 if (machine.result?.warnings?.length && !pending.includes(machine.result.warnings[0])) pending.push(machine.result.warnings[0]);
 pending.push('console provisioning and recovery readiness');
 const other=assessment.machines.filter(m=>m.index!==index&&(m.hardErrors.length || m.status==='error' || m.status==='incomplete'));
 const limiting=machine.limiting&&machine.avmcs?window.ExaAssessment.limitingText(machine.limiting):'';
 const level=machine.hardErrors.length||machine.status==='error'?'error':machine.status==='incomplete'||!machine.avmcs||machine.warnings.length||machine.result?.warnings?.length?'warning':'fit';
 return `<article class="decision-result" data-level="${level}"><p class="decision-machine">${escapeHTML(machine.label)}</p><h3>${escapeHTML(machineVerdict(machine))}</h3>${machine.result?`<p class="decision-total"><strong>${fmt(machine.result.free)} GB</strong> local storage left across ${machine.nodeCount} DB servers</p>`:''}${limiting?`<p>${escapeHTML(limiting)}</p>`:''}<h4>Still to check</h4><ul class="checks-open">${pending.map(check=>`<li>${escapeHTML(check)}</li>`).join('')}</ul>${other.length?`<p class="issues warning">Also review ${other.map(m=>escapeHTML(m.label)).join(', ')} before using the whole plan.</p>`:''}${calculationTrace(machine,site)}</article>`;
}

function renderAssessment(showDecision=false){
 const summary=$('assessment-summary'),coverage=$('coverage-matrix');if(!summary||!coverage)return;
 try{
  const a=currentAssessment(),f=a.findings,targets=[],unchecked=[...f.notSelected,...f.externalChecks];
  if(showDecision){
   const result=$('decision-result'), traceOpen=result.querySelector('.result-trace')?.open;
   result.innerHTML=decisionResult(a,active,site());
   const trace=result.querySelector('.result-trace');
   if(trace&&traceOpen)trace.open=true;
  }
  const items=(list,empty)=>list.length?`<ul class="assessment-findings">${list.map(x=>{
   const i=x.target?targets.push(x.target)-1:-1;
   return `<li><span>${window.ExaAssessment.issueHTML(x)}</span>${i>=0?` <button type="button" class="finding-review" data-finding-target="${i}">Review input</button>`:''}</li>`;
  }).join('')}</ul>`:`<p class="hint">${escapeHTML(empty)}</p>`;
  summary.innerHTML=`<div class="assessment-verdict issues ${a.status==='error'?'error':a.status==='partial'?'':'warning'}"><strong>${escapeHTML(a.headline)}</strong><p>Capacity fit is a planning result. Console reservations, recovery behavior and deployment permission still need confirmation.</p></div><div class="assessment-counts"><span><strong>${a.totals.machines}</strong> machines</span><span><strong>${a.totals.avmcs}</strong> AVMCs</span><span><strong>${a.totals.slots}</strong> reserved ACD slots</span><span><strong>${a.totals.namedACDs}</strong> named ACDs</span><span><strong>${a.totals.adbs}</strong> databases</span></div><p class="assessment-work-counts"><strong>${f.corrections.length}</strong> ${assessmentNoun(f.corrections.length,'correction')} · <strong>${f.missingInputs.length}</strong> missing ${assessmentNoun(f.missingInputs.length,'input')} · <strong>${f.advisories.length}</strong> ${assessmentNoun(f.advisories.length,'advisory','advisories')}. Unchecked areas are listed separately below.</p>${a.machines.map(m=>`<article class="assessment-machine"><h3>${escapeHTML(m.label)}</h3><p>${escapeHTML(m.nextAction)}</p>${m.limiting&&!m.nextAction.startsWith('Tightest checked resource:')?`<p class="hint">${escapeHTML(window.ExaAssessment.limitingText(m.limiting))}</p>`:''}<p class="hint">${m.findings.missingInputs.length} missing input${m.findings.missingInputs.length===1?'':'s'} for this machine.</p></article>`).join('')}<details ${f.corrections.length?'open':''}><summary>Corrections required (${f.corrections.length})</summary>${items(f.corrections,'No violations found in the enabled checks. Unchecked areas still apply.')}</details><details ${f.missingInputs.length?'open':''}><summary>Missing information (${f.missingInputs.length})</summary>${items(f.missingInputs,'No missing inputs recorded.')}</details><details ${f.advisories.length?'open':''}><summary>Advisory warnings (${f.advisories.length})</summary>${items(f.advisories,'No advisory warnings from the enabled checks.')}</details><details><summary>Not checked in this estimate (${unchecked.length})</summary><p class="hint">Some optional checks are not selected; other checks need evidence outside the planner. Entering or acknowledging a value does not establish Oracle approval.</p>${items(unchecked,'No additional checks recorded.')}</details><p class="hint">Rules ${escapeHTML(a.meta.ruleVersion)} · Sources checked ${escapeHTML(a.meta.verifiedOn)}. Download the report for figures, assumptions, topology and sources.</p>`;
  summary.querySelectorAll('button[data-finding-target]').forEach(button=>{button.onclick=()=>{
   const target=targets[Number(button.dataset.findingTarget)];
   if(target&&typeof window.goFindingTarget==='function')window.goFindingTarget(target);
  };});
  coverage.innerHTML=`<p class="hint">Supported means the listed calculation is implemented. It does not mean the whole deployment is approved.</p><div class="table-wrap"><table><thead><tr><th>Area</th><th>Coverage</th><th>Meaning</th></tr></thead><tbody>${a.coverage.map(r=>`<tr><td>${escapeHTML(r.label)}</td><td><span class="coverage-status" data-status="${r.status}">${escapeHTML(r.status.replace('-',' '))}</span></td><td>${escapeHTML(r.detail)}</td></tr>`).join('')}</tbody></table></div>`;
 }catch(e){$('decision-result').textContent='Correct the input errors to calculate this result.';summary.innerHTML=`<p class="issues error">Complete valid inputs to assess this plan: ${escapeHTML(e.message)}</p>`;coverage.innerHTML='';}
}
function initAssessment(){
 const button=$('export-report');if(!button)return;
 button.onclick=()=>{
  try{const html=window.ExaAssessment.reportHTML(state,M,P,window.ExaTopology,window.ExaRules,{conventional:window.ExaConventional,requirements:window.ExaRequirements});download('exacc-capacity-report.html',html,'text/html');message('Report download requested. Open the HTML file locally and use Print / Save as PDF. Keep the JSON file to resume editing.');}
  catch(e){message(`Could not create report: ${e.message}`);}
 };
}
