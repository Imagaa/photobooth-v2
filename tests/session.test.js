import { describe, it, expect } from 'vitest';
import {
  computeSessionDeadline,
  sessionDurationMs,
  retakeMinRemainingMs,
  DEFAULT_SESSION_MINUTES,
  DEFAULT_RETAKE_MIN_SECONDS,
} from '../src/utils/session.js';

const MENIT = 60_000;
const DETIK = 1_000;
const NOW = 1_800_000_000_000; // titik waktu tetap agar uji deterministik

const hitung = (opts) => computeSessionDeadline({ now: NOW, ...opts });

describe('sesi baru', () => {
  it('mendapat durasi penuh', () => {
    expect(hitung({ durationMs: 10 * MENIT })).toBe(NOW + 10 * MENIT);
  });

  it('mengabaikan tenggat lama bila bukan retake', () => {
    // Pelanggan berikutnya tidak boleh mewarisi sisa waktu pelanggan sebelumnya.
    expect(hitung({ currentDeadline: NOW + 30 * DETIK, preserve: false, durationMs: 10 * MENIT }))
      .toBe(NOW + 10 * MENIT);
  });

  it('memakai durasi penuh bila belum ada tenggat, walau preserve diminta', () => {
    expect(hitung({ currentDeadline: null, preserve: true, durationMs: 10 * MENIT }))
      .toBe(NOW + 10 * MENIT);
  });
});

describe('retake — bug B4', () => {
  const opts = { preserve: true, durationMs: 10 * MENIT, minRemainingMs: 90 * DETIK };

  it('TIDAK memperpanjang sesi bila waktu masih banyak', () => {
    // Inilah inti B4: dulu setiap retake memberi 10 menit penuh yang baru,
    // sehingga satu pelanggan bisa menahan kiosk sampai ~40 menit.
    const tenggat = NOW + 7 * MENIT;
    expect(hitung({ ...opts, currentDeadline: tenggat })).toBe(tenggat);
  });

  it('mempertahankan tenggat persis, bukan membulatkan', () => {
    const tenggat = NOW + 3 * MENIT + 17 * DETIK;
    expect(hitung({ ...opts, currentDeadline: tenggat })).toBe(tenggat);
  });

  it('memberi lantai waktu bila sisa terlalu pendek', () => {
    // Tanpa lantai ini, pelanggan yang menekan retake di menit terakhir tidak
    // sempat selesai lalu kena auto-finish dengan slot kosong.
    expect(hitung({ ...opts, currentDeadline: NOW + 10 * DETIK })).toBe(NOW + 90 * DETIK);
  });

  it('memberi lantai waktu bila tenggat sudah lewat', () => {
    expect(hitung({ ...opts, currentDeadline: NOW - 5 * MENIT })).toBe(NOW + 90 * DETIK);
  });

  it('tepat di ambang lantai tidak mengubah apa pun', () => {
    const tenggat = NOW + 90 * DETIK;
    expect(hitung({ ...opts, currentDeadline: tenggat })).toBe(tenggat);
  });

  it('lantai nol berarti tenggat asli dipakai apa adanya', () => {
    const tenggat = NOW + 5 * DETIK;
    expect(hitung({ ...opts, currentDeadline: tenggat, minRemainingMs: 0 })).toBe(tenggat);
  });
});

describe('batas perpanjangan total', () => {
  it('tiga retake berturut-turut di detik terakhir tetap terbatas', () => {
    // Skenario terburuk: pelanggan menekan retake tepat saat waktu hampir habis,
    // sebanyak jatah maksimum. Total harus tetap wajar, bukan 40 menit.
    const durasi = 10 * MENIT;
    const lantai = 90 * DETIK;
    let waktu = NOW;
    let tenggat = computeSessionDeadline({ now: waktu, durationMs: durasi });

    for (let i = 0; i < 3; i++) {
      waktu = tenggat - 1 * DETIK; // menekan retake satu detik sebelum habis
      tenggat = computeSessionDeadline({
        now: waktu, currentDeadline: tenggat, preserve: true,
        durationMs: durasi, minRemainingMs: lantai,
      });
    }

    const totalMenit = (tenggat - NOW) / MENIT;
    expect(totalMenit).toBeLessThanOrEqual(15);
    // Perilaku lama memberi 10 menit penuh tiap retake = 40 menit.
    expect(totalMenit).toBeLessThan(40);
  });
});

describe('pembacaan setelan', () => {
  it('memakai nilai bawaan bila settings kosong', () => {
    expect(sessionDurationMs(null)).toBe(DEFAULT_SESSION_MINUTES * MENIT);
    expect(retakeMinRemainingMs(null)).toBe(DEFAULT_RETAKE_MIN_SECONDS * DETIK);
  });

  it('menghormati nilai yang diatur operator', () => {
    expect(sessionDurationMs({ session_minutes: 5 })).toBe(5 * MENIT);
    expect(retakeMinRemainingMs({ retake_min_seconds: 30 })).toBe(30 * DETIK);
  });

  it('menolak nilai tidak masuk akal dan kembali ke bawaan', () => {
    [0, -5, NaN, 'abc', null, undefined].forEach(v => {
      expect(sessionDurationMs({ session_minutes: v })).toBe(DEFAULT_SESSION_MINUTES * MENIT);
    });
  });

  it('lantai retake nol diterima sebagai nilai sah', () => {
    // 0 berarti operator sengaja mematikan jaminan waktu, bukan nilai rusak.
    expect(retakeMinRemainingMs({ retake_min_seconds: 0 })).toBe(0);
  });
});
