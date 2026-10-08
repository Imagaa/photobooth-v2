// =========================================================================
// TUMPUKAN RIWAYAT UNDO/REDO
//
// Dipisah dari komponen karena inilah bagian yang paling mudah salah dan
// paling sulit dilihat kesalahannya dari layar: cabang redo yang tidak
// terpotong, langkah kosong yang menumpuk, atau batas tumpukan yang
// menggeser indeks. Semuanya logika murni, jadi bisa diuji tanpa DOM.
//
// Bentuk data:  { tumpuk: [snapshot, ...], idx: number }
// `idx` menunjuk snapshot yang SEDANG berlaku, bukan puncak tumpukan —
// itulah yang membuat redo mungkin.
// =========================================================================

export const BATAS_RIWAYAT = 60;

export function buatRiwayat(snapshotAwal) {
  return { tumpuk: [snapshotAwal], idx: 0 };
}

export function bisaUndo(riwayat) {
  return riwayat.idx > 0;
}

export function bisaRedo(riwayat) {
  return riwayat.idx < riwayat.tumpuk.length - 1;
}

export function snapshotAktif(riwayat) {
  return riwayat.tumpuk[riwayat.idx];
}

/**
 * Mencatat satu langkah baru.
 *
 * @param riwayat   tumpukan saat ini
 * @param snapshot  kondisi yang ingin dicatat
 * @param gabung    true bila langkah ini kelanjutan langsung dari langkah
 *                  sebelumnya (mis. ketikan beruntun di kolom yang sama).
 *                  Pemanggil yang memutuskan, karena penentuannya bergantung
 *                  pada waktu dan sumber aksi.
 * @param batas     batas panjang tumpukan
 */
export function rekamLangkah(riwayat, snapshot, { gabung = false, batas = BATAS_RIWAYAT } = {}) {
  // Aksi yang tidak mengubah apa pun — mis. menekan slot tanpa menggesernya —
  // tidak boleh menghasilkan langkah undo yang seolah-olah tidak bekerja.
  if (samaDengan(snapshotAktif(riwayat), snapshot)) return riwayat;

  // Mencatat langkah baru setelah undo membuang cabang redo. Ini perilaku
  // yang diharapkan orang dari editor mana pun.
  const tumpuk = riwayat.tumpuk.slice(0, riwayat.idx + 1);

  // Snapshot awal tidak pernah ditimpa: ia jangkar untuk kembali ke kondisi
  // saat editor dibuka.
  if (gabung && tumpuk.length > 1) {
    tumpuk[tumpuk.length - 1] = snapshot;
    return { tumpuk, idx: tumpuk.length - 1 };
  }

  tumpuk.push(snapshot);
  const kelebihan = Math.max(0, tumpuk.length - batas);
  const dipangkas = kelebihan ? tumpuk.slice(kelebihan) : tumpuk;
  return { tumpuk: dipangkas, idx: dipangkas.length - 1 };
}

export function langkahUndo(riwayat) {
  if (!bisaUndo(riwayat)) return riwayat;
  return { ...riwayat, idx: riwayat.idx - 1 };
}

export function langkahRedo(riwayat) {
  if (!bisaRedo(riwayat)) return riwayat;
  return { ...riwayat, idx: riwayat.idx + 1 };
}

// Snapshot hanya berisi angka, string, dan array datar berisi objek angka —
// perbandingan JSON sudah memadai dan jauh lebih ringkas daripada penelusuran
// dalam buatan sendiri.
function samaDengan(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
