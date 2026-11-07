'use strict';
const VMC=window.ExaConventional;
function conventionalStatus(){
 const box=$('conventional-status');if(!box)return;
 const info=VMC.inspect(site()),show=x=>x===null?'Unknown':fmt(x);
 box.innerHTML=`${info.totals&&info.clusters?`<p><strong>Listed VMC footprint:</strong> ${show(info.totals.otherLocal)} GB local · ${show(info.totals.otherCPU)} ECPUs · ${show(info.totals.otherMemory)} GB memory · ${info.totals.otherVMs} VMs across selected DB servers.</p>`:''}${info.applied&&!info.pending&&!info.errors.length?'<p class="issues fit">This footprint is included in Other allocations. It is counted once in the machine totals.</p>':''}${info.errors.length?`<div class="issues error">${info.errors.map(escapeHTML).join('<br>')}</div>`:''}${info.warnings.length?`<div class="issues warning">${info.warnings.map(escapeHTML).join('<br>')}</div>`:''}`;
}
function renderConventional(){
 const box=$('conventional-editor');if(!box)return;
 const cfg=VMC.config(site());
 box.innerHTML=`<p class="hint">Record conventional VM clusters separately from AVMCs. Enter the <strong>full allocated local footprint per VM</strong>, including VM image and any backups stored on DB-server disks. Filesystem sizes alone may not equal the reserved local footprint. Exascale storage is separate. <a href="${VMC.SOURCES.storage}" target="_blank" rel="noopener noreferrer">Oracle VM storage guidance</a>.</p><p class="hint">CPU inputs use ECPU capacity units. X11M conventional VMCs use ECPUs; this tool does not convert older OCPU allocations. Confirm normalized values before entering them. VM-slot limits use this machine's configuration and still need mixed-service validation.</p><button type="button" data-vmc-action="add">+ Add conventional VMC</button>
 <div class="conventional-list">${cfg.clusters.map((c,i)=>`<details class="cluster cluster-editor" open><summary>${escapeHTML(c.name)}</summary><div class="editor-body"><div class="fields"><label>VMC name<input data-vmc="${i}" data-key="name" maxlength="80" value="${escapeHTML(c.name)}"></label><label>Value source<select data-vmc="${i}" data-key="source"><option value="console" ${c.source==='console'?'selected':''}>Console allocation</option><option value="proposal" ${c.source==='proposal'?'selected':''}>Proposed allocation</option></select></label></div><fieldset class="node-choices"><legend>Recorded on DB servers</legend>${site().nodes.map(n=>`<label><input type="checkbox" data-vmc-node="${i}" data-server="${n.id}" ${c.nodes.includes(n.id)?'checked':''}>DB ${n.id}</label>`).join('')}</fieldset><div class="fields growth-fields">${[['localPerVM','Total local GB per VM'],['cpuPerVM','ECPUs per VM'],['memoryPerVM','Memory GB per VM']].map(([key,label])=>`<label>${label}<input type="number" min="0" step="0.1" data-vmc="${i}" data-key="${key}" value="${c[key]??''}" placeholder="Unknown" aria-label="${escapeHTML(c.name)} ${label}"></label>`).join('')}</div><label>Source / notes<input data-vmc="${i}" data-key="notes" maxlength="1000" value="${escapeHTML(c.notes||'')}" placeholder="Console check date or sizing assumption"></label><div class="editor-actions"><button class="remove" data-vmc-action="remove" data-index="${i}">Remove VMC record</button></div></div></details>`).join('')}</div>
 <div id="conventional-status"></div>${cfg.clusters.length||cfg.applied?`<label class="check"><input id="vmc-already-included" type="checkbox">The current Other values already include the complete VMC footprint listed here.</label><p class="hint">Leave unchecked to add new allocations, or replace this tool's previously tracked contribution. Check it only to reconcile totals that already include these VMCs.</p><div class="actions"><button type="button" class="primary" data-vmc-action="apply">${cfg.applied?'Update included VMC allocations':'Include VMCs in machine totals'}</button>${cfg.applied?'<button type="button" data-vmc-action="exclude">Remove tracked VMC allocations from totals</button>':''}</div>`:''}`;
 conventionalStatus();
}
function initConventional(){
 const box=$('conventional-editor');if(!box)return;
 box.onchange=event=>{
  const el=event.target;
  if(el.dataset.vmc!==undefined){safeUpdate(()=>{const c=VMC.config(site()).clusters[Number(el.dataset.vmc)],key=el.dataset.key;if(['localPerVM','cpuPerVM','memoryPerVM'].includes(key))c[key]=el.value===''?null:Number(el.value);else if(['name','source','notes'].includes(key))c[key]=el.value;VMC.validate(site());});conventionalStatus();}
  else if(el.dataset.vmcNode!==undefined){safeUpdate(()=>{const c=VMC.config(site()).clusters[Number(el.dataset.vmcNode)],id=Number(el.dataset.server);c.nodes=el.checked?[...c.nodes,id].sort((a,b)=>a-b):c.nodes.filter(n=>n!==id);VMC.validate(site());});conventionalStatus();}
 };
 // Keep typed values in the plan before Apply, even if the browser has not blurred the field.
 box.oninput=event=>{if(event.target.dataset.vmc!==undefined)box.onchange(event);};
 box.onclick=event=>{
  const button=event.target.closest('[data-vmc-action]');if(!button)return;
  const action=button.dataset.vmcAction;
  if(action==='add')safeUpdate(()=>{const s=structuredClone(site());if(s.conventional==null)s.conventional={clusters:[],applied:null};VMC.validate(s);s.conventional.clusters.push(VMC.newCluster(s));VMC.validate(s);state.sites[active]=s;},true);
  else if(action==='remove')safeUpdate(()=>{VMC.config(site()).clusters.splice(Number(button.dataset.index),1);},true);
  else if(action==='apply'){const included=$('vmc-already-included')?.checked===true;safeUpdate(()=>{state.sites[active]=VMC.applyToOther(site(),{alreadyIncluded:included});},true);}
  else if(action==='exclude')safeUpdate(()=>{state.sites[active]=VMC.removeFromOther(site());},true);
 };
}
