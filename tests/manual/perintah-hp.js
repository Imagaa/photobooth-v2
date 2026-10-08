// Uji integrasi renderer: memuat bundel React yang sudah di-build, lalu
// memicu event "dari HP kasir" dan memeriksa reaksinya di DOM sungguhan.
//
// Ini mengisi celah yang selama ini diakui dokumentasi: komponen React tidak
// punya cakupan uji sama sekali. Yang paling berisiko di T2 justru di sini —
// apakah perintah HP benar-benar memunculkan gerbang PIN, bukan melewatinya.
const path = require('path');
const { app, BrowserWindow } = require('electron');

const AKAR = path.resolve(__dirname, '..', '..');
const KELUAR = process.env.KELUAR || path.join(__dirname, 'potret');
require('fs').mkdirSync(KELUAR, { recursive: true });
process.on('uncaughtException', (e) => { console.error('[FATAL]', e); process.exit(1); });

const hasil = [];
const cek = (nama, lulus, catatan) => {
    hasil.push({ nama, lulus });
    console.log(lulus ? '  OK  ' : ' GAGAL', nama, catatan !== undefined ? '— ' + JSON.stringify(catatan) : '');
};
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
    const win = new BrowserWindow({
        width: 1280, height: 800, show: false,
        webPreferences: { preload: path.join(__dirname, 'preload-stub.js'), contextIsolation: true, sandbox: false },
    });
    const galat = [];
    win.webContents.on('console-message', (e, level, pesan) => { if (level >= 2) galat.push(pesan); });

    await win.loadFile(path.join(AKAR, 'dist/index.html'));
    await tidur(1500);

    const js = (kode) => win.webContents.executeJavaScript(kode);
    const adaGerbangPin = () => js(`!!document.body.textContent.includes('[ AREA TERBATAS ]')`);
    const layar = () => js(`document.body.textContent.slice(0, 120)`);

    // --- Kanal terdaftar
    const terdaftar = await js(`window.__uji.terdaftar()`);
    cek('renderer mendaftarkan kanal panel & tema', terdaftar.includes('panel') && terdaftar.includes('tema'), terdaftar);

    // --- Panel admin WAJIB memunculkan gerbang PIN
    for (const nama of ['settings', 'template', 'dashboard']) {
        await js(`window.__uji.picu('panel', '${nama}')`);
        await tidur(400);
        cek(`panel ${nama} dari HP memunculkan gerbang PIN`, await adaGerbangPin());
        // Tutup lagi lewat tombol BATAL supaya uji berikutnya mulai bersih.
        await js(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('BATAL'))?.click()`);
        await tidur(300);
        cek(`gerbang PIN ${nama} bisa dibatalkan`, !(await adaGerbangPin()));
    }

    // --- Panel TIDAK boleh terbuka tanpa PIN
    await js(`window.__uji.picu('panel', 'settings')`);
    await tidur(400);
    const sblmPin = await js(`document.body.textContent.includes('Midtrans') || document.body.textContent.includes('HPP')`);
    cek('isi panel Pengaturan tidak bocor sebelum PIN benar', !sblmPin);

    // --- Setelah PIN benar, panel terbuka
    for (const d of ['1', '2', '3', '4']) {
        await js(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '${d}')?.click()`);
    }
    await js(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'OK')?.click()`);
    await tidur(600);
    cek('panel terbuka setelah PIN diterima', await js(`document.body.textContent.includes('HPP')`));
    const img = await win.webContents.capturePage();
    require('fs').writeFileSync(path.join(KELUAR, 'kiosk-pin-lalu-panel.png'), img.toPNG());

    // --- Tema: HP mengubah tema lewat jalur yang sama dengan Ctrl+Panah
    const temaAwal = await js(`window.__uji.tema()`);
    await js(`window.__uji.picu('tema', 'next')`);
    await tidur(500);
    const temaMaju = await js(`window.__uji.tema()`);
    cek('perintah tema next mengubah tema', temaMaju !== temaAwal, `${temaAwal} -> ${temaMaju}`);

    await js(`window.__uji.picu('tema', 'prev')`);
    await tidur(500);
    const temaKembali = await js(`window.__uji.tema()`);
    cek('perintah tema prev mengembalikan tema semula', temaKembali === temaAwal, `${temaMaju} -> ${temaKembali}`);

    cek('tema tersimpan lewat saveSettings, bukan hanya di layar',
        (await js(`window.__uji.panggilan()`)).includes('saveSettings'));

    // --- Kembali ke landing tidak menuntut PIN
    await js(`[...document.querySelectorAll('button')].map(b=>b.textContent).join('|')`);
    await js(`window.__uji.picu('panel', 'landing')`);
    await tidur(600);
    cek('perintah landing tidak memunculkan gerbang PIN', !(await adaGerbangPin()));
    cek('perintah landing membatalkan pembayaran yang menggantung',
        (await js(`window.__uji.panggilan()`)).includes('cancelPayment'));
    console.log('  layar sekarang:', JSON.stringify(await layar()));

    console.log('\n[GALAT KONSOL]', galat.length ? galat : 'tidak ada');
    const gagal = hasil.filter((h) => !h.lulus);
    console.log(`\n=== ${hasil.length - gagal.length}/${hasil.length} lulus ===`);
    app.exit(gagal.length ? 1 : 0);
});
