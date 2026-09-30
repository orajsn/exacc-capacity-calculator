'use strict';

let activeAVMCEditor = 0;
const openComputeEditors = new Set();

function renderClusterEditors(s) {
 if (activeAVMCEditor >= s.clusters.length) activeAVMCEditor = s.clusters.length - 1;
 $('clusters').innerHTML = s.clusters.length ? s.clusters.map((c,i) => `
  <details class="cluster cluster-editor" id="cluster-editor-${i}" ${i===activeAVMCEditor?'open':''}>
   <summary data-editor-summary="${i}">
    <span class="editor-summary-name" id="editor-name-summary-${i}">${escapeHTML(c.name)}</span>
    <span class="editor-summary-count" id="editor-count-summary-${i}">${c.slots} max ACDs</span>
    <span class="editor-summary-cost" id="cost-${i}"></span>
   </summary>
   <div class="editor-body">
    <div class="editor-fields">
     <label>AVMC name<input id="editor-name-${i}" value="${escapeHTML(c.name)}" maxlength="80" data-cluster="${i}" data-key="name"></label>
     <label>Maximum ACD slots<input aria-label="${escapeHTML(c.name)} ACD slots" type="number" min="1" max="16" step="1" value="${c.slots}" data-cluster="${i}" data-key="slots"><small>Reserves space for up to this many ACDs.</small></label>
    </div>
    <fieldset class="node-choices"><legend>Runs on DB servers</legend>${s.nodes.map(n=>`<label><input type="checkbox" ${c.nodes.includes(n.id)?'checked':''} data-placement="${i}" data-server="${n.id}">DB ${n.id}</label>`).join('')}</fieldset>
    ${s.checkCompute?`<details class="compute-settings" id="compute-settings-${i}" ${openComputeEditors.has(i)?'open':''}><summary id="compute-summary-${i}" data-compute-summary="${i}">CPU &amp; memory · ${c.cpu} ECPUs/VM · ${c.memoryPerCPU} GB/ECPU</summary>
     <div class="editor-fields"><label>ECPUs per VM<input type="number" min="40" step="1" value="${c.cpu}" data-cluster="${i}" data-key="cpu"></label><label>Memory per ECPU (GB)<input type="number" min="2" max="5" step="0.5" value="${c.memoryPerCPU}" data-cluster="${i}" data-key="memoryPerCPU"></label></div>
     ${memoryChecklist(c,i)}
    </details>`:'<p class="hint">CPU and memory checks are off for this machine.</p>'}
    <div class="editor-actions"><button class="remove" data-remove="${i}" aria-label="Remove ${escapeHTML(c.name)}">Remove AVMC</button></div>
   </div>
  </details>`).join('') : '<p class="empty-editor">No AVMCs yet. Use Add AVMC to start a layout.</p>';
}

function updateEditorSummaries(s) {
 s.clusters.forEach((c,i) => {
  const name=$('editor-name-summary-'+i),count=$('editor-count-summary-'+i),compute=$('compute-summary-'+i);
  if(name)name.textContent=c.name;
  if(count)count.textContent=`${c.slots} max ACDs`;
  if(compute)compute.textContent=`CPU & memory · ${c.cpu} ECPUs/VM · ${c.memoryPerCPU} GB/ECPU`;
 });
}

function openClusterEditor(index, toggle=false, focus=false) {
 if(!Number.isInteger(index)||index<0||index>=site().clusters.length)return;
 if(preview)cancelPreview();
 const target=$('cluster-editor-'+index);
 activeAVMCEditor=toggle&&target?.open?-1:index;
 site().clusters.forEach((_,i)=>{
  const editor=$('cluster-editor-'+i),card=$('map-avmc-'+i);
  if(editor)editor.open=i===activeAVMCEditor;
  if(card)card.setAttribute('data-selected',String(i===activeAVMCEditor));
 });
 if(focus&&target){
  target.scrollIntoView({behavior:'smooth',block:'start'});
  $('editor-name-'+index)?.focus({preventScroll:true});
 }
}

function toggleComputeEditor(index) {
 if(!Number.isInteger(index)||!site().clusters[index])return;
 if(openComputeEditors.has(index))openComputeEditors.delete(index);
 else openComputeEditors.add(index);
 const panel=$('compute-settings-'+index);
 if(panel)panel.open=openComputeEditors.has(index);
}

function clearTopology() {
 $('allocation-map').innerHTML='<p class="issues warning">Check the inputs to update the diagram.</p>';
}

function renderTopology(s,r,isPreview=false) {
 if(!isPreview)updateEditorSummaries(s);
 const overhead=r.costs.reduce((sum,c)=>sum+c.base+c.allowance,0);
 const acd=r.costs.reduce((sum,c)=>sum+c.slots,0);
 const free=Math.max(0,r.free);
 const scale=Math.max(r.capacity,r.used+r.other,1);
 const segments=[['AVMC overhead + extra',overhead,'base'],['ACD slots',acd,'slots'],['Other allocations',r.other,'other'],['Free',free,'free']];
 const nodeIssues=r.nodes.some(n=>n.free < -1e-7);
 const machineTitle=escapeHTML(`${s.siteName||'Unspecified site'} / ${s.name}`);
 $('allocation-map').innerHTML=`
  <div class="topology-machine">
   <div class="topology-machine-title"><strong>${machineTitle}</strong><span class="map-mode">${isPreview?'Preview · not applied':'Editing now'}</span></div>
   <p>${s.nodes.length} DB servers · ${fmt(r.capacity)} GB total local storage</p>
   <div class="topology-bar" role="img" aria-label="${fmt(overhead)} GB AVMC overhead and extra allowance, ${fmt(acd)} GB reserved for ACD slots, ${fmt(r.other)} GB other allocations, ${fmt(r.free)} GB free">${segments.filter(x=>x[1]>0).map(([name,value,kind])=>`<span class="map-fill-${kind}" style="width:${100*value/scale}%" title="${name}: ${fmt(value)} GB"></span>`).join('')}</div>
   <div class="topology-legend">${segments.map(([name,value,kind])=>`<span><i class="map-fill-${kind}"></i>${name}: <strong>${fmt(value)} GB</strong></span>`).join('')}</div>
   ${nodeIssues?'<p class="negative">Local storage is over capacity on at least one DB server.</p>':''}
  </div>
  <div class="topology-branches">${s.clusters.length?s.clusters.map((c,i)=>{
   const cost=r.costs[i],perSlot=cost.slots/c.slots;
   return `<article class="topology-avmc" id="map-avmc-${i}" data-selected="${!isPreview&&i===activeAVMCEditor}">
    <header><div><span class="map-type">AVMC ${i+1}</span><strong>${escapeHTML(c.name)}</strong></div><button data-edit-cluster="${i}" ${isPreview?'disabled':''} aria-label="Edit AVMC ${i+1}: ${escapeHTML(c.name)}">Edit</button></header>
    <div class="map-allocation"><strong>${fmt(cost.total)} GB local</strong><span>${fmt(cost.perVM)} GB/VM · DB ${c.nodes.join(', ')}</span></div>
    <div class="map-slot-group"><span>${c.slots} reserved ACD slot${c.slots===1?'':'s'}</span><div class="slot-grid" aria-label="${c.slots} reserved ACD slots in ${escapeHTML(c.name)}">${Array.from({length:Math.min(c.slots,16)},(_,j)=>`<span class="acd-slot" title="Reserved slot ${j+1}: ${fmt(perSlot)} GB across the selected DB servers">Slot ${j+1}</span>`).join('')}</div>${c.slots>16?'<span class="negative">Over the 16-ACD limit.</span>':''}</div>
    <p class="map-cost-note">${fmt(cost.base)} GB base + ${fmt(cost.slots)} GB ACD slots${cost.allowance?` + ${fmt(cost.allowance)} GB extra`:''}</p>
   </article>`;
  }).join(''):'<p class="hint">Add an AVMC to see its reserved ACD slots here.</p>'}</div>
  <div class="map-server-balances"><strong>Local storage left per DB server</strong>${r.nodes.map(n=>`<span class="${n.free< -1e-7?'negative':n.afterBuffer< -1e-7?'buffer-warning':''}">DB ${n.id}: ${fmt(n.free)} GB</span>`).join('')}</div>
  <p class="hint">Each selected DB server must fit. Free space on one server cannot cover a shortage on another.</p>`;
}

function initLayout() {
 $('allocation-map').onclick=event=>{
  const button=event.target.closest('[data-edit-cluster]');
  if(!button||button.dataset.editCluster===undefined||preview)return;
  openClusterEditor(Number(button.dataset.editCluster),false,true);
 };
}
