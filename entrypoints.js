'use strict';
let startChoicesOpen=false;
let plannerStartHandled=false;
let plannerTour=null;
function plannerStartAction(search){const action=new URLSearchParams(search||'').get('start');return ['quick','workload','example','saved','tour'].includes(action)?action:null;}
function refreshTour(){plannerTour?.refresh();}
function initPlannerTour(){
 if(plannerTour||!window.ExaTour)return;
 plannerTour=window.ExaTour.create({document,window,getState:()=>state,getMachine:()=>site(),validate:machine=>M.validate(machine),isSaved:id=>state.project.id===id&&planSavedHere(),
  getSlotControl:id=>{const index=site().clusters.findIndex(c=>c.uid===id);return index<0?null:[...document.querySelectorAll('[data-cluster]')].find(el=>Number(el.dataset.cluster)===index&&el.dataset.key==='slots');},
  navigate:(view,id)=>{showPlanLibrary(false);goGuideStep(view);if(id){const index=site().clusters.findIndex(c=>c.uid===id);if(index>=0)openClusterEditor(index,false,false);}}
 });
}
function startGuidedPractice(){
 requestPlanTransition(async()=>{
  const next=window.ExaStarts.create('quick',{model:M,topology:T,library:L,rules:R,requirements:window.ExaRequirements});next.project.name='Guided practice';next.project.notes='Illustrative guided practice only. Replace these assumptions before using the plan for a customer.';
  markStartingHardware(next.sites[0]);activatePlan(next,{sourceKept:true,label:'Guided practice · not saved on this device'});initPlannerTour();
  if(!plannerTour?.start())message('Guided practice is ready, but the walkthrough controls are unavailable. Your practice plan has been kept.');
 });
}
function consumePlannerStartAction(){
 try{if(!window.history?.replaceState||!window.location?.href)return;const url=new URL(window.location.href);url.searchParams.delete('start');window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);}catch{}
}
function showStartChoices(open=true){
 showPlanLibrary(false);startChoicesOpen=open;$('start-options').hidden=!open;
 for(const id of ['planner-workspace','plan-context','local-dock','save','print','save-status','save-help'])$(id).hidden=open;
 if(open){$('start-heading').focus({preventScroll:true});$('start-options').scrollIntoView({block:'start',behavior:'smooth'});}
}
function startFromTemplate(kind){
 requestPlanTransition(async()=>{
  const next=window.ExaStarts.create(kind,{model:M,topology:T,library:L,rules:R,requirements:window.ExaRequirements});
  markStartingHardware(kind==='quick'?next.sites[0]:null);
  activatePlan(next,{sourceKept:true,label:kind==='quick'?'Quick check · not saved on this device':'Illustrative example · not saved on this device'});
  goGuideStep(2);
  if(kind==='example'){ $('panel-topology').open=true;message('This is an editable example, not a customer deployment. Changes stay in this tab until you save on the device or download a backup.'); }
 });
}
function startWorkloadPlan(){
 requestPlanTransition(async()=>{
  const next={schema:'exacc-capacity/v1',ruleSet:{version:R.VERSION,checked:R.CHECKED,scope:R.SCOPE},sites:[newPlanningMachine()]};
  L.ensureIdentity(next);T.ensureIds(next);validateWorkspace(next);markStartingHardware(null);
  activatePlan(next,{sourceKept:true,label:'New workload plan · not saved on this device'});goGuideStep(1);
 });
}
function initEntryPoints(){
 initPlannerTour();
 let userNavigationChanged=false;
 $('start-plan').onclick=()=>{userNavigationChanged=true;showStartChoices(true);};
 $('my-plans').addEventListener('click',()=>{userNavigationChanged=true;});
 $('start-return').onclick=()=>showStartChoices(false);
 $('start-quick').onclick=()=>startFromTemplate('quick');
 $('start-example').onclick=()=>startFromTemplate('example');
 $('start-customer').onclick=()=>{showPlanLibrary(true);$('library-create-details').open=true;$('new-plan-customer').focus();};
 // Let device-library discovery and recovery finish before choosing an empty
 // workbench. Changing the initial signature earlier would suppress its library.
 const startingSignature=planSignature(),generation=libraryGeneration,view=guideStep,action=plannerStartAction(window.location?.search);
 Promise.resolve(libraryReady).then(()=>{
  if(plannerStartHandled)return;plannerStartHandled=true;
  if(generation!==libraryGeneration||startingSignature!==planSignature()||view!==guideStep||userNavigationChanged||libraryBinding||libraryTransitioning||hasUnsavedChanges()||startChoicesOpen||!$('draft-recovery').hidden||state.sites.length!==1||site().clusters.length)return;
  if(!action&&(libraryRecords.length||!$('plan-library').hidden))return;
  if(action)consumePlannerStartAction();
  if(action==='saved'){showPlanLibrary(true);return;}
  const error=libraryError;
  if(action==='tour')startGuidedPractice();else if(action==='workload')startWorkloadPlan();else startFromTemplate(action||'quick');
  if(error){libraryError=error;renderPlanContext();}
 });
}
function openFindingAncestors(element){
 for(let p=element?.parentElement;p;p=p.parentElement)if(String(p.tagName).toLowerCase()==='details')p.open=true;
}
function goFindingTarget(original){
 const target=window.ExaFindings.resolveTarget(original,state);
 if(!target){message('That item is no longer in this plan. Review the current findings again.');return;}
 showPlanLibrary(false);active=target.siteIndex;
 if(Number.isInteger(target.clusterIndex))activeAVMCEditor=target.clusterIndex;
 if(target.acdId)topologyOpenACDs.add(target.acdId);
 if(typeof clearSourcePreview==='function')clearSourcePreview();
 cancelPreview();render();goGuideStep(target.step);
 let panel=$(target.panelId),focus=null;
 if(panel?.hidden){
  // Never change the planning mode or allocation merely to follow a finding.
  if(target.panelId==='panel-sizing'){goGuideStep(1);panel=$('panel-machine');focus=$('mode-workload');}
  else if(target.panelId==='panel-conventional'){goGuideStep(1);panel=$('panel-machine');focus=$('mode-allocation');}
 }
 if(!panel||panel.hidden){message('Open the relevant planning mode to review this input.');return;}
 if(String(panel.tagName).toLowerCase()==='details')panel.open=true;
 const ci=target.clusterIndex;
 if(!focus&&target.panelId==='panel-machine')focus=({'profile':$('profile'),'node-count':$('node-count'),'buffer':$('buffer'),'other-allocations':$('other-allocations')})[target.field];
 if(!focus&&target.panelId==='panel-capacity')focus=({'storageCapacity':$('storage-capacity'),'storageAllocated':$('storage-allocated')})[target.field];
 if(!focus&&target.panelId==='panel-avmc'){
  if(target.field==='compute')focus=$('compute');
  else if(Number.isInteger(ci)){
   openClusterEditor(ci,false,false);const editor=$('cluster-editor-'+ci);
   if(target.field==='requirements'){
    const details=$('workload-settings-'+ci);if(details){openWorkloadEditors.add(ci);details.open=true;}
    const candidates=editor?.querySelectorAll('[data-requirement]')||[];
    focus=[...candidates].find(el=>el.value==='')||[...candidates][0]||$('requirements-box-'+ci);
   }else if(target.field==='memoryRule'){
    openComputeEditors.add(ci);const settings=$('compute-settings-'+ci);if(settings)settings.open=true;
    focus=[...(editor?.querySelectorAll('[data-memory-rule]')||[])][0]||settings;
   }else if(['cpu','memoryPerCPU'].includes(target.field)){
    openComputeEditors.add(ci);const settings=$('compute-settings-'+ci);if(settings)settings.open=true;
    focus=[...(editor?.querySelectorAll('[data-cluster]')||[])].find(el=>el.dataset.key===target.field);
   }else if(target.field==='nodes')focus=[...(editor?.querySelectorAll('[data-placement]')||[])][0];
   else if(target.field==='name')focus=$('editor-name-'+ci);
   else if(target.field==='slots')focus=[...(editor?.querySelectorAll('[data-cluster]')||[])].find(el=>el.dataset.key==='slots');
   focus||=editor;
  }
 }
 if(!focus&&target.panelId==='panel-topology'&&target.acdId){
  const rows=[...panel.querySelectorAll('[data-acd-id]')].filter(el=>el.dataset.acdId===target.acdId&&(!target.adbId||el.dataset.adbId===target.adbId));
  if(target.field==='role')focus=[...panel.querySelectorAll('[data-acd-role]')].find(el=>el.dataset.acdRole===target.acdId);
  else if(target.field==='peer')focus=[...panel.querySelectorAll('[data-topology-peer]')].find(el=>el.dataset.topologyPeer===target.acdId);
  else if(target.field==='inventory-source')focus=[...panel.querySelectorAll('[data-topology-action]')].find(el=>el.dataset.topologyAction==='use-totals'&&Number(el.dataset.clusterIndex)===ci);
  else if(target.field)focus=rows.find(el=>el.dataset.topologyField===target.field&& (target.adbId||!el.dataset.adbId));
  focus||=$('topology-acd-summary-'+target.acdId);
 }
 focus||=panel.querySelector('summary')||panel.querySelector('h2')||panel;
 let hidden=false;for(let p=focus;p;p=p.parentElement)if(p.hidden){hidden=true;break;}
 if(hidden){
  if(target.panelId==='panel-machine'&&planningIntent(site())==='workload'){focus=$('mode-allocation');message('Hardware and Other allocations are edited in the known-hardware path. The planning mode has not been changed.');}
  else focus=panel.querySelector('summary')||panel.querySelector('h2')||panel;
 }
 openFindingAncestors(focus);
 if(!['input','select','button','summary','textarea'].includes(String(focus.tagName).toLowerCase()))focus.setAttribute('tabindex','-1');
 focus.scrollIntoView({block:'center',behavior:'smooth'});focus.focus({preventScroll:true});
}
