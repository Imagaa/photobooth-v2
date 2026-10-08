import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import net from 'node:net';

const require = createRequire(import.meta.url);
const ports = require('../electron/ports.js');

// =========================================================================
// Uji ini menjaga bug B18: port 5173 dan 3000 dulu ditulis mati di source.
// Di laptop yang juga menjalankan proyek lain, Vite pindah ke 5174 sementara
// Electron tetap membuka 5173 — kiosk menampilkan aplikasi orang lain tanpa
// error sama sekali (bug B24). Perilaku modul ports.js diuji di sini.
// =========================================================================

// Menyalakan server sungguhan di port bebas, lalu melepaskannya kembali.
async function withServer(fn) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  try {
    return await fn(port, server);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('ports: parsePort', () => {
  it('menerima angka dan string angka', () => {
    expect(ports.parsePort(5173, 3000)).toBe(5173);
    expect(ports.parsePort('5174', 3000)).toBe(5174);
  });

  it('menolak nilai di luar rentang', () => {
    expect(ports.parsePort(0, 3000)).toBe(3000);
    expect(ports.parsePort(70000, 3000)).toBe(3000);
    expect(ports.parsePort(-1, 3000)).toBe(3000);
    expect(ports.parsePort('abc', 3000)).toBe(3000);
  });

  it('memakai fallback untuk input kosong', () => {
    // Env yang tidak di-set adalah hal normal, bukan kondisi galat.
    expect(ports.parsePort(undefined, 3000)).toBe(3000);
    expect(ports.parsePort('', 3000)).toBe(3000);
    expect(ports.parsePort(null, 5173)).toBe(5173);
  });
});

describe('ports: normalizeDevUrl', () => {
  it('memakai default saat env kosong', () => {
    expect(ports.normalizeDevUrl('')).toBe('http://localhost:5173');
    expect(ports.normalizeDevUrl(undefined)).toBe('http://localhost:5173');
  });

  it('menambah skema yang hilang', () => {
    expect(ports.normalizeDevUrl('localhost:5174')).toBe('http://localhost:5174');
  });

  it('membuang path, query, dan hash', () => {
    // CSP dan filter navigasi hanya boleh membandingkan origin. Kalau path
    // ikut terbawa, pencocokan `startsWith` jadi rapuh.
    expect(ports.normalizeDevUrl('http://localhost:5174/index.html?x=1'))
      .toBe('http://localhost:5174');
  });

  it('mempertahankan port yang bukan default', () => {
    // Inilah kasus intinya: Vite pindah ke 5174, Electron harus ikut.
    expect(ports.normalizeDevUrl('http://localhost:5174'))
      .toBe('http://localhost:5174');
  });

  it('memakai defaultPort yang diberikan', () => {
    expect(ports.normalizeDevUrl('', 4321)).toBe('http://localhost:4321');
  });

  it('tidak melempar error untuk input rusak', () => {
    expect(ports.normalizeDevUrl('http://')).toBe('http://localhost:5173');
  });
});

describe('ports: wsOriginFrom', () => {
  it('mengubah http menjadi ws untuk HMR', () => {
    expect(ports.wsOriginFrom('http://localhost:5174')).toBe('ws://localhost:5174');
    expect(ports.wsOriginFrom('https://localhost:5174')).toBe('wss://localhost:5174');
  });

  it('tidak mengubah input kosong', () => {
    expect(ports.wsOriginFrom('')).toBe('');
  });
});

describe('ports: listenWithFallback', () => {
  it('memakai port yang diminta bila bebas', async () => {
    // Port yang benar-benar belum dipakai. Helper withServer tidak bisa
    // dipakai di sini karena ia menahan port selama callback berjalan —
    // justru itu yang membuat port terbaca "sedang dipakai".
    const port = await ports.findFreePort(46000);
    const server = net.createServer();
    const hasil = await ports.listenWithFallback(server, { preferred: port, host: '127.0.0.1' });
    try {
      expect(hasil.port).toBe(port);
      expect(hasil.fallback).toBe(false);
      expect(server.address().port).toBe(port);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('mundur ke port bebas saat port pilihan sudah dipakai', async () => {
    await withServer(async (port) => {
      const server = net.createServer();
      let pesanFallback = '';
      const hasil = await ports.listenWithFallback(server, {
        preferred: port,
        host: '127.0.0.1',
        onFallback: (m) => { pesanFallback = m; },
      });
      try {
        expect(hasil.fallback).toBe(true);
        expect(hasil.port).not.toBe(port);
        expect(hasil.port).toBeGreaterThan(0);
        // Operator harus diberi tahu port-nya berubah, karena QR kasir
        // yang dicetak sebelumnya jadi tidak berlaku.
        expect(pesanFallback).toContain(String(port));
      } finally {
        await new Promise((r) => server.close(r));
      }
    });
  });

  it('meneruskan error yang bukan EADDRINUSE', async () => {
    // Port di luar rentang tidak boleh diam-diam jatuh ke port lain:
    // itu konfigurasi salah dan harus terlihat.
    const server = net.createServer();
    await expect(ports.listenWithFallback(server, { preferred: 70000, host: '127.0.0.1' }))
      .rejects.toThrow();
  });
});

describe('ports: findFreePort', () => {
  it('mengembalikan port yang benar-benar bebas', async () => {
    const port = await ports.findFreePort(45000);
    expect(port).toBeGreaterThanOrEqual(45000);
    expect(port).toBeLessThanOrEqual(65535);

    // Bukti terkuat: port itu harus benar-benar bisa diikat.
    const server = net.createServer();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    await new Promise((r) => server.close(r));
  });

  it('melewati port yang sedang dipakai', async () => {
    await withServer(async (port) => {
      const free = await ports.findFreePort(port);
      expect(free).toBeGreaterThan(port);
    });
  });

  it('melewati port yang diikat wildcard', async () => {
    // Proses lain sering mengikat 0.0.0.0/::, bukan 127.0.0.1. Kalau probe
    // hanya mengecek loopback, port ini lolos padahal Vite lalu gagal
    // dengan pesan "port in use on a wildcard address" (bug B24).
    const server = net.createServer();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, resolve);
    });
    const { port } = server.address();
    try {
      const free = await ports.findFreePort(port);
      expect(free).not.toBe(port);
      expect(free).toBeGreaterThan(port);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});
