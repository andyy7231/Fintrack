/**
 * Bug Condition Exploration Test - Pattern Parser Category Inference
 * 
 * CRITICAL: This test MUST FAIL on unfixed code
 * Purpose: Demonstrate that pattern parser does not automatically infer categories
 *          from description keywords when no explicit "kategori" keyword is present
 * 
 * Property 1: Bug Condition - Automatic Category Inference
 * 
 * These tests encode the EXPECTED behavior after the fix.
 * When they pass, the bug is fixed.
 * When they fail, they demonstrate the bug exists.
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8**
 */

import { PatternParserService } from '../../../services/ai/pattern-parser.service';

describe('Bug Condition Exploration - Pattern Parser Category Inference', () => {
  describe('Property 1: Commands with category keywords should infer categoryHint automatically', () => {
    
    test('Food keyword "makan" should infer Makanan & Minuman', () => {
      const result = PatternParserService.attemptPatternParse('makan 5k');
      
      // Expected behavior after fix:
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(5000);
      expect(result.intent.description).toBe('makan');
      
      // BUG: Currently returns null, should return "Makanan & Minuman"
      expect(result.intent.categoryHint).toBe('Makanan & Minuman');
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Transport keyword "bensin" should infer Transportasi', () => {
      const result = PatternParserService.attemptPatternParse('bensin 50k');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(50000);
      expect(result.intent.description).toBe('bensin');
      
      // BUG: Currently returns null, should return "Transportasi"
      expect(result.intent.categoryHint).toBe('Transportasi');
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Utility keyword "pulsa" should infer Tagihan & Utilitas', () => {
      const result = PatternParserService.attemptPatternParse('pulsa 25k');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(25000);
      expect(result.intent.description).toBe('pulsa');
      
      // BUG: Currently returns null, should return "Tagihan & Utilitas"
      expect(result.intent.categoryHint).toBe('Tagihan & Utilitas');
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Shopping keyword "belanja" should infer Belanja', () => {
      const result = PatternParserService.attemptPatternParse('belanja 100k');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(100000);
      expect(result.intent.description).toBe('belanja');
      
      // BUG: Currently returns null, should return "Belanja"
      expect(result.intent.categoryHint).toBe('Belanja');
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Health keyword "obat" should infer Kesehatan', () => {
      const result = PatternParserService.attemptPatternParse('beli obat 35k');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(35000);
      
      // BUG: Currently returns null, should return "Kesehatan"
      expect(result.intent.categoryHint).toBe('Kesehatan');
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Entertainment keyword "nonton" should infer Hiburan', () => {
      const result = PatternParserService.attemptPatternParse('nonton 45k');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(45000);
      expect(result.intent.description).toBe('nonton');
      
      // BUG: Currently returns null, should return "Hiburan"
      expect(result.intent.categoryHint).toBe('Hiburan');
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Education keyword "buku" should infer Pendidikan', () => {
      const result = PatternParserService.attemptPatternParse('beli buku 50k');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(50000);
      
      // BUG: Currently returns null, should return "Pendidikan"
      expect(result.intent.categoryHint).toBe('Pendidikan');
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Multiple food keywords should infer Makanan & Minuman', () => {
      const result = PatternParserService.attemptPatternParse('beli kopi di warteg 15k');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(15000);
      
      // BUG: Currently returns null even with multiple food keywords
      expect(result.intent.categoryHint).toBe('Makanan & Minuman');
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Verbless command with category keyword should infer category', () => {
      const result = PatternParserService.attemptPatternParse('kopi 5rb');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(5000);
      expect(result.intent.description).toBe('kopi');
      
      // BUG: Verbless commands also don't get automatic category inference
      expect(result.intent.categoryHint).toBe('Makanan & Minuman');
      expect(result.parseMethod).toBe('PATTERN');
    });

    test('Command with no category keywords should infer Pengeluaran Lain', () => {
      const result = PatternParserService.attemptPatternParse('bayar sesuatu 50k');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(50000);
      
      // Should explicitly infer "Pengeluaran Lain" rather than returning null
      expect(result.intent.categoryHint).toBe('Pengeluaran Lain');
      expect(result.parseMethod).toBe('PATTERN');
    });
  });

  describe('Edge Case: Explicit category keyword should still take precedence', () => {
    test('Explicit category overrides automatic inference', () => {
      const result = PatternParserService.attemptPatternParse('makan 5k kategori snack');
      
      expect(result.success).toBe(true);
      expect(result.intent.intent).toBe('EXPENSE');
      expect(result.intent.amount).toBe(5000);
      
      // Explicit "kategori snack" should override "makan" keyword inference
      expect(result.intent.categoryHint).toBe('snack');
      expect(result.parseMethod).toBe('PATTERN');
    });
  });
});
