'use strict';
const L=window.ExaLibrary;
let libraryStore=null,libraryReady=null,libraryRecords=[],libraryBinding=null,libraryAuto=false,librarySavedSignature=null;
let librarySaveTimer=null,librarySaving=null,libraryGeneration=0,libraryAutoEpoch=0,libraryTransitioning=false,libraryPendingAction=null,libraryConflict=null,libraryDeleteTarget=null,libraryChannel=null,libraryError='';
const planSignature=()=>JSON.stringify(state);
let planContextGeneration=-1;
function planFilename(s){const p=s.project||{},clean=x=>String(x||'plan').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,48);return `${clean(p.customer)}-${clean(p.name)}-${(p.id||'').slice(-8)}.json`;}
function planSavedHere(){return !!libraryBinding&&librarySavedSignature===planSignature()&&!libraryConflict;}
function planHasUnkeptChanges(){return hasUnsavedChanges()&&!planSavedHere();}
function renderPlanContext(){
 const p=state.project||{};
 const changed=planContextGeneration!==libraryGeneration;
 $('plan-context-name').textContent=`${p.customer?p.customer+' / ':''}${p.name||'Untitled plan'}`;
 $('plan-context-owner').textContent=p.owner?`Owner: ${p.owner}`:'Owner alias is optional';
 $('plan-context-id').textContent=p.id?`Plan ID · ${p.id}`:'Plan ID will be assigned';
 for(const [id,key]of [['plan-customer','customer'],['plan-title','name'],['plan-owner','owner'],['project-name','name'],['project-notes','notes']]){const el=$(id);if(el&&(changed||document.activeElement!==el))el.value=p[key]||'';}
 planContextGeneration=libraryGeneration;
 $('plan-id').value=p.id||'';
 $('draft-optin').checked=libraryAuto;
 $('plan-save-device').disabled=!!librarySaving||!!preview;
 $('plan-copy-working').disabled=!!librarySaving||!!preview;
 $('plan-switch-save').disabled=libraryTransitioning;$('plan-switch-discard').disabled=libraryTransitioning;
 $('plan-device-status').textContent=libraryError|| (librarySaving?'Saving on this device…':planSavedHere()?`Saved on this device${libraryAuto?' · automatic updates on':''}`:libraryBinding?'Changes not saved on this device yet':'Not saved on this device');
 $('plan-device-status').dataset.state=libraryError?'warning':planSavedHere()?'saved':'unsaved';
 $('draft-status').textContent=libraryError|| (libraryAuto?'Valid changes are saved to this plan after a short pause. Keep JSON as a portable backup.':'Automatic device saving is off. Save on this device to keep this plan in Saved plans.');
}
async function refreshPlanList(){
 if(!libraryStore)return;
 try{libraryRecords=await libraryStore.list({includeArchived:true});renderPlanList();}catch(e){$('library-state').textContent=e.message;}
}
function renderPlanList(){
 const query=$('library-search').value.trim().toLocaleLowerCase('en-US'),archived=$('library-archived').checked;
 const active=libraryRecords.filter(m=>!m.archivedAt),gone=libraryRecords.filter(m=>m.archivedAt),bytes=libraryRecords.reduce((n,m)=>n+(m.bodyBytes||0),0);
 $('library-state').textContent=libraryStore?`${active.length} saved plan${active.length===1?'':'s'} · ${gone.length} archived · ${(bytes/1000000).toFixed(1)} MB of plan data on this browser`:'Device library unavailable. You can still use the calculator and download a backup.';
 const rows=libraryRecords.filter(m=>!!m.archivedAt===archived).filter(m=>[m.id,m.customer,m.name,m.owner,...(m.sites||[]).flatMap(s=>[s.siteName,s.name])].join(' ').toLocaleLowerCase('en-US').includes(query)).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
 const groups=new Map();for(const m of rows){const k=(m.customer||'Customer not named').trim().toLocaleLowerCase('en-US');if(!groups.has(k))groups.set(k,{name:m.customer||'Customer not named',plans:[]});groups.get(k).plans.push(m);}
 $('library-cards').innerHTML=rows.length?[...groups.values()].map(g=>`<section class="customer-group"><h3>${escapeHTML(g.name)}</h3><div class="plan-card-grid">${g.plans.map(m=>`<article class="plan-card"><div><h4>${escapeHTML(m.name||'Untitled plan')}</h4><p>${escapeHTML(m.owner?`Owner: ${m.owner}`:'Owner not specified')}</p><code>${escapeHTML(m.id)}</code></div><p class="hint">${m.machineCount} machine${m.machineCount===1?'':'s'} · ${escapeHTML((m.sites||[]).map(s=>`${s.siteName?s.siteName+' / ':''}${s.name}`).join(' · '))}</p><p class="hint">Saved ${escapeHTML(new Date(m.updatedAt).toLocaleString())}</p><div class="actions">${m.archivedAt?`<button data-plan-action="restore" data-plan-id="${escapeHTML(m.id)}">Restore</button><button data-plan-action="export" data-plan-id="${escapeHTML(m.id)}">Download backup</button><button class="remove" data-plan-action="delete" data-plan-id="${escapeHTML(m.id)}">Delete permanently</button>`:`<button class="primary" data-plan-action="open" data-plan-id="${escapeHTML(m.id)}">Open plan</button><button data-plan-action="copy" data-plan-id="${escapeHTML(m.id)}">Duplicate</button><button data-plan-action="export" data-plan-id="${escapeHTML(m.id)}">Download backup</button><button class="remove" data-plan-action="archive" data-plan-id="${escapeHTML(m.id)}">Archive</button>`}</div></article>`).join('')}</div></section>`).join(''):`<p class="empty-editor">${query?'No plans match this search.':archived?'No archived plans.':'No saved plans yet. Create one, or open a JSON file and save it on this device.'}</p>`;
}
function showPlanLibrary(open=true){if($('start-options'))$('start-options').hidden=true;if(typeof startChoicesOpen!=='undefined')startChoicesOpen=false;$('plan-library').hidden=!open;$('planner-workspace').hidden=open;$('plan-context').hidden=open;for(const id of ['local-dock','save','print','save-status','save-help'])$(id).hidden=open;if(open){refreshPlanList();$('library-heading').focus({preventScroll:true});$('plan-library').scrollIntoView({block:'start',behavior:'smooth'});}}
function announcePlanChange(meta,action='save'){try{libraryChannel?.postMessage({id:meta.id,revision:meta.revision,action});}catch{}}
function resetLibraryBinding(binding=null,auto=false){
 clearTimeout(librarySaveTimer);librarySaveTimer=null;libraryGeneration++;libraryAutoEpoch++;libraryBinding=binding;libraryAuto=auto;librarySavedSignature=null;libraryConflict=null;libraryError='';$('plan-conflict').hidden=true;
}
function activatePlan(next,{binding=null,auto=false,sourceKept=false,label='Opened plan'}={}){
 resetLibraryBinding(binding,auto);state=next;L.ensureIdentity(state);active=0;activeAVMCEditor=0;guideStep=1;undoStack=[];redoStack=[];undoSnapshot=null;clearSizingResults();
 libraryPendingAction=null;libraryDeleteTarget=null;$('plan-switch-guard').hidden=true;$('library-delete-confirm').hidden=true;
 savedSignature=binding||sourceKept?JSON.stringify(state):null;savedLabel=label;if(binding)librarySavedSignature=planSignature();cancelPreview();showPlanLibrary(false);render();
}
function requestPlanTransition(action){
 if(libraryTransitioning)return;
 if(planHasUnkeptChanges()){
  libraryPendingAction=action;$('plan-switch-guard').hidden=false;$('plan-switch-text').textContent=`Keep changes to ${state.project?.customer||'this customer'} / ${state.project?.name||'Untitled plan'} before switching.`;$('plan-switch-guard').scrollIntoView({block:'center',behavior:'smooth'});return;
 }
 runPlanTransition(action);
}
async function runPlanTransition(action){
 if(libraryTransitioning)return;libraryTransitioning=true;
 try{await action();}catch(e){message(e.message);}finally{libraryTransitioning=false;renderPlanContext();}
}
function showPlanConflict(error){
 libraryAuto=false;libraryConflict={id:state.project.id,latest:error.latest||error.meta||null,code:error.code};
 libraryError=error.code==='archived'?'This plan is archived. Restore it in Saved plans or save a new copy.':'A saved copy of this Plan ID already exists or changed in another tab. Your working plan has been kept.';
 $('plan-conflict').hidden=false;$('plan-conflict-text').textContent=libraryError;
 $('plan-replace-saved').hidden=error.code==='archived';
}
async function savePlanOnDevice({expectedRevision}={}){
 const requestedGeneration=libraryGeneration,requestedId=state.project.id,requestedAutoEpoch=libraryAutoEpoch;
 clearTimeout(librarySaveTimer);librarySaveTimer=null;
 if(librarySaving){await librarySaving;if(planSavedHere())return true;}
 await libraryReady;
 if(requestedGeneration!==libraryGeneration||requestedId!==state.project.id)return false;
 if(!libraryStore){libraryError='This browser cannot save plans here. Download a backup to keep your work.';renderPlanContext();message(libraryError);return false;}
 if(preview){message('Apply or cancel the preview before saving a plan.');return false;}
 let copy,signature,generation,id,revision;
 try{L.ensureIdentity(state);validateWorkspace(state);copy=structuredClone(state);signature=JSON.stringify(copy);id=copy.project.id;generation=libraryGeneration;revision=expectedRevision??(libraryBinding?.id===id?libraryBinding.revision:0);}
 catch(e){libraryError=`Current edits are not saved. ${e.message}`;renderPlanContext();message(libraryError);return false;}
 const task=(async()=>{
  try{
   const saved=await libraryStore.save(copy,{expectedRevision:revision});
   announcePlanChange(saved.meta);
   if(generation===libraryGeneration&&state.project.id===id){libraryBinding=saved.meta;librarySavedSignature=signature;if(requestedAutoEpoch===libraryAutoEpoch)libraryAuto=true;libraryConflict=null;libraryError='';$('plan-conflict').hidden=true;}
   await refreshPlanList();return true;
  }catch(e){if(generation===libraryGeneration&&state.project.id===id){if(['conflict','archived'].includes(e.code))showPlanConflict(e);else libraryError=`Current edits are not saved. ${e.message}`;}return false;}
 })();
 librarySaving=task;renderPlanContext();
 const ok=await task;if(librarySaving===task)librarySaving=null;renderPlanContext();updateSaveReminder();if(!ok&&libraryError)message(libraryError);
 if(ok&&libraryAuto&&!planSavedHere())queuePlanSave();return ok;
}
function queuePlanSave(){
 if(!libraryAuto||libraryConflict||preview||planSavedHere()||librarySaving)return;
 clearTimeout(librarySaveTimer);librarySaveTimer=setTimeout(()=>{librarySaveTimer=null;savePlanOnDevice();},650);
}
async function flushPlanSave(){for(let i=0;i<3;i++){if(!await savePlanOnDevice())return false;if(planSavedHere())return true;}libraryError='Edits are still changing. Finish the input before switching plans.';renderPlanContext();return false;}
async function openStoredPlan(id){
 const before=planSignature(),loaded=await libraryStore.load(id),next=importWorkspace(loaded.scenario);
 if(before!==planSignature()&&planHasUnkeptChanges())throw Error('The working plan changed while opening. Your edits have been kept; open the saved plan again when ready.');
 if(loaded.meta.archivedAt)throw Error('Restore this archived plan before opening it.');
 activatePlan(next,{binding:loaded.meta,auto:true,label:'Opened from Saved plans · JSON backup recommended'});
 goGuideStep(planningIntent(site())==='allocation'?2:1);
}
async function saveWorkingCopy(){
 await libraryReady;if(!libraryStore){message('Device storage is unavailable. Download a backup instead.');return false;}
 try{
  validateWorkspace(state);const before=planSignature(),autoEpoch=libraryAutoEpoch,copy=L.copyAsNew(state);copy.project.name=`${copy.project.name||'Untitled plan'} (copy)`.slice(0,120);
  const saved=await libraryStore.save(copy,{expectedRevision:0});announcePlanChange(saved.meta);
  if(before===planSignature()&&autoEpoch===libraryAutoEpoch)activatePlan(copy,{binding:saved.meta,auto:true,label:'New device copy · JSON backup recommended'});else message('The copy was saved in Saved plans. Your newer edits or saving preference remain in the working plan.');
  await refreshPlanList();return true;
 }catch(e){message(e.message);return false;}
}
async function createNamedPlan(){
 const customer=$('new-plan-customer').value.trim(),name=$('new-plan-title').value.trim(),owner=$('new-plan-owner').value.trim();
 if(!customer||!name){message('Enter a customer and project name for the new plan.');return;}
 requestPlanTransition(async()=>{
  const next={schema:'exacc-capacity/v1',project:{customer,name,owner,notes:''},ruleSet:{version:R.VERSION,checked:R.CHECKED,scope:R.SCOPE},sites:[newPlanningMachine()]};
  L.ensureIdentity(next);T.ensureIds(next);validateWorkspace(next);activatePlan(next,{label:'New plan · save a JSON backup'});await savePlanOnDevice();
 });
}
async function checkPlanRevision(){
 if(!libraryStore||!libraryBinding)return;
 const id=libraryBinding.id,generation=libraryGeneration;
 try{
  const latest=await libraryStore.getMeta(id),current=libraryBinding;
  if(generation!==libraryGeneration||current?.id!==id||state.project.id!==id)return;
  // A completed save may have advanced this binding while the read was pending.
  if(latest.createdAt===current.createdAt&&latest.revision<current.revision)return;
  if(latest.revision!==current.revision||latest.createdAt!==current.createdAt||latest.archivedAt)showPlanConflict({code:latest.archivedAt?'archived':'conflict',latest});
 }catch(e){if(generation===libraryGeneration&&libraryBinding?.id===id&&state.project.id===id&&e.code==='notfound')showPlanConflict({code:'conflict',latest:null});}
 renderPlanContext();updateSaveReminder();
}
function offerLegacyPlanRecovery(legacy,error){
 if(!legacy.draft&&!legacy.raw)return;
 $('draft-recovery').hidden=false;$('draft-recovery-text').textContent=`The previous device draft was kept. ${error?.message||'Choose it below or open a JSON backup.'}`;
 $('draft-recover').hidden=false;$('draft-recover').textContent=legacy.draft?'Open previous draft':'Download previous draft';
 $('draft-recover').onclick=()=>{if(legacy.draft)requestPlanTransition(async()=>{activatePlan(importWorkspace(legacy.draft.scenario),{label:'Recovered previous draft · save on this device or as JSON'});});else download('previous-device-draft.json',legacy.raw,'application/json');};
}
async function initLibrary(){
 const startingSignature=planSignature();
 $('my-plans').onclick=()=>showPlanLibrary(true);$('library-return').onclick=()=>showPlanLibrary(false);
 $('library-search').oninput=renderPlanList;$('library-archived').onchange=renderPlanList;
 $('library-create').onclick=createNamedPlan;$('plan-save-device').onclick=()=>savePlanOnDevice();$('plan-copy-working').onclick=saveWorkingCopy;
 for(const [id,key]of [['plan-customer','customer'],['plan-title','name'],['plan-owner','owner']])$(id).oninput=()=>safeUpdate(()=>{state.project={...state.project,[key]:$(id).value};F.validateExtras(state,M);});
 $('plan-copy-id').onclick=async()=>{const id=state.project.id;try{if(!navigator.clipboard?.writeText)throw Error('unavailable');await navigator.clipboard.writeText(id);message('Plan ID copied. It finds this plan only where its data is saved or imported.');}catch{message(`Plan ID: ${id}`);}};
 $('draft-optin').onchange=()=>{libraryAutoEpoch++;libraryAuto=$('draft-optin').checked;if(libraryAuto)savePlanOnDevice();else{clearTimeout(librarySaveTimer);librarySaveTimer=null;renderPlanContext();}};
 $('draft-clear').onclick=()=>{if(!libraryBinding){message('This plan has no saved device copy.');return;}showPlanLibrary(true);message('Use Archive on its card to remove it from the active list. Archived plans can be restored.');};
 $('plan-switch-cancel').onclick=()=>{libraryPendingAction=null;$('plan-switch-guard').hidden=true;showPlanLibrary(false);};
 $('plan-switch-discard').onclick=()=>{if(libraryTransitioning)return;const action=libraryPendingAction;libraryPendingAction=null;$('plan-switch-guard').hidden=true;if(action)runPlanTransition(action);};
 $('plan-switch-save').onclick=async()=>{if(libraryTransitioning)return;const action=libraryPendingAction;libraryTransitioning=true;renderPlanContext();const kept=await flushPlanSave();libraryTransitioning=false;renderPlanContext();if(kept&&action&&libraryPendingAction===action){libraryPendingAction=null;$('plan-switch-guard').hidden=true;runPlanTransition(action);}};
 $('plan-save-copy').onclick=saveWorkingCopy;
 $('plan-load-saved').onclick=()=>{const id=libraryConflict?.id;if(id)requestPlanTransition(()=>openStoredPlan(id));};
 $('plan-replace-saved').onclick=async()=>{
  const id=libraryConflict?.id,generation=libraryGeneration,signature=planSignature();if(!id||id!==state.project.id)return;
  try{const latest=await libraryStore.getMeta(id);if(generation!==libraryGeneration||id!==state.project.id||signature!==planSignature()){message('The working plan changed. No saved copy was replaced.');return;}if(latest.archivedAt)throw Error('Restore the archived plan before replacing it.');await savePlanOnDevice({expectedRevision:latest.revision});}catch(e){message(e.message);}
 };
 $('library-delete-cancel').onclick=()=>{libraryDeleteTarget=null;$('library-delete-confirm').hidden=true;};
 $('library-delete-confirm-button').onclick=async()=>{const target=libraryDeleteTarget;if(!target)return;try{await libraryStore.remove(target.id,{expectedRevision:target.revision});announcePlanChange(target,'remove');libraryDeleteTarget=null;$('library-delete-confirm').hidden=true;await refreshPlanList();}catch(e){message(e.message);}};
 $('library-cards').onclick=async event=>{
  const button=event.target.closest('[data-plan-action]');if(!button||!libraryStore||libraryTransitioning)return;
  const id=button.dataset.planId,action=button.dataset.planAction,meta=libraryRecords.find(m=>m.id===id);if(!meta)return;
  try{
   if(action==='open'){requestPlanTransition(()=>openStoredPlan(id));return;}
   if(action==='export'){const {scenario}=await libraryStore.load(id);validateWorkspace(scenario);download(planFilename(scenario),JSON.stringify(scenario,null,2),'application/json');return;}
   if(action==='copy'){const {scenario}=await libraryStore.load(id);const copy=L.copyAsNew(scenario);copy.project.name=`${copy.project.name||'Untitled plan'} (copy)`.slice(0,120);validateWorkspace(copy);const saved=await libraryStore.save(copy,{expectedRevision:0});announcePlanChange(saved.meta);await refreshPlanList();return;}
   if(action==='archive'){
    const archive=async()=>{
     const current=libraryBinding?.id===id,revision=current?libraryBinding.revision:meta.revision,generation=libraryGeneration,signature=planSignature();
     const saved=await libraryStore.archive(id,{expectedRevision:revision});announcePlanChange(saved.meta,'archive');
     if(current&&generation===libraryGeneration&&state.project.id===id){
      if(signature===planSignature()){activatePlan({schema:'exacc-capacity/v1',ruleSet:{version:R.VERSION,checked:R.CHECKED,scope:R.SCOPE},sites:[newPlanningMachine()]},{sourceKept:true,label:'New empty plan'});showPlanLibrary(true);}
      else{resetLibraryBinding(saved.meta);showPlanConflict({code:'archived',latest:saved.meta});renderPlanContext();updateSaveReminder();message('The saved copy was archived. Your newer edits are still open; restore the plan or save a new copy to keep them.');}
     }
     await refreshPlanList();
    };
    if(libraryBinding?.id===id)requestPlanTransition(archive);else await archive();return;
   }
   if(action==='restore'){
    const current=libraryBinding?.id===id,generation=libraryGeneration;
    const saved=await libraryStore.restore(id,{expectedRevision:meta.revision});announcePlanChange(saved.meta,'restore');
    if(current&&generation===libraryGeneration&&libraryBinding?.id===id&&state.project.id===id){resetLibraryBinding(saved.meta);renderPlanContext();updateSaveReminder();message('The saved plan was restored. Save on this device to keep the current working version.');}
    await refreshPlanList();return;
   }
   if(action==='delete'){libraryDeleteTarget=meta;$('library-delete-confirm').hidden=false;$('library-delete-text').textContent=`Permanently delete the saved copy of ${meta.customer||'Customer not named'} / ${meta.name||'Untitled plan'} from this browser? Keep a JSON backup if you need it later.`;$('library-delete-confirm').scrollIntoView({block:'center'});}
  }catch(e){message(e.message);await refreshPlanList();}
 };
 libraryReady=(async()=>{
  const legacy=readLegacyPlanDraft();
  try{
   libraryStore=await L.open();
   if(legacy.draft){try{validateWorkspace(legacy.draft.scenario);const migrated=await libraryStore.importLegacy(legacy.draft);clearMigratedLegacyDraft(legacy.raw);message(`Previous device draft added to Saved plans as ${migrated.meta.name||'Recovered plan'}.`);}catch(e){offerLegacyPlanRecovery(legacy,e);}}
   else if(legacy.status==='unreadable')offerLegacyPlanRecovery(legacy,new Error('It could not be read automatically. Download a copy to keep the original data.'));
   await refreshPlanList();
   if(libraryRecords.length&&startingSignature===planSignature()&&!hasUnsavedChanges())showPlanLibrary(true);
   try{if(typeof BroadcastChannel!=='undefined'){libraryChannel=new BroadcastChannel('exacc-capacity-plan-library');libraryChannel.onmessage=event=>{if(event.data?.id===libraryBinding?.id&&event.data.revision!==libraryBinding.revision)checkPlanRevision();if(!$('plan-library').hidden)refreshPlanList();};}}catch{}
   window.addEventListener('focus',checkPlanRevision);
   return libraryStore;
  }catch(e){libraryError=`Device library unavailable. ${e.message} You can still calculate and download JSON.`;$('library-state').textContent=libraryError;offerLegacyPlanRecovery(legacy,e);return null;}
  finally{renderPlanContext();}
 })();
 renderPlanContext();return libraryReady;
}
