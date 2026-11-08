'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),T=require('./theme.js');
function events(target={}){
 const listeners=new Map();return Object.assign(target,{addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},emit(type,event={}){for(const fn of [...(listeners.get(type)||[])])fn(event);}});
}
function fixture({saved=null,dark=false,loading=false,legacy=false,denied=false}={}){
 const attributes={},writes=[],select=events({value:''}),doc=events({readyState:loading?'loading':'complete',documentElement:{setAttribute:(key,value)=>attributes[key]=value},getElementById:()=>select});
 const media=events({matches:dark}),storage={getItem:key=>{assert.equal(key,T.STORAGE_KEY);return saved;},setItem:(key,value)=>{writes.push([key,value]);saved=value;}};
 if(legacy){const add=media.addEventListener,remove=media.removeEventListener;media.addListener=fn=>add('change',fn);media.removeListener=fn=>remove('change',fn);delete media.addEventListener;delete media.removeEventListener;}
 const env=events({document:doc,matchMedia:query=>{assert.equal(query,'(prefers-color-scheme: dark)');return media;}});
 Object.defineProperty(env,'localStorage',{get(){if(denied)throw Error('Storage denied');return storage;}});
 return {env,doc,media,select,attributes,writes,storage,setSystem(value){media.matches=value;media.emit('change',{matches:value});}};
}
test('system is the default and resolves before the selector exists in the parsed document',()=>{
 const f=fixture({dark:true,loading:true}),controller=T.init(f.env);
 assert.equal(f.attributes['data-theme'],'dark');assert.equal(controller.getMode(),'system');assert.equal(f.select.value,'');assert.deepEqual(f.writes,[]);
 f.doc.emit('DOMContentLoaded');assert.equal(f.select.value,'system');
 f.setSystem(false);assert.equal(f.attributes['data-theme'],'light');assert.equal(controller.getTheme(),'light');
});
test('the early browser script applies saved appearance immediately and binds after DOM parsing',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),f=fixture({saved:'dark',loading:true});
 vm.runInNewContext(fs.readFileSync(require.resolve('./theme.js'),'utf8'),f.env);
 assert.equal(f.attributes['data-theme'],'dark');assert.equal(typeof f.env.ExaTheme.init,'function');assert.equal(f.select.value,'');
 f.doc.emit('DOMContentLoaded');assert.equal(f.select.value,'dark');f.select.value='light';f.select.emit('change');assert.equal(f.attributes['data-theme'],'light');assert.deepEqual(f.writes,[[T.STORAGE_KEY,'light']]);
});
test('explicit saved modes override the operating system and native selection persists only its preference',()=>{
 for(const saved of ['light','dark']){
  const f=fixture({saved,dark:saved==='light'}),controller=T.init(f.env);
  assert.equal(f.attributes['data-theme'],saved);assert.equal(f.select.value,saved);f.setSystem(!f.media.matches);assert.equal(controller.getTheme(),saved);
  f.select.value=saved==='light'?'dark':'light';f.select.emit('change');assert.equal(controller.getMode(),f.select.value);assert.deepEqual(f.writes,[[T.STORAGE_KEY,f.select.value]]);
  f.select.value='system';f.select.emit('change');f.setSystem(true);assert.equal(f.attributes['data-theme'],'dark');f.setSystem(false);assert.equal(f.attributes['data-theme'],'light');
 }
});
test('invalid stored modes fall back to system; invalid assignments cannot alter theme or storage',()=>{
 for(const saved of ['DARK','auto','',{},'__proto__']){
  const f=fixture({saved,dark:true}),controller=T.init(f.env);assert.equal(controller.getMode(),'system');assert.equal(controller.getTheme(),'dark');
  assert.equal(controller.setMode(saved),false);assert.deepEqual(f.writes,[]);
  f.select.value='invalid';f.select.emit('change');assert.equal(f.select.value,'system');assert.equal(f.attributes['data-theme'],'dark');
 }
});
test('denied storage access and quota failures leave the selected mode usable in memory',()=>{
 const f=fixture({denied:true,dark:true}),controller=T.init(f.env);assert.equal(controller.getTheme(),'dark');assert.equal(controller.setMode('light'),true);assert.equal(f.attributes['data-theme'],'light');f.setSystem(true);assert.equal(controller.getTheme(),'light');
 const q=fixture();q.storage.setItem=()=>{throw Error('Quota exceeded');};const next=T.init(q.env);assert.equal(next.setMode('dark'),true);assert.equal(q.select.value,'dark');assert.equal(q.attributes['data-theme'],'dark');
});
test('missing system-theme APIs fall back to light while legacy media listeners remain functional',()=>{
 const f=fixture();delete f.env.matchMedia;const controller=T.init(f.env);assert.equal(controller.getTheme(),'light');controller.setMode('dark');assert.equal(controller.getTheme(),'dark');
 const legacy=fixture({legacy:true}),old=T.init(legacy.env);legacy.setSystem(true);assert.equal(old.getTheme(),'dark');old.setMode('light');legacy.setSystem(false);assert.equal(old.getTheme(),'light');
});
test('cross-tab theme updates sync the selector without writing back or following unrelated storage',()=>{
 const f=fixture(),controller=T.init(f.env);f.env.emit('storage',{key:'unrelated-plan',newValue:'dark'});assert.equal(controller.getMode(),'system');
 f.env.emit('storage',{key:T.STORAGE_KEY,newValue:'dark'});assert.equal(controller.getTheme(),'dark');assert.equal(f.select.value,'dark');f.setSystem(false);assert.equal(controller.getTheme(),'dark');
 f.env.emit('storage',{key:T.STORAGE_KEY,newValue:null});assert.equal(controller.getMode(),'system');assert.equal(controller.getTheme(),'light');
 f.setSystem(true);f.env.emit('storage',{key:null,newValue:null});assert.equal(controller.getTheme(),'dark');assert.deepEqual(f.writes,[]);
});
test('destroy removes DOM, operating-system and storage listeners and rejects later changes',()=>{
 for(const legacy of [false,true]){
  const f=fixture({legacy}),controller=T.init(f.env);controller.destroy();controller.destroy();f.setSystem(true);f.env.emit('storage',{key:T.STORAGE_KEY,newValue:'dark'});f.select.value='dark';f.select.emit('change');assert.equal(controller.getMode(),'system');assert.equal(f.attributes['data-theme'],'light');assert.deepEqual(f.writes,[]);assert.equal(controller.setMode('dark'),false);
 }
 const f=fixture({loading:true}),controller=T.init(f.env);controller.destroy();f.doc.emit('DOMContentLoaded');assert.equal(f.select.value,'');
});
