(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.ExaTheme=api;api.init(root);}})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const STORAGE_KEY='exacc-theme',MODES=Object.freeze(['system','light','dark']);
 const valid=value=>MODES.includes(value);
 function init(env){
  const doc=env.document;let media=null,select=null,mode='system',theme='light',destroyed=false;
  try{const saved=env.localStorage?.getItem(STORAGE_KEY);if(valid(saved))mode=saved;}catch{}
  try{media=env.matchMedia?.('(prefers-color-scheme: dark)')||null;}catch{}
  function render(){
   theme=mode==='system'?(media?.matches?'dark':'light'):mode;
   doc.documentElement.setAttribute('data-theme',theme);
   if(select)select.value=mode;
  }
  function setMode(value){
   if(destroyed||!valid(value))return false;
   mode=value;render();
   try{env.localStorage?.setItem(STORAGE_KEY,mode);}catch{}
   return true;
  }
  function selectionChanged(){if(!setMode(select.value))select.value=mode;}
  function bindSelect(){
   if(destroyed||select)return;
   select=doc.getElementById('theme-select');
   if(select){select.value=mode;select.addEventListener('change',selectionChanged);}
  }
  function systemChanged(){if(!destroyed&&mode==='system')render();}
  function preferenceChanged(event){
   if(destroyed||(event.key!==STORAGE_KEY&&event.key!==null))return;
   mode=valid(event.newValue)?event.newValue:'system';render();
  }
  render();
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',bindSelect,{once:true});else bindSelect();
  if(media?.addEventListener)media.addEventListener('change',systemChanged);else media?.addListener?.(systemChanged);
  env.addEventListener?.('storage',preferenceChanged);
  return {setMode,getMode:()=>mode,getTheme:()=>theme,destroy(){
   if(destroyed)return;destroyed=true;
   doc.removeEventListener('DOMContentLoaded',bindSelect);select?.removeEventListener('change',selectionChanged);
   if(media?.removeEventListener)media.removeEventListener('change',systemChanged);else media?.removeListener?.(systemChanged);
   env.removeEventListener?.('storage',preferenceChanged);
  }};
 }
 return {STORAGE_KEY,MODES,init};
});
