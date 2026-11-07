(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaScenarios=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX_ALTERNATIVES=20,MAX_CSV_ROWS=5000,MAX_CSV_CHARS=2000000;
 const FIELDS=[
  {key:'site',label:'Site',required:true,aliases:['site','site_name','location']},
  {key:'machine',label:'Machine',required:true,aliases:['machine','machine_name','infrastructure']},
  {key:'avmc',label:'AVMC',required:true,aliases:['avmc','avmc_name','vm_cluster']},
  {key:'acd',label:'ACD',required:true,aliases:['acd','acd_name','container_database']},
  {key:'adb',label:'ADB',required:true,aliases:['adb','adb_name','database','database_name']},
  {key:'role',label:'ACD role',aliases:['role','acd_role']},
  {key:'ecpu',label:'Workload ECPUs',aliases:['ecpu','ecpus','ecpu_count','workload_ecpus']},
  {key:'ram_gb',label:'Workload RAM (GB)',aliases:['ram_gb','memory_gb','ram','workload_ram_gb']},
  {key:'storage_tb',label:'Database storage (TB)',aliases:['storage_tb','database_storage_tb']},
  {key:'independent_switchover',label:'Needs independent switchover',aliases:['independent_switchover','solo_switchover']},
  {key:'cpu_unit',label:'CPU unit (ECPU only)',aliases:['cpu_unit','cpu_units']}
 ];
 let sequence=0;
 const clone=value=>JSON.parse(JSON.stringify(value));
 const id=prefix=>`${prefix}-${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2,9)}`;
 const key=value=>String(value??'').trim().toLocaleLowerCase('en-US');
 const cleanHeader=value=>key(value).replace(/[\s-]+/g,'_');
 function text(value,max,label,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Error(`${label}: enter ${required?'a non-empty ':''}text value of at most ${max} characters.`);return value;}
 function bounded(value,min,max,label){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(`${label}: enter ${min} to ${max}.`);return value;}
 function sitesCopy(sites,model){
  if(!Array.isArray(sites)||sites.length<1||sites.length>8)throw Error('Each saved option needs 1 to 8 machines.');
  return model?model.importScenario({schema:'exacc-capacity/v1',sites}).sites:clone(sites);
 }
 function validateProject(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid project details.');
  const project={name:text(value.name??'',120,'Project name'),notes:text(value.notes??'',6000,'Project notes')};
  if(value.id!==undefined){
   const planId=text(value.id,80,'Plan ID',true);
   if(!/^[A-Za-z0-9_-]{8,80}$/.test(planId))throw Error('Plan ID: use 8 to 80 letters, numbers, underscores or hyphens.');
   project.id=planId;
  }
  if(value.customer!==undefined)project.customer=text(value.customer,120,'Customer name');
  if(value.owner!==undefined)project.owner=text(value.owner,80,'Owner / alias');
  return project;
 }
 function validateExtras(raw,model,validateSites){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid plan metadata.');
  const output={};
  if(raw.ruleSet!==undefined)output.ruleSet=validateRuleSet(raw.ruleSet);
  if(raw.project!==undefined)output.project=validateProject(raw.project);
  if(raw.alternatives!==undefined){
   if(!Array.isArray(raw.alternatives)||raw.alternatives.length>MAX_ALTERNATIVES)throw Error(`Keep at most ${MAX_ALTERNATIVES} saved options in one plan.`);
   const ids=new Set(),names=new Set();
   output.alternatives=raw.alternatives.map((a,index)=>{
    if(!a||typeof a!=='object'||Array.isArray(a)||a.alternatives!==undefined)throw Error(`Saved option ${index+1} has an invalid structure.`);
    const aid=text(a.id,100,'Saved option ID',true),name=text(a.name,100,'Saved option name',true);
    if(ids.has(aid)||names.has(key(name)))throw Error('Saved option IDs and names must be unique.');
    ids.add(aid);names.add(key(name));
    if(!['option','year','migration'].includes(a.kind))throw Error('Choose a valid saved option type.');
    const createdAt=text(a.createdAt,40,'Saved option date',true);if(!Number.isFinite(Date.parse(createdAt)))throw Error('Invalid saved option date.');
    const out={id:aid,name,kind:a.kind,createdAt,sites:sitesCopy(a.sites,model)};
    if(validateSites)validateSites(out.sites);
    if(a.notes!==undefined)out.notes=text(a.notes,3000,'Saved option assumptions');
    if(a.ruleSet!==undefined)out.ruleSet=validateRuleSet(a.ruleSet);
    return out;
   });
  }
  return output;
 }
 function validateRuleSet(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid rule-set metadata.');
  return {version:text(value.version,100,'Rule-set version',true),checked:text(value.checked,40,'Rule-set check date',true),scope:text(value.scope,500,'Rule-set scope',true)};
 }
 function preserveExtras(imported,raw,model,validateSites){return {...imported,...validateExtras(raw,model,validateSites)};}
 function capture(state,name,kind='option',model){
  text(name,100,'Option name',true);if(!['option','year','migration'].includes(kind))throw Error('Choose a valid saved option type.');
  if((state.alternatives||[]).some(a=>key(a.name)===key(name)))throw Error('Use a different name for this option.');
  if((state.alternatives||[]).length>=MAX_ALTERNATIVES)throw Error(`Keep at most ${MAX_ALTERNATIVES} saved options in one plan.`);
  return {id:id('option'),name:name.trim(),kind,createdAt:new Date().toISOString(),sites:sitesCopy(state.sites,model),...(state.ruleSet?{ruleSet:validateRuleSet(state.ruleSet)}:{})};
 }
 function restore(state,alternativeId,model){
  const a=(state.alternatives||[]).find(item=>item.id===alternativeId);if(!a)throw Error('That saved option is no longer available.');
  const next={...clone(state),sites:sitesCopy(a.sites,model)};
  if(a.ruleSet)next.ruleSet=validateRuleSet(a.ruleSet);else delete next.ruleSet;
  return next;
 }
 function ready(s){return s.planningIntent==='allocation'||s.hardwareChosen!==false;}
 function machineResult(s,model,planning){
  if(!s)return null;
  if(!ready(s))return {selected:false,label:'Hardware selection needed',status:'unknown',resources:null};
  try{
   const calculated=model.calculate(s),summary=planning.summary(s,calculated),resources={};
   for(const r of planning.resources(s,calculated))resources[r.name]={capacity:r.capacity,allocated:r.allocated,free:r.free,unit:r.unit,status:r.status};
   return {selected:true,label:summary.text,status:summary.status,resources};
  }catch(e){return {selected:false,label:e.message,status:'error',resources:null};}
 }
 function compare(state,alternative,model,planning){
  if(typeof alternative==='string')alternative=(state.alternatives||[]).find(a=>a.id===alternative);
  if(!alternative)throw Error('Choose a saved option to compare.');
  const nameCounts=new Map();
  // Stable IDs allow renames; unique names can bridge legacy snapshots with regenerated IDs.
  for(const group of [state.sites,alternative.sites]){
   const local=new Map();group.forEach(s=>{const name=key(s.siteName)+'\u0000'+key(s.name);local.set(name,(local.get(name)||0)+1);});
   for(const [name,count]of local)nameCounts.set(name,Math.max(count,nameCounts.get(name)||0));
  }
  const matches=state.sites.map((s,index)=>({current:s,alternative:null,index,matchBasis:null})),used=new Set();
  // Reserve every exact identity first so an earlier name fallback cannot steal a later ID match.
  for(const pair of matches){
   const s=pair.current,j=s.uid?alternative.sites.findIndex((a,i)=>!used.has(i)&&a.uid===s.uid):-1;
   if(j>=0){used.add(j);pair.alternative=alternative.sites[j];pair.matchBasis='id';}
  }
  for(const pair of matches){
   if(pair.alternative)continue;
   const name=key(pair.current.siteName)+'\u0000'+key(pair.current.name);
   const j=alternative.sites.findIndex((a,i)=>!used.has(i)&&nameCounts.get(name)===1&&key(a.siteName)+'\u0000'+key(a.name)===name);
   if(j>=0){used.add(j);pair.alternative=alternative.sites[j];pair.matchBasis='name';}
  }
  alternative.sites.forEach((s,i)=>{if(!used.has(i))matches.push({current:null,alternative:s,index:i});});
  return matches.map(pair=>{
   const s=pair.current||pair.alternative,current=machineResult(pair.current,model,planning),saved=machineResult(pair.alternative,model,planning);
   const resourceKeys=new Set([...Object.keys(current?.resources||{}),...Object.keys(saved?.resources||{})]);
   return {machineId:s.uid||null,name:s.name,site:s.siteName||'',current,saved,
    matchBasis:pair.matchBasis||null,relationship:pair.current&&pair.alternative?(pair.matchBasis==='name'?'matched by name — verify identity':'matched'):pair.current?'current only':'saved option only',
    resources:[...resourceKeys].map(resource=>{const a=current?.resources?.[resource],b=saved?.resources?.[resource];return {name:resource,unit:a?.unit||b?.unit,current:a||null,saved:b||null,allocationChange:a&&b?b.allocated-a.allocated:null};})};
  });
 }
 function scaleValue(value,percent){return value==null?value:Math.round(value*(1+percent/100)*1000000)/1000000;}
 function growth(state,opts,model,topology){
  const cpu=bounded(opts.ecpuPercent,0,1000,'ECPU growth (%)'),ram=bounded(opts.ramPercent,0,1000,'RAM growth (%)');
  const alternative=capture(state,opts.name,'year',model);let changed=0;
  for(const s of alternative.sites){let siteChanged=false;
   for(const c of s.clusters){
    const q=c.requirements;
    if(q){if(q.ecpu!=null&&cpu!==0){q.ecpu=scaleValue(q.ecpu,cpu);if(q.acdEcpus){q.acdEcpus=q.acdEcpus.map(v=>scaleValue(v,cpu));q.ecpu=Math.round(q.acdEcpus.reduce((sum,v)=>sum+v,0)*1000000)/1000000;}changed++;siteChanged=true;}if(q.ramGB!=null&&ram!==0){q.ramGB=scaleValue(q.ramGB,ram);changed++;siteChanged=true;}}
    for(const a of c.topology?.acds||[])for(const d of a.adbs||[]){
     if(d.ecpu!=null&&cpu!==0){d.ecpu=scaleValue(d.ecpu,cpu);d.peerSettingsConfirmed=false;changed++;siteChanged=true;}
     if(d.ramGB!=null&&ram!==0){d.ramGB=scaleValue(d.ramGB,ram);d.peerSettingsConfirmed=false;changed++;siteChanged=true;}
    }
    if(q?.source==='database-topology'){
     if(topology?.databaseTotals)c.requirements={...topology.databaseTotals(c).requirements,minRatio:q.minRatio??2};
     else delete q.topologySignature;
    }
   }
   if(siteChanged){s.planningIntent='workload';s.hardwareChosen=false;}
  }
  if(!changed)throw Error('Enter growth above zero and include at least one sized workload.');
  alternative.notes=`Workload growth from the working plan: ECPUs +${cpu}%; RAM +${ram}%. Missing inputs remain unknown. Recompare hardware before using capacity figures. Storage, performance and failover are not forecast by this option.`;
  if(topology){topology.ensureIds?.({sites:alternative.sites});topology.validateState?.({sites:alternative.sites});}
  return alternative;
 }
 function freshCluster(c,existingNames){
  const copy=clone(c);copy.uid=id('avmc');
  const base=String(c.name||'AVMC').slice(0,60);let suffix=1,name=`${base} (overlap)`;
  while(existingNames.has(key(name)))name=`${base} (overlap ${++suffix})`;
  copy.name=name;existingNames.add(key(name));
  for(const a of copy.topology?.acds||[]){a.id=id('acd');a.peerId='';delete a.peerIds;a.role='unprotected';for(const d of a.adbs||[]){d.id=id('adb');d.peerSettingsConfirmed=false;}}
  if(copy.requirements?.source==='database-topology')delete copy.requirements.topologySignature;
  return copy;
 }
 function migration(state,opts,model,topology){
  const selected=opts.clusterIndexes;
  if(!Number.isInteger(opts.siteIndex)||!state.sites[opts.siteIndex])throw Error('Choose an existing machine.');
  const source=state.sites[opts.siteIndex];
  if(!Array.isArray(selected)||!selected.length||new Set(selected).size!==selected.length||selected.some(i=>!Number.isInteger(i)||!source.clusters[i]))throw Error('Choose at least one AVMC to run twice during the overlap.');
  if(source.clusters.length+selected.length>32)throw Error('The overlap would exceed the calculator limit of 32 AVMCs per machine.');
  const a=capture(state,opts.name,'migration',model),target=a.sites[opts.siteIndex],names=new Set(target.clusters.map(c=>key(c.name)));
  target.clusters.push(...selected.map(i=>{
   const copied=freshCluster(source.clusters[i],names);
   if(copied.requirements?.source==='database-topology'&&topology?.databaseTotals)copied.requirements={...topology.databaseTotals(copied).requirements,minRatio:copied.requirements.minRatio??2};
   return copied;
  }));
  a.notes=`Temporary coexistence: ${selected.length} AVMC allocation(s) copied on ${source.name}. Both old and new allocations consume resources. Copied ACDs have no DR peer links. This is a capacity comparison, not an execution or migration supportability plan.`;
  if(topology){topology.ensureIds?.({sites:a.sites});topology.validateState?.({sites:a.sites});}
  return a;
 }
 function parseCSV(input){
  if(typeof input!=='string'||input.length>MAX_CSV_CHARS)throw Error('Use a CSV file of at most 2 MB of text.');
  const source=input.replace(/^\uFEFF/,'');let row=[],cell='',quoted=false,closed=false,line=1,startLine=1;const records=[];
  function finishCell(){row.push(cell);cell='';closed=false;}
  function finishRow(){finishCell();if(row.some(v=>v.trim()!==''))records.push({line:startLine,cells:row});row=[];startLine=line+1;if(records.length>MAX_CSV_ROWS+1)throw Error(`Use at most ${MAX_CSV_ROWS} data rows.`);}
  for(let i=0;i<source.length;i++){
   const ch=source[i];
   if(quoted){if(ch==='"'){if(source[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else{cell+=ch;if(ch==='\n')line++;}continue;}
   if(closed&&ch!==','&&ch!=='\r'&&ch!=='\n')throw Error(`Line ${line}: unexpected text after a closing quote.`);
   if(ch==='"'){if(cell!=='')throw Error(`Line ${line}: a quote must start a field.`);quoted=true;}
   else if(ch===',')finishCell();
   else if(ch==='\n'||ch==='\r'){finishRow();if(ch==='\r'&&source[i+1]==='\n')i++;line++;startLine=line;}
   else cell+=ch;
  }
  if(quoted)throw Error(`Line ${startLine}: quoted field is not closed.`);
  if(cell!==''||row.length||closed)finishRow();
  if(!records.length)throw Error('The CSV is empty.');
  const headers=records.shift().cells.map(h=>h.trim());
  if(headers.some(h=>!h))throw Error('Every CSV column needs a header.');
  if(new Set(headers.map(cleanHeader)).size!==headers.length)throw Error('CSV column headers must be unique.');
  return {headers,rows:records};
 }
 function defaultMapping(headers){const map={};for(const f of FIELDS){const i=headers.findIndex(h=>f.aliases.includes(cleanHeader(h)));map[f.key]=i<0?null:i;}return map;}
 function prepareWorksheetRows(rows,headerRow=1){
  if(!Array.isArray(rows)||!Number.isInteger(headerRow)||headerRow<1||headerRow>rows.length)throw Error('Choose a header row within the worksheet.');
  const nonempty=value=>value!==null&&value!==undefined&&String(value).trim()!=='';
  const selected=rows.slice(headerRow-1).map((row,i)=>({row:Array.isArray(row)?row:[],sourceRow:headerRow+i})).filter((item,i)=>i===0||item.row.some(nonempty));
  if(selected.length<2)throw Error('This worksheet selection has no database rows.');
  if(selected.length>MAX_CSV_ROWS+1)throw Error(`Use at most ${MAX_CSV_ROWS} populated database rows.`);
  const width=selected.reduce((max,item)=>Math.max(max,item.row.length),0),columns=[];
  for(let i=0;i<width;i++)if(selected.some(item=>nonempty(item.row[i])))columns.push(i);
  if(!columns.length)throw Error('The selected worksheet range is empty.');
  const warnings=[];if(columns.length<width)warnings.push(`${width-columns.length} wholly empty worksheet column(s) omitted.`);
  const normalized=selected.map(item=>columns.map(i=>item.row[i]??''));
  const used=new Set(normalized[0].filter(nonempty).map(cleanHeader));let renamed=0;
  normalized[0]=normalized[0].map((value,i)=>{
   if(nonempty(value))return String(value);
   let label=`Column ${columns[i]+1}`,suffix=1;while(used.has(cleanHeader(label)))label=`Column ${columns[i]+1} (${++suffix})`;
   used.add(cleanHeader(label));renamed++;return label;
  });
  if(renamed)warnings.push(`${renamed} blank worksheet header(s) labelled Column N for explicit mapping. No field meaning was inferred.`);
  return {rows:normalized,sourceRows:selected.map(item=>item.sourceRow),warnings};
 }
 function mappedIndex(mapping,field,headers){const v=mapping[field];if(v===null||v===undefined||v==='')return null;const i=typeof v==='string'&&!/^\d+$/.test(v)?headers.indexOf(v):Number(v);return Number.isInteger(i)&&i>=0&&i<headers.length?i:null;}
 function previewCSV(input,mapping){
  const parsed=typeof input==='string'?parseCSV(input):input;
  if(!parsed||!Array.isArray(parsed.headers)||!Array.isArray(parsed.rows))throw Error('Read the CSV headers first.');
  const map=mapping||defaultMapping(parsed.headers),errors=[],warnings=[],rows=[],identities=new Set(),groups=new Map(),headerLine=parsed.headerLine||1;
  const issue=(line,message)=>errors.push({line,message});
  const indexes={};for(const f of FIELDS){indexes[f.key]=mappedIndex(map,f.key,parsed.headers);if(f.required&&indexes[f.key]===null)issue(headerLine,`Map the ${f.label} column.`);}
  const mapped=Object.values(indexes).filter(v=>v!==null);if(new Set(mapped).size!==mapped.length)issue(headerLine,'Use each source column once in the mapping.');
  if(indexes.ecpu!==null&&/(?:^|[_\s])(o?vcpu|ocpu)(?:s|[_\s]|$)/i.test(parsed.headers[indexes.ecpu]))issue(headerLine,'OCPU and vCPU values cannot be imported as ECPUs. Convert and label them explicitly before importing.');
  if(indexes.ecpu===null&&parsed.headers.some(h=>/ocpu|vcpu/i.test(h)))issue(headerLine,'This file contains OCPU or vCPU columns. Convert and label ECPU demand explicitly before importing.');
  if(!parsed.rows.length)issue(headerLine,'Add at least one database row.');
  for(const record of parsed.rows){
   const out={line:record.line};if(record.cells.length!==parsed.headers.length){issue(record.line,`Expected ${parsed.headers.length} fields, found ${record.cells.length}.`);continue;}
   const get=k=>indexes[k]===null?'':record.cells[indexes[k]].trim();
   for(const f of FIELDS.filter(f=>f.required)){out[f.key]=get(f.key);if(!out[f.key])issue(record.line,`${f.label} is required.`);else if(out[f.key].length>80)issue(record.line,`${f.label} must be at most 80 characters.`);}
   const role=get('role').toLowerCase();out.role=role||'unprotected';if(!['primary','standby','unprotected'].includes(out.role))issue(record.line,'ACD role must be primary, standby or unprotected.');
   const unit=get('cpu_unit');if(unit&&unit.toUpperCase()!=='ECPU')issue(record.line,'CPU unit must be ECPU. OCPU/vCPU conversion is not performed.');
   for(const [field,max]of [['ecpu',100000],['ram_gb',1000000],['storage_tb',1000000]]){
    const raw=get(field);out[field]=raw===''?null:Number(raw);
    if(raw!==''&&(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)||!Number.isFinite(out[field])||out[field]<0||out[field]>max))issue(record.line,`${field}: use a plain non-negative number, or leave it blank if unknown.`);
   }
   const independent=get('independent_switchover').toLowerCase();out.independent_switchover=['true','yes','1'].includes(independent);
   if(independent&&!['true','yes','1','false','no','0'].includes(independent))issue(record.line,'Independent switchover must be yes/no or true/false.');
   const identity=['site','machine','avmc','acd','adb'].map(k=>key(out[k])).join('\u0000');if(identities.has(identity))issue(record.line,'Duplicate database in the same Site / Machine / AVMC / ACD path.');identities.add(identity);
   const acdKey=['site','machine','avmc','acd'].map(k=>key(out[k])).join('\u0000');if(groups.has(acdKey)&&groups.get(acdKey)!==out.role)issue(record.line,'All databases in the same ACD must use the same ACD role.');groups.set(acdKey,out.role);
   rows.push(out);
  }
  const machines=new Set(rows.map(r=>key(r.site)+'\u0000'+key(r.machine))),avmcs=new Set(rows.map(r=>[r.site,r.machine,r.avmc].map(key).join('\u0000')));
  if(machines.size>8)issue(headerLine,'One plan can contain at most eight machines.');
  for(const avmc of avmcs){const count=new Set(rows.filter(r=>[r.site,r.machine,r.avmc].map(key).join('\u0000')===avmc).map(r=>key(r.acd))).size;if(count>16)issue(headerLine,'An AVMC in this file contains more than 16 named ACDs. Split it before importing.');}
  const incomplete=rows.filter(r=>r.ecpu===null||r.ram_gb===null).length;
  if(incomplete)warnings.push(`${incomplete} database row(s) have unknown CPU or RAM. Blank values remain unknown.`);
  if(indexes.role===null||parsed.rows.some(r=>!r.cells[indexes.role]?.trim()))warnings.push('Blank ACD roles are imported as unprotected. Confirm protection requirements and add peer links after import.');
  if(rows.some(r=>r.role!=='unprotected'))warnings.push('DR peer links are not inferred from names. Link and review the imported ACDs separately.');
  warnings.push('Only database inventory is imported. Existing aggregate workload sizing is not replaced automatically; use database totals explicitly after review.');
  return {headers:parsed.headers,mapping:indexes,rows,errors,warnings,summary:{machines:machines.size,avmcs:avmcs.size,acds:groups.size,adbs:rows.length,incomplete}};
 }
 function newMachine(row,model){const s=model.newSite(row.machine);s.uid=id('machine');s.siteName=row.site;s.clusters=[];s.planningIntent='workload';s.hardwareChosen=false;return s;}
 function newCluster(row,s){return {uid:id('avmc'),name:row.avmc,slots:1,nodes:s.nodes.map(n=>n.id),cpu:40,memoryPerCPU:2,memoryRule:'current',topology:{acds:[]}};}
 function untouchedStartingEntry(state,model){
  if(state.sites.length!==1)return false;
  const actual=clone(state.sites[0]);delete actual.uid;
  const expected=model.newSite('Machine 1');expected.siteName='';expected.clusters=[];expected.planningIntent='workload';expected.hardwareChosen=false;
  const fields=Object.keys(expected);
  return Object.keys(actual).length===fields.length&&fields.every(k=>JSON.stringify(actual[k])===JSON.stringify(expected[k]));
 }
 function buildCSVImport(state,preview,opts,model,topology){
  if(!preview||!Array.isArray(preview.rows)||preview.errors?.length)throw Error('Resolve the CSV errors before applying.');
  if(!['add','replace-active'].includes(opts.mode))throw Error('Choose Add inventory or Replace active machine inventory.');
  const next=clone(state),warnings=[...preview.warnings],affected=new Set(),removedACDs=new Set();
  const startingEntryReplaced=opts.mode==='add'&&untouchedStartingEntry(state,model);
  if(startingEntryReplaced){next.sites=[];warnings.push('The unused empty starting entry will be replaced by the imported machine(s).');}
  if(opts.mode==='replace-active'){
   const target=next.sites[opts.siteIndex];if(!target)throw Error('Choose the active machine to replace.');
   if(preview.rows.some(r=>key(r.site)!==key(target.siteName)||key(r.machine)!==key(target.name)))throw Error('For replacement, every row must match the active machine site and name. Use Add inventory for multiple machines.');
   for(const c of target.clusters){for(const a of c.topology?.acds||[])removedACDs.add(a.id);c.topology={acds:[]};if(c.requirements)c.requirements.incomplete=true;}
   affected.add(opts.siteIndex);warnings.push('The active machine’s named ACD/ADB inventory will be replaced. AVMC allocations and reserved slots are retained.');
  }
  for(const s of next.sites)for(const c of s.clusters)for(const a of c.topology?.acds||[]){
   if(removedACDs.has(a.peerId)){a.peerId='';warnings.push('A peer link to replaced inventory will be cleared.');}
   if(a.peerIds?.some(peer=>removedACDs.has(peer))){a.peerIds=a.peerIds.filter(peer=>!removedACDs.has(peer));warnings.push('A peer link to replaced inventory will be cleared.');}
  }
  const report={machinesAdded:0,avmcsAdded:0,acdsAdded:0,adbsAdded:0,startingEntryReplaced};
  for(const row of preview.rows){
   const matches=next.sites.map((s,i)=>({s,i})).filter(({s})=>key(s.siteName)===key(row.site)&&key(s.name)===key(row.machine));
   if(matches.length>1)throw Error(`Line ${row.line}: more than one existing machine matches this site and name. Rename them before importing.`);
   let s,index;if(matches.length){s=matches[0].s;index=matches[0].i;}else{if(next.sites.length>=8)throw Error('Adding this file would exceed eight machines. Remove an unused machine or use a separate plan.');s=newMachine(row,model);next.sites.push(s);index=next.sites.length-1;report.machinesAdded++;}
   affected.add(index);
   const clusters=s.clusters.filter(c=>key(c.name)===key(row.avmc));if(clusters.length>1)throw Error(`Line ${row.line}: AVMC name is ambiguous on this machine.`);
   let c=clusters[0];if(!c){if(s.clusters.length>=32)throw Error('The import would exceed 32 AVMCs on one machine.');c=newCluster(row,s);s.clusters.push(c);report.avmcsAdded++;}
   c.topology??={acds:[]};const acds=c.topology.acds.filter(a=>key(a.name)===key(row.acd));if(acds.length>1)throw Error(`Line ${row.line}: ACD name is ambiguous in this AVMC.`);
   let a=acds[0];if(!a){if(c.topology.acds.length>=16)throw Error(`Line ${row.line}: the combined inventory exceeds 16 ACDs in this AVMC.`);a={id:id('acd'),name:row.acd,role:row.role,peerId:'',adbs:[]};c.topology.acds.push(a);report.acdsAdded++;}
   else if(a.role!==row.role)throw Error(`Line ${row.line}: ACD role conflicts with the existing inventory.`);
   if(a.adbs.some(d=>key(d.name)===key(row.adb)))throw Error(`Line ${row.line}: this database already exists. Use replacement only if you intend to replace the active machine inventory.`);
   if(a.adbs.length>=1000)throw Error(`Line ${row.line}: the ACD exceeds the calculator input guard of 1,000 database records.`);
   a.adbs.push({id:id('adb'),name:row.adb,ecpu:row.ecpu,ramGB:row.ram_gb,storageTB:row.storage_tb,independentSwitchover:row.independent_switchover});report.adbsAdded++;
   if(c.topology.acds.length>c.slots){c.slots=c.topology.acds.length;warnings.push(`${c.name}: maximum ACD slots will increase to ${c.slots} to hold the imported inventory.`);if(s.planningIntent!=='allocation')s.hardwareChosen=false;}
   if(c.requirements){c.requirements.incomplete=true;delete c.requirements.topologySignature;delete c.requirements.acdEcpus;}
  }
  next.sites.forEach(model.validate);
  if(topology){topology.ensureIds?.(next);topology.validateState?.(next);}
  return {candidate:next,report,warnings:[...new Set(warnings)],affected:[...affected]};
 }
 function applyCSV(state,preview,opts,model,topology){return buildCSVImport(state,preview,opts,model,topology).candidate;}
 function csvCell(value){let str=String(value??'');if(/^[=+@\-\t\r]/.test(str))str="'"+str;return /[",\r\n]/.test(str)?'"'+str.replace(/"/g,'""')+'"':str;}
 function template(){return FIELDS.map(f=>f.key).join(',')+'\r\n'+['DC','Production','Core apps','Payments','PaymentsDB','unprotected','16','64','1','yes','ECPU'].map(csvCell).join(',')+'\r\n';}
 return {MAX_ALTERNATIVES,MAX_CSV_ROWS,FIELDS,validateProject,validateExtras,preserveExtras,capture,restore,compare,growth,migration,parseCSV,defaultMapping,prepareWorksheetRows,previewCSV,buildCSVImport,applyCSV,template};
});
