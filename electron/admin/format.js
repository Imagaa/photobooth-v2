// =========================================================================
// LOGIKA MURNI HALAMAN KASIR
//
// Berkas ini dimuat DUA KALI, dan itu disengaja:
//   1. oleh Vitest lewat require()  — supaya aturannya bisa diuji tanpa DOM
//   2. oleh browser HP kasir sebagai <script> klasik — deklarasi fungsi di
//      level teratas otomatis menjadi global yang dipakai client.js
//
// Konsekuensinya: JANGAN memakai require, import, atau menyentuh DOM di sini.
// Semua yang butuh DOM tinggal di client.js.
// =========================================================================

const TEMA_DIKENAL = ['candy', 'bumblebee', 'neon', 'fall'];

// Nominal penuh untuk layar tagihan. Nol dan nilai tak masuk akal dianggap
// gratis, bukan "Rp 0" — kasir tidak boleh ragu apakah harus menagih.
function formatRupiah(nilai) {
    const n = Number(nilai);
    if (!Number.isFinite(n) || n <= 0) return 'GRATIS';
    return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

// Bentuk pendek untuk daftar riwayat, di mana lebar layar HP jadi kendala.
// Di bawah seribu tidak dibulatkan ke "0k" karena itu menyesatkan.
function formatRupiahSingkat(nilai) {
    const n = Number(nilai);
    if (!Number.isFinite(n) || n <= 0) return 'GRATIS';
    if (n < 1000) return 'Rp ' + Math.round(n);
    return 'Rp ' + Math.round(n / 1000) + 'k';
}

// Nilai tema datang dari database dan dipakai sebagai nama kelas CSS.
// Dibatasi ke daftar yang dikenal supaya nilai rusak tidak menghasilkan
// kelas asing yang membuat halaman kehilangan seluruh warnanya.
function kelasTema(tema) {
    return 'theme-' + (TEMA_DIKENAL.includes(String(tema)) ? tema : 'candy');
}

function ringkasStatus(sesi) {
    const status = (sesi && sesi.status_cetak) || '-';
    const galat = sesi && sesi.print_error;
    return galat ? status + ' (' + galat + ')' : status;
}

function barisMeta(sesi) {
    const waktu = (sesi && sesi.waktu) || '';
    return (waktu ? waktu + '  |  ' : '') + 'CETAK: ' + ringkasStatus(sesi);
}

// Teks konfirmasi aksi merusak. Dikumpulkan di sini supaya kalimat
// peringatannya tidak tercecer di tengah kode DOM.
function teksKonfirmasi(tipe) {
    if (tipe === 'restart') {
        return {
            judul: 'RESTART APLIKASI?',
            pesan: 'Sesi pelanggan yang sedang berjalan akan hilang dan belum tersimpan.',
            aksi: 'YA, RESTART',
        };
    }
    if (tipe === 'close') {
        return {
            judul: 'TUTUP SESI EVENT?',
            pesan: 'Event ditutup permanen dan kiosk kembali ke layar Manajemen Sesi.',
            aksi: 'YA, TUTUP',
        };
    }
    return null;
}

// Polling cepat hanya saat ada tagihan menunggu. Saat idle, lima detik sudah
// cukup — sebelumnya dua detik selamanya, ribuan request sia-sia per event.
function jedaPoll(adaPending) {
    return adaPending ? 2000 : 5000;
}

// ================== PENYARINGAN RIWAYAT ==================
//
// Acara 100 tamu menghasilkan ratusan baris. Menggulir mencari satu nama di
// layar HP tidak realistis, dan yang paling sering dicari kasir justru
// transaksi yang gagal dicetak — karena itulah keduanya jadi penyaring.

const STATUS_SARINGAN = ['SEMUA', 'MENUNGGU', 'TERCETAK', 'PDF', 'GAGAL', 'DILEWATI'];

// Pencarian sengaja tidak peka huruf besar-kecil dan mengabaikan spasi di
// tepi: kasir mengetik terburu-buru sambil melayani antrean.
function cocokCari(sesi, kueri) {
    const q = String(kueri === null || kueri === undefined ? '' : kueri).trim().toLowerCase();
    if (!q) return true;
    const nama = String((sesi && sesi.customer_name) || '').toLowerCase();
    return nama.includes(q);
}

function cocokStatus(sesi, status) {
    if (!status || status === 'SEMUA') return true;
    return String((sesi && sesi.status_cetak) || '').toUpperCase() === String(status).toUpperCase();
}

function saringRiwayat(daftar, opsi) {
    if (!Array.isArray(daftar)) return [];
    const { cari = '', status = 'SEMUA' } = opsi || {};
    return daftar.filter(s => cocokCari(s, cari) && cocokStatus(s, status));
}

// Jumlah per status, dipakai untuk angka di tombol saringan. Status yang
// tidak dikenal tetap dihitung ke SEMUA supaya totalnya tidak berbohong.
function hitungStatus(daftar) {
    const keluar = {};
    STATUS_SARINGAN.forEach(s => { keluar[s] = 0; });
    if (!Array.isArray(daftar)) return keluar;

    keluar.SEMUA = daftar.length;
    daftar.forEach((s) => {
        const st = String((s && s.status_cetak) || '').toUpperCase();
        if (Object.prototype.hasOwnProperty.call(keluar, st) && st !== 'SEMUA') keluar[st] += 1;
    });
    return keluar;
}

// Kalimat "menampilkan N dari M" hanya berguna saat keduanya berbeda;
// menampilkannya selalu justru menambah kebisingan.
function ringkasSaringan(jumlahTampil, jumlahTotal) {
    if (jumlahTampil === jumlahTotal) return '';
    return `MENAMPILKAN ${jumlahTampil} DARI ${jumlahTotal}`;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TEMA_DIKENAL,
        formatRupiah,
        formatRupiahSingkat,
        kelasTema,
        ringkasStatus,
        barisMeta,
        teksKonfirmasi,
        jedaPoll,
        STATUS_SARINGAN,
        cocokCari,
        cocokStatus,
        saringRiwayat,
        hitungStatus,
        ringkasSaringan,
    };
}
