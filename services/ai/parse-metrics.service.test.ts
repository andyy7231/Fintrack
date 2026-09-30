/**
 * Tests for Parse Metrics Service
 * 
 * Validates metrics collection, aggregation, and helper functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ParseMetricsService, ParseEvent, ParseMetricsAggregate } from './parse-metrics.service';

describe('ParseMetricsService', () => {
  // Capture console output for testing
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  
  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  
  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });
  
  describe('logParseEvent', () => {
    it('should log pattern success event to console', () => {
      const event: ParseEvent = {
        timestamp: new Date('2024-01-15T10:00:00Z'),
        userId: 'user-123',
        phoneNumber: '+6281234567890',
        messageLength: 20,
        parseMethod: 'PATTERN',
        intentType: 'EXPENSE',
        processingTimeMs: 25,
        patternAttempted: true,
        patternSuccess: true,
      };
      
      ParseMetricsService.logParseEvent(event);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ParseMetrics]',
        expect.stringContaining('"parseMethod":"PATTERN"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ParseMetrics]',
        expect.stringContaining('"intentType":"EXPENSE"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ParseMetrics]',
        expect.stringContaining('"processingTimeMs":25')
      );
    });
    
    it('should log AI fallback event with failure reason', () => {
      const event: ParseEvent = {
        timestamp: new Date('2024-01-15T10:00:00Z'),
        userId: 'user-456',
        phoneNumber: '+6281234567891',
        messageLength: 50,
        parseMethod: 'AI_FALLBACK',
        intentType: 'EXPENSE',
        processingTimeMs: 280,
        patternAttempted: true,
        patternSuccess: false,
        patternFailureReason: 'MULTI_ACTION',
      };
      
      ParseMetricsService.logParseEvent(event);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ParseMetrics]',
        expect.stringContaining('"parseMethod":"AI_FALLBACK"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ParseMetrics]',
        expect.stringContaining('"patternFailureReason":"MULTI_ACTION"')
      );
    });
    
    it('should log specialized service event without intent type', () => {
      const event: ParseEvent = {
        timestamp: new Date('2024-01-15T10:00:00Z'),
        userId: 'user-789',
        phoneNumber: '+6281234567892',
        messageLength: 10,
        parseMethod: 'SPECIALIZED',
        processingTimeMs: 5,
        patternAttempted: false,
        patternSuccess: false,
      };
      
      ParseMetricsService.logParseEvent(event);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ParseMetrics]',
        expect.stringContaining('"parseMethod":"SPECIALIZED"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ParseMetrics]',
        expect.stringContaining('"intentType":"N/A"')
      );
    });
  });
  
  describe('getAggregatedMetrics', () => {
    it('should return placeholder data structure', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const metrics = await ParseMetricsService.getAggregatedMetrics(startDate, endDate);
      
      expect(metrics).toMatchObject({
        totalMessages: 0,
        patternSuccessRate: 0,
        aiFallbackRate: 0,
        avgProcessingTimePattern: 0,
        avgProcessingTimeAI: 0,
        intentDistribution: {},
        failureReasonDistribution: {},
      });
    });
    
    it('should log warning about placeholder implementation', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      await ParseMetricsService.getAggregatedMetrics(startDate, endDate);
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ParseMetrics] getAggregatedMetrics called with placeholder implementation'
      );
    });
  });
  
  describe('calculatePatternSuccessRate', () => {
    it('should return 0 for empty events array', () => {
      const rate = ParseMetricsService.calculatePatternSuccessRate([]);
      expect(rate).toBe(0);
    });
    
    it('should return 0 when no pattern attempts', () => {
      const events: ParseEvent[] = [
        {
          timestamp: new Date(),
          userId: 'user-1',
          phoneNumber: '+6281234567890',
          messageLength: 10,
          parseMethod: 'SPECIALIZED',
          processingTimeMs: 5,
          patternAttempted: false,
          patternSuccess: false,
        },
      ];
      
      const rate = ParseMetricsService.calculatePatternSuccessRate(events);
      expect(rate).toBe(0);
    });
    
    it('should calculate correct success rate for mixed results', () => {
      const events: ParseEvent[] = [
        {
          timestamp: new Date(),
          userId: 'user-1',
          phoneNumber: '+6281234567890',
          messageLength: 20,
          parseMethod: 'PATTERN',
          intentType: 'EXPENSE',
          processingTimeMs: 25,
          patternAttempted: true,
          patternSuccess: true,
        },
        {
          timestamp: new Date(),
          userId: 'user-2',
          phoneNumber: '+6281234567891',
          messageLength: 30,
          parseMethod: 'AI_FALLBACK',
          intentType: 'EXPENSE',
          processingTimeMs: 280,
          patternAttempted: true,
          patternSuccess: false,
        },
        {
          timestamp: new Date(),
          userId: 'user-3',
          phoneNumber: '+6281234567892',
          messageLength: 15,
          parseMethod: 'PATTERN',
          intentType: 'INCOME',
          processingTimeMs: 20,
          patternAttempted: true,
          patternSuccess: true,
        },
        {
          timestamp: new Date(),
          userId: 'user-4',
          phoneNumber: '+6281234567893',
          messageLength: 40,
          parseMethod: 'AI_FALLBACK',
          intentType: 'EXPENSE',
          processingTimeMs: 300,
          patternAttempted: true,
          patternSuccess: false,
        },
      ];
      
      const rate = ParseMetricsService.calculatePatternSuccessRate(events);
      expect(rate).toBe(0.5); // 2 successes out of 4 attempts = 50%
    });
    
    it('should return 1.0 for 100% success rate', () => {
      const events: ParseEvent[] = [
        {
          timestamp: new Date(),
          userId: 'user-1',
          phoneNumber: '+6281234567890',
          messageLength: 20,
          parseMethod: 'PATTERN',
          intentType: 'EXPENSE',
          processingTimeMs: 25,
          patternAttempted: true,
          patternSuccess: true,
        },
        {
          timestamp: new Date(),
          userId: 'user-2',
          phoneNumber: '+6281234567891',
          messageLength: 15,
          parseMethod: 'PATTERN',
          intentType: 'INCOME',
          processingTimeMs: 20,
          patternAttempted: true,
          patternSuccess: true,
        },
      ];
      
      const rate = ParseMetricsService.calculatePatternSuccessRate(events);
      expect(rate).toBe(1.0);
    });
  });
  
  describe('calculateAvgProcessingTime', () => {
    it('should return 0 for empty events array', () => {
      const avgTime = ParseMetricsService.calculateAvgProcessingTime([], 'PATTERN');
      expect(avgTime).toBe(0);
    });
    
    it('should return 0 when no events match the method', () => {
      const events: ParseEvent[] = [
        {
          timestamp: new Date(),
          userId: 'user-1',
          phoneNumber: '+6281234567890',
          messageLength: 20,
          parseMethod: 'AI_FALLBACK',
          processingTimeMs: 280,
          patternAttempted: true,
          patternSuccess: false,
        },
      ];
      
      const avgTime = ParseMetricsService.calculateAvgProcessingTime(events, 'PATTERN');
      expect(avgTime).toBe(0);
    });
    
    it('should calculate correct average for PATTERN method', () => {
      const events: ParseEvent[] = [
        {
          timestamp: new Date(),
          userId: 'user-1',
          phoneNumber: '+6281234567890',
          messageLength: 20,
          parseMethod: 'PATTERN',
          intentType: 'EXPENSE',
          processingTimeMs: 20,
          patternAttempted: true,
          patternSuccess: true,
        },
        {
          timestamp: new Date(),
          userId: 'user-2',
          phoneNumber: '+6281234567891',
          messageLength: 15,
          parseMethod: 'PATTERN',
          intentType: 'INCOME',
          processingTimeMs: 30,
          patternAttempted: true,
          patternSuccess: true,
        },
        {
          timestamp: new Date(),
          userId: 'user-3',
          phoneNumber: '+6281234567892',
          messageLength: 30,
          parseMethod: 'AI_FALLBACK',
          intentType: 'EXPENSE',
          processingTimeMs: 300,
          patternAttempted: true,
          patternSuccess: false,
        },
      ];
      
      const avgTime = ParseMetricsService.calculateAvgProcessingTime(events, 'PATTERN');
      expect(avgTime).toBe(25); // (20 + 30) / 2
    });
    
    it('should calculate correct average for AI_FALLBACK method', () => {
      const events: ParseEvent[] = [
        {
          timestamp: new Date(),
          userId: 'user-1',
          phoneNumber: '+6281234567890',
          messageLength: 30,
          parseMethod: 'AI_FALLBACK',
          processingTimeMs: 250,
          patternAttempted: true,
          patternSuccess: false,
        },
        {
          timestamp: new Date(),
          userId: 'user-2',
          phoneNumber: '+6281234567891',
          messageLength: 40,
          parseMethod: 'AI_FALLBACK',
          processingTimeMs: 310,
          patternAttempted: true,
          patternSuccess: false,
        },
      ];
      
      const avgTime = ParseMetricsService.calculateAvgProcessingTime(events, 'AI_FALLBACK');
      expect(avgTime).toBe(280); // (250 + 310) / 2
    });
  });
  
  describe('getIntentDistribution', () => {
    it('should return empty object for empty events array', () => {
      const distribution = ParseMetricsService.getIntentDistribution([]);
      expect(distribution).toEqual({});
    });
    
    it('should count intent types correctly', () => {
      const events: ParseEvent[] = [
        {
          timestamp: new Date(),
          userId: 'user-1',
          phoneNumber: '+6281234567890',
          messageLength: 20,
          parseMethod: 'PATTERN',
          intentType: 'EXPENSE',
          processingTimeMs: 25,
          patternAttempted: true,
          patternSuccess: true,
        },
        {
          timestamp: new Date(),
          userId: 'user-2',
          phoneNumber: '+6281234567891',
          messageLength: 15,
          parseMethod: 'PATTERN',
          intentType: 'INCOME',
          processingTimeMs: 20,
          patternAttempted: true,
          patternSuccess: true,
        },
        {
          timestamp: new Date(),
          userId: 'user-3',
          phoneNumber: '+6281234567892',
          messageLength: 25,
          parseMethod: 'PATTERN',
          intentType: 'EXPENSE',
          processingTimeMs: 22,
          patternAttempted: true,
          patternSuccess: true,
        },
        {
          timestamp: new Date(),
          userId: 'user-4',
          phoneNumber: '+6281234567893',
          messageLength: 30,
          parseMethod: 'PATTERN',
          intentType: 'BUDGET_ALLOCATION',
          processingTimeMs: 18,
          patternAttempted: true,
          patternSuccess: true,
        },
        {
          timestamp: new Date(),
          userId: 'user-5',
          phoneNumber: '+6281234567894',
          messageLength: 20,
          parseMethod: 'PATTERN',
          intentType: 'EXPENSE',
          processingTimeMs: 23,
          patternAttempted: true,
          patternSuccess: true,
        },
      ];
      
      const distribution = ParseMetricsService.getIntentDistribution(events);
      expect(distribution).toEqual({
        EXPENSE: 3,
        INCOME: 1,
        BUDGET_ALLOCATION: 1,
      });
    });
    
    it('should ignore events without intent type', () => {
      const events: ParseEvent[] = [
        {
          timestamp: new Date(),
          userId: 'user-1',
          phoneNumber: '+6281234567890',
          messageLength: 10,
          parseMethod: 'SPECIALIZED',
          processingTimeMs: 5,
          patternAttempted: false,
          patternSuccess: false,
        },
        {
          timestamp: new Date(),
          userId: 'user-2',
          phoneNumber: '+6281234567891',
          messageLength: 20,
          parseMethod: 'PATTERN',
          intentType: 'EXPENSE',
          processingTimeMs: 25,
          patternAttempted: true,
          patternSuccess: true,
        },
      ];
      
      const distribution = ParseMetricsService.getIntentDistribution(events);
      expect(distribution).toEqual({
        EXPENSE: 1,
      });
    });
  });
  
  describe('getFailureReasonDistribution', () => {
    it('should return empty object for empty events array', () => {
      const distribution = ParseMetricsService.getFailureReasonDistribution([]);
      expect(distribution).toEqual({});
    });
    
    it('should count failure reasons correctly', () => {
      const events: ParseEvent[] = [
        {
          timestamp: new Date(),
          userId: 'user-1',
          phoneNumber: '+6281234567890',
          messageLength: 40,
          parseMethod: 'AI_FALLBACK',
          processingTimeMs: 280,
          patternAttempted: true,
          patternSuccess: false,
          patternFailureReason: 'MULTI_ACTION',
        },
        {
          timestamp: new Date(),
          userId: 'user-2',
          phoneNumber: '+6281234567891',
          messageLength: 50,
          parseMethod: 'AI_FALLBACK',
          processingTimeMs: 300,
          patternAttempted: true,
          patternSuccess: false,
          patternFailureReason: 'COMPLEX_DATE',
        },
        {
          timestamp: new Date(),
          userId: 'user-3',
          phoneNumber: '+6281234567892',
          messageLength: 35,
          parseMethod: 'AI_FALLBACK',
          processingTimeMs: 290,
          patternAttempted: true,
          patternSuccess: false,
          patternFailureReason: 'MULTI_ACTION',
        },
        {
          timestamp: new Date(),
          userId: 'user-4',
          phoneNumber: '+6281234567893',
          messageLength: 25,
          parseMethod: 'AI_FALLBACK',
          processingTimeMs: 270,
          patternAttempted: true,
          patternSuccess: false,
          patternFailureReason: 'NO_MATCH',
        },
      ];
      
      const distribution = ParseMetricsService.getFailureReasonDistribution(events);
      expect(distribution).toEqual({
        MULTI_ACTION: 2,
        COMPLEX_DATE: 1,
        NO_MATCH: 1,
      });
    });
    
    it('should ignore events without failure reason', () => {
      const events: ParseEvent[] = [
        {
          timestamp: new Date(),
          userId: 'user-1',
          phoneNumber: '+6281234567890',
          messageLength: 20,
          parseMethod: 'PATTERN',
          intentType: 'EXPENSE',
          processingTimeMs: 25,
          patternAttempted: true,
          patternSuccess: true,
        },
        {
          timestamp: new Date(),
          userId: 'user-2',
          phoneNumber: '+6281234567891',
          messageLength: 40,
          parseMethod: 'AI_FALLBACK',
          processingTimeMs: 280,
          patternAttempted: true,
          patternSuccess: false,
          patternFailureReason: 'MULTI_ACTION',
        },
      ];
      
      const distribution = ParseMetricsService.getFailureReasonDistribution(events);
      expect(distribution).toEqual({
        MULTI_ACTION: 1,
      });
    });
  });
});
