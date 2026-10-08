// =========================================================================
// UJI XSS DOM SUNGGUHAN — SELURUH TAB HALAMAN KASIR
//
// Uji struktural di Vitest membuktikan client.js tidak memakai sink HTML.
// Berkas ini membuktikan akibatnya di browser sungguhan: setiap kolom yang
// datang dari database diisi muatan jahat, lalu diperiksa apakah ada elemen
// yang benar-benar terbentuk atau kode yang berjalan.
// =========================================================================
const path = require('path');
const AKAR = path.resolve(__dirname, '..', '..');
const { app, BrowserWindow } = require('electron');
const express = require('express');
const st = require(path.join(AKAR, 'electron/status'));
const { renderAdminPage } = require(path.join(AKAR, 'electron/admin'));
process.on('uncaughtException', (e) => { console.error('[FATAL]', e); process.exit(1); });

const hasil = [];
const cek = (n, l, c) => { hasil.push({ n, l }); console.log(l ? '  OK  ' : ' GAGAL', n, c !== undefined ? '— ' + JSON.stringify(c) : ''); };
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

// Muatan yang menandai dirinya sendiri bila benar-benar dieksekusi.
const IMG = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
const SVG = '"><svg onload="window.__xss=(window.__xss||0)+1">';
// Berkas ini TIDAK pernah disisipkan ke dalam <script>, jadi tag penutupnya
// aman ditulis apa adanya. Muatan ini dikirim sebagai JSON lewat HTTP.
const SCRIPT = '<script>window.__xss=(window.__xss||0)+1</script>';
const GB = 1024 ** 3;

const srv = express();
srv.get('/admin', (q, r) => r.send(renderAdminPage()));
srv.use('/fonts', express.static(path.join(AKAR, 'electron/assets')));

// --- TAGIHAN: nama, catatan, nama event
srv.get('/api/pending', (q, r) => r.json({
    name: 'Ani ' + IMG,
    price: 35000,
    note: 'CATATAN ' + SVG,
    event_name: 'Event ' + SCRIPT,
    active_theme: 'candy',
}));

// --- RIWAYAT: nama, waktu, status, alasan gagal
srv.get('/api/history', (q, r) => r.json([
    { id: 1, customer_name: 'Budi ' + IMG, harga_jual: 35000, waktu: '28/07 ' + SVG, status_cetak: 'GAGAL', print_error: 'Alasan ' + SCRIPT },
    { id: 2, customer_name: 'Citra ' + SCRIPT, harga_jual: 0, waktu: '28/07 14.10', status_cetak: 'TERCETAK' },
]));

// --- STATUS: nama printer, akun Drive, galat antrean, teks peringatan
srv.get('/api/status', (q, r) => {
    const mentah = {
        pinBawaan: true,
        diskBebasBytes: 1 * GB,
        modeOnline: true,
        driveTerhubung: false,
        antrean: { pending: 1, uploading: 0, done: 2, failed: 1, lastError: 'Galat ' + IMG },
        printer: { dipilih: 'Printer ' + SVG, tersedia: ['Lain'], cetakAktif: true },
    };
    const peringatan = st.daftarPeringatan(mentah);
    r.json({
        event: 'Event ' + SCRIPT,
        server: { ip: '192.168.1.2', port: 3000 },
        disk: { bebas: st.formatBytes(mentah.diskBebasBytes), total: st.formatBytes(180 * GB), tingkat: st.tingkatDisk(mentah.diskBebasBytes) },
        printer: st.ringkasPrinter(mentah.printer),
        drive: { terhubung: false, akun: 'akun' + IMG, antrean: st.ringkasAntrean(mentah.antrean) },
        mode: 'online', peringatan, tingkat: st.tingkatTertinggi(peringatan),
    });
});

// --- KONTROL: pesan galat dari server ikut ditampilkan sebagai toast
srv.post('/api/panel/:w', (q, r) => r.status(400).json({ success: false, error: 'Ditolak ' + IMG }));

app.whenReady().then(() => srv.listen(3995, '127.0.0.1', async () => {
    const win = new BrowserWindow({ width: 420, height: 900, show: false });
    const galat = [];
    win.webContents.on('console-message', (e, lvl, m) => { if (lvl >= 2) galat.push(m); });
    await win.loadURL('http://127.0.0.1:3995/admin?t=uji');
    await tidur(1400);
    const js = (k) => win.webContents.executeJavaScript(k);

    const periksaTab = async (tab, namaTab) => {
        await js(`document.querySelector('[data-tab="${tab}"]').click()`);
        await tidur(900);
        const r = await js(`(() => {
            const p = document.getElementById('panel-${tab}');
            return {
                elemenDisuntikkan: p.querySelectorAll('img, svg, script, iframe, object, embed').length,
                atributOn: [...p.querySelectorAll('*')].filter(e => [...e.attributes].some(a => /^on/i.test(a.name))).length,
                adaTeksLiteral: p.textContent.includes('<img') || p.textContent.includes('<svg') || p.textContent.includes('<script'),
                cuplikan: p.textContent.replace(/\\s+/g, ' ').slice(0, 90),
            };
        })()`);
        cek(`${namaTab}: nol elemen HTML terbentuk dari data`, r.elemenDisuntikkan === 0, r.elemenDisuntikkan);
        cek(`${namaTab}: nol atribut event terpasang dari data`, r.atributOn === 0, r.atributOn);
        cek(`${namaTab}: muatan tampil sebagai TEKS biasa`, r.adaTeksLiteral, r.cuplikan);
    };

    await periksaTab('tagihan', 'TAGIHAN');
    await periksaTab('riwayat', 'RIWAYAT');
    await periksaTab('status', 'STATUS');

    // KONTROL: memicu pesan galat dari server, yang mendarat di toast.
    await js(`document.querySelector('[data-tab="kontrol"]').click()`);
    await tidur(400);
    await js(`document.querySelector('[data-panel="settings"]').click()`);
    await tidur(800);
    const toast = await js(`(() => {
        const t = document.getElementById('toast');
        return { elemen: t.querySelectorAll('img, svg, script').length, teks: t.textContent.slice(0, 80) };
    })()`);
    cek('KONTROL: pesan galat server tidak membentuk elemen', toast.elemen === 0, toast);

    // Pencarian riwayat: kueri jahat tidak boleh mengubah cara daftar dibangun.
    await js(`document.querySelector('[data-tab="riwayat"]').click()`);
    await tidur(400);
    await js(`(() => {
        const i = document.getElementById('cari-riwayat');
        i.value = ${JSON.stringify(IMG)};
        i.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await tidur(500);
    const cari = await js(`(() => {
        const p = document.getElementById('panel-riwayat');
        return { elemen: p.querySelectorAll('img, svg, script').length, teks: p.textContent.replace(/\\s+/g,' ').slice(0, 70) };
    })()`);
    cek('RIWAYAT: kueri pencarian jahat tidak membentuk elemen', cari.elemen === 0, cari);

    // Pembuktian terakhir: tidak satu pun muatan berhasil dieksekusi.
    const dieksekusi = await js(`window.__xss || 0`);
    cek('TIDAK ADA muatan yang dieksekusi di seluruh halaman', dieksekusi === 0, { __xss: dieksekusi });

    console.log('\n[GALAT KONSOL]', galat.filter(g => !g.includes('Content-Security-Policy')).length
        ? galat.filter(g => !g.includes('Content-Security-Policy')) : 'tidak ada');
    const gagal = hasil.filter((h) => !h.l);
    console.log(`\n=== ${hasil.length - gagal.length}/${hasil.length} lulus ===`);
    app.exit(gagal.length ? 1 : 0);
}));
