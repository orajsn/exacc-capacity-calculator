'use strict';
let deviceDraftStore=null,deviceDraftEnabled=false,deviceDraftSignature=null,recoverableDraft=null;
function initDrafts(){
 let storage;try{storage=window.localStorage;}catch{storage=null;}
 deviceDraftStore=window.ExaDrafts.create(storage);
 const found=deviceDraftStore.read();recoverableDraft=found.draft;
 $('draft-recovery').hidden=!recoverableDraft&&found.status!=='unreadable';
 $('draft-recover').hidden=!recoverableDraft;
 $('draft-recovery-text').textContent=recoverableDraft?`A draft from ${new Date(recoverableDraft.savedAt).toLocaleString()} is available on this browser. Restore it or keep working on this plan.`:'A stored draft could not be read. You can remove it and open a downloaded JSON file.';
 $('draft-status').textContent=found.status==='unavailable'?'Device drafts are unavailable in this browser. Download JSON to keep your work.':'Off. Download JSON to keep a portable copy of your plan.';
 $('draft-optin').disabled=found.status==='unavailable';
 $('draft-optin').onchange=()=>{
  deviceDraftEnabled=$('draft-optin').checked;
  if(!deviceDraftEnabled){deviceDraftSignature=null;$('draft-status').textContent='Draft updates are off. The last stored draft stays on this device until you clear it.';}
  else if(recoverableDraft){deviceDraftEnabled=false;$('draft-optin').checked=false;message('Restore or clear the previous device draft before saving a new one.');}
  else updateDeviceDraft();
 };
 $('draft-recover').onclick=()=>{
  if(!recoverableDraft)return;
  try{const next=importWorkspace(recoverableDraft.scenario);const before=snapshot();state=next;active=0;activeAVMCEditor=0;guideStep=1;rememberChange(before);deviceDraftEnabled=true;$('draft-optin').checked=true;recoverableDraft=null;$('draft-recovery').hidden=true;cancelPreview();render();message('Device draft restored. Download JSON for a portable backup.');}catch(e){message(`Could not restore draft: ${e.message}`);}
 };
 $('draft-clear').onclick=()=>{
  try{deviceDraftStore.clear();recoverableDraft=null;deviceDraftEnabled=false;deviceDraftSignature=null;$('draft-optin').checked=false;$('draft-recovery').hidden=true;$('draft-status').textContent='Device draft cleared. The plan in this tab is unchanged.';}catch(e){message(e.message);}
 };
}
function updateDeviceDraft(){
 if(!deviceDraftEnabled||!deviceDraftStore)return;
 const signature=JSON.stringify(state);if(signature===deviceDraftSignature)return;
 try{validateWorkspace(state);const saved=deviceDraftStore.write(state,M.VERSION);deviceDraftSignature=signature;$('draft-status').textContent=`Draft saved on this browser at ${new Date(saved.savedAt).toLocaleTimeString()}. JSON is your portable backup.`;}
 catch(e){deviceDraftSignature=null;$('draft-status').textContent=`Current edits are not saved as a device draft. ${e.message}`;}
}
function deviceDraftIsCurrent(){
 if(!deviceDraftEnabled||deviceDraftSignature!==JSON.stringify(state))return false;
 // A second tab can replace or remove the shared recovery slot.
 const stored=deviceDraftStore?.read();return stored?.status==='available'&&JSON.stringify(stored.draft.scenario)===JSON.stringify(state);
}
