import { AdvancedObjectPoolManager } from "./AdvancedObjectPoolManager";

import "./tracing";
import { trace } from "@opentelemetry/api";
const { performance, PerformanceObserver } = require("perf_hooks");
const EventEmitter = require("events");

class EnterprisePerformanceSystem extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {
      monitoringInterval: options.monitoringInterval || 5000,
      alertThresholds: {
        eventLoopLag: options.eventLoopLag || 50,
        memoryGrowth: options.memoryGrowth || 10, // MB/min
        gcDuration: options.gcDuration || 100,
      },
      ...options,
    };

    this.metrics = {
      performance: [],
      memory: [],
      gc: [],
      alerts: [],
    };

    this.objectPoolManager = new AdvancedObjectPoolManager();
    this.setupMonitoring();
  }

  setupMonitoring() {
    // Performance monitoring
    this.setupPerformanceObserver();

    // Memory monitoring
    this.setupMemoryMonitoring();

    // Event loop monitoring
    this.setupEventLoopMonitoring();

    // Automated optimization
    this.setupAutomatedOptimization();
  }

  setupPerformanceObserver() {
    const tracer = trace.getTracer("performance-system");
    const observer = new PerformanceObserver((list) => {
      const span = tracer.startSpan("processPerformanceEntries");
      for (const entry of list.getEntries()) {
        this.processPerformanceEntry(entry);
      }
      span.end();
    });

    observer.observe({ entryTypes: ["measure", "function", "gc"] });
  }

  processPerformanceEntry(entry) {
    const metric = {
      timestamp: Date.now(),
      name: entry.name,
      type: entry.entryType,
      duration: entry.duration,
      startTime: entry.startTime,
    };

    this.metrics.performance.push(metric);

    // Performance analysis
    if (entry.entryType === "gc") {
      this.analyzeGCPerformance(entry);
    } else if (entry.duration > 100) {
      this.analyzeSlowOperation(entry);
    }

    this.emit("performanceMetric", metric);
  }

  analyzeGCPerformance(gcEntry) {
    if (gcEntry.duration > this.config.alertThresholds.gcDuration) {
      this.createAlert(
        "gc",
        "warning",
        `Long GC pause: ${gcEntry.kind} took ${gcEntry.duration.toFixed(2)}ms`
      );

      // Trigger optimization
      this.optimizeMemoryUsage();
    }
  }

  analyzeSlowOperation(entry) {
    this.createAlert(
      "performance",
      "warning",
      `Slow operation: ${entry.name} took ${entry.duration.toFixed(2)}ms`
    );
  }

  setupMemoryMonitoring() {
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const memoryMetric = {
        timestamp: Date.now(),
        ...memoryUsage,
      };

      this.metrics.memory.push(memoryMetric);

      // Analyze memory trends
      this.analyzeMemoryTrends();

      this.emit("memoryMetric", memoryMetric);
    }, this.config.monitoringInterval);
  }

  analyzeMemoryTrends() {
    if (this.metrics.memory.length < 5) return;

    const recent = this.metrics.memory.slice(-5);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];

    const timeSpan = newest.timestamp - oldest.timestamp;
    const heapGrowth = newest.heapUsed - oldest.heapUsed;
    const growthRate = (heapGrowth / timeSpan) * 60000; // MB/min

    if (growthRate > this.config.alertThresholds.memoryGrowth * 1024 * 1024) {
      this.createAlert(
        "memory",
        "critical",
        `High memory growth rate: ${(growthRate / 1024 / 1024).toFixed(
          2
        )}MB/min`
      );

      this.optimizeMemoryUsage();
    }
  }

  setupEventLoopMonitoring() {
    const monitorEventLoop = () => {
      const start = process.hrtime.bigint();

      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000;

        if (lag > this.config.alertThresholds.eventLoopLag) {
          this.createAlert(
            "eventLoop",
            "warning",
            `High event loop lag: ${lag.toFixed(2)}ms`
          );
        }

        this.emit("eventLoopLag", { timestamp: Date.now(), lag });

        setTimeout(monitorEventLoop, 1000);
      });
    };

    monitorEventLoop();
  }

  setupAutomatedOptimization() {
    // Automated optimization triggers
    this.on("performanceMetric", (metric) => {
      if (metric.type === "gc" && metric.duration > 200) {
        this.triggerGCOptimization();
      }
    });

    this.on("memoryMetric", (metric) => {
      if (metric.heapUsed > 1024 * 1024 * 1024) {
        // 1GB
        this.triggerMemoryOptimization();
      }
    });
  }

  createAlert(category, severity, message) {
    const alert = {
      id: Date.now() + Math.random(),
      category,
      severity,
      message,
      timestamp: new Date().toISOString(),
    };

    this.metrics.alerts.push(alert);
    this.emit("alert", alert);

    console.log(`[${severity.toUpperCase()}] ${category}: ${message}`);
  }

  triggerGCOptimization() {
    console.log("Triggering GC optimization...");

    // Clear object pools
    this.objectPoolManager.clearAllPools();

    // Manual GC if available
    if (global.gc) {
      global.gc();
    }
  }

  triggerMemoryOptimization() {
    console.log("Triggering memory optimization...");

    // Optimize object pools
    this.objectPoolManager.optimizeAllPools();

    // Clear caches
    this.clearInternalCaches();
  }

  clearInternalCaches() {
    // Clear performance metrics cache
    if (this.metrics.performance.length > 1000) {
      this.metrics.performance = this.metrics.performance.slice(-500);
    }

    // Clear memory metrics cache
    if (this.metrics.memory.length > 1000) {
      this.metrics.memory = this.metrics.memory.slice(-500);
    }
  }

  generatePerformanceReport() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Filter recent metrics
    const recentPerformance = this.metrics.performance.filter(
      (m) => m.timestamp > oneHourAgo
    );
    const recentMemory = this.metrics.memory.filter(
      (m) => m.timestamp > oneHourAgo
    );
    const recentAlerts = this.metrics.alerts.filter(
      (a) => new Date(a.timestamp).getTime() > oneHourAgo
    );

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalMetrics: recentPerformance.length,
        memorySnapshots: recentMemory.length,
        alerts: recentAlerts.length,
        uptime: process.uptime(),
      },
      performance: {
        avgDuration:
          recentPerformance.length > 0
            ? recentPerformance.reduce((sum, m) => sum + m.duration, 0) /
              recentPerformance.length
            : 0,
        slowOperations: recentPerformance.filter((m) => m.duration > 100)
          .length,
      },
      memory: {
        current: process.memoryUsage(),
        trend: this.calculateMemoryTrend(recentMemory),
      },
      objectPools: this.objectPoolManager.getSystemStats(),
      recommendations: this.generateOptimizationRecommendations(),
    };
  }

  calculateMemoryTrend(memoryMetrics) {
    if (memoryMetrics.length < 2) return "insufficient_data";

    const first = memoryMetrics[0];
    const last = memoryMetrics[memoryMetrics.length - 1];
    const growth = last.heapUsed - first.heapUsed;

    return growth > 0 ? "increasing" : "stable";
  }

  generateOptimizationRecommendations() {
    const recommendations = [];
    const latestMemory = this.metrics.memory[this.metrics.memory.length - 1];

    if (latestMemory && latestMemory.heapUsed > 500 * 1024 * 1024) {
      recommendations.push(
        "Consider implementing object pooling for frequently created objects"
      );
    }

    const recentAlerts = this.metrics.alerts.filter(
      (a) => new Date(a.timestamp).getTime() > Date.now() - 3600000
    );

    if (recentAlerts.filter((a) => a.category === "gc").length > 5) {
      recommendations.push(
        "High GC frequency detected - optimize memory allocation patterns"
      );
    }

    return recommendations;
  }
}

// Demonstration del sistema
async function demonstratePerformanceSystem() {
  const perfSystem = new EnterprisePerformanceSystem({
    monitoringInterval: 2000,
    alertThresholds: {
      eventLoopLag: 30,
      memoryGrowth: 5,
      gcDuration: 50,
    },
  });

  // Event listeners
  perfSystem.on("alert", (alert) => {
    console.log("Performance Alert:", alert);
  });

  perfSystem.on("performanceMetric", (metric) => {
    if (metric.duration > 50) {
      console.log("Performance metric:", metric);
    }
  });

  // Create object pool for demonstration
  const bufferPool = perfSystem.objectPoolManager.createPool(
    "buffers",
    () => Buffer.alloc(1024),
    (buffer) => buffer.fill(0),
    { initialSize: 20, maxSize: 100 }
  );

  // Simulate workload
  const simulateWorkload = () => {
    // Acquire and release buffers
    const buffer = bufferPool.acquire();
    buffer.write("test data");

    setTimeout(() => {
      bufferPool.release(buffer);
    }, Math.random() * 1000);

    // Simulate CPU-intensive work
    const start = performance.now();
    let result = 0;
    for (let i = 0; i < 100000; i++) {
      result += Math.sqrt(i);
    }
    const end = performance.now();

    performance.mark("workload-start");
    performance.mark("workload-end");
    performance.measure("workload-duration", "workload-start", "workload-end");
  };

  // Run workload simulation
  const workloadInterval = setInterval(simulateWorkload, 500);

  // Generate reports
  setInterval(() => {
    const report = perfSystem.generatePerformanceReport();
    console.log("Performance Report:", JSON.stringify(report, null, 2));
  }, 10000);

  // Cleanup after demonstration
  setTimeout(() => {
    clearInterval(workloadInterval);
    console.log("Performance system demonstration completed");
  }, 30000);
}

demonstratePerformanceSystem();
