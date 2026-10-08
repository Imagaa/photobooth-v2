import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  getEventTemplatePrice, getUpsellUnitPrice, validateUpsellQty,
  resolvePaymentMethod, MAX_UPSELL_QTY,
} = require('../electron/pricing.js');

describe('harga frame per event', () => {
  const snapshot = JSON.stringify([
    { id: 1, override_price: 15000 },
    { id: 2, override_price: 0 },
  ]);

  it('memakai harga override milik event', () => {
    expect(getEventTemplatePrice(snapshot, 1)).toBe(15000);
  });

  it('mencocokkan id walau tipenya berbeda', () => {
    // Renderer bisa mengirim id sebagai string.
    expect(getEventTemplatePrice(snapshot, '1')).toBe(15000);
  });

  it('harga nol tetap dianggap terdaftar, bukan tidak ada', () => {
    expect(getEventTemplatePrice(snapshot, 2)).toBe(0);
  });

  it('menolak template yang tidak terdaftar pada event', () => {
    // Inilah yang mencegah renderer memilih frame di luar daftar event.
    expect(getEventTemplatePrice(snapshot, 99)).toBeNull();
  });

  it.each([
    ['JSON rusak', '{rusak'],
    ['bukan array', '{"a":1}'],
    ['kosong', ''],
    ['null', null],
  ])('tidak melempar saat %s', (_l, json) => {
    expect(() => getEventTemplatePrice(json, 1)).not.toThrow();
    expect(getEventTemplatePrice(json, 1)).toBeNull();
  });
});

describe('harga cetak tambahan (upsell)', () => {
  const eventAktif = { upsell_enabled: 1, upsell_price: 0 };

  it('mengembalikan null bila upsell tidak diaktifkan', () => {
    expect(getUpsellUnitPrice({ harga_jual: 15000 }, { upsell_enabled: 0 })).toBeNull();
    expect(getUpsellUnitPrice({ harga_jual: 15000 }, null)).toBeNull();
  });

  it('memakai harga khusus upsell bila diisi', () => {
    expect(getUpsellUnitPrice({ harga_jual: 15000 }, { upsell_enabled: 1, upsell_price: 5000 })).toBe(5000);
  });

  it('harga khusus 0 berarti ikut harga awal, bukan gratis', () => {
    // Ini titik yang mudah disalahpahami: 0 = "warisi", bukan "gratis".
    expect(getUpsellUnitPrice({ harga_jual: 15000 }, eventAktif)).toBe(15000);
  });

  it('menelusuri ke sesi induk untuk baris retake', () => {
    // Tanpa ini, pelanggan dapat cetak tambahan gratis hanya karena sesinya
    // kebetulan hasil retake (yang harganya memang 0).
    const induk = { 5: { harga_jual: 20000 } };
    const harga = getUpsellUnitPrice(
      { harga_jual: 0, retake_of: 5 }, eventAktif, (id) => induk[id]
    );
    expect(harga).toBe(20000);
  });

  it('mengembalikan 0 bila sesi induk tidak ditemukan', () => {
    expect(getUpsellUnitPrice({ harga_jual: 0, retake_of: 99 }, eventAktif, () => null)).toBe(0);
  });

  it('event gratis menghasilkan 0', () => {
    expect(getUpsellUnitPrice({ harga_jual: 0 }, eventAktif)).toBe(0);
  });
});

describe('validasi jumlah cetak tambahan', () => {
  it.each([1, 5, MAX_UPSELL_QTY])('menerima %s', (n) => {
    expect(validateUpsellQty(n).valid).toBe(true);
  });

  it.each([0, -1, MAX_UPSELL_QTY + 1, 'abc', null, 1.5])('menolak %s', (n) => {
    expect(validateUpsellQty(n).valid).toBe(false);
  });

  it('menerima angka dalam bentuk string', () => {
    expect(validateUpsellQty('3')).toEqual({ valid: true, qty: 3 });
  });
});

describe('penentuan metode pembayaran', () => {
  it('nominal nol tetap butuh persetujuan kasir, bukan lolos otomatis', () => {
    // Kalau nol lolos otomatis, cetak tambahan pada event gratis bisa diambil
    // tanpa batas oleh siapa pun.
    expect(resolvePaymentMethod({ total: 0, appMode: 'online' })).toBe('manual');
  });

  it('mode offline memakai verifikasi kasir', () => {
    expect(resolvePaymentMethod({ total: 15000, appMode: 'offline' })).toBe('manual');
  });

  it('paksa QR statis mengalahkan mode online', () => {
    expect(resolvePaymentMethod({ total: 15000, appMode: 'online', forceStaticQr: 1 })).toBe('manual');
  });

  it('mode online memakai Midtrans', () => {
    expect(resolvePaymentMethod({ total: 15000, appMode: 'online', forceStaticQr: 0 })).toBe('midtrans');
  });
});
