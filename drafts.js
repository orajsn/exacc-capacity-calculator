(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaDrafts=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const KEY='exacc-planner-draft-v1',MAX_BYTES=2000000;
 function create(storage){
  function read(){
   if(!storage)return {status:'unavailable',draft:null};
   try{
    const text=storage.getItem(KEY);if(text===null)return {status:'empty',draft:null};
    if(text.length>MAX_BYTES||new Blob([text]).size>MAX_BYTES)throw Error('Draft exceeds the size limit.');
    const draft=JSON.parse(text);
    if(!draft||draft.schema!=='exacc-device-draft/v1'||typeof draft.savedAt!=='string'||!Number.isFinite(Date.parse(draft.savedAt))||typeof draft.version!=='string'||draft.version.length>40||!draft.scenario||draft.scenario.schema!=='exacc-capacity/v1')throw Error('Unrecognized draft format.');
    return {status:'available',draft};
   }catch(error){return {status:'unreadable',draft:null,error:String(error.message||error)};}
  }
  function write(scenario,version,now=new Date().toISOString()){
   if(!storage)throw Error('This browser cannot store a local draft. Download JSON instead.');
   const draft={schema:'exacc-device-draft/v1',version:String(version),savedAt:now,scenario};
   const text=JSON.stringify(draft);if(new Blob([text]).size>MAX_BYTES)throw Error('This draft is too large for device recovery. Download JSON instead.');
   try{storage.setItem(KEY,text);}catch{throw Error('The browser could not save this draft. Download JSON to keep your changes.');}
   return draft;
  }
  function clear(){if(!storage)return;try{storage.removeItem(KEY);}catch{throw Error('The browser could not clear this draft.');}}
  return {read,write,clear};
 }
 return {KEY,MAX_BYTES,create};
});
