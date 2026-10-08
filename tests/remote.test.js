import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    PANEL_ADMIN, KENDALI_SESI, PANEL_DIIZINKAN, ARAH_TEMA,
    validasiPanel, validasiArahTema, butuhPin,
} = require('../electron/remote.js');

// Nilai yang divalidasi di sini datang dari potongan URL yang dikirim HP
// kasir. Meneruskannya mentah ke renderer berarti siapa pun yang memegang
// token bisa menyuruh kiosk melakukan hal yang tidak pernah dirancang.

describe('validasiPanel', () => {
    it.each([...PANEL_DIIZINKAN])('menerima panel %s yang terdaftar', (nama) => {
        expect(validasiPanel(nama)).toEqual({ ok: true, nilai: nama });
    });

    it.each([
        ['nama karangan', 'hapus-semua'],
        ['kosong', ''],
        ['undefined', undefined],
        ['null', null],
        ['angka', 3],
        ['objek', {}],
        ['array berisi nama sah', ['settings']],
    ])('menolak %s', (_, nilai) => {
        expect(validasiPanel(nilai).ok).toBe(false);
    });

    // Beda huruf besar-kecil bukan "hampir benar" — ia tidak ada di daftar.
    it('menolak beda kapitalisasi', () => {
        expect(validasiPanel('Settings').ok).toBe(false);
        expect(validasiPanel('SETTINGS').ok).toBe(false);
    });

    // Percobaan menembus daftar putih lewat bentuk path.
    it.each(['settings/../restart', '../settings', 'settings ', ' settings'])(
        'menolak variasi path %s',
        (nilai) => {
            expect(validasiPanel(nilai).ok).toBe(false);
        },
    );

    it('tidak pernah mengembalikan nilai selain yang diminta', () => {
        expect(validasiPanel('dashboard').nilai).toBe('dashboard');
    });
});

describe('validasiArahTema', () => {
    it.each([...ARAH_TEMA])('menerima arah %s', (arah) => {
        expect(validasiArahTema(arah)).toEqual({ ok: true, nilai: arah });
    });

    it.each(['up', 'down', 'NEXT', '', null, undefined, 1, -1])('menolak %s', (nilai) => {
        expect(validasiArahTema(nilai).ok).toBe(false);
    });
});

describe('butuhPin', () => {
    // Inilah janji yang dipegang seluruh fitur ini: HP boleh MEMICU panel
    // admin, tetapi gerbang PIN di layar kiosk tetap berlaku.
    it.each([...PANEL_ADMIN])('menuntut PIN untuk panel admin %s', (nama) => {
        expect(butuhPin(nama)).toBe(true);
    });

    // Kendali sesi setara /api/restart & /api/close yang sudah ada: token
    // kasir sudah cukup, karena ia tidak membuka data maupun pengaturan.
    it.each([...KENDALI_SESI])('tidak menuntut PIN untuk kendali sesi %s', (nama) => {
        expect(butuhPin(nama)).toBe(false);
    });

    it('tidak menganggap nama asing sebagai panel admin', () => {
        expect(butuhPin('hapus-semua')).toBe(false);
    });

    // Penjaga terhadap kelalaian di masa depan: setiap panel yang ditambahkan
    // ke daftar admin HARUS ikut terjaga PIN, dan tidak boleh ada nama yang
    // muncul di dua kategori sekaligus.
    it('tidak ada panel yang berada di dua kategori sekaligus', () => {
        const tumpang = PANEL_ADMIN.filter((n) => KENDALI_SESI.includes(n));
        expect(tumpang).toEqual([]);
    });

    it('setiap panel yang diizinkan punya kategori yang jelas', () => {
        PANEL_DIIZINKAN.forEach((nama) => {
            expect(PANEL_ADMIN.includes(nama) || KENDALI_SESI.includes(nama)).toBe(true);
        });
    });
});
