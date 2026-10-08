// =========================================================================
// ATURAN WAKTU SESI
//
// Dipisah jadi fungsi murni agar dapat diuji tanpa React maupun Electron.
// =========================================================================

export const DEFAULT_SESSION_MINUTES = 10;
export const DEFAULT_RETAKE_MIN_SECONDS = 90;

/**
 * Menghitung tenggat sesi.
 *
 * Sesi baru mendapat durasi penuh. Retake TIDAK memperpanjang sesi — ia
 * mempertahankan tenggat yang sudah berjalan (bug B4: sebelumnya setiap retake
 * memberi 10 menit penuh yang baru, sehingga satu pelanggan bisa menahan kiosk
 * sampai ~40 menit dan memblokir antrean).
 *
 * Pengecualiannya: bila sisa waktu terlalu pendek untuk menyelesaikan retake,
 * diberi lantai waktu minimum. Tanpa ini, pelanggan yang menekan retake di
 * menit terakhir tidak akan sempat selesai lalu kena auto-finish dengan slot
 * kosong — padahal retake adalah hak yang sudah ia bayar.
 *
 * Perpanjangan totalnya terbatas: durasi awal + (jatah retake x lantai waktu).
 *
 * @param {object} p
 * @param {number} p.now                waktu sekarang (epoch ms)
 * @param {number|null} p.currentDeadline tenggat yang sedang berjalan
 * @param {boolean} p.preserve          true bila ini retake, bukan sesi baru
 * @param {number} p.durationMs         durasi sesi penuh
 * @param {number} p.minRemainingMs     lantai waktu untuk retake
 * @returns {number} tenggat baru (epoch ms)
 */
export function computeSessionDeadline({
  now,
  currentDeadline = null,
  preserve = false,
  durationMs = DEFAULT_SESSION_MINUTES * 60_000,
  minRemainingMs = DEFAULT_RETAKE_MIN_SECONDS * 1000,
}) {
  if (!preserve || !currentDeadline) return now + durationMs;

  // Tenggat asli dipertahankan, kecuali sisanya di bawah lantai waktu.
  return Math.max(currentDeadline, now + minRemainingMs);
}

/** Membaca durasi sesi dari settings, dengan nilai aman bila belum diatur. */
export function sessionDurationMs(settings) {
  const menit = Number(settings?.session_minutes);
  return (Number.isFinite(menit) && menit > 0 ? menit : DEFAULT_SESSION_MINUTES) * 60_000;
}

/** Membaca lantai waktu retake dari settings, dengan nilai aman bila belum diatur. */
export function retakeMinRemainingMs(settings) {
  const detik = Number(settings?.retake_min_seconds);
  return (Number.isFinite(detik) && detik >= 0 ? detik : DEFAULT_RETAKE_MIN_SECONDS) * 1000;
}
