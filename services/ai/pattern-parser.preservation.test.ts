/**
 * Pattern Parser Preservation Property Tests
 * 
 * These tests verify that existing behavior remains unchanged after the category inference fix.
 * They should PASS both on unfixed and fixed code.
 * 
 * Test scope:
 * - Explicit "kategori" keyword commands still use explicit hint
 * - Commands with no category keywords still work
 * - Multi-action detection still triggers AI fallback
 * - Amount extraction remains unchanged
 * - Date extraction remains unchanged
 * - Account hint extraction remains unchanged
 * - Verbless commands continue to work
 */

import { describe, it, expect } from 'vitest';
import { PatternParserService } from './pattern-parser.service';
import type { PatternParseResult, PatternParseFailure } from './pattern-parser.service';

describe('Pattern Parser - Preservation Properties (BEFORE FIX)', () => {
  describe('Property 2.1: Explicit Category Keyword Precedence', () => {
    it('should use explicit category hint when "kategori" keyword present', () => {
      const command = 'makan 5k kategori snack';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.intent).toBe('EXPENSE');
        expect(result.intent.amount).toBe(5000);
        expect(result.intent.categoryHint).toBe('snack');
        expect(result.intent.description).toBe('makan');
      }
    });

    it('should use explicit category hint with multi-word category', () => {
      const command = 'beli kopi 25rb kategori makanan dan minuman';
      const result = PatternParserService.attemptPatternParse(command);
      
      // Multi-word after kategori with "dan" triggers multi-action detection
      // So this should fail and fallback to AI
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fallbackRequired).toBe(true);
      }
    });

    it('should use explicit category hint even when description has category keywords', () => {
      const command = 'makan siang 50rb kategori hiburan';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.intent).toBe('EXPENSE');
        expect(result.intent.categoryHint).toBe('hiburan');
        // Explicit category should override any automatic inference from "makan"
      }
    });

    it('should preserve explicit category with account hint', () => {
      const command = 'beli bensin 100rb kategori transport dari BCA';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.categoryHint).toBe('transport');
        expect(result.intent.accountHint).toBe('BCA');
      }
    });

    it('should preserve explicit category with date', () => {
      const command = 'makan 25k kategori makanan kemarin';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.categoryHint).toBe('makanan');
        expect(result.intent.transactionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });

  describe('Property 2.2: Commands Without Category Keywords', () => {
    it('should handle command with no recognizable category keywords', () => {
      const command = 'beli unknown item 5k';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.intent).toBe('EXPENSE');
        expect(result.intent.amount).toBe(5000);
        expect(result.intent.description).toBe('unknown item');
        // On unfixed code, categoryHint should be null
        // After fix, it should be "Lainnya" (inferred default)
        // This test verifies the command still parses successfully
        expect(result.intent.categoryHint === null || result.intent.categoryHint === 'Lainnya').toBe(true);
      }
    });

    it('should handle generic verbless command', () => {
      const command = 'item 10k';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.intent).toBe('EXPENSE');
        expect(result.intent.amount).toBe(10000);
        expect(result.intent.description).toBe('item');
        expect(result.intent.categoryHint === null || result.intent.categoryHint === 'Lainnya').toBe(true);
      }
    });

    it('should handle command with random description', () => {
      const command = 'bayar xyz 50rb';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.intent).toBe('EXPENSE');
        expect(result.intent.amount).toBe(50000);
        expect(result.intent.categoryHint === null || result.intent.categoryHint === 'Lainnya').toBe(true);
      }
    });
  });

  describe('Property 2.3: Multi-Action Detection Preservation', () => {
    it('should fail on multi-action with "dan"', () => {
      const command = 'makan 5k dan bensin 10k';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fallbackRequired).toBe(true);
      }
    });

    it('should fail on multi-action with comma', () => {
      const command = 'beli kopi 25rb, bayar parkir 5rb';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fallbackRequired).toBe(true);
      }
    });

    it('should fail on multi-action with "serta"', () => {
      const command = 'makan siang 50rb serta beli kopi 20rb';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fallbackRequired).toBe(true);
      }
    });

    it('should fail on multi-action even with category keywords', () => {
      const command = 'makan 25k dan bensin 50k';
      const result = PatternParserService.attemptPatternParse(command);
      
      // Multi-action should be detected BEFORE category inference
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fallbackRequired).toBe(true);
      }
    });
  });

  describe('Property 2.4: Amount Extraction Preservation', () => {
    it('should extract "k" suffix correctly', () => {
      const command = 'makan 25k';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.amount).toBe(25000);
      }
    });

    it('should extract "rb" suffix correctly', () => {
      const command = 'bensin 50rb';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.amount).toBe(50000);
      }
    });

    it('should extract "ribu" suffix correctly', () => {
      const command = 'pulsa 25 ribu';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.amount).toBe(25000);
      }
    });

    it('should extract "jt" suffix correctly', () => {
      const command = 'bayar kos 1.2jt';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.amount).toBe(1200000);
      }
    });

    it('should extract "juta" suffix correctly', () => {
      const command = 'beli laptop 10 juta';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.amount).toBe(10000000);
      }
    });

    it('should handle decimal with comma', () => {
      const command = 'beli barang 1,5jt';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.amount).toBe(1500000);
      }
    });

    it('should handle plain numeric amount', () => {
      const command = 'bayar parkir 5000';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.amount).toBe(5000);
      }
    });
  });

  describe('Property 2.5: Date Extraction Preservation', () => {
    it('should extract "kemarin" date', () => {
      const command = 'makan 5k kemarin';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.transactionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        // Date should be valid
        const parsedDate = new Date(result.intent.transactionDate);
        expect(parsedDate.toString()).not.toBe('Invalid Date');
      }
    });

    it('should extract "hari ini" date', () => {
      const command = 'bensin 50rb hari ini';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.transactionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        const parsedDate = new Date(result.intent.transactionDate);
        expect(parsedDate.toString()).not.toBe('Invalid Date');
      }
    });

    it('should extract "tadi" date', () => {
      const command = 'pulsa 25k tadi';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.transactionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it('should default to today when no date specified', () => {
      const command = 'makan 25k';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.transactionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        const parsedDate = new Date(result.intent.transactionDate);
        expect(parsedDate.toString()).not.toBe('Invalid Date');
      }
    });

    it('should preserve date extraction with category keywords', () => {
      const command = 'makan siang 30k kemarin';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.transactionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        // Verbless command extracts entire phrase before amount as description
        expect(result.intent.description).toBe('makan siang');
      }
    });
  });

  describe('Property 2.6: Account Hint Extraction Preservation', () => {
    it('should extract account hint with "dari"', () => {
      const command = 'makan 25k dari BCA';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.accountHint).toBe('BCA');
        expect(result.intent.amount).toBe(25000);
      }
    });

    it('should extract account hint with "pakai"', () => {
      const command = 'bensin 50rb pakai Mandiri';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.accountHint).toBe('Mandiri');
        expect(result.intent.amount).toBe(50000);
      }
    });

    it('should extract account hint with "dengan"', () => {
      const command = 'pulsa 25k dengan GoPay';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.accountHint).toBe('GoPay');
        expect(result.intent.amount).toBe(25000);
      }
    });

    it('should preserve account hint with category keywords', () => {
      const command = 'makan siang 30k dari BCA';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.accountHint).toBe('BCA');
        // Verbless command extracts entire phrase before amount as description
        expect(result.intent.description).toBe('makan siang');
      }
    });

    it('should preserve account hint with date', () => {
      const command = 'bensin 100rb dari BCA kemarin';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.accountHint).toBe('BCA');
        expect(result.intent.transactionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });

  describe('Property 2.7: Verbless Commands Preservation', () => {
    it('should parse verbless command with category keyword', () => {
      const command = 'makan 5k';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.intent).toBe('EXPENSE');
        expect(result.intent.amount).toBe(5000);
        expect(result.intent.description).toBe('makan');
      }
    });

    it('should parse verbless command without category keyword', () => {
      const command = 'item 10k';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.intent).toBe('EXPENSE');
        expect(result.intent.amount).toBe(10000);
        expect(result.intent.description).toBe('item');
      }
    });

    it('should parse verbless command with multi-word description', () => {
      const command = 'beli kopi susu 30k';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.intent).toBe('EXPENSE');
        expect(result.intent.amount).toBe(30000);
        expect(result.intent.description).toContain('kopi');
      }
    });

    it('should parse verbless command with account hint', () => {
      const command = 'bensin 50rb dari BCA';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.intent).toBe('EXPENSE');
        expect(result.intent.amount).toBe(50000);
        expect(result.intent.description).toBe('bensin');
        expect(result.intent.accountHint).toBe('BCA');
      }
    });

    it('should parse verbless command with date', () => {
      const command = 'pulsa 25k kemarin';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.intent).toBe('EXPENSE');
        expect(result.intent.amount).toBe(25000);
        expect(result.intent.description).toBe('pulsa');
        expect(result.intent.transactionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });

  describe('Property 2.8: Ambiguous Modifier Detection Preservation', () => {
    it('should fail on ambiguous modifier "kayaknya"', () => {
      const command = 'makan kayaknya 25k';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fallbackRequired).toBe(true);
      }
    });

    it('should fail on ambiguous modifier "mungkin"', () => {
      const command = 'bensin mungkin 50rb';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fallbackRequired).toBe(true);
      }
    });

    it('should fail on ambiguous modifier "kira-kira"', () => {
      const command = 'pulsa kira-kira 25k';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fallbackRequired).toBe(true);
      }
    });
  });

  describe('Property 2.9: Complex Date Expression Detection Preservation', () => {
    it('should fail on future date "besok"', () => {
      const command = 'makan 25k besok';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fallbackRequired).toBe(true);
      }
    });

    it('should fail on time expression "jam 3 sore"', () => {
      const command = 'makan 25k kemarin jam 3 sore';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fallbackRequired).toBe(true);
      }
    });

    it('should handle distant past "minggu lalu"', () => {
      const command = 'bensin 50k minggu lalu';
      const result = PatternParserService.attemptPatternParse(command);
      
      // "minggu lalu" is actually parsed successfully (not considered complex)
      // This test verifies the current behavior
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.intent).toBe('EXPENSE');
        expect(result.intent.amount).toBe(50000);
        expect(result.intent.transactionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });

  describe('Property 2.10: Description Extraction Preservation', () => {
    it('should extract description between verb and amount', () => {
      const command = 'beli kopi susu 25k';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.description).toContain('kopi');
      }
    });

    it('should extract description before amount in verbless', () => {
      const command = 'makan siang 50k';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        // Verbless command extracts entire phrase before amount as description
        expect(result.intent.description).toBe('makan siang');
      }
    });

    it('should preserve description with all metadata', () => {
      const command = 'beli bensin 100rb kategori transport dari BCA kemarin';
      const result = PatternParserService.attemptPatternParse(command);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.intent.description).toBe('bensin');
        expect(result.intent.amount).toBe(100000);
        expect(result.intent.categoryHint).toBe('transport');
        expect(result.intent.accountHint).toBe('BCA');
        expect(result.intent.transactionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });
});
