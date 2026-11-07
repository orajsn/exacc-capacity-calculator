(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaFindings=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Targets are data, never CSS selectors. Keep this contract small and explicit.
 const PANELS=Object.freeze({'panel-machine':1,'panel-conventional':1,'panel-avmc':2,'panel-topology':2,'panel-sizing':3,'panel-capacity':4,'panel-coverage':4});
 const FIELDS=Object.freeze({
  'panel-machine':['profile','node-count','buffer','other-allocations'],
  'panel-conventional':[],
  'panel-avmc':['compute','name','slots','requirements','memoryRule','cpu','memoryPerCPU','nodes'],
  'panel-topology':['name','ecpu','ramGB','storageTB','independentSwitchover','peerSettingsConfirmed','role','peer','inventory-source'],
  'panel-sizing':[],
  'panel-capacity':['storageCapacity','storageAllocated'],
  'panel-coverage':[]
 });
 const anchors=new WeakMap();
 const index=n=>Number.isInteger(n)&&n>=0?n:null;
 const id=v=>typeof v==='string'&&v.length>0&&v.length<=128?v:null;
 const external=new Set(['shared-storage-manual','custom-hardware','conventional-scope','provisionability','availability-performance','commercial-approval','dr_readiness_unchecked','topology-validation-unavailable']);
 const missing=new Set(['hardware-unselected','shared-storage','memory-history','no-avmcs','workload-incomplete','named-inventory','conventional-pending','acd_inventory_missing','acd_name_missing','acd_has_no_databases','adb_name_missing','adb_workload_missing','peer_not_mapped','peer_inventory_incomplete','peer_settings_unconfirmed','peer_ecpu_unknown','peer_storageTB_unknown','independent_switchover_unprotected']);
 function kind(issue,level){
  const code=String(issue?.code||'');
  if(external.has(code)||code.startsWith('rule-conflict-'))return 'external';
  if(level==='error')return 'correction';
  if(code==='compute-off'||(['shared-storage','named-inventory','acd_inventory_missing'].includes(code)&&issue.inputState==='not-selected'))return 'notSelected';
  if(missing.has(code))return 'missing';
  if(level==='unknown'&&!['imported-rule-version','requirements-stale'].includes(code))return 'missing';
  return 'advisory';
 }
 function resourceDestination(issue,state){
  if(issue.resource==='Shared database storage')return {panelId:'panel-capacity',field:'storageAllocated'};
  const sites=state?.sites||[],si=id(issue.siteUid)?uniqueIndex(sites,'uid',issue.siteUid):index(issue.machineIndex??issue.siteIndex),s=sites[si];
  const node=s?.nodes?.find(n=>n.id===issue.nodeId);
  const keys={'CPU':['cpu','otherCPU'],'Memory':['memory','otherMemory'],'Local storage':['local','otherLocal'],'VM slots':['maxVMs','otherVMs']}[issue.resource];
  if(!node||!keys)return {panelId:'panel-avmc'};
  const contributors=(s.clusters||[]).map((c,ci)=>({c,ci})).filter(({c})=>c.nodes?.includes(node.id));
  const [capacityKey,otherKey]=keys,other=node[otherKey];
  // Other alone exceeding capacity cannot be corrected by editing an AVMC.
  // A warning with no AVMC on this server also belongs to Other allocations.
  if(Number.isFinite(other)&&(other>node[capacityKey]+1e-7||(!contributors.length&&other>0)))return {panelId:'panel-machine',field:'other-allocations'};
  if(contributors.length===1){
   const {c,ci}=contributors[0];
   return {panelId:'panel-avmc',clusterIndex:ci,...(id(c.uid)?{clusterUid:c.uid}:{}),...(issue.resource==='CPU'&&other===0?{field:'cpu'}:{})};
  }
  // Several allocations can change the result; do not imply one is the fix.
  return {panelId:'panel-avmc'};
 }
 function destination(issue,state){
  const code=String(issue?.code||'');
  if(kind(issue,'unknown')==='external')return null;
  if(code==='hardware-unselected')return {panelId:'panel-sizing'};
  if(code==='compute-off')return {panelId:'panel-avmc',field:'compute'};
  if(code==='shared-storage'){const s=state?.sites?.[issue.machineIndex??issue.siteIndex];return {panelId:'panel-capacity',field:s?.planning?.storageCapacity==null?'storageCapacity':'storageAllocated'};}
  if(code==='memory-history')return {panelId:'panel-avmc',field:'memoryRule'};
  if(code==='no-avmcs')return {panelId:'panel-avmc'};
  if(['workload-incomplete','requirements-stale','manual-inventory-difference','database_totals_stale'].includes(code))return {panelId:'panel-avmc',field:'requirements'};
  if(code.startsWith('conventional-'))return {panelId:'panel-conventional'};
  if(code==='named_acds_exceed_slots')return {panelId:'panel-avmc',field:'slots'};
  if(code==='duplicate_avmc_name')return {panelId:'panel-avmc',field:'name'};
  if(['named-inventory','acd_inventory_missing','acd_has_no_databases','topology-invalid','invalid_topology','topology-duplicate-id'].includes(code))return {panelId:'panel-topology'};
  if(['acd_name_missing','adb_name_missing','duplicate_acd_name','duplicate_adb_name'].includes(code))return {panelId:'panel-topology',field:'name'};
  if(code==='adb_workload_missing'){
   const s=state?.sites?.[issue.machineIndex??issue.siteIndex],c=s?.clusters?.[issue.clusterIndex],a=c?.topology?.acds?.find(a=>a.id===issue.acdId),d=a?.adbs?.find(d=>d.id===issue.adbId);
   return {panelId:'panel-topology',...(d?{field:d.ecpu==null?'ecpu':'ramGB'}:{})};
  }
  if(code==='invalid_configured_adb_ecpu'||/^peer_ecpu_(unknown|mismatch|review)$/.test(code))return {panelId:'panel-topology',field:'ecpu'};
  if(/^peer_storageTB_(unknown|mismatch|review)$/.test(code))return {panelId:'panel-topology',field:'storageTB'};
  if(code==='peer_settings_unconfirmed')return {panelId:'panel-topology',field:'peerSettingsConfirmed'};
  if(code==='independent_switchover_shared_acd')return {panelId:'panel-topology',field:'independentSwitchover'};
  if(['independent_switchover_unprotected','unprotected_has_peers'].includes(code))return {panelId:'panel-topology',field:'role'};
  if(code==='peer_inventory_incomplete')return {panelId:'panel-topology'};
  if(code.startsWith('peer_')||['standby_has_peer_list','duplicate_peer_link','conflicting_peer_fields','self_peer'].includes(code))return {panelId:'panel-topology',field:'peer'};
  if(code.startsWith('capacity-')||code.startsWith('buffer-'))return resourceDestination(issue,state);
  if(['invalid-input','calculation-invalid','rule-hardware','rule-limit'].includes(code)||code.startsWith('model-limit-'))return {panelId:'panel-machine'};
  if(code==='memory-adjustment')return {panelId:'panel-avmc'};
  // An unfamiliar issue can still open its reliably identified parent editor.
  if(issue.acdId||issue.adbId)return {panelId:'panel-topology'};
  if(index(issue.clusterIndex)!==null)return {panelId:'panel-avmc'};
  if(index(issue.machineIndex??issue.siteIndex)!==null)return {panelId:'panel-machine'};
  return null;
 }
 function uniqueIndex(list,key,value){const hits=list.map((x,i)=>x?.[key]===value?i:-1).filter(i=>i>=0);return hits.length===1?hits[0]:-1;}
 function targetFor(issue,state){
  const dest=destination(issue,state);if(!dest)return null;
  const sites=state?.sites||[],siteUid=id(issue.siteUid),si=siteUid?uniqueIndex(sites,'uid',siteUid):index(issue.machineIndex??issue.siteIndex),s=sites[si];
  if(!s)return null;
  const target={siteIndex:si,...(id(s.uid)?{siteUid:s.uid}:{}),step:PANELS[dest.panelId],panelId:dest.panelId};
  const clusterUid=dest.clusterUid??issue.clusterUid,clusterIndex=dest.clusterIndex??issue.clusterIndex;
  const ci=id(clusterUid)?uniqueIndex(s.clusters||[],'uid',clusterUid):index(clusterIndex),c=s.clusters?.[ci];
  let a,d;
  if(c){target.clusterIndex=ci;if(id(c.uid))target.clusterUid=c.uid;
   const ai=id(issue.acdId)?uniqueIndex(c.topology?.acds||[],'id',issue.acdId):-1;a=c.topology?.acds?.[ai];
   if(a){target.acdId=a.id;const di=id(issue.adbId)?uniqueIndex(a.adbs||[],'id',issue.adbId):-1;d=a.adbs?.[di];if(d)target.adbId=d.id;}
  }
  if(dest.field&&FIELDS[dest.panelId].includes(dest.field))target.field=dest.field;
  // Never direct an ambiguous ADB issue to an ACD name/field with the same label.
  const databaseField=/^(adb_|duplicate_adb_|invalid_configured_adb_|peer_ecpu_|peer_storageTB_)/.test(issue.code)||['peer_settings_unconfirmed','independent_switchover_shared_acd'].includes(issue.code);
  if(dest.panelId==='panel-topology'&&(!a||(databaseField&&!d)))delete target.field;
  if(['role','peer'].includes(target.field))delete target.adbId;
  if(dest.panelId==='panel-avmc'&&!c&&dest.field!=='compute')delete target.field;
  anchors.set(target,{site:s,cluster:c,acd:a,adb:d});return target;
 }
 function resolveTarget(target,state){
  if(!target||!Object.hasOwn(PANELS,target.panelId))return null;
  const saved=anchors.get(target),sites=state?.sites||[];
  const si=id(target.siteUid)?uniqueIndex(sites,'uid',target.siteUid):saved?sites.indexOf(saved.site):-1,s=sites[si];
  if(!s)return null; // A removed machine must never become the next machine at its old index.
  const out={siteIndex:si,...(id(s.uid)?{siteUid:s.uid}:{}),step:PANELS[target.panelId],panelId:target.panelId};
  if(FIELDS[target.panelId].includes(target.field))out.field=target.field;
  const wantsCluster=id(target.clusterUid)||index(target.clusterIndex)!==null;
  if(wantsCluster){
   const ci=id(target.clusterUid)?uniqueIndex(s.clusters||[],'uid',target.clusterUid):saved?.cluster?(s.clusters||[]).indexOf(saved.cluster):-1,c=s.clusters?.[ci];
   if(!c){delete out.field;return out;}
   out.clusterIndex=ci;if(id(c.uid))out.clusterUid=c.uid;
   if(id(target.acdId)){
    const ai=uniqueIndex(c.topology?.acds||[],'id',target.acdId),a=c.topology?.acds?.[ai];
    if(!a){delete out.field;return out;}
    out.acdId=a.id;
    if(id(target.adbId)){const di=uniqueIndex(a.adbs||[],'id',target.adbId),d=a.adbs?.[di];if(d)out.adbId=d.id;else delete out.field;}
   }
  }
  if(out.panelId==='panel-topology'&&!out.acdId)delete out.field;
  if(out.panelId==='panel-avmc'&&out.clusterIndex===undefined&&out.field!=='compute')delete out.field;
  return out;
 }
 function partition(assessment,state){
  const groups={corrections:[],advisories:[],missingInputs:[],notSelected:[],externalChecks:[]},names={correction:'corrections',advisory:'advisories',missing:'missingInputs',notSelected:'notSelected',external:'externalChecks'};
  for(const [list,level]of [[assessment.hardErrors||[],'error'],[assessment.warnings||[],'warning'],[assessment.unknowns||[],'unknown']])for(const issue of list){
   // Both evaluators describe the same empty inventory; retain the fuller input check.
   if(issue.code==='acd_inventory_missing'&&(assessment.unknowns||[]).some(x=>x.code==='named-inventory'&&x.machineIndex===(issue.machineIndex??issue.siteIndex)&&x.clusterIndex===issue.clusterIndex))continue;
   const category=kind(issue,level);groups[names[category]].push({...issue,category,target:category==='external'?null:targetFor(issue,state)});
  }
  return groups;
 }
 return {PANELS,FIELDS,kind,targetFor,resolveTarget,partition};
});
