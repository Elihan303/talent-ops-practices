// Sistema de procesamiento asíncrono optimizado
const EventEmitter = require("events");
const { performance } = require("perf_hooks");
const { loadTasks, saveTasks } = require("./taskStorage");

class ConcurrencyManager {
  constructor(maxConcurrent, queueLimit) {
    this.maxConcurrent = maxConcurrent;
    this.queueLimit = queueLimit;
    this.activeCount = 0;
    this.queue = [];
  }

  async execute(fn, priority = 0) {
    if (this.activeCount >= this.maxConcurrent) {
      if (this.queue.length >= this.queueLimit) {
        throw new Error("Task queue limit reached");
      }
      return new Promise((resolve, reject) => {
        this.queue.push({ fn, priority, resolve, reject });
        this.queue.sort((a, b) => b.priority - a.priority);
      });
    }
    return this._run(fn);
  }

  async _run(fn) {
    this.activeCount++;
    try {
      const result = await fn();
      return result;
    } finally {
      this.activeCount--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        this._run(next.fn).then(next.resolve).catch(next.reject);
      }
    }
  }

  getMetrics() {
    return {
      activeCount: this.activeCount,
      queueLength: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      queueLimit: this.queueLimit,
    };
  }
}

// --- Implementación básica de CircuitBreaker ---
class CircuitBreaker {
  constructor(failureThreshold = 5, recoveryTime = 5000) {
    this.failureThreshold = failureThreshold;
    this.recoveryTime = recoveryTime;
    this.failures = 0;
    this.state = "CLOSED";
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === "OPEN") {
      if (Date.now() > this.nextAttempt) {
        this.state = "HALF_OPEN";
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }
    try {
      const result = await fn();
      this._reset();
      return result;
    } catch (err) {
      this._fail();
      throw err;
    }
  }

  _reset() {
    this.failures = 0;
    this.state = "CLOSED";
  }

  _fail() {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = "OPEN";
      this.nextAttempt = Date.now() + this.recoveryTime;
    }
  }
}

class AsyncProcessingSystem extends EventEmitter {
  constructor(options = {}) {
    super();
    this.concurrencyManager = new ConcurrencyManager(
      options.maxConcurrent || 10,
      options.queueLimit || 1000
    );
    this.circuitBreaker = new CircuitBreaker();
    this.isProcessing = false;
    this.metrics = {
      totalProcessed: 0,
      totalErrors: 0,
      avgLatency: 0,
      startTime: Date.now(),
    };
    this.pendingTasks = loadTasks();
    this.recoverTasks();
  }

  async processTask(taskData, priority = 0, isRecovered = false) {
    const taskId = `task_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const task = { taskId, taskData, priority };
    if (!isRecovered) {
      //   console.log("Agregando tarea a pendingTasks:", task);
      this.pendingTasks.push(task);
      saveTasks(this.pendingTasks);
    }

    this.emit("taskQueued", { taskId, taskData, priority });

    try {
      const result = await this.concurrencyManager.execute(
        () => this.executeTask(taskId, taskData),
        priority
      );

      this.pendingTasks = this.pendingTasks.filter((t) => t.taskId !== taskId);
      saveTasks(this.pendingTasks);

      this.emit("taskCompleted", { taskId, result });
      return result;
    } catch (error) {
      this.emit("taskFailed", { taskId, error: error.message });
      throw error;
    }
  }
  recoverTasks() {
    if (this.pendingTasks.length > 0) {
      console.log(`Recovering ${this.pendingTasks.length} tasks...`);
    }
    for (const task of this.pendingTasks) {
      this.processTask(task.taskData, task.priority, true).catch((err) => {
        console.error(
          `Recovery failed for task ${task.taskId}: ${err.message}`
        );
      });
    }
  }

  async executeTask(taskId, taskData) {
    const startTime = performance.now();

    try {
      // Simulate external API call con circuit breaker
      const result = await this.circuitBreaker.execute(async () => {
        // Simulate variable processing time
        const processingTime = Math.random() * 1000 + 500;
        await new Promise((resolve) => setTimeout(resolve, processingTime));

        // Simulate occasional failures
        if (Math.random() < 0.1) {
          throw new Error("External service error");
        }

        return {
          taskId,
          processedData: `Processed: ${JSON.stringify(taskData)}`,
          timestamp: new Date().toISOString(),
        };
      });

      const latency = performance.now() - startTime;
      this.updateMetrics(latency, true);

      return result;
    } catch (error) {
      const latency = performance.now() - startTime;
      this.updateMetrics(latency, false);
      throw error;
    }
  }

  updateMetrics(latency, success) {
    if (success) {
      this.metrics.totalProcessed++;
    } else {
      this.metrics.totalErrors++;
    }

    // Exponential moving average
    const alpha = 0.1;
    this.metrics.avgLatency =
      alpha * latency + (1 - alpha) * this.metrics.avgLatency;
  }

  getSystemMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    const concurrencyMetrics = this.concurrencyManager.getMetrics();

    return {
      uptime,
      throughput: this.metrics.totalProcessed / (uptime / 1000),
      errorRate:
        this.metrics.totalErrors /
        (this.metrics.totalProcessed + this.metrics.totalErrors),
      avgLatency: this.metrics.avgLatency,
      concurrency: concurrencyMetrics,
      circuitBreakerState: this.circuitBreaker.state,
    };
  }

  startMetricsReporting(interval = 5000) {
    setInterval(() => {
      const metrics = this.getSystemMetrics();
      this.emit("metricsReport", metrics);
      console.log("System Metrics:", JSON.stringify(metrics, null, 2));
    }, interval);
  }
}

// Demonstration del sistema
async function demonstrateAsyncProcessing() {
  const processor = new AsyncProcessingSystem({
    maxConcurrent: 5,
    queueLimit: 100,
  });

  // Event listeners
  processor.on("taskQueued", ({ taskId, priority }) => {
    console.log(`Task queued: ${taskId} (priority: ${priority})`);
  });

  processor.on("taskCompleted", ({ taskId }) => {
    console.log(`Task completed: ${taskId}`);
  });

  processor.on("taskFailed", ({ taskId, error }) => {
    console.log(`Task failed: ${taskId} - ${error}`);
  });

  // Start metrics reporting
  processor.startMetricsReporting(3000);

  // Process multiple tasks con different priorities
  const tasks = [];
  for (let i = 0; i < 20; i++) {
    const priority = Math.floor(Math.random() * 3);
    const taskData = { id: i, data: `Task data ${i}` };

    tasks.push(
      processor
        .processTask(taskData, priority)
        .catch((error) => console.error(`Task ${i} failed:`, error.message))
    );

    // Add some delay to simulate real-world task arrival
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Wait for all tasks to complete
  await Promise.allSettled(tasks);

  console.log("Final metrics:", processor.getSystemMetrics());
}

demonstrateAsyncProcessing();
