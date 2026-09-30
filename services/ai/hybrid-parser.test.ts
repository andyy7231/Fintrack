/**
 * Hybrid Parser Service Tests
 * 
 * Unit tests for hybrid parser orchestration functionality.
 * Tests pattern-first routing, AI fallback, entity resolution, and metrics collection.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HybridParserService, ParseMetrics } from './hybrid-parser.service';
import { FinancialParserService, ParseWorkflowResult } from './parser.service';

// Mock the FinancialParserService for testing AI fallback
class MockFinancialParserService extends FinancialParserService {
  constructor() {
    // Pass a mock provider to avoid actual AI calls
    super();
  }

  async processFinancialText(text: string, userId: string): Promise<ParseWorkflowResult> {
    // Simulate AI fallback response
    return {
      status: 'NEEDS_CLARIFICATION',
      clarificationText: 'Mock AI response - message not understood',
    };
  }
}

describe('HybridParserService', () => {
  let hybridParser: HybridParserService;
  let mockAiParser: MockFinancialParserService;

  beforeEach(() => {
    mockAiParser = new MockFinancialParserService();
    hybridParser = new HybridParserService(mockAiParser);
  });

  describe('Pattern-first routing (Task 4.2)', () => {
    it('should attempt pattern parse and record metrics even when entity resolution fails', async () => {
      const result = await hybridParser.processFinancialText('Beli kopi 25rb', 'user123');
      
      // Result may be ERROR due to database connection, but pattern parse should succeed
      // Check metrics to verify pattern parsing happened
      const metrics = hybridParser.getMetrics();
      expect(metrics.length).toBe(1);
      expect(metrics[0]?.parseMethod).toBe('PATTERN');
      expect(metrics[0]?.patternSuccess).toBe(true);
      expect(metrics[0]?.intentType).toBe('EXPENSE');
    });

    it('should fallback to AI when pattern parse fails', async () => {
      // Complex message that should fail pattern parsing
      const result = await hybridParser.processFinancialText(
        'Kemarin kayaknya habis sekitar 50rb untuk kopi dan makan siang',
        'user123'
      );
      
      // Should reach AI fallback
      expect(result.status).toBe('NEEDS_CLARIFICATION');
      
      // Check metrics
      const metrics = hybridParser.getMetrics();
      expect(metrics.length).toBe(1);
      expect(metrics[0]?.parseMethod).toBe('AI_FALLBACK');
      expect(metrics[0]?.patternSuccess).toBe(false);
      expect(metrics[0]?.patternFailureReason).toBeDefined();
    });

    it('should handle multi-action messages via AI fallback', async () => {
      const result = await hybridParser.processFinancialText(
        'Beli kopi 25rb dan makan siang 50rb',
        'user123'
      );
      
      // Should trigger AI fallback due to multi-action
      expect(result.status).toBe('NEEDS_CLARIFICATION');
      
      const metrics = hybridParser.getMetrics();
      expect(metrics[0]?.parseMethod).toBe('AI_FALLBACK');
      // Pattern parser detects multi-action and returns NO_MATCH for AI fallback
      expect(['MULTI_ACTION', 'NO_MATCH']).toContain(metrics[0]?.patternFailureReason);
    });
  });

  describe('Metrics collection (Task 4.5)', () => {
    it('should collect metrics for pattern success', async () => {
      await hybridParser.processFinancialText('Budget makan 1jt', 'user123');
      
      const metrics = hybridParser.getMetrics();
      expect(metrics.length).toBe(1);
      
      const metric = metrics[0];
      expect(metric).toMatchObject({
        parseMethod: 'PATTERN',
        intentType: 'BUDGET_ALLOCATION',
        patternAttempted: true,
        patternSuccess: true,
        userId: 'user123',
        messageLength: 16,
      });
      
      expect(metric?.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(metric?.timestamp).toBeInstanceOf(Date);
    });

    it('should collect metrics for AI fallback', async () => {
      await hybridParser.processFinancialText('complex message', 'user456');
      
      const metrics = hybridParser.getMetrics();
      expect(metrics.length).toBe(1);
      
      const metric = metrics[0];
      expect(metric).toMatchObject({
        parseMethod: 'AI_FALLBACK',
        patternAttempted: true,
        patternSuccess: false,
        userId: 'user456',
        messageLength: 15,
      });
      
      expect(metric?.patternFailureReason).toBeDefined();
    });

    it('should accumulate metrics across multiple parses', async () => {
      await hybridParser.processFinancialText('Beli kopi 25rb', 'user1');
      await hybridParser.processFinancialText('Gaji 10jt', 'user1');
      await hybridParser.processFinancialText('complex message', 'user1');
      
      const metrics = hybridParser.getMetrics();
      expect(metrics.length).toBe(3);
      
      const summary = hybridParser.getMetricsSummary();
      expect(summary.totalParses).toBe(3);
      expect(summary.patternSuccess).toBe(2);
      expect(summary.patternSuccessRate).toBeCloseTo(66.67, 1);
      expect(summary.aiFallbackRate).toBeCloseTo(33.33, 1);
    });

    it('should clear metrics', () => {
      hybridParser.clearMetrics();
      const metrics = hybridParser.getMetrics();
      expect(metrics.length).toBe(0);
      
      const summary = hybridParser.getMetricsSummary();
      expect(summary.totalParses).toBe(0);
    });
  });

  describe('AI fallback error handling (Task 4.4)', () => {
    it('should handle AI service unavailable gracefully', async () => {
      // Create mock that throws service unavailable error
      const errorAiParser = {
        processFinancialText: vi.fn().mockRejectedValue({
          code: 503,
          message: 'Service Temporarily Unavailable',
        }),
      } as any;
      
      const parser = new HybridParserService(errorAiParser);
      
      // Message that fails pattern parse and triggers AI fallback
      const result = await parser.processFinancialText('complex ambiguous message', 'user123');
      
      expect(result.status).toBe('NEEDS_CLARIFICATION');
      if (result.status === 'NEEDS_CLARIFICATION') {
        expect(result.clarificationText).toContain('layanan pemrosesan pesan sedang tidak tersedia');
      }
    });

    it('should handle timeout errors gracefully', async () => {
      const errorAiParser = {
        processFinancialText: vi.fn().mockRejectedValue({
          code: 'ETIMEDOUT',
          message: 'Request timeout',
        }),
      } as any;
      
      const parser = new HybridParserService(errorAiParser);
      const result = await parser.processFinancialText('complex message', 'user123');
      
      expect(result.status).toBe('NEEDS_CLARIFICATION');
    });

    it('should handle API key errors gracefully', async () => {
      const errorAiParser = {
        processFinancialText: vi.fn().mockRejectedValue({
          message: 'API key is invalid or missing',
        }),
      } as any;
      
      const parser = new HybridParserService(errorAiParser);
      const result = await parser.processFinancialText('complex message', 'user123');
      
      expect(result.status).toBe('NEEDS_CLARIFICATION');
    });

    it('should handle unexpected AI errors', async () => {
      const errorAiParser = {
        processFinancialText: vi.fn().mockRejectedValue(new Error('Unexpected error')),
      } as any;
      
      const parser = new HybridParserService(errorAiParser);
      const result = await parser.processFinancialText('complex message', 'user123');
      
      expect(result.status).toBe('NEEDS_CLARIFICATION');
      if (result.status === 'NEEDS_CLARIFICATION') {
        expect(result.clarificationText).toContain('belum dapat memahami');
      }
    });
  });

  describe('Metrics summary', () => {
    it('should return empty summary when no metrics', () => {
      const summary = hybridParser.getMetricsSummary();
      
      expect(summary).toEqual({
        totalParses: 0,
        patternSuccess: 0,
        patternSuccessRate: 0,
        aiFallbackRate: 0,
        avgPatternProcessingMs: 0,
        avgAIProcessingMs: 0,
      });
    });

    it('should calculate correct statistics', async () => {
      // Simulate 4 pattern successes
      await hybridParser.processFinancialText('Beli kopi 25rb', 'user1');
      await hybridParser.processFinancialText('Gaji 10jt', 'user1');
      await hybridParser.processFinancialText('Budget makan 1jt', 'user1');
      await hybridParser.processFinancialText('Bayar parkir 5000', 'user1');
      
      // Simulate 1 AI fallback
      await hybridParser.processFinancialText('complex ambiguous message', 'user1');
      
      const summary = hybridParser.getMetricsSummary();
      
      expect(summary.totalParses).toBe(5);
      expect(summary.patternSuccess).toBe(4);
      expect(summary.patternSuccessRate).toBe(80);
      expect(summary.aiFallbackRate).toBe(20);
      expect(summary.avgPatternProcessingMs).toBeGreaterThanOrEqual(0);
      expect(summary.avgAIProcessingMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Invalid input handling', () => {
    it('should handle empty string', async () => {
      const result = await hybridParser.processFinancialText('', 'user123');
      
      // Should fallback to AI (pattern parse will fail on empty input)
      expect(result.status).toBe('NEEDS_CLARIFICATION');
    });

    it('should handle whitespace-only input', async () => {
      const result = await hybridParser.processFinancialText('   ', 'user123');
      
      expect(result.status).toBe('NEEDS_CLARIFICATION');
    });

    it('should not throw exceptions on malformed input', async () => {
      const inputs = [
        'null',
        'undefined',
        '😀😀😀',
        'a'.repeat(10000), // Very long input
      ];
      
      for (const input of inputs) {
        const result = await hybridParser.processFinancialText(input, 'user123');
        expect(result).toBeDefined();
        expect(['NEEDS_CLARIFICATION', 'ERROR', 'READY_FOR_CONFIRMATION']).toContain(result.status);
      }
    });
  });

  describe('Pattern parse success scenarios', () => {
    it('should successfully route expense commands through pattern parser', async () => {
      const testCases = [
        'Beli kopi 25rb',
        'Bayar parkir 5000',
      ];
      
      for (const testCase of testCases) {
        hybridParser.clearMetrics();
        
        // We expect ERROR because there's no database connection for entity resolution
        // But the pattern parse should succeed (indicated in metrics)
        const result = await hybridParser.processFinancialText(testCase, 'user123');
        
        // Check that pattern parsing succeeded (even if entity resolution failed)
        const metrics = hybridParser.getMetrics();
        expect(metrics.length).toBeGreaterThan(0);
        expect(metrics[0]?.parseMethod).toBe('PATTERN');
        expect(metrics[0]?.intentType).toBe('EXPENSE');
        expect(metrics[0]?.patternSuccess).toBe(true);
      }
    });

    it('should successfully route income commands through pattern parser', async () => {
      const testCases = [
        'Gaji 10jt',
        'Terima transfer 500k',
      ];
      
      for (const testCase of testCases) {
        hybridParser.clearMetrics();
        
        const result = await hybridParser.processFinancialText(testCase, 'user123');
        
        // Check that pattern parsing succeeded
        const metrics = hybridParser.getMetrics();
        expect(metrics.length).toBeGreaterThan(0);
        expect(metrics[0]?.parseMethod).toBe('PATTERN');
        expect(metrics[0]?.intentType).toBe('INCOME');
        expect(metrics[0]?.patternSuccess).toBe(true);
      }
    }, 30000); // 30 second timeout for slow database queries

    it('should successfully route budget allocation commands through pattern parser', async () => {
      const testCases = [
        'Budget makan 1jt',
        'Anggaran transport 500rb',
      ];
      
      for (const testCase of testCases) {
        hybridParser.clearMetrics();
        
        const result = await hybridParser.processFinancialText(testCase, 'user123');
        
        // Check that pattern parsing succeeded
        const metrics = hybridParser.getMetrics();
        expect(metrics.length).toBeGreaterThan(0);
        expect(metrics[0]?.parseMethod).toBe('PATTERN');
        expect(metrics[0]?.intentType).toBe('BUDGET_ALLOCATION');
        expect(metrics[0]?.patternSuccess).toBe(true);
      }
    }, 10000); // 10 second timeout
  });
});
