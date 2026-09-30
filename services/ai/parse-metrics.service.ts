/**
 * Parse Metrics Service
 * 
 * Provides comprehensive observability infrastructure for the hybrid parser system.
 * Collects and logs detailed metrics about parse operations to enable monitoring,
 * optimization validation, and data-driven decision making.
 * 
 * **Key Metrics Tracked:**
 * - Parse method distribution (PATTERN vs AI_FALLBACK vs SPECIALIZED)
 * - Processing time per method (latency optimization validation)
 * - Pattern success/failure rates (optimization effectiveness)
 * - Intent type distribution (usage patterns)
 * - Failure reason analysis (opportunities for pattern expansion)
 * 
 * **Use Cases:**
 * 1. **Performance Monitoring**: Track latency improvements from pattern matching
 * 2. **Cost Analysis**: Calculate AI API call reduction and cost savings
 * 3. **Pattern Effectiveness**: Measure pattern success rate (target: 80%+)
 * 4. **Failure Analysis**: Identify common AI fallback reasons for pattern expansion
 * 5. **Usage Analytics**: Understand user behavior and command patterns
 * 
 * **Integration Points:**
 * - Called by {@link HybridParserService} after each parse operation
 * - Called by {@link WhatsAppMessageService} for specialized service tracking
 * - Logs to console (development) and observability backend (production)
 * 
 * **Future Enhancements:**
 * - Integration with DataDog, NewRelic, or CloudWatch
 * - Real-time dashboards for parse metrics
 * - Alerting on pattern success rate degradation
 * - Historical trend analysis
 * 
 * @module parse-metrics.service
 * @see {@link HybridParserService} for metric collection logic
 */

/**
 * Represents a single parse event for observability tracking
 */
export interface ParseEvent {
  /** Event timestamp */
  timestamp: Date;
  
  /** User ID who sent the message */
  userId: string;
  
  /** User's WhatsApp phone number (normalized format) */
  phoneNumber: string;
  
  /** Length of the message text in characters */
  messageLength: number;
  
  /** Parse method used to process the message */
  parseMethod: 'PATTERN' | 'AI_FALLBACK' | 'SPECIALIZED';
  
  /** Intent type extracted from message (EXPENSE, INCOME, BUDGET_ALLOCATION, etc.) */
  intentType?: string;
  
  /** Processing time in milliseconds */
  processingTimeMs: number;
  
  /** Whether pattern parsing was attempted */
  patternAttempted: boolean;
  
  /** Whether pattern parsing succeeded (only relevant if patternAttempted is true) */
  patternSuccess: boolean;
  
  /** Reason for pattern parse failure (if applicable) */
  patternFailureReason?: 'NO_MATCH' | 'AMBIGUOUS' | 'MULTI_ACTION' | 'COMPLEX_DATE' | 'INVALID_FORMAT';
}

/**
 * Aggregated metrics for dashboard visualization
 */
export interface ParseMetricsAggregate {
  /** Total messages processed in the period */
  totalMessages: number;
  
  /** Pattern match success rate (0.0 to 1.0) */
  patternSuccessRate: number;
  
  /** AI fallback rate (0.0 to 1.0) */
  aiFallbackRate: number;
  
  /** Average processing time for pattern-parsed messages (ms) */
  avgProcessingTimePattern: number;
  
  /** Average processing time for AI-parsed messages (ms) */
  avgProcessingTimeAI: number;
  
  /** Distribution of intent types */
  intentDistribution: {
    [intentType: string]: number;
  };
  
  /** Distribution of pattern failure reasons */
  failureReasonDistribution?: {
    [reason: string]: number;
  };
}

/**
 * Service for collecting and aggregating parse metrics
 */
export class ParseMetricsService {
  /**
   * Log a parse event to console and observability backend
   * 
   * @param event - Parse event to log
   * 
   * @example
   * ```typescript
   * ParseMetricsService.logParseEvent({
   *   timestamp: new Date(),
   *   userId: 'user-123',
   *   phoneNumber: '+6281234567890',
   *   messageLength: 20,
   *   parseMethod: 'PATTERN',
   *   intentType: 'EXPENSE',
   *   processingTimeMs: 25,
   *   patternAttempted: true,
   *   patternSuccess: true,
   * });
   * ```
   */
  static logParseEvent(event: ParseEvent): void {
    // Log to console for development
    console.log('[ParseMetrics]', JSON.stringify({
      timestamp: event.timestamp.toISOString(),
      userId: event.userId,
      phoneNumber: event.phoneNumber,
      messageLength: event.messageLength,
      parseMethod: event.parseMethod,
      intentType: event.intentType || 'N/A',
      processingTimeMs: event.processingTimeMs,
      patternAttempted: event.patternAttempted,
      patternSuccess: event.patternSuccess,
      patternFailureReason: event.patternFailureReason || 'N/A',
    }));
    
    // TODO: Send to observability backend (DataDog, NewRelic, CloudWatch, etc.)
    // Example implementations:
    //
    // DataDog:
    // metrics.increment('parse.events', 1, {
    //   parse_method: event.parseMethod,
    //   intent_type: event.intentType || 'unknown',
    // });
    // metrics.histogram('parse.processing_time_ms', event.processingTimeMs, {
    //   parse_method: event.parseMethod,
    // });
    //
    // NewRelic:
    // newrelic.recordMetric('Parse/Events', 1);
    // newrelic.recordMetric('Parse/ProcessingTime', event.processingTimeMs);
    //
    // CloudWatch:
    // await cloudwatch.putMetricData({
    //   Namespace: 'FinTrack/Parsing',
    //   MetricData: [{
    //     MetricName: 'ProcessingTime',
    //     Value: event.processingTimeMs,
    //     Unit: 'Milliseconds',
    //     Dimensions: [
    //       { Name: 'ParseMethod', Value: event.parseMethod },
    //       { Name: 'IntentType', Value: event.intentType || 'unknown' },
    //     ],
    //   }],
    // });
  }
  
  /**
   * Get aggregated metrics for dashboard queries
   * 
   * This is a placeholder for future observability integration.
   * In production, this would query your observability backend
   * (DataDog, NewRelic, CloudWatch, etc.) for aggregated metrics.
   * 
   * @param startDate - Start of the time range
   * @param endDate - End of the time range
   * @returns Aggregated metrics for the specified time range
   * 
   * @example
   * ```typescript
   * // Get last 30 days of metrics
   * const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
   * const metrics = await ParseMetricsService.getAggregatedMetrics(
   *   thirtyDaysAgo,
   *   new Date()
   * );
   * 
   * console.log(`Pattern success rate: ${metrics.patternSuccessRate * 100}%`);
   * console.log(`Average pattern processing time: ${metrics.avgProcessingTimePattern}ms`);
   * console.log(`Average AI processing time: ${metrics.avgProcessingTimeAI}ms`);
   * ```
   */
  static async getAggregatedMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<ParseMetricsAggregate> {
    // TODO: Query from observability backend
    // This is a placeholder implementation that returns mock data
    // 
    // Example implementation for a SQL-based observability store:
    //
    // const result = await db.query(`
    //   SELECT 
    //     COUNT(*) as total_messages,
    //     COUNT(*) FILTER (WHERE parse_method = 'PATTERN') as pattern_success,
    //     COUNT(*) FILTER (WHERE pattern_attempted AND parse_method = 'AI_FALLBACK') as pattern_failed,
    //     AVG(processing_time_ms) FILTER (WHERE parse_method = 'PATTERN') as avg_time_pattern,
    //     AVG(processing_time_ms) FILTER (WHERE parse_method = 'AI_FALLBACK') as avg_time_ai,
    //     intent_type,
    //     COUNT(*) as intent_count
    //   FROM parse_events
    //   WHERE timestamp >= $1 AND timestamp <= $2
    //   GROUP BY intent_type
    // `, [startDate, endDate]);
    //
    // return {
    //   totalMessages: result.total_messages,
    //   patternSuccessRate: result.pattern_success / result.total_messages,
    //   aiFallbackRate: result.pattern_failed / result.total_messages,
    //   avgProcessingTimePattern: result.avg_time_pattern,
    //   avgProcessingTimeAI: result.avg_time_ai,
    //   intentDistribution: result.rows.reduce((acc, row) => ({
    //     ...acc,
    //     [row.intent_type]: row.intent_count,
    //   }), {}),
    // };
    
    console.warn('[ParseMetrics] getAggregatedMetrics called with placeholder implementation');
    console.log('[ParseMetrics] Date range:', startDate.toISOString(), 'to', endDate.toISOString());
    
    // Return placeholder data structure
    return {
      totalMessages: 0,
      patternSuccessRate: 0,
      aiFallbackRate: 0,
      avgProcessingTimePattern: 0,
      avgProcessingTimeAI: 0,
      intentDistribution: {},
      failureReasonDistribution: {},
    };
  }
  
  /**
   * Calculate pattern success rate from a list of parse events
   * 
   * Helper method for local metrics calculation.
   * 
   * @param events - Array of parse events
   * @returns Success rate (0.0 to 1.0)
   */
  static calculatePatternSuccessRate(events: ParseEvent[]): number {
    const patternAttempts = events.filter(e => e.patternAttempted);
    if (patternAttempts.length === 0) {
      return 0;
    }
    
    const patternSuccesses = patternAttempts.filter(e => e.patternSuccess);
    return patternSuccesses.length / patternAttempts.length;
  }
  
  /**
   * Calculate average processing time by parse method
   * 
   * Helper method for local metrics calculation.
   * 
   * @param events - Array of parse events
   * @param method - Parse method to calculate average for
   * @returns Average processing time in milliseconds
   */
  static calculateAvgProcessingTime(
    events: ParseEvent[],
    method: 'PATTERN' | 'AI_FALLBACK' | 'SPECIALIZED'
  ): number {
    const filteredEvents = events.filter(e => e.parseMethod === method);
    if (filteredEvents.length === 0) {
      return 0;
    }
    
    const totalTime = filteredEvents.reduce((sum, e) => sum + e.processingTimeMs, 0);
    return totalTime / filteredEvents.length;
  }
  
  /**
   * Get intent distribution from a list of parse events
   * 
   * Helper method for local metrics calculation.
   * 
   * @param events - Array of parse events
   * @returns Distribution of intent types with counts
   */
  static getIntentDistribution(events: ParseEvent[]): { [intentType: string]: number } {
    const distribution: { [intentType: string]: number } = {};
    
    for (const event of events) {
      if (event.intentType) {
        distribution[event.intentType] = (distribution[event.intentType] || 0) + 1;
      }
    }
    
    return distribution;
  }
  
  /**
   * Get failure reason distribution from a list of parse events
   * 
   * Helper method for local metrics calculation.
   * 
   * @param events - Array of parse events
   * @returns Distribution of failure reasons with counts
   */
  static getFailureReasonDistribution(events: ParseEvent[]): { [reason: string]: number } {
    const distribution: { [reason: string]: number } = {};
    
    for (const event of events) {
      if (event.patternFailureReason) {
        distribution[event.patternFailureReason] = (distribution[event.patternFailureReason] || 0) + 1;
      }
    }
    
    return distribution;
  }
}
