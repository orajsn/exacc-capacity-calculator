'use strict';
let guideStep=1;
const guideTitles=['Machine','Allocations','Compare','Review'];
let startingHardware=null;
function markStartingHardware(machine){startingHardware=machine?{uid:machine.uid,profile:machine.profile,nodes:machine.nodes.length}:null;}
function planningIntent(s){return s.planningIntent||(s.clusters.some(c=>c.requirements)?'workload':'allocation');}
function hardwareReady(s){return planningIntent(s)==='allocation'||s.hardwareChosen!==false;}
function newPlanningMachine(name='Machine 1',intent='workload'){
 const s=M.newSite(name);s.siteName='';s.clusters=[];s.planningIntent=intent;s.hardwareChosen=intent==='allocation';return s;
}
function needsNewSizing(){site().clusters.forEach(c=>delete c.sizingDetail);if(planningIntent(site())==='workload')site().hardwareChosen=false;}
function goGuideStep(step){
 if(!Number.isInteger(step)||step<1||step>4)return;
 if(step!==3&&preview)cancelPreview();
 if(step!==2&&typeof clearSourcePreview==='function')clearSourcePreview();
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
  'Name the machine and site; hardware can be sized from its workloads.',
  'Add AVMCs, reserved ACD slots and workload CPU/RAM needs.',
  'Compare hardware options and review sizing assumptions.',
  'Review capacity and open checks, then save the plan.'
 ]:[
  'Set hardware and other allocations from the console or agreed specification.',
  'Edit AVMC allocations and see their effect on remaining capacity.',
  'Compare layouts or check whether another AVMC will fit.',
  'Review capacity and open checks, then save the plan.'
 ];
 $('guide-instruction').textContent=instructions[guideStep-1];
 $('guide-machine').textContent=`${s.siteName?`${s.siteName} / `:''}${s.name}`;
 $('guide-context').textContent=`${state.sites.length} machine${state.sites.length===1?'':'s'} in this plan`;
 const hardwareInfo=$('workbench-hardware-info');
 if(hardwareInfo){
  $('workbench-hardware-edit').hidden=guideStep===1;
  const assumed=ready&&!!startingHardware&&startingHardware.uid===s.uid&&startingHardware.profile===s.profile&&startingHardware.nodes===s.nodes.length;
  hardwareInfo.textContent=ready?`Planning hardware: ${M.PROFILES[s.profile].label} · ${s.nodes.length} DB servers${assumed?' · starting assumption':' · confirm against your machine'}`:'Hardware not selected · compare workload options';
  hardwareInfo.dataset.state=ready?(assumed?'assumed':'selected'):'unselected';
 }
 for(let i=1;i<=4;i++)$('guide-step-'+i).setAttribute('aria-current',i===guideStep?'step':'false');
 const panels={
  'panel-machine':guideStep===1,'panel-avmc':guideStep===2,'panel-before':guideStep===2&&ready,
  'panel-sizing':guideStep===3&&intent==='workload','panel-layouts':guideStep===3&&intent==='allocation',
  'panel-candidate':guideStep===3&&intent==='allocation','panel-resources':guideStep===4&&ready,
  'panel-capacity':guideStep===4&&ready,'panel-audit':guideStep===4&&ready,
  'panel-overview':guideStep===4,'panel-guidance':guideStep===4,'panel-sessions':guideStep===4&&ready,
  'panel-formulas':guideStep===4,'review-actions':guideStep===4,
  'panel-topology':guideStep===2,'panel-import':guideStep===2,'panel-scenarios':guideStep===3,
  'panel-assessment':guideStep===4,'panel-coverage':guideStep===4,'panel-topology-review':guideStep===4,
  'panel-conventional':guideStep===1&&intent==='allocation'
 };
 for(const [id,visible] of Object.entries(panels))$(id).hidden=!visible;
 if(guideStep===3&&typeof renderScenarioComparison==='function')renderScenarioComparison();
 $('hardware-fields').hidden=intent==='workload';
 $('other-allocations').hidden=intent==='workload';
 $('other-allocations-hint').hidden=intent==='workload';
 $('manual-compute-controls').hidden=intent==='workload';
 $('design-heading').textContent=intent==='workload'?'AVMCs and workload needs':'Edit AVMC allocations';
 $('draft-hardware-note').hidden=intent!=='workload';
 $('draft-hardware-note').textContent=ready?`Selected option: ${M.PROFILES[s.profile].label}, ${s.nodes.length} DB servers. Other options are available in Compare.`:'Hardware is not selected. Enter workload needs in Allocations, then compare hardware.';
 $('review-needs-hardware').hidden=guideStep!==4||ready;
 $('review-partial').hidden=guideStep!==4||!s.clusters.some(c=>c.requirements?.incomplete);
 $('sizing-path-note').hidden=intent!=='workload';
 $('guide-back').disabled=guideStep===1;
 $('guide-next').hidden=guideStep===4;
 $('guide-next').textContent=guideStep<4?guideTitles[guideStep]:'';
 $('dock-next').hidden=guideStep===4;
 $('dock-next').textContent=guideStep<4?guideTitles[guideStep]:'';
 $('dock-review').hidden=guideStep!==4;
 $('guide-footer-note').textContent='Save on this device or download a backup to keep the plan.';
 $('review-save').disabled=!!preview;
 $('review-add').textContent=active<state.sites.length-1?'Next machine':'Back to machines';
}
function initJourney(){
 const hardwareEdit=$('workbench-hardware-edit');if(hardwareEdit)hardwareEdit.onclick=()=>goGuideStep(1);
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
