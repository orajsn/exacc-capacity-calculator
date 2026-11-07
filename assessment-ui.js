'use strict';
function assessmentNoun(count,singular,plural=singular+'s'){return count===1?singular:plural;}
function currentAssessment(){return window.ExaAssessment.assess(state,M,P,window.ExaTopology,window.ExaRules,window.ExaConventional,window.ExaRequirements);}
function renderAssessment(){
 const summary=$('assessment-summary'),coverage=$('coverage-matrix');if(!summary||!coverage)return;
 try{
  const a=currentAssessment(),f=a.findings,targets=[],unchecked=[...f.notSelected,...f.externalChecks];
  const items=(list,empty)=>list.length?`<ul class="assessment-findings">${list.map(x=>{
   const i=x.target?targets.push(x.target)-1:-1;
   return `<li><span>${window.ExaAssessment.issueHTML(x)}</span>${i>=0?` <button type="button" class="finding-review" data-finding-target="${i}">Review input</button>`:''}</li>`;
  }).join('')}</ul>`:`<p class="hint">${escapeHTML(empty)}</p>`;
  summary.innerHTML=`<div class="assessment-verdict issues ${a.status==='error'?'error':'warning'}"><strong>${escapeHTML(a.headline)}</strong><p>Capacity fit is a planning result. Console reservations, recovery behavior and deployment permission still need confirmation.</p></div><div class="assessment-counts"><span><strong>${a.totals.machines}</strong> machines</span><span><strong>${a.totals.avmcs}</strong> AVMCs</span><span><strong>${a.totals.slots}</strong> reserved ACD slots</span><span><strong>${a.totals.namedACDs}</strong> named ACDs</span><span><strong>${a.totals.adbs}</strong> databases</span></div><p class="assessment-work-counts"><strong>${f.corrections.length}</strong> ${assessmentNoun(f.corrections.length,'correction')} · <strong>${f.missingInputs.length}</strong> missing ${assessmentNoun(f.missingInputs.length,'input')} · <strong>${f.advisories.length}</strong> ${assessmentNoun(f.advisories.length,'advisory','advisories')}. Unchecked areas are listed separately below.</p>${a.machines.map(m=>`<article class="assessment-machine"><h3>${escapeHTML(m.label)}</h3><p>${escapeHTML(m.nextAction)}</p>${m.limiting&&!m.nextAction.startsWith('Tightest checked resource:')?`<p class="hint">${escapeHTML(window.ExaAssessment.limitingText(m.limiting))}</p>`:''}<p class="hint">${m.findings.missingInputs.length} missing input${m.findings.missingInputs.length===1?'':'s'} for this machine.</p></article>`).join('')}<details ${f.corrections.length?'open':''}><summary>Corrections required (${f.corrections.length})</summary>${items(f.corrections,'No violations found in the enabled checks. Unchecked areas still apply.')}</details><details ${f.missingInputs.length?'open':''}><summary>Missing information (${f.missingInputs.length})</summary>${items(f.missingInputs,'No missing inputs recorded.')}</details><details ${f.advisories.length?'open':''}><summary>Advisory warnings (${f.advisories.length})</summary>${items(f.advisories,'No advisory warnings from the enabled checks.')}</details><details><summary>Not checked in this estimate (${unchecked.length})</summary><p class="hint">Some optional checks are not selected; other checks need evidence outside the planner. Entering or acknowledging a value does not establish Oracle approval.</p>${items(unchecked,'No additional checks recorded.')}</details><p class="hint">Rules ${escapeHTML(a.meta.ruleVersion)} · Sources checked ${escapeHTML(a.meta.verifiedOn)}. Download the report for figures, assumptions, topology and sources.</p>`;
  summary.querySelectorAll('button[data-finding-target]').forEach(button=>{button.onclick=()=>{
   const target=targets[Number(button.dataset.findingTarget)];
   if(target&&typeof window.goFindingTarget==='function')window.goFindingTarget(target);
  };});
  coverage.innerHTML=`<p class="hint">Supported means the listed calculation is implemented. It does not mean the whole deployment is approved.</p><div class="table-wrap"><table><thead><tr><th>Area</th><th>Coverage</th><th>Meaning</th></tr></thead><tbody>${a.coverage.map(r=>`<tr><td>${escapeHTML(r.label)}</td><td><span class="coverage-status" data-status="${r.status}">${escapeHTML(r.status.replace('-',' '))}</span></td><td>${escapeHTML(r.detail)}</td></tr>`).join('')}</tbody></table></div>`;
 }catch(e){summary.innerHTML=`<p class="issues error">Complete valid inputs to assess this plan: ${escapeHTML(e.message)}</p>`;coverage.innerHTML='';}
}
function initAssessment(){
 const button=$('export-report');if(!button)return;
 button.onclick=()=>{
  try{const html=window.ExaAssessment.reportHTML(state,M,P,window.ExaTopology,window.ExaRules,{conventional:window.ExaConventional,requirements:window.ExaRequirements});download('exacc-capacity-report.html',html,'text/html');message('Report download requested. Open the HTML file locally and use Print / Save as PDF. Keep the JSON file to resume editing.');}
  catch(e){message(`Could not create report: ${e.message}`);}
 };
}
