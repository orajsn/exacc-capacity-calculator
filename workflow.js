'use strict';

let undoSnapshot = null;
let savedSignature = null;
let savedLabel = 'New scenario · not saved';
let preview = null;

function snapshot() {
 return {state: structuredClone(state), active};
}

function rememberChange(before) {
 if (JSON.stringify(before.state) !== JSON.stringify(state)) undoSnapshot = before;
}

function hasUnsavedChanges() {
 return JSON.stringify(state) !== savedSignature;
}

function reserveLabel(status) {
 return status === 'Within buffer' ? 'Growth reserve maintained'
  : status === 'Below buffer' ? 'Below growth reserve' : status;
}

function cancelPreview() {
 preview = null;
 $('design-preview').hidden = true;
 $('apply-preview').disabled = true;
 $('preview-error').hidden = true;
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
 $('save-status').textContent = hasUnsavedChanges() ? 'Unsaved changes' : savedLabel;
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
}

function renderResourceCards(s, result) {
 const rows = P.resources(s, result);
 const issues = [...result.errors, ...result.warnings.filter(w => w.includes('memory rule unconfirmed'))];
 $('resource-validation').hidden = !issues.length;
 $('resource-validation').textContent = issues.slice(0, 2).join(' ') + (issues.length > 2 ? ' More issues in local storage and server details.' : '');
 const definitions = [['Local storage', 'Local', 'GB'], ['CPU', 'CPU', 'ECPU'], ['Memory estimate', 'Memory estimate', 'GB'], ['Exadata storage (manual)', 'Shared DB storage', 'TB']];
 $('resource-cards').innerHTML = definitions.map(([key, title, unit]) => {
  const row = rows.find(item => item.name === key);
  if (!row) return `<div class="resource-card unchecked"><span>${title}</span><strong>${key === 'Exadata storage (manual)' ? 'Enter capacity' : 'Not checked'}</strong><small>${key === 'Exadata storage (manual)' ? 'Shared database storage · console TB' : 'Enable CPU / memory checks'}</small></div>`;
  const level = row.status === 'Over capacity' ? 'error' : row.status === 'Below buffer' ? 'warning' : 'fit';
  return `<div class="resource-card ${level}"><span>${title}</span><strong>${fmt(row.after)} <small>${unit}</small></strong><small>free after reserve · ${row.percent}%</small><span class="card-status">${reserveLabel(row.status)}</span><small>${fmt(row.allocated)} / ${fmt(row.capacity)} ${unit} allocated</small></div>`;
 }).join('');
 updateWorkflow();
}

function showPreview(count) {
 M.validate(site());
 P.validate(site());
 const preserve = count === site().clusters.length && site().clusters.every(c => c.nodes.length === site().nodes.length);
 preview = {count, preserve, active, signature: JSON.stringify(state), candidate: null};
 $('replacement-cpu').value = '';
 $('replacement-ratio').value = '';
 $('replacement-fields').hidden = preserve;
 $('design-preview').hidden = false;
 $('preview-heading').textContent = `Preview: ${count} AVMC${count === 1 ? '' : 's'}`;
 $('preview-description').textContent = preserve
  ? 'Names and compute allocations stay the same; only ACD slots change. The table compares your edited design with this option.'
  : 'Enter CPU and memory allocations for each replacement AVMC. You can customise individual AVMCs after applying.';
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
  $('preview-results').innerHTML = '<p class="hint">Complete both allocations to see the resource impact. Your design has not changed.</p>';
  return;
 }
 try {
  const candidate = M.applyDesign(site(), preview.count, {cpu: Number(cpu), memoryPerCPU: Number(ratio)});
  P.validate(candidate);
  const current = M.calculate(site()), result = M.calculate(candidate);
  const comparison = P.compare({...candidate, baseline: P.capture(site(), current)}, result);
  const summary = P.summary(candidate, result);
  $('preview-results').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Resource</th><th>Editing now</th><th>Preview</th><th>Change</th></tr></thead><tbody>${comparison.map(row => `<tr><td>${row.name} (${row.unit})</td><td>${row.before === null ? 'Not checked' : fmt(row.before)}</td><td>${row.after === null ? 'Not checked' : fmt(row.after)}</td><td>${row.delta === null ? 'Not checked' : (row.delta > 0 ? '+' : '') + fmt(row.delta)}</td></tr>`).join('')}</tbody></table></div><p class="issues ${summary.status === 'error' ? 'error' : ''}">${escapeHTML(summary.text)}</p><p class="hint">Exadata allocation is entered manually; this preview does not recalculate it. ${site().baseline ? 'Your recorded Before totals stay fixed.' : 'Applying will also record your current totals as Before, so you can compare the change.'}</p>`;
  if (!candidate.baseline) candidate.baseline = P.capture(site(), current);
  preview.candidate = candidate;
  $('apply-preview').disabled = false;
 } catch (error) {
  $('preview-results').innerHTML = '';
  $('preview-error').textContent = error.message;
  $('preview-error').hidden = false;
 }
}

function initWorkflow() {
 savedSignature = JSON.stringify(state);
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
  message('Proposed configuration applied. Undo is available.');
  $('growth-heading').scrollIntoView({behavior: 'smooth', block: 'start'});
  $('growth-heading').focus({preventScroll: true});
 };
 window.addEventListener('beforeunload', event => {
  if (!hasUnsavedChanges()) return;
  event.preventDefault();
  event.returnValue = '';
 });
}
