export class AdvancedObjectPoolManager {
  constructor() {
    this.pools = new Map();
    this.poolStats = new Map();
  }

  createPool(name, factory, reset, options = {}) {
    const pool = {
      objects: [],
      factory,
      reset,
      maxSize: options.maxSize || 100,
      created: 0,
      acquired: 0,
      released: 0,
    };

    // Pre-populate pool
    const initialSize = options.initialSize || 10;
    for (let i = 0; i < initialSize; i++) {
      pool.objects.push(factory());
      pool.created++;
    }

    this.pools.set(name, pool);
    this.poolStats.set(name, {
      hitRate: 0,
      memoryEfficiency: 0,
      gcReduction: 0,
    });

    return {
      acquire: () => this.acquireObject(name),
      release: (obj) => this.releaseObject(name, obj),
      stats: () => this.getPoolStats(name),
    };
  }

  acquireObject(poolName) {
    const pool = this.pools.get(poolName);
    if (!pool) throw new Error(`Pool ${poolName} not found`);

    pool.acquired++;

    if (pool.objects.length > 0) {
      // Reuse existing object
      return pool.objects.pop();
    } else {
      // Create new object
      pool.created++;
      return pool.factory();
    }
  }

  releaseObject(poolName, obj) {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    pool.released++;

    // Reset object state
    if (pool.reset) {
      pool.reset(obj);
    }

    // Return to pool if not at capacity
    if (pool.objects.length < pool.maxSize) {
      pool.objects.push(obj);
    }

    // Update statistics
    this.updatePoolStats(poolName);
  }

  updatePoolStats(poolName) {
    const pool = this.pools.get(poolName);
    const stats = this.poolStats.get(poolName);

    // Calculate hit rate (reuse efficiency)
    stats.hitRate = (pool.released / pool.acquired) * 100;

    // Calculate memory efficiency
    stats.memoryEfficiency = (pool.objects.length / pool.created) * 100;

    // Estimate GC reduction
    stats.gcReduction = ((pool.released - pool.created) / pool.released) * 100;
  }

  getSystemStats() {
    const totalPools = this.pools.size;
    let totalObjects = 0;
    let totalReuse = 0;

    for (const [name, pool] of this.pools) {
      totalObjects += pool.created;
      totalReuse += pool.released;
    }

    return {
      totalPools,
      totalObjects,
      totalReuse,
      overallEfficiency: (totalReuse / totalObjects) * 100,
      pools: Array.from(this.poolStats.entries()).map(([name, stats]) => ({
        name,
        ...stats,
      })),
    };
  }
}
