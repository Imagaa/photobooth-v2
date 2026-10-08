import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

// secrets.js meng-import `safeStorage` dari Electron, yang tidak tersedia di
// runner biasa. Fungsi PIN dan masking sama sekali tidak memakainya, jadi
// modul Electron cukup di-stub agar berkasnya bisa dimuat.
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s) => Buffer.from(s),
    decryptString: (b) => b.toString(),
  },
}));

const require = createRequire(import.meta.url);
const secrets = require('../electron/secrets.js');

describe('secrets: PIN admin', () => {
  it('menyimpan sebagai salt:hash, bukan angka polos', () => {
    const hash = secrets.hashPin('1234');
    expect(hash).toMatch(/^[a-f0-9]{32}:[a-f0-9]{64}$/);
    expect(hash).not.toContain('1234');
  });

  it('salt berbeda setiap kali, sehingga hash tidak identik', () => {
    // Tanpa salt acak, dua kiosk dengan PIN sama punya hash sama dan
    // rentan terhadap rainbow table.
    expect(secrets.hashPin('1234')).not.toBe(secrets.hashPin('1234'));
  });

  it('menerima PIN yang benar', () => {
    expect(secrets.verifyPin('1234', secrets.hashPin('1234'))).toBe(true);
  });

  it.each([
    ['PIN salah', '9999'],
    ['PIN kosong', ''],
    ['awalan benar tapi kurang', '123'],
    ['imbuhan di belakang', '12345'],
  ])('menolak %s', (_label, pin) => {
    expect(secrets.verifyPin(pin, secrets.hashPin('1234'))).toBe(false);
  });

  it.each([
    ['hash kosong', ''],
    ['hash tanpa pemisah', 'sampah'],
    ['hash null', null],
    ['hex tidak valid', 'zz:zz'],
  ])('menolak %s tanpa melempar', (_label, hash) => {
    expect(() => secrets.verifyPin('1234', hash)).not.toThrow();
    expect(secrets.verifyPin('1234', hash)).toBe(false);
  });

  it('memperlakukan PIN sebagai string walau diberi angka', () => {
    expect(secrets.verifyPin(1234, secrets.hashPin('1234'))).toBe(true);
  });
});

describe('secrets: masking', () => {
  it('hanya menampilkan empat karakter terakhir', () => {
    const hasil = secrets.maskSecret('Mid-server-AbCdEfGh1234');
    expect(hasil).toContain('1234');
    expect(hasil).not.toContain('Mid-server');
    expect(hasil).not.toContain('AbCdEfGh');
  });

  it('menyamarkan seluruhnya bila terlalu pendek', () => {
    expect(secrets.maskSecret('abc')).toBe('****');
  });

  it('mengembalikan string kosong untuk nilai kosong', () => {
    expect(secrets.maskSecret('')).toBe('');
    expect(secrets.maskSecret(null)).toBe('');
  });
});

describe('secrets: penanda terenkripsi', () => {
  it('mengenali nilai yang sudah dienkripsi', () => {
    expect(secrets.isEncrypted('enc:v1:AAAA')).toBe(true);
  });

  it('mengenali nilai lama yang masih plaintext', () => {
    // Dipakai migrasi startup untuk memutuskan mana yang perlu dienkripsi.
    expect(secrets.isEncrypted('Mid-server-xxx')).toBe(false);
    expect(secrets.isEncrypted('')).toBe(false);
    expect(secrets.isEncrypted(null)).toBe(false);
  });
});
