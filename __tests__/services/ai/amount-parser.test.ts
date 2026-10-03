/**
 * Amount Parser Unit Tests
 * 
 * Tests for `parseIndonesianAmount()` utility function.
 * Verifies Indonesian monetary expression normalization.
 * 
 * Master Spec: Section 7 (AMOUNT NORMALIZATION)
 * 
 * Purpose: Ensure parser correctly handles all Indonesian monetary formats
 * without producing incorrect money values.
 */

import { describe, test, expect } from 'vitest';
import { parseIndonesianAmount } from '../../../services/ai/amount.utils';

describe('Amount Parser Unit Tests', () => {
  describe('Basic "k" suffix (thousands)', () => {
    test('"5k" → 5000', () => {
      expect(parseIndonesianAmount('5k')).toBe(5000);
    });

    test('"5K" (uppercase) → 5000', () => {
      expect(parseIndonesianAmount('5K')).toBe(5000);
    });

    test('"25k" → 25000', () => {
      expect(parseIndonesianAmount('25k')).toBe(25000);
    });

    test('"5 k" (with space) → 5000', () => {
      expect(parseIndonesianAmount('5 k')).toBe(5000);
    });
  });

  describe('"rb" suffix (ribu)', () => {
    test('"5rb" → 5000', () => {
      expect(parseIndonesianAmount('5rb')).toBe(5000);
    });

    test('"5RB" (uppercase) → 5000', () => {
      expect(parseIndonesianAmount('5RB')).toBe(5000);
    });

    test('"25rb" → 25000', () => {
      expect(parseIndonesianAmount('25rb')).toBe(25000);
    });

    test('"50rb" → 50000', () => {
      expect(parseIndonesianAmount('50rb')).toBe(50000);
    });
  });

  describe('"ribu" suffix (full word)', () => {
    test('"5 ribu" → 5000', () => {
      expect(parseIndonesianAmount('5 ribu')).toBe(5000);
    });

    test('"25 ribu" → 25000', () => {
      expect(parseIndonesianAmount('25 ribu')).toBe(25000);
    });

    test('"5ribu" (no space) → 5000', () => {
      expect(parseIndonesianAmount('5ribu')).toBe(5000);
    });
  });

  describe('"jt" suffix (juta - millions)', () => {
    test('"1jt" → 1000000', () => {
      expect(parseIndonesianAmount('1jt')).toBe(1000000);
    });

    test('"1JT" (uppercase) → 1000000', () => {
      expect(parseIndonesianAmount('1JT')).toBe(1000000);
    });

    test('"7jt" → 7000000', () => {
      expect(parseIndonesianAmount('7jt')).toBe(7000000);
    });
  });

  describe('Decimal with "jt" suffix', () => {
    test('"1,5jt" (comma decimal) → 1500000', () => {
      expect(parseIndonesianAmount('1,5jt')).toBe(1500000);
    });

    test('"1.5jt" (dot decimal) → 1500000', () => {
      expect(parseIndonesianAmount('1.5jt')).toBe(1500000);
    });

    test('"7,5jt" → 7500000', () => {
      expect(parseIndonesianAmount('7,5jt')).toBe(7500000);
    });

    test('"1,2jt" → 1200000', () => {
      expect(parseIndonesianAmount('1,2jt')).toBe(1200000);
    });

    test('"1,25jt" (two decimal places) → 1250000', () => {
      expect(parseIndonesianAmount('1,25jt')).toBe(1250000);
    });
  });

  describe('"juta" suffix (full word)', () => {
    test('"1 juta" → 1000000', () => {
      expect(parseIndonesianAmount('1 juta')).toBe(1000000);
    });

    test('"1,5 juta" (comma decimal) → 1500000', () => {
      expect(parseIndonesianAmount('1,5 juta')).toBe(1500000);
    });

    test('"1.5 juta" (dot decimal) → 1500000', () => {
      expect(parseIndonesianAmount('1.5 juta')).toBe(1500000);
    });

    test('"7,5 juta" → 7500000', () => {
      expect(parseIndonesianAmount('7,5 juta')).toBe(7500000);
    });

    test('"10 juta" → 10000000', () => {
      expect(parseIndonesianAmount('10 juta')).toBe(10000000);
    });
  });

  describe('Full numeric formats (Indonesian thousand separator)', () => {
    test('"1.500.000" (Indonesian format) → 1500000', () => {
      expect(parseIndonesianAmount('1.500.000')).toBe(1500000);
    });

    test('"25.000" → 25000', () => {
      expect(parseIndonesianAmount('25.000')).toBe(25000);
    });

    test('"7.500.000" → 7500000', () => {
      expect(parseIndonesianAmount('7.500.000')).toBe(7500000);
    });

    test('"1500000" (no separator) → 1500000', () => {
      expect(parseIndonesianAmount('1500000')).toBe(1500000);
    });

    test('"25000" (no separator) → 25000', () => {
      expect(parseIndonesianAmount('25000')).toBe(25000);
    });

    test('"5000" → 5000', () => {
      expect(parseIndonesianAmount('5000')).toBe(5000);
    });
  });

  describe('English-style formats (comma separator)', () => {
    test('"1,500,000" (English format) → 1500000', () => {
      expect(parseIndonesianAmount('1,500,000')).toBe(1500000);
    });

    test('"25,000" → 25000', () => {
      expect(parseIndonesianAmount('25,000')).toBe(25000);
    });
  });

  describe('"Rp" prefix formats', () => {
    test('"Rp25.000" → 25000', () => {
      expect(parseIndonesianAmount('Rp25.000')).toBe(25000);
    });

    test('"Rp 25.000" (with space) → 25000', () => {
      expect(parseIndonesianAmount('Rp 25.000')).toBe(25000);
    });

    test('"Rp1.500.000" → 1500000', () => {
      expect(parseIndonesianAmount('Rp1.500.000')).toBe(1500000);
    });

    test('"Rp 1.500.000" → 1500000', () => {
      expect(parseIndonesianAmount('Rp 1.500.000')).toBe(1500000);
    });

    test('"Rp25k" → 25000', () => {
      expect(parseIndonesianAmount('Rp25k')).toBe(25000);
    });

    test('"Rp 25k" → 25000', () => {
      expect(parseIndonesianAmount('Rp 25k')).toBe(25000);
    });
  });

  describe('Edge Cases: Invalid/Zero/Negative', () => {
    test('Zero: "0" → null (invalid)', () => {
      expect(parseIndonesianAmount('0')).toBe(null);
    });

    test('Zero with suffix: "0k" → null (invalid)', () => {
      expect(parseIndonesianAmount('0k')).toBe(null);
    });

    test('Negative: "-100" → null (invalid)', () => {
      expect(parseIndonesianAmount('-100')).toBe(null);
    });

    test('Negative with suffix: "-5k" → null (invalid)', () => {
      expect(parseIndonesianAmount('-5k')).toBe(null);
    });

    test('Empty string: "" → null', () => {
      expect(parseIndonesianAmount('')).toBe(null);
    });

    test('Whitespace only: "   " → null', () => {
      expect(parseIndonesianAmount('   ')).toBe(null);
    });

    test('Random text: "halo" → null', () => {
      expect(parseIndonesianAmount('halo')).toBe(null);
    });

    test('Random text: "abc123" → null', () => {
      expect(parseIndonesianAmount('abc123')).toBe(null);
    });

    test('Invalid format: "k5" → null', () => {
      expect(parseIndonesianAmount('k5')).toBe(null);
    });

    test('Invalid format: "juta 5" → null', () => {
      expect(parseIndonesianAmount('juta 5')).toBe(null);
    });
  });

  describe('Numeric input (number type)', () => {
    test('Number: 5000 → 5000', () => {
      expect(parseIndonesianAmount(5000)).toBe(5000);
    });

    test('Number: 1500000 → 1500000', () => {
      expect(parseIndonesianAmount(1500000)).toBe(1500000);
    });

    test('Number: 0 → null (invalid)', () => {
      expect(parseIndonesianAmount(0)).toBe(null);
    });

    test('Number: -100 → null (invalid)', () => {
      expect(parseIndonesianAmount(-100)).toBe(null);
    });

    test('Number: Infinity → null (invalid)', () => {
      expect(parseIndonesianAmount(Infinity)).toBe(null);
    });

    test('Number: NaN → null (invalid)', () => {
      expect(parseIndonesianAmount(NaN)).toBe(null);
    });
  });

  describe('Whitespace handling', () => {
    test('Leading whitespace: "  5k" → 5000', () => {
      expect(parseIndonesianAmount('  5k')).toBe(5000);
    });

    test('Trailing whitespace: "5k  " → 5000', () => {
      expect(parseIndonesianAmount('5k  ')).toBe(5000);
    });

    test('Both: "  25rb  " → 25000', () => {
      expect(parseIndonesianAmount('  25rb  ')).toBe(25000);
    });

    test('Excess internal space: "1,5  juta" → 1500000', () => {
      expect(parseIndonesianAmount('1,5  juta')).toBe(1500000);
    });
  });

  describe('Case insensitivity', () => {
    test('Lowercase: "rp25k" → 25000', () => {
      expect(parseIndonesianAmount('rp25k')).toBe(25000);
    });

    test('Uppercase: "RP25K" → 25000', () => {
      expect(parseIndonesianAmount('RP25K')).toBe(25000);
    });

    test('Mixed case: "Rp25K" → 25000', () => {
      expect(parseIndonesianAmount('Rp25K')).toBe(25000);
    });

    test('Uppercase: "5RIBU" → 5000', () => {
      expect(parseIndonesianAmount('5RIBU')).toBe(5000);
    });

    test('Uppercase: "1JUTA" → 1000000', () => {
      expect(parseIndonesianAmount('1JUTA')).toBe(1000000);
    });
  });

  describe('Decimal precision', () => {
    test('"1,25jt" → 1250000 (maintains precision)', () => {
      expect(parseIndonesianAmount('1,25jt')).toBe(1250000);
    });

    test('"1,75 juta" → 1750000', () => {
      expect(parseIndonesianAmount('1,75 juta')).toBe(1750000);
    });

    test('"2,33jt" → 2330000', () => {
      expect(parseIndonesianAmount('2,33jt')).toBe(2330000);
    });
  });
});

