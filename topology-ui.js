'use strict';
const T=window.ExaTopology;
const topologyOpenACDs=new Set();
function topologyIssueMarkup(findings){
 const list=[...findings.errors.map(x=>({...x,level:'error'})),...findings.warnings.map(x=>({...x,level:'warning'}))];
 if(!list.length)return '<p class="issues fit">The entered database map has no detected mapping conflicts. Capacity and deployment checks remain separate.</p>';
 const items=rows=>rows.map(x=>`<li class="${x.level==='error'?'negative':'buffer-warning'}">${escapeHTML(x.message)}</li>`).join('');
 return `<p class="hint">${findings.errors.length} mapping conflict${findings.errors.length===1?'':'s'} · ${findings.warnings.length} item${findings.warnings.length===1?'':'s'} to review</p><ul class="topology-issues">${items(list.slice(0,6))}</ul>${list.length>6?`<details><summary>Show ${list.length-6} more mapping checks</summary><ul class="topology-issues">${items(list.slice(6))}</ul></details>`:''}`;
}
function topologyPeerSelect(a,slot){
 const current=a.role==='primary'?(T.peerIds(a)[slot]||''):(a.peerId||'');
 const choices=T.entries(state).filter(e=>e.acd.id!==a.id&&e.acd.role===(a.role==='primary'?'standby':'primary'));
 const missing=current&&!choices.some(e=>e.acd.id===current);
 return `<label>${a.role==='primary'?`Standby ${slot+1}`:'Primary ACD'}<select id="topology-peer-${escapeHTML(a.id)}-${slot}" data-topology-peer="${escapeHTML(a.id)}" data-peer-slot="${slot}" aria-label="${escapeHTML(a.name)} ${a.role==='primary'?`standby ${slot+1}`:'primary ACD'}"><option value="">Not linked</option>${missing?`<option value="${escapeHTML(current)}" selected>Missing or incompatible peer — review link</option>`:''}${choices.map(e=>`<option value="${escapeHTML(e.acd.id)}" ${current===e.acd.id?'selected':''}>${escapeHTML(T.label(e))}</option>`).join('')}</select></label>`;
}
function renderTopologyEditor(){
 const target=$('topology-editor');if(!target)return;
 const s=site();
 target.innerHTML=`<div class="topology-inventory"><p class="hint">Map the databases inside each ACD and link primary/standby groups. These are entered planning records, not a live OCI inventory. Reserved slots and named ACDs are counted separately.</p><p class="hint">Databases inside one ACD share its Data Guard switchover boundary. A primary can link to up to two standby ACDs. Each copy is sized on its own machine; linking does not add or copy allocations.</p>${s.clusters.length?s.clusters.map((c,ci)=>{
  const list=T.acds(c),totals=T.databaseTotals(c);
  return `<article class="inventory-cluster"><div class="section-top"><div><h3>${escapeHTML(c.name)}</h3><p class="hint">${list.length} named ACD${list.length===1?'':'s'} / ${c.slots} reserved slots · ${totals.counts.databases} database row${totals.counts.databases===1?'':'s'}</p></div><button data-topology-action="add-acd" data-cluster-index="${ci}" ${list.length>=Math.min(c.slots,T.MAX_ACDS)?'disabled':''}>+ Add named ACD</button></div>${list.length?list.map((a,ai)=>`<details class="inventory-acd" data-inventory-details="${escapeHTML(a.id)}" ${topologyOpenACDs.has(a.id)?'open':''}><summary id="topology-acd-summary-${escapeHTML(a.id)}">${escapeHTML(a.name||'Unnamed ACD')} · ${a.adbs.length} database${a.adbs.length===1?'':'s'} · ${a.role==='unprotected'?'No DR peer':a.role}</summary><div class="fields"><label>ACD name<input maxlength="80" value="${escapeHTML(a.name)}" data-acd-id="${escapeHTML(a.id)}" data-topology-field="name" aria-label="ACD ${ai+1} name in ${escapeHTML(c.name)}"></label><label>Data Guard role<select data-acd-role="${escapeHTML(a.id)}" aria-label="${escapeHTML(a.name)} Data Guard role">${[['unprotected','No DR peer'],['primary','Primary'],['standby','Standby']].map(([v,label])=>`<option value="${v}" ${a.role===v?'selected':''}>${label}</option>`).join('')}</select></label></div>${a.role!=='unprotected'?`<div class="fields">${topologyPeerSelect(a,0)}${a.role==='primary'?topologyPeerSelect(a,1):''}</div>`:''}<p class="hint">One row per ${a.role==='standby'?'standby database copy':'database'}. Enter workload needs, or confirm below that CPU/storage are the proposed ADB settings. Peer settings must match; workload demand can differ. Blank means unknown; 0 is an explicit zero.</p><div class="inventory-adbs">${a.adbs.length?a.adbs.map((d,di)=>`<div class="inventory-adb"><div class="fields"><label>Database name<input maxlength="80" value="${escapeHTML(d.name)}" data-acd-id="${escapeHTML(a.id)}" data-adb-id="${escapeHTML(d.id)}" data-topology-field="name" aria-label="Database ${di+1} name in ${escapeHTML(a.name)}"></label><label>Database ECPUs<input type="number" min="0" step="0.5" value="${d.ecpu??''}" data-acd-id="${escapeHTML(a.id)}" data-adb-id="${escapeHTML(d.id)}" data-topology-field="ecpu" aria-label="${escapeHTML(d.name)} Database ECPUs"></label><label>RAM needed (GB)<input type="number" min="0" step="0.5" value="${d.ramGB??''}" data-acd-id="${escapeHTML(a.id)}" data-adb-id="${escapeHTML(d.id)}" data-topology-field="ramGB" aria-label="${escapeHTML(d.name)} RAM needed GB"></label><label>Database storage (TB)<input type="number" min="0" step="0.01" value="${d.storageTB??''}" data-acd-id="${escapeHTML(a.id)}" data-adb-id="${escapeHTML(d.id)}" data-topology-field="storageTB" aria-label="${escapeHTML(d.name)} database storage TB"></label></div><div class="inventory-adb-actions"><label class="check"><input type="checkbox" ${d.independentSwitchover?'checked':''} data-acd-id="${escapeHTML(a.id)}" data-adb-id="${escapeHTML(d.id)}" data-topology-field="independentSwitchover">Needs its own switchover group</label><label class="check"><input type="checkbox" ${d.peerSettingsConfirmed?'checked':''} data-acd-id="${escapeHTML(a.id)}" data-adb-id="${escapeHTML(d.id)}" data-topology-field="peerSettingsConfirmed">CPU/storage are proposed peer settings</label><button class="remove" data-topology-action="remove-adb" data-acd-id="${escapeHTML(a.id)}" data-adb-id="${escapeHTML(d.id)}" aria-label="Remove database ${escapeHTML(d.name)}">Remove database</button></div></div>`).join(''):'<p class="empty-editor">No database rows in this ACD yet. Its slot reservation still counts.</p>'}</div><div class="actions"><button data-topology-action="add-adb" data-acd-id="${escapeHTML(a.id)}" ${a.adbs.length>=T.MAX_ADBS?'disabled':''}>+ Add database</button><button class="remove" data-topology-action="remove-acd" data-acd-id="${escapeHTML(a.id)}">Remove ${escapeHTML(a.name||'ACD')}</button></div></details>`).join(''):'<p class="hint">No named ACDs. Add one within the reserved slots to map its databases.</p>'}<div class="inventory-totals"><p id="topology-totals-${escapeHTML(c.uid)}" class="hint">Entered database totals: ${fmt(totals.known.ecpu)} ECPUs · ${fmt(totals.known.ramGB)} GB RAM${totals.requirements.incomplete?' · CPU/RAM inputs incomplete':''}. These totals do not replace the AVMC workload inputs until you apply them.</p><button data-topology-action="use-totals" data-cluster-index="${ci}" ${!list.length||list.length>c.slots?'disabled':''}>Use database totals for sizing</button></div></article>`;
 }).join(''):'<p class="empty-editor">Add an AVMC first, then map its ACDs and databases here.</p>'}<div id="topology-live-findings" aria-live="polite"></div><p class="hint"><a href="${T.SOURCES.guard}" target="_blank" rel="noopener noreferrer">Oracle Data Guard scope</a> · <a href="${T.SOURCES.peers}" target="_blank" rel="noopener noreferrer">Peer database settings</a>. Network, protection mode, automatic failover eligibility and operational readiness require separate validation.</p></div>`;
 renderTopologyReview();
}
function renderTopologyReview(){
 const summary=T.inspect(state),target=$('topology-review'),live=$('topology-live-findings');
 // Update text/options in place so typing and keyboard focus stay in the existing form.
 if(!summary.errors.some(x=>x.code==='invalid_topology')){
  for(const e of T.entries(state)){
   if(e.siteIndex!==active)continue;
   const a=e.acd,heading=$('topology-acd-summary-'+a.id);
   if(heading)heading.textContent=`${a.name||'Unnamed ACD'} · ${a.adbs.length} database${a.adbs.length===1?'':'s'} · ${a.role==='unprotected'?'No DR peer':a.role}`;
   for(let slot=0;slot<2;slot++){
    const select=$('topology-peer-'+a.id+'-'+slot);
    if(select?.options)for(const option of select.options){if(!option.value)continue;const peer=T.find(state,option.value);if(peer)option.textContent=T.label(peer);}
   }
  }
  for(const c of site().clusters){const totals=T.databaseTotals(c),el=$('topology-totals-'+c.uid);if(el)el.textContent=`Entered database totals: ${fmt(totals.known.ecpu)} ECPUs · ${fmt(totals.known.ramGB)} GB RAM${totals.requirements.incomplete?' · CPU/RAM inputs incomplete':''}. These totals do not replace the AVMC workload inputs until you apply them.`;}
 }
 const local={errors:summary.errors.filter(x=>x.siteIndex===undefined||x.siteIndex===active),warnings:summary.warnings.filter(x=>x.siteIndex===undefined||x.siteIndex===active)};
 if(live)live.innerHTML=topologyIssueMarkup(local);
 if(!target)return;
 target.innerHTML=`<h3>Database groups across the plan</h3><p class="hint">${summary.counts.namedACDs} named ACDs / ${summary.counts.reservedSlots} reserved slots · ${summary.counts.primaryADBs} primary or unprotected database rows · ${summary.counts.standbyADBs} standby copies · ${summary.counts.linkedPairs} primary-to-standby links. Counts are entered records; they are not proof of provisioned resources.</p>${summary.groups.length?`<div class="table-wrap"><table class="topology-review-table"><thead><tr><th>Site / machine</th><th>AVMC</th><th>ACD / role</th><th>Databases sharing this group</th><th>Linked peers</th></tr></thead><tbody>${summary.groups.map(g=>`<tr><td>${escapeHTML(g.siteName||'Site not named')} / ${escapeHTML(g.machineName)}</td><td>${escapeHTML(g.avmcName)}</td><td>${escapeHTML(g.name||'Unnamed ACD')}<br><small>${g.role==='unprotected'?'No DR peer':g.role}</small></td><td>${g.databases.length?g.databases.map(d=>`${escapeHTML(d.name||'Unnamed ADB')}${d.independentSwitchover?' <strong>(own group requested)</strong>':''}`).join('<br>'):'No databases entered'}</td><td>${g.peerIds.length?g.peerIds.map(p=>{const peer=summary.groups.find(x=>x.id===p);return peer?escapeHTML(`${peer.machineName} / ${peer.name}`):'Missing peer';}).join('<br>'):'Not linked'}</td></tr>`).join('')}</tbody></table></div>`:''}${topologyIssueMarkup(summary)}<p class="hint">A standalone database group can be planned in its own ACD. This map does not perform a switchover, move an ACD or validate DR readiness.</p>`;
}
function topologyChange(fn,full=false){
 let changed=false;
 safeUpdate(()=>{fn();T.validateState(state);changed=true;},full);
 if(!full)renderTopologyReview();
 return changed;
}
function initTopology(){
 const target=$('topology-editor');if(!target)return;
 target.addEventListener('toggle',event=>{const key=event.target.dataset?.inventoryDetails;if(!key)return;if(event.target.open)topologyOpenACDs.add(key);else topologyOpenACDs.delete(key);},true);
 target.addEventListener('input',event=>{
  const el=event.target,key=el.dataset?.topologyField;if(!key||['independentSwitchover','peerSettingsConfirmed'].includes(key))return;
  const a=T.find(state,el.dataset.acdId)?.acd,d=el.dataset.adbId?a?.adbs.find(d=>d.id===el.dataset.adbId):a;if(!d)return;
  topologyChange(()=>{d[key]=key==='name'?el.value:el.value===''?null:Number(el.value);if(key!=='name')needsNewSizing();});
 });
 target.addEventListener('change',event=>{
  const el=event.target;
  if(el.dataset?.acdRole){topologyChange(()=>T.setRole(state,el.dataset.acdRole,el.value),true);return;}
  if(el.dataset?.topologyPeer){
   const a=T.find(state,el.dataset.topologyPeer)?.acd;if(!a)return;
   topologyChange(()=>{const old=T.peerIds(a)[Number(el.dataset.peerSlot)||0];if(old===el.value)return;if(el.value){if(a.role==='primary'){const peer=T.find(state,el.value)?.acd;if(!peer||peer.role!=='standby')throw Error('Choose an existing standby ACD.');if(T.peerIds(a).includes(el.value))throw Error('This standby is already linked.');if(old)T.unlinkPeer(state,a.id,old);T.linkPeers(state,a.id,el.value);}else{T.linkPeers(state,el.value,a.id);}}else if(old)T.unlinkPeer(state,a.id,old);},true);return;
  }
  if(['independentSwitchover','peerSettingsConfirmed'].includes(el.dataset?.topologyField)){const a=T.find(state,el.dataset.acdId)?.acd,d=a?.adbs.find(d=>d.id===el.dataset.adbId);if(d)topologyChange(()=>{d[el.dataset.topologyField]=el.checked;});}
 });
 target.addEventListener('click',event=>{
  const el=event.target.closest('[data-topology-action]');if(!el)return;
  const action=el.dataset.topologyAction,e=el.dataset.acdId?T.find(state,el.dataset.acdId):null,c=site().clusters[Number(el.dataset.clusterIndex)];
  const changed=topologyChange(()=>{
   T.ensureIds(state);
   if(action==='add-acd'){
    if(!c)throw Error('Choose an AVMC first.');const list=T.acds(c);if(list.length>=Math.min(c.slots,T.MAX_ACDS))throw Error('Add an ACD slot before adding another named ACD.');
    if(!c.topology)c.topology={acds:[]};let n=1;while(c.topology.acds.some(a=>a.name===`ACD ${n}`))n++;const a=T.newACD(`ACD ${n}`);c.topology.acds.push(a);topologyOpenACDs.add(a.id);needsNewSizing();
   }else if(action==='add-adb'){
    if(!e)throw Error('ACD no longer exists.');if(e.acd.adbs.length>=T.MAX_ADBS)throw Error('The calculator database-row limit has been reached.');let n=1;while(e.acd.adbs.some(d=>d.name===`ADB ${n}`))n++;e.acd.adbs.push(T.newADB(`ADB ${n}`));topologyOpenACDs.add(e.acd.id);needsNewSizing();
   }else if(action==='remove-adb'){
    if(!e)return;e.acd.adbs=e.acd.adbs.filter(d=>d.id!==el.dataset.adbId);needsNewSizing();
   }else if(action==='remove-acd'){
    if(!e)return;T.unlinkPeer(state,e.acd.id);e.cluster.topology.acds=e.cluster.topology.acds.filter(a=>a.id!==e.acd.id);topologyOpenACDs.delete(e.acd.id);needsNewSizing();
   }else if(action==='use-totals'){
    if(!c||!T.acds(c).length)throw Error('Add named ACDs and database rows first.');if(T.acds(c).length>c.slots)throw Error('Named ACDs exceed the reserved slots.');c.requirements=T.databaseTotals(c).requirements;needsNewSizing();
   }
  },true);
  if(action==='use-totals'&&changed)message('Database totals copied into this AVMC’s workload inputs. Missing CPU/RAM values stay flagged. Compare hardware again; peer copies are sized on their own machines.');
 });
}
