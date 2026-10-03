/**
 * Performance profiling utilities for Phase P2
 * Only active in development/test environments
 */

const IS_DEV = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

export interface PerfMeasurement {
  label: string;
  durationMs: number;
  timestamp: number;
}

class PerformanceProfiler {
  private measurements: Map<string, number> = new Map();
  private completed: PerfMeasurement[] = [];

  /**
   * Start timing a labeled operation
   */
  start(label: string): void {
    if (!IS_DEV) return;
    this.measurements.set(label, performance.now());
  }

  /**
   * End timing and record the measurement
   */
  end(label: string): number | null {
    if (!IS_DEV) return null;
    
    const startTime = this.measurements.get(label);
    if (startTime === undefined) {
      console.warn(`[PERF] No start time found for: ${label}`);
      return null;
    }

    const endTime = performance.now();
    const durationMs = endTime - startTime;

    this.completed.push({
      label,
      durationMs,
      timestamp: Date.now(),
    });

    this.measurements.delete(label);
    return durationMs;
  }

  /**
   * Measure an async function and return its result
   */
  async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    if (!IS_DEV) return fn();

    this.start(label);
    try {
      const result = await fn();
      const duration = this.end(label);
      if (duration !== null) {
        console.log(`[PERF] ${label}: ${duration.toFixed(2)}ms`);
      }
      return result;
    } catch (error) {
      this.end(label);
      throw error;
    }
  }

  /**
   * Get all completed measurements
   */
  getResults(): PerfMeasurement[] {
    return [...this.completed];
  }

  /**
   * Clear all measurements
   */
  reset(): void {
    this.measurements.clear();
    this.completed = [];
  }

  /**
   * Log summary of measurements
   */
  logSummary(prefix = ''): void {
    if (!IS_DEV || this.completed.length === 0) return;

    console.log(`\n[PERF SUMMARY]${prefix ? ' ' + prefix : ''}`);
    console.log('─'.repeat(60));
    
    const sorted = [...this.completed].sort((a, b) => b.durationMs - a.durationMs);
    
    for (const m of sorted) {
      console.log(`  ${m.label.padEnd(40)} ${m.durationMs.toFixed(2).padStart(10)}ms`);
    }
    
    const total = this.completed.reduce((sum, m) => sum + m.durationMs, 0);
    console.log('─'.repeat(60));
    console.log(`  ${'TOTAL'.padEnd(40)} ${total.toFixed(2).padStart(10)}ms`);
    console.log('');
  }
}

// Export singleton instance
export const perf = new PerformanceProfiler();

/**
 * Utility to measure async functions inline
 */
export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  return perf.measure(label, fn);
}

/**
 * Utility to measure sync functions inline
 */
export function measureSync<T>(label: string, fn: () => T): T {
  if (!IS_DEV) return fn();

  perf.start(label);
  try {
    const result = fn();
    const duration = perf.end(label);
    if (duration !== null) {
      console.log(`[PERF] ${label}: ${duration.toFixed(2)}ms`);
    }
    return result;
  } catch (error) {
    perf.end(label);
    throw error;
  }
}
