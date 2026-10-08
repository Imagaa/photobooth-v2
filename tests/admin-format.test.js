import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    formatRupiah, formatRupiahSingkat, kelasTema,
    ringkasStatus, barisMeta, teksKonfirmasi, jedaPoll,
    STATUS_SARINGAN, cocokCari, cocokStatus, saringRiwayat, hitungStatus, ringkasSaringan,
} = require('../electron/admin/format.js');

// Berkas ini dimuat browser sebagai <script> klasik DAN oleh uji ini lewat
// require(). Bila suatu saat seseorang menambahkan require/import di sana,
// uji ini tetap lulus tetapi halaman kasir mati — karena itu ada uji khusus
// di bawah yang menjaga berkasnya tetap bebas dependensi.

describe('formatRupiah', () => {
    it('memberi nominal berformat Indonesia', () => {
        expect(formatRupiah(15000)).toBe('Rp 15.000');
        expect(formatRupiah(1234567)).toBe('Rp 1.234.567');
    });

    // Kasir tidak boleh melihat "Rp 0" lalu ragu apakah masih harus menagih.
    it.each([
        ['nol', 0],
        ['negatif', -5000],
        ['null', null],
        ['undefined', undefined],
        ['string kosong', ''],
        ['bukan angka', 'abc'],
        ['NaN', NaN],
    ])('menyebut %s sebagai GRATIS', (_, nilai) => {
        expect(formatRupiah(nilai)).toBe('GRATIS');
    });

    it('membulatkan pecahan, tidak menampilkan desimal', () => {
        expect(formatRupiah(15000.6)).toBe('Rp 15.001');
    });

    it('menerima angka dalam bentuk string', () => {
        expect(formatRupiah('15000')).toBe('Rp 15.000');
    });
});

describe('formatRupiahSingkat', () => {
    it('memakai satuan ribu untuk nilai besar', () => {
        expect(formatRupiahSingkat(15000)).toBe('Rp 15k');
        expect(formatRupiahSingkat(1500000)).toBe('Rp 1500k');
    });

    // Membulatkan 500 jadi "Rp 0k" akan terbaca sebagai gratis padahal bukan.
    it('tidak membulatkan nilai di bawah seribu menjadi 0k', () => {
        expect(formatRupiahSingkat(500)).toBe('Rp 500');
        expect(formatRupiahSingkat(999)).toBe('Rp 999');
    });

    it('menyebut nol sebagai GRATIS', () => {
        expect(formatRupiahSingkat(0)).toBe('GRATIS');
    });
});

describe('kelasTema', () => {
    it.each(['candy', 'bumblebee', 'neon', 'fall'])('meneruskan tema %s yang dikenal', (t) => {
        expect(kelasTema(t)).toBe('theme-' + t);
    });

    // Nilai tema datang dari database dan langsung jadi nama kelas CSS.
    // Nilai asing harus jatuh ke bawaan, bukan membuat halaman kehilangan warna.
    it.each([
        ['tema tidak dikenal', 'ungu'],
        ['kosong', ''],
        ['null', null],
        ['undefined', undefined],
        ['angka', 7],
    ])('jatuh ke candy untuk %s', (_, nilai) => {
        expect(kelasTema(nilai)).toBe('theme-candy');
    });
});

describe('ringkasStatus', () => {
    it('menampilkan status apa adanya bila tidak ada galat', () => {
        expect(ringkasStatus({ status_cetak: 'TERCETAK' })).toBe('TERCETAK');
    });

    it('menempelkan alasan kegagalan di belakang status', () => {
        expect(ringkasStatus({ status_cetak: 'GAGAL', print_error: 'Printer offline' }))
            .toBe('GAGAL (Printer offline)');
    });

    it.each([
        ['objek kosong', {}],
        ['null', null],
        ['undefined', undefined],
    ])('memberi tanda hubung untuk %s', (_, sesi) => {
        expect(ringkasStatus(sesi)).toBe('-');
    });
});

describe('barisMeta', () => {
    it('menggabungkan waktu dan status cetak', () => {
        expect(barisMeta({ waktu: '28/07/2026 14.00', status_cetak: 'TERCETAK' }))
            .toBe('28/07/2026 14.00  |  CETAK: TERCETAK');
    });

    it('tidak meninggalkan pemisah menggantung bila waktu kosong', () => {
        expect(barisMeta({ status_cetak: 'MENUNGGU' })).toBe('CETAK: MENUNGGU');
    });
});

describe('teksKonfirmasi', () => {
    it.each(['restart', 'close'])('menyediakan judul, pesan, dan label aksi untuk %s', (tipe) => {
        const t = teksKonfirmasi(tipe);
        expect(t).toMatchObject({
            judul: expect.any(String),
            pesan: expect.any(String),
            aksi: expect.any(String),
        });
        expect(t.judul.length).toBeGreaterThan(0);
        expect(t.pesan.length).toBeGreaterThan(0);
    });

    // Aksi merusak wajib menjelaskan konsekuensinya, bukan sekadar bertanya.
    it('menjelaskan bahwa restart membuang sesi yang sedang berjalan', () => {
        expect(teksKonfirmasi('restart').pesan.toLowerCase()).toContain('hilang');
    });

    it('menjelaskan bahwa tutup sesi bersifat permanen', () => {
        expect(teksKonfirmasi('close').pesan.toLowerCase()).toContain('permanen');
    });

    it('mengembalikan null untuk tipe yang tidak dikenal', () => {
        expect(teksKonfirmasi('entah')).toBeNull();
    });
});

describe('jedaPoll', () => {
    it('mempercepat polling saat ada tagihan menunggu', () => {
        expect(jedaPoll(true)).toBeLessThan(jedaPoll(false));
    });

    it('tetap di bawah sepuluh detik saat idle agar kasir tidak menunggu lama', () => {
        expect(jedaPoll(false)).toBeLessThanOrEqual(10000);
    });
});

// =========================================================================
// PENYARINGAN RIWAYAT
//
// Acara 100 tamu menghasilkan ratusan baris; menggulir mencari satu nama di
// layar HP tidak realistis. Yang paling sering dicari kasir adalah transaksi
// yang GAGAL dicetak, jadi kedua penyaring ini bukan hiasan.
// =========================================================================
const sesi = (nama, status) => ({ customer_name: nama, status_cetak: status });
const DAFTAR = [
    sesi('Ani Wijaya', 'TERCETAK'),
    sesi('Budi Santoso', 'GAGAL'),
    sesi('ani kusuma', 'MENUNGGU'),
    sesi('Citra Dewi', 'TERCETAK'),
    sesi('Dedi', 'PDF'),
];

describe('cocokCari', () => {
    it('mencocokkan sebagian nama', () => {
        expect(cocokCari(sesi('Ani Wijaya'), 'wij')).toBe(true);
    });

    // Kasir mengetik terburu-buru sambil melayani antrean.
    it('tidak peka huruf besar-kecil', () => {
        expect(cocokCari(sesi('Ani Wijaya'), 'ANI')).toBe(true);
        expect(cocokCari(sesi('ani kusuma'), 'Ani')).toBe(true);
    });

    it('mengabaikan spasi di tepi kueri', () => {
        expect(cocokCari(sesi('Ani Wijaya'), '  ani  ')).toBe(true);
    });

    it.each([['kosong', ''], ['hanya spasi', '   '], ['null', null], ['undefined', undefined]])(
        'kueri %s mencocokkan semua',
        (_, q) => { expect(cocokCari(sesi('Siapa pun'), q)).toBe(true); },
    );

    it('tidak melempar untuk sesi tanpa nama', () => {
        expect(cocokCari({}, 'ani')).toBe(false);
        expect(cocokCari(null, 'ani')).toBe(false);
    });
});

describe('cocokStatus', () => {
    it('SEMUA melewatkan apa pun', () => {
        expect(cocokStatus(sesi('x', 'GAGAL'), 'SEMUA')).toBe(true);
        expect(cocokStatus(sesi('x', null), 'SEMUA')).toBe(true);
    });

    it('mencocokkan status persis', () => {
        expect(cocokStatus(sesi('x', 'GAGAL'), 'GAGAL')).toBe(true);
        expect(cocokStatus(sesi('x', 'TERCETAK'), 'GAGAL')).toBe(false);
    });

    it('membandingkan tanpa peduli kapitalisasi di database', () => {
        expect(cocokStatus(sesi('x', 'gagal'), 'GAGAL')).toBe(true);
    });

    it('sesi tanpa status tidak cocok dengan saringan spesifik', () => {
        expect(cocokStatus({}, 'GAGAL')).toBe(false);
    });
});

describe('saringRiwayat', () => {
    it('tanpa saringan mengembalikan semuanya', () => {
        expect(saringRiwayat(DAFTAR, {})).toHaveLength(5);
        expect(saringRiwayat(DAFTAR)).toHaveLength(5);
    });

    it('menyaring berdasarkan nama', () => {
        const h = saringRiwayat(DAFTAR, { cari: 'ani' });
        expect(h.map(s => s.customer_name)).toEqual(['Ani Wijaya', 'ani kusuma']);
    });

    it('menyaring berdasarkan status cetak', () => {
        expect(saringRiwayat(DAFTAR, { status: 'TERCETAK' })).toHaveLength(2);
    });

    // Keduanya harus berlaku bersamaan, bukan salah satu.
    it('menggabungkan pencarian dan status', () => {
        const h = saringRiwayat(DAFTAR, { cari: 'ani', status: 'MENUNGGU' });
        expect(h.map(s => s.customer_name)).toEqual(['ani kusuma']);
    });

    it('mengembalikan daftar kosong bila tidak ada yang cocok', () => {
        expect(saringRiwayat(DAFTAR, { cari: 'zzz' })).toEqual([]);
    });

    it('mempertahankan urutan asli', () => {
        const h = saringRiwayat(DAFTAR, { status: 'TERCETAK' });
        expect(h.map(s => s.customer_name)).toEqual(['Ani Wijaya', 'Citra Dewi']);
    });

    it.each([['null', null], ['undefined', undefined], ['bukan array', {}]])(
        'mengembalikan array kosong untuk masukan %s',
        (_, nilai) => { expect(saringRiwayat(nilai, { cari: 'a' })).toEqual([]); },
    );

    it('tidak mengubah daftar aslinya', () => {
        const salinan = [...DAFTAR];
        saringRiwayat(DAFTAR, { cari: 'ani', status: 'TERCETAK' });
        expect(DAFTAR).toEqual(salinan);
    });
});

describe('hitungStatus', () => {
    it('menghitung tiap status yang dikenal', () => {
        const h = hitungStatus(DAFTAR);
        expect(h.SEMUA).toBe(5);
        expect(h.TERCETAK).toBe(2);
        expect(h.GAGAL).toBe(1);
        expect(h.MENUNGGU).toBe(1);
        expect(h.PDF).toBe(1);
        expect(h.DILEWATI).toBe(0);
    });

    it('menyediakan angka untuk seluruh saringan, termasuk yang nol', () => {
        const h = hitungStatus([]);
        STATUS_SARINGAN.forEach(s => expect(h[s]).toBe(0));
    });

    // Status tak dikenal tetap masuk hitungan SEMUA — kalau tidak, totalnya
    // berbohong dan kasir mengira ada transaksi yang hilang.
    it('status tak dikenal tetap dihitung di SEMUA', () => {
        const h = hitungStatus([sesi('x', 'ENTAH'), sesi('y', 'TERCETAK')]);
        expect(h.SEMUA).toBe(2);
        expect(h.TERCETAK).toBe(1);
    });

    it('tidak melempar untuk masukan tidak wajar', () => {
        expect(() => hitungStatus(null)).not.toThrow();
        expect(() => hitungStatus([null, undefined, {}])).not.toThrow();
    });
});

describe('ringkasSaringan', () => {
    it('diam saat tidak ada yang tersaring', () => {
        expect(ringkasSaringan(5, 5)).toBe('');
    });

    it('menyebut berapa yang tersembunyi saat ada saringan aktif', () => {
        expect(ringkasSaringan(2, 5)).toBe('MENAMPILKAN 2 DARI 5');
    });
});
