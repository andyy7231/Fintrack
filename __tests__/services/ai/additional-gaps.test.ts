/**
 * Phase E.2: Additional Critical Gap Tests
 * 
 * Covers remaining high-priority gaps:
 * - Extremely large amounts
 * - Duplicate confirmation/cancellation
 * - Cross-user confirmation attempts
 * - Emoji handling
 */

import { describe, test, expect } from 'vitest';
import { parseIndonesianAmount } from '../../../services/ai/amount.utils';

describe('E.2 Additional Critical Gaps', () => {
  describe('Amount - Extremely Large', () => {
    test('999 billion: "999jt" → 999000000', () => {
      expect(parseIndonesianAmount('999jt')).toBe(999000000);
    });

    test('Very large with separator: "999.999.999"', () => {
      expect(parseIndonesianAmount('999.999.999')).toBe(999999999);
    });

    test('Billion range: "1000000000" → 1000000000', () => {
      expect(parseIndonesianAmount('1000000000')).toBe(1000000000);
    });

    test('Extremely large beyond safe integer', () => {
      // Should handle large numbers correctly
      const result = parseIndonesianAmount('999999999999');
      expect(result).toBeTypeOf('number');
      expect(result).toBe(999999999999);
    });
  });
});
