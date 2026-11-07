(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaStarts=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function create(kind,{model:M,topology:T,library:L,rules:R,requirements:Q}){
  if(!['quick','example'].includes(kind))throw Error('Choose a supported starting point.');
  const machine=M.newSite(kind==='quick'?'Machine 1':'Production');machine.siteName=kind==='quick'?'':'DC';machine.planningIntent='allocation';machine.hardwareChosen=true;
  const state={schema:'exacc-capacity/v1',project:{customer:kind==='example'?'Example customer':'',name:kind==='quick'?'Quick capacity check':'Example: production and DR',owner:'',notes:kind==='quick'?'Local-storage check. Turn on CPU and memory checks when their allocations are known.':'Illustrative data for learning only. Replace it before using this as a customer proposal.'},ruleSet:{version:R.VERSION,checked:R.CHECKED,scope:R.SCOPE},sites:[machine]};
  if(kind==='quick'){machine.clusters=[];machine.checkCompute=false;}
  else{
   const standby=M.newSite('Recovery');standby.siteName='DR';standby.planningIntent='allocation';standby.hardwareChosen=true;state.sites.push(standby);
   for(const [i,s]of state.sites.entries()){
    const c=s.clusters[0];c.name='Applications';c.slots=1;c.cpu=80;c.memoryPerCPU=4;c.memoryRule='current';c.allocationKind='new';
    const a=T.newACD(i?'Payments DR':'Payments');a.role=i?'standby':'primary';const d=T.newADB('PaymentsDB');Object.assign(d,{ecpu:32,ramGB:128,storageTB:1,independentSwitchover:true,peerSettingsConfirmed:true});a.adbs.push(d);c.topology={acds:[a]};
    c.requirements=Q.inventoryRequirements(c);
   }
   T.linkPeers(state,state.sites[0].clusters[0].topology.acds[0].id,state.sites[1].clusters[0].topology.acds[0].id);
  }
  T.ensureIds(state);L.ensureIdentity(state);state.sites.forEach(M.validate);T.validateState(state);return state;
 }
 return {create};
});
