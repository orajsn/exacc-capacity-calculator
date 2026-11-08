(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaTour=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const STORAGE_KEY='autonomous-planner-tour-v1';
 const STEPS=[
  {title:'Confirm the hardware',instruction:'Choose a hardware preset and DB-server count. These are practice assumptions. Select Next when the fields are valid.',view:1},
  {title:'Add an AVMC',instruction:'Select the real Add AVMC button. The new cluster will appear in the working plan and allocation diagram.',view:2},
  {title:'Reserve two ACD slots',instruction:'Set Maximum ACD slots to 2 in the practice AVMC. Watch the local reservation change.',view:2},
  {title:'Read the live capacity',instruction:'Inspect allocated and remaining local storage in the actual diagram. Select Next after reviewing it.',view:2},
  {title:'Save the practice plan',instruction:'Select Save on this device. Completion requires a confirmed device save of this exact plan; downloading JSON alone does not count.',view:2}
 ];
 function create(options){
  const doc=options.document,env=options.window||{},get=id=>doc.getElementById(id),panel=get('tour-panel');
  let session=null,queued=false,highlighted=[],observer=null,destroyed=false;
  const controls=Object.fromEntries(['title','step','instruction','status','back','next','skip','exit'].map(name=>[name,get('tour-'+name)]));
  function remember(value){try{const storage=env.localStorage;if(value==='dismissed'&&storage?.getItem(STORAGE_KEY)==='completed')return;storage?.setItem(STORAGE_KEY,value);}catch{}}
  function className(element,add){if(element.classList){element.classList[add?'add':'remove']('tour-target');return;}const classes=(element.getAttribute('class')||'').split(/\s+/).filter(c=>c&&c!=='tour-target');if(add)classes.push('tour-target');element.setAttribute('class',classes.join(' '));}
  function clearTargets(){for(const {element,tabindex}of highlighted){className(element,false);if(tabindex===null)element.removeAttribute('tabindex');}highlighted=[];}
  function targets(machine){
   if(session.index===0)return [get('profile'),get('node-count')].filter(Boolean);
   if(session.index===1)return [get('add-cluster')].filter(Boolean);
   if(session.index===2)return [options.getSlotControl(session.clusterId)].filter(Boolean);
   return [get(session.index===3?'allocation-map':'plan-save-device')].filter(Boolean);
  }
  function measure(){if(!panel)return;const height=panel.hidden?0:Math.ceil(panel.getBoundingClientRect?.().height||260);doc.documentElement.style?.setProperty('--tour-panel-height',`${height}px`);}
  function showPanel(){panel.hidden=false;if(doc.body)doc.body.dataset.tourActive='true';measure();}
  function close(){if(!session)return;if(!session.terminal)remember('dismissed');session.active=false;session.closed=true;clearTargets();panel.hidden=true;if(doc.body)delete doc.body.dataset.tourActive;measure();}
  function finish(completed,message){
   session.active=false;session.terminal=true;clearTargets();remember(completed?'completed':'dismissed');showPanel();
   controls.title.textContent=completed?'Guided practice completed':'Guided practice not completed';controls.step.textContent='Practice summary';controls.instruction.textContent=message;
   const skipped=session.evidence.filter(value=>value==='skipped').length;
   controls.status.textContent=completed?'All five steps were confirmed. The practice plan is saved on this device.':`${skipped?`${skipped} step${skipped===1?' was':'s were'} skipped. `:''}This run is not marked complete.`;
   controls.next.textContent='Finish';controls.next.disabled=false;controls.back.disabled=session.index===0;controls.skip.hidden=true;
  }
  function context(){
   const state=options.getState(),machine=options.getMachine();
   if(state.project?.id!==session.planId||machine?.uid!==session.machineId||!state.sites.some(s=>s.uid===session.machineId)){finish(false,'The plan or active machine changed. Your current work has been kept. Restart guided practice from the Guide when ready.');return null;}
   const cluster=session.clusterId?machine.clusters.find(c=>c.uid===session.clusterId):null;
   if(session.clusterId&&!cluster){finish(false,'The practice AVMC was removed. Your current work has been kept; the tour will not select a different AVMC automatically.');return null;}
   return {state,machine,cluster};
  }
  function valid(machine){try{options.validate(machine);return true;}catch{return false;}}
  function hardwareValid(machine){const profile=get('profile'),nodes=get('node-count');return valid(machine)&&!!profile&&!!nodes&&profile.value===machine.profile&&String(nodes.value).trim()!==''&&Number(nodes.value)===machine.nodes.length;}
  function slotsValid(machine,cluster){const input=options.getSlotControl(session.clusterId);return !!cluster&&valid(machine)&&cluster.slots===2&&!!input&&String(input.value).trim()!==''&&Number(input.value)===2;}
  function visible(element){for(let p=element;p;p=p.parentElement){if(p.hidden)return false;if(String(p.tagName).toLowerCase()==='details'&&!p.open&&element!==p.querySelector?.('summary'))return false;}return true;}
  function updateTargets(list,focus=false){
   const same=list.length===highlighted.length&&list.every((element,i)=>highlighted[i].element===element);
   if(!same){clearTargets();for(const element of list){const tabindex=element.getAttribute('tabindex');className(element,true);highlighted.push({element,tabindex});}}
   if(list[0]?.getBoundingClientRect&&env.innerWidth)panel.dataset.side=list[0].getBoundingClientRect().left>env.innerWidth*.5?'left':'right';
   if(focus&&list[0]){const element=list[0];let behavior='smooth';try{if(env.matchMedia?.('(prefers-reduced-motion: reduce)').matches)behavior='auto';}catch{}if(!['input','select','button','summary','textarea'].includes(String(element.tagName).toLowerCase())&&element.getAttribute('tabindex')===null)element.setAttribute('tabindex','-1');element.scrollIntoView?.({block:'center',behavior});element.focus?.({preventScroll:true});}
  }
  function enter(index){
   session.index=index;session.active=true;session.terminal=false;session.addClicked=false;session.slotsEdited=false;
   const machine=options.getMachine();if(index===1)session.beforeAdd=machine.clusters.map(c=>c.uid);
   controls.skip.hidden=false;controls.next.textContent='Next';showPanel();
   options.navigate(STEPS[index].view,index===2?session.clusterId:null);refresh(true);
  }
  function refresh(focus=false){
   if(!session?.active||destroyed)return;const current=context();if(!current)return;const {machine,cluster}=current;
   if(session.index===1&&session.addClicked){
    const added=machine.clusters.find(c=>c.uid&&!session.beforeAdd.includes(c.uid));session.addClicked=false;
    if(added&&valid(machine)){session.clusterId=added.uid;session.evidence[1]='completed';session.evidence[2]='pending';enter(2);return;}
   }
   if(session.index===2&&session.slotsEdited&&slotsValid(machine,cluster)){session.slotsEdited=false;session.evidence[2]='completed';enter(3);return;}
   if(session.index===4&&options.isSaved(session.planId)){
    session.evidence[4]='completed';const completed=session.evidence.every(value=>value==='completed')&&hardwareValid(machine)&&slotsValid(machine,cluster);
    finish(completed,completed?'You used the real hardware, AVMC, ACD-slot, capacity and save controls. Continue editing this clearly named practice plan or open another plan.':'The plan was saved, but one or more tour steps were skipped or are no longer valid. Revisit them with Back, or Finish to leave this incomplete run.');return;
   }
   const list=targets(machine),shown=list.length>0&&list.every(visible),step=STEPS[session.index];updateTargets(list,focus&&shown);
   controls.title.textContent=step.title;controls.step.textContent=`${session.index+1} of ${STEPS.length} · Guided practice`;controls.instruction.textContent=step.instruction;controls.back.disabled=session.index===0;
   const ready=session.index===0?hardwareValid(machine):session.index===1?session.evidence[1]==='completed'&&!!cluster&&valid(machine):session.index===2?session.evidence[2]==='completed'&&slotsValid(machine,cluster):session.index===3?valid(machine):false;
   controls.next.disabled=!shown||!ready;
   controls.status.textContent=!shown?`Open ${step.view===1?'Machine':'Allocations'} and the highlighted control to continue.`:session.index===0&&!ready?'Enter valid hardware and DB-server values before continuing.':session.index===1&&session.evidence[1]!=='completed'?'Waiting for you to add an AVMC.':session.index===2&&!ready?'Waiting for a valid ACD-slot value of 2.':session.index===4?'Waiting for a successful device save.':'';
   measure();
  }
  function next(){
   if(!session||session.closed)return;if(session.terminal){close();return;}refresh();if(!session.active||controls.next.disabled)return;
   session.evidence[session.index]='completed';enter(session.index+1);
  }
  function back(){if(!session||session.closed||session.index===0)return;enter(session.index-1);}
  function skip(){
   if(!session?.active)return;session.evidence[session.index]='skipped';remember('dismissed');
   if(session.index===4){finish(false,'You skipped the save step. Nothing was saved by the tour.');return;}
   let index=session.index+1;
   if(session.index===1&&!session.clusterId){const existing=options.getMachine().clusters.find(c=>c.uid);if(existing)session.clusterId=existing.uid;else{session.evidence[2]='skipped';index=3;}}
   enter(index);
  }
  function defer(){if(queued||!session?.active)return;queued=true;Promise.resolve().then(()=>{queued=false;refresh();});}
  function eventChanged(event){
   if(!session?.active)return;
   if(event.type==='click'&&session.index===1&&event.target.closest?.('#add-cluster'))session.addClicked=true;
   if(['input','change'].includes(event.type)&&session.index===2&&event.target===options.getSlotControl(session.clusterId))session.slotsEdited=true;
   defer();
  }
  function escape(event){if(event.key==='Escape'&&session&&!session.closed){event.preventDefault?.();close();}}
  for(const type of ['input','change','click'])doc.addEventListener?.(type,eventChanged);doc.addEventListener?.('keydown',escape);
  controls.next?.addEventListener('click',next);controls.back?.addEventListener('click',back);controls.skip?.addEventListener('click',skip);controls.exit?.addEventListener('click',close);
  if(env.ResizeObserver&&panel){observer=new env.ResizeObserver(measure);observer.observe(panel);}
  return {start(){
   if(destroyed||!panel||Object.values(controls).some(value=>!value))return false;
   const state=options.getState(),machine=options.getMachine();if(!state.project?.id||!machine?.uid)return false;
   clearTargets();session={planId:state.project.id,machineId:machine.uid,clusterId:null,index:0,active:true,terminal:false,closed:false,evidence:Array(STEPS.length).fill('pending')};const invitation=get('tour-invitation');if(invitation)invitation.hidden=true;enter(0);return true;
  },refresh,next,back,skip,exit:close,getStatus:()=>session?{planId:session.planId,machineId:session.machineId,clusterId:session.clusterId,index:session.index,active:session.active,terminal:session.terminal,closed:session.closed,evidence:[...session.evidence]}:null,destroy(){
   close();destroyed=true;observer?.disconnect();for(const type of ['input','change','click'])doc.removeEventListener?.(type,eventChanged);doc.removeEventListener?.('keydown',escape);
   controls.next?.removeEventListener('click',next);controls.back?.removeEventListener('click',back);controls.skip?.removeEventListener('click',skip);controls.exit?.removeEventListener('click',close);
  }};
 }
 return {STORAGE_KEY,STEPS,create};
});
