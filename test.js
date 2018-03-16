load("weakref.js");

assertEq(typeof WeakFactory, 'function');
assertEq(WeakFactory.length, 0);
assertEq(typeof WeakFactory.prototype.makeCell, 'function');
assertEq(WeakFactory.prototype.makeCell.length, 1);
assertEq(typeof WeakFactory.prototype.makeRef, 'function');
assertEq(WeakFactory.prototype.makeRef.length, 1);
assertEq(typeof WeakFactory.prototype.shutdown, 'function');
assertEq(WeakFactory.prototype.shutdown.length, 0);

assertEq(typeof WeakCell, 'undefined');
assertEq(typeof WeakRef, 'undefined');


let cellsCleanedBetweenTurns = [];
let factory = new WeakFactory(cleanedCell => cellsCleanedBetweenTurns.push(cleanedCell));

let oldTargetSet = new WeakSet();

let cellTarget = {};
let refTarget = {cellTarget};
let holdings = {};

let cell = factory.makeCell(cellTarget, holdings);
let ref = factory.makeRef(refTarget, holdings);

cell.__proto__.toSource = function () { return "[object WeakCell]" };
ref.__proto__.toSource = function () { return "[object WeakRef]" };
oldTargetSet.add(cellTarget);
oldTargetSet.add(refTarget);

assertEq(typeof cell.deref, "undefined");
assertEq(ref.deref(), refTarget);
assertEq(ref.holdings, holdings);

gc();
assertEq(ref.deref(), refTarget);
assertEq(ref.holdings, holdings);

cellTarget = {};
refTarget = {};

gc();
assertEq(oldTargetSet.has(ref.deref()), true);
assertEq(ref.holdings, holdings);
assertEq(cell.holdings, holdings);

// This won't clear the ref or the cell, because the last gc happened in
// the same turn as the deref, keeping refTarget and thus also cellTarget
// alive.
pretendNewTurn(true);

assertEq(cellsCleanedBetweenTurns.length, 0);

cellsCleanedBetweenTurns = [];
gc();
// No deref before the gc in this turn, so the cell and ref will be cleared.
pretendNewTurn(true);

assertEq(cellsCleanedBetweenTurns.length, 2);
assertEq(cellsCleanedBetweenTurns[0], cell);
assertEq(cellsCleanedBetweenTurns[1], ref);

assertEq(oldTargetSet.has(ref.deref()), false);
assertEq(ref.deref(), undefined);
assertEq(ref.holdings, holdings);

ref = factory.makeRef(refTarget, holdings);
oldTargetSet.add(refTarget);

assertEq(ref.deref(), refTarget);
assertEq(ref.holdings, holdings);

gc();
assertEq(ref.deref(), refTarget);
assertEq(ref.holdings, holdings);

oldTargetSet.add(refTarget);
refTarget = {};

cellsCleanedBetweenTurns = [];
let cleanedRefs = [];

pretendNewTurn(false);


// This won't clear any refs, because the last gc happened in the same turn as a deref.
factory.cleanupSome(ref => cleanedRefs.push(ref));

assertEq(cellsCleanedBetweenTurns.length, 0);
assertEq(cleanedRefs.length, 0);

gc();
// No deref before the gc in this turn, so the ref will be cleared.
pretendNewTurn(false);

assertEq(cellsCleanedBetweenTurns.length, 0);

factory.cleanupSome(ref => cleanedRefs.push(ref));
assertEq(cleanedRefs.length, 1);
assertEq(cleanedRefs[0], ref);

cleanedRefs = [];
factory.cleanupSome(ref => cleanedRefs.push(ref));
assertEq(cleanedRefs.length, 0);

cellsCleanedBetweenTurns = [];
cellTarget = {};
refTarget = {cellTarget};
cell = factory.makeRef(cellTarget, holdings);
ref = factory.makeRef(refTarget, holdings);

factory.shutdown();
cellTarget = refTarget = null;
gc();
pretendNewTurn();

assertEq(cellsCleanedBetweenTurns.length, 0);
assertEq(ref.deref(), undefined);

function assertThrows(test, errorType) {
    try {
        test();
    } catch (e) {
        assertEq(e instanceof errorType, true);
        return;
    }
    assertEq(true, false, "Expected an exception");
}

assertThrows(() => factory.makeCell(cellTarget), TypeError);
assertThrows(() => factory.makeRef(refTarget), TypeError);
assertThrows(() => factory.cleanupSome(() => { throw new Error("Mustn't be called"); }), TypeError);

cellsCleanedBetweenTurns = [];

cellTarget = {};
refTarget = {cellTarget};
factory = new WeakFactory(cleanedCell => cellsCleanedBetweenTurns.push(cleanedCell));
cell = factory.makeRef(cellTarget, holdings);
ref = factory.makeRef(refTarget, holdings);

// Factories aren't held alive by cells
oldTargetSet = new WeakMap();
oldTargetSet.set(factory, true);
factory = null;
gc();
assertEq(nondeterministicGetWeakMapKeys(oldTargetSet).length, 0);

// Finalizers aren't run after a factory has been GCd.

oldTargetSet.set(cell, true);
oldTargetSet.set(ref, true);
cell = ref = null;
gc();
assertEq(nondeterministicGetWeakMapKeys(oldTargetSet).length, 0);

pretendNewTurn(true);
assertEq(cellsCleanedBetweenTurns.length, 0);


print("All tests passed!");
