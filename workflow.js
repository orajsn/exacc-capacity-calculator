'use strict';

let undoSnapshot = null;
let savedSignature = null;
let savedLabel = 'New scenario · no JSON downloaded';
let preview = null;
let leaveWarningActive = false;

function snapshot() {
 return {state: structuredClone(state), active};
}

function rememberChange(before) {
 if (JSON.stringify(before.state) !== JSON.stringify(state)) undoSnapshot = before;
}

function hasUnsavedChanges() {
 return JSON.stringify(state) !== savedSignature;
}

function warnBeforeLeaving(event) {
 if (!hasUnsavedChanges()) return;
 event.preventDefault();
 event.returnValue = true;
}

function updateSaveReminder() {
 const dirty = hasUnsavedChanges();
 $('save-status').textContent = dirty ? 'Unsaved changes · download JSON to keep them' : savedLabel;
 $('save-reminder').hidden = !dirty;
 $('dock-unsaved').textContent = dirty ? 'Unsaved changes' : '';
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
 $('local-dock').dataset.level = 'warning';
 $('dock-machine').textContent = `${site().siteName || 'Unspecified site'} / ${site().name}`;
 $('dock-mode').textContent = preview ? 'Preview · not applied' : 'Editing now';
 $('dock-free').textContent = '—';
 $('dock-label').textContent = 'Local storage left';
 $('dock-allocation').textContent = note;
 $('dock-status').textContent = 'Enter valid values to update the total.';
 $('dock-save').disabled = !!preview;
 $('dock-save').title = preview ? 'Apply or cancel the preview before saving from this bar.' : '';
}

function renderFloatingLocal(s, result, isPreview = false) {
 const local = P.resources(s, result).find(row => row.name === 'Local storage');
 const worst = result.nodes.reduce((a,n) => n.free < a.free ? n : a);
 const hasError = local.status === 'Over capacity' || result.errors.length > 0;
 $('local-dock').dataset.level = hasError ? 'error' : local.status === 'Below buffer' ? 'warning' : 'fit';
 $('dock-machine').textContent = `${s.siteName || 'Unspecified site'} / ${s.name}`;
 $('dock-machine').title = $('dock-machine').textContent;
 $('dock-mode').textContent = isPreview ? 'Preview · not applied' : 'Editing now';
 const shortfall = result.free < -1e-7;
 $('dock-label').textContent = shortfall ? 'Local storage shortfall' : 'Local storage left';
 $('dock-free').textContent = `${fmt(shortfall ? -result.free : Math.max(0, result.free))} GB`;
 $('dock-allocation').textContent = `${fmt(result.used + result.other)} / ${fmt(result.capacity)} GB allocated · ${s.clusters.length} AVMC${s.clusters.length===1?'':'s'} · ${result.slots} max ACDs`;
 $('dock-status').textContent = worst.free < -1e-7
  ? `DB ${worst.id} is short by ${fmt(-worst.free)} GB. Check each server.`
  : result.errors.length ? 'Local storage fits; other limits are exceeded. See details.'
  : `${reserveLabel(local.status)} · buffer ${s.bufferPercent}%`;
 $('dock-save').disabled = isPreview;
 $('dock-save').title = isPreview ? 'Apply or cancel the preview before saving from this bar.' : '';
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
 updateSaveReminder();
 $('undo').disabled = !undoSnapshot;
 $('remove-site').disabled = state.sites.length === 1;
 $('duplicate-site').disabled = state.sites.length >= 8;
 $('active-machine').textContent = `${s.siteName || 'Unspecified site'} / ${s.name}`;
 $('configuration-stage').textContent = s.baseline ? 'Proposed configuration' : 'Configuration setup';
 $('design-heading').textContent = s.baseline ? 'Edit proposed AVMCs' : 'Edit AVMC allocations';
 $('capture-baseline').textContent = s.baseline ? 'Replace recorded “Before” values' : 'Record “Before” values';
 $('current-summary').textContent = s.baseline
  ? `Recorded “Before”: ${s.baseline.avmcs} AVMCs · ${s.baseline.slots} ACD slots · ${fmt(s.baseline.local)} GB local allocated. Edit the allocations below; the Before / After table will show the difference. These recorded totals stay fixed until you replace or remove them.`
  : 'Optional: record the numbers you have entered, then edit the design to compare Before versus After. Skip this if you only need capacity totals.';
 if (preview && (preview.active !== active || preview.signature !== JSON.stringify(state))) cancelPreview();
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
 $('open-scenario').addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
   event.preventDefault();
   $('import').click();
  }
 });
 $('undo').onclick = () => {
  if (!undoSnapshot) return;
  state = undoSnapshot.state;
  active = undoSnapshot.active;
  undoSnapshot = null;
  cancelPreview();
  render();
  message('Last change undone.');
 };
 $('duplicate-site').onclick = () => safeUpdate(() => {
  if (state.sites.length >= 8) throw Error('Up to eight machines per scenario.');
  const copy = structuredClone(site());
  copy.name = `${copy.name.slice(0, 65)} (copy)`;
  state.sites.push(copy);
  active = state.sites.length - 1;
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
  $('growth-heading').scrollIntoView({behavior: 'smooth', block: 'start'});
  $('growth-heading').focus({preventScroll: true});
 };
}
