import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { rankInterfaces, pickAddress, scoreInterface } = require('../electron/network.js');

// Bentuk data mengikuti os.networkInterfaces().
const iface = (address, opts = {}) => ({ family: 'IPv4', internal: false, address, ...opts });

const pilih = (nets, manual = '') => pickAddress(rankInterfaces(nets), manual).address;

describe('pemilihan adapter jaringan (bug B11)', () => {
  it('mengutamakan WiFi di atas Hyper-V', () => {
    expect(pilih({
      'vEthernet (Default Switch)': [iface('172.20.144.1')],
      'Wi-Fi': [iface('192.168.1.50')],
    })).toBe('192.168.1.50');
  });

  it('mengabaikan VPN Tailscale', () => {
    expect(pilih({
      'Tailscale': [iface('100.64.0.1')],
      'Wi-Fi': [iface('192.168.1.50')],
    })).toBe('192.168.1.50');
  });

  it('mengabaikan bridge Docker', () => {
    expect(pilih({
      'Docker Bridge': [iface('172.17.0.1')],
      'Ethernet': [iface('10.0.0.5')],
    })).toBe('10.0.0.5');
  });

  it('mengabaikan adapter WSL', () => {
    expect(pilih({
      'vEthernet (WSL)': [iface('172.28.32.1')],
      'Wi-Fi': [iface('192.168.100.3')],
    })).toBe('192.168.100.3');
  });

  it('membuang alamat APIPA saat DHCP gagal', () => {
    // 169.254.x berarti mesin tidak dapat alamat dari router — QR yang berisi
    // alamat ini tidak akan pernah bisa dibuka HP mana pun.
    expect(pilih({
      'Wi-Fi': [iface('169.254.10.2')],
      'Ethernet': [iface('192.168.0.9')],
    })).toBe('192.168.0.9');
  });

  it('mengabaikan antarmuka internal (loopback)', () => {
    const daftar = rankInterfaces({
      'Loopback': [iface('127.0.0.1', { internal: true })],
      'Wi-Fi': [iface('192.168.1.5')],
    });
    expect(daftar).toHaveLength(1);
    expect(daftar[0].address).toBe('192.168.1.5');
  });

  it('mengabaikan alamat IPv6', () => {
    const daftar = rankInterfaces({
      'Wi-Fi': [{ family: 'IPv6', internal: false, address: 'fe80::1' }, iface('192.168.1.5')],
    });
    expect(daftar).toHaveLength(1);
  });

  it('mengurutkan 192.168 di atas 10.x di atas 172.16', () => {
    const daftar = rankInterfaces({
      'A': [iface('172.16.0.1')],
      'B': [iface('10.0.0.1')],
      'C': [iface('192.168.0.1')],
    });
    expect(daftar.map(i => i.address)).toEqual(['192.168.0.1', '10.0.0.1', '172.16.0.1']);
  });

  it('vethernet tidak dianggap ethernet biasa', () => {
    expect(scoreInterface('vEthernet (X)', '192.168.1.1'))
      .toBeLessThan(scoreInterface('Ethernet', '192.168.1.1'));
  });
});

describe('override manual alamat IP', () => {
  const nets = {
    'Wi-Fi': [iface('192.168.1.50')],
    'Ethernet': [iface('10.0.0.5')],
  };

  it('menghormati alamat yang dikunci operator', () => {
    const hasil = pickAddress(rankInterfaces(nets), '10.0.0.5');
    expect(hasil.address).toBe('10.0.0.5');
    expect(hasil.source).toBe('manual');
    expect(hasil.warning).toBeNull();
  });

  it('kembali otomatis bila alamat manual sudah tidak aktif', () => {
    // Terjadi saat kiosk dipindah ke venue lain tanpa mengubah pengaturan.
    const hasil = pickAddress(rankInterfaces(nets), '192.168.99.99');
    expect(hasil.address).toBe('192.168.1.50');
    expect(hasil.source).toBe('auto');
    expect(hasil.warning).toContain('192.168.99.99');
  });

  it('jatuh ke loopback bila tidak ada adapter sama sekali', () => {
    const hasil = pickAddress([], '');
    expect(hasil.address).toBe('127.0.0.1');
    expect(hasil.source).toBe('fallback');
  });
});
