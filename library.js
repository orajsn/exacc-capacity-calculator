(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaLibrary=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const DB_NAME='exacc-plan-library-v1',DB_VERSION=1,MAX_PLANS=100,MAX_BYTES=10000000;
 const ID_PATTERN=/^[A-Za-z0-9_-]{8,80}$/;
 let fallbackSequence=0;
 function fail(code,message,extra){const error=new Error(message);error.code=code;if(extra)Object.assign(error,extra);return error;}
 function databaseError(error){
  if(typeof error?.code==='string')return error;
  if(error?.name==='QuotaExceededError')return fail('quota','This browser has no room to save the plan. Download JSON or remove an archived plan. Existing saved plans have not been replaced.');
  return fail('unavailable','Device storage is unavailable or the operation was interrupted. Keep this tab open and download JSON to keep your work.');
 }
 function id(value){if(typeof value!=='string'||!ID_PATTERN.test(value))throw fail('invalid','Plan ID must contain 8–80 letters, numbers, hyphens or underscores.');return value;}
 function text(value,max,label){if(typeof value!=='string'||value.length>max)throw fail('invalid',`${label}: use text of up to ${max} characters.`);return value;}
 function validateProject(project={},requireId=false){
  if(!project||typeof project!=='object'||Array.isArray(project))throw fail('invalid','Plan details must be an object.');
  const out={name:text(project.name??'',120,'Project name'),customer:text(project.customer??'',120,'Customer'),owner:text(project.owner??'',80,'Owner'),notes:text(project.notes??'',6000,'Project notes')};
  if(project.id!==undefined)out.id=id(project.id);else if(requireId)throw fail('invalid','This plan needs a Plan ID before it can be saved.');
  return out;
 }
 function newId(){
  const c=typeof globalThis!=='undefined'?globalThis.crypto:null;
  if(c?.randomUUID)return 'plan-'+c.randomUUID();
  const bytes=new Uint8Array(16);
  if(c?.getRandomValues)c.getRandomValues(bytes);
  else{let seed=Date.now()+(++fallbackSequence);for(let i=0;i<16;i++){bytes[i]=(Math.floor(Math.random()*256)+seed)%256;seed=Math.floor(seed/256);}}
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');return `plan-${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
 }
 function ensureIdentity(scenario){
  if(!scenario||typeof scenario!=='object'||Array.isArray(scenario))throw fail('invalid','Choose a valid scenario.');
  const project=validateProject(scenario.project);
  scenario.project={...scenario.project,...project,id:project.id||newId()};return scenario;
 }
 function serialize(value,space=2){
  try{const result=JSON.stringify(value,(key,v)=>{if(typeof v==='number'&&!Number.isFinite(v)||typeof v==='function'||typeof v==='symbol'||typeof v==='bigint')throw Error('unsupported value');return v;},space);if(typeof result!=='string')throw Error('missing value');return result;}
  catch{throw fail('invalid','The plan contains invalid values and cannot be saved. Correct the inputs and try again.');}
 }
 function bytes(value){return new Blob([value]).size;}
 function copyAsNew(scenario){const copy=JSON.parse(serialize(scenario));ensureIdentity(copy);copy.project.id=newId();return copy;}
 function envelope(scenario){
  if(!scenario||scenario.schema!=='exacc-capacity/v1'||!Array.isArray(scenario.sites)||scenario.sites.length<1||scenario.sites.length>8)throw fail('invalid','Use a calculator scenario with 1–8 machines.');
  const project=validateProject(scenario.project,true);let avmcCount=0,acdCount=0,adbCount=0;
  const sites=scenario.sites.map((s,index)=>{
   if(!s||typeof s!=='object'||!Array.isArray(s.clusters)||s.clusters.length>32)throw fail('invalid','A saved machine needs a valid AVMC list.');
   const name=text(s.name,80,'Machine name'),siteName=text(s.siteName??'',80,'Site name');avmcCount+=s.clusters.length;
   for(const c of s.clusters){
    if(!c||typeof c!=='object')throw fail('invalid','Invalid AVMC record.');
    if(c.topology!==undefined){
     const acds=c.topology?.acds;if(!Array.isArray(acds)||acds.length>16)throw fail('invalid','Invalid ACD inventory in the saved plan.');
     acdCount+=acds.length;
     for(const a of acds){if(!a||!Array.isArray(a.adbs)||a.adbs.length>1000)throw fail('invalid','Invalid database inventory in the saved plan.');adbCount+=a.adbs.length;}
    }
   }
   return {name:name.trim()||`Machine ${index+1}`,siteName:siteName.trim()};
  });
  return {id:project.id,name:project.name.trim()||'Untitled plan',customer:project.customer.trim(),owner:project.owner.trim(),sites,machineCount:sites.length,avmcCount,acdCount,adbCount};
 }
 function pack(scenario){
  const summary=envelope(scenario),payload=serialize(scenario),bodyBytes=bytes(payload);
  if(bodyBytes>MAX_BYTES)throw fail('limit','This plan exceeds the 10 MB device-plan limit. Remove saved alternatives or split the plan, then save again.');
  return {summary:{...summary,bodyBytes},payload};
 }
 function summary(scenario){return pack(scenario).summary;}
 function revision(value){if(!Number.isSafeInteger(value)||value<0)throw fail('invalid','Use the saved plan revision when updating device storage.');return value;}
 function iso(value,label){if(typeof value!=='string'||value.length>40||!Number.isFinite(Date.parse(value)))throw fail('corrupt',`The stored plan has an invalid ${label}.`);return value;}
 function metaValid(meta){
  try{
   if(!meta||meta.schema!=='exacc-library-plan/v1')throw Error('metadata');id(meta.id);revision(meta.revision);if(meta.revision<1)throw Error('revision');
   text(meta.name,120,'Saved plan name');text(meta.customer,120,'Saved customer');text(meta.owner,80,'Saved owner');
   iso(meta.createdAt,'creation date');iso(meta.updatedAt,'update date');if(meta.archivedAt!==null)iso(meta.archivedAt,'archive date');
   if(!Array.isArray(meta.sites)||meta.sites.length<1||meta.sites.length>8)throw Error('sites');
   for(const s of meta.sites){text(s.name,80,'Saved machine');text(s.siteName,80,'Saved site');}
   for(const [key,max]of [['machineCount',8],['avmcCount',256],['acdCount',4096],['adbCount',4096000],['bodyBytes',MAX_BYTES]])if(!Number.isSafeInteger(meta[key])||meta[key]<0||meta[key]>max)throw Error(key);
   if(meta.machineCount!==meta.sites.length)throw Error('machine count');
   if(meta.legacyFingerprint!==undefined&&(!/^[a-f0-9]{64}$/.test(meta.legacyFingerprint)))throw Error('legacy signature');
   return meta;
  }catch(error){throw fail('corrupt','A saved plan has unreadable metadata. Your working plan is unchanged.',{cause:error});}
 }
 function bodyValid(meta,body){
  if(!body||body.id!==meta.id||body.revision!==meta.revision||typeof body.payload!=='string'||body.payload.length>MAX_BYTES||bytes(body.payload)!==meta.bodyBytes)throw fail('corrupt','The stored plan contents do not match their metadata. Your working plan is unchanged.');
  if(body.legacySource!==undefined&&(typeof body.legacySource!=='string'||bytes(body.legacySource)>2100000))throw fail('corrupt','The previous draft recovery record is unreadable.');
  return body;
 }
 function unpack(record){
  if(!record?.meta){if(record?.body)throw fail('corrupt','The saved plan has contents but no readable metadata. Your working plan is unchanged.');throw fail('notfound','This plan is no longer saved on this browser.');}
  const meta=metaValid(record.meta),body=bodyValid(meta,record.body);let scenario;
  try{scenario=JSON.parse(body.payload);const derived=envelope(scenario);for(const key of ['id','name','customer','owner','machineCount','avmcCount','acdCount','adbCount'])if(derived[key]!==meta[key])throw Error(key);if(JSON.stringify(derived.sites)!==JSON.stringify(meta.sites))throw Error('sites');}
  catch{throw fail('corrupt','The saved plan could not be read safely. Your working plan is unchanged.');}
  return {meta:structuredClone(meta),scenario};
 }
 function expect(meta,expected){
  revision(expected);
  if((meta?.revision||0)!==expected)throw fail('conflict','Another saved copy has changed. Open that copy or save this work with a new Plan ID; it has not been overwritten.',{latest:meta?structuredClone(meta):null});
 }
 async function sha256(value){
  const crypto=typeof globalThis!=='undefined'?globalThis.crypto:null;
  if(!crypto?.subtle)throw fail('unavailable','This browser cannot identify the previous draft for migration. Open it and download JSON instead; the old draft is unchanged.');
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
 }
 // The backend provides atomic mutate callbacks; list() never reads scenario payloads.
 function createStore(backend,options={}){
  const now=options.now||(()=>new Date().toISOString()),digest=options.digest||sha256;
  let closed=false;
  function ready(){if(closed)throw fail('unavailable','This device library connection is closed. Reopen My plans or refresh the page.');}
  async function execute(action){try{return await action();}catch(error){throw databaseError(error);}}
  async function read(idValue){ready();id(idValue);return unpack(await execute(()=>backend.read(idValue)));}
  async function getMeta(idValue){ready();id(idValue);const meta=await execute(()=>backend.getMeta(idValue));if(!meta)throw fail('notfound','This plan is no longer saved on this browser.');return structuredClone(metaValid(meta));}
  async function list({includeArchived=false}={}){ready();const rows=await execute(()=>backend.list());return rows.map(metaValid).filter(m=>includeArchived||!m.archivedAt).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id)).map(m=>structuredClone(m));}
  async function save(scenario,{expectedRevision}={}){
   ready();revision(expectedRevision);const prepared=pack(scenario);
   return execute(()=>backend.mutate(prepared.summary.id,record=>{
    if(!record.meta&&record.body)throw fail('corrupt','This Plan ID has incomplete stored data. Save the working plan with a new Plan ID instead.');
    if(record.meta)metaValid(record.meta);expect(record.meta,expectedRevision);
    if(record.meta?.archivedAt)throw fail('archived','This plan is archived. Restore it before saving changes.',{latest:structuredClone(record.meta)});
    if(!record.meta&&record.count>=MAX_PLANS)throw fail('limit','This browser already has 100 plans, including archived plans. Export and permanently remove an archived plan before adding another.');
    if(record.meta)bodyValid(record.meta,record.body);
    const timestamp=iso(now(),'update date'),nextRevision=expectedRevision+1;if(!Number.isSafeInteger(nextRevision))throw fail('limit','This plan has reached the revision limit. Save it as a new copy.');
    const meta={schema:'exacc-library-plan/v1',...prepared.summary,revision:nextRevision,createdAt:record.meta?.createdAt||timestamp,updatedAt:timestamp,archivedAt:null};
    const body={id:meta.id,revision:nextRevision,payload:prepared.payload};
    if(record.meta?.legacyFingerprint){meta.legacyFingerprint=record.meta.legacyFingerprint;body.legacySource=record.body.legacySource;}
    return {kind:'put',meta,body,result:{meta:structuredClone(meta),scenario:JSON.parse(prepared.payload)}};
   }));
  }
  async function setArchived(idValue,expectedRevision,archived){
   ready();id(idValue);revision(expectedRevision);
   return execute(()=>backend.mutate(idValue,record=>{
    if(!record.meta)throw fail('notfound','This plan is no longer saved on this browser.');
    const current=metaValid(record.meta);expect(current,expectedRevision);bodyValid(current,record.body);
    if(!!current.archivedAt===archived)return {kind:'none',result:{meta:structuredClone(current)}};
    const timestamp=iso(now(),'update date'),next=current.revision+1;if(!Number.isSafeInteger(next))throw fail('limit','This plan has reached the revision limit.');
    const meta={...current,revision:next,updatedAt:timestamp,archivedAt:archived?timestamp:null},body={...record.body,revision:next};
    return {kind:'put',meta,body,result:{meta:structuredClone(meta)}};
   }));
  }
  async function remove(idValue,{expectedRevision}={}){
   ready();id(idValue);revision(expectedRevision);
   return execute(()=>backend.mutate(idValue,record=>{if(!record.meta)throw fail('notfound','This plan is no longer saved on this browser.');metaValid(record.meta);expect(record.meta,expectedRevision);if(!record.meta.archivedAt)throw fail('invalid','Archive this plan before permanently deleting its device copy.');return {kind:'delete',result:{id:idValue,removed:true}};}));
  }
  async function importLegacy(draft){
   ready();
   if(!draft||draft.schema!=='exacc-device-draft/v1'||typeof draft.version!=='string'||draft.version.length>40||typeof draft.savedAt!=='string'||!Number.isFinite(Date.parse(draft.savedAt))||!draft.scenario)throw fail('invalid','The previous device draft is not readable. Its stored copy is unchanged.');
   const source=serialize(draft,0);if(bytes(source)>2100000)throw fail('limit','The previous draft is too large to migrate automatically. Its stored copy is unchanged.');
   const fingerprint=await execute(()=>digest(source));if(typeof fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(fingerprint))throw fail('invalid','The previous draft could not be identified safely.');
   const scenario=JSON.parse(serialize(draft.scenario)),project=validateProject(scenario.project);
   scenario.project={...scenario.project,...project,id:project.id||`plan-legacy-${fingerprint.slice(0,48)}`};
   if(!scenario.project.name.trim())scenario.project.name='Recovered plan';
   const prepared=pack(scenario);
   return execute(()=>backend.mutate(prepared.summary.id,record=>{
    if(!record.meta&&record.body)throw fail('corrupt','The previous draft matches incomplete device data. Its old stored copy is unchanged.');
    if(record.meta){
     metaValid(record.meta);bodyValid(record.meta,record.body);
     if(record.meta.legacyFingerprint===fingerprint&&record.body.legacySource===source)return {kind:'none',result:{...unpack(record),migrated:false,alreadyImported:true}};
     throw fail('conflict','A different plan already uses the previous draft’s Plan ID. Its saved copy and the old draft are unchanged.',{latest:structuredClone(record.meta)});
    }
    if(record.count>=MAX_PLANS)throw fail('limit','The device library is full. The previous draft is unchanged; export a plan before freeing space.');
    const timestamp=iso(now(),'update date'),meta={schema:'exacc-library-plan/v1',...prepared.summary,revision:1,createdAt:draft.savedAt,updatedAt:timestamp,archivedAt:null,legacyFingerprint:fingerprint};
    const body={id:meta.id,revision:1,payload:prepared.payload,legacySource:source};
    return {kind:'put',meta,body,result:{meta:structuredClone(meta),scenario:JSON.parse(prepared.payload),migrated:true,alreadyImported:false}};
   }));
  }
  return {list,getMeta,load:read,save,archive:(idValue,opts={})=>setArchived(idValue,opts.expectedRevision,true),restore:(idValue,opts={})=>setArchived(idValue,opts.expectedRevision,false),remove,importLegacy,close(){closed=true;backend.close?.();}};
 }
 function indexedBackend(db){
  let closed=false;db.onversionchange=()=>{closed=true;db.close();};db.onclose=()=>{closed=true;};
  function transaction(names,mode,run){
   return new Promise((resolve,reject)=>{
    if(closed){reject(fail('unavailable','Device storage changed in another tab. Refresh before saving again.'));return;}
    let tx,result,error;
    try{tx=db.transaction(names,mode);}catch(e){reject(databaseError(e));return;}
    tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(error||databaseError(tx.error));tx.onerror=()=>{if(!error)error=databaseError(tx.error);};
    const abort=e=>{error=databaseError(e);try{tx.abort();}catch{reject(error);}};
    try{run(tx,value=>{result=value;},abort);}catch(e){abort(e);}
   });
  }
  function request(req,onValue,abort){req.onsuccess=()=>{try{onValue(req.result);}catch(e){abort(e);}};req.onerror=()=>abort(databaseError(req.error));}
  return {
   list:()=>transaction(['plans'],'readonly',(tx,done,abort)=>request(tx.objectStore('plans').getAll(),done,abort)),
   getMeta:idValue=>transaction(['plans'],'readonly',(tx,done,abort)=>request(tx.objectStore('plans').get(idValue),done,abort)),
   read:idValue=>transaction(['plans','payloads'],'readonly',(tx,done,abort)=>{const record={};let pending=2;const got=(key,value)=>{record[key]=value;if(--pending===0)done(record);};request(tx.objectStore('plans').get(idValue),v=>got('meta',v),abort);request(tx.objectStore('payloads').get(idValue),v=>got('body',v),abort);}),
   mutate:(idValue,change)=>transaction(['plans','payloads'],'readwrite',(tx,done,abort)=>{
    const plans=tx.objectStore('plans'),payloads=tx.objectStore('payloads'),record={};let pending=3;
    const got=(key,value)=>{
     record[key]=value;if(--pending!==0)return;
     const update=change(record);
     if(update.kind==='put'){plans.put(update.meta);payloads.put(update.body);}
     else if(update.kind==='delete'){plans.delete(idValue);payloads.delete(idValue);}
     else if(update.kind!=='none')throw Error('Invalid library transaction.');
     done(update.result);
    };
    request(plans.get(idValue),v=>got('meta',v),abort);request(payloads.get(idValue),v=>got('body',v),abort);request(plans.count(),v=>got('count',v),abort);
   }),
   close(){closed=true;db.close();}
  };
 }
 function open(options={}){
  return new Promise((resolve,reject)=>{
   let factory,req,settled=false;
   try{factory=Object.prototype.hasOwnProperty.call(options,'indexedDB')?options.indexedDB:globalThis.indexedDB;if(!factory?.open)throw Error('unavailable');req=factory.open(options.name||DB_NAME,DB_VERSION);}
   catch(e){reject(databaseError(e));return;}
   req.onupgradeneeded=()=>{try{const db=req.result;if(!db.objectStoreNames.contains('plans'))db.createObjectStore('plans',{keyPath:'id'});if(!db.objectStoreNames.contains('payloads'))db.createObjectStore('payloads',{keyPath:'id'});}catch(e){try{req.transaction.abort();}catch{}if(!settled){settled=true;reject(databaseError(e));}}};
   req.onblocked=()=>{if(!settled){settled=true;reject(fail('unavailable','Another tab is holding an older device library open. Close or refresh that tab, then try again. Your plans are unchanged.'));}};
   req.onerror=()=>{if(!settled){settled=true;reject(databaseError(req.error));}};
   req.onsuccess=()=>{if(settled){req.result.close();return;}settled=true;resolve(createStore(indexedBackend(req.result),options));};
  });
 }
 return {DB_NAME,DB_VERSION,MAX_PLANS,MAX_BYTES,ID_PATTERN,validateProject,newId,ensureIdentity,copyAsNew,summary,createStore,open};
});
