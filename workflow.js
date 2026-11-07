'use strict';

let undoSnapshot = null;
let undoStack = [], redoStack = [];
let savedSignature = null;
let savedLabel = 'New scenario · no JSON downloaded';
let preview = null;
let leaveWarningActive = false;

function snapshot() {
 return {state: structuredClone(state), active};
}

function rememberChange(before) {
 if (JSON.stringify(before.state) === JSON.stringify(state)) return;
 try{validateWorkspace(before.state);}catch{return;}
 const previous=undoStack[undoStack.length-1];
 if(!previous||JSON.stringify(previous.state)!==JSON.stringify(before.state))undoStack.push(before);
 if(undoStack.length>20)undoStack.shift();
 redoStack=[];undoSnapshot=undoStack[undoStack.length-1]||null;
}

function hasUnsavedChanges() {
 return JSON.stringify(state) !== savedSignature;
}

function warnBeforeLeaving(event) {
 if (!hasUnsavedChanges()||deviceDraftIsCurrent()) return;
 event.preventDefault();
 event.returnValue = true;
}

function updateSaveReminder() {
 const dirty = hasUnsavedChanges();
 const savedHere=deviceDraftIsCurrent();
 $('save-status').textContent = savedHere?'Saved on this device · JSON is your portable backup':dirty ? 'Unsaved changes · save on device or download JSON' : savedLabel;
 $('save-reminder').hidden = !dirty||savedHere;
 $('dock-unsaved').textContent = dirty ? savedHere?'Saved on this device':'Unsaved changes' : '';
 $('dock-unsaved').hidden = !dirty;
 if (dirty && !leaveWarningActive) window.addEventListener('beforeunload', warnBeforeLeaving);
 if (!dirty && leaveWarningActive) window.removeEventListener('beforeunload', warnBeforeLeaving);
 leaveWarningActive = dirty;
}

function reserveLabel(status) {
 return P.statusText(status);
}

function resourceLabel(name) {
 return P.resourceLabel(name);
}

function cancelPreview() {
 preview = null;
 $('design-preview').hidden = true;
 $('apply-preview').disabled = true;
 $('preview-error').hidden = true;
 try { renderFloatingLocal(site(), M.calculate(site())); }
 catch { clearFloatingLocal('Check the inputs'); }
}

function clearFloatingLocal(note) {
 clearTopology();
 $('local-dock').dataset.level = 'warning';
 $('dock-machine').textContent = `${site().siteName || 'Unspecified site'} / ${site().name}`;
 $('dock-mode').textContent = preview ? 'Preview · not applied' : 'Editing now';
 $('dock-free').textContent = '—';
 for(const prefix of ['dock','dock-cpu','dock-memory']){$(prefix+'-free').textContent='—';$(prefix+'-detail').textContent='Check inputs';$(prefix+'-metric').dataset.level='unchecked';}
 $('dock-scope').disabled=true;$('dock-view-label').textContent='Inputs incomplete';
 site().clusters.forEach((_,i)=>{const cost=$('cost-'+i),total=$('allocation-total-'+i);if(cost)cost.textContent='Check inputs';if(total)total.textContent='Complete valid inputs to update totals.';});
 $('dock-label').textContent = 'Local storage left';
 $('dock-allocation').textContent = note;
 $('dock-status').textContent = 'Enter valid values to update the total.';
 $('dock-save').disabled = !!preview;
 $('dock-save').title = preview ? 'Apply or cancel the preview before saving from this bar.' : '';
}

function renderFloatingLocal(s, result, isPreview = false) {
 renderTopology(s,result,isPreview);
 const scope=$('dock-scope'),signature=`${s.uid||s.name}|${s.nodes.map(n=>n.id).join(',')}`;
 if(scope.dataset.signature!==signature){scope.innerHTML='<option value="machine">Whole machine</option>'+s.nodes.map(n=>`<option value="node:${n.id}">DB ${n.id} only</option>`).join('');scope.value='machine';scope.dataset.signature=signature;}
 const v=window.ExaLiveCapacity.build(s,result,P,{ready:hardwareReady(s),preview:isPreview,scope:scope.value});
 scope.disabled=!hardwareReady(s)&&!isPreview;$('dock-scope-control').hidden=scope.disabled;
 $('local-dock').dataset.level=v.level;
 $('dock-machine').textContent=`${s.siteName||'Site not named'} / ${s.name}`;$('dock-machine').title=$('dock-machine').textContent;
 $('dock-mode').textContent=isPreview?'Preview · not applied':v.level==='draft'?'Workload sizing':'Editing now';
 $('dock-view-label').textContent=v.scopeLabel;
 for(const m of v.metrics){
  const prefix=m.id==='local'?'dock':`dock-${m.id}`,short=m.checked&&m.free< -1e-7;
  const name=m.id==='local'?'Local storage':m.id==='cpu'?'CPU':'Memory (estimate)';
  $(prefix+'-label').textContent=v.level==='draft'&&m.id==='local'?'Hardware not selected':`${isPreview?'Preview · ':''}${name} ${short?'shortfall':'left'}`;
  $(prefix+'-free').textContent=m.checked?`${fmt(short?-m.free:m.free)} ${m.unit}`:'—';
  $(prefix+'-detail').textContent=m.checked?`${fmt(m.allocated)} / ${fmt(m.capacity)} ${m.unit} allocated`:m.reason;
  $(prefix+'-metric').dataset.level=!m.checked?'unchecked':m.status==='Over capacity'?'error':m.status==='Below buffer'?'warning':'fit';
 }
 $('dock-allocation').textContent=hardwareReady(s)||isPreview?`${s.clusters.length} AVMC${s.clusters.length===1?'':'s'} · ${result.slots} max ACD${result.slots===1?'':'s'}`:`${s.clusters.length} AVMC${s.clusters.length===1?'':'s'} planned`;
 $('dock-status').textContent=v.note;
 $('dock-save').disabled=isPreview;$('dock-save').title=isPreview?'Apply or cancel the preview before downloading a backup.':'Download this plan as a portable backup.';
}

function renderNavigation() {
 const nav = $('site-tabs');
 nav.replaceChildren();
 const groups = new Map();
 state.sites.forEach((machine, index) => {
  const location = machine.siteName || 'Unspecified site';
  if (!groups.has(location)) {
   const group = document.createElement('div');
   const heading = document.createElement('h3');
   heading.textContent = location;
   group.append(heading);
   nav.append(group);
   groups.set(location, group);
  }
  const button = document.createElement('button');
  button.textContent = machine.name || `Machine ${index + 1}`;
  button.setAttribute('aria-current', String(index === active));
  button.onclick = () => {
   active = index;
   cancelPreview();
   message('');
   render();
  };
  groups.get(location).append(button);
 });
}

function updateWorkflow() {
 const s = site();
 if(sizingResults&&(sizingResults.active!==active||sizingResults.signature!==JSON.stringify(state)))clearSizingResults();
 updateSaveReminder();
 $('undo').disabled = !undoSnapshot;
 $('redo').disabled = !redoStack.length;
 $('remove-site').disabled = state.sites.length === 1;
 $('duplicate-site').disabled = state.sites.length >= 8;
 $('active-machine').textContent = `${s.siteName || 'Unspecified site'} / ${s.name}`;
 $('resource-scope').textContent=`Whole-machine totals · ${s.nodes.length} DB servers`;
 $('configuration-stage').textContent = s.baseline ? 'Proposed configuration' : 'Configuration setup';
 $('design-heading').textContent = s.baseline ? 'Edit proposed AVMCs' : 'Edit AVMC allocations';
 $('capture-baseline').textContent = s.baseline ? 'Replace recorded “Before” values' : 'Record “Before” values';
 $('current-summary').textContent = s.baseline
  ? `Recorded “Before”: ${s.baseline.avmcs} AVMCs · ${s.baseline.slots} ACD slots · ${fmt(s.baseline.local)} GB local allocated. Edit the allocations below; the Before / After table will show the difference. These recorded totals stay fixed until you replace or remove them.`
  : 'Optional: record the numbers you have entered, then edit the design to compare Before versus After. Skip this if you only need capacity totals.';
 if (preview && (preview.active !== active || preview.signature !== JSON.stringify(state))) cancelPreview();
 refreshJourney();
 renderTopologyReview();renderAssessment();renderRequirementSources();conventionalStatus();renderScenarioComparison();updateDeviceDraft();
}

function clearResourceCards() {
 $('resource-cards').innerHTML = '<p class="issues error">Complete valid inputs to see resource impact.</p>';
 $('resource-validation').hidden = true;
 updateWorkflow();
 clearFloatingLocal('Check the inputs');
}

function renderResourceCards(s, result) {
 const rows = P.resources(s, result);
 const issues = [...result.errors, ...result.warnings.filter(w => w.includes('memory rule unconfirmed'))];
 $('resource-validation').hidden = !issues.length;
 $('resource-validation').className = result.errors.length ? 'negative' : 'buffer-warning';
 $('resource-validation').textContent = issues.slice(0, 2).join(' ') + (issues.length > 2 ? ' More issues in local storage and server details.' : '');
 const definitions = [['Local storage', 'Local', 'GB'], ['CPU', 'CPU', 'ECPU'], ['Memory estimate', 'Memory estimate', 'GB'], ['Exadata storage (manual)', 'Shared DB storage', 'TB']];
 $('resource-cards').innerHTML = definitions.map(([key, title, unit]) => {
  const row = rows.find(item => item.name === key);
  if (!row) return `<div class="resource-card unchecked"><span>${title}</span><strong>${key === 'Exadata storage (manual)' ? 'Enter capacity' : 'Not checked'}</strong><small>${key === 'Exadata storage (manual)' ? 'Shared database storage · console TB' : 'Enable CPU / memory checks'}</small></div>`;
  const level = row.status === 'Over capacity' ? 'error' : row.status === 'Below buffer' ? 'warning' : 'fit';
  return `<div class="resource-card ${level}"><span>${title}</span><strong>${fmt(row.free)} <small>${unit} free</small></strong><small>${fmt(row.allocated)} / ${fmt(row.capacity)} ${unit} allocated</small><span class="card-status">${reserveLabel(row.status)}</span><small>Buffer target: ${row.percent}% (${fmt(row.buffer)} ${unit})</small></div>`;
 }).join('');
 updateWorkflow();
 renderFloatingLocal(s, result);
}

function showPreview(count, fullCapacity = false) {
 goGuideStep(3);
 M.validate(site());
 P.validate(site());
 const preserve = count === site().clusters.length && site().clusters.every(c => c.nodes.length === site().nodes.length);
 preview = {count, fullCapacity, preserve, active, signature: JSON.stringify(state), candidate: null};
 $('replacement-cpu').value = '';
 $('replacement-ratio').value = '';
 $('replacement-fields').hidden = preserve;
 $('design-preview').hidden = false;
 $('preview-heading').textContent = `Preview: ${count} AVMC${count === 1 ? '' : 's'}${fullCapacity?' · maximum ACDs':''}`;
 $('preview-description').textContent = preserve
  ? 'Names and compute allocations stay the same; only ACD slots change. Compare this option with the design you are editing.'
  : 'Enter the CPU and memory settings to use for each AVMC in this layout. You can edit individual AVMCs afterward.';
 refreshPreview();
 $('design-preview').scrollIntoView({behavior: 'smooth', block: 'start'});
 $('cancel-preview').focus({preventScroll: true});
}

function refreshPreview() {
 if (!preview) return;
 preview.candidate = null;
 $('apply-preview').disabled = true;
 $('preview-error').hidden = true;
 const cpu = $('replacement-cpu').value, ratio = $('replacement-ratio').value;
 if (!preview.preserve && (cpu === '' || ratio === '')) {
  $('preview-results').innerHTML = '<p class="hint">Enter both values to see the result. Your design stays as it is until you choose Use this layout.</p>';
  clearFloatingLocal('Complete both preview values');
  return;
 }
 try {
  const candidate = M.applyDesign(site(), preview.count, {cpu: Number(cpu), memoryPerCPU: Number(ratio)}, preview.fullCapacity);
  P.validate(candidate);
  const current = M.calculate(site()), result = M.calculate(candidate);
  const comparison = P.compare({...candidate, baseline: P.capture(site(), current)}, result);
  const summary = P.summary(candidate, result);
  renderFloatingLocal(candidate, result, true);
  $('preview-results').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Resource</th><th>Editing now</th><th>Preview</th><th>Change</th></tr></thead><tbody>${comparison.map(row => `<tr><td>${resourceLabel(row.name)} (${row.unit})</td><td>${row.before === null ? 'Not checked' : fmt(row.before)}</td><td>${row.after === null ? 'Not checked' : fmt(row.after)}</td><td>${row.delta === null ? 'Not checked' : (row.delta > 0 ? '+' : '') + fmt(row.delta)}</td></tr>`).join('')}</tbody></table></div><p class="issues ${summary.status}">${escapeHTML(summary.text)}${summary.status==='warning'?' You can use this layout; the warning does not block it.':summary.status==='error'?' Adjust the inputs before using this layout.':''}</p><p class="hint">Shared-storage allocation is entered manually and stays unchanged in this preview. ${site().baseline ? 'Your recorded Before totals stay fixed.' : 'Applying will also record your current totals as Before, so you can compare the change.'}</p>`;
  if (!candidate.baseline) candidate.baseline = P.capture(site(), current);
  preview.candidate = summary.status === 'error' ? null : candidate;
  $('apply-preview').disabled = summary.status === 'error';
 } catch (error) {
  $('preview-results').innerHTML = '';
  $('preview-error').textContent = error.message;
  $('preview-error').hidden = false;
  clearFloatingLocal('Check the preview inputs');
 }
}

function initWorkflow() {
 savedSignature = JSON.stringify(state);
 $('save-reminder-button').onclick = () => $('save').click();
 $('dock-save').onclick = () => { if (!preview) $('save').click(); };
 $('dock-findings').onclick=()=>{goGuideStep(4);$('assessment-summary').scrollIntoView({behavior:'smooth',block:'start'});};
 $('dock-scope').onchange=()=>{if(preview&&!preview.candidate){clearFloatingLocal('Complete the preview inputs.');return;}const candidate=preview?.candidate||site();try{renderFloatingLocal(candidate,M.calculate(candidate),!!preview?.candidate);}catch(e){clearFloatingLocal(e.message);}};
 $('open-scenario').addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
   event.preventDefault();
   $('import').click();
  }
 });
 $('undo').onclick = () => {
  if (!undoSnapshot) return;
  redoStack.push(snapshot());const previous=undoStack.pop();
  state = previous.state;
  active = Math.min(previous.active,state.sites.length-1);
  undoSnapshot = undoStack[undoStack.length-1]||null;
  cancelPreview();
  render();
  message('Last change undone.');
 };
 $('redo').onclick=()=>{
  if(!redoStack.length)return;
  undoStack.push(snapshot());const next=redoStack.pop();state=next.state;active=Math.min(next.active,state.sites.length-1);undoSnapshot=undoStack[undoStack.length-1]||null;
  cancelPreview();render();message('Change restored.');
 };
 $('duplicate-site').onclick = () => safeUpdate(() => {
  if (state.sites.length >= 8) throw Error('Up to eight machines per scenario.');
  const copy = T.cloneMachine(site());
  copy.name = `${copy.name.slice(0, 65)} (copy)`;
  state.sites.push(copy);
  active = state.sites.length - 1;
  guideStep=1;
 }, true);
 $('remove-site').onclick = () => safeUpdate(() => {
  if (state.sites.length === 1) throw Error('Keep at least one machine in the scenario.');
  state.sites.splice(active, 1);
  active = Math.min(active, state.sites.length - 1);
 }, true);
 $('cancel-preview').onclick = () => {
  cancelPreview();
  $('compare-heading').focus({preventScroll: true});
 };
 for (const id of ['replacement-cpu', 'replacement-ratio']) $(id).addEventListener('input', refreshPreview);
 $('apply-preview').onclick = () => {
  if (!preview || !preview.candidate) return;
  if (preview.active !== active || preview.signature !== JSON.stringify(state)) {
   cancelPreview();
   message('The design changed. Preview the option again before applying.');
   return;
  }
  const before = snapshot();
  state.sites[active] = preview.candidate;
  rememberChange(before);
  cancelPreview();
  render();
  message('Layout applied to this plan. Use Undo to go back.');
  goGuideStep(4);
 };
}
