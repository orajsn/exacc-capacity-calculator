const test=require('node:test'),assert=require('node:assert/strict'),M=require('./model.js');
test('one-slot published detailed formula and 16-slot service bound',()=>{let s=M.newSite();s.clusters[0].slots=1;assert.equal(M.calculate(s).used,681);s.clusters[0].slots=16;assert.equal(M.calculate(s).used,2226);s.clusters[0].slots=17;assert.match(M.calculate(s).errors.join(' '),/16-ACD/);});
test('empty two-node X11M capacity ceilings and residues',()=>{const s=M.newSite();s.bufferPercent=0;const rows=M.combinations(s);assert.deepEqual(rows.map(r=>r.absolute),[16,32,26,21,15,9]);assert.deepEqual(rows.map(r=>r.free),[2260,34,74,11,51,91]);});
test('two AVMCs and 20 slots leaves 1270 GB',()=>{const s=M.newSite();s.clusters.push(M.clone(s.clusters[0]));assert.equal(M.calculate(s).free,1270);});
test('three AVMCs with 2/6/4 slots and existing 564 GB allocation',()=>{const s=M.newSite();s.clusters=[2,6,4].map((slots,i)=>({...M.clone(s.clusters[0]),name:`AVMC ${i}`,slots}));s.nodes.forEach(n=>n.otherLocal=282);assert.equal(M.calculate(s).used,2970);assert.equal(M.calculate(s).free,952);});
test('per-node failure cannot hide behind positive site balance',()=>{const s=M.newSite('Site','x11m-standard',4);s.bufferPercent=0;s.clusters=[16,16,1].map(slots=>({...M.clone(s.clusters[0]),slots,nodes:[1,2]}));const r=M.calculate(s);assert.ok(r.free>0);assert.ok(r.nodes[0].free<0);assert.equal(r.status,'error');});
test('node count replicates storage, not ACD count',()=>{const s=M.newSite('Site','x11m-standard',4);s.clusters[0].slots=10;assert.equal(M.calculate(s).slots,10);assert.equal(M.calculate(s).used,3216);assert.equal(M.combinations(s)[1].absolute,32);});
test('buffered layouts fit every server and respect per-AVMC cap',()=>{const s=M.newSite();s.nodes[1].otherLocal=145;for(const row of M.combinations(s)){if(!row.buffered)continue;const candidate=M.clone(s);candidate.clusters=row.distribution.map(slots=>({...M.clone(s.clusters[0]),slots}));const r=M.calculate(candidate);assert.ok(r.nodes.every(n=>n.afterBuffer>=-1e-7));assert.ok(row.distribution.every(n=>n>=1&&n<=16));}});
test('base shape VM count and local capacity differ',()=>{const s=M.newSite('Base','x11m-base');s.bufferPercent=0;assert.equal(M.calculate(s).capacity,2168);assert.equal(M.combinations(s).length,2);});
test('invalid input and malformed imports never produce a fit',()=>{const s=M.newSite();s.clusters[0].slots=-1;assert.throws(()=>M.calculate(s));s.clusters[0].slots=2;s.clusters[0].nodes=[1];assert.throws(()=>M.calculate(s));assert.throws(()=>M.importScenario({schema:'other',sites:[]}));s.clusters[0].nodes=[1,1];assert.throws(()=>M.validate(s));});
test('scenario round trip preserves results and names as inert data',()=>{const s=M.newSite('<script>bad</script>');const q=M.importScenario(JSON.parse(JSON.stringify({schema:'exacc-capacity/v1',sites:[s]})));assert.deepEqual(M.calculate(q.sites[0]),M.calculate(s));});
test('CPU and memory checks are opt-in and allocation-specific',()=>{const s=M.newSite();s.checkCompute=false;s.clusters[0].cpu=1000;assert.equal(M.calculate(s).errors.length,0);s.checkCompute=true;assert.ok(M.calculate(s).errors.some(x=>x.includes('ECPUs exceed')));s.clusters[0].cpu=20;assert.ok(M.calculate(s).errors.some(x=>x.includes('40 ECPUs')));});

test('same-layout comparison preserves compute, names and the captured baseline', () => {
 const site = M.newSite();
 site.clusters[0].name = 'Existing workload';
 site.clusters[0].memoryPerCPU = 5;
 const before = M.calculate(site);
 const next = M.applyDesign(site, 1);
 assert.equal(next.clusters[0].name, 'Existing workload');
 assert.equal(next.clusters[0].cpu, 160);
 assert.equal(next.clusters[0].memoryPerCPU, 5);
 assert.equal(M.calculate(next).costs[0].memory, before.costs[0].memory);
 assert.equal(site.clusters[0].slots, 10);
});

test('different layout requires explicit allocations even when compute checks are off', () => {
 const site = M.newSite();
 site.checkCompute = false;
 const original = M.clone(site);
 assert.throws(() => M.applyDesign(site, 2), /enter replacement/);
 assert.throws(() => M.applyDesign(site, 2, {cpu: 0, memoryPerCPU: 5}));
 assert.deepEqual(site, original);
 const next = M.applyDesign(site, 2, {cpu: 160, memoryPerCPU: 5});
 assert.ok(next.clusters.every(c => c.cpu === 160 && c.memoryPerCPU === 5));
 const four = M.newSite('Four', 'x11m-standard', 4);
 four.clusters[0].nodes = [1, 3];
 assert.throws(() => M.applyDesign(four, 1), /enter replacement/);
});

test('imported nonsequential server IDs survive growth and shrink', () => {
 const source = M.newSite();
 source.nodes[0].id = 2;
 source.nodes[1].id = 3;
 source.clusters[0].nodes = [2, 3];
 const imported = M.importScenario({schema: 'exacc-capacity/v1', sites: [source]}).sites[0];
 const grown = M.resizeNodes(imported, 3);
 assert.deepEqual(grown.nodes.map(n => n.id), [2, 3, 1]);
 assert.deepEqual(grown.clusters[0].nodes, [2, 3, 1]);
 grown.clusters[0].nodes = [2, 3];
 const shrunk = M.resizeNodes(grown, 2);
 assert.deepEqual(shrunk.clusters[0].nodes, [2, 3]);
 assert.deepEqual(imported, source);
});

test('invalid node resize leaves the original placement unchanged', () => {
 const site = M.newSite('Four', 'x11m-standard', 4);
 site.clusters[0].nodes = [3, 4];
 const original = M.clone(site);
 assert.throws(() => M.resizeNodes(site, 2), /select at least two/);
 assert.deepEqual(site, original);
 assert.throws(() => M.resizeNodes(M.newSite('Base', 'x11m-base'), 3), /exactly two/);
});
