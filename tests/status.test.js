import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    GB, DISK_KRITIS, DISK_WASPADA, TINGKAT,
    formatBytes, tingkatDisk, ringkasAntrean, ringkasPrinter,
    daftarPeringatan, tingkatTertinggi,
} = require('../electron/status.js');

describe('formatBytes', () => {
    it('memakai satuan yang wajar dibaca manusia', () => {
        expect(formatBytes(12.1 * GB)).toBe('12,1 GB');
        expect(formatBytes(500 * 1024 * 1024)).toBe('500 MB');
        expect(formatBytes(2048)).toBe('2 KB');
        expect(formatBytes(512)).toBe('512 B');
    });

    it('memakai koma sebagai pemisah desimal', () => {
        expect(formatBytes(1.5 * GB)).toContain(',');
        expect(formatBytes(1.5 * GB)).not.toContain('.');
    });

    it.each([['null', null], ['undefined', undefined], ['negatif', -1], ['bukan angka', 'abc']])(
        'memberi tanda hubung untuk %s',
        (_, nilai) => { expect(formatBytes(nilai)).toBe('—'); },
    );
});

describe('tingkatDisk', () => {
    it('sehat saat ruang masih lega', () => {
        expect(tingkatDisk(50 * GB)).toBe(TINGKAT.OK);
    });

    it('waspada tepat di bawah ambang longgar', () => {
        expect(tingkatDisk(DISK_WASPADA - 1)).toBe(TINGKAT.WASPADA);
    });

    it('kritis tepat di bawah ambang sempit', () => {
        expect(tingkatDisk(DISK_KRITIS - 1)).toBe(TINGKAT.KRITIS);
    });

    it('ambangnya inklusif ke atas, bukan ke bawah', () => {
        expect(tingkatDisk(DISK_KRITIS)).toBe(TINGKAT.WASPADA);
        expect(tingkatDisk(DISK_WASPADA)).toBe(TINGKAT.OK);
    });

    // Gagal membaca disk bukan bukti aman. Melaporkannya sebagai sehat
    // membuat masalah nyata terlihat baik-baik saja.
    it.each([[null], [undefined], [NaN], [-5]])('tidak menyebut nilai tak terbaca (%s) sebagai sehat', (nilai) => {
        expect(tingkatDisk(nilai)).toBe(TINGKAT.WASPADA);
    });
});

describe('ringkasAntrean', () => {
    it('menjumlahkan yang belum terunggah', () => {
        const r = ringkasAntrean({ pending: 3, uploading: 1, done: 10, failed: 0 });
        expect(r.belum).toBe(4);
        expect(r.tingkat).toBe(TINGKAT.WASPADA);
    });

    it('menandai kritis begitu ada satu saja yang gagal', () => {
        expect(ringkasAntrean({ pending: 0, uploading: 0, done: 5, failed: 1 }).tingkat).toBe(TINGKAT.KRITIS);
    });

    it('gagal lebih berat daripada sekadar menumpuk', () => {
        const menumpuk = ringkasAntrean({ pending: 99, failed: 0 });
        const gagal = ringkasAntrean({ pending: 0, failed: 1 });
        expect(menumpuk.tingkat).toBe(TINGKAT.WASPADA);
        expect(gagal.tingkat).toBe(TINGKAT.KRITIS);
    });

    it('sehat saat semuanya sudah selesai', () => {
        expect(ringkasAntrean({ pending: 0, uploading: 0, done: 20, failed: 0 }).tingkat).toBe(TINGKAT.OK);
    });

    it.each([['objek kosong', {}], ['null', null], ['undefined', undefined]])(
        'tidak melempar untuk %s',
        (_, nilai) => {
            const r = ringkasAntrean(nilai);
            expect(r).toMatchObject({ pending: 0, uploading: 0, done: 0, failed: 0, belum: 0 });
        },
    );

    it('memperlakukan nilai bukan angka sebagai nol', () => {
        expect(ringkasAntrean({ pending: 'abc', failed: null }).belum).toBe(0);
    });
});

describe('ringkasPrinter', () => {
    // Kelas kesalahan paling sering di lapangan: printer diganti atau namanya
    // berubah setelah driver diinstal ulang, sementara pengaturan menunjuk
    // nama lama. Cetak tetap jalan ke printer bawaan — diam-diam.
    it('menandai kritis bila printer terpilih tidak ada di daftar', () => {
        const r = ringkasPrinter({ dipilih: 'Canon SELPHY', tersedia: ['EPSON L3110'], cetakAktif: true });
        expect(r.tingkat).toBe(TINGKAT.KRITIS);
        expect(r.teks).toContain('Canon SELPHY');
    });

    it('sehat bila printer terpilih benar-benar ada', () => {
        const r = ringkasPrinter({ dipilih: 'EPSON L3110', tersedia: ['EPSON L3110', 'PDF'], cetakAktif: true });
        expect(r.tingkat).toBe(TINGKAT.OK);
        expect(r.teks).toBe('EPSON L3110');
    });

    it('menandai kritis bila tidak ada printer sama sekali', () => {
        expect(ringkasPrinter({ dipilih: '', tersedia: [], cetakAktif: true }).tingkat).toBe(TINGKAT.KRITIS);
    });

    it('mengingatkan bila belum ada printer dipilih', () => {
        const r = ringkasPrinter({ dipilih: '', tersedia: ['EPSON L3110'], cetakAktif: true });
        expect(r.tingkat).toBe(TINGKAT.WASPADA);
    });

    // Keduanya kondisi sengaja, bukan kerusakan — tapi operator tetap harus
    // tahu, karena keduanya berarti lembar fisik tidak akan keluar.
    it('melaporkan mode bypass sebagai waspada, bukan kerusakan', () => {
        const r = ringkasPrinter({ dipilih: '', tersedia: [], cetakAktif: true, bypass: true });
        expect(r.tingkat).toBe(TINGKAT.WASPADA);
        expect(r.teks).toContain('BYPASS');
    });

    it('melaporkan cetak otomatis yang dimatikan', () => {
        const r = ringkasPrinter({ dipilih: 'EPSON', tersedia: ['EPSON'], cetakAktif: false });
        expect(r.tingkat).toBe(TINGKAT.WASPADA);
        expect(r.teks).toContain('DIMATIKAN');
    });

    it('bypass diperiksa lebih dulu daripada ketiadaan printer', () => {
        // Mode bypass memang dipakai justru saat printer tidak terpasang;
        // melaporkan "TIDAK ADA PRINTER" di situ hanya kebisingan.
        expect(ringkasPrinter({ tersedia: [], bypass: true }).teks).toContain('BYPASS');
    });

    it('tidak melempar tanpa argumen', () => {
        expect(() => ringkasPrinter()).not.toThrow();
    });
});

describe('daftarPeringatan', () => {
    const sehat = {
        pinBawaan: false,
        diskBebasBytes: 50 * GB,
        modeOnline: true,
        driveTerhubung: true,
        antrean: { pending: 0, uploading: 0, done: 5, failed: 0 },
        printer: { dipilih: 'EPSON', tersedia: ['EPSON'], cetakAktif: true },
    };

    it('diam saat semuanya sehat', () => {
        expect(daftarPeringatan(sehat)).toEqual([]);
    });

    it('menyebut PIN bawaan sebagai kritis', () => {
        const p = daftarPeringatan({ ...sehat, pinBawaan: true });
        expect(p).toHaveLength(1);
        expect(p[0].tingkat).toBe(TINGKAT.KRITIS);
        expect(p[0].teks).toContain('1234');
    });

    it('menjelaskan akibat disk kritis, bukan hanya angkanya', () => {
        const p = daftarPeringatan({ ...sehat, diskBebasBytes: 1 * GB });
        expect(p[0].teks).toContain('FOTO BISA GAGAL DISIMPAN');
    });

    // Disk yang gagal dibaca tidak boleh menyamar sebagai disk yang menipis;
    // keduanya menuntut tindakan yang berbeda dari operator.
    it.each([['null', null], ['undefined', undefined]])(
        'membedakan disk tak terbaca (%s) dari disk menipis',
        (_, nilai) => {
            const p = daftarPeringatan({ ...sehat, diskBebasBytes: nilai });
            expect(p[0].teks).toBe('SISA DISK TIDAK TERBACA');
            expect(p[0].teks).not.toContain('—  ');
        },
    );

    it('menyebut unggahan gagal sebagai belum punya cadangan', () => {
        const p = daftarPeringatan({ ...sehat, antrean: { failed: 3 } });
        expect(p.some((x) => x.teks.includes('BELUM ADA CADANGAN'))).toBe(true);
    });

    // Mode online mengantar hasil lewat Drive; tanpa akun tertaut, QR untuk
    // pelanggan tidak bisa dibuat sama sekali.
    it('menandai mode online tanpa Drive terhubung', () => {
        const p = daftarPeringatan({ ...sehat, driveTerhubung: false });
        expect(p.some((x) => x.teks.includes('BELUM TERHUBUNG'))).toBe(true);
    });

    it('tidak mempermasalahkan Drive saat mode offline', () => {
        expect(daftarPeringatan({ ...sehat, modeOnline: false, driveTerhubung: false })).toEqual([]);
    });

    it('menempatkan yang kritis di atas yang waspada', () => {
        const p = daftarPeringatan({
            ...sehat,
            diskBebasBytes: 5 * GB,          // waspada
            printer: { dipilih: 'Hilang', tersedia: ['Ada'], cetakAktif: true }, // kritis
        });
        expect(p[0].tingkat).toBe(TINGKAT.KRITIS);
        expect(p[p.length - 1].tingkat).toBe(TINGKAT.WASPADA);
    });

    it('mengumpulkan beberapa masalah sekaligus', () => {
        const p = daftarPeringatan({
            pinBawaan: true,
            diskBebasBytes: 1 * GB,
            modeOnline: true,
            driveTerhubung: false,
            antrean: { failed: 2 },
            printer: { dipilih: '', tersedia: [], cetakAktif: true },
        });
        expect(p.length).toBeGreaterThanOrEqual(5);
        expect(p.every((x) => x.tingkat === TINGKAT.KRITIS)).toBe(true);
    });

    it('tidak melempar untuk masukan kosong', () => {
        expect(() => daftarPeringatan()).not.toThrow();
        expect(() => daftarPeringatan({})).not.toThrow();
    });
});

describe('tingkatTertinggi', () => {
    it('sehat bila tidak ada temuan', () => {
        expect(tingkatTertinggi([])).toBe(TINGKAT.OK);
        expect(tingkatTertinggi(null)).toBe(TINGKAT.OK);
    });

    it('mengambil yang paling parah, bukan yang pertama', () => {
        expect(tingkatTertinggi([
            { tingkat: TINGKAT.WASPADA }, { tingkat: TINGKAT.KRITIS }, { tingkat: TINGKAT.WASPADA },
        ])).toBe(TINGKAT.KRITIS);
    });

    it('tetap waspada bila tidak ada yang kritis', () => {
        expect(tingkatTertinggi([{ tingkat: TINGKAT.WASPADA }])).toBe(TINGKAT.WASPADA);
    });
});
