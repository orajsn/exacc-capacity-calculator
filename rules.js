(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaRules=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const VERSION='exacc-avmc/2026-11-07',CHECKED='2026-11-07',MEMORY_CUTOFF='2026-09-29';
 const SCOPE='Autonomous Database Dedicated on Exadata Cloud@Customer; X11M presets and manually confirmed console values';
 const links={
  create:'https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/create-an-autonomous-exadata-vm-cluster.html',
  shapes:'https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/characteristics-of-infrastructure-shapes.html',
  capacity:'https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/plan-and-observe-capacity-for-autonomous-ai-database-on.html',
  compute:'https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/compute-management-in-autonomous-ai-database-on-dedicated.html',
  manage:'https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/manage-autonomous-exadata-vm-clusters.html',
  memoryFeature:'https://docs.oracle.com/en-us/iaas/releasenotes/autonomous-database-dedicated/adbd-avmc-mng-enh.htm'
 };
 const entry=(id,label,status,formula,sourceUrls,notes)=>({id,label,status,scope:SCOPE,formula,sourceUrls,verifiedOn:CHECKED,notes});
 const rules=[
  entry('avmc.local.v1','AVMC local reservation','documented','[imageGB + (100 + 50 × maximumACDs) × 1.03 + 2 + extraGB] × VMcount',[links.create],'X11M image is 184 GB. Extra GB is a user-entered allowance. Check every selected DB server.'),
  entry('avmc.memory.current','Current AVMC memory','documented','max(135, [ECPUperVM × GBperECPU + 40 + 0.3 × ECPUperVM] × 1.02) × VMcount',[links.create],'Current rule applies after 29 September 2026 or after memory per CPU changes. Exact cutoff-day and console rounding require confirmation.'),
  entry('avmc.memory.legacy','Confirmed legacy memory','documented','[ECPUperVM × GBperECPU + 40] × 1.02 × VMcount',[links.create],'Requires confirmed pre-cutoff creation and unchanged memory ratio. Unknown history uses the conservative current estimate.'),
  entry('avmc.creation.minimum','AVMC creation checks','source-conflict','At least 2 DB servers; 40 ECPUs per VM; current memory budget at least 135 GB per VM',[links.create,links.shapes,links.capacity],'The task-specific creation page takes precedence over inconsistent summary tables. Shared storage and console eligibility are separate checks.'),
  entry('acd.maximum','ACD slots per AVMC','documented','Maximum 16 ACDs per AVMC',[links.capacity],'Configured slots reserve local space. They are not proof that the ACDs exist or can be provisioned immediately.'),
  entry('acd.creation.cpu','ACD creation CPU floor','documented','8 available ECPUs per selected DB server for each ACD',[links.compute],'Already provisioned databases can consume the initial ACD allocation. Do not add this floor twice to the same workload.'),
  entry('cpu.lifecycle','Available, reserved and reclaimable CPU','documented',null,[links.compute],'Provisionability depends on the ACD/AVMC CPU pools. Autoscaling draws on idle CPU in the parent ACD; terminated or reduced allocations may remain reclaimable until ACD restart.'),
  entry('x11m.exacc.preset','X11M Autonomous DB-server presets','documented','Base: 120 ECPU, 660 GB RAM, 1084 GB local, 2 VM slots. Std/L/XL: 760 ECPU, 1390/2090/2800 GB RAM, 2243 GB local, 6 VM slots.',[links.shapes],'These are ExaC@C Autonomous values, not Public Cloud or conventional VMC limits. Existing and mixed-service capacity requires console confirmation.'),
  entry('sizing.allowance','Workload planning allowance','planning-assumption','Extra planned ECPU percentage; initially 50%',[],'This is not Oracle’s computed node failover reservation. ACD floors and the AVMC minimum are included separately.'),
  entry('sizing.memory','Aggregate workload memory sizing','planning-assumption','Choose a 2–5 GB/ECPU ratio in 0.5 GB steps; raise proposed database ECPUs when RAM needs more than 5 GB per entered ECPU.',[links.create],'A memory-driven CPU increase is a proposed ADB allocation change. Aggregate AVMC capacity cannot prove individual ADB memory or performance fit.'),
  entry('resize.eligibility','Capacity release versus allowed resize','documented',null,[links.manage,links.create],'Console slider minima, CPU reservations, used storage and maintenance impact must be reviewed. A capacity estimate is not an in-place resize plan.'),
  entry('buffer.target','Preferred free capacity','planning-assumption','Free = capacity − allocated; buffer target = capacity × preferred percentage',[],'Missing a buffer warns; exceeding a physical or service limit fails the relevant capacity check.')
 ];
 const conflicts=[
  {id:'minimum-cpu',label:'AVMC CPU minimum differs between pages',details:'The creation procedure requires 40 ECPUs per VM; the hardware shape table lists 20.',handling:'Use 40 for new-creation planning. An older existing allocation is not proven unsupported by this check; confirm its console resize limits.',sourceUrls:[links.create,links.shapes]},
  {id:'minimum-memory',label:'AVMC memory minimum differs between pages',details:'The current creation page requires 135 GB per VM; the capacity overview still says 120 GB.',handling:'Use the current formula and budget at least 135 GB per VM for a new AVMC.',sourceUrls:[links.create,links.capacity]},
  {id:'local-examples',label:'Local-storage examples do not reconcile',details:'For one ACD on two X11M nodes the detailed formula gives 681 GB; the worked total says 682 GB and the minimum summary says 338.5 GB per node.',handling:'Apply the detailed formula consistently; reconcile the final reservation with OCI.',sourceUrls:[links.create,links.capacity]},
  {id:'per-vm-local-scope',label:'Per-VM local figure needs scope confirmation',details:'The shapes table lists 900 GB usable local storage per VM; a 16-ACD configuration gives a 900 GB u02 filesystem before image and overhead.',handling:'Do not treat 900 GB as a cap on total image-plus-filesystem reservation without confirmation.',sourceUrls:[links.shapes,links.create]},
  {id:'memory-dates',resolved:true,label:'Feature date and formula cutoff are different',details:'The 22 September feature announcement concerns changing SGA/memory settings; the current creation page uses 29 September for the new memory formula.',handling:'Use 29 September as the documented cutoff; do not infer it from the feature announcement date.',sourceUrls:[links.create,links.memoryFeature]}
 ];
 const coverage=[
  {id:'local',label:'AVMC local storage',state:'supported',description:'Detailed reservations and available space are checked on every selected DB server.',ruleIds:['avmc.local.v1','acd.maximum']},
  {id:'cpu-memory',label:'AVMC CPU and memory footprint',state:'supported',description:'Enabled allocation checks compare each DB server with its capacity and confirmed memory rule.',ruleIds:['avmc.memory.current','avmc.memory.legacy','avmc.creation.minimum']},
  {id:'hardware',label:'X11M Autonomous presets',state:'supported',description:'ExaC@C Base, Standard, Large and Extra Large presets; other/mixed configurations use confirmed console inputs.',ruleIds:['x11m.exacc.preset']},
  {id:'workload',label:'Workload sizing',state:'partial',description:'Aggregate ECPU/RAM estimates and ACD floors; individual database placement, memory entitlement and performance need review.',ruleIds:['acd.creation.cpu','sizing.allowance','sizing.memory']},
  {id:'provisionability',label:'Immediate provisioning and resizing',state:'partial',description:'Available/reserved/reclaimable pools, quotas and console eligibility are not fetched or fully simulated.',ruleIds:['cpu.lifecycle','resize.eligibility']},
  {id:'shared-storage',label:'Shared Exadata storage',state:'partial',description:'Manually entered usable and allocated totals can be compared; storage-server selection and detailed backup sizing are separate.',ruleIds:[]},
  {id:'failure',label:'Failure and application availability',state:'outside-scope',description:'Capacity arithmetic does not certify failover reservations, service objectives, connection continuity or workload performance.',ruleIds:['cpu.lifecycle']},
  {id:'conventional',label:'Conventional VMC formulas',state:'outside-scope',description:'Use a separately scoped conventional footprint model; AVMC formulas and VM limits must not be reused.',ruleIds:[]},
  {id:'commercial',label:'Price and licence entitlement',state:'outside-scope',description:'No price ranking, quote or licence entitlement determination is made.',ruleIds:[]}
 ];
 function get(id){return rules.find(rule=>rule.id===id)||null;}
 function assess(site,result,planning){
  const errors=[...(result?.errors||[])],warnings=[...(result?.warnings||[])];
  const known=site.planningIntent!=='workload'||site.hardwareChosen!==false;
  const memoryAdjustments=(site.clusters||[]).filter(c=>c.sizingDetail?.needsDatabaseCPUIncrease&&c.sizingDetail.requirementsSignature===JSON.stringify(c.requirements)&&c.sizingDetail.allocatedECPUPerVM===c.cpu&&c.sizingDetail.memoryPerCPU===c.memoryPerCPU&&c.sizingDetail.vmCount===c.nodes.length).map(c=>({name:c.name,...c.sizingDetail}));
  for(const row of memoryAdjustments)warnings.push(`${row.name}: proposed database ECPUs increase from ${row.requestedWorkloadECPU} to ${row.plannedWorkloadECPU} to meet the RAM input; review individual ADB allocations.`);
  let budgets=[];
  try{if(planning)budgets=planning.resources(site,result);}catch(e){errors.push(e.message);}
  if(budgets.some(b=>b.status==='Over capacity'))errors.push('One or more entered resource budgets exceed capacity.');
  if(budgets.some(b=>b.status==='Below buffer'))warnings.push('One or more preferred free-capacity targets are not met.');
  const incomplete=!known||!site.checkCompute||!result;
  const status=errors.length?'over-limit':incomplete?'incomplete':warnings.length?'fits-with-warnings':'fits-checked';
  const label=status==='over-limit'?'Exceeds a checked limit':status==='incomplete'?'Some capacity checks are incomplete':status==='fits-with-warnings'?'Fits checked capacity with conditions':'Fits checked DB-server capacity';
  const checks=[
   'Confirm available, reserved and reclaimable CPU at the AVMC and ACD levels.',
   'Confirm actual ACD/ADB placement, per-database memory and node-failover reservations.',
   'Confirm shared storage, backups, quotas and applicable console minimums.',
   'Plan maintenance and validate application behaviour before a live change.'
  ];
  if(site.profile==='custom')checks.unshift('Confirm every custom capacity and mixed-service VM limit from the infrastructure console.');
  if((site.clusters||[]).some(c=>(c.topology?.acds?.length||c.slots)*8>c.cpu))checks.unshift('The configured CPU may not create every planned ACD at its per-node creation minimum.');
  return {ruleVersion:VERSION,verifiedOn:CHECKED,scope:SCOPE,hardware:{status,label,errors:[...new Set(errors)],warnings:[...new Set(warnings)]},provisioning:{status:'not-verified',label:'Provisionability requires console confirmation',checks},coverage:coverage.map(row=>({...row})),conflicts:conflicts.map(row=>({...row})),memoryAdjustments};
 }
 return {VERSION,CHECKED,MEMORY_CUTOFF,SCOPE,links,rules,registry:rules,conflicts,coverage,get,assess};
});
