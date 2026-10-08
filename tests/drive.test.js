import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const drive = require('../electron/drive.js');

describe('drive: PKCE', () => {
  it('challenge adalah SHA-256 base64url dari verifier', () => {
    const { verifier, challenge } = drive.createPkce();
    const harap = crypto.createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(harap);
  });

  it('verifier aman untuk URL dan cukup panjang', () => {
    const { verifier } = drive.createPkce();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    // RFC 7636 mensyaratkan 43-128 karakter.
    expect(verifier.length).toBeGreaterThanOrEqual(43);
  });

  it('menghasilkan nilai berbeda setiap dipanggil', () => {
    expect(drive.createPkce().verifier).not.toBe(drive.createPkce().verifier);
  });
});

describe('drive: URL otorisasi', () => {
  const buat = () => {
    const { challenge } = drive.createPkce();
    return new URL(drive.buildAuthUrl({
      clientId: 'abc.apps.googleusercontent.com',
      redirectUri: 'http://127.0.0.1:3000/oauth2callback',
      challenge,
      state: 'state-acak',
    }));
  };

  it('menunjuk endpoint resmi Google', () => {
    expect(buat().origin + buat().pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
  });

  it('memakai scope drive.file, bukan drive penuh', () => {
    // drive.file membatasi akses hanya pada berkas yang dibuat aplikasi ini.
    // Scope `drive` penuh akan menuntut security assessment berbayar dari Google.
    expect(buat().searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.file');
    expect(buat().searchParams.get('scope')).not.toContain('auth/drive ');
  });

  it('mengaktifkan PKCE S256', () => {
    expect(buat().searchParams.get('code_challenge_method')).toBe('S256');
    expect(buat().searchParams.get('code_challenge')).toBeTruthy();
  });

  it('meminta refresh token secara eksplisit', () => {
    // Tanpa access_type=offline + prompt=consent, Google hanya mengirim
    // refresh_token pada otorisasi pertama saja.
    expect(buat().searchParams.get('access_type')).toBe('offline');
    expect(buat().searchParams.get('prompt')).toBe('consent');
  });

  it('membawa state untuk verifikasi callback', () => {
    expect(buat().searchParams.get('state')).toBe('state-acak');
  });
});

describe('drive: sanitizeName', () => {
  it.each([
    ['Budi/Santoso', 'Budi Santoso'],
    ['Ani:Wijaya', 'Ani Wijaya'],
    ['a*b?c"d<e>f|g', 'a b c d e f g'],
    ['  spasi   berlebih  ', 'spasi berlebih'],
  ])('membersihkan %s', (masuk, harap) => {
    expect(drive.sanitizeName(masuk)).toBe(harap);
  });

  it('memakai nilai cadangan bila kosong', () => {
    expect(drive.sanitizeName('')).toBe('Tanpa Nama');
    expect(drive.sanitizeName(null)).toBe('Tanpa Nama');
    expect(drive.sanitizeName('   ', 'Pelanggan')).toBe('Pelanggan');
  });

  it('memotong nama yang sangat panjang', () => {
    expect(drive.sanitizeName('x'.repeat(500))).toHaveLength(120);
  });
});

describe('drive: guessMime', () => {
  it.each([
    ['foto.png', 'image/png'],
    ['foto.JPG', 'image/jpeg'],
    ['video.mp4', 'video/mp4'],
    ['video.webm', 'video/webm'],
  ])('%s', (nama, harap) => {
    expect(drive.guessMime(nama)).toBe(harap);
  });

  it('xlsx memakai mime spreadsheet', () => {
    expect(drive.guessMime('lap.xlsx')).toContain('spreadsheetml');
  });

  it('ekstensi tak dikenal jatuh ke octet-stream', () => {
    expect(drive.guessMime('entah.zzz')).toBe('application/octet-stream');
  });
});

describe('drive: folderWebUrl', () => {
  it('membentuk URL folder Drive', () => {
    expect(drive.folderWebUrl('ABC123')).toBe('https://drive.google.com/drive/folders/ABC123');
  });
});
