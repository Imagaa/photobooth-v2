import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { renderDownloadPage, escapeHtml } = require('../electron/download-page.js');

const TOKEN = 'a'.repeat(32);
const sesiDasar = (extra = {}) => ({
  id: 42,
  customer_name: 'Ani Wijaya',
  token_download: TOKEN,
  download_expires_at: Date.UTC(2026, 6, 28, 10, 0),
  ...extra,
});

describe('escapeHtml', () => {
  it.each([
    ['<script>', '&lt;script&gt;'],
    ['a & b', 'a &amp; b'],
    ['kutip "ganda"', 'kutip &quot;ganda&quot;'],
    ["kutip 'tunggal'", 'kutip &#39;tunggal&#39;'],
  ])('%s', (masuk, harap) => {
    expect(escapeHtml(masuk)).toBe(harap);
  });

  it('menangani null dan undefined tanpa melempar', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('meng-escape ampersand lebih dulu agar tidak dobel', () => {
    // Bila & di-escape terakhir, hasilnya jadi &amp;lt; — rusak.
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});

describe('halaman unduhan: keamanan', () => {
  // Nama pelanggan tersimpan di DB dan ditampilkan di halaman yang dibuka
  // publik. Ini jalur stored-XSS yang sama seperti temuan S6 pada halaman kasir.
  const jahat = `Budi" onerror="alert(1)" <script>alert('xss')</script>`;

  it('tidak meloloskan tag script mentah', () => {
    const html = renderDownloadPage(sesiDasar({ customer_name: jahat }), []);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('tidak meloloskan pemecahan atribut', () => {
    const html = renderDownloadPage(sesiDasar({ customer_name: jahat }), []);
    expect(html).not.toContain('onerror="');
  });

  it('meng-escape URL Drive yang ditanam ke atribut href', () => {
    const html = renderDownloadPage(sesiDasar(), [], {
      folderUrl: 'https://drive.google.com/x?a=1&b=2',
    });
    expect(html).toContain('a=1&amp;b=2');
  });
});

describe('halaman unduhan: isi', () => {
  it('menampilkan pemutar untuk tiap video', () => {
    const html = renderDownloadPage(sesiDasar(), ['video_1.mp4', 'video_2.mp4']);
    expect(html.match(/<video /g)).toHaveLength(2);
  });

  it('memberi tahu bila tidak ada video', () => {
    const html = renderDownloadPage(sesiDasar(), []);
    expect(html).toContain('Tidak ada rekaman video');
  });

  it('memperingatkan format WebM yang bermasalah di iOS', () => {
    // File .webm tidak bisa diputar aplikasi Foto bawaan iPhone.
    const webm = renderDownloadPage(sesiDasar(), ['video_1.webm']);
    const mp4 = renderDownloadPage(sesiDasar(), ['video_1.mp4']);
    expect(webm).toContain('WebM');
    expect(mp4).not.toContain('Format WebM');
  });

  it('menambahkan parameter unduh pada tombol simpan', () => {
    const html = renderDownloadPage(sesiDasar(), ['video_1.mp4']);
    expect(html).toContain(`/d/${TOKEN}/photo?dl=1`);
    expect(html).toContain(`/d/${TOKEN}/video/0?dl=1`);
  });
});

describe('halaman unduhan: panel Google Drive', () => {
  it('tidak muncul bila Drive tidak dipakai', () => {
    expect(renderDownloadPage(sesiDasar(), [])).not.toContain('BUKA FOLDER GOOGLE DRIVE');
  });

  it('muncul bila folder Drive tersedia', () => {
    const html = renderDownloadPage(sesiDasar(), [], { folderUrl: 'https://drive.google.com/drive/folders/X' });
    expect(html).toContain('BUKA FOLDER GOOGLE DRIVE');
  });

  it('memberi tahu bila unggahan belum selesai', () => {
    const html = renderDownloadPage(sesiDasar(), [], { folderUrl: 'https://x', pending: 3 });
    expect(html).toContain('3 file yang sedang diunggah');
  });

  it('tidak memberi peringatan bila antrean sudah kosong', () => {
    const html = renderDownloadPage(sesiDasar(), [], { folderUrl: 'https://x', pending: 0 });
    expect(html).not.toContain('sedang diunggah');
  });
});

describe('halaman unduhan: masa berlaku', () => {
  it('menampilkan tanggal kedaluwarsa', () => {
    expect(renderDownloadPage(sesiDasar(), [])).toContain('2026');
  });

  it('menyatakan tidak dibatasi bila kedaluwarsa kosong', () => {
    expect(renderDownloadPage(sesiDasar({ download_expires_at: null }), [])).toContain('Tidak dibatasi');
  });
});
