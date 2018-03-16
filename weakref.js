var WeakRefGroup;
var pretendNewTurn;

{
  WeakRefGroup = class WeakRefGroup {
    constructor(cleanup = undefined) {
      groupsData.set(this, { cleanup, refs: new Set() });
    }

    makeRef(target, holdings = undefined) {
      const groupData = groupsData.get(this);
      if (!groupData)
        throw new TypeError("Can't make a WeakRef for a group that's been shut down");

      const refs = groupData.refs;
      const ref = new WeakRef(target);
      refs.add(ref);
      holdingsMap.set(ref, holdings);
      return ref;
    }

    purgeSome(cleanupNow) {
      const groupData = groupsData.get(this);
      if (!groupData)
        throw new TypeError("Can't purge references for a group that's been shut down");

      purgeGroup(cleanupNow, groupData.refs);
    }

    shutdown() {
      const groupData = groupsData.get(this);
      if (!groupData)
        throw new TypeError("Group has already been shut down");

      // TODO: should shutting down a group remove the reference to the cleanup function?
      groupsData.delete(this);
    }
  }

  const groupsData = new WeakMap();
  const holdingsMap = new WeakMap();
  const strongRefs = new Set();

  const WeakRef = class {
    constructor(target) {
      this.weakmap = new WeakMap();
      this.weakmap.set(target, null);
    }

    get holdings() {
      return holdingsMap.get(this);
    }

    deref() {
      if (!this.weakmap)
        return undefined;
      const keys = nondeterministicGetWeakMapKeys(this.weakmap);
      if (keys.length === 0)
        return undefined;
      let target = keys[0];
      if (target)
        strongRefs.add(target);
      return target;
    }

    drop() {
      this.weakmap = undefined;
    }
  }

  function* iterateClearedRefs(refs) {
    for (let ref of refs) {
      if (ref.weakmap && nondeterministicGetWeakMapKeys(ref.weakmap).length === 0) {
        yield ref;
      }
    }
  }

  delete WeakRef.prototype.constructor;

  function purgeGroup(cleanup, refs) {
    for (ref of iterateClearedRefs(refs)) {
      cleanup(ref);
      // TODO: unclear from the slides if the ref should be removed.
      refs.delete(ref);
    }
  }

  function pretendNewTurn(runCleanup) {
    strongRefs.clear();

    if (!runCleanup)
      return;

    const groups = nondeterministicGetWeakMapKeys(groupsData);
    for (let group of groups) {
      let { cleanup, refs } = groupsData.get(group);
      purgeGroup(cleanup, refs);
    }
  }
}
