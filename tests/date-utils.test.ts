/**
 * Unit tests for date extraction utilities
 * Tests Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { describe, it, expect } from 'vitest';
import {
  parseIndonesianDate,
  getJakartaDateString,
  jakartaDateToUtc,
} from '../services/ai/date.utils';
import { hasComplexDateExpression } from '../services/ai/regex.utils';

describe('Date Extraction Utilities', () => {
  describe('parseIndonesianDate - Relative Date Keywords', () => {
    it('should parse "hari ini" to today', () => {
      const result = parseIndonesianDate('hari ini');
      const today = getJakartaDateString();
      const resultDateStr = getJakartaDateString(result);
      expect(resultDateStr).toBe(today);
    });

    it('should parse "tadi" to today', () => {
      const result = parseIndonesianDate('tadi');
      const today = getJakartaDateString();
      const resultDateStr = getJakartaDateString(result);
      expect(resultDateStr).toBe(today);
    });

    it('should parse "tadi pagi" to today', () => {
      const result = parseIndonesianDate('tadi pagi');
      const today = getJakartaDateString();
      const resultDateStr = getJakartaDateString(result);
      expect(resultDateStr).toBe(today);
    });

    it('should parse "tadi siang" to today', () => {
      const result = parseIndonesianDate('tadi siang');
      const today = getJakartaDateString();
      const resultDateStr = getJakartaDateString(result);
      expect(resultDateStr).toBe(today);
    });

    it('should parse "tadi sore" to today', () => {
      const result = parseIndonesianDate('tadi sore');
      const today = getJakartaDateString();
      const resultDateStr = getJakartaDateString(result);
      expect(resultDateStr).toBe(today);
    });

    it('should parse "kemarin" to yesterday', () => {
      const result = parseIndonesianDate('kemarin');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const expectedDateStr = getJakartaDateString(yesterday);
      const resultDateStr = getJakartaDateString(result);
      expect(resultDateStr).toBe(expectedDateStr);
    });

    it('should parse "kemarin lusa" to 2 days ago', () => {
      const result = parseIndonesianDate('kemarin lusa');
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const expectedDateStr = getJakartaDateString(twoDaysAgo);
      const resultDateStr = getJakartaDateString(result);
      expect(resultDateStr).toBe(expectedDateStr);
    });
  });

  describe('parseIndonesianDate - Day Names', () => {
    const dayNames = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];

    dayNames.forEach((dayName) => {
      it(`should parse "${dayName}" to most recent past occurrence`, () => {
        const result = parseIndonesianDate(dayName);
        const resultDateStr = getJakartaDateString(result);
        
        // Should be a valid date string
        expect(resultDateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        
        // Should be in the past (or today at most)
        const today = new Date();
        expect(result.getTime()).toBeLessThanOrEqual(today.getTime());
      });
    });
  });

  describe('parseIndonesianDate - Absolute Date Formats', () => {
    it('should parse ISO date format "2024-01-20"', () => {
      const result = parseIndonesianDate('2024-01-20');
      const resultDateStr = getJakartaDateString(result);
      expect(resultDateStr).toBe('2024-01-20');
    });

    it('should parse "DD Month" format like "20 Januari"', () => {
      const result = parseIndonesianDate('20 Januari');
      const resultDateStr = getJakartaDateString(result);
      
      // Should be January 20th of current year
      const currentYear = new Date().getFullYear();
      expect(resultDateStr).toContain(`${currentYear}-01-20`);
    });

    it('should parse "DD Month" format with abbreviated month like "20 Jan"', () => {
      const result = parseIndonesianDate('20 Jan');
      const resultDateStr = getJakartaDateString(result);
      
      const currentYear = new Date().getFullYear();
      expect(resultDateStr).toContain(`${currentYear}-01-20`);
    });

    it('should parse DD/MM format like "20/01"', () => {
      const result = parseIndonesianDate('20/01');
      const resultDateStr = getJakartaDateString(result);
      
      // Should be January 20th of current year
      const currentYear = new Date().getFullYear();
      expect(resultDateStr).toBe(`${currentYear}-01-20`);
    });

    it('should parse DD/MM/YYYY format like "20/01/2024"', () => {
      const result = parseIndonesianDate('20/01/2024');
      const resultDateStr = getJakartaDateString(result);
      expect(resultDateStr).toBe('2024-01-20');
    });

    it('should parse DD/MM/YY format like "20/01/24" (2-digit year)', () => {
      const result = parseIndonesianDate('20/01/24');
      const resultDateStr = getJakartaDateString(result);
      expect(resultDateStr).toBe('2024-01-20');
    });

    it('should handle all Indonesian month names', () => {
      const monthTests = [
        { name: 'Januari', expected: '01' },
        { name: 'Februari', expected: '02' },
        { name: 'Maret', expected: '03' },
        { name: 'April', expected: '04' },
        { name: 'Mei', expected: '05' },
        { name: 'Juni', expected: '06' },
        { name: 'Juli', expected: '07' },
        { name: 'Agustus', expected: '08' },
        { name: 'September', expected: '09' },
        { name: 'Oktober', expected: '10' },
        { name: 'November', expected: '11' },
        { name: 'Desember', expected: '12' },
      ];

      monthTests.forEach(({ name, expected }) => {
        const result = parseIndonesianDate(`15 ${name}`);
        const resultDateStr = getJakartaDateString(result);
        expect(resultDateStr).toContain(`-${expected}-15`);
      });
    });
  });

  describe('parseIndonesianDate - Default Behavior', () => {
    it('should default to today when no date expression found', () => {
      const result = parseIndonesianDate('beli kopi 25rb');
      const today = getJakartaDateString();
      const resultDateStr = getJakartaDateString(result);
      expect(resultDateStr).toBe(today);
    });

    it('should default to referenceDate when provided and no expression found', () => {
      const refDate = new Date('2024-01-15T12:00:00Z');
      const result = parseIndonesianDate('beli kopi', refDate);
      const resultDateStr = getJakartaDateString(result);
      expect(resultDateStr).toBe('2024-01-15');
    });
  });

  describe('hasComplexDateExpression - Complex Relative Dates', () => {
    it('should detect "X hari yang lalu" as complex', () => {
      expect(hasComplexDateExpression('3 hari yang lalu beli kopi')).toBe(true);
      expect(hasComplexDateExpression('5 hari yang lalu')).toBe(true);
    });

    it('should detect "X minggu yang lalu" as complex', () => {
      expect(hasComplexDateExpression('2 minggu yang lalu')).toBe(true);
    });

    it('should detect "X bulan yang lalu" as complex', () => {
      expect(hasComplexDateExpression('5 bulan yang lalu')).toBe(true);
    });

    it('should detect time specifications like "jam X" as complex', () => {
      expect(hasComplexDateExpression('kemarin jam 3 sore')).toBe(true);
      expect(hasComplexDateExpression('tadi jam 10 pagi')).toBe(true);
    });

    it('should detect "pukul X" as complex', () => {
      expect(hasComplexDateExpression('kemarin pukul 15:00')).toBe(true);
    });
  });

  describe('hasComplexDateExpression - Ambiguous Modifiers', () => {
    it('should detect "kayaknya" as ambiguous', () => {
      expect(hasComplexDateExpression('kayaknya kemarin beli kopi')).toBe(true);
    });

    it('should detect "mungkin" as ambiguous', () => {
      expect(hasComplexDateExpression('mungkin tadi siang')).toBe(true);
    });

    it('should detect "sekitar" as ambiguous', () => {
      expect(hasComplexDateExpression('sekitar kemarin')).toBe(true);
    });

    it('should detect "kira-kira" as ambiguous', () => {
      expect(hasComplexDateExpression('kira-kira kemarin')).toBe(true);
      expect(hasComplexDateExpression('kirakira kemarin')).toBe(true);
    });

    it('should detect "sepertinya" as ambiguous', () => {
      expect(hasComplexDateExpression('sepertinya hari ini')).toBe(true);
    });
  });

  describe('hasComplexDateExpression - Future Dates', () => {
    it('should detect "besok" as future date', () => {
      expect(hasComplexDateExpression('besok beli kopi')).toBe(true);
    });

    it('should detect "lusa" as future date', () => {
      expect(hasComplexDateExpression('lusa mau beli')).toBe(true);
    });

    it('should detect "minggu depan" as future date', () => {
      expect(hasComplexDateExpression('minggu depan')).toBe(true);
    });

    it('should detect "bulan depan" as future date', () => {
      expect(hasComplexDateExpression('bulan depan')).toBe(true);
    });

    it('should detect "tahun depan" as future date', () => {
      expect(hasComplexDateExpression('tahun depan')).toBe(true);
    });

    it('should detect "X hari lagi" as future date', () => {
      expect(hasComplexDateExpression('3 hari lagi')).toBe(true);
    });
  });

  describe('hasComplexDateExpression - Simple Date Cases (Should Return False)', () => {
    it('should NOT detect "hari ini" as complex', () => {
      expect(hasComplexDateExpression('hari ini beli kopi 25rb')).toBe(false);
    });

    it('should NOT detect "kemarin" as complex', () => {
      expect(hasComplexDateExpression('kemarin beli kopi')).toBe(false);
    });

    it('should NOT detect "tadi pagi" as complex', () => {
      expect(hasComplexDateExpression('tadi pagi bayar parkir')).toBe(false);
    });

    it('should NOT detect day names as complex', () => {
      expect(hasComplexDateExpression('senin beli kopi')).toBe(false);
      expect(hasComplexDateExpression('rabu bayar parkir')).toBe(false);
    });

    it('should NOT detect absolute dates as complex', () => {
      expect(hasComplexDateExpression('20 Januari beli kopi')).toBe(false);
      expect(hasComplexDateExpression('20/01 bayar parkir')).toBe(false);
      expect(hasComplexDateExpression('2024-01-20 gaji')).toBe(false);
    });

    it('should NOT detect commands without date as complex', () => {
      expect(hasComplexDateExpression('beli kopi 25rb')).toBe(false);
      expect(hasComplexDateExpression('gaji 10jt')).toBe(false);
    });
  });

  describe('Date Extraction Idempotence', () => {
    it('should return same date for repeated extractions within same day', () => {
      const text = 'beli kopi 25rb hari ini';
      const date1 = parseIndonesianDate(text);
      const date2 = parseIndonesianDate(text);
      
      const dateStr1 = getJakartaDateString(date1);
      const dateStr2 = getJakartaDateString(date2);
      
      expect(dateStr1).toBe(dateStr2);
    });
  });

  describe('Date Extraction Validity', () => {
    it('should produce valid ISO date strings for all common keywords', () => {
      const keywords = [
        'hari ini',
        'kemarin',
        'tadi',
        'tadi pagi',
        'tadi siang',
        'senin',
        'selasa',
        'rabu',
        'kamis',
        'jumat',
        'sabtu',
        'minggu',
      ];

      keywords.forEach((keyword) => {
        const result = parseIndonesianDate(keyword);
        const dateStr = getJakartaDateString(result);
        
        // Should match ISO date format YYYY-MM-DD
        expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        
        // Should be a valid date
        const parsed = new Date(dateStr);
        expect(parsed.toString()).not.toBe('Invalid Date');
      });
    });
  });
});
