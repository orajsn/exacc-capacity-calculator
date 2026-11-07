const test=require('node:test'),assert=require('node:assert/strict');
const L=require('./library');

// This adapter exercises storage policy and serial transactions. Real IndexedDB is checked in browser QA.
function memoryBackend(){
 const metas=new Map(),bodies=new Map(),stats={listReads:0,bodyReads:0,writes:0};let tail=Promise.resolve(),nextError=null;
 const copy=value=>value===undefined?undefined:structuredClone(value);
 return {metas,bodies,stats,failNext(error){nextError=error;},
  list:()=>tail.then(()=>{stats.listReads++;return [...metas.values()].map(copy);}),
  getMeta:key=>tail.then(()=>copy(metas.get(key))),
  read:key=>tail.then(()=>{stats.bodyReads++;return {meta:copy(metas.get(key)),body:copy(bodies.get(key))};}),
  mutate(key,change){const pending=tail.then(()=>{const update=change({meta:copy(metas.get(key)),body:copy(bodies.get(key)),count:metas.size});if(nextError){const error=nextError;nextError=null;throw error;}if(update.kind==='put'){metas.set(key,copy(update.meta));bodies.set(key,copy(update.body));stats.writes++;}else if(update.kind==='delete'){metas.delete(key);bodies.delete(key);stats.writes++;}return copy(update.result);});tail=pending.catch(()=>{});return pending;},close(){}};
}
function scenario(project={}){return L.ensureIdentity({schema:'exacc-capacity/v1',project:{name:'Capacity plan',customer:'Example Bank',owner:'JSN',notes:'Illustrative',...project},sites:[{name:'Production',siteName:'DC',nodes:[{id:1},{id:2}],clusters:[{name:'Apps',uid:'avmc-01',topology:{acds:[{id:'acd-01',name:'Payments',adbs:[{id:'adb-01',name:'PaymentsDB'}]}]}}]}]});}
const now=()=>'2026-11-07T12:00:00.000Z';
function fixture(options={}){const backend=memoryBackend();return {backend,store:L.createStore(backend,{now,...options})};}
const code=wanted=>error=>{assert.equal(error.code,wanted);return true;};

test('identity is stable and a copy changes only the plan identity',()=>{
 const s=scenario(),before=JSON.stringify(s),first=s.project.id;assert.match(first,/^plan-/);L.ensureIdentity(s);assert.equal(JSON.stringify(s),before);
 const copy=L.copyAsNew(s);assert.notEqual(copy.project.id,first);assert.equal(copy.project.owner,'JSN');assert.deepEqual(copy.sites,s.sites);copy.sites[0].name='Changed';assert.equal(s.sites[0].name,'Production');
});
test('legacy project metadata remains valid and supplied safe custom IDs survive',()=>{
 const s={schema:'exacc-capacity/v1',sites:[{name:'M',clusters:[]}]};L.ensureIdentity(s);assert.equal(s.project.name,'');assert.ok(s.project.id);
 const custom=scenario({id:'CUSTOM_PLAN_2026'});assert.equal(custom.project.id,'CUSTOM_PLAN_2026');assert.deepEqual(L.validateProject({name:'Old',notes:'N'}),{name:'Old',notes:'N',customer:'',owner:''});
});
test('metadata rejects unsafe IDs, wrong field types and excessive fields',()=>{
 for(const id of ['short','<script>alert(1)</script>','with space','a'.repeat(81)])assert.throws(()=>L.validateProject({id}),code('invalid'));
 for(const p of [null,[],{owner:1},{customer:{}},{name:'x'.repeat(121)},{notes:'x'.repeat(6001)}])assert.throws(()=>L.validateProject(p),code('invalid'));
});
test('list uses only compact metadata and includes searchable site and owner context',async()=>{
 const {store,backend}=fixture(),s=scenario();const saved=await store.save(s,{expectedRevision:0});const rows=await store.list();
 assert.equal(rows.length,1);assert.equal(rows[0].owner,'JSN');assert.equal(rows[0].customer,'Example Bank');assert.deepEqual(rows[0].sites,[{name:'Production',siteName:'DC'}]);assert.equal(rows[0].adbCount,1);assert.equal(rows[0].acdCount,1);assert.equal(rows[0].avmcCount,1);assert.equal(rows[0].revision,1);assert.equal(rows[0].notes,undefined);assert.equal(rows[0].scenario,undefined);assert.equal(backend.stats.bodyReads,0);
 assert.equal((await store.getMeta(s.project.id)).id,s.project.id);assert.equal(backend.stats.bodyReads,0);assert.equal(saved.meta.bodyBytes,new Blob([JSON.stringify(s,null,2)]).size);
});
test('save captures the submitted snapshot, not later object mutations',async()=>{
 const {store}=fixture(),s=scenario(),pending=store.save(s,{expectedRevision:0});s.project.name='After call';await pending;
 assert.equal((await store.load(s.project.id)).scenario.project.name,'Capacity plan');
});
test('two writers cannot create or update the same revision silently',async()=>{
 const {store,backend}=fixture(),other=L.createStore(backend,{now}),s=scenario();const first=await Promise.allSettled([store.save(s,{expectedRevision:0}),other.save(s,{expectedRevision:0})]);
 assert.equal(first.filter(x=>x.status==='fulfilled').length,1);assert.equal(first.find(x=>x.status==='rejected').reason.code,'conflict');
 const a=structuredClone(s),b=structuredClone(s);a.project.name='First edit';b.project.name='Second edit';const updates=await Promise.allSettled([store.save(a,{expectedRevision:1}),other.save(b,{expectedRevision:1})]);
 assert.equal(updates.filter(x=>x.status==='fulfilled').length,1);assert.equal((await store.load(s.project.id)).scenario.project.name,'First edit');assert.equal((await store.getMeta(s.project.id)).revision,2);
});
test('a stale revision, missing revision or removed record cannot be overwritten or recreated',async()=>{
 const {store}=fixture(),s=scenario();await store.save(s,{expectedRevision:0});await assert.rejects(store.save(s,{}),code('invalid'));await assert.rejects(store.save(s,{expectedRevision:0}),code('conflict'));
 await store.archive(s.project.id,{expectedRevision:1});await store.remove(s.project.id,{expectedRevision:2});await assert.rejects(store.save(s,{expectedRevision:2}),code('conflict'));await assert.rejects(store.load(s.project.id),code('notfound'));assert.equal((await store.list()).length,0);
});
test('archive is reversible, hidden by default and must precede permanent deletion',async()=>{
 const {store}=fixture(),s=scenario();await store.save(s,{expectedRevision:0});await assert.rejects(store.remove(s.project.id,{expectedRevision:1}),code('invalid'));
 const archived=await store.archive(s.project.id,{expectedRevision:1});assert.equal(archived.meta.revision,2);assert.ok(archived.meta.archivedAt);assert.equal((await store.list()).length,0);assert.equal((await store.list({includeArchived:true})).length,1);
 await assert.rejects(store.save(s,{expectedRevision:2}),code('archived'));const restored=await store.restore(s.project.id,{expectedRevision:2});assert.equal(restored.meta.revision,3);assert.equal(restored.meta.archivedAt,null);assert.deepEqual((await store.load(s.project.id)).scenario,s);
});
test('archived entries count toward the limit and concurrent creates cannot exceed it',async()=>{
 const {store}=fixture();for(let i=0;i<99;i++){const s=scenario({id:`plan-limit-${String(i).padStart(8,'0')}`});await store.save(s,{expectedRevision:0});if(i===0)await store.archive(s.project.id,{expectedRevision:1});}
 const result=await Promise.allSettled([store.save(scenario(),{expectedRevision:0}),store.save(scenario(),{expectedRevision:0})]);assert.equal(result.filter(x=>x.status==='fulfilled').length,1);assert.equal(result.find(x=>x.status==='rejected').reason.code,'limit');assert.equal((await store.list({includeArchived:true})).length,100);
});
test('quota failure preserves both previous metadata and payload atomically',async()=>{
 const {store,backend}=fixture(),s=scenario();await store.save(s,{expectedRevision:0});s.project.name='Must not replace';backend.failNext(new DOMException('full','QuotaExceededError'));
 await assert.rejects(store.save(s,{expectedRevision:1}),code('quota'));const previous=await store.load(s.project.id);assert.equal(previous.meta.revision,1);assert.equal(previous.meta.name,'Capacity plan');assert.equal(previous.scenario.project.name,'Capacity plan');
});
test('size guards use UTF-8 bytes, not character count',async()=>{
 const {store}=fixture(),s=scenario();s.extension='界'.repeat(3400000);assert.ok(JSON.stringify(s).length<L.MAX_BYTES);await assert.rejects(store.save(s,{expectedRevision:0}),code('limit'));assert.equal((await store.list()).length,0);
});
test('non-finite, executable or cyclic values never become a saved JSON snapshot',async()=>{
 for(const value of [NaN,Infinity,()=>{},Symbol('x'),1n]){const {store}=fixture(),s=scenario();s.extension=value;await assert.rejects(store.save(s,{expectedRevision:0}),code('invalid'));}
 const {store}=fixture(),s=scenario();s.extension=s;await assert.rejects(store.save(s,{expectedRevision:0}),code('invalid'));
});
test('record revision, bytes and labels must agree before loading',async()=>{
 for(const tamper of [({backend},id)=>backend.bodies.get(id).revision++,({backend},id)=>backend.metas.get(id).bodyBytes++,({backend},id)=>backend.metas.get(id).customer='Different customer']){
  const f=fixture(),s=scenario();await f.store.save(s,{expectedRevision:0});tamper(f,s.project.id);await assert.rejects(f.store.load(s.project.id),code('corrupt'));
 }
});
test('metadata reads return detached objects and missing plans are explicit',async()=>{
 const {store}=fixture(),s=scenario();await store.save(s,{expectedRevision:0});const rows=await store.list();rows[0].name='Wrong';rows[0].sites[0].name='Wrong';assert.equal((await store.getMeta(s.project.id)).name,'Capacity plan');assert.equal((await store.load(s.project.id)).scenario.sites[0].name,'Production');await assert.rejects(store.getMeta('plan-not-found'),code('notfound'));
});
test('orphaned contents are not silently overwritten as a new plan',async()=>{
 const {store,backend}=fixture(),s=scenario();await store.save(s,{expectedRevision:0});const original=structuredClone(backend.bodies.get(s.project.id));backend.metas.delete(s.project.id);
 await assert.rejects(store.load(s.project.id),code('corrupt'));await assert.rejects(store.save(s,{expectedRevision:0}),code('corrupt'));assert.deepEqual(backend.bodies.get(s.project.id),original);
});
test('legacy migration is deterministic and repeat migration does not overwrite later edits',async()=>{
 const {store}=fixture(),old=scenario();delete old.project.id;const draft={schema:'exacc-device-draft/v1',version:'2.0.0',savedAt:'2026-11-06T12:00:00Z',scenario:old};const original=JSON.stringify(draft);
 const first=await store.importLegacy(draft);assert.match(first.meta.id,/^plan-legacy-/);assert.equal(first.migrated,true);assert.equal(JSON.stringify(draft),original);
 first.scenario.project.name='Edited after migration';await store.save(first.scenario,{expectedRevision:1});const again=await store.importLegacy(draft);assert.equal(again.alreadyImported,true);assert.equal(again.meta.id,first.meta.id);assert.equal(again.meta.revision,2);assert.equal(again.scenario.project.name,'Edited after migration');assert.equal((await store.list()).length,1);
});
test('concurrent legacy migration creates one copy and leaves the source untouched',async()=>{
 const {store,backend}=fixture(),other=L.createStore(backend,{now}),s=scenario();delete s.project.id;const draft={schema:'exacc-device-draft/v1',version:'2',savedAt:'2026-11-06T12:00:00Z',scenario:s};const results=await Promise.all([store.importLegacy(draft),other.importLegacy(draft)]);
 assert.equal(results.filter(x=>x.migrated).length,1);assert.equal(results[0].meta.id,results[1].meta.id);assert.equal((await store.list()).length,1);assert.equal(draft.scenario.project.id,undefined);
});
test('a valid compact legacy draft is not rejected because of pretty-print expansion',async()=>{
 const {store}=fixture(),s=scenario();delete s.project.id;s.extension=Array.from({length:40000},()=>({x:'aaaaaaaaaa',y:'bbbbbbbbbb'}));const draft={schema:'exacc-device-draft/v1',version:'2',savedAt:'2026-11-06T12:00:00Z',scenario:s};
 assert.ok(new Blob([JSON.stringify(draft)]).size<2000000);assert.ok(new Blob([JSON.stringify(draft,null,2)]).size>2100000);const result=await store.importLegacy(draft);assert.equal(result.migrated,true);assert.equal(result.scenario.extension.length,40000);
});
test('legacy hash collision or an existing supplied ID never silently merges plans',async()=>{
 const {store}=fixture({digest:async()=>'0'.repeat(64)}),s=scenario();delete s.project.id;const draft={schema:'exacc-device-draft/v1',version:'2',savedAt:'2026-11-06T12:00:00Z',scenario:s};await store.importLegacy(draft);const other=structuredClone(draft);other.scenario.project.name='Another plan';await assert.rejects(store.importLegacy(other),code('conflict'));assert.equal((await store.list())[0].name,'Capacity plan');
 const f=fixture(),existing=scenario();await f.store.save(existing,{expectedRevision:0});await assert.rejects(f.store.importLegacy({...draft,scenario:existing}),code('conflict'));
});
test('malformed migration and storage failures leave an existing plan available',async()=>{
 const {store,backend}=fixture(),s=scenario();await store.save(s,{expectedRevision:0});await assert.rejects(store.importLegacy({schema:'wrong'}),code('invalid'));backend.failNext(new DOMException('denied','SecurityError'));await assert.rejects(store.archive(s.project.id,{expectedRevision:1}),code('unavailable'));assert.equal((await store.load(s.project.id)).meta.archivedAt,null);
});
test('storage unavailable, blocked upgrade and a closed connection are actionable',async()=>{
 await assert.rejects(L.open({indexedDB:null}),code('unavailable'));
 let closed=0;const request={result:{close(){closed++;}}};const opening=L.open({indexedDB:{open(){queueMicrotask(()=>{request.onblocked();request.onsuccess();});return request;}}});await assert.rejects(opening,code('unavailable'));assert.equal(closed,1);
 const {store}=fixture();store.close();await assert.rejects(store.list(),code('unavailable'));
});
test('library has no network transport, source execution or automatic device clearing',()=>{
 const source=require('node:fs').readFileSync(require.resolve('./library.js'),'utf8');assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|sendBeacon|eval\(|new Function|localStorage|deleteDatabase\(/);
});
