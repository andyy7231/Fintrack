/**
 * Preservation Property Tests - Existing Pattern Parser Behavior
 * 
 * Property 2: Existing pattern matching behavior must remain unchanged
 * 
 * These tests run on UNFIXED code to capture baseline behavior
 * They MUST PASS before and after the fix
 */

import { PatternParserService } from '../../../services/ai/pattern-parser.service';

describe('Preservation - Existing Pattern Parser Behavior', () => {
  
  describe('Property 2: Expense parsing unchanged', () => {
    
    test('Verb-based expense: "beli kopi 25rb"', () => {
      const result = PatternParserService.attemptPatternParse('beli kopi 25rb');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(25000);
      expect(result.intent.description).toBe('kopi');
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Verbless expense: "makan 12k"', () => {
      const result = PatternParserService.attemptPatternParse('makan 12k');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(12000);
      expect(result.intent.description).toBe('makan');
    });
  });

  describe('Income parsing unchanged', () => {
    
    test('Income command: "gaji 10jt"', () => {
      const result = PatternParserService.attemptPatternParse('gaji 10jt');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('INCOME');
      expect(result.intent.amount).toBe(10000000);
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Income with account: "terima transfer 500k ke Mandiri"', () => {
      const result = PatternParserService.attemptPatternParse('terima transfer 500k ke Mandiri');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('INCOME');
      expect(result.intent.amount).toBe(500000);
    });
  });

  describe('Budget allocation parsing unchanged', () => {
    
    test('Budget command: "budget makan 1jt"', () => {
      const result = PatternParserService.attemptPatternParse('budget makan 1jt');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('BUDGET_ALLOCATION');
      expect(result.intent.amount).toBe(1000000);
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Budget with anggaran prefix: "anggaran transport 500rb"', () => {
      const result = PatternParserService.attemptPatternParse('anggaran transport 500rb');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('BUDGET_ALLOCATION');
      expect(result.intent.amount).toBe(500000);
    });
  });

  describe('Multi-action detection unchanged', () => {
    
    test('Multi-action returns NO_MATCH: "beli kopi 25rb dan makan 50rb"', () => {
      const result = PatternParserService.attemptPatternParse('beli kopi 25rb dan makan 50rb');
      
      expect(result.success).toBe(false);
      expect(result.fallbackRequired).toBe(true);
    });
  });

  describe('Ambiguity detection unchanged', () => {
    
    test('Ambiguous modifier returns NO_MATCH: "kemarin kayaknya habis 50rb"', () => {
      const result = PatternParserService.attemptPatternParse('kemarin kayaknya habis 50rb');
      
      expect(result.success).toBe(false);
      expect(result.fallbackRequired).toBe(true);
    });
  });

  describe('Invalid inputs unchanged', () => {
    
    test('Empty string returns INVALID_FORMAT', () => {
      const result = PatternParserService.attemptPatternParse('');
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('INVALID_FORMAT');
    });

    test('No amount returns NO_MATCH: "hello world"', () => {
      const result = PatternParserService.attemptPatternParse('hello world');
      
      expect(result.success).toBe(false);
    });
  });
});
