/**
 * Preservation Property Tests - Existing Pattern Parser Behavior
 * 
 * Property 2: Preservation - Existing Parsing Behavior Must Remain Unchanged
 * 
 * IMPORTANT: These tests run on UNFIXED code to capture baseline behavior
 * They MUST PASS before and after the fix to ensure no regressions
 */

import { PatternParserService } from '../../../services/ai/pattern-parser.service';

describe('Preservation - Existing Parser Behavior', () => {
  
  describe('Property 2: Verb-based expense commands continue to work', () => {
    
    test('Simple verb-based expense: "beli kopi 25rb"', () => {
      const result = PatternParserService.attemptPatternParse('beli kopi 25rb');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(25000);
      expect(result.intent.description).toBe('kopi');
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Verb-based with account hint: "bayar parkir 5000 dari BCA"', () => {
      const result = PatternParserService.attemptPatternParse('bayar parkir 5000 dari BCA');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(5000);
      expect(result.intent.description).toBe('parkir');
      expect(result.intent.accountHint).toBe('BCA');
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Verb-based with category hint: "belanja bulanan 500k kategori belanja"', () => {
      const result = PatternParserService.attemptPatternParse('belanja bulanan 500k kategori belanja');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(500000);
      expect(result.intent.description).toBe('bulanan');
      expect(result.intent.categoryHint).toBe('belanja');
      expect(result.parseMethod).toBe('PATTERN');
    });
  });

  describe('Multi-action detection still triggers AI fallback', () => {
    
    test('Multi-action with "dan": "makan 12k dan kopi 5rb"', () => {
      const result = PatternParserService.attemptPatternParse('makan 12k dan kopi 5rb');
      
      expect(result.success).toBe(false);
      expect(result.fallbackRequired).toBe(true);
    });

    test('Multi-action with "dan" in verb-based: "beli kopi 5k dan teh 3k"', () => {
      const result = PatternParserService.attemptPatternParse('beli kopi 5k dan teh 3k');
      
      expect(result.success).toBe(false);
      expect(result.fallbackRequired).toBe(true);
    });
  });

  describe('Ambiguity detection still triggers AI fallback', () => {
    
    test('Ambiguous modifier "kayaknya": "makan kayaknya 12k"', () => {
      const result = PatternParserService.attemptPatternParse('makan kayaknya 12k');
      
      expect(result.success).toBe(false);
      expect(result.fallbackRequired).toBe(true);
    });

    test('Ambiguous modifier "mungkin": "beli kopi mungkin 5rb"', () => {
      const result = PatternParserService.attemptPatternParse('beli kopi mungkin 5rb');
      
      expect(result.success).toBe(false);
      expect(result.fallbackRequired).toBe(true);
    });
  });

  describe('Complex date detection still triggers AI fallback', () => {
    
    test('Complex date: "makan 12k 3 hari yang lalu"', () => {
      const result = PatternParserService.attemptPatternParse('makan 12k 3 hari yang lalu');
      
      expect(result.success).toBe(false);
      expect(result.fallbackRequired).toBe(true);
    });
  });

  describe('Income commands handled by parseIncome (not parseExpense)', () => {
    
    test('Income command: "gaji 10jt"', () => {
      const result = PatternParserService.attemptPatternParse('gaji 10jt');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('INCOME');
      expect(result.intent.amount).toBe(10000000);
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Income command: "terima transfer 500k"', () => {
      const result = PatternParserService.attemptPatternParse('terima transfer 500k');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('INCOME');
      expect(result.intent.amount).toBe(500000);
      expect(result.parseMethod).toBe('PATTERN');
    });
  });

  describe('Budget commands handled by parseBudgetAllocation', () => {
    
    test('Budget command: "budget makan 1jt"', () => {
      const result = PatternParserService.attemptPatternParse('budget makan 1jt');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('BUDGET_ALLOCATION');
      expect(result.intent.amount).toBe(1000000);
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Budget command: "anggaran transport 500rb"', () => {
      const result = PatternParserService.attemptPatternParse('anggaran transport 500rb');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('BUDGET_ALLOCATION');
      expect(result.intent.amount).toBe(500000);
      expect(result.parseMethod).toBe('PATTERN');
    });
  });

  describe('Invalid inputs still fail appropriately', () => {
    
    test('Empty string should fail', () => {
      const result = PatternParserService.attemptPatternParse('');
      
      expect(result.success).toBe(false);
    });

    test('No amount should fail: "hello world"', () => {
      const result = PatternParserService.attemptPatternParse('hello world');
      
      expect(result.success).toBe(false);
    });

    test('Amount only should fail: "12000"', () => {
      const result = PatternParserService.attemptPatternParse('12000');
      
      expect(result.success).toBe(false);
    });
  });
});
