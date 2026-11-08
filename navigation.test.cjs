'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const attrs=source=>Object.fromEntries([...source.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(a=>[a[1],a[2]??a[3]]));
const references=html=>[...html.matchAll(/<(a|link|script|img)\b([^>]*)>/gi)].map(m=>({tag:m[1].toLowerCase(),...attrs(m[2])}));
function entrypoints(window={}){const ctx={window,URL,URLSearchParams};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('./entrypoints.js'),'utf8'),ctx);return code=>vm.runInContext(code,ctx);}
test('planner query accepts only the documented starting actions',()=>{
 const run=entrypoints();for(const action of ['quick','workload','example','saved'])assert.equal(run(`plannerStartAction(${JSON.stringify('?source=guide&start='+action)})`),action);
 for(const search of ['',null,'?start=','?start=unknown','?start=QUICK','?start=javascript:alert(1)','?start=__proto__'])assert.equal(run(`plannerStartAction(${JSON.stringify(search)})`),null);
 assert.equal(run('plannerStartAction("?start=%77orkload")'),'workload');
});
test('consuming a start action preserves unrelated query, fragment, and current history state',()=>{
 const calls=[],history={state:{kept:true},replaceState(...args){calls.push(args);}},run=entrypoints({location:{href:'https://example.test/calculator/planner.html?source=guide&start=example#review'},history});run('consumePlannerStartAction()');assert.deepEqual(calls,[[history.state,'','/calculator/planner.html?source=guide#review']]);
 assert.doesNotThrow(()=>entrypoints()('consumePlannerStartAction()'));
 assert.doesNotThrow(()=>entrypoints({location:{href:'file:///planner.html?start=quick'},history:{replaceState(){throw Error('not allowed');}}})('consumePlannerStartAction()'));
});
test('planner Home and Guide links keep the current working tab open',()=>{
 const html=fs.readFileSync(require.resolve('./planner.html'),'utf8'),links=[...html.matchAll(/<a\b([^>]+)>/g)].map(m=>Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]])));
 for(const href of ['./','guide.html']){const link=links.find(a=>a.href===href);assert.ok(link,href+' navigation exists');assert.equal(link.target,'_blank');assert.ok((link.rel||'').split(/\s+/).includes('noopener'));}
});
test('public page navigation, anchors, downloads and image/font/script assets all resolve locally',()=>{
 const origin='https://example.test',prefix='/calculator/';
 for(const file of ['index.html','guide.html','planner.html']){
  const html=fs.readFileSync(path.join(__dirname,file),'utf8');
  for(const reference of references(html)){
   const value=reference.href||reference.src;if(!value)continue;const url=new URL(value,origin+prefix+file);if(url.origin!==origin)continue;
   assert.ok(url.pathname.startsWith(prefix),`${file}: link escapes the public directory: ${value}`);
   let relative=decodeURIComponent(url.pathname.slice(prefix.length));if(!relative||relative.endsWith('/'))relative+='index.html';const target=path.join(__dirname,relative);
   assert.ok(fs.existsSync(target)&&fs.statSync(target).isFile(),`${file}: missing local file ${value}`);assert.ok(fs.statSync(target).size>0,`${file}: empty local file ${value}`);
   if(url.hash&&relative.endsWith('.html')){const ids=new Set([...fs.readFileSync(target,'utf8').matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));assert.ok(ids.has(decodeURIComponent(url.hash.slice(1))),`${file}: missing anchor ${value}`);}
   if(url.searchParams.has('start')){assert.equal(relative,'planner.html');assert.ok(['quick','workload','example','saved'].includes(url.searchParams.get('start')),`${file}: unknown planner action`);}
  }
 }
});
test('Home and Guide stay independent from calculator state and provide every documented entry action',()=>{
 const actions=new Set();
 for(const file of ['index.html','guide.html']){
  const html=fs.readFileSync(path.join(__dirname,file),'utf8'),refs=references(html);
  assert.deepEqual(refs.filter(r=>r.tag==='script').map(r=>(r.src||'').split('?')[0]),['theme.js'],`${file}: only appearance may initialize on public pages`);
  assert.ok(html.includes("connect-src 'none'"));assert.doesNotMatch(html,/<form\b|type=["']password["']/i);assert.doesNotMatch(html,/exacc-capacity\/v1/);
  for(const reference of refs)if(reference.href){const url=new URL(reference.href,'https://example.test/calculator/'+file);if(url.searchParams.has('start'))actions.add(url.searchParams.get('start'));}
  for(const reference of refs.filter(r=>r.tag==='img'))assert.ok(reference.alt?.trim(),`${file}: screenshot needs an accessible description`);
 }
 assert.deepEqual([...actions].sort(),['example','quick','saved','workload']);
});
