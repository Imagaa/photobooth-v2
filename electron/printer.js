// =========================================================================
// MESIN CETAK FISIK
// Merender file hasil komposit ke printer lewat BrowserWindow tersembunyi.
// Saat mode bypass hardware aktif, hasil dialihkan ke PDF supaya alur kiosk
// tetap bisa diuji tanpa printer terpasang.
// =========================================================================
const { BrowserWindow, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const PRINT_TIMEOUT_MS = 60000;

// Ukuran kertas photobooth. Electron memakai satuan mikron untuk pageSize kustom.
const PAPER_SIZES = {
    '4R':  { width: 101600, height: 152400 }, // 4x6 inci
    '2x6': { width:  50800, height: 152400 }, // photostrip
    'A6':  { width: 105000, height: 148000 },
    'A5':  { width: 148000, height: 210000 },
    'A4':  { width: 210000, height: 297000 },
};

const PRINT_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><style>
    @page { margin: 0; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #fff; }
    img { display: block; width: 100%; height: 100%; object-fit: contain; }
</style></head>
<body><img id="sheet" src="__IMAGE_URL__"></body></html>`;

// Menunggu callback print dengan batas waktu, supaya driver yang menggantung
// tidak membekukan sesi pelanggan selamanya.
function runPrint(webContents, options) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (result) => { if (!settled) { settled = true; resolve(result); } };
        const timer = setTimeout(() => finish({ success: false, error: 'Timeout: driver printer tidak merespons dalam 60 detik.' }), PRINT_TIMEOUT_MS);

        try {
            webContents.print(options, (ok, failureReason) => {
                clearTimeout(timer);
                finish(ok ? { success: true } : { success: false, error: failureReason || 'Pencetakan dibatalkan.' });
            });
        } catch (err) {
            clearTimeout(timer);
            finish({ success: false, error: err.message });
        }
    });
}

// Nama printer yang tersimpan di settings bisa saja sudah dicabut/berganti nama.
// Silent print ke deviceName yang tidak ada akan gagal diam-diam, jadi kita
// validasi dulu dan jatuh ke printer default kalau tidak ketemu.
async function resolveDeviceName(webContents, wanted) {
    if (!wanted) return { deviceName: undefined, warning: null };
    try {
        const printers = await webContents.getPrintersAsync();
        if (printers.some(p => p.name === wanted)) return { deviceName: wanted, warning: null };
        const fallback = printers.find(p => p.isDefault);
        return {
            deviceName: fallback ? fallback.name : undefined,
            warning: `Printer "${wanted}" tidak ditemukan, memakai printer default.`,
        };
    } catch {
        return { deviceName: wanted, warning: null };
    }
}

/**
 * Mencetak satu lembar hasil komposit.
 *
 * @returns {Promise<{success:boolean, mode:'printer'|'pdf', error?:string, warning?:string, pdfPath?:string}>}
 */
async function printPhoto({
    imagePath,
    deviceName = '',
    copies = 1,
    paperSize = '',
    landscape = false,
    bypass = false,
    pdfOutputPath = null,
}) {
    if (!imagePath || !fs.existsSync(imagePath)) {
        return { success: false, mode: 'printer', error: `File hasil tidak ditemukan: ${imagePath}` };
    }

    const tempHtmlPath = path.join(app.getPath('temp'), `saygumi-print-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`);
    fs.writeFileSync(tempHtmlPath, PRINT_HTML.replace('__IMAGE_URL__', pathToFileURL(imagePath).href), 'utf8');

    const win = new BrowserWindow({
        show: false,
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });

    const cleanup = () => {
        if (!win.isDestroyed()) win.destroy();
        fs.promises.unlink(tempHtmlPath).catch(() => {});
    };

    try {
        await win.loadFile(tempHtmlPath);

        // did-finish-load belum menjamin gambar sudah ter-decode; kalau kita cetak
        // terlalu cepat hasilnya lembar kosong.
        const imageReady = await win.webContents.executeJavaScript(`
            new Promise((resolve) => {
                const img = document.getElementById('sheet');
                if (img.complete) return resolve(img.naturalWidth > 0);
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
            })
        `);
        if (!imageReady) {
            cleanup();
            return { success: false, mode: 'printer', error: 'Gambar hasil gagal dimuat untuk dicetak.' };
        }

        // Mode troubleshooting: tidak ada printer, alihkan ke PDF supaya alur
        // kiosk tetap bisa diselesaikan dan diverifikasi.
        if (bypass) {
            const target = pdfOutputPath || imagePath.replace(/\.png$/i, '.pdf');
            const pdf = await win.webContents.printToPDF({
                printBackground: true,
                landscape,
                margins: { marginType: 'none' },
                ...(PAPER_SIZES[paperSize] ? { pageSize: PAPER_SIZES[paperSize] } : {}),
            });
            fs.writeFileSync(target, pdf);
            cleanup();
            return { success: true, mode: 'pdf', pdfPath: target, warning: 'Mode bypass hardware: hasil disimpan sebagai PDF, tidak dicetak fisik.' };
        }

        const resolved = await resolveDeviceName(win.webContents, deviceName);

        const result = await runPrint(win.webContents, {
            silent: true,
            printBackground: true,
            landscape,
            color: true,
            copies: Math.max(1, Number(copies) || 1),
            margins: { marginType: 'none' },
            ...(resolved.deviceName ? { deviceName: resolved.deviceName } : {}),
            ...(PAPER_SIZES[paperSize] ? { pageSize: PAPER_SIZES[paperSize] } : {}),
        });

        cleanup();
        return { ...result, mode: 'printer', warning: resolved.warning || undefined };
    } catch (err) {
        cleanup();
        return { success: false, mode: 'printer', error: err.message };
    }
}

module.exports = { printPhoto, PAPER_SIZES };
