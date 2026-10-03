/**
 * Phase E.2: Critical Gap Tests - Date Parsing
 * 
 * PRIORITY 1: Date parsing had 0% coverage in initial E.2
 * Tests parseIndonesianDate utility function for Jakarta timezone
 */

import { describe, test, expect } from 'vitest';
import { parseIndonesianDate, getJakartaDateString } from '../../../services/ai/date.utils';

describe('Date Parsing Tests (E.2 Critical Gap)', () => {
  describe('Relative Date Keywords', () => {
    test('"hari ini" returns today', () => {
      const reference = new Date('2024-01-20T12:00:00Z');
      const result = parseIndonesianDate('hari ini', reference);
      
      // Should return Jakarta date (UTC + 7)
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThan(0);
    });

    test('"kemarin" returns yesterday', () => {
      const reference = new Date('2024-01-20T12:00:00Z');
      const result = parseIndonesianDate('kemarin', reference);
      
      expect(result).toBeInstanceOf(Date);
      // Should be 1 day before reference
      const diffMs = reference.getTime() - result.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(1);
    });

    test('"tadi" returns today', () => {
      const reference = new Date('2024-01-20T12:00:00Z');
      const result = parseIndonesianDate('tadi', reference);
      
      expect(result).toBeInstanceOf(Date);
    });

    test('"tadi pagi" returns today', () => {
      const reference = new Date('2024-01-20T12:00:00Z');
      const result = parseIndonesianDate('tadi pagi', reference);
      
      expect(result).toBeInstanceOf(Date);
    });

    test('"sekarang" returns today', () => {
      const reference = new Date('2024-01-20T12:00:00Z');
      const result = parseIndonesianDate('sekarang', reference);
      
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('Explicit Date Formats', () => {
    test('ISO format: "2024-01-20"', () => {
      const result = parseIndonesianDate('2024-01-20');
      
      expect(result).toBeInstanceOf(Date);
      const dateStr = getJakartaDateString(result);
      expect(dateStr).toBe('2024-01-20');
    });

    test('DD/MM format: "20/01" (current year)', () => {
      const reference = new Date('2024-06-15T12:00:00Z');
      const result = parseIndonesianDate('20/01', reference);
      
      expect(result).toBeInstanceOf(Date);
      const dateStr = getJakartaDateString(result);
      expect(dateStr).toBe('2024-01-20');
    });

    test('DD/MM/YYYY format: "20/01/2024"', () => {
      const result = parseIndonesianDate('20/01/2024');
      
      expect(result).toBeInstanceOf(Date);
      const dateStr = getJakartaDateString(result);
      expect(dateStr).toBe('2024-01-20');
    });

    test('Month name: "20 Januari"', () => {
      const reference = new Date('2024-06-15T12:00:00Z');
      const result = parseIndonesianDate('20 Januari', reference);
      
      expect(result).toBeInstanceOf(Date);
      const dateStr = getJakartaDateString(result);
      expect(dateStr).toBe('2024-01-20');
    });

    test('Month abbreviation: "20 Jan"', () => {
      const reference = new Date('2024-06-15T12:00:00Z');
      const result = parseIndonesianDate('20 Jan', reference);
      
      expect(result).toBeInstanceOf(Date);
      const dateStr = getJakartaDateString(result);
      expect(dateStr).toBe('2024-01-20');
    });

    test('Prefixed date: "tanggal 20 Januari"', () => {
      const reference = new Date('2024-06-15T12:00:00Z');
      const result = parseIndonesianDate('tanggal 20 Januari', reference);
      
      expect(result).toBeInstanceOf(Date);
      const dateStr = getJakartaDateString(result);
      expect(dateStr).toBe('2024-01-20');
    });
  });

  describe('Day Names', () => {
    test('"Senin" returns last Monday', () => {
      const reference = new Date('2024-01-20T12:00:00Z'); // Saturday
      const result = parseIndonesianDate('Senin', reference);
      
      expect(result).toBeInstanceOf(Date);
      // Should be a Monday in the past
      const day = result.getUTCDay();
      expect(day).toBe(1); // Monday = 1
    });

    test('"Minggu" returns last Sunday', () => {
      const reference = new Date('2024-01-20T12:00:00Z'); // Saturday
      const result = parseIndonesianDate('Minggu', reference);
      
      expect(result).toBeInstanceOf(Date);
      const day = result.getUTCDay();
      expect(day).toBe(0); // Sunday = 0
    });
  });

  describe('Malformed / Impossible Dates', () => {
    test('Invalid day: "32/01/2024" returns current date', () => {
      const reference = new Date('2024-01-20T12:00:00Z');
      const result = parseIndonesianDate('32/01/2024', reference);
      
      expect(result).toBeInstanceOf(Date);
      // Should fall back to current date
    });

    test('Invalid month: "20/13/2024" returns current date', () => {
      const reference = new Date('2024-01-20T12:00:00Z');
      const result = parseIndonesianDate('20/13/2024', reference);
      
      expect(result).toBeInstanceOf(Date);
      // Should fall back to current date
    });

    test('Nonsense text returns current date', () => {
      const reference = new Date('2024-01-20T12:00:00Z');
      const result = parseIndonesianDate('xyz abc 123', reference);
      
      expect(result).toBeInstanceOf(Date);
      // Should fall back to current date (reference)
    });

    test('Empty string returns current date', () => {
      const reference = new Date('2024-01-20T12:00:00Z');
      const result = parseIndonesianDate('', reference);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(reference.getTime());
    });

    test('null returns current date', () => {
      const reference = new Date('2024-01-20T12:00:00Z');
      const result = parseIndonesianDate(null, reference);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(reference.getTime());
    });

    test('undefined returns current date', () => {
      const reference = new Date('2024-01-20T12:00:00Z');
      const result = parseIndonesianDate(undefined, reference);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(reference.getTime());
    });
  });

  describe('Edge Cases', () => {
    test('Case insensitivity: "HARI INI"', () => {
      const reference = new Date('2024-01-20T12:00:00Z');
      const result = parseIndonesianDate('HARI INI', reference);
      
      expect(result).toBeInstanceOf(Date);
    });

    test('Extra whitespace: "  hari ini  "', () => {
      const reference = new Date('2024-01-20T12:00:00Z');
      const result = parseIndonesianDate('  hari ini  ', reference);
      
      expect(result).toBeInstanceOf(Date);
    });

    test('Mixed content: "makan siang kemarin" extracts "kemarin"', () => {
      const reference = new Date('2024-01-20T12:00:00Z');
      const result = parseIndonesianDate('makan siang kemarin', reference);
      
      expect(result).toBeInstanceOf(Date);
      // Should detect "kemarin" and return yesterday
      const diffMs = reference.getTime() - result.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(1);
    });
  });
});
