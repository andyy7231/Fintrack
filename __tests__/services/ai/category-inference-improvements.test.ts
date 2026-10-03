import { describe, test, expect } from 'vitest';
import { inferCategoryHint } from '../../../services/ai/provider';

/**
 * Category Inference Improvements Test
 * 
 * Tests for:
 * 1. Bug fixes: Fallback "Pengeluaran Lain", Income hints match DB
 * 2. NEW category: Tempat Tinggal
 * 3. Expanded keywords for all categories
 */

describe('Category Inference - Bug Fixes & Improvements', () => {
  
  describe('BUG FIX 1: Fallback should return "Pengeluaran Lain" not "Lainnya"', () => {
    test('Unknown expense returns "Pengeluaran Lain"', () => {
      expect(inferCategoryHint('unknown item')).toBe('Pengeluaran Lain');
      expect(inferCategoryHint('xyz abc 123')).toBe('Pengeluaran Lain');
    });
  });

  describe('BUG FIX 2: NEW CATEGORY - Tempat Tinggal', () => {
    test('kos/kost keywords', () => {
      expect(inferCategoryHint('bayar kos 1.2jt')).toBe('Tempat Tinggal');
      expect(inferCategoryHint('bayar kost 1500000')).toBe('Tempat Tinggal');
      expect(inferCategoryHint(' kos 1jt')).toBe('Tempat Tinggal');
      expect(inferCategoryHint('kos ')).toBe('Tempat Tinggal');
    });

    test('kontrakan/sewa rumah phrases', () => {
      expect(inferCategoryHint('sewa rumah 2jt')).toBe('Tempat Tinggal');
      expect(inferCategoryHint('kontrakan 1.5jt')).toBe('Tempat Tinggal');
      expect(inferCategoryHint('rumah kontrakan')).toBe('Tempat Tinggal');
      expect(inferCategoryHint('sewa kos')).toBe('Tempat Tinggal');
    });
  });

  describe('Expanded Keywords - Makanan & Minuman', () => {
    test('NEW: beverages', () => {
      expect(inferCategoryHint('beli teh 5rb')).toBe('Makanan & Minuman');
      expect(inferCategoryHint('es teh 10k')).toBe('Makanan & Minuman');
      expect(inferCategoryHint(' es ')).toBe('Makanan & Minuman');
    });

    test('NEW: Indonesian dishes', () => {
      expect(inferCategoryHint('gorengan 10k')).toBe('Makanan & Minuman');
      expect(inferCategoryHint('martabak manis 35k')).toBe('Makanan & Minuman');
      expect(inferCategoryHint('soto ayam 20k')).toBe('Makanan & Minuman');
      expect(inferCategoryHint('gado-gado 15k')).toBe('Makanan & Minuman');
      expect(inferCategoryHint('rendang 40k')).toBe('Makanan & Minuman');
      expect(inferCategoryHint('pecel lele 25k')).toBe('Makanan & Minuman');
    });

    test('NEW: snacking & delivery', () => {
      expect(inferCategoryHint('ngemil 20k')).toBe('Makanan & Minuman');
      expect(inferCategoryHint('cemilan 15k')).toBe('Makanan & Minuman');
      expect(inferCategoryHint('kantin 30k')).toBe('Makanan & Minuman');
      expect(inferCategoryHint('delivery makanan 50k')).toBe('Makanan & Minuman');
      expect(inferCategoryHint('pesan makanan')).toBe('Makanan & Minuman');
      expect(inferCategoryHint('gofood 45k')).toBe('Makanan & Minuman');
      expect(inferCategoryHint('go food')).toBe('Makanan & Minuman');
      expect(inferCategoryHint('grabfood 40k')).toBe('Makanan & Minuman');
    });

    test('NEW: meal times', () => {
      expect(inferCategoryHint('makan siang 30k')).toBe('Makanan & Minuman');
      expect(inferCategoryHint('makan malam 50k')).toBe('Makanan & Minuman');
    });
  });

  describe('Expanded Keywords - Transportasi', () => {
    test('NEW: vehicles with space padding', () => {
      expect(inferCategoryHint('servis motor 200k')).toBe('Transportasi');
      expect(inferCategoryHint('cuci mobil 50k')).toBe('Transportasi');
      expect(inferCategoryHint(' motor 100k')).toBe('Transportasi');
      expect(inferCategoryHint('motor ')).toBe('Transportasi');
    });

    test('NEW: public transport', () => {
      expect(inferCategoryHint('naik kereta 10k')).toBe('Transportasi');
      expect(inferCategoryHint('mrt 5k')).toBe('Transportasi');
      expect(inferCategoryHint('krl commuterline')).toBe('Transportasi');
      expect(inferCategoryHint('angkot 5k')).toBe('Transportasi');
      expect(inferCategoryHint('taksi 50k')).toBe('Transportasi');
      expect(inferCategoryHint('uber 35k')).toBe('Transportasi');
    });

    test('NEW: vehicle maintenance', () => {
      expect(inferCategoryHint('cuci motor')).toBe('Transportasi');
      expect(inferCategoryHint('isi angin')).toBe('Transportasi');
      expect(inferCategoryHint('servis mobil')).toBe('Transportasi');
    });
  });

  describe('Expanded Keywords - Tagihan & Utilitas', () => {
    test('NEW: contextual phrases', () => {
      expect(inferCategoryHint('bayar air 100k')).toBe('Tagihan & Utilitas');
      expect(inferCategoryHint('tagihan air pdam')).toBe('Tagihan & Utilitas');
      expect(inferCategoryHint('beli galon')).toBe('Tagihan & Utilitas');
      expect(inferCategoryHint('gas lpg 20k')).toBe('Tagihan & Utilitas');
      expect(inferCategoryHint('bayar listrik pln')).toBe('Tagihan & Utilitas');
      expect(inferCategoryHint('telepon 50k')).toBe('Tagihan & Utilitas');
    });
  });

  describe('Expanded Keywords - Belanja', () => {
    test('NEW: e-commerce platforms', () => {
      expect(inferCategoryHint('lazada 150k')).toBe('Belanja');
      expect(inferCategoryHint('blibli shopping')).toBe('Belanja');
      expect(inferCategoryHint('bukalapak')).toBe('Belanja');
      expect(inferCategoryHint('jd.id')).toBe('Belanja');
    });

    test('NEW: items with space padding', () => {
      expect(inferCategoryHint('beli tas 200k')).toBe('Belanja');
      expect(inferCategoryHint(' tas 150k')).toBe('Belanja');
      expect(inferCategoryHint('jam tangan')).toBe('Belanja');
    });

    test('NEW: household items', () => {
      expect(inferCategoryHint('sampo 25k')).toBe('Belanja');
      expect(inferCategoryHint('shampoo')).toBe('Belanja');
      expect(inferCategoryHint('deterjen')).toBe('Belanja');
      expect(inferCategoryHint('tisu')).toBe('Belanja');
      expect(inferCategoryHint('supermarket')).toBe('Belanja');
      expect(inferCategoryHint('minimarket')).toBe('Belanja');
    });
  });

  describe('Expanded Keywords - Kesehatan', () => {
    test('NEW: healthcare facilities', () => {
      expect(inferCategoryHint('rumah sakit 500k')).toBe('Kesehatan');
      expect(inferCategoryHint(' rs 200k')).toBe('Kesehatan');
      expect(inferCategoryHint('puskesmas 50k')).toBe('Kesehatan');
      expect(inferCategoryHint('cek lab 150k')).toBe('Kesehatan');
      expect(inferCategoryHint('laboratorium')).toBe('Kesehatan');
    });

    test('NEW: medical services', () => {
      expect(inferCategoryHint('rontgen 200k')).toBe('Kesehatan');
      expect(inferCategoryHint('tes covid')).toBe('Kesehatan');
      expect(inferCategoryHint('imunisasi anak')).toBe('Kesehatan');
      expect(inferCategoryHint('susu formula')).toBe('Kesehatan');
      expect(inferCategoryHint('popok bayi')).toBe('Kesehatan');
    });
  });

  describe('Expanded Keywords - Hiburan', () => {
    test('NEW: streaming services', () => {
      expect(inferCategoryHint('youtube premium')).toBe('Hiburan');
      expect(inferCategoryHint('disney+')).toBe('Hiburan');
      expect(inferCategoryHint('disney plus')).toBe('Hiburan');
      expect(inferCategoryHint('hbo max')).toBe('Hiburan');
      expect(inferCategoryHint('viu')).toBe('Hiburan');
    });

    test('NEW: gaming consoles', () => {
      expect(inferCategoryHint('playstation 5')).toBe('Hiburan');
      expect(inferCategoryHint('ps5')).toBe('Hiburan');
      expect(inferCategoryHint('nintendo switch')).toBe('Hiburan');
      expect(inferCategoryHint('xbox')).toBe('Hiburan');
    });

    test('NEW: entertainment activities', () => {
      expect(inferCategoryHint('tiket konser')).toBe('Hiburan');
      expect(inferCategoryHint('wisata')).toBe('Hiburan');
      expect(inferCategoryHint('liburan')).toBe('Hiburan');
      expect(inferCategoryHint('karaoke')).toBe('Hiburan');
    });
  });

  describe('Expanded Keywords - Pendidikan', () => {
    test('NEW: education expenses', () => {
      expect(inferCategoryHint('bayar kuliah')).toBe('Pendidikan');
      expect(inferCategoryHint('kampus')).toBe('Pendidikan');
      expect(inferCategoryHint('semester')).toBe('Pendidikan');
      expect(inferCategoryHint('uang gedung')).toBe('Pendidikan');
      expect(inferCategoryHint('seragam sekolah')).toBe('Pendidikan');
    });

    test('NEW: stationery & services', () => {
      expect(inferCategoryHint('alat tulis')).toBe('Pendidikan');
      expect(inferCategoryHint('atk')).toBe('Pendidikan');
      expect(inferCategoryHint('print tugas')).toBe('Pendidikan');
      expect(inferCategoryHint('fotokopi')).toBe('Pendidikan');
      expect(inferCategoryHint('jilid skripsi')).toBe('Pendidikan');
    });
  });

  describe('Existing Keywords - Regression', () => {
    test('Original keywords still work', () => {
      expect(inferCategoryHint('beli kopi')).toBe('Makanan & Minuman');
      expect(inferCategoryHint('bensin 50k')).toBe('Transportasi');
      expect(inferCategoryHint('bayar listrik')).toBe('Tagihan & Utilitas');
      expect(inferCategoryHint('shopee')).toBe('Belanja');
      expect(inferCategoryHint('obat')).toBe('Kesehatan');
      expect(inferCategoryHint('netflix')).toBe('Hiburan');
      expect(inferCategoryHint('buku')).toBe('Pendidikan');
    });
  });
});
