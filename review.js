(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaReview=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const normalize=value=>String(value??'').trim().toLocaleLowerCase('en-US');
 const pathKey=path=>JSON.stringify(Object.values(path).map(normalize));
 const label=path=>Object.values(path).join(' / ');
 const copy=value=>value==null?null:JSON.parse(JSON.stringify(value));
 const RESOURCE_TYPES=[['Local storage','GB'],['CPU','ECPU'],['Memory estimate','GB'],['Exadata storage (manual)','TB']];
 function sites(value){if(!value||!Array.isArray(value.sites)||value.sites.length<1||value.sites.length>8)throw Error('Compare plans with 1 to 8 machines.');return value.sites;}
 function counts(list){const out={machines:list.length,avmcs:0,reservedSlots:0,namedACDs:0,adbs:0};for(const s of list)for(const c of s.clusters||[]){out.avmcs++;if(out.reservedSlots!==null)out.reservedSlots=Number.isInteger(c.slots)&&c.slots>=1&&c.slots<=16?out.reservedSlots+c.slots:null;for(const a of c.topology?.acds||[]){out.namedACDs++;out.adbs+=(a.adbs||[]).length;}}return out;}
 function unknownResource(name,unit,reason){return {name,unit,checked:false,reason,capacity:null,allocated:null,free:null,buffer:null,percent:null,after:null,status:'Not checked',nodes:[],shortages:[]};}
 function machineResult(machine,M,P,Q){
  const selected=machine.planningIntent==='allocation'||machine.hardwareChosen!==false;
  const out={machineId:machine.uid||null,name:machine.name,site:machine.siteName||'',selected,hardware:selected?{profile:machine.profile,label:M.PROFILES[machine.profile]?.label||'Unknown profile',dbServers:Array.isArray(machine.nodes)?machine.nodes.length:null}:null,status:'unknown',label:'Hardware selection needed',counts:counts([machine]),resources:RESOURCE_TYPES.map(([name,unit])=>unknownResource(name,unit,'Hardware not selected')),errors:[],warnings:[],review:{staleRequirements:0,incompleteRequirements:0}};
  if(Q)for(const c of machine.clusters||[])if(c.requirements){try{const review=Q.status(c);if(review.stale)out.review.staleRequirements++;if(review.incomplete)out.review.incompleteRequirements++;}catch{out.review.incompleteRequirements++;}}
  if(!selected)return out;
  try{
   const result=M.calculate(machine),summary=P.summary(machine,result),resources=P.resources(machine,result);
   out.status=summary.status;out.label=summary.text;out.errors=[...result.errors];out.warnings=[...result.warnings];
   out.resources=RESOURCE_TYPES.map(([name,unit])=>{
    const resource=resources.find(r=>r.name===name);if(!resource)return unknownResource(name,unit,name==='CPU'||name==='Memory estimate'?'Checks off':'Shared storage capacity or allocation not supplied');
    const budget=value=>Object.fromEntries(['capacity','allocated','free','buffer','percent','after','status'].map(k=>[k,value[k]]));
    return {name,unit,checked:true,reason:null,...budget(resource),nodes:resource.nodes.map(n=>({id:n.id,...budget(n)})),shortages:resource.nodes.filter(n=>n.free< -1e-7).map(n=>({nodeId:n.id,shortfall:-n.free,unit}))};
   });
  }catch(error){out.status='error';out.label=error.message;out.errors=[error.message];out.resources=RESOURCE_TYPES.map(([name,unit])=>unknownResource(name,unit,'Invalid inputs'));}
  return out;
 }
 function comparePlans(state,selectedOptionIds=[],M,P,T,X,Q){
  sites(state);if(!Array.isArray(selectedOptionIds)||selectedOptionIds.length>2||new Set(selectedOptionIds).size!==selectedOptionIds.length)throw Error('Choose up to two different saved options.');
  const alternatives=state.alternatives||[];if(!Array.isArray(alternatives)||alternatives.length>20)throw Error('Use at most 20 saved options.');
  const selected=selectedOptionIds.map(id=>{const found=alternatives.filter(a=>a.id===id);if(found.length!==1)throw Error('Choose an existing, unambiguous saved option.');sites(found[0]);return found[0];});
  const sources=[state,...selected],plans=sources.map((source,index)=>{
   const machines=source.sites.map(s=>machineResult(s,M,P,Q)),status=['error','unknown','warning','fit'].find(value=>machines.some(m=>m.status===value))||'unknown';
   return {id:index?source.id:'working',isWorking:index===0,name:index?source.name:'Working plan',kind:index?source.kind:'working',notes:index?source.notes||'':state.project?.notes||'',ruleSet:copy(source.ruleSet),counts:counts(source.sites),status,machines};
  });
  const warnings=[],entries=[],ids=new Map(),nameCounts=sources.map(source=>{const map=new Map();for(const s of source.sites){const k=pathKey({site:s.siteName,machine:s.name});map.set(k,(map.get(k)||0)+1);}return map;});
  sources.forEach((source,plan)=>source.sites.forEach((machine,index)=>{const entry={plan,index,machine,key:pathKey({site:machine.siteName,machine:machine.name}),group:null};entries.push(entry);if(machine.uid){if(!ids.has(machine.uid))ids.set(machine.uid,[]);ids.get(machine.uid).push(entry);}}));
  const groups=[];
  // Reserve all exact identities across all columns before considering names.
  for(const members of ids.values())if(new Set(members.map(e=>e.plan)).size===members.length&&members.length>1){const group={members:[...members],legacy:false};groups.push(group);for(const e of members)e.group=group;}
  for(const e of entries)if(!e.group){e.group={members:[e],legacy:false};groups.push(e.group);}
  const working=entries.filter(e=>e.plan===0),proposals=new Map();
  for(const group of groups){if(group.members.some(e=>e.plan===0))continue;const anchors=new Set();
   for(const e of group.members)if(normalize(e.machine.name)&&nameCounts[e.plan].get(e.key)===1&&nameCounts[0].get(e.key)===1){const anchor=working.find(w=>w.key===e.key)?.group;if(anchor&&!group.members.some(member=>anchor.members.some(a=>a.plan===member.plan)))anchors.add(anchor);}
   if(anchors.size===1)proposals.set(group,[...anchors][0]);else if(anchors.size>1)warnings.push('A saved machine matches different working-machine names across options. Its identity was not inferred.');
  }
  for(const [group,anchor]of proposals){if(group.members.some(e=>anchor.members.some(a=>a.plan===e.plan)))continue;anchor.legacy=true;for(const e of group.members){e.group=anchor;e.nameMatch=true;anchor.members.push(e);}group.members=[];}
  const ordered=[];for(const e of entries)if(!ordered.includes(e.group))ordered.push(e.group);
  const machines=ordered.filter(g=>g.members.length).map((group,index)=>{
   const current=group.members.find(e=>e.plan===0),first=current||group.members[0],cells=plans.map((plan,planIndex)=>{const e=group.members.find(item=>item.plan===planIndex);return e?{...plan.machines[e.index],matchBasis:e.plan===0?'working':e.nameMatch?'name':group.members.length>1?'id':'unmatched'}:null;});
   return {key:`machine-${index+1}`,name:first.machine.name,site:first.machine.siteName||'',matchBasis:group.legacy?'name':group.members.length>1?'id':'unmatched',relationship:group.legacy?'Matched by unique site/name; verify identity':current?(group.members.length>1?'Working and saved options':'Working only'):(group.members.length>1?'Saved options only':'Saved option only'),cells};
  });
  if(machines.some(m=>m.matchBasis==='name'))warnings.push('Unique site/name matches are legacy assumptions. Verify machine identity before using the comparison.');
  if(nameCounts.some(map=>[...map.values()].some(n=>n>1)))warnings.push('Duplicate site/machine names were not matched by name.');
  const snapshotNames=new Map();for(const row of machines)if(!row.cells[0]){const k=pathKey({site:row.site,machine:row.name});snapshotNames.set(k,(snapshotNames.get(k)||0)+1);}if([...snapshotNames.values()].some(n=>n>1))warnings.push('Snapshot-only machines with different IDs remain separate even when their names match.');
  return {plans,machines,warnings};
 }
 function add(map,key,value){if(!map.has(key))map.set(key,[]);map.get(key).push(value);}
 function peerIds(acd,T){return T?.peerIds?T.peerIds(acd):acd.role==='primary'?(acd.peerIds!==undefined?acd.peerIds:acd.peerId?[acd.peerId]:[]):acd.role==='standby'?(acd.peerId?[acd.peerId]:[]):[...(acd.peerIds||[]),...(acd.peerId?[acd.peerId]:[])];}
 function inventory(state,T){
  const rows=new Map(),groups=new Map(),clusters=new Map(),machines=new Map(),ids=new Map(),missing={rows:0,ecpu:0,ramGB:0,storageTB:0};let total=0;
  for(const s of sites(state)){
   const mp={site:s.siteName||'',machine:s.name},mk=pathKey(mp);add(machines,mk,s);
   for(const c of s.clusters||[]){const cp={...mp,avmc:c.name},ck=pathKey(cp);add(clusters,ck,{path:cp,value:c.slots,machineKey:mk});
    for(const a of c.topology?.acds||[]){const path={...cp,acd:a.name},key=pathKey(path),record={path,key,acd:a,machineKey:mk,clusterKey:ck};add(groups,key,record);if(a.id)add(ids,a.id,record);
     for(const d of a.adbs||[]){const path={...record.path,adb:d.name},key=pathKey(path),unknown=['ecpu','ramGB','storageTB'].filter(k=>d[k]==null);total++;if(unknown.length)missing.rows++;for(const k of unknown)missing[k]++;
      add(rows,key,{path,key,group:record,db:d,missing:unknown});
     }
    }
   }
  }
  for(const groupList of groups.values())for(const group of groupList){
   const peers=peerIds(group.acd,T).map(id=>{
    const found=ids.get(id);if(found?.length!==1)return {key:'id:'+id,label:`${found?.length?'Ambiguous':'Unresolved'} peer ID: ${id}`};
    const target=found[0],uncertain=machines.get(target.machineKey).length>1||clusters.get(target.clusterKey).length>1||groups.get(target.key).length>1;
    return uncertain?{key:'ambiguous-path:'+target.key+':id:'+id,label:`Ambiguous peer path: ${label(target.path)} (ID ${id})`}:{key:'path:'+target.key,label:label(target.path)};
   }).sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
   group.peerKeys=peers.map(p=>p.key);group.value={role:group.acd.role||'unprotected',peerLinks:peers.map(p=>p.label),adbs:(group.acd.adbs||[]).length};
   group.ambiguous=machines.get(group.machineKey).length>1||clusters.get(group.clusterKey).length>1||groups.get(group.key).length>1;
  }
  for(const list of clusters.values())for(const c of list)c.ambiguous=machines.get(c.machineKey).length>1||list.length>1;
  for(const list of rows.values())for(const row of list){const d=row.db;row.ambiguous=row.group.ambiguous||list.length>1;row.peerKeys=row.group.peerKeys;row.value={ecpu:d.ecpu??null,ramGB:d.ramGB??null,storageTB:d.storageTB??null,role:row.group.value.role,independentSwitchover:!!d.independentSwitchover,peerSettingsConfirmed:!!d.peerSettingsConfirmed,peerLinks:[...row.group.value.peerLinks]};}
  return {rows,groups,clusters,missing,total};
 }
 function changes(before,after){const out=[];for(const field of Object.keys(after.value)){const a=field==='peerLinks'?before.peerKeys:before.value[field],b=field==='peerLinks'?after.peerKeys:after.value[field];if(Array.isArray(a)?JSON.stringify(a)!==JSON.stringify(b):a!==b)out.push({field,before:copy(before.value[field]),after:copy(after.value[field])});}return out;}
 function inventoryDiff(before,candidate,options={},T){
  const previous=inventory(before,T),next=inventory(candidate,T),ambiguous=[],rows=[],groups=[],slotChanges=[],summary={added:0,removed:0,changed:0,unchanged:0,ambiguous:0,missingBefore:previous.missing,missingAfter:next.missing,totalBefore:previous.total,totalAfter:next.total};
  function compare(type,left,right,output,includeUnchanged=false){
   for(const key of new Set([...left.keys(),...right.keys()])){
    const a=left.get(key)||[],b=right.get(key)||[],path=(b[0]||a[0]).path,uncertain=a.length>1||b.length>1||a.some(r=>r.ambiguous)||b.some(r=>r.ambiguous);
    if(uncertain){ambiguous.push({type,path:{...path},label:label(path),beforeCount:a.length,afterCount:b.length});if(type==='database'){summary.ambiguous+=Math.max(a.length,b.length);output.push({kind:'ambiguous',path:{...path},label:label(path),before:null,after:null,changes:[],missingBefore:[],missingAfter:[]});}continue;}
    const prior=a[0]||null,current=b[0]||null,list=prior&&current?(type==='avmc'?prior.value===current.value?[]:[{field:'slots',before:prior.value,after:current.value}]:changes(prior,current)):[],kind=!prior?'added':!current?'removed':list.length?'changed':'unchanged';
    if(type==='database')summary[kind]++;
    if(kind==='unchanged'&&!includeUnchanged)continue;
    const row={kind,path:{...path},label:label(path),before:copy(prior?.value),after:copy(current?.value)};
    if(type!=='avmc')row.changes=list;if(type==='database'){row.missingBefore=[...(prior?.missing||[])];row.missingAfter=[...(current?.missing||[])];}output.push(row);
   }
  }
  compare('database',previous.rows,next.rows,rows,true);compare('group',previous.groups,next.groups,groups);compare('avmc',previous.clusters,next.clusters,slotChanges);
  const warnings=['Counts and missing-input totals cover the full before/candidate inventory, including unchanged machines.','Renamed or moved name paths are shown as removed and added; database identity is not inferred from regenerated CSV IDs.'];
  if(ambiguous.length)warnings.push('Duplicate inventory paths are ambiguous. Their identities and changes were not guessed.');
  return {scope:'whole-plan',mode:options.mode??null,siteIndex:options.siteIndex??null,summary,rows,slotChanges,groups,ambiguous,warnings};
 }
 return {comparePlans,inventoryDiff};
});
