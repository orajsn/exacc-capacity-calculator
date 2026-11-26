'use strict';

function comparisonEvidence(plan, source) {
 const machineSections = plan.machines.map((machine, index) => {
  const site = source.sites[index];
  const resource = machine.resources.find(row => row.name === 'Local storage');
  const nodes = (resource?.nodes || []).map(node =>
   `<tr><th>DB ${node.id}</th><td>${fmt(node.allocated)}</td><td>${fmt(node.capacity)}</td><td>${fmt(node.free)}</td><td>${escapeHTML(P.statusText(node.status))}</td></tr>`
  ).join('');
  const groups = site.clusters.map(cluster => {
   const acds = (cluster.topology?.acds || []).map(acd =>
    `<li>${escapeHTML(acd.name)} (${escapeHTML(acd.role || 'role unspecified')}): ${acd.adbs.map(db=>escapeHTML(db.name)).join(', ') || 'No databases entered'}</li>`
   ).join('');
   return `<h4>${escapeHTML(cluster.name)}</h4>${acds ? '<ul>'+acds+'</ul>' : '<p>No named database groups entered.</p>'}`;
  }).join('');
  return `<h3>${escapeHTML([machine.site,machine.name].filter(Boolean).join(' / '))}</h3>${nodes ? '<table><caption>Local storage by server (GB)</caption><thead><tr><th>Server</th><th>Allocated</th><th>Capacity</th><th>Free</th><th>Status</th></tr></thead><tbody>'+nodes+'</tbody></table>' : '<p>Per-server local storage unchecked.</p>'}${groups}`;
 }).join('');
 return `<section><h2>${escapeHTML(plan.name)} — placement and database groups</h2>${machineSections}</section>`;
}

function exportSelectedComparison(){
 try{
  const selected=scenarioCompareIds;
  if(!selected.length)throw Error('Select a saved option to export alongside the working plan.');
  const comparison=window.ExaReview.comparePlans(state,selected,M,P,T,X,window.ExaRequirements);
  const sources=[state,...selected.map(id=>state.alternatives.find(option=>option.id===id))];
  const note=$('decision-note').value.trim();
  const title=escapeHTML([state.project?.customer,state.project?.name,'Design comparison'].filter(Boolean).join(' / '));
  const tables=comparisonTableHTML(comparison).replaceAll('<details>','<details open>');
  const evidence=comparison.plans.map((plan,index)=>comparisonEvidence(plan,sources[index])).join('');
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>body{font:16px/1.45 system-ui;color:#242220;margin:2em auto;padding:0 1em;max-width:74em}table{width:100%;border-collapse:collapse;margin:1em 0}caption{text-align:left;font-weight:bold}td,th{padding:.55em;border:1px solid #999;vertical-align:top;text-align:left;overflow-wrap:anywhere}small{display:block;margin-top:.4em}section{margin:2em 0}.buffer-warning,[data-status="Below buffer"]{background:#fff4ca}[data-status="Over capacity"]{background:#ffdad4}@media print{body{font-size:10pt;margin:0}tr{break-inside:avoid}h2,h3{break-after:avoid}}</style></head><body><h1>${title}</h1><p>${new Date().toISOString().slice(0,10)} · Planner ${M.VERSION} · Rules ${escapeHTML(R.VERSION)} · Sources checked ${escapeHTML(R.CHECKED)}</p>${note?'<h2>Decision note</h2><p>'+escapeHTML(note)+'</p>':''}${tables}${evidence}<p>Confirm live provisioning eligibility, DR operation and any unchecked resources before deployment.</p></body></html>`;
  download('autonomous-design-comparison.html',html,'text/html');
  message('Comparison download requested. Open the HTML file to read or print it.');
 }catch(error){message(error.message);}
}
