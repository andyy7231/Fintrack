/**
 * Bug Condition Exploration Test - Balance Query Pattern Recognition
 * 
 * CRITICAL: This test MUST FAIL on unfixed code
 * Purpose: Demonstrate that balance queries return NO_MATCH instead of BALANCE_QUERY intent
 * 
 * Property 1: Bug Condition - Balance queries fail to parse
 */

import { PatternParserService } from '../../../services/ai/pattern-parser.service';

describe('Bug Condition Exploration - Balance Query Recognition', () => {
  describe('Property 1: Balance queries should return BALANCE_QUERY intent', () => {
    
    test('General balance query: "cek sisa uang saya"', () => {
      const result = PatternParserService.attemptPatternParse('cek sisa uang saya');
      
      // Expected behavior after fix:
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('BALANCE_QUERY');
      expect(result.intent.accountHint).toBe(null);
      expect(result.intent.isFreeCash).toBe(false);
      expect(result.parseMethod).toBe('PATTERN');
      expect(result.processingTimeMs).toBeLessThan(50);
    });

    test('Account-specific balance query: "saldo BCA"', () => {
      const result = PatternParserService.attemptPatternParse('saldo BCA');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('BALANCE_QUERY');
      expect(result.intent.accountHint).toBe('BCA');
      expect(result.intent.isFreeCash).toBe(false);
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Free cash query: "uang free saya"', () => {
      const result = PatternParserService.attemptPatternParse('uang free saya');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('BALANCE_QUERY');
      expect(result.intent.accountHint).toBe(null);
      expect(result.intent.isFreeCash).toBe(true);
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Account-specific free cash query: "uang free di Mandiri"', () => {
      const result = PatternParserService.attemptPatternParse('uang free di Mandiri');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('BALANCE_QUERY');
      expect(result.intent.accountHint).toBe('Mandiri');
      expect(result.intent.isFreeCash).toBe(true);
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Simple balance check: "saldo"', () => {
      const result = PatternParserService.attemptPatternParse('saldo');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('BALANCE_QUERY');
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Balance with account: "cek uang di BCA"', () => {
      const result = PatternParserService.attemptPatternParse('cek uang di BCA');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('BALANCE_QUERY');
      expect(result.intent.accountHint).toBe('BCA');
      expect(result.parseMethod).toBe('PATTERN');
    });
  });
});
