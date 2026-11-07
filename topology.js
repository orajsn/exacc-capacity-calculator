(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaTopology=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const SOURCES={
  guard:'https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/protect-critical-databases-from-failures-and-disasters-using.html',
  peers:'https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/manage-primary-and-standby-databases-in-an-autonomous-data.html',
  compute:'https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/compute-management-in-autonomous-ai-database-on-dedicated.html'
 };
 const CHECKED='2026-11-07',MAX_ACDS=16,MAX_ADBS=1000;
 let sequence=0;
 const clone=value=>JSON.parse(JSON.stringify(value));
 const norm=value=>String(value||'').trim().toLocaleLowerCase('en-US');
 function id(kind){sequence++;return `${kind}-${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random().toString(36).slice(2,10)}`;}
 function acds(cluster){return cluster?.topology?.acds||[];}
 function peerIds(acd){return acd.role==='primary'?(acd.peerIds!==undefined?acd.peerIds:acd.peerId?[acd.peerId]:[]):acd.role==='standby'?(acd.peerId?[acd.peerId]:[]):[...(acd.peerIds||[]),...(acd.peerId?[acd.peerId]:[])];}
 function ensureIds(state){
  state.sites.forEach(s=>{if(!s.uid)s.uid=id('machine');s.clusters.forEach(c=>{if(!c.uid)c.uid=id('avmc');acds(c).forEach(a=>{if(!a.id)a.id=id('acd');a.adbs.forEach(d=>{if(!d.id)d.id=id('adb');});});});});
  return state;
 }
 function newACD(name='ACD 1'){return {id:id('acd'),name,role:'unprotected',peerId:'',adbs:[]};}
 function newADB(name='ADB 1'){return {id:id('adb'),name,ecpu:null,ramGB:null,storageTB:null,independentSwitchover:false,peerSettingsConfirmed:false};}
 function validateState(state){
  if(!state||!Array.isArray(state.sites))throw Error('Topology needs a machine list.');
  const ids=new Set();
  const identity=(value,label)=>{if(value===undefined)return;if(typeof value!=='string'||!value||value.length>128||!/^[A-Za-z0-9_.:-]+$/.test(value))throw Error(`${label}: invalid ID.`);if(ids.has(value))throw Error(`Duplicate topology ID: ${value}.`);ids.add(value);};
  const name=(value,label)=>{if(typeof value!=='string'||value.length>80)throw Error(`${label}: use a name of up to 80 characters.`);};
  const number=(value,label,max)=>{if(value===null||value===undefined)return;if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max)throw Error(`${label}: use a non-negative number or leave it blank.`);};
  for(const s of state.sites){
   identity(s.uid,'Machine');if(!Array.isArray(s.clusters))throw Error('Topology needs an AVMC list.');
   for(const c of s.clusters){
    identity(c.uid,'AVMC');if(c.topology===undefined)continue;
    if(!c.topology||typeof c.topology!=='object'||Array.isArray(c.topology)||!Array.isArray(c.topology.acds)||c.topology.acds.length>MAX_ACDS)throw Error(`AVMC topology supports up to ${MAX_ACDS} named ACDs.`);
    for(const a of c.topology.acds){
     if(!a||typeof a!=='object')throw Error('Invalid ACD record.');identity(a.id,'ACD');name(a.name,'ACD');
     if(!['primary','standby','unprotected'].includes(a.role))throw Error(`${a.name}: choose an ACD role.`);
     if(a.peerId!==undefined&&(typeof a.peerId!=='string'||a.peerId.length>128))throw Error(`${a.name}: invalid peer ID.`);
     if(a.peerIds!==undefined&&(!Array.isArray(a.peerIds)||a.peerIds.length>2||a.peerIds.some(p=>typeof p!=='string'||!p||p.length>128)))throw Error(`${a.name}: use at most two standby peer IDs.`);
     if(!Array.isArray(a.adbs)||a.adbs.length>MAX_ADBS)throw Error(`${a.name}: the calculator accepts at most ${MAX_ADBS} database rows per ACD. This is an input-size guard, not an Oracle service limit.`);
     for(const d of a.adbs){
      if(!d||typeof d!=='object')throw Error('Invalid database record.');identity(d.id,'ADB');name(d.name,'ADB');
      number(d.ecpu,`${d.name} ECPUs`,100000);number(d.ramGB,`${d.name} RAM`,1000000);number(d.storageTB,`${d.name} storage`,1000000);
      if(d.independentSwitchover!==undefined&&typeof d.independentSwitchover!=='boolean')throw Error(`${d.name}: invalid switchover preference.`);
      if(d.peerSettingsConfirmed!==undefined&&typeof d.peerSettingsConfirmed!=='boolean')throw Error(`${d.name}: invalid peer-settings confirmation.`);
     }
    }
   }
  }
  return state;
 }
 function entries(state){
  const result=[];
  state.sites.forEach((machine,siteIndex)=>machine.clusters.forEach((cluster,clusterIndex)=>acds(cluster).forEach((acd,acdIndex)=>result.push({machine,cluster,acd,siteIndex,clusterIndex,acdIndex}))));
  return result;
 }
 function label(entry){return `${entry.machine.siteName||'Site not named'} / ${entry.machine.name} / ${entry.cluster.name} / ${entry.acd.name||'Unnamed ACD'}`;}
 function topologySignature(cluster){return JSON.stringify({slots:cluster.slots,acds:acds(cluster).map(a=>({id:a.id,adbs:a.adbs.map(d=>({id:d.id,ecpu:d.ecpu??null,ramGB:d.ramGB??null,storageTB:d.storageTB??null}))}))});}
 function databaseTotals(cluster){
  const list=acds(cluster),missing={ecpu:0,ramGB:0,storageTB:0},known={ecpu:0,ramGB:0,storageTB:0};let databases=0;
  const acdEcpus=list.map(a=>a.adbs.reduce((sum,d)=>{databases++;for(const k of Object.keys(known)){if(d[k]===null||d[k]===undefined)missing[k]++;else known[k]+=d[k];}return sum+(d.ecpu??0);},0));
  while(acdEcpus.length<cluster.slots)acdEcpus.push(0);
  const requirements={ecpu:known.ecpu,ramGB:known.ramGB,unsizedACDs:acdEcpus.filter(n=>n===0).length,minRatio:cluster.requirements?.minRatio??2,incomplete:!databases||missing.ecpu>0||missing.ramGB>0,acdEcpus,source:'database-topology',topologySignature:topologySignature(cluster)};
  return {requirements,known,missing,counts:{databases,namedACDs:list.length,reservedSlots:cluster.slots},storageComplete:missing.storageTB===0&&databases>0};
 }
 function inspect(state){
  const result={errors:[],warnings:[],groups:[],counts:{machines:state?.sites?.length||0,avmcs:0,reservedSlots:0,namedACDs:0,adbs:0,primaryADBs:0,standbyADBs:0,linkedPairs:0}};
  try{validateState(state);}catch(e){result.errors.push({code:'invalid_topology',message:e.message});return result;}
  const all=entries(state),byId=new Map(all.filter(e=>e.acd.id).map(e=>[e.acd.id,e]));
  const issue=(level,code,message,e)=>result[level].push({code,message,...(e?{siteIndex:e.siteIndex,clusterIndex:e.clusterIndex,acdId:e.acd?.id}: {})});
  const duplicates=(items,key)=>{const seen=new Set();return items.filter(item=>{const n=norm(item[key]);if(!n)return false;const duplicate=seen.has(n);seen.add(n);return duplicate;});};
  state.sites.forEach((s,si)=>{
   duplicates(s.clusters,'name').forEach(c=>issue('warnings','duplicate_avmc_name',`${s.name}: more than one AVMC is named “${c.name}”. Give them distinct labels.`));
   s.clusters.forEach((c,ci)=>{
    result.counts.avmcs++;result.counts.reservedSlots+=c.slots;
    const list=acds(c),e={siteIndex:si,clusterIndex:ci};
    if(list.length>c.slots)issue('errors','named_acds_exceed_slots',`${c.name}: ${list.length} named ACDs exceed ${c.slots} configured slots. Increase the slots or revise the inventory.`,e);
    if(!list.length)issue('warnings','acd_inventory_missing',`${c.name}: only reserved ACD slots are known; no database groups are mapped.`,e);
    duplicates(list,'name').forEach(a=>issue('errors','duplicate_acd_name',`${c.name}: duplicate ACD name “${a.name}”.`,{...e,acd:a}));
    const q=c.requirements;
    if(q?.source==='database-topology'&&q.topologySignature!==topologySignature(c))issue('warnings','database_totals_stale',`${c.name}: database rows changed after totals were copied. Use database totals for sizing again.`,e);
   });
  });
  for(const e of all){
   const {acd:a,cluster:c}=e,refs=peerIds(a),location=label(e);
   result.counts.namedACDs++;result.counts.adbs+=a.adbs.length;
   if(a.role==='standby')result.counts.standbyADBs+=a.adbs.length;else result.counts.primaryADBs+=a.adbs.length;
   const g={id:a.id,siteIndex:e.siteIndex,clusterIndex:e.clusterIndex,siteName:e.machine.siteName||'',machineName:e.machine.name,avmcName:c.name,name:a.name,role:a.role,peerIds:refs,databases:a.adbs.map(d=>({...d})),label:location};
   result.groups.push(g);
   if(!norm(a.name))issue('warnings','acd_name_missing',`${location}: enter an ACD name.`,e);
   if(!a.adbs.length)issue('warnings','acd_has_no_databases',`${location}: no database rows are entered. Only the empty ACD and its resource minimums can be planned; future database workloads are not included.`,e);
   duplicates(a.adbs,'name').forEach(d=>issue('errors','duplicate_adb_name',`${location}: duplicate database name “${d.name}”.`,e));
   for(const d of a.adbs){
    if(!norm(d.name))issue('warnings','adb_name_missing',`${location}: a database has no name.`,e);
    if(d.ecpu==null||d.ramGB==null)issue('warnings','adb_workload_missing',`${location} / ${d.name||'Unnamed ADB'}: CPU or RAM needs are missing.`,e);
    if(d.peerSettingsConfirmed===true&&d.ecpu!=null&&(!Number.isInteger(d.ecpu)||d.ecpu<2))issue('errors','invalid_configured_adb_ecpu',`${d.name||'This database'}: a confirmed proposed ECPU setting must be a whole number of at least 2 ECPUs. Fractional or zero workload demand can remain unconfirmed.`,e);
    if(d.independentSwitchover&&a.adbs.length>1)issue('errors','independent_switchover_shared_acd',`${d.name||'This database'} needs independent switchover but shares ${a.name} with ${a.adbs.length-1} other database(s). Use its own ACD.`,e);
    if(d.independentSwitchover&&a.role==='unprotected')issue('warnings','independent_switchover_unprotected',`${d.name||'This database'} is in an unprotected ACD. Add a DR design before treating switchover as available.`,e);
   }
   if(a.role==='unprotected'&&refs.length)issue('errors','unprotected_has_peers',`${location}: an unprotected ACD cannot also have peer links.`,e);
   if(a.role==='standby'&&a.peerIds?.length)issue('errors','standby_has_peer_list',`${location}: a standby must reference one primary with peerId, not a standby list.`,e);
   if(a.role!=='unprotected'&&!refs.length)issue('warnings','peer_not_mapped',`${location}: its ${a.role==='primary'?'standby':'primary'} ACD is not linked.`,e);
   if(new Set(refs).size!==refs.length)issue('errors','duplicate_peer_link',`${location}: the same peer is listed more than once.`,e);
   if(a.role==='primary'&&a.peerIds!==undefined&&a.peerId&&!a.peerIds.includes(a.peerId))issue('errors','conflicting_peer_fields',`${location}: legacy peerId conflicts with the standby list.`,e);
   for(const ref of refs){
    if(ref===a.id){issue('errors','self_peer',`${location}: an ACD cannot be its own peer.`,e);continue;}
    const target=byId.get(ref);
    if(!target){issue('errors','peer_missing',`${location}: the linked ACD is missing from this plan.`,e);continue;}
    const expected=a.role==='primary'?'standby':'primary';
    if(target.acd.role!==expected){issue('errors','peer_role_conflict',`${location}: the linked peer must have the ${expected} role.`,e);continue;}
    if(!peerIds(target.acd).includes(a.id))issue('errors','peer_not_reciprocal',`${location}: the peer does not link back. Re-select it to create a reciprocal link.`,e);
    if(e.siteIndex===target.siteIndex)issue('warnings','peer_same_machine',`${location}: its peer is on the same machine. This does not isolate a machine failure.`,e);
    if(a.role==='primary'){
     result.counts.linkedPairs++;
     issue('warnings','dr_readiness_unchecked',`${location} ↔ ${target.acd.name}: matching CPU/storage inputs do not establish DR readiness. Autoscaling settings, lifecycle, database version, region/tenancy eligibility, network and operational readiness are not checked.`,e);
     const left=new Map(a.adbs.filter(d=>norm(d.name)).map(d=>[norm(d.name),d])),right=new Map(target.acd.adbs.filter(d=>norm(d.name)).map(d=>[norm(d.name),d]));
     if(left.size!==right.size||[...left.keys()].some(n=>!right.has(n)))issue('warnings','peer_inventory_incomplete',`${location} ↔ ${target.acd.name}: database names do not match. Complete or reconcile both inventories; no peer workload is copied automatically.`,e);
     for(const [n,d]of left){const peer=right.get(n);if(!peer)continue;
      const settingsConfirmed=d.peerSettingsConfirmed===true&&peer.peerSettingsConfirmed===true;
      if(!settingsConfirmed)issue('warnings','peer_settings_unconfirmed',`${d.name}: CPU/storage inputs have not been confirmed as proposed settings on both peer copies. Workload needs alone do not establish matching configured peers.`,e);
      for(const [key,title]of [['ecpu','ECPU'],['storageTB','storage']]){
       if(d[key]==null||peer[key]==null)issue('warnings',`peer_${key}_unknown`,`${d.name}: ${title} is missing on a peer copy. Matching peer settings are not checked.`,e);
       else if(Math.abs(d[key]-peer[key])>1e-7)issue(settingsConfirmed?'errors':'warnings',settingsConfirmed?`peer_${key}_mismatch`:`peer_${key}_review`,`${d.name}: primary and standby ${title} inputs differ (${d[key]} versus ${peer[key]}). ${settingsConfirmed?'The confirmed proposed peer settings must match.':'Review the configured peer settings; workload demand may differ.'}`,e);
      }
     }
    }
   }
  }
  return result;
 }
 function find(state,acdId){return entries(state).find(e=>e.acd.id===acdId);}
 function unlinkPeer(state,acdId,targetId){
  const entry=find(state,acdId);if(!entry)return state;
  const a=entry.acd,targets=targetId?[targetId]:peerIds(a);
  for(const ref of targets){const peer=find(state,ref)?.acd;
   if(peer){if(peer.role==='primary'){peer.peerIds=peerIds(peer).filter(x=>x!==a.id);peer.peerId='';}else if(peer.peerId===a.id)peer.peerId='';}
  }
  if(a.role==='primary'){a.peerIds=peerIds(a).filter(x=>!targets.includes(x));a.peerId='';}else if(!targetId||a.peerId===targetId)a.peerId='';
  return state;
 }
 function linkPeers(state,primaryId,standbyId){
  const p=find(state,primaryId),s=find(state,standbyId);
  if(!p||!s||primaryId===standbyId)throw Error('Choose two different ACDs already in this plan.');
  if(p.acd.role!=='primary'||s.acd.role!=='standby')throw Error('Link a primary ACD to a standby ACD.');
  const peers=peerIds(p.acd);
  if(!peers.includes(standbyId)&&peers.length>=2)throw Error('A primary ACD can have at most two standby ACDs.');
  if(s.acd.peerId&&s.acd.peerId!==primaryId)unlinkPeer(state,standbyId);
  p.acd.peerIds=[...new Set([...peers,standbyId])];p.acd.peerId='';s.acd.peerId=primaryId;delete s.acd.peerIds;
  return state;
 }
 function setRole(state,acdId,role){
  if(!['primary','standby','unprotected'].includes(role))throw Error('Choose a valid ACD role.');
  const a=find(state,acdId)?.acd;if(!a)throw Error('ACD no longer exists.');
  if(a.role===role)return state;
  unlinkPeer(state,acdId);a.role=role;a.peerId='';if(role==='primary')a.peerIds=[];else delete a.peerIds;
  return state;
 }
 function cloneMachine(machine){
  const next=clone(machine);next.uid=id('machine');
  next.clusters.forEach(c=>{c.uid=id('avmc');acds(c).forEach(a=>{a.id=id('acd');a.role='unprotected';a.peerId='';delete a.peerIds;a.adbs.forEach(d=>{d.id=id('adb');});});if(c.requirements?.source==='database-topology')c.requirements.topologySignature=topologySignature(c);});
  return next;
 }
 return {SOURCES,CHECKED,MAX_ACDS,MAX_ADBS,id,acds,peerIds,ensureIds,newACD,newADB,validateState,entries,label,inspect,databaseTotals,topologySignature,find,unlinkPeer,linkPeers,setRole,cloneMachine};
});
