/**
 * Performance profiler for deck.gl-raster operations
 */

export interface ProfileEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  children: ProfileEntry[];
  metadata?: Record<string, any>;
}

export class Profiler {
  private static instance: Profiler;
  private stack: ProfileEntry[] = [];
  private completed: ProfileEntry[] = [];
  private enabled = true;

  static getInstance(): Profiler {
    if (!Profiler.instance) {
      Profiler.instance = new Profiler();
    }
    return Profiler.instance;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  start(name: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    const entry: ProfileEntry = {
      name,
      startTime: performance.now(),
      children: [],
      metadata,
    };

    if (this.stack.length > 0) {
      const parent = this.stack[this.stack.length - 1];
      parent.children.push(entry);
    }

    this.stack.push(entry);
  }

  end(name: string): number {
    if (!this.enabled) return 0;

    const entry = this.stack.pop();
    if (!entry || entry.name !== name) {
      console.warn(`Profiler: mismatched end for "${name}"`);
      return 0;
    }

    entry.endTime = performance.now();
    entry.duration = entry.endTime - entry.startTime;

    if (this.stack.length === 0) {
      this.completed.push(entry);
    }

    return entry.duration;
  }

  async measure<T>(name: string, fn: () => T | Promise<T>, metadata?: Record<string, any>): Promise<T> {
    this.start(name, metadata);
    try {
      const result = await fn();
      return result;
    } finally {
      this.end(name);
    }
  }

  getResults(): ProfileEntry[] {
    return this.completed;
  }

  clear(): void {
    this.stack = [];
    this.completed = [];
  }

  getSummary(): {
    totalTime: number;
    operationCounts: Record<string, number>;
    operationTimes: Record<string, number>;
    slowestOperations: Array<{ name: string; duration: number; metadata?: Record<string, any> }>;
  } {
    const operationCounts: Record<string, number> = {};
    const operationTimes: Record<string, number> = {};
    const allOperations: Array<{ name: string; duration: number; metadata?: Record<string, any> }> = [];

    const traverse = (entry: ProfileEntry) => {
      if (entry.duration !== undefined) {
        operationCounts[entry.name] = (operationCounts[entry.name] || 0) + 1;
        operationTimes[entry.name] = (operationTimes[entry.name] || 0) + entry.duration;
        allOperations.push({
          name: entry.name,
          duration: entry.duration,
          metadata: entry.metadata,
        });
      }
      entry.children.forEach(traverse);
    };

    this.completed.forEach(traverse);

    const slowestOperations = allOperations
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 20);

    const totalTime = this.completed.reduce((sum, e) => sum + (e.duration || 0), 0);

    return {
      totalTime,
      operationCounts,
      operationTimes,
      slowestOperations,
    };
  }

  printSummary(): void {
    const summary = this.getSummary();

    console.group("🔍 Performance Profile Summary");
    console.log(`Total Time: ${summary.totalTime.toFixed(2)}ms`);
    console.log("");

    console.group("📊 Operation Times (Total)");
    Object.entries(summary.operationTimes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, time]) => {
        const count = summary.operationCounts[name];
        const avg = time / count;
        console.log(
          `${name}: ${time.toFixed(2)}ms (${count}x, avg: ${avg.toFixed(2)}ms)`
        );
      });
    console.groupEnd();

    console.log("");
    console.group("🐌 Slowest Individual Operations");
    summary.slowestOperations.forEach((op, i) => {
      const metaStr = op.metadata ? ` | ${JSON.stringify(op.metadata)}` : "";
      console.log(`${i + 1}. ${op.name}: ${op.duration.toFixed(2)}ms${metaStr}`);
    });
    console.groupEnd();

    console.groupEnd();
  }

  exportToJSON(): string {
    return JSON.stringify({
      completed: this.completed,
      summary: this.getSummary(),
      timestamp: Date.now(),
    }, null, 2);
  }
}

// Create global instance
export const profiler = Profiler.getInstance();

// Monkey-patch fetch to track network requests
if (typeof window !== "undefined") {
  const originalFetch = window.fetch;
  window.fetch = async function (...args): Promise<Response> {
    const url = typeof args[0] === "string" ? args[0] : args[0].url;
    profiler.start(`fetch: ${url}`, { url });
    try {
      const response = await originalFetch.apply(this, args);
      return response;
    } finally {
      profiler.end(`fetch: ${url}`);
    }
  };
}
