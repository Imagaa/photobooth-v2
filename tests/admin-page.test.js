import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { renderAdminPage } = require('../electron/admin/index.js');
const { PANEL_DIIZINKAN } = require('../electron/remote.js');

const html = renderAdminPage();
const bacaSumber = (nama) => readFileSync(new URL('../electron/admin/' + nama, import.meta.url), 'utf8');

// Komentar di berkas ini justru banyak membicarakan innerHTML dan require —
// karena itulah larangannya dijelaskan di sana. Pemeriksaan di bawah harus
// melihat kode sungguhan saja, bukan kalimat peringatannya.
const tanpaKomentar = (sumber) => sumber
    .split('\n')
    .filter((baris) => !/^\s*(\/\/|\/\*|\*)/.test(baris))
    .join('\n');

describe('halaman kasir: perakitan', () => {
    it('menghasilkan dokumen HTML utuh', () => {
        expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
        expect(html).toContain('</html>');
    });

    it('menyisipkan kedua berkas skrip apa adanya', () => {
        // Kalau readFileSync salah path, ini gagal di sini — bukan diam-diam
        // menghasilkan halaman tanpa perilaku apa pun di HP kasir.
        expect(html).toContain('function formatRupiah');
        expect(html).toContain("const TOKEN_KEY = 'saygumi_cashier_token'");
    });

    it('memuat format.js sebelum client.js, karena client memakai fungsinya', () => {
        expect(html.indexOf('function formatRupiah')).toBeLessThan(html.indexOf('saygumi_cashier_token'));
    });

    it('menyediakan seluruh tab beserta panelnya', () => {
        ['tagihan', 'riwayat', 'kontrol', 'status'].forEach((tab) => {
            expect(html).toContain(`data-tab="${tab}"`);
            expect(html).toContain(`id="panel-${tab}"`);
        });
    });

    // Kiosk layar sentuh tidak punya keyboard fisik, sehingga tombol-tombol
    // inilah satu-satunya cara menjangkau Ctrl+Shift+P/T/D dan Ctrl+Panah.
    // Hilang satu tombol berarti aksinya benar-benar tidak terjangkau.
    it.each(['settings', 'template', 'dashboard', 'landing'])(
        'menyediakan tombol untuk panel %s',
        (nama) => {
            expect(html).toContain(`data-panel="${nama}"`);
        },
    );

    it.each(['next', 'prev'])('menyediakan tombol tema arah %s', (arah) => {
        expect(html).toContain(`data-tema="${arah}"`);
    });

    it('setiap panel yang diizinkan main process punya tombolnya di HP', () => {
        // Bila suatu saat ada panel baru didaftarkan di remote.js tetapi lupa
        // diberi tombol, ketidaksesuaian itu ketahuan di sini.
        PANEL_DIIZINKAN.forEach((nama) => {
            expect(html).toContain(`data-panel="${nama}"`);
        });
    });

    it('melayani font dari mesin kiosk sendiri, bukan dari internet', () => {
        expect(html).toContain("url('/fonts/PressStart2P-Regular.ttf')");
        expect(html).not.toMatch(/https?:\/\/fonts\./);
    });

    it('mengunci viewport agar ketukan beruntun tidak berubah jadi zoom', () => {
        expect(html).toContain('user-scalable=no');
    });
});

describe('halaman kasir: rangka tidak membawa data', () => {
    // Rangka HTML dirakit lewat template string. Bila suatu saat ada yang
    // menyisipkan nilai dari database ke dalamnya, itu jalur stored XSS yang
    // sama dengan temuan S6 — jadi rangkanya harus tetap statis.
    it('tidak memuat penanda interpolasi yang tersisa', () => {
        const shell = bacaSumber('shell.js');
        const isiTemplate = shell.slice(shell.indexOf('`'), shell.lastIndexOf('`'));
        expect(isiTemplate).not.toContain('${');
    });

    it('tidak memakai atribut penangan sebaris seperti onclick', () => {
        // Versi lama merangkai onclick="..." langsung di markup. Semua
        // penangan sekarang dipasang lewat addEventListener di client.js.
        expect(html).not.toMatch(/\son[a-z]+\s*=\s*["']/);
    });
});

describe('halaman kasir: skrip browser bebas dependensi', () => {
    const client = tanpaKomentar(bacaSumber('client.js'));
    const format = tanpaKomentar(bacaSumber('format.js'));

    // Keduanya dijalankan sebagai <script> klasik di HP kasir. Tidak ada
    // bundler, tidak ada module loader — require/import di sana akan
    // melempar ReferenceError dan mematikan seluruh halaman.
    it.each([['client.js', () => client], ['format.js', () => format]])(
        '%s tidak memakai require maupun import',
        (_, ambil) => {
            const isi = ambil();
            expect(isi).not.toMatch(/^\s*(const|let|var)\s+\w+\s*=\s*require\(/m);
            expect(isi).not.toMatch(/^\s*import\s/m);
        },
    );

    // Keduanya disisipkan ke dalam <script>...</script>. Parser HTML menutup
    // elemen script pada "</script>" PERTAMA yang ia temui — termasuk yang
    // berada di dalam string atau komentar JavaScript. Satu kalimat komentar
    // yang menyebut tag penutup itu akan memotong halaman di tengah dan
    // menumpahkan sisa kodenya sebagai teks ke layar kasir.
    // Justru komentar yang paling mungkin memuatnya, jadi di sini sumbernya
    // diperiksa MENTAH — bukan versi yang komentarnya sudah dibuang.
    it.each(['client.js', 'format.js'])(
        '%s tidak memuat urutan yang memutus tag script',
        (nama) => {
            const mentah = bacaSumber(nama);
            expect(mentah).not.toContain('</script');
            expect(mentah).not.toContain('<!--');
        },
    );

    it('format.js hanya mengekspor lewat penjagaan typeof module', () => {
        expect(format).toContain("typeof module !== 'undefined'");
    });

    // Batas paling tegas untuk menjaga S6 tetap tertutup: bila tidak satu pun
    // sink HTML dipakai, nama pelanggan TIDAK MUNGKIN sampai ke parser HTML —
    // berapa pun jumlah tab yang menampilkannya.
    it.each([
        'innerHTML',
        'outerHTML',
        'insertAdjacentHTML',
        'document.write',
        'eval(',
        'new Function',
        'setHTML',
    ])('client.js tidak memakai sink berbahaya %s', (sink) => {
        expect(client).not.toContain(sink);
    });

    // Atribut event yang dipasang lewat setAttribute menerima STRING yang
    // dieksekusi sebagai kode — jalur yang sama berbahayanya dengan innerHTML.
    it('client.js tidak memasang handler lewat setAttribute', () => {
        expect(client).not.toMatch(/setAttribute\(\s*['"]on/i);
    });

    // Setiap tab yang menampilkan data dari database harus melewati salah satu
    // jalur aman. Daftar ini ikut bertambah setiap kali ada tab baru.
    it.each([
        ['TAGIHAN — nama & catatan pelanggan', 'renderTagihan'],
        ['RIWAYAT — nama, harga, meta, aksi', 'buatItemRiwayat'],
        ['RIWAYAT — hasil penyaringan', 'gambarRiwayat'],
        ['STATUS — diagnostik & peringatan', 'renderStatus'],
    ])('%s dibangun lewat DOM API, bukan rangkaian HTML', (_, fungsi) => {
        const mulai = client.indexOf('function ' + fungsi);
        expect(mulai).toBeGreaterThan(-1);
        // Potong sampai deklarasi fungsi berikutnya.
        const sisa = client.slice(mulai + 1);
        const akhir = sisa.search(/\n {4}(async )?function /);
        const badan = akhir === -1 ? sisa : sisa.slice(0, akhir);
        expect(badan).not.toContain('innerHTML');
        // Nilai dinamis harus mendarat di textContent atau lewat helper aman.
        expect(badan).toMatch(/textContent|buatP|buatBaris|buatKosong|buatItemRiwayat|buatTombol/);
    });

    it('client.js mengirim token lewat header Authorization, bukan cookie', () => {
        expect(client).toContain("'Authorization': 'Bearer '");
        expect(client).not.toContain('document.cookie');
    });

    it('client.js menghapus token dari URL setelah dipasangkan', () => {
        expect(client).toContain('history.replaceState');
    });
});
