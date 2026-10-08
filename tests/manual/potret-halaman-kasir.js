// Pratinjau halaman kasir di Chromium sungguhan.
// Menyalakan server tiruan dengan data karangan, memuatnya di Electron,
// lalu memotret portrait & landscape sambil mencatat galat konsol.
const path = require('path');
const { app, BrowserWindow } = require('electron');

const AKAR = path.resolve(__dirname, '..', '..');
// Skrip ini hidup di luar folder proyek, jadi resolusi node_modules biasa
// tidak menemukannya. Tanpa jalur absolut, Electron melempar di main process
// lalu memunculkan dialog galat modal yang menggantung selamanya.
const express = require('express');

process.on('uncaughtException', (e) => { console.error('[FATAL]', e); process.exit(1); });
const KELUAR = process.env.KELUAR || path.join(__dirname, 'potret');
require('fs').mkdirSync(KELUAR, { recursive: true });
const { renderAdminPage } = require(path.join(AKAR, 'electron/admin'));

const PORT = 3999;
const srv = express();
srv.get('/admin', (req, res) => res.send(renderAdminPage()));
srv.use('/fonts', express.static(path.join(AKAR, 'electron/assets')));
srv.get('/api/pending', (req, res) => res.json({
    name: 'Ani Wijaya <img src=x onerror=alert(1)>',
    price: 35000,
    note: 'CETAK TAMBAHAN 2 LEMBAR',
    event_name: 'Pesta Ultah Budi',
    active_theme: 'candy',
}));
const remote = require(path.join(AKAR, 'electron/remote'));
srv.post('/api/panel/:which', (req, res) => {
    const v = remote.validasiPanel(req.params.which);
    if (!v.ok) return res.status(400).json({ success: false, error: v.error });
    res.json({ success: true, butuhPin: remote.butuhPin(v.nilai) });
});
srv.post('/api/theme/:arah', (req, res) => {
    const v = remote.validasiArahTema(req.params.arah);
    if (!v.ok) return res.status(400).json({ success: false, error: v.error });
    res.json({ success: true });
});
srv.get('/api/history', (req, res) => res.json([
    { id: 1, customer_name: 'Ani Wijaya', harga_jual: 35000, waktu: '28/07/2026 14.02', status_cetak: 'TERCETAK' },
    { id: 2, customer_name: 'Budi Santoso', harga_jual: 0, waktu: '28/07/2026 14.10', status_cetak: 'GAGAL', print_error: 'Printer offline' },
    { id: 3, customer_name: 'Citra <b>bold</b>', harga_jual: 500, waktu: '28/07/2026 14.15', status_cetak: 'MENUNGGU' },
]));

const galat = [];

async function potret(win, nama) {
    const img = await win.webContents.capturePage();
    require('fs').writeFileSync(path.join(KELUAR, nama), img.toPNG());
    console.log('[POTRET]', nama);
}

app.whenReady().then(async () => {
    srv.listen(PORT, '127.0.0.1', async () => {
        const win = new BrowserWindow({ width: 390, height: 844, show: false });
        win.webContents.on('console-message', (e, level, pesan) => {
            if (level >= 2) galat.push(pesan);
            console.log('[KONSOL]', level, pesan);
        });
        win.webContents.on('render-process-gone', (e, d) => galat.push('RENDERER MATI: ' + JSON.stringify(d)));

        await win.loadURL(`http://127.0.0.1:${PORT}/admin?t=token-uji`);
        await new Promise((r) => setTimeout(r, 1200));
        await potret(win, 'kasir-portrait-tagihan.png');

        // Pindah ke tab RIWAYAT lewat klik sungguhan, bukan memanggil fungsi.
        await win.webContents.executeJavaScript(`document.querySelector('[data-tab="riwayat"]').click()`);
        await new Promise((r) => setTimeout(r, 800));
        await potret(win, 'kasir-portrait-riwayat.png');

        await win.webContents.executeJavaScript(`document.querySelector('[data-tab="kontrol"]').click()`);
        await new Promise((r) => setTimeout(r, 300));
        await potret(win, 'kasir-portrait-kontrol.png');

        // Menekan PENGATURAN harus memberi tahu kasir bahwa PIN diminta di
        // layar kiosk — tanpa itu ia mengira tombolnya tidak berfungsi.
        await win.webContents.executeJavaScript(`document.querySelector('[data-panel="settings"]').click()`);
        await new Promise((r) => setTimeout(r, 700));
        await potret(win, 'kasir-portrait-kontrol-toast.png');
        const toast = await win.webContents.executeJavaScript(`document.getElementById('toast').textContent`);
        console.log('[TOAST PENGATURAN]', JSON.stringify(toast));

        // Konfirmasi aksi merusak
        await win.webContents.executeJavaScript(`document.getElementById('btn-close').click()`);
        await new Promise((r) => setTimeout(r, 300));
        await potret(win, 'kasir-portrait-konfirmasi.png');
        await win.webContents.executeJavaScript(`document.getElementById('hamparan-batal').click()`);

        // Landscape: rel samping
        win.setSize(844, 390);
        await win.webContents.executeJavaScript(`document.querySelector('[data-tab="tagihan"]').click()`);
        await new Promise((r) => setTimeout(r, 600));
        await potret(win, 'kasir-landscape-tagihan.png');

        // Bukti anti-XSS: nama pelanggan mengandung tag, harus jadi teks biasa.
        const cek = await win.webContents.executeJavaScript(`(() => ({
            adaImgSuntikan: !!document.querySelector('#panel-tagihan img'),
            namaTampil: document.querySelector('#panel-tagihan .nilai').textContent,
            hargaTampil: document.querySelector('#panel-tagihan .harga').textContent,
            temaBody: document.body.className,
        }))()`);
        console.log('[CEK]', JSON.stringify(cek, null, 2));
        console.log('[GALAT KONSOL]', galat.length ? galat : 'tidak ada');
        app.quit();
    });
});
