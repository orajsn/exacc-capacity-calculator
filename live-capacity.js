(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaLiveCapacity=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TYPES=[['local','Local storage','GB'],['cpu','CPU','ECPU'],['memory','Memory estimate','GB']];
 function build(site,result,planning,{ready=true,preview=false,scope='machine'}={}){
  const nodeId=String(scope).startsWith('node:')?Number(String(scope).slice(5)):null;
  const selected=site.nodes.find(n=>n.id===nodeId),view=selected?`node:${selected.id}`:'machine';
  if(!ready&&!preview)return {scope:view,scopeLabel:'Hardware not selected',level:'draft',metrics:TYPES.map(([id,name,unit])=>({id,name,unit,checked:false,reason:'Choose hardware',free:null,allocated:null,capacity:null})),note:'Choose hardware in step 3 to calculate remaining capacity.'};
  const rows=planning.resources(site,result);
  const metrics=TYPES.map(([id,name,unit])=>{
   const row=rows.find(r=>r.name===name);if(!row)return {id,name,unit,checked:false,reason:'Checks off',free:null,allocated:null,capacity:null};
   const value=selected?row.nodes.find(n=>n.id===selected.id):row;
   return {id,name,unit,checked:true,free:value.free,allocated:value.allocated,capacity:value.capacity,status:value.status,percent:value.percent,affectedNodes:row.nodes.filter(n=>n.free< -1e-7).map(n=>n.id)};
  });
  const shortages=rows.flatMap(r=>r.nodes.filter(n=>n.free< -1e-7).map(n=>({name:r.name,unit:r.unit,node:n.id,shortfall:-n.free,ratio:n.free/n.capacity}))).sort((a,b)=>a.ratio-b.ratio);
  const over=rows.filter(r=>r.status==='Over capacity'),below=rows.filter(r=>r.status==='Below buffer'),level=result.errors.length||shortages.length||over.length?'error':below.length?'warning':'fit';
  let note;
  if(shortages.length){const x=shortages[0];note=`Machine check: DB ${x.node} ${x.name.toLowerCase()} is short by ${x.shortfall.toLocaleString('en-US',{maximumFractionDigits:1})} ${x.unit}.`;}
  else if(result.errors.length)note=`Machine check: ${result.errors[0]}`;
  else if(over.length){const x=over[0];note=`Machine check: ${planning.resourceLabel?.(x.name)||x.name} exceeds capacity by ${(-x.free).toLocaleString('en-US',{maximumFractionDigits:1})} ${x.unit}.`;}
  else if(below.length)note=`Fits checked capacity; ${below.map(r=>r.name.toLowerCase()).join(', ')} below your buffer target.`;
  else note=site.checkCompute?'Meets the checked capacity and buffer targets.':'Local storage checked. CPU and memory checks are off.';
  return {scope:view,scopeLabel:selected?`DB ${selected.id} only`:`Whole machine · ${site.nodes.length} DB servers`,level,metrics,note,preview};
 }
 return {build};
});
