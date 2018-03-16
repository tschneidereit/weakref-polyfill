load("weakref.js");

assertEq(typeof WeakRefGroup, 'function');
assertEq(WeakRefGroup.length, 0);
assertEq(typeof WeakRefGroup.prototype.makeRef, 'function');
assertEq(WeakRefGroup.prototype.makeRef.length, 1);
assertEq(typeof WeakRefGroup.prototype.shutdown, 'function');
assertEq(WeakRefGroup.prototype.shutdown.length, 0);

assertEq(typeof WeakRef, 'undefined');

let refsCleanedBetweenTurns = [];
let group = new WeakRefGroup(ref => refsCleanedBetweenTurns.push(ref));

let oldTargetSet = new WeakSet();

let target = {};
let holdings = {};

let ref = group.makeRef(target, holdings);
oldTargetSet.add(target);

assertEq(ref.deref(), target);
assertEq(ref.holdings, holdings);

gc();
assertEq(ref.deref(), target);
assertEq(ref.holdings, holdings);

target = {};

gc();
assertEq(oldTargetSet.has(ref.deref()), true);
assertEq(ref.holdings, holdings);

// This won't clear any refs, because the last gc happened in the same turn as a deref.
pretendNewTurn(true);

assertEq(refsCleanedBetweenTurns.length, 0);

gc();
// No deref before the gc in this turn, so the ref will be cleared.
pretendNewTurn(true);

assertEq(refsCleanedBetweenTurns.length, 1);
assertEq(refsCleanedBetweenTurns[0], ref);

assertEq(oldTargetSet.has(ref.deref()), false);
assertEq(ref.deref(), undefined);
assertEq(ref.holdings, holdings);

ref = group.makeRef(target, holdings);
oldTargetSet.add(target);

assertEq(ref.deref(), target);
assertEq(ref.holdings, holdings);

gc();
assertEq(ref.deref(), target);
assertEq(ref.holdings, holdings);

oldTargetSet.add(target);
target = {};

refsCleanedBetweenTurns = [];
let cleanedRefs = [];

pretendNewTurn(false);


// This won't clear any refs, because the last gc happened in the same turn as a deref.
group.purgeSome(ref => cleanedRefs.push(ref));

assertEq(refsCleanedBetweenTurns.length, 0);
assertEq(cleanedRefs.length, 0);

gc();
// No deref before the gc in this turn, so the ref will be cleared.
pretendNewTurn(false);

assertEq(refsCleanedBetweenTurns.length, 0);

group.purgeSome(ref => cleanedRefs.push(ref));
assertEq(cleanedRefs.length, 1);
assertEq(cleanedRefs[0], ref);

cleanedRefs = [];
group.purgeSome(ref => cleanedRefs.push(ref));
assertEq(cleanedRefs.length, 0);


print("great success!");
