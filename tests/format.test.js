import { describe, it, expect } from 'vitest';
import { formatRp, parseRp, THEMES, temaBerikutnya } from '../src/utils/format.js';

describe('formatRp', () => {
  it.each([
    [15000, '15.000'],
    [1500000, '1.500.000'],
    [100, '100'],
    [0, '0'],
  ])('%s -> %s', (masuk, harap) => {
    expect(formatRp(masuk)).toBe(harap);
  });

  it('mengembalikan string kosong untuk nilai tidak berarti', () => {
    expect(formatRp('')).toBe('');
    expect(formatRp(null)).toBe('');
    expect(formatRp(undefined)).toBe('');
    expect(formatRp(NaN)).toBe('');
  });
});

describe('parseRp', () => {
  it.each([
    ['15.000', 15000],
    ['1.500.000', 1500000],
    ['100', 100],
  ])('%s -> %s', (masuk, harap) => {
    expect(parseRp(masuk)).toBe(harap);
  });

  it('mengembalikan string kosong bila tidak ada angka', () => {
    expect(parseRp('')).toBe('');
    expect(parseRp('abc')).toBe('');
  });

  it('meneruskan nilai non-string apa adanya', () => {
    expect(parseRp(15000)).toBe(15000);
  });

  it('bolak-balik konsisten', () => {
    [0, 100, 15000, 1500000].forEach(n => {
      expect(parseRp(formatRp(n))).toBe(n === 0 ? 0 : n);
    });
  });
});

describe('THEMES', () => {
  it('berisi empat tema yang dipakai CSS', () => {
    // Harus sinkron dengan kelas body.theme-* di src/index.css.
    expect(THEMES).toEqual(['candy', 'bumblebee', 'neon', 'fall']);
  });
});

// =========================================================================
// PERPUTARAN TEMA
// Dipicu dua tempat: Ctrl+Panah di kiosk dan tombol TEMA di HP kasir.
// Keduanya memakai fungsi ini supaya tidak bisa berputar ke arah berbeda.
// =========================================================================
describe('temaBerikutnya', () => {
  it('maju satu langkah sesuai urutan daftar', () => {
    expect(temaBerikutnya('candy', 'next')).toBe('bumblebee');
    expect(temaBerikutnya('bumblebee', 'next')).toBe('neon');
  });

  it('mundur satu langkah', () => {
    expect(temaBerikutnya('neon', 'prev')).toBe('bumblebee');
  });

  it('berputar dari tema terakhir ke tema pertama', () => {
    expect(temaBerikutnya(THEMES[THEMES.length - 1], 'next')).toBe(THEMES[0]);
  });

  it('berputar mundur dari tema pertama ke tema terakhir', () => {
    expect(temaBerikutnya(THEMES[0], 'prev')).toBe(THEMES[THEMES.length - 1]);
  });

  // Tanpa penanganan ini, tema rusak di database membuat tombol ganti tema
  // macet: indexOf mengembalikan -1 dan hasilnya jatuh ke luar daftar.
  it.each([['tidak dikenal', 'ungu'], ['kosong', ''], ['null', null], ['undefined', undefined]])(
    'tetap menghasilkan tema sah untuk nilai %s',
    (_, nilai) => {
      expect(THEMES).toContain(temaBerikutnya(nilai, 'next'));
      expect(THEMES).toContain(temaBerikutnya(nilai, 'prev'));
    },
  );

  it('maju lalu mundur mengembalikan tema semula', () => {
    THEMES.forEach((t) => {
      expect(temaBerikutnya(temaBerikutnya(t, 'next'), 'prev')).toBe(t);
    });
  });
});
