// =========================================================================
// TATA LETAK & LOGIKA TOMBOL KEYBOARD ON-SCREEN
//
// Murni: tidak menyentuh DOM maupun React, sehingga aturannya bisa diuji
// tanpa merender apa pun. Komponennya hanya menggambar apa yang diputuskan
// di sini.
// =========================================================================

export const BARIS_ANGKA = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export const BARIS_HURUF = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

// Dipilih dari nilai yang benar-benar diketik operator di panel admin:
// ID folder Drive (- dan _), alamat email akun (@), path dan URL (. dan /).
// Tanpa kelimanya, sebagian kolom tidak bisa diisi sama sekali dari mesin
// layar sentuh.
export const BARIS_SIMBOL = ['.', '-', '_', '@', '/'];

export const TOMBOL_KHUSUS = ['SHIFT', 'DEL', 'CLR', 'SPACE'];

// Perbandingannya sengaja tidak peka huruf besar-kecil. Tata letak menyimpan
// huruf kapital, tetapi pemanggil yang mengirim 'h' bukan sedang keliru — dan
// membuang ketikannya tanpa suara adalah kegagalan yang jauh lebih sulit
// dilacak daripada sekadar salah kapitalisasi.
const bisaDiketik = (t) => {
  if (typeof t !== 'string' || t.length !== 1) return false;
  const k = t.toUpperCase();
  return BARIS_ANGKA.includes(k) ||
    BARIS_SIMBOL.includes(k) ||
    BARIS_HURUF.some((baris) => baris.includes(k));
};

// Menerapkan satu penekanan tombol ke nilai yang sedang diedit.
//
// Penambahan selalu di AKHIR nilai, bukan di posisi kursor. Ini disengaja:
// input yang dikendalikan React akan merender ulang setelah setiap perubahan
// dan mengembalikan kursor ke akhir, sehingga menyisipkan di tengah justru
// menghasilkan urutan huruf yang tidak terduga. Tombol CLR ada supaya
// mengoreksi nilai panjang tidak berarti menekan DEL puluhan kali.
export function terapkanTombol(nilai, tombol, { shift = false } = {}) {
  const v = nilai === null || nilai === undefined ? '' : String(nilai);

  if (tombol === 'DEL') return v.slice(0, -1);
  if (tombol === 'CLR') return '';
  if (tombol === 'SPACE') return v + ' ';
  // SHIFT hanya mengubah tampilan tombol berikutnya, bukan nilainya.
  if (tombol === 'SHIFT') return v;

  // Tombol yang tidak dikenal diabaikan, bukan ditempel mentah — supaya
  // salah ketik nama tombol di komponen tidak berakhir di dalam data.
  if (!bisaDiketik(tombol)) return v;

  return v + (shift ? tombol.toUpperCase() : tombol.toLowerCase());
}

// SHIFT adalah saklar yang menetap, bukan sekali pakai. Untuk mengetik
// "SB-Mid-server-..." operator menyalakan sekali, mengetik beberapa huruf,
// lalu mematikannya — bukan menekan SHIFT ulang di setiap huruf.
export function hurufTampil(huruf, shift) {
  return shift ? huruf.toUpperCase() : huruf.toLowerCase();
}
