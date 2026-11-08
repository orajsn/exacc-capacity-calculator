(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else api.init(root);})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const KEY='autonomous-planner-tour-v1';
 function init(env){
  const panel=env.document.getElementById('tour-invitation'),dismiss=env.document.getElementById('tour-dismiss');
  if(!panel||!dismiss)return;
  let hidden=false;
  const isTour=()=>{try{return new URLSearchParams(env.location?.search||'').get('start')==='tour';}catch{return false;}};
  function refresh(){let value=null;try{value=env.localStorage?.getItem(KEY);}catch{}panel.hidden=hidden||isTour()||value==='dismissed'||value==='completed';}
  function close(){hidden=true;try{if(env.localStorage?.getItem(KEY)!=='completed')env.localStorage?.setItem(KEY,'dismissed');}catch{}refresh();}
  function storage(event){if(event.key===KEY||event.key===null)refresh();}
  dismiss.addEventListener('click',close);env.addEventListener?.('storage',storage);refresh();
  return {destroy(){dismiss.removeEventListener('click',close);env.removeEventListener?.('storage',storage);},refresh};
 }
 return {KEY,init};
});
