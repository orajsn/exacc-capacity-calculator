(function(root, factory) {
 const api = factory();
 if (typeof module === 'object' && module.exports) module.exports = api;
 else root.ExaAudit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
 'use strict';
 const defaults = {observedMemory: null, observedLocal: null, toleranceGB: 1, newCPU: 40, newRatio: 2, newSlots: 1};
 function config(site) { return {...defaults, ...site.audit}; }
 function validate(site) {
  const a = config(site);
  for (const key of ['observedMemory', 'observedLocal']) {
   if (a[key] !== null && (!Number.isFinite(a[key]) || a[key] < 0 || a[key] > 10000000)) throw Error('Console allocation must be a non-negative number.');
  }
  for (const [key, min, max] of [['toleranceGB',0,100], ['newCPU',40,10000], ['newRatio',2,5], ['newSlots',1,16]]) {
   if (!Number.isFinite(a[key]) || a[key] < min || a[key] > max) throw Error(`${({toleranceGB:'Allowed difference (GB)',newCPU:'New AVMC ECPUs per VM',newRatio:'New AVMC GB per ECPU',newSlots:'New AVMC maximum ACDs'})[key]}: enter ${min} to ${max}.`);
  }
  if (!Number.isInteger(a.newCPU) || !Number.isInteger(a.newSlots)) throw Error('Candidate ECPUs and ACD slots must be whole numbers.');
  return a;
 }
 function reconcile(site, result) {
  const a = validate(site);
  return ['memory','local'].map(resource => {
   const enabled = resource !== 'memory' || site.checkCompute;
   const estimate = enabled ? result.nodes.reduce((sum,n) => sum + (resource === 'memory' ? n.memoryUsed+n.otherMemory : n.used+n.otherLocal),0) : null;
   const observed = resource === 'memory' ? a.observedMemory : a.observedLocal;
   const delta = estimate === null || observed === null ? null : observed-estimate;
   const verified = resource !== 'memory' || result.costs.every(c => c.memorySizing.verified);
   const status = !enabled ? 'Enable memory checks' : observed === null ? 'Enter console total'
    : Math.abs(delta) > a.toleranceGB ? 'Difference to explain'
    : !verified ? 'Close match; confirm memory formula' : 'Within allowed difference';
   return {resource,estimate,observed,delta,verified,status};
  });
 }
 function candidate(site, result, model) {
  const a = validate(site);
  const cluster = {name:'Proposed new AVMC',cpu:a.newCPU,memoryPerCPU:a.newRatio,slots:a.newSlots,nodes:site.nodes.map(n=>n.id),memoryRule:'current'};
  const cost = model.clusterCost(cluster,site.image,site.allowance);
  const rows = result.nodes.map(n => {
   const localGap = Math.max(0,cost.perVM-n.free);
   const cpuGap = site.checkCompute ? Math.max(0,a.newCPU-(n.cpu-n.cpuUsed-n.otherCPU)) : null;
   const memoryGap = site.checkCompute ? Math.max(0,cost.memoryPerVM-(n.memory-n.memoryUsed-n.otherMemory)) : null;
   const vmGap = Math.max(0,n.vms+n.otherVMs+1-n.maxVMs);
   return {id:n.id,localGap,cpuGap,memoryGap,vmGap,fit:localGap<=1e-7 && cpuGap!==null && cpuGap<=1e-7 && memoryGap!==null && memoryGap<=1e-7 && vmGap===0};
  });
  const verified = result.costs.every(c=>c.memorySizing.verified);
  const fits = site.checkCompute && result.errors.length===0 && rows.every(n=>n.fit);
  return {cost,rows,fits,verified,status:!site.checkCompute?'CPU / memory not checked':!fits?'Does not fit the resources checked':!verified?'Fits using the new formula; confirm memory history':'Fits the resources checked'};
 }
 return {config,validate,reconcile,candidate};
});
