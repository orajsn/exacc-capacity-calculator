'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),M=require('./model.js');
function setup(machine=M.newSite()){
 const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,disabled:false,value:'',dataset:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;},scrollIntoView(){},focus(){}});return elements.get(id);};
 const state={sites:[machine],project:{name:'Working plan'}},ctx={M,state,active:0,$:el,site:()=>state.sites[0],preview:null};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('./journey.js'),'utf8'),ctx);return {el,state,run:code=>vm.runInContext(code,ctx)};
}
test('workbench tabs use task titles and short instructions without changing plan contents',()=>{
 const p=setup(),before=JSON.stringify(p.state);p.run('initJourney()');
 for(const [index,title]of ['Machine','Allocations','Compare','Review'].entries()){
  p.el('guide-step-'+(index+1)).onclick();assert.equal(p.el('guide-heading').textContent,title);assert.doesNotMatch(p.el('guide-context').textContent,/Step/);assert.ok(p.el('guide-instruction').textContent.length<100);assert.equal(p.el('guide-step-'+(index+1)).attributes['aria-current'],'step');
 }
 assert.equal(JSON.stringify(p.state),before);
});
test('hardware summary shows real selected capacity and hides stale preset claims when sizing is pending',()=>{
 const machine=M.newSite('Machine A','x11m-large',3),p=setup(machine);p.run('refreshJourney()');assert.match(p.el('workbench-hardware-info').textContent,/X11M Large.*3 DB servers.*confirm/);assert.equal(p.el('workbench-hardware-info').dataset.state,'selected');
 machine.planningIntent='workload';machine.hardwareChosen=false;p.run('refreshJourney()');assert.match(p.el('workbench-hardware-info').textContent,/Hardware not selected/);assert.doesNotMatch(p.el('workbench-hardware-info').textContent,/X11M/);assert.equal(p.el('workbench-hardware-info').dataset.state,'unselected');
});
test('starting hardware assumption follows the specific preset and is independent of editable project names',()=>{
 const machine=M.newSite();machine.uid='starter-machine';const p=setup(machine);p.run('markStartingHardware(site());refreshJourney()');assert.equal(p.el('workbench-hardware-info').dataset.state,'assumed');p.state.project.name='A real customer plan';p.run('refreshJourney()');assert.match(p.el('workbench-hardware-info').textContent,/starting assumption/);
 machine.profile='x11m-large';p.run('refreshJourney()');assert.equal(p.el('workbench-hardware-info').dataset.state,'selected');machine.profile='x11m-standard';machine.uid='another-machine';p.run('refreshJourney()');assert.equal(p.el('workbench-hardware-info').dataset.state,'selected');
});
test('Change hardware opens Machine while preserving all allocations',()=>{
 const p=setup(),before=JSON.stringify(p.state);p.run('initJourney();goGuideStep(2)');assert.equal(p.el('panel-avmc').hidden,false);p.el('workbench-hardware-edit').onclick();assert.equal(p.run('guideStep'),1);assert.equal(p.el('panel-machine').hidden,false);assert.equal(p.el('panel-avmc').hidden,true);assert.equal(JSON.stringify(p.state),before);
});
