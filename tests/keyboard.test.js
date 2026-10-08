import { describe, it, expect } from 'vitest';
import {
    BARIS_ANGKA, BARIS_HURUF, BARIS_SIMBOL, TOMBOL_KHUSUS,
    terapkanTombol, hurufTampil,
} from '../src/utils/keyboard.js';

describe('tata letak', () => {
    it('menyediakan seluruh angka 0-9', () => {
        expect([...BARIS_ANGKA].sort()).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    });

    it('menyediakan 26 huruf tanpa duplikat', () => {
        const semua = BARIS_HURUF.flat();
        expect(semua).toHaveLength(26);
        expect(new Set(semua).size).toBe(26);
    });

    // Kelimanya bukan pilihan gaya: tanpa mereka, ID folder Drive, alamat
    // email akun, dan path tidak bisa diketik sama sekali dari layar sentuh.
    it.each(['.', '-', '_', '@', '/'])('menyediakan simbol %s yang dibutuhkan kolom admin', (s) => {
        expect(BARIS_SIMBOL).toContain(s);
    });

    it('tidak mencampur tombol khusus ke dalam baris karakter', () => {
        const karakter = [...BARIS_ANGKA, ...BARIS_HURUF.flat(), ...BARIS_SIMBOL];
        TOMBOL_KHUSUS.forEach((t) => expect(karakter).not.toContain(t));
    });
});

describe('terapkanTombol: karakter', () => {
    it('menambahkan huruf di akhir', () => {
        expect(terapkanTombol('ab', 'C')).toBe('abc');
    });

    it('menambahkan angka apa adanya', () => {
        expect(terapkanTombol('kode', '7')).toBe('kode7');
    });

    it.each(BARIS_SIMBOL)('menambahkan simbol %s apa adanya', (s) => {
        expect(terapkanTombol('x', s)).toBe('x' + s);
    });

    it('menghormati SHIFT untuk huruf', () => {
        expect(terapkanTombol('', 'S', { shift: true })).toBe('S');
        expect(terapkanTombol('', 'S', { shift: false })).toBe('s');
    });

    // SHIFT tidak boleh mengubah angka maupun simbol menjadi karakter lain.
    it.each(['7', '-', '@', '.'])('SHIFT tidak mengubah %s', (k) => {
        expect(terapkanTombol('', k, { shift: true })).toBe(k);
    });

    it('bawaannya huruf kecil bila shift tidak disebut', () => {
        expect(terapkanTombol('', 'A')).toBe('a');
    });
});

describe('terapkanTombol: tombol khusus', () => {
    it('DEL menghapus satu karakter terakhir', () => {
        expect(terapkanTombol('abc', 'DEL')).toBe('ab');
    });

    it('DEL pada nilai kosong tetap kosong, tidak melempar', () => {
        expect(terapkanTombol('', 'DEL')).toBe('');
    });

    it('CLR mengosongkan seluruh nilai', () => {
        expect(terapkanTombol('SB-Mid-server-panjang-sekali', 'CLR')).toBe('');
    });

    it('SPACE menambahkan spasi', () => {
        expect(terapkanTombol('Pesta', 'SPACE')).toBe('Pesta ');
    });

    // SHIFT hanya mengubah tampilan tombol berikutnya. Kalau ia ikut mengubah
    // nilai, menekannya akan merusak apa yang sudah diketik.
    it('SHIFT tidak mengubah nilai sama sekali', () => {
        expect(terapkanTombol('abc', 'SHIFT')).toBe('abc');
        expect(terapkanTombol('abc', 'SHIFT', { shift: true })).toBe('abc');
    });
});

describe('terapkanTombol: masukan tidak wajar', () => {
    it.each([['null', null], ['undefined', undefined]])(
        'memperlakukan nilai %s sebagai string kosong',
        (_, nilai) => { expect(terapkanTombol(nilai, 'A')).toBe('a'); },
    );

    it('menerima nilai berupa angka', () => {
        expect(terapkanTombol(15000, '0')).toBe('150000');
    });

    // Salah ketik nama tombol di komponen tidak boleh berakhir di dalam data
    // operator — misalnya "ENTER" tertempel ke tengah Midtrans server key.
    it.each(['ENTER', 'TAB', 'F1', '', 'AB'])('mengabaikan tombol tak dikenal %s', (t) => {
        expect(terapkanTombol('nilai', t)).toBe('nilai');
    });
});

describe('hurufTampil', () => {
    it('mengikuti keadaan SHIFT', () => {
        expect(hurufTampil('Q', true)).toBe('Q');
        expect(hurufTampil('Q', false)).toBe('q');
    });

    it('konsisten dengan yang benar-benar diketikkan terapkanTombol', () => {
        // Tampilan tombol dan hasil ketikan harus sama persis — kalau tidak,
        // operator menekan "q" tetapi yang muncul "Q".
        BARIS_HURUF.flat().forEach((k) => {
            [true, false].forEach((shift) => {
                expect(terapkanTombol('', k, { shift })).toBe(hurufTampil(k, shift));
            });
        });
    });
});

describe('rangkaian ketikan nyata', () => {
    // Nilai yang benar-benar diketik operator di panel admin.
    const ketik = (urutan, { shift = false } = {}) =>
        urutan.reduce((v, k) => terapkanTombol(v, k, { shift }), '');

    it('dapat mengetik ID folder Drive', () => {
        expect(ketik(['1', 'C', 'h', 'y', '-', 'G', 'x', '9'])).toBe('1chy-gx9');
    });

    it('dapat mengetik alamat email', () => {
        expect(ketik(['a', 'B', '@', 'C', '.', 'i', 'D'])).toBe('ab@c.id');
    });

    it('SHIFT menetap sepanjang beberapa huruf, bukan sekali pakai', () => {
        expect(ketik(['S', 'B'], { shift: true })).toBe('SB');
    });

    it('DEL di tengah rangkaian mengoreksi huruf terakhir', () => {
        const urutan = ['a', 'b', 'x', 'DEL', 'c'];
        expect(urutan.reduce((v, k) => terapkanTombol(v, k), '')).toBe('abc');
    });
});
