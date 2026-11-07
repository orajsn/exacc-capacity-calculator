'use strict';
function currentAssessment(){return window.ExaAssessment.assess(state,M,P,window.ExaTopology,window.ExaRules,window.ExaConventional);}
function renderAssessment(){
 const summary=$('assessment-summary'),coverage=$('coverage-matrix');if(!summary||!coverage)return;
 try{
  const a=currentAssessment(),items=(list,empty)=>list.length?`<ul>${list.map(x=>`<li>${window.ExaAssessment.issueHTML(x)}</li>`).join('')}</ul>`:`<p class="hint">${empty}</p>`;
  summary.innerHTML=`<div class="assessment-verdict issues ${a.status==='error'?'error':'warning'}"><strong>${escapeHTML(a.headline)}</strong><p>Capacity fit is a planning result. Console reservations, recovery behavior and deployment permission still need confirmation.</p></div><div class="assessment-counts"><span><strong>${a.totals.machines}</strong> machines</span><span><strong>${a.totals.avmcs}</strong> AVMCs</span><span><strong>${a.totals.slots}</strong> reserved ACD slots</span><span><strong>${a.totals.namedACDs}</strong> named ACDs</span><span><strong>${a.totals.adbs}</strong> databases</span></div>${a.machines.map(m=>`<article class="assessment-machine"><h3>${escapeHTML(m.label)}</h3><p>${escapeHTML(m.nextAction)}</p>${m.limiting&&!m.nextAction.startsWith('Tightest checked resource:')?`<p class="hint">${escapeHTML(window.ExaAssessment.limitingText(m.limiting))}</p>`:''}</article>`).join('')}<details ${a.hardErrors.length?'open':''}><summary>Corrections required (${a.hardErrors.length})</summary>${items(a.hardErrors,'No violations found in the enabled checks. Open checks still apply.')}</details><details ${a.warnings.length?'open':''}><summary>Advisory warnings (${a.warnings.length})</summary>${items(a.warnings,'No advisory warnings from the enabled checks.')}</details><details><summary>Open checks (${a.unknowns.length})</summary>${items(a.unknowns,'No additional checks recorded.')}</details><p class="hint">Rules ${escapeHTML(a.meta.ruleVersion)} · Sources checked ${escapeHTML(a.meta.verifiedOn)}. Download the report for figures, assumptions, topology and sources.</p>`;
  coverage.innerHTML=`<p class="hint">Supported means the listed calculation is implemented. It does not mean the whole deployment is approved.</p><div class="table-wrap"><table><thead><tr><th>Area</th><th>Coverage</th><th>Meaning</th></tr></thead><tbody>${a.coverage.map(r=>`<tr><td>${escapeHTML(r.label)}</td><td><span class="coverage-status" data-status="${r.status}">${escapeHTML(r.status.replace('-',' '))}</span></td><td>${escapeHTML(r.detail)}</td></tr>`).join('')}</tbody></table></div>`;
 }catch(e){summary.innerHTML=`<p class="issues error">Complete valid inputs to assess this plan: ${escapeHTML(e.message)}</p>`;coverage.innerHTML='';}
}
function initAssessment(){
 const button=$('export-report');if(!button)return;
 button.onclick=()=>{
  try{const html=window.ExaAssessment.reportHTML(state,M,P,window.ExaTopology,window.ExaRules,{conventional:window.ExaConventional});download('exacc-capacity-report.html',html,'text/html');message('Report download requested. Open the HTML file locally and use Print / Save as PDF. Keep the JSON file to resume editing.');}
  catch(e){message(`Could not create report: ${e.message}`);}
 };
}
