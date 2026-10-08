// =========================================================================
// PETA PINTASAN KEYBOARD KIOSK
//
// Murni: tidak menyentuh DOM, React, maupun database. Seluruh aturan tentang
// "pintasan apa yang boleh" tinggal di sini supaya bisa diuji tanpa merender
// apa pun — dan supaya pendeteksi bentroknya tidak tersebar di UI.
// =========================================================================

export const AKSI = [
  { id: 'settings', label: 'Buka Pengaturan' },
  { id: 'template', label: 'Master Template' },
  { id: 'dashboard', label: 'Live Dashboard' },
  { id: 'close_session', label: 'Tutup Sesi Event' },
  { id: 'tema_next', label: 'Tema Berikutnya' },
  { id: 'tema_prev', label: 'Tema Sebelumnya' },
];

export const ID_AKSI = AKSI.map((a) => a.id);

export const PINTASAN_BAWAAN = {
  settings: { ctrl: true, shift: true, alt: false, key: 'P' },
  template: { ctrl: true, shift: true, alt: false, key: 'T' },
  dashboard: { ctrl: true, shift: true, alt: false, key: 'D' },
  close_session: { ctrl: true, shift: false, alt: false, key: 'X' },
  tema_next: { ctrl: true, shift: false, alt: false, key: 'ARROWUP' },
  tema_prev: { ctrl: true, shift: false, alt: false, key: 'ARROWDOWN' },
};

// Pintasan yang sudah dimiliki Windows/Chromium. Dipisah dua tingkat karena
// akibatnya berbeda jauh: yang 'kritis' bisa menutup atau memuat ulang kiosk
// di tengah sesi pelanggan, sedangkan yang 'waspada' hanya mengganggu saat
// operator sedang mengetik di sebuah kolom.
export const PINTASAN_SISTEM = [
  { p: { ctrl: true, shift: false, alt: false, key: 'W' }, tingkat: 'kritis', teks: 'menutup jendela' },
  { p: { ctrl: true, shift: false, alt: false, key: 'R' }, tingkat: 'kritis', teks: 'memuat ulang aplikasi' },
  { p: { ctrl: true, shift: true, alt: false, key: 'R' }, tingkat: 'kritis', teks: 'memuat ulang paksa' },
  { p: { ctrl: true, shift: false, alt: false, key: 'Q' }, tingkat: 'kritis', teks: 'menutup aplikasi' },
  { p: { ctrl: true, shift: false, alt: false, key: 'N' }, tingkat: 'kritis', teks: 'membuka jendela baru' },
  { p: { ctrl: true, shift: true, alt: false, key: 'I' }, tingkat: 'kritis', teks: 'membuka DevTools' },
  { p: { ctrl: true, shift: false, alt: false, key: 'P' }, tingkat: 'waspada', teks: 'cetak halaman' },
  { p: { ctrl: true, shift: false, alt: false, key: 'C' }, tingkat: 'waspada', teks: 'salin' },
  { p: { ctrl: true, shift: false, alt: false, key: 'V' }, tingkat: 'waspada', teks: 'tempel' },
  { p: { ctrl: true, shift: false, alt: false, key: 'A' }, tingkat: 'waspada', teks: 'pilih semua' },
  { p: { ctrl: true, shift: false, alt: false, key: 'X' }, tingkat: 'waspada', teks: 'potong teks' },
  { p: { ctrl: true, shift: false, alt: false, key: 'Z' }, tingkat: 'waspada', teks: 'urungkan' },
];

const LAMBANG = { ARROWUP: '↑', ARROWDOWN: '↓', ARROWLEFT: '←', ARROWRIGHT: '→', ' ': 'Space', SPACE: 'Space' };

export function normalkan(p) {
  if (!p || typeof p !== 'object') return null;
  const key = String(p.key || '').toUpperCase();
  if (!key) return null;
  return { ctrl: !!p.ctrl, shift: !!p.shift, alt: !!p.alt, key };
}

export function samaDengan(a, b) {
  const x = normalkan(a);
  const y = normalkan(b);
  if (!x || !y) return false;
  return x.ctrl === y.ctrl && x.shift === y.shift && x.alt === y.alt && x.key === y.key;
}

export function formatPintasan(p) {
  const n = normalkan(p);
  if (!n) return '—';
  const bagian = [];
  if (n.ctrl) bagian.push('Ctrl');
  if (n.shift) bagian.push('Shift');
  if (n.alt) bagian.push('Alt');
  bagian.push(LAMBANG[n.key] || n.key);
  return bagian.join('+');
}

// Mengubah KeyboardEvent menjadi pintasan. Mengembalikan null bila yang
// ditekan baru tombol pengubahnya saja — tanpa ini, menahan Ctrl untuk
// mengetik kombinasi akan langsung terekam sebagai "pintasan Ctrl".
export function dariEvent(e) {
  if (!e || !e.key) return null;
  const k = String(e.key);
  if (['Control', 'Shift', 'Alt', 'Meta', 'OS'].includes(k)) return null;
  return { ctrl: !!e.ctrlKey, shift: !!e.shiftKey, alt: !!e.altKey, key: k.toUpperCase() };
}

// Pintasan tanpa tombol pengubah akan menyala setiap kali huruf itu diketik
// di mana pun — di kiosk yang punya kolom nama pelanggan, itu fatal.
export function validasi(p) {
  const n = normalkan(p);
  if (!n) return { ok: false, error: 'Pintasan tidak dikenal.' };
  if (!n.ctrl && !n.alt) return { ok: false, error: 'Harus memakai Ctrl atau Alt.' };
  return { ok: true, nilai: n };
}

// Ctrl+huruf tanpa Shift/Alt beririsan dengan perintah pengeditan teks
// (potong, salin, tempel). Pintasan semacam ini harus diabaikan selama
// kursor berada di kolom teks — itulah alasan Ctrl+X bawaan tetap aman.
export function bisaBentrokSaatMengetik(p) {
  const n = normalkan(p);
  if (!n) return false;
  return n.ctrl && !n.shift && !n.alt && /^[A-Z]$/.test(n.key);
}

export function cariAksi(peta, tekan) {
  if (!peta || !tekan) return null;
  return ID_AKSI.find((id) => samaDengan(peta[id], tekan)) || null;
}

// Mengumpulkan seluruh masalah pada peta: dua aksi memakai pintasan yang
// sama, atau sebuah pintasan merebut fungsi yang sudah dipegang sistem.
export function deteksiBentrok(peta) {
  const keluar = [];
  const p = peta || {};

  ID_AKSI.forEach((id, i) => {
    const milik = p[id];
    if (!milik) return;

    // Bentrok antar aksi sendiri — hanya dilaporkan sekali, pada yang kedua.
    const kembar = ID_AKSI.slice(0, i).find((lain) => samaDengan(p[lain], milik));
    if (kembar) {
      const label = (AKSI.find((a) => a.id === kembar) || {}).label || kembar;
      keluar.push({ aksi: id, tingkat: 'kritis', teks: `Sama dengan "${label}"` });
      return;
    }

    const sistem = PINTASAN_SISTEM.find((s) => samaDengan(s.p, milik));
    if (sistem) {
      keluar.push({ aksi: id, tingkat: sistem.tingkat, teks: `Dipakai Windows untuk ${sistem.teks}` });
    }
  });

  return keluar;
}

// Membaca peta tersimpan. Nilai rusak, aksi tak dikenal, dan pintasan tidak
// sah dibuang lalu diganti bawaan — kiosk tidak boleh kehilangan seluruh
// pintasannya hanya karena satu baris JSON cacat.
export function gabungBawaan(json) {
  let tersimpan = {};
  if (json && typeof json === 'string') {
    try { tersimpan = JSON.parse(json) || {}; } catch { tersimpan = {}; }
  } else if (json && typeof json === 'object') {
    tersimpan = json;
  }

  const keluar = {};
  ID_AKSI.forEach((id) => {
    const v = validasi(tersimpan[id]);
    keluar[id] = v.ok ? v.nilai : { ...PINTASAN_BAWAAN[id] };
  });
  return keluar;
}

// Hanya menyimpan yang benar-benar berbeda dari bawaan. Peta yang seluruhnya
// bawaan disimpan sebagai string kosong, sehingga mengubah bawaan di versi
// mendatang tetap sampai ke pemasangan yang tidak pernah mengubah apa pun.
export function keJson(peta) {
  const beda = {};
  ID_AKSI.forEach((id) => {
    if (peta && peta[id] && !samaDengan(peta[id], PINTASAN_BAWAAN[id])) {
      beda[id] = normalkan(peta[id]);
    }
  });
  return Object.keys(beda).length ? JSON.stringify(beda) : '';
}
