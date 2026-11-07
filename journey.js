'use strict';
let guideStep=1;
const guideTitles=['Machines','AVMCs & workloads','Compare options','Review & save'];
function planningIntent(s){return s.planningIntent||(s.clusters.some(c=>c.requirements)?'workload':'allocation');}
function hardwareReady(s){return planningIntent(s)==='allocation'||s.hardwareChosen!==false;}
function newPlanningMachine(name='Machine 1',intent='workload'){
 const s=M.newSite(name);s.siteName='';s.clusters=[];s.planningIntent=intent;s.hardwareChosen=intent==='allocation';return s;
}
function needsNewSizing(){if(planningIntent(site())==='workload')site().hardwareChosen=false;}
function goGuideStep(step){
 if(!Number.isInteger(step)||step<1||step>4)return;
 if(step!==3&&preview)cancelPreview();
 guideStep=step;refreshJourney();
 $('guide-step-1').scrollIntoView({behavior:'smooth',block:'start'});
 $('guide-heading').focus({preventScroll:true});
}
function refreshJourney(){
 const s=site(),intent=planningIntent(s),ready=hardwareReady(s);
 $('planning-intent').value=intent;
 $('guide-heading').textContent=guideTitles[guideStep-1];
 $('mode-workload').setAttribute('aria-pressed',String(intent==='workload'));
 $('mode-allocation').setAttribute('aria-pressed',String(intent==='allocation'));
 const instructions=intent==='workload'?[
  'Add one entry for each ExaC@C infrastructure you are sizing. Name the site and machine; hardware will be suggested in step 3.',
  'Add the planned AVMCs and maximum ACD slots. Enter workload ECPUs and RAM inside each AVMC. Mark any requirements that are still missing.',
  'Review the sizing assumptions, compare X11M DB-server options, then choose an option for this machine. Buffers are warnings, not mandatory limits.',
  'Review the selected machine and the all-machine summary. Save the JSON to continue later; use Print / PDF for a discussion copy.'
 ]:[
  'Add one entry for each ExaC@C infrastructure. Copy its hardware and any other allocations from the console or agreed specification.',
  'Add the AVMCs, maximum ACD slots and CPU/memory allocations. Use the existing console values or your proposed allocation.',
  'Compare AVMC layouts or check whether another AVMC will fit. Preview an option before applying it to this plan.',
  'Review the calculated capacity and warnings. Compare with console figures if available, then save the JSON.'
 ];
 $('guide-instruction').textContent=instructions[guideStep-1];
 $('guide-machine').textContent=`${s.siteName?`${s.siteName} / `:''}${s.name}`;
 $('guide-context').textContent=`Step ${guideStep} of 4 · ${state.sites.length} machine${state.sites.length===1?'':'s'} in this plan`;
 for(let i=1;i<=4;i++)$('guide-step-'+i).setAttribute('aria-current',i===guideStep?'step':'false');
 const panels={
  'panel-machine':guideStep===1,'panel-avmc':guideStep===2,'panel-before':guideStep===2&&ready,
  'panel-sizing':guideStep===3&&intent==='workload','panel-layouts':guideStep===3&&intent==='allocation',
  'panel-candidate':guideStep===3&&intent==='allocation','panel-resources':guideStep===4&&ready,
  'panel-capacity':guideStep===4&&ready,'panel-audit':guideStep===4&&ready,
  'panel-overview':guideStep===4,'panel-guidance':guideStep===4,'panel-sessions':guideStep===4&&ready,
  'panel-formulas':guideStep===4,'review-actions':guideStep===4
 };
 for(const [id,visible] of Object.entries(panels))$(id).hidden=!visible;
 $('hardware-fields').hidden=intent==='workload';
 $('other-allocations').hidden=intent==='workload';
 $('other-allocations-hint').hidden=intent==='workload';
 $('manual-compute-controls').hidden=intent==='workload';
 $('design-heading').textContent=intent==='workload'?'AVMCs and workload needs':'Edit AVMC allocations';
 $('draft-hardware-note').hidden=intent!=='workload';
 $('draft-hardware-note').textContent=ready?`Selected option: ${M.PROFILES[s.profile].label}, ${s.nodes.length} DB servers. You can compare other options in step 3.`:'Hardware is not selected yet. Add the workload needs in step 2, then compare hardware in step 3.';
 $('review-needs-hardware').hidden=guideStep!==4||ready;
 $('review-partial').hidden=guideStep!==4||!s.clusters.some(c=>c.requirements?.incomplete);
 $('sizing-path-note').hidden=intent!=='workload';
 $('guide-back').disabled=guideStep===1;
 $('guide-next').hidden=guideStep===4;
 $('guide-next').textContent=guideStep<4?`Next: ${guideTitles[guideStep]}`:'';
 $('dock-next').hidden=guideStep===4;
 $('dock-next').textContent=guideStep<4?`Next: ${['','AVMCs','Compare','Review'][guideStep]}`:'';
 $('dock-review').hidden=guideStep!==4;
 $('guide-footer-note').textContent=guideStep===4?'Save one JSON file for all machines. Keep the assumptions with your proposal.':'You can revisit any step. Values stay in this tab until you save JSON.';
 $('review-save').disabled=!!preview;
 $('review-add').textContent=active<state.sites.length-1?'Next machine':'Back to machines';
}
function initJourney(){
 for(let i=1;i<=4;i++)$('guide-step-'+i).onclick=()=>goGuideStep(i);
 $('guide-back').onclick=()=>goGuideStep(guideStep-1);
 $('guide-next').onclick=()=>goGuideStep(guideStep+1);
 $('guide-open').onclick=()=>$('import').click();
 $('dock-review').onclick=()=>goGuideStep(2);
 $('dock-next').onclick=()=>goGuideStep(guideStep+1);
 $('review-choose').onclick=()=>goGuideStep(3);
 $('review-save').onclick=()=>$('save').click();
 $('review-print').onclick=()=>$('print').click();
 $('review-add').onclick=()=>{if(active<state.sites.length-1){active++;guideStep=1;cancelPreview();render();}goGuideStep(1);};
 $('planning-intent').onchange=()=>safeUpdate(()=>{
  site().planningIntent=$('planning-intent').value;
  site().hardwareChosen=site().planningIntent==='allocation';
  clearSizingResults();cancelPreview();
 },true);
 for(const mode of ['workload','allocation'])$('mode-'+mode).onclick=()=>{
  if(planningIntent(site())===mode)return;
  $('planning-intent').value=mode;$('planning-intent').onchange();
 };
}
