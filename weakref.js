var WeakFactory;
var pretendNewTurn;

{
  WeakFactory = class WeakFactory {
    constructor(cleanup = undefined) {
      factoriesData.set(this, { cleanup, cells: new Set() });
    }

    makeCell(target, holdings = undefined) {
      return makeCellOrRef(this, target, holdings, WeakCell);
    }

    makeRef(target, holdings = undefined) {
      return makeCellOrRef(this, target, holdings, WeakRef);
    }

    cleanupSome(cleanupNow) {
      const factoryData = factoriesData.get(this);
      if (!factoryData)
        throw new TypeError("Factory has been shut down");

      cleanupFactory(cleanupNow, factoryData.cells);
    }

    shutdown() {
      const factoryData = factoriesData.get(this);
      if (!factoryData)
        throw new TypeError("Factory has been shut down");

      // TODO: should shutting down a factory remove the reference to the cleanup function?
      factoriesData.delete(this);
    }
  }

  function makeCellOrRef(factory, target, holdings, ctor) {
    const factoryData = factoriesData.get(factory);
    if (!factoryData)
      throw new TypeError("Factory has been shut down");

    const cells = factoryData.cells;
    const cell = new ctor(target, weakCellCtorGuard);
    cells.add(cell);
    holdingsMap.set(cell, holdings);
    return cell;
  }

  const factoriesData = new WeakMap();
  const holdingsMap = new WeakMap();
  const cellsMap = new WeakMap();
  const refsBrandingCheck = new WeakSet();
  const strongRefs = new Set();

  const weakCellCtorGuard = {};

  const WeakCell = class {
    constructor(target, guard = undefined) {
      if (guard !== weakCellCtorGuard)
        throw new TypeError("WeakCells and WeakRefs can only be created using WeakFactory");

      // Need to use a WeakMap instead of a WeakSet because the SpiderMonkey
      // shell doesn't have a way to get a WeakSet's keys.
      const weakmap = new WeakMap();
      cellsMap.set(this, weakmap);
      weakmap.set(target, null);
    }

    get holdings() {
      return holdingsMap.get(this);
    }

    drop() {
      // TODO: should this also drop the reference to holdings?
      cellsMap.delete(this);
    }
  }

  const WeakRef = class extends WeakCell {
    constructor(target, guard = undefined) {
      super(target, guard);
      refsBrandingCheck.add(this);
    }
    deref() {
      if (!refsBrandingCheck.has(this))
        throw new TypeError("WeakRef.prototype.deref must only be called on WeakRef instances");

      const weakmap = cellsMap.get(this);
      if (!weakmap)
        return undefined;
      const keys = nondeterministicGetWeakMapKeys(weakmap);
      if (keys.length === 0)
        return undefined;
      let target = keys[0];
      if (target)
        strongRefs.add(target);
      return target;
    }
  }
  
    delete WeakCell.prototype.constructor;
    delete WeakRef.prototype.constructor;

  function* iterateClearedRefs(cells) {
    for (let cell of cells) {
      const weakmap = cellsMap.get(cell);
      if (weakmap && nondeterministicGetWeakMapKeys(weakmap).length === 0) {
        yield cell;
      }
    }
  }

  function cleanupFactory(cleanup, cells) {
    for (let cell of iterateClearedRefs(cells)) {
      cleanup(cell);
      // TODO: unclear from the slides if the cell should be removed.
      cells.delete(cell);
    }
  }

  function pretendNewTurn(runCleanup) {
    strongRefs.clear();

    if (!runCleanup)
      return;

    const factories = nondeterministicGetWeakMapKeys(factoriesData);
    for (let factory of factories) {
      let { cleanup, cells } = factoriesData.get(factory);
      cleanupFactory(cleanup, cells);
    }
  }
}
