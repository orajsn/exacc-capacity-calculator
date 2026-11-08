'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),M=require('./model.js'),Tour=require('./tour.js');
function events(target={}){const handlers=new Map();return Object.assign(target,{addEventListener(type,fn){if(!handlers.has(type))handlers.set(type,new Set());handlers.get(type).add(fn);},removeEventListener(type,fn){handlers.get(type)?.delete(fn);},emit(type,event={}){for(const fn of [...(handlers.get(type)||[])])fn({type,...event});}});}
function fixture({blocked=false,previous=null}={}){
 const elements=new Map(),writes=[],values=new Map(previous?[[Tour.STORAGE_KEY,previous]]:[]),styles=new Map(),navigation=[];let active=0,saved=null,savedSignature=null,sequence=0,focusCount=0;
 const doc=events({documentElement:{style:{setProperty:(k,v)=>styles.set(k,v)}},body:{dataset:{}},getElementById:id=>elements.get(id)||null});
 function element(id,tagName='div'){const el=events({id,tagName,value:'',textContent:'',hidden:false,disabled:false,dataset:{},attributes:{},classes:new Set(),left:100,getAttribute(k){return this.attributes[k]??null;},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},closest(selector){return selector==='#'+id?this:null;},scrollIntoView(){},focus(){doc.activeElement=this;focusCount++;},getBoundingClientRect(){return {left:this.left,height:240};}});el.classList={add:c=>el.classes.add(c),remove:c=>el.classes.delete(c)};el.click=()=>{if(el.disabled)return;el.emit('click',{target:el});doc.emit('click',{target:el});};elements.set(id,el);return el;}
 for(const id of ['tour-panel','tour-title','tour-step','tour-instruction','tour-status','tour-invitation','allocation-map'])element(id);for(const id of ['tour-back','tour-next','tour-skip','tour-exit','add-cluster','plan-save-device'])element(id,'button');element('profile','select').value='x11m-standard';element('node-count','input').value='2';
 const machine=M.newSite();machine.uid='machine-tour';machine.clusters=[];machine.checkCompute=false;const state={schema:'exacc-capacity/v1',project:{id:'plan-tour-001',name:'Guided practice'},sites:[machine]},slots=new Map();
 const env={innerWidth:1400};Object.defineProperty(env,'localStorage',{get(){if(blocked)throw Error('Storage blocked');return {getItem:k=>values.get(k)??null,setItem:(k,v)=>{writes.push([k,v]);values.set(k,v);}};}});
 const controller=Tour.create({document:doc,window:env,getState:()=>state,getMachine:()=>state.sites[active],validate:M.validate,getSlotControl:id=>slots.get(id)||null,isSaved:id=>saved===id&&savedSignature===JSON.stringify(state),navigate:(view,id)=>navigation.push({view,id})});
 const settle=async()=>{await Promise.resolve();await Promise.resolve();};
 async function add(){const cluster={uid:'avmc-'+(++sequence),name:'AVMC '+sequence,slots:1,nodes:[1,2],cpu:40,memoryPerCPU:2,memoryRule:'current',allocationKind:'new'};state.sites[active].clusters.push(cluster);const input=element('slots-'+cluster.uid,'input');input.value='1';slots.set(cluster.uid,input);elements.get('add-cluster').click();await settle();return cluster;}
 async function editSlots(value,id=controller.getStatus().clusterId){const input=slots.get(id),cluster=machine.clusters.find(c=>c.uid===id);input.value=value;cluster.slots=value===''?NaN:Number(value);doc.activeElement=input;doc.emit('input',{target:input});await settle();}
 function commitSave(id=state.project.id){saved=id;savedSignature=JSON.stringify(state);controller.refresh();}
 return {controller,state,machine,doc,el:id=>elements.get(id),writes,values,styles,navigation,settle,add,editSlots,commitSave,focusCount:()=>focusCount,setActive:i=>active=i};
}
async function reachSave(f){f.controller.start();f.controller.next();const cluster=await f.add();await f.editSlots('2');assert.equal(f.controller.getStatus().index,3);f.controller.next();assert.equal(f.controller.getStatus().index,4);return cluster;}
test('five real-control steps complete only after a matching confirmed device save',async()=>{
 const f=fixture(),before=JSON.stringify(f.state);f.controller.start();assert.equal(JSON.stringify(f.state),before);assert.equal(f.doc.body.dataset.tourActive,'true');assert.equal(f.doc.activeElement.id,'profile');assert.equal(f.el('tour-invitation').hidden,true);assert.deepEqual(f.writes,[]);
 f.controller.next();assert.equal(f.controller.getStatus().index,1);assert.equal(f.machine.clusters.length,0);const cluster=await f.add();assert.equal(f.controller.getStatus().clusterId,cluster.uid);assert.equal(f.controller.getStatus().index,2);
 await f.editSlots('2');assert.equal(f.controller.getStatus().index,3);f.controller.refresh();assert.equal(f.controller.getStatus().index,3,'reading requires explicit Next');f.controller.next();assert.equal(f.controller.getStatus().index,4);assert.deepEqual(f.writes,[]);
 f.controller.refresh();assert.equal(f.controller.getStatus().active,true,'a pending/failed save or JSON download has no completion evidence');f.commitSave();assert.equal(f.controller.getStatus().terminal,true);assert.ok(f.controller.getStatus().evidence.every(x=>x==='completed'));assert.equal(f.values.get(Tour.STORAGE_KEY),'completed');assert.match(f.el('tour-title').textContent,/completed/);assert.equal(f.doc.body.dataset.tourActive,'true','terminal coach keeps mobile clearance until closed');
 f.el('tour-next').click();assert.equal(f.el('tour-panel').hidden,true);assert.equal(f.doc.body.dataset.tourActive,undefined);assert.equal(f.styles.get('--tour-panel-height'),'0px');
});
test('invalid hardware or slot input cannot advance and refreshes do not steal typing focus',async()=>{
 const f=fixture();f.controller.start();f.el('node-count').value='';f.controller.next();assert.equal(f.controller.getStatus().index,0);assert.equal(f.el('tour-next').disabled,true);f.el('node-count').value='2';f.controller.next();await f.add();
 await f.editSlots('');assert.equal(f.controller.getStatus().index,2);const focused=f.doc.activeElement,count=f.focusCount();f.controller.refresh();f.controller.refresh();assert.equal(f.doc.activeElement,focused);assert.equal(f.focusCount(),count);await f.editSlots('3');assert.equal(f.controller.getStatus().index,2);await f.editSlots('2');assert.equal(f.controller.getStatus().index,3);
});
test('unrelated/programmatic changes cannot substitute for Add AVMC or editing the pinned slot control',async()=>{
 const f=fixture();f.controller.start();f.controller.next();const cluster=await f.add();f.controller.back();assert.equal(f.controller.getStatus().index,1);f.controller.next();assert.equal(f.controller.getStatus().clusterId,cluster.uid);const extra=await f.add();await f.editSlots('2',extra.uid);assert.equal(f.controller.getStatus().index,2);await f.editSlots('2',cluster.uid);assert.equal(f.controller.getStatus().index,3);
 const g=fixture();g.controller.start();g.controller.next();g.machine.clusters.push({...M.newSite().clusters[0],uid:'programmatic'});g.controller.refresh();assert.equal(g.controller.getStatus().index,1);assert.equal(g.controller.getStatus().clusterId,null);
});
test('skipping prerequisites or save yields an explicitly incomplete run',async()=>{
 const f=fixture();f.controller.start();f.controller.skip();f.controller.skip();assert.equal(f.controller.getStatus().index,3);assert.deepEqual(f.controller.getStatus().evidence.slice(0,3),['skipped','skipped','skipped']);f.controller.next();f.commitSave();assert.equal(f.values.get(Tour.STORAGE_KEY),'dismissed');assert.match(f.el('tour-title').textContent,/not completed/);assert.match(f.el('tour-status').textContent,/3 steps were skipped/);
 const g=fixture();await reachSave(g);g.controller.skip();assert.equal(g.controller.getStatus().evidence[4],'skipped');assert.equal(g.values.get(Tour.STORAGE_KEY),'dismissed');assert.match(g.el('tour-instruction').textContent,/skipped the save/);
});
test('plan/machine switches and removed target AVMCs stop without changing the current work',async()=>{
 for(const change of [f=>f.state.project.id='plan-another-001',f=>{f.state.sites.push({...M.newSite(),uid:'other-machine'});f.setActive(1);},f=>f.machine.clusters=[]]){
  const f=fixture();await reachSave(f);change(f);const before=JSON.stringify(f.state);f.controller.refresh();f.commitSave('plan-tour-001');assert.equal(JSON.stringify(f.state),before);assert.equal(f.controller.getStatus().active,false);assert.equal(f.values.get(Tour.STORAGE_KEY),'dismissed');assert.match(f.el('tour-title').textContent,/not completed/);
 }
});
test('a stale or wrong-plan save does not complete the tour',async()=>{
 const f=fixture();await reachSave(f);f.commitSave('plan-other-001');assert.equal(f.controller.getStatus().active,true);assert.deepEqual(f.writes,[]);f.state.project.notes='Newer unsaved edits';f.controller.refresh();assert.equal(f.controller.getStatus().active,true);assert.equal(f.el('tour-next').disabled,true);f.commitSave();assert.equal(f.values.get(Tour.STORAGE_KEY),'completed');
});
test('Exit and Escape dismiss without saving; blocked preference storage never breaks teaching',async()=>{
 for(const escape of [false,true]){const f=fixture();f.controller.start();const before=JSON.stringify(f.state);if(escape)f.doc.emit('keydown',{key:'Escape',preventDefault(){}});else f.el('tour-exit').click();assert.equal(f.el('tour-panel').hidden,true);assert.equal(f.values.get(Tour.STORAGE_KEY),'dismissed');assert.equal(JSON.stringify(f.state),before);}
 const f=fixture({blocked:true});await reachSave(f);f.commitSave();assert.match(f.el('tour-title').textContent,/completed/);assert.deepEqual(f.writes,[]);f.controller.exit();assert.equal(f.el('tour-panel').hidden,true);
 const previous=fixture({previous:'completed'});previous.controller.start();previous.controller.exit();assert.equal(previous.values.get(Tour.STORAGE_KEY),'completed');assert.deepEqual(previous.writes,[]);
});
test('coach position and highlights follow targets and are removed on teardown',async()=>{
 const f=fixture();f.el('add-cluster').left=1000;f.controller.start();f.controller.next();assert.equal(f.el('tour-panel').dataset.side,'left');assert.ok(f.el('add-cluster').classes.has('tour-target'));const before=JSON.stringify(f.state);f.controller.destroy();assert.equal(f.el('tour-panel').hidden,true);assert.equal(f.el('add-cluster').classes.has('tour-target'),false);f.el('tour-next').click();assert.equal(JSON.stringify(f.state),before);assert.equal(f.controller.start(),false);
});
