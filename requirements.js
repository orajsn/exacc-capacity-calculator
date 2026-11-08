(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./topology.js')):factory(root.ExaTopology);if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaRequirements=api;})(typeof globalThis!=='undefined'?globalThis:this,function(T){
 'use strict';
 const numericKeys=['ecpu','ramGB','unsizedACDs','minRatio'];
 const clone=value=>JSON.parse(JSON.stringify(value));
 function source(cluster){const q=cluster?.requirements;return q?.source==='manual'?'manual':q?.source==='database-inventory'||q?.source==='database-topology'||q?.topologySignature||q?.appliedSignature?'database-inventory':'manual';}
 // Only workload quantities and their ACD grouping affect these CPU/RAM totals.
 // IDs, ordering, names, storage and Data Guard metadata are independent inputs.
 function signatureOf(slots,acds){return JSON.stringify({slots,acds:acds.map(a=>a.adbs.map(d=>[d.ecpu??null,d.ramGB??null]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))});}
 function sizingSignature(cluster){return signatureOf(cluster.slots,T.acds(cluster));}
 function appliedSignature(cluster){
  const q=cluster.requirements;if(q?.appliedSignature)return q.appliedSignature;
  if(q?.topologySignature)try{const old=JSON.parse(q.topologySignature);if(Array.isArray(old.acds))return signatureOf(old.slots,old.acds);}catch{}
  return null;
 }
 function totals(q){return Object.fromEntries(['ecpu','ramGB','unsizedACDs'].map(k=>[k,Number.isFinite(q?.[k])?q[k]:null]));}
 function breakdownMatches(applied,current){
  if(!Array.isArray(applied)||applied.length!==current.length||applied.some(v=>!Number.isFinite(v)||v<0))return false;
  const left=[...applied].sort((a,b)=>a-b),right=[...current].sort((a,b)=>a-b);
  return left.every((value,i)=>Math.abs(value-right[i])<1e-7);
 }
 function status(cluster){
  const inventory=T.databaseTotals(cluster),selected=source(cluster),applied=totals(cluster.requirements),hasRequirements=!!cluster.requirements;
  const appliedMatches=Object.keys(applied).every(k=>applied[k]!==null&&Math.abs(applied[k]-inventory.requirements[k])<1e-7);
  const stale=selected==='database-inventory'&&(appliedSignature(cluster)!==sizingSignature(cluster)||!appliedMatches||!breakdownMatches(cluster.requirements?.acdEcpus,inventory.requirements.acdEcpus));
  const delta=Object.fromEntries(Object.keys(applied).map(k=>[k,applied[k]===null?null:inventory.requirements[k]-applied[k]]));
  const canApply=inventory.counts.namedACDs>0&&inventory.counts.namedACDs<=cluster.slots;
  const incomplete=selected==='database-inventory'?inventory.requirements.incomplete||!!cluster.requirements?.userIncomplete:!!cluster.requirements?.incomplete||applied.ecpu===null||applied.ramGB===null;
  return {source:selected,stale,hasRequirements,applied,inventory,delta,missing:inventory.missing,canApply,incomplete,reason:stale?'Database CPU/RAM inputs or ACD grouping changed. Review and apply the inventory totals again.':!canApply?'Add named ACDs within the reserved slots before using database totals.':selected==='database-inventory'?'Applied inventory totals match the current CPU/RAM inputs.':'Manual totals are independent of the database inventory.'};
 }
 function manualSnapshot(q){
  const result={ecpu:null,ramGB:null,unsizedACDs:0,minRatio:2,incomplete:false};
  for(const k of [...numericKeys,'incomplete'])if(q?.[k]!==undefined)result[k]=q[k];
  if(q?.acdEcpus)result.acdEcpus=[...q.acdEcpus];return result;
 }
 function inventoryRequirements(cluster){
  const current=cluster.requirements||{},review=status(cluster);if(!review.canApply)throw Error(review.reason);
  const wasManual=source(cluster)==='manual',userIncomplete=current.userIncomplete??(wasManual?!!current.incomplete:false);
  const next={...current,...review.inventory.requirements,source:'database-inventory',appliedSignature:sizingSignature(cluster),userIncomplete,incomplete:review.inventory.requirements.incomplete||userIncomplete};
  if(wasManual)next.manualTotals=manualSnapshot(current);else if(current.manualTotals)next.manualTotals=clone(current.manualTotals);
  return next;
 }
 function useManual(cluster){
  const current=cluster.requirements||{};
  const next=manualSnapshot(current.manualTotals||current);next.source='manual';next.minRatio=current.minRatio??next.minRatio;
  if(current.userIncomplete!==undefined)next.incomplete=current.userIncomplete;
  // Slot edits can make a saved manual ACD breakdown obsolete; keep its totals.
  if(next.acdEcpus?.length!==cluster.slots)delete next.acdEcpus;
  if(next.unsizedACDs>cluster.slots){next.unsizedACDs=cluster.slots;next.incomplete=true;}
  return next;
 }
 function validateMetadata(cluster){
  const q=cluster.requirements;if(!q)return;
  if(q.source!==undefined&&!['manual','database-inventory','database-topology'].includes(q.source))throw Error(`${cluster.name}: choose Manual totals or Database inventory as the sizing source.`);
  for(const k of ['topologySignature','appliedSignature'])if(q[k]!==undefined&&typeof q[k]!=='string')throw Error(`${cluster.name}: invalid applied inventory signature.`);
  if(q.userIncomplete!==undefined&&typeof q.userIncomplete!=='boolean')throw Error(`${cluster.name}: workload completeness must be true or false.`);
  if(q.manualTotals!==undefined){
   const saved=q.manualTotals;if(!saved||typeof saved!=='object'||Array.isArray(saved))throw Error(`${cluster.name}: saved manual totals must be an object.`);
   for(const [k,min,max] of [['ecpu',0,100000],['ramGB',0,1000000],['unsizedACDs',0,16],['minRatio',2,5]])if(saved[k]!=null&&(!Number.isFinite(saved[k])||saved[k]<min||saved[k]>max||(k==='unsizedACDs'&&!Number.isInteger(saved[k]))))throw Error(`${cluster.name}: invalid saved manual ${k}.`);
   if(saved.incomplete!==undefined&&typeof saved.incomplete!=='boolean')throw Error(`${cluster.name}: invalid saved manual completeness.`);
   if(saved.acdEcpus!==undefined&&(!Array.isArray(saved.acdEcpus)||saved.acdEcpus.length>16||saved.acdEcpus.some(v=>!Number.isFinite(v)||v<0||v>100000)))throw Error(`${cluster.name}: invalid saved manual ACD CPU details.`);
  }
 }
 function createPreview(state,siteIndex,clusterIndex){
  const machine=state.sites[siteIndex],cluster=machine?.clusters[clusterIndex];if(!cluster)throw Error('Choose an AVMC first.');
  return {siteIndex,clusterIndex,machineId:machine.uid,clusterId:cluster.uid,signature:JSON.stringify(state),requirements:inventoryRequirements(cluster)};
 }
 function previewIsCurrent(preview,state,siteIndex){
  const machine=state.sites[siteIndex],cluster=machine?.clusters[preview?.clusterIndex];
  return !!preview&&preview.siteIndex===siteIndex&&!!cluster&&preview.machineId===machine.uid&&preview.clusterId===cluster.uid&&preview.signature===JSON.stringify(state);
 }
 return {source,status,sizingSignature,inventoryRequirements,useManual,validateMetadata,createPreview,previewIsCurrent};
});
