import { describe, it, expect } from 'vitest';
import {
    AKSI, ID_AKSI, PINTASAN_BAWAAN, PINTASAN_SISTEM,
    normalkan, samaDengan, formatPintasan, dariEvent, validasi,
    bisaBentrokSaatMengetik, cariAksi, deteksiBentrok, gabungBawaan, keJson,
} from '../src/utils/pintasan.js';

const P = (key, { ctrl = true, shift = false, alt = false } = {}) => ({ ctrl, shift, alt, key });

describe('daftar aksi & bawaan', () => {
    it('setiap aksi punya pintasan bawaan', () => {
        ID_AKSI.forEach((id) => expect(PINTASAN_BAWAAN[id]).toBeTruthy());
    });

    it('setiap aksi punya label yang bisa dibaca operator', () => {
        AKSI.forEach((a) => expect(a.label.length).toBeGreaterThan(3));
    });

    // Bawaan yang bentrok satu sama lain berarti salah satunya tidak pernah
    // bisa dipakai sejak aplikasi pertama kali dijalankan.
    it('tidak ada dua bawaan yang identik', () => {
        const bentrok = deteksiBentrok(PINTASAN_BAWAAN).filter(b => b.teks.startsWith('Sama dengan'));
        expect(bentrok).toEqual([]);
    });

    it('seluruh bawaan lolos validasi', () => {
        ID_AKSI.forEach((id) => expect(validasi(PINTASAN_BAWAAN[id]).ok).toBe(true));
    });

    it('daftar pintasan sistem lengkap bentuknya', () => {
        PINTASAN_SISTEM.forEach((s) => {
            expect(normalkan(s.p)).toBeTruthy();
            expect(['kritis', 'waspada']).toContain(s.tingkat);
            expect(s.teks.length).toBeGreaterThan(3);
        });
    });

    // Bawaan yang merebut fungsi berbahaya (menutup/memuat ulang aplikasi)
    // berarti kiosk mati sendiri saat operator memakai pintasannya.
    it('tidak ada bawaan yang menabrak pintasan sistem tingkat kritis', () => {
        const kritis = deteksiBentrok(PINTASAN_BAWAAN).filter((b) => b.tingkat === 'kritis');
        expect(kritis).toEqual([]);
    });
});

describe('normalkan & samaDengan', () => {
    it('menyamakan huruf besar-kecil', () => {
        expect(samaDengan(P('p'), P('P'))).toBe(true);
    });

    it('membedakan kombinasi pengubah', () => {
        expect(samaDengan(P('P'), P('P', { shift: true }))).toBe(false);
        expect(samaDengan(P('P'), P('P', { alt: true }))).toBe(false);
    });

    it('menganggap pengubah yang hilang sebagai false, bukan undefined', () => {
        expect(samaDengan({ ctrl: true, key: 'P' }, P('P'))).toBe(true);
    });

    it.each([['null', null], ['undefined', undefined], ['tanpa key', { ctrl: true }]])(
        'tidak melempar untuk %s',
        (_, nilai) => {
            expect(normalkan(nilai)).toBeNull();
            expect(samaDengan(nilai, P('P'))).toBe(false);
        },
    );
});

describe('formatPintasan', () => {
    it('menyusun urutan pengubah yang konsisten', () => {
        expect(formatPintasan({ ctrl: true, shift: true, alt: false, key: 'P' })).toBe('Ctrl+Shift+P');
        expect(formatPintasan({ ctrl: true, shift: true, alt: true, key: 'P' })).toBe('Ctrl+Shift+Alt+P');
    });

    // Menampilkan "ARROWUP" ke operator sama saja dengan tidak menjelaskan.
    it('menampilkan tombol panah sebagai lambang', () => {
        expect(formatPintasan(PINTASAN_BAWAAN.tema_next)).toBe('Ctrl+↑');
        expect(formatPintasan(PINTASAN_BAWAAN.tema_prev)).toBe('Ctrl+↓');
    });

    it('memberi tanda hubung untuk pintasan kosong', () => {
        expect(formatPintasan(null)).toBe('—');
    });
});

describe('dariEvent', () => {
    it('membaca kombinasi dari event keyboard', () => {
        expect(dariEvent({ key: 'p', ctrlKey: true, shiftKey: true, altKey: false }))
            .toEqual({ ctrl: true, shift: true, alt: false, key: 'P' });
    });

    // Tanpa ini, menahan Ctrl untuk menyusun kombinasi langsung terekam
    // sebagai "pintasan Ctrl" sebelum tombol keduanya sempat ditekan.
    it.each(['Control', 'Shift', 'Alt', 'Meta'])('mengabaikan tombol pengubah %s sendirian', (k) => {
        expect(dariEvent({ key: k, ctrlKey: true })).toBeNull();
    });

    it('mengembalikan null untuk event tanpa key', () => {
        expect(dariEvent({})).toBeNull();
        expect(dariEvent(null)).toBeNull();
    });
});

describe('validasi', () => {
    // Pintasan tanpa pengubah menyala setiap kali huruf itu diketik — di
    // kiosk yang punya kolom nama pelanggan, itu fatal.
    it('menolak pintasan tanpa Ctrl maupun Alt', () => {
        const v = validasi({ ctrl: false, shift: true, alt: false, key: 'P' });
        expect(v.ok).toBe(false);
        expect(v.error).toContain('Ctrl');
    });

    it('menerima Alt saja sebagai pengubah yang sah', () => {
        expect(validasi({ ctrl: false, shift: false, alt: true, key: 'P' }).ok).toBe(true);
    });

    it.each([['null', null], ['tanpa key', { ctrl: true }], ['string', 'Ctrl+P']])(
        'menolak masukan %s',
        (_, nilai) => { expect(validasi(nilai).ok).toBe(false); },
    );
});

describe('bisaBentrokSaatMengetik', () => {
    // Inilah alasan Ctrl+X bawaan tetap aman: ia diabaikan selama kursor
    // berada di kolom teks, sehingga "potong" tetap berfungsi.
    it('menandai Ctrl+huruf tanpa pengubah lain', () => {
        expect(bisaBentrokSaatMengetik(PINTASAN_BAWAAN.close_session)).toBe(true);
    });

    it('tidak menandai kombinasi yang memakai Shift', () => {
        expect(bisaBentrokSaatMengetik(PINTASAN_BAWAAN.settings)).toBe(false);
    });

    it('tidak menandai tombol panah', () => {
        expect(bisaBentrokSaatMengetik(PINTASAN_BAWAAN.tema_next)).toBe(false);
    });
});

describe('cariAksi', () => {
    it('menemukan aksi dari kombinasi yang ditekan', () => {
        expect(cariAksi(PINTASAN_BAWAAN, P('P', { shift: true }))).toBe('settings');
        expect(cariAksi(PINTASAN_BAWAAN, P('X'))).toBe('close_session');
    });

    it('mengembalikan null untuk kombinasi yang tidak dipetakan', () => {
        expect(cariAksi(PINTASAN_BAWAAN, P('K'))).toBeNull();
    });

    it('tidak melempar untuk peta kosong', () => {
        expect(cariAksi(null, P('P'))).toBeNull();
        expect(cariAksi({}, null)).toBeNull();
    });
});

describe('deteksiBentrok', () => {
    it('diam untuk peta bawaan, kecuali peringatan sistem yang memang disadari', () => {
        const b = deteksiBentrok(PINTASAN_BAWAAN);
        expect(b.every((x) => x.tingkat === 'waspada')).toBe(true);
    });

    // Ctrl+X bawaan MEMANG beririsan dengan "potong". Ini disadari dan
    // ditangani lewat penjagaan saat mengetik — bukan diabaikan diam-diam.
    it('mengakui Ctrl+X bawaan beririsan dengan perintah potong', () => {
        const b = deteksiBentrok(PINTASAN_BAWAAN).find((x) => x.aksi === 'close_session');
        expect(b).toBeTruthy();
        expect(b.tingkat).toBe('waspada');
        expect(b.teks).toContain('potong');
    });

    it('menandai dua aksi yang memakai pintasan sama sebagai kritis', () => {
        const b = deteksiBentrok({ ...PINTASAN_BAWAAN, template: { ...PINTASAN_BAWAAN.settings } });
        const kembar = b.find((x) => x.aksi === 'template');
        expect(kembar.tingkat).toBe('kritis');
        expect(kembar.teks).toContain('Buka Pengaturan');
    });

    it('melaporkan bentrok kembar sekali saja, bukan dua kali', () => {
        const b = deteksiBentrok({ ...PINTASAN_BAWAAN, template: { ...PINTASAN_BAWAAN.settings } });
        expect(b.filter((x) => x.teks.startsWith('Sama dengan'))).toHaveLength(1);
    });

    it.each([
        ['Ctrl+W', P('W'), 'kritis'],
        ['Ctrl+R', P('R'), 'kritis'],
        ['Ctrl+Q', P('Q'), 'kritis'],
        ['Ctrl+Shift+I', P('I', { shift: true }), 'kritis'],
        ['Ctrl+C', P('C'), 'waspada'],
    ])('menandai %s yang direbut dari sistem', (_, pintasan, tingkat) => {
        const b = deteksiBentrok({ ...PINTASAN_BAWAAN, settings: pintasan });
        const temuan = b.find((x) => x.aksi === 'settings');
        expect(temuan.tingkat).toBe(tingkat);
    });

    it('tidak melempar untuk peta kosong', () => {
        expect(deteksiBentrok(null)).toEqual([]);
        expect(deteksiBentrok({})).toEqual([]);
    });
});

describe('gabungBawaan', () => {
    it('memakai bawaan bila belum pernah diubah', () => {
        expect(gabungBawaan('')).toEqual(PINTASAN_BAWAAN);
        expect(gabungBawaan(null)).toEqual(PINTASAN_BAWAAN);
    });

    it('menerapkan hanya aksi yang benar-benar diubah', () => {
        const peta = gabungBawaan(JSON.stringify({ settings: P('K', { shift: true }) }));
        expect(peta.settings.key).toBe('K');
        expect(peta.template).toEqual(PINTASAN_BAWAAN.template);
    });

    // Kiosk tidak boleh kehilangan SELURUH pintasannya hanya karena satu
    // baris JSON cacat — itu membuat panel admin tak terjangkau di mesin
    // yang punya keyboard.
    it.each([
        ['JSON rusak', '{bukan json'],
        ['bukan objek', '"teks"'],
        ['array', '[1,2,3]'],
        ['null literal', 'null'],
    ])('jatuh ke bawaan penuh untuk %s', (_, json) => {
        expect(gabungBawaan(json)).toEqual(PINTASAN_BAWAAN);
    });

    it('membuang pintasan tersimpan yang tidak sah', () => {
        const peta = gabungBawaan(JSON.stringify({ settings: { ctrl: false, shift: false, key: 'P' } }));
        expect(peta.settings).toEqual(PINTASAN_BAWAAN.settings);
    });

    it('mengabaikan aksi yang tidak dikenal', () => {
        const peta = gabungBawaan(JSON.stringify({ aksi_hantu: P('K') }));
        expect(peta.aksi_hantu).toBeUndefined();
        expect(Object.keys(peta).sort()).toEqual([...ID_AKSI].sort());
    });
});

describe('keJson', () => {
    // Peta yang seluruhnya bawaan disimpan kosong, supaya perubahan bawaan
    // di versi mendatang tetap sampai ke pemasangan yang tidak pernah
    // mengubah apa pun.
    it('menyimpan string kosong bila tidak ada yang diubah', () => {
        expect(keJson(PINTASAN_BAWAAN)).toBe('');
    });

    it('hanya menyimpan yang berbeda dari bawaan', () => {
        const json = keJson({ ...PINTASAN_BAWAAN, settings: P('K', { shift: true }) });
        expect(Object.keys(JSON.parse(json))).toEqual(['settings']);
    });

    it('bolak-balik lewat gabungBawaan menghasilkan peta yang sama', () => {
        const asal = { ...PINTASAN_BAWAAN, dashboard: P('J', { alt: true }) };
        expect(gabungBawaan(keJson(asal))).toEqual(asal);
    });

    it('tidak melempar untuk masukan kosong', () => {
        expect(keJson(null)).toBe('');
        expect(keJson({})).toBe('');
    });
});
