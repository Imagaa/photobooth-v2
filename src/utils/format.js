// Formatter Rupiah untuk input bergaya "15.000".
export const formatRp = (val) => {
  if (val === '' || val === null || val === undefined || isNaN(val)) return '';
  return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export const parseRp = (val) => {
  if (typeof val !== 'string') return val;
  const parsed = parseInt(val.replace(/\./g, ''), 10);
  return isNaN(parsed) ? '' : parsed;
};

export const THEMES = ['candy', 'bumblebee', 'neon', 'fall'];

// Perputaran tema, dipakai dua pemicu: Ctrl+Panah di kiosk dan tombol
// GANTI TEMA di HP kasir. Keduanya wajib memakai fungsi yang sama — kalau
// tidak, keduanya bisa diam-diam berputar ke arah yang berbeda.
//
// Tema yang tidak dikenal (data lama atau rusak) diperlakukan seolah berada
// di posisi pertama, sehingga menekan tombol tetap menghasilkan tema yang
// sah alih-alih macet di nilai yang tidak ada di daftar.
export const temaBerikutnya = (temaSekarang, arah) => {
  const langkah = arah === 'prev' ? -1 : 1;
  const idx = THEMES.indexOf(temaSekarang);
  const dari = idx === -1 ? 0 : idx;
  return THEMES[(dari + langkah + THEMES.length) % THEMES.length];
};
