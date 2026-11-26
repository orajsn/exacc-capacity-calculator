const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('./model');
const P = require('./planning');
const V = require('./live-capacity');
const S = require('./sizing');
test('dock and summary communicate the same warning for an existing low-CPU allocation', () => {
 const machine = M.newSite();
 Object.assign(machine.clusters[0], {cpu:32, slots:1, allocationKind:'existing'});
 const result = M.calculate(machine);
 const dock = V.build(machine,result,P);
 assert.equal(dock.level,'warning');
 assert.equal(dock.level,P.summary(machine,result).status);
 assert.match(dock.note,/40.ECPU/);
});
test('a DB-server candidate can fit while the entered shared storage is short', () => {
 const machine=M.newSite();
 machine.planning={storageCapacity:10,storageAllocated:12};
 Object.assign(machine.clusters[0],{slots:1,requirements:{ecpu:32,ramGB:128,unsizedACDs:0,minRatio:2}});
 const choice=S.suggest(machine,M,P).minimum;
 assert.ok(choice?.fit);
 const storage=P.resources(choice.candidate,choice.result).find(row=>row.unit==='TB');
 assert.equal(storage.free,-2);
 assert.equal(storage.status,'Over capacity');
});
