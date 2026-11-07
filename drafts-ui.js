'use strict';
// Compatibility adapter for the previous single localStorage recovery slot.
function readLegacyPlanDraft(){
 try{const storage=window.localStorage,raw=storage.getItem(window.ExaDrafts.KEY),found=window.ExaDrafts.create(storage).read();return {...found,raw};}
 catch{return {status:'unavailable',draft:null,raw:null};}
}
function clearMigratedLegacyDraft(expectedRaw){
 try{const storage=window.localStorage;if(storage.getItem(window.ExaDrafts.KEY)!==expectedRaw)return false;storage.removeItem(window.ExaDrafts.KEY);return true;}catch{return false;}
}
function initDrafts(){initLibrary().catch(e=>message('Device library could not start. '+e.message));}
function updateDeviceDraft(){renderPlanContext();queuePlanSave();}
function deviceDraftIsCurrent(){return planSavedHere();}
