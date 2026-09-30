/**
 * Bug Condition Exploration Test - Verbless Expense Commands
 * 
 * CRITICAL: This test MUST FAIL on unfixed code
 * Purpose: Demonstrate that verbless expense commands currently fail to parse
 * 
 * Property 1: Bug Condition - Verbless Expense Commands Fail to Parse
 * 
 * These tests encode the EXPECTED behavior after the fix.
 * When they pass, the bug is fixed.
 */

import { PatternParserService } from '../../../services/ai/pattern-parser.service';

describe('Bug Condition Exploration - Verbless Expense Commands', () => {
  describe('Property 1: Verbless expense commands should parse successfully', () => {
    
    test('Simple verbless expense: "makan 12k"', () => {
      const result = PatternParserService.attemptPatternParse('makan 12k');
      
      // Expected behavior after fix:
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(12000);
      expect(result.intent.description).toBe('makan');
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Verbless expense with different unit: "kopi 5rb"', () => {
      const result = PatternParserService.attemptPatternParse('kopi 5rb');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(5000);
      expect(result.intent.description).toBe('kopi');
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Verbless expense with larger amount: "bensin 50k"', () => {
      const result = PatternParserService.attemptPatternParse('bensin 50k');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(50000);
      expect(result.intent.description).toBe('bensin');
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Verbless expense with account hint: "parkir 3000 dari BCA"', () => {
      const result = PatternParserService.attemptPatternParse('parkir 3000 dari BCA');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(3000);
      expect(result.intent.description).toBe('parkir');
      expect(result.intent.accountHint).toBe('BCA');
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Verbless expense with multi-word description: "makan siang 45rb"', () => {
      const result = PatternParserService.attemptPatternParse('makan siang 45rb');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(45000);
      expect(result.intent.description).toBe('makan siang');
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Verbless expense with category hint: "makan 25rb kategori makanan"', () => {
      const result = PatternParserService.attemptPatternParse('makan 25rb kategori makanan');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(25000);
      expect(result.intent.description).toBe('makan');
      expect(result.intent.categoryHint).toBe('makanan');
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Verbless expense with date: "kopi 5k kemarin"', () => {
      const result = PatternParserService.attemptPatternParse('kopi 5k kemarin');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(5000);
      expect(result.intent.description).toBe('kopi');
      // Date should be yesterday
      expect(result.intent.transactionDate).toBeTruthy();
      expect(result.parseMethod).toBe('PATTERN');
    });
  });
});
