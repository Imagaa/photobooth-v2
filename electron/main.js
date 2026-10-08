const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const qrcode = require('qrcode');
const midtransClient = require('midtrans-client');
const express = require('express');
const http = require('http');
const ExcelJS = require('exceljs');

const crypto = require('crypto');

const db = require('./database');
const { printPhoto } = require('./printer');
const { renderAdminPage } = require('./admin');
const remote = require('./remote');
const status = require('./status');
const { renderDownloadPage } = require('./download-page');
const secrets = require('./secrets');
const driveService = require('./drive-service');
const network = require('./network');
const pricing = require('./pricing');

const DEFAULT_ADMIN_PIN = '1234';

// Mengambil server key dalam bentuk siap pakai. Satu-satunya jalur dekripsi —
// nilai ini tidak pernah keluar dari main process.
function getMidtransServerKey() {
    const st = db.prepare('SELECT midtrans_server_key FROM settings WHERE id=1').get();
    return secrets.decryptSecret(st?.midtrans_server_key || '');
}

// Key yang tersimpan dari versi lama masih plaintext; enkripsi sekali saat
// startup, dan pasang PIN default bila belum pernah diatur.
function migrateSecretsAtStartup() {
    const st = db.prepare('SELECT midtrans_server_key, admin_pin_hash FROM settings WHERE id=1').get();
    if (!st) return;

    if (st.midtrans_server_key && !secrets.isEncrypted(st.midtrans_server_key)) {
        db.prepare('UPDATE settings SET midtrans_server_key=? WHERE id=1')
          .run(secrets.encryptSecret(st.midtrans_server_key));
        console.log('[SECRETS] Midtrans server key dienkripsi ke keychain OS.');
    }

    if (!st.admin_pin_hash) {
        db.prepare('UPDATE settings SET admin_pin_hash=? WHERE id=1').run(secrets.hashPin(DEFAULT_ADMIN_PIN));
        console.log(`[SECRETS] PIN admin diset ke default (${DEFAULT_ADMIN_PIN}). Segera ganti lewat Pengaturan.`);
    }
}

const USER_TEMPLATES_PATH = path.join(app.getPath('userData'), 'user_templates');
const OUTPUT_PATH = path.join(app.getPath('documents'), 'Photobooth_Output'); 
const STATIC_QR_PATH = path.join(app.getPath('userData'), 'static_qr');

if (!fs.existsSync(USER_TEMPLATES_PATH)) fs.mkdirSync(USER_TEMPLATES_PATH, { recursive: true });
if (!fs.existsSync(OUTPUT_PATH)) fs.mkdirSync(OUTPUT_PATH, { recursive: true });
if (!fs.existsSync(STATIC_QR_PATH)) fs.mkdirSync(STATIC_QR_PATH, { recursive: true });

// Diisi oleh createWindow(); dipakai route Express & handler IPC untuk
// mengirim event ke renderer.
let mainWindow;

// Jendela consent Google yang sedang terbuka. Disimpan di sini agar route
// callback dapat menutupnya — penutupan berdasarkan URL terbukti rapuh.
let authWindow = null;

// =========================================================================
// OTORISASI PEMBAYARAN
// Main process adalah satu-satunya pemegang kebenaran soal "sudah bayar".
// Renderer hanya boleh bertanya statusnya, tidak boleh menetapkannya —
// dan harga selalu diambil dari DB, bukan dari angka kiriman renderer.
// =========================================================================
let currentPayment = null;
let pendingRetakeOf = null;

// Waktu pelanggan menekan setuju pada layar persetujuan. Disimpan di main agar
// renderer tidak bisa mengarang jejak audit ini.
let currentConsentAt = null;
const PAYMENT_TTL_MS = 30 * 60 * 1000;

function paymentIsAlive(p) {
    return p && !p.consumed && Date.now() - p.createdAt < PAYMENT_TTL_MS;
}

// Dipanggil dari SEMUA jalur yang menjadikan transaksi lunas (gratis/retake,
// verifikasi kasir, dan settlement Midtrans). Selain menandai status, ia
// menyiapkan subfolder Drive pelanggan di latar belakang — dijalankan sekarang
// supaya folder sudah siap saat lembar selesai dirender beberapa menit lagi.
function markPaymentPaid(payment) {
    if (!payment || payment.status === 'paid') return;
    payment.status = 'paid';

    // Baris upsell menumpang folder sesi aslinya, tidak membuat folder baru.
    if (payment.upsellOf) return;
    if (!driveService.isConfigured()) return;

    payment.drivePending = driveService
        .createCustomerFolder({ eventId: payment.eventId, customerName: payment.customerName })
        .then(folder => { payment.driveFolder = folder; return folder; })
        .catch(err => {
            // Kegagalan di sini tidak boleh menghentikan sesi. Folder akan
            // dibuat menyusul oleh worker antrean saat internet tersedia.
            console.warn('[DRIVE] Folder pelanggan gagal dibuat:', err.message);
            return null;
        });
}

function getEventTemplatePrice(eventId, templateId) {
    const ev = db.prepare('SELECT templates_json FROM events WHERE id=?').get(eventId);
    if (!ev) return null;
    return pricing.getEventTemplatePrice(ev.templates_json, templateId);
}

const ports = require('./ports');

const expressApp = express();

// PORT tidak boleh `const` lagi: nilainya baru diketahui setelah server benar-
// benar listening, karena bisa mundur ke port bebas bila 3000 sedang dipakai.
// Semua pembacaannya terjadi setelah listen selesai (lihat
// startLocalServer), jadi tidak ada yang pernah membaca nilai basi.
let PORT = ports.DEFAULT_SERVER_PORT;
let serverIP = 'localhost';

// Port Vite di mode pengembangan. Nilai ini datang dari env yang ditulis
// orkestrator `npm run dev`, bukan angka mati: kalau Vite diam-diam pindah ke
// 5174 sementara Electron tetap membuka 5173, kiosk akan menampilkan aplikasi
// milik proyek lain tanpa satu pun error (bug B24).
const DEV_URL = ports.normalizeDevUrl(process.env.VITE_DEV_SERVER_URL || process.env.PB_DEV_URL);
const DEV_ORIGIN = new URL(DEV_URL).origin;
const DEV_WS_ORIGIN = ports.wsOriginFrom(DEV_ORIGIN);

// Alamat yang dipakai QR pelanggan & pairing kasir. Logika pemilihannya ada di
// electron/network.js agar bisa diuji tanpa runtime Electron.
function getLocalIP() {
    const daftar = network.listNetworkInterfaces();
    const st = db.prepare('SELECT server_ip_override FROM settings WHERE id=1').get();
    const hasil = network.pickAddress(daftar, st?.server_ip_override || '');
    if (hasil.warning) console.warn('[JARINGAN]', hasil.warning);
    return hasil.address;
}

// Awalan nama berkas di Drive agar mudah dikenali di dalam folder pelanggan.
function drivePrefix(customerName) {
    return String(customerName || 'Tanpa Nama').replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 60) || 'Pelanggan';
}

// Halaman kecil yang tampil di jendela OAuth setelah Google mengarahkan balik.
function halamanOauth(sukses, pesan) {
    const warna = sukses ? '#2e7d32' : '#c62828';
    const judul = sukses ? 'Google Drive Terhubung' : 'Gagal Menghubungkan';
    return `<!doctype html><html lang="id"><head><meta charset="utf-8">
      <title>${judul}</title><style>
        body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;
             height:100vh;margin:0;background:#f5f5f5;text-align:center;padding:20px}
        .kotak{background:#fff;border:4px solid ${warna};padding:32px 28px;max-width:420px}
        h1{color:${warna};font-size:20px;margin:0 0 12px}
        p{color:#444;line-height:1.6;margin:0}
      </style></head><body><div class="kotak">
        <h1>${judul}</h1><p>${String(pesan || '').replace(/[<>&]/g, '')}</p>
        <p style="margin-top:16px;color:#888;font-size:13px">Jendela ini bisa ditutup.</p>
      </div></body></html>`;
}

// =========================================================================
// KEAMANAN AKSES KASIR
// Server ini terbuka di seluruh WiFi venue, jadi setiap request /api/ wajib
// membawa token yang hanya bisa didapat dengan memindai QR di Live Dashboard.
// =========================================================================
function getCashierToken() {
    let st = db.prepare('SELECT cashier_token FROM settings WHERE id=1').get();
    if (!st?.cashier_token) {
        const token = crypto.randomBytes(24).toString('hex');
        db.prepare('UPDATE settings SET cashier_token=? WHERE id=1').run(token);
        return token;
    }
    return st.cashier_token;
}

function rotateCashierToken() {
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('UPDATE settings SET cashier_token=? WHERE id=1').run(token);
    return token;
}

// Perbandingan waktu-tetap supaya token tidak bisa ditebak lewat timing.
function tokenMatches(candidate) {
    const expected = getCashierToken();
    const a = Buffer.from(String(candidate || ''));
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireCashierAuth(req, res, next) {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!tokenMatches(token)) {
        return res.status(401).json({ success: false, error: 'Token kasir tidak valid.' });
    }
    next();
}

// =========================================================================
// SAKELAR UNDUHAN LOKAL
//
// Pada mode ONLINE, hasil sudah diantar lewat Google Drive sehingga tamu tidak
// perlu menyentuh WiFi venue sama sekali — melayani unduhan lokal di sana justru
// mengembalikan beban jaringan yang ingin kita hindari.
//
// Pada mode OFFLINE, unduhan lokal tetap dipakai karena ia satu-satunya jalur
// pengantaran yang tersedia saat tidak ada internet.
//
// Seluruh kode jalur lokal sengaja DIPERTAHANKAN utuh, bukan dihapus: ia akan
// dipakai kembali saat integrasi website vendor siap (lihat rencana di
// DOCUMENTATION.md bagian Integrasi Website Vendor).
// =========================================================================
function localDownloadEnabled() {
    const st = db.prepare('SELECT app_mode FROM settings WHERE id=1').get();
    return (st?.app_mode || 'online') !== 'online';
}

function halamanUnduhanNonaktif(res) {
    return res.status(503).send(`<!doctype html><html lang="id"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Unduhan Lokal Nonaktif</title>
      <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;
        min-height:100vh;margin:0;background:#007CC3;padding:24px;text-align:center}
        .k{background:#fff;border:6px solid #111;padding:28px;max-width:420px;line-height:1.7}
        h1{font-size:19px;margin:0 0 12px}</style></head>
      <body><div class="k"><h1>Unduhan lokal tidak aktif</h1>
      <p>Pada mode online, hasil foto diantar lewat Google Drive.
      Silakan pakai link Google Drive yang tertera di layar kiosk.</p></div></body></html>`);
}

// Rekaman bisa .mp4 (diutamakan, kompatibel iOS) atau .webm (cadangan).
const VIDEO_FILE_RE = /^video_\d+\.(mp4|webm)$/;

// Semua path yang datang dari renderer harus dibuktikan berada di dalam folder
// output. Tanpa ini, renderer yang dikompromi bisa menulis file ke mana saja
// dengan hak akses pengguna.
function resolveInsideOutput(candidate) {
    if (!candidate) return null;
    const root = path.resolve(OUTPUT_PATH);
    const target = path.resolve(String(candidate));
    if (target !== root && !target.startsWith(root + path.sep)) return null;
    return target;
}

function isLoopback(req) {
    const ip = req.ip || req.socket.remoteAddress || '';
    return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
}

// Aset internal kiosk tidak punya alasan dilayani ke perangkat lain.
function onlyLoopback(req, res, next) {
    if (isLoopback(req)) return next();
    return res.status(403).send('Terlarang.');
}

// Rate limit sederhana per-IP. Tanpa ini /api/restart bisa dipakai untuk
// membuat kiosk tidak pernah selesai booting.
const rateBuckets = new Map();
const RATE_WINDOW_MS = 60000;
const RATE_MAX = 180;

function rateLimit(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const hits = (rateBuckets.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
    hits.push(now);
    rateBuckets.set(ip, hits);
    if (hits.length > RATE_MAX) {
        return res.status(429).json({ success: false, error: 'Terlalu banyak permintaan.' });
    }
    next();
}

setInterval(() => {
    const now = Date.now();
    for (const [ip, hits] of rateBuckets) {
        const fresh = hits.filter(t => now - t < RATE_WINDOW_MS);
        if (fresh.length === 0) rateBuckets.delete(ip); else rateBuckets.set(ip, fresh);
    }
}, RATE_WINDOW_MS).unref();

app.whenReady().then(async () => {
    migrateSecretsAtStartup();
    serverIP = getLocalIP();

    // Redirect OAuth wajib loopback: Google mengizinkannya untuk aplikasi
    // desktop, dan alamat ini yang harus didaftarkan di Google Cloud Console.
    driveService.init(db, () => `http://127.0.0.1:${PORT}${driveService.REDIRECT_PATH}`);
    driveService.startWorker();

    // Retensi diperiksa sekali saat startup lalu tiap 24 jam. Kiosk sering
    // menyala berhari-hari, jadi mengandalkan startup saja tidak cukup.
    try { purgeOldMedia(); } catch (err) { console.error('[RETENSI]', err.message); }
    setInterval(() => {
        try { purgeOldMedia(); } catch (err) { console.error('[RETENSI]', err.message); }
    }, 24 * 3600 * 1000).unref();
    // Frame & QR statis hanya dipakai oleh kiosk itu sendiri, tidak pernah oleh
    // HP siapa pun — jadi kunci ke loopback saja.
    expressApp.use('/templates', onlyLoopback, express.static(USER_TEMPLATES_PATH));
    expressApp.use('/qr', onlyLoopback, express.static(STATIC_QR_PATH));

    // Callback OAuth Google. Dikunci ke loopback karena hanya browser di mesin
    // ini yang boleh menyerahkan authorization code.
    expressApp.get(driveService.REDIRECT_PATH, onlyLoopback, async (req, res) => {
        const { code, state, error } = req.query;
        if (error) return res.send(halamanOauth(false, `Google menolak: ${error}`));

        const hasil = await driveService.completeAuth({ code, state });
        if (mainWindow) mainWindow.webContents.send('gdrive-auth-result', hasil);
        res.send(hasil.success
            ? halamanOauth(true, `Terhubung sebagai ${hasil.email || 'akun Google Anda'}.`)
            : halamanOauth(false, hasil.error));

        // Halaman hasil dibiarkan terbaca sebentar, lalu jendela ditutup.
        setTimeout(() => {
            if (authWindow && !authWindow.isDestroyed()) authWindow.close();
        }, 2500);
    });

    // Font untuk halaman kasir. Bukan loopback: justru HP kasir yang butuh.
    expressApp.use('/fonts', express.static(path.join(__dirname, 'assets')));

    // =====================================================================
    // DOWNLOAD HASIL FOTO
    // Menggantikan express.static(OUTPUT_PATH) yang dulu membuka SELURUH
    // riwayat foto, video, dan laporan keuangan ke seluruh WiFi venue.
    // Sekarang satu token hanya membuka satu lembar hasil, dan kedaluwarsa.
    // =====================================================================
    // Semua route download memakai gerbang yang sama: token valid, belum
    // kedaluwarsa, dan file yang dilayani terbukti berada di dalam OUTPUT_PATH.
    function loadSessionByToken(req, res) {
        if (!localDownloadEnabled()) { halamanUnduhanNonaktif(res); return null; }

        const token = String(req.params.token || '');
        if (!/^[a-f0-9]{32}$/.test(token)) { res.status(400).send('Link tidak valid.'); return null; }

        const session = db.prepare('SELECT * FROM sessions WHERE token_download=?').get(token);
        if (!session) { res.status(404).send('Link tidak ditemukan.'); return null; }

        if (session.download_expires_at && Date.now() > session.download_expires_at) {
            res.status(410).send('Link download sudah kedaluwarsa. Silakan hubungi petugas.');
            return null;
        }
        return session;
    }

    // Sama seperti loadSessionByToken tetapi melewati sakelar unduhan lokal.
    // Dipakai preview kiosk yang datang dari loopback.
    function loadSessionRaw(req, res) {
        const token = String(req.params.token || '');
        if (!/^[a-f0-9]{32}$/.test(token)) { res.status(400).send('Link tidak valid.'); return null; }
        const session = db.prepare('SELECT * FROM sessions WHERE token_download=?').get(token);
        if (!session) { res.status(404).send('Link tidak ditemukan.'); return null; }
        return session;
    }

    function listSessionVideos(session) {
        let names = [];
        try { names = JSON.parse(session.video_files || '[]'); } catch { names = []; }
        const dir = resolveInsideOutput(session.session_folder);
        if (!dir) return [];
        return names.filter(n => VIDEO_FILE_RE.test(n) && fs.existsSync(path.join(dir, n)));
    }

    // Halaman unduhan — inilah yang dibuka pelanggan saat memindai QR.
    expressApp.get('/d/:token', rateLimit, (req, res) => {
        const session = loadSessionByToken(req, res);
        if (!session) return;
        // Jumlah file yang masih mengantre dipakai halaman untuk memberi tahu
        // pelanggan bahwa unggahan belum selesai.
        const antre = db.prepare(
            "SELECT COUNT(*) c FROM upload_queue WHERE session_id=? AND status IN ('pending','uploading')"
        ).get(session.id);

        res.send(renderDownloadPage(session, listSessionVideos(session), {
            folderUrl: session.drive_folder_url || '',
            pending: antre?.c || 0,
        }));
    });

    expressApp.get('/d/:token/photo', rateLimit, (req, res) => {
        // Preview di layar kiosk memakai jalur ini lewat loopback, jadi ia tetap
        // dilayani meski unduhan lokal untuk tamu sedang dinonaktifkan.
        const dariKiosk = isLoopback(req);
        const session = dariKiosk ? loadSessionRaw(req, res) : loadSessionByToken(req, res);
        if (!session) return;

        const filePath = resolveInsideOutput(session.print_path);
        if (!filePath || !fs.existsSync(filePath)) return res.status(404).send('File hasil tidak ditemukan.');

        if (req.query.dl) res.setHeader('Content-Disposition', `attachment; filename="SayGumi-${session.id}.png"`);
        res.sendFile(filePath);
    });

    expressApp.get('/d/:token/video/:index', rateLimit, (req, res) => {
        const dariKiosk = isLoopback(req);
        const session = dariKiosk ? loadSessionRaw(req, res) : loadSessionByToken(req, res);
        if (!session) return;

        const videos = listSessionVideos(session);
        const idx = parseInt(req.params.index, 10);
        if (!Number.isInteger(idx) || idx < 0 || idx >= videos.length) return res.status(404).send('Video tidak ditemukan.');

        const dir = resolveInsideOutput(session.session_folder);
        const filePath = dir ? path.join(dir, videos[idx]) : null;
        if (!filePath || !fs.existsSync(filePath)) return res.status(404).send('Video tidak ditemukan.');

        if (req.query.dl) {
            const ext = path.extname(videos[idx]) || '.webm';
            res.setHeader('Content-Disposition', `attachment; filename="SayGumi-${session.id}-video${idx + 1}${ext}"`);
        }
        res.sendFile(filePath);
    });

    // Halaman kasir hanya berisi kerangka kosong — tanpa token, semua panggilan
    // /api/ di dalamnya ditolak dan layar pairing yang muncul.
    expressApp.get('/admin', (req, res) => res.send(renderAdminPage()));

    expressApp.use('/api', rateLimit, requireCashierAuth);

    expressApp.get('/api/pending', (req, res) => {
        const st = db.prepare('SELECT active_theme FROM settings WHERE id=1').get();
        const ev = db.prepare('SELECT nama_event FROM events WHERE is_active=1 ORDER BY id DESC LIMIT 1').get();
        // Hanya transaksi yang benar-benar menunggu verifikasi manual yang
        // ditampilkan ke kasir.
        // Kasir harus tahu apa yang sedang ia setujui — pembayaran sesi baru,
        // atau permintaan cetak tambahan (yang bisa saja bernilai nol).
        const waiting = paymentIsAlive(currentPayment) && currentPayment.method === 'manual' && currentPayment.status === 'pending'
            ? {
                name: currentPayment.customerName,
                price: currentPayment.price,
                note: currentPayment.upsellOf ? `CETAK TAMBAHAN ${currentPayment.qty} LEMBAR` : null,
              }
            : {};
        res.json({ ...waiting, active_theme: st?.active_theme || 'candy', event_name: ev?.nama_event || 'Tidak Ada Sesi' });
    });

    // Kasir hanya boleh menandai lunas transaksi manual yang sedang menunggu.
    expressApp.post('/api/verify', (req, res) => {
        if (!paymentIsAlive(currentPayment) || currentPayment.method !== 'manual' || currentPayment.status !== 'pending') {
            return res.status(409).json({ success: false, error: 'Tidak ada tagihan yang menunggu verifikasi.' });
        }
        markPaymentPaid(currentPayment);
        if (mainWindow) mainWindow.webContents.send('remote-verify');
        res.json({ success: true });
    });
    expressApp.post('/api/close', (req, res) => { if(mainWindow) mainWindow.webContents.send('remote-close'); res.json({ success: true }); });
    expressApp.post('/api/restart', (req, res) => { if(mainWindow) mainWindow.webContents.send('remote-restart'); res.json({ success: true }); });

    // Kiosk photobooth adalah layar sentuh tanpa keyboard fisik, sehingga
    // Ctrl+Shift+P/T/D dan Ctrl+Panah TIDAK BISA ditekan di sana sama sekali.
    // Dua route di bawah inilah yang membuat aksi-aksi itu terjangkau.
    //
    // Nilainya divalidasi terhadap daftar putih di remote.js — main process
    // tidak meneruskan potongan URL apa pun ke renderer begitu saja.
    expressApp.post('/api/panel/:which', (req, res) => {
        const v = remote.validasiPanel(req.params.which);
        if (!v.ok) return res.status(400).json({ success: false, error: v.error });
        // Panel admin tetap memunculkan gerbang PIN di layar kiosk. HP hanya
        // memicu; ia tidak melewati satu pun lapisan keamanan.
        if (mainWindow) mainWindow.webContents.send('remote-panel', v.nilai);
        res.json({ success: true, butuhPin: remote.butuhPin(v.nilai) });
    });

    expressApp.post('/api/theme/:arah', (req, res) => {
        const v = remote.validasiArahTema(req.params.arah);
        if (!v.ok) return res.status(400).json({ success: false, error: v.error });
        if (mainWindow) mainWindow.webContents.send('remote-theme', v.nilai);
        res.json({ success: true });
    });

    // Diagnostik lapangan. Sebelum ini semuanya hanya terlihat di layar kiosk,
    // padahal justru saat ada masalah operator sedang tidak berdiri di sana.
    //
    // Penilaiannya (ambang disk, printer hilang, antrean macet) dilakukan
    // status.js yang murni; di sini hanya pengumpulan data mentahnya.
    expressApp.get('/api/status', async (req, res) => {
        const st = db.prepare('SELECT * FROM settings WHERE id=1').get() || {};
        const ev = db.prepare('SELECT nama_event FROM events WHERE is_active=1 ORDER BY id DESC LIMIT 1').get();

        let printers = [];
        try { printers = (await mainWindow.webContents.getPrintersAsync()).map(p => p.name); }
        catch { /* daftar kosong sudah cukup untuk menandai masalah */ }

        // statfs pada folder keluaran. Foldernya baru dibuat saat event pertama,
        // jadi sebelum itu diukur dari Documents yang pasti ada di drive sama.
        let diskBebasBytes = null;
        let diskTotalBytes = null;
        try {
            const target = fs.existsSync(OUTPUT_PATH) ? OUTPUT_PATH : app.getPath('documents');
            const s = fs.statfsSync(target);
            diskBebasBytes = s.bsize * s.bavail;
            diskTotalBytes = s.bsize * s.blocks;
        } catch { /* dibiarkan null; status.js memperlakukannya sebagai waspada */ }

        const mentah = {
            pinBawaan: secrets.verifyPin(DEFAULT_ADMIN_PIN, st.admin_pin_hash || ''),
            diskBebasBytes,
            modeOnline: st.app_mode === 'online',
            driveTerhubung: driveService.isConfigured(),
            antrean: driveService.queueStats(),
            printer: {
                dipilih: st.selected_printer || '',
                tersedia: printers,
                cetakAktif: st.print_enabled !== 0,
                bypass: st.hw_bypass_mode === 1,
            },
        };

        const peringatan = status.daftarPeringatan(mentah);
        res.json({
            event: ev?.nama_event || null,
            server: { ip: serverIP, port: PORT },
            disk: {
                bebas: status.formatBytes(diskBebasBytes),
                total: status.formatBytes(diskTotalBytes),
                tingkat: status.tingkatDisk(diskBebasBytes),
            },
            printer: status.ringkasPrinter(mentah.printer),
            drive: {
                terhubung: mentah.driveTerhubung,
                akun: driveService.getConfig().accountEmail || null,
                antrean: status.ringkasAntrean(mentah.antrean),
            },
            mode: st.app_mode || 'online',
            peringatan,
            tingkat: status.tingkatTertinggi(peringatan),
        });
    });

    expressApp.get('/api/history', (req, res) => {
        const ev = db.prepare('SELECT id FROM events WHERE is_active=1 ORDER BY id DESC LIMIT 1').get();
        if(!ev) return res.json([]);
        const sessions = db.prepare('SELECT * FROM sessions WHERE event_id=? ORDER BY id DESC').all(ev.id);
        res.json(sessions);
    });

    expressApp.post('/api/remote-retake/:id', (req, res) => {
        const session = db.prepare('SELECT * FROM sessions WHERE id=?').get(req.params.id);
        if (!session) return res.status(404).json({ success: false, error: 'Transaksi tidak ditemukan.' });
        // Ditandai di main; transaksi berikutnya akan berharga 0 dan tercatat
        // sebagai retake dari sesi ini, bukan penjualan baru.
        pendingRetakeOf = session.id;
        if (mainWindow) mainWindow.webContents.send('remote-retake', session);
        res.json({ success: true });
    });

    expressApp.post('/api/remote-reprint/:id', async (req, res) => {
        const session = db.prepare('SELECT * FROM sessions WHERE id=?').get(req.params.id);
        if (!session) return res.status(404).json({ success: false, error: 'Transaksi tidak ditemukan.' });

        if (mainWindow) mainWindow.webContents.send('remote-reprint', session);
        const result = await runPrintForSession(session.id, { isReprint: true });
        res.json(result);
    });

    await startLocalServer();

    createWindow();
});

/**
 * Menyalakan server lokal dan menemukan port yang benar-benar dipakai.
 *
 * Port 3000 tetap jadi pilihan pertama supaya QR dan dokumentasi tidak
 * berubah. Bila port itu sedang dipakai proses lain — hal yang wajar di
 * laptop pengembangan yang menjalankan beberapa proyek sekaligus — server
 * mundur ke port bebas. Semua URL yang dibangun belakangan (QR kasir, preview,
 * admin) membaca `PORT` setelah fungsi ini selesai, jadi tidak ada satu pun
 * tempat lain yang perlu diubah.
 *
 * Pengecualian: Google OAuth Desktop mengizinkan port loopback bebas, sehingga
 * redirect URI tetap sah meski port berpindah.
 */
async function startLocalServer() {
    // Server dibuat lebih dulu, lalu diikat ke port di listenWithFallback.
    // expressing `expressApp.listen()` langsung tidak bisa dipakai: metode itu
    // langsung mengikat port dan mengembalikan objek server BARU, sehingga
    // kita tak pernah memegang handle untuk memanggil listen() lagi saat
    // ternyata port pilihan sudah dipakai.
    const server = http.createServer(expressApp);

    const hasil = await ports.listenWithFallback(server, {
        preferred: PORT,
        host: '0.0.0.0',
        onFallback: (msg) => console.warn('[LOCAL SERVER]', msg),
    });

    PORT = hasil.port;
    console.log(`[LOCAL SERVER] Menyala di http://${serverIP}:${PORT}${hasil.fallback ? ' (port cadangan)' : ''}`);

    // Error setelah startup (mis. port direbut proses lain di tengah jalan)
    // tetap deserve dialog — ini kondisi yang butuh tindakan operator.
    server.on('error', (err) => {
        const pesan = err.code === 'EADDRINUSE'
            ? `Port ${PORT} sudah dipakai aplikasi lain.\n\nTutup aplikasi tersebut lalu jalankan ulang SayGumi!.\nTanpa port ini, HP kasir dan QR download tidak akan berfungsi.`
            : `Server lokal gagal dijalankan: ${err.message}`;
        console.error('[LOCAL SERVER]', err);
        dialog.showErrorBox('SayGumi! - Server Lokal Gagal', pesan);
    });
}

const IS_DEV = process.env.NODE_ENV === 'development';

// =========================================================================
// CONTENT SECURITY POLICY
// Berlaku untuk halaman dev yang dilayani Vite lewat HTTP. Pada build produksi
// halaman dimuat lewat file:// yang tidak punya response header, jadi policy
// yang sama disuntikkan sebagai <meta> oleh plugin di vite.config.js — keduanya
// harus dijaga tetap sinkron.
// QR Midtrans dimuat dari domain Midtrans, jadi img-src wajib mengizinkan https:.
// =========================================================================
function buildCSP() {
    const local = `http://localhost:${PORT} http://127.0.0.1:${PORT}`;
    const policy = [
        `default-src 'none'`,
        `script-src 'self'${IS_DEV ? " 'unsafe-inline' 'unsafe-eval'" : ''}`,
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' data: blob: https: ${local}`,
        `media-src 'self' blob: mediastream: ${local}`,
        `font-src 'self' data:`,
        `connect-src 'self' ${local}${IS_DEV ? ` ${DEV_WS_ORIGIN} ${DEV_ORIGIN}` : ''}`,
        `object-src 'none'`,
        `frame-src 'none'`,
        `base-uri 'none'`,
        `form-action 'none'`,
    ];
    return policy.join('; ');
}

function createWindow() {
    // CSP HANYA disuntikkan pada dokumen aplikasi sendiri.
    //
    // Sebelumnya handler ini tidak difilter, sehingga ia mengenai seluruh
    // permintaan pada default session — termasuk halaman login Google di
    // jendela OAuth, yang lalu gagal dengan ERR_BLOCKED_BY_CSP karena
    // policy kiosk melarang frame dan skrip pihak ketiga.
    //
    // Di produksi handler ini praktis tidak berjalan: halaman dimuat lewat
    // file:// yang tidak melalui webRequest, dan policy-nya ditanam sebagai
    // <meta> oleh plugin di vite.config.js.
    session.defaultSession.webRequest.onHeadersReceived(
        { urls: [`${DEV_ORIGIN}/*`] },
        (details, callback) => {
            callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [buildCSP()] } });
        }
    );

    mainWindow = new BrowserWindow({
        width: 1280, height: 720, fullscreen: true, autoHideMenuBar: true, frame: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            // Preload hanya memakai contextBridge & ipcRenderer, keduanya tetap
            // tersedia di preload yang di-sandbox.
            sandbox: true,
            webSecurity: true,
            preload: path.join(__dirname, 'preload.js'),
        }
    });

    // Jaring pengaman untuk penguncian zoom. Meta viewport di index.html sudah
    // menutup pinch dan ketuk-ganda, tapi keduanya bekerja pada lapisan yang
    // berbeda: yang ini juga mengunci Ctrl+scroll dan Ctrl+'+' dari keyboard.
    // Kiosk tidak punya kontrol apa pun untuk mengembalikan tampilan yang
    // terlanjur ter-zoom.
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
        mainWindow.webContents.setZoomFactor(1);
    });

    // Kiosk tidak pernah perlu membuka jendela atau bernavigasi ke mana pun.
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mainWindow.webContents.on('will-navigate', (event, url) => {
        const allowed = IS_DEV && url.startsWith(DEV_ORIGIN);
        if (!allowed) {
            event.preventDefault();
            console.warn('[SECURITY] Navigasi diblokir:', url);
        }
    });

    // Di produksi, DevTools adalah jalan pintas untuk membaca state aplikasi
    // langsung dari mesin kiosk yang berdiri di tempat umum.
    if (!IS_DEV) {
        mainWindow.webContents.on('devtools-opened', () => mainWindow.webContents.closeDevTools());
        mainWindow.webContents.on('before-input-event', (event, input) => {
            const key = (input.key || '').toLowerCase();
            if (key === 'f12' || (input.control && input.shift && key === 'i')) event.preventDefault();
        });
    }

    if (IS_DEV) { mainWindow.loadURL(DEV_URL); }
    else { mainWindow.loadFile(path.join(__dirname, '../dist/index.html')); }
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('ping', () => 'PONG');
ipcMain.handle('get-server-ip', () => serverIP);
// Sengaja sendSync: renderer memakai nilai ini untuk URL <img src> yang harus
// tersedia pada render pertama. Nilai PORT sudah final sebelum jendela dibuat,
// jadi tidak ada satu pun pembacaan yang tertinggal.
ipcMain.on('get-server-port', (event) => { event.returnValue = PORT; });

// Daftar adapter untuk dropdown di Pengaturan, sudah terurut skor.
ipcMain.handle('list-network-interfaces', () => ({
    current: serverIP,
    interfaces: network.listNetworkInterfaces(),
}));
// Server key TIDAK ikut dikirim ke renderer — hanya bentuk tersamarnya, cukup
// untuk operator memastikan key mana yang terpasang.
ipcMain.handle('get-settings', () => {
    const st = db.prepare('SELECT * FROM settings WHERE id=1').get();
    if (!st) return st;
    const plain = secrets.decryptSecret(st.midtrans_server_key || '');
    return {
        ...st,
        midtrans_server_key: '',
        midtrans_server_key_masked: secrets.maskSecret(plain),
        has_midtrans_server_key: !!plain,
        secure_storage_available: secrets.encryptionAvailable(),
        admin_pin_hash: undefined,
        cashier_token: undefined,
    };
});

ipcMain.handle('verify-admin-pin', (e, pin) => {
    const st = db.prepare('SELECT admin_pin_hash FROM settings WHERE id=1').get();
    return { success: secrets.verifyPin(pin, st?.admin_pin_hash || '') };
});

ipcMain.handle('is-admin-pin-default', () => {
    const st = db.prepare('SELECT admin_pin_hash FROM settings WHERE id=1').get();
    return secrets.verifyPin(DEFAULT_ADMIN_PIN, st?.admin_pin_hash || '');
});

ipcMain.handle('set-admin-pin', (e, { currentPin, newPin }) => {
    const st = db.prepare('SELECT admin_pin_hash FROM settings WHERE id=1').get();
    if (!secrets.verifyPin(currentPin, st?.admin_pin_hash || '')) {
        return { success: false, error: 'PIN lama salah.' };
    }
    if (!/^\d{4,8}$/.test(String(newPin || ''))) {
        return { success: false, error: 'PIN baru harus 4-8 digit angka.' };
    }
    db.prepare('UPDATE settings SET admin_pin_hash=? WHERE id=1').run(secrets.hashPin(newPin));
    return { success: true };
});

ipcMain.handle('save-settings', (event, data) => {
    // Renderer tidak pernah memegang server key, jadi kiriman kosong berarti
    // "jangan diubah" — bukan "hapus".
    const existing = db.prepare('SELECT midtrans_server_key FROM settings WHERE id=1').get();
    const serverKeyToStore = data.midtrans_server_key
        ? secrets.encryptSecret(String(data.midtrans_server_key).trim())
        : (existing?.midtrans_server_key || '');

    db.prepare(`UPDATE settings SET hpp_kertas=?, hpp_tinta=?, biaya_ops=?, midtrans_server_key=?, midtrans_client_key=?, app_mode=?, static_qr_path=?, force_static_qr=?, gdrive_folder_id=?, selected_camera=?, selected_printer=?, hw_bypass_mode=?, active_theme=?, print_copies=?, print_paper_size=?, print_enabled=?, download_ttl_hours=?, server_ip_override=?, consent_enabled=?, retention_days=?, session_minutes=?, retake_min_seconds=?, thanks_enabled=?, thanks_seconds=?, thanks_message=?, osk_enabled=?, shortcuts_json=? WHERE id=1`)
    .run(data.hpp_kertas || 0, data.hpp_tinta || 0, data.biaya_ops || 0, serverKeyToStore, data.midtrans_client_key || '', data.app_mode || 'online', data.static_qr_path || '', data.force_static_qr ? 1 : 0, require('./drive').extractFolderId(data.gdrive_folder_id), data.selected_camera || '', data.selected_printer || '', data.hw_bypass_mode ? 1 : 0, data.active_theme || 'candy', Math.max(1, Number(data.print_copies) || 1), data.print_paper_size || '', data.print_enabled === 0 ? 0 : 1, Number.isFinite(Number(data.download_ttl_hours)) ? Math.max(0, Number(data.download_ttl_hours)) : 24, data.server_ip_override || '',
        data.consent_enabled === 0 ? 0 : 1,
        Number.isFinite(Number(data.retention_days)) ? Math.max(0, Number(data.retention_days)) : 0,
        Number.isFinite(Number(data.session_minutes)) ? Math.min(60, Math.max(1, Number(data.session_minutes))) : 10,
        Number.isFinite(Number(data.retake_min_seconds)) ? Math.min(600, Math.max(0, Number(data.retake_min_seconds))) : 90,
        data.thanks_enabled === 0 ? 0 : 1,
        // Dibatasi 1–15 detik: di bawah 1 detik layarnya berkedip tanpa sempat
        // dibaca, di atas 15 detik kiosk berhenti melayani antrean.
        Number.isFinite(Number(data.thanks_seconds)) ? Math.min(15, Math.max(1, Number(data.thanks_seconds))) : 3,
        String(data.thanks_message || '').slice(0, 300),
        // Berbeda dari saklar lain di sekitarnya: default MATI, jadi yang
        // diperiksa adalah "apakah dinyalakan", bukan "apakah dimatikan".
        data.osk_enabled === 1 || data.osk_enabled === true ? 1 : 0,
        // Dibatasi panjangnya sebagai pengaman: kolom ini hanya menampung
        // peta pintasan, dan renderer sudah membuang isi yang tidak sah
        // saat membacanya kembali.
        String(data.shortcuts_json || '').slice(0, 2000));

    // Alamat dipakai langsung tanpa perlu restart aplikasi.
    serverIP = getLocalIP();
    return true;
});

// Membuka transaksi baru. Harga TIDAK diterima dari renderer — diambil dari
// snapshot template milik event yang bersangkutan.
ipcMain.handle('begin-payment', async (e, { eventId, templateId, customerName }) => {
    const price = getEventTemplatePrice(eventId, templateId);
    if (price === null) return { success: false, error: 'Template ini tidak terdaftar pada sesi event aktif.' };

    const st = db.prepare('SELECT * FROM settings WHERE id=1').get();
    const base = {
        id: crypto.randomBytes(8).toString('hex'),
        eventId, templateId,
        customerName: customerName || 'Tanpa Nama',
        price,
        createdAt: Date.now(),
        consumed: false,
        retakeOf: pendingRetakeOf,
    };
    pendingRetakeOf = null;

    // Retake yang diperintahkan kasir sudah dibayar pada transaksi aslinya.
    if (base.retakeOf) {
        currentPayment = { ...base, price: 0, method: 'retake', status: 'pending' };
        markPaymentPaid(currentPayment);
        return { success: true, paymentId: currentPayment.id, price: 0, method: 'retake', status: 'paid' };
    }

    if (price <= 0) {
        currentPayment = { ...base, method: 'free', status: 'pending' };
        markPaymentPaid(currentPayment);
        return { success: true, paymentId: currentPayment.id, price: 0, method: 'free', status: 'paid' };
    }

    const manual = st.app_mode === 'offline' || st.force_static_qr === 1;
    if (manual) {
        currentPayment = { ...base, method: 'manual', status: 'pending' };
        return { success: true, paymentId: currentPayment.id, price, method: 'manual', status: 'pending', staticQrPath: st.static_qr_path || '' };
    }

    try {
        const api = new midtransClient.CoreApi({
            isProduction: st.midtrans_is_production === 1,
            serverKey: getMidtransServerKey(),
            clientKey: st.midtrans_client_key,
        });
        const orderId = `ORD-${Date.now()}`;
        const charge = await api.charge({ payment_type: 'qris', transaction_details: { order_id: orderId, gross_amount: price }, qris: { acquirer: 'gopay' } });
        const qr = charge.actions?.find(a => a.name === 'generate-qr-code');
        if (!qr) return { success: false, error: 'Midtrans tidak mengembalikan QR.' };

        currentPayment = { ...base, method: 'midtrans', status: 'pending', orderId };
        return { success: true, paymentId: currentPayment.id, price, method: 'midtrans', status: 'pending', qrUrl: qr.url };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Renderer menanyakan status; untuk Midtrans, main yang menghubungi gateway.
ipcMain.handle('get-payment-status', async (e, paymentId) => {
    if (!currentPayment || currentPayment.id !== paymentId) return { success: false, status: 'expired' };
    if (!paymentIsAlive(currentPayment)) return { success: false, status: 'expired' };
    if (currentPayment.status === 'paid') return { success: true, status: 'paid' };

    if (currentPayment.method === 'midtrans') {
        const st = db.prepare('SELECT * FROM settings WHERE id=1').get();
        try {
            const api = new midtransClient.CoreApi({
                isProduction: st.midtrans_is_production === 1,
                serverKey: getMidtransServerKey(),
                clientKey: st.midtrans_client_key,
            });
            const res = await api.transaction.status(currentPayment.orderId);
            if (res.transaction_status === 'settlement' || res.transaction_status === 'capture') {
                markPaymentPaid(currentPayment);
                return { success: true, status: 'paid' };
            }
            if (['deny', 'cancel', 'expire', 'failure'].includes(res.transaction_status)) {
                return { success: false, status: 'failed', error: `Pembayaran ${res.transaction_status}.` };
            }
        } catch (err) {
            return { success: false, status: 'pending', error: err.message };
        }
    }

    return { success: true, status: 'pending' };
});

ipcMain.handle('cancel-payment', () => { currentPayment = null; return true; });

// Dipanggil saat pelanggan menekan setuju pada layar persetujuan.
ipcMain.handle('record-consent', () => { currentConsentAt = Date.now(); return { success: true }; });

ipcMain.handle('run-purge-now', (e, opts) => {
    try { return purgeOldMedia(opts || {}); }
    catch (err) { return { success: false, error: err.message }; }
});

// =========================================================================
// UPSELLING — CETAK TAMBAHAN
// Pelanggan memesan lembar tambahan setelah sesinya selesai. Harga ditentukan
// di sini: pakai upsell_price milik event bila diisi, kalau tidak ikut harga
// asli sesi tersebut. Bila hasilnya nol (event gratis) transaksi TIDAK
// diloloskan otomatis — tetap wajib divalidasi kasir, hanya tanpa Midtrans.
// =========================================================================
const MAX_UPSELL_QTY = pricing.MAX_UPSELL_QTY;

function getUpsellUnitPrice(session, event) {
    return pricing.getUpsellUnitPrice(session, event, (id) =>
        db.prepare('SELECT harga_jual FROM sessions WHERE id=?').get(id));
}

ipcMain.handle('get-upsell-info', (e, sessionId) => {
    const session = db.prepare('SELECT * FROM sessions WHERE id=?').get(sessionId);
    if (!session) return { available: false };
    const event = db.prepare('SELECT * FROM events WHERE id=?').get(session.event_id);
    if (!event?.upsell_enabled) return { available: false };

    const unitPrice = getUpsellUnitPrice(session, event);
    return { available: true, unitPrice, maxQty: MAX_UPSELL_QTY };
});

ipcMain.handle('begin-upsell-payment', async (e, { sessionId, qty }) => {
    const session = db.prepare('SELECT * FROM sessions WHERE id=?').get(sessionId);
    if (!session) return { success: false, error: 'Sesi tidak ditemukan.' };
    if (!session.print_path) return { success: false, error: 'Sesi ini tidak punya file hasil untuk dicetak.' };

    const event = db.prepare('SELECT * FROM events WHERE id=?').get(session.event_id);
    if (!event?.upsell_enabled) return { success: false, error: 'Cetak tambahan tidak diaktifkan untuk event ini.' };

    const cek = pricing.validateUpsellQty(qty);
    if (!cek.valid) return { success: false, error: cek.error };
    const jumlah = cek.qty;

    const unitPrice = getUpsellUnitPrice(session, event);
    const total = unitPrice * jumlah;
    const st = db.prepare('SELECT * FROM settings WHERE id=1').get();

    const base = {
        id: crypto.randomBytes(8).toString('hex'),
        eventId: session.event_id,
        templateId: null,
        customerName: session.customer_name,
        price: total,
        createdAt: Date.now(),
        consumed: false,
        retakeOf: null,
        upsellOf: session.id,
        qty: jumlah,
    };

    // Event gratis: tidak ada tagihan, tapi kasir tetap harus menyetujui.
    if (total <= 0) {
        currentPayment = { ...base, method: 'manual', status: 'pending' };
        return { success: true, paymentId: currentPayment.id, price: 0, qty: jumlah, method: 'manual', status: 'pending', staticQrPath: '' };
    }

    const manual = st.app_mode === 'offline' || st.force_static_qr === 1;
    if (manual) {
        currentPayment = { ...base, method: 'manual', status: 'pending' };
        return { success: true, paymentId: currentPayment.id, price: total, qty: jumlah, method: 'manual', status: 'pending', staticQrPath: st.static_qr_path || '' };
    }

    try {
        const api = new midtransClient.CoreApi({
            isProduction: st.midtrans_is_production === 1,
            serverKey: getMidtransServerKey(),
            clientKey: st.midtrans_client_key,
        });
        const orderId = `UPS-${Date.now()}`;
        const charge = await api.charge({ payment_type: 'qris', transaction_details: { order_id: orderId, gross_amount: total }, qris: { acquirer: 'gopay' } });
        const qr = charge.actions?.find(a => a.name === 'generate-qr-code');
        if (!qr) return { success: false, error: 'Midtrans tidak mengembalikan QR.' };

        currentPayment = { ...base, method: 'midtrans', status: 'pending', orderId };
        return { success: true, paymentId: currentPayment.id, price: total, qty: jumlah, method: 'midtrans', status: 'pending', qrUrl: qr.url };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Mencatat transaksi upsell lalu mencetak. Gerbangnya sama seperti
// process-images: harus lunas, belum terpakai, dan cocok dengan sesi asal.
ipcMain.handle('confirm-upsell', async (e, { paymentId }) => {
    if (!paymentIsAlive(currentPayment) || currentPayment.id !== paymentId || currentPayment.status !== 'paid') {
        return { success: false, error: 'Transaksi belum lunas atau sudah kedaluwarsa.' };
    }
    if (!currentPayment.upsellOf) return { success: false, error: 'Transaksi ini bukan cetak tambahan.' };

    const source = db.prepare('SELECT * FROM sessions WHERE id=?').get(currentPayment.upsellOf);
    if (!source) return { success: false, error: 'Sesi asal tidak ditemukan.' };

    const info = db.prepare(`INSERT INTO sessions (event_id, customer_name, folder_name, session_folder, print_path, print_orientation, waktu, harga_jual, status_cetak, upsell_of, payment_method, print_qty, hpp_snapshot, created_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(source.event_id, source.customer_name, source.folder_name, source.session_folder, source.print_path,
           source.print_orientation, new Date().toLocaleString('id-ID'), currentPayment.price, 'MENUNGGU',
           source.id, currentPayment.method, currentPayment.qty, getCurrentHpp(), Date.now());

    currentPayment.consumed = true;
    const newId = info.lastInsertRowid;

    const result = await runPrintForSession(newId, { copiesOverride: currentPayment.qty });
    return { ...result, sessionId: newId };
});

ipcMain.handle('check-hardware', async () => { try { return { success: true, printers: await mainWindow.webContents.getPrintersAsync() }; } catch (error) { return { success: false, error: error.message }; }});

ipcMain.handle('select-static-qr', async () => {
    const res = await dialog.showOpenDialog({ filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }] });
    if (res.canceled) return null;
    const filename = `qr-statis-${Date.now()}${path.extname(res.filePaths[0])}`;
    fs.copyFileSync(res.filePaths[0], path.join(STATIC_QR_PATH, filename));
    return filename; 
});

ipcMain.handle('get-active-event', () => db.prepare('SELECT * FROM events WHERE is_active=1 ORDER BY id DESC LIMIT 1').get());
ipcMain.handle('get-recent-events', () => db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 10').all());
ipcMain.handle('reopen-event', (event, eventId) => { db.prepare('UPDATE events SET is_active=0').run(); db.prepare('UPDATE events SET is_active=1 WHERE id=?').run(eventId); return { success: true }; });

ipcMain.handle('delete-event', async (event, { eventId, deleteLocal, deleteGdrive }) => {
    try {
        const ev = db.prepare('SELECT folder_name FROM events WHERE id=?').get(eventId);
        if (ev) {
            if (deleteLocal) {
                const localPath = path.join(OUTPUT_PATH, ev.folder_name);
                if (fs.existsSync(localPath)) fs.rmSync(localPath, { recursive: true, force: true });
            }
            if (deleteGdrive) { console.log("[DRIVE-SIM] Menghapus cloud folder:", ev.folder_name); }
        }
        db.prepare('DELETE FROM sessions WHERE event_id=?').run(eventId);
        db.prepare('DELETE FROM events WHERE id=?').run(eventId);
        return { success: true };
    } catch(err) { return { success: false, error: err.message }; }
});

ipcMain.handle('create-event', (event, data) => {
    try {
        db.prepare('UPDATE events SET is_active=0').run();
        const dateStr = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`;
        const folderName = `${dateStr}_${data.nama_event.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const info = db.prepare(`INSERT INTO events (nama_event, folder_name, saldo_awal, is_active, templates_json, upsell_enabled, upsell_price) VALUES (?, ?, ?, 1, ?, ?, ?)`)
          .run(data.nama_event, folderName, data.saldo_awal || 0, JSON.stringify(data.templates),
               data.upsell_enabled ? 1 : 0, Math.max(0, Number(data.upsell_price) || 0));
        const eventDir = path.join(OUTPUT_PATH, folderName);
        if (!fs.existsSync(eventDir)) fs.mkdirSync(eventDir, { recursive: true });
        return { success: true, id: info.lastInsertRowid };
    } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('close-event', async (event, eventId) => {
    // Laporan dibekukan saat event ditutup, supaya operator selalu menemukan
    // file terkini di folder event tanpa perlu menekan ekspor manual.
    try {
        const laporan = await buildEventReport(eventId);
        if (laporan.success && driveService.isConfigured()) {
            driveService.enqueue({
                eventId, filePath: laporan.path, fileName: 'Laporan_Keuangan.xlsx',
                kind: 'report', priority: 90,
            });
            driveService.drainQueue().catch(() => {});
        }
    } catch (err) { console.error('[LAPORAN]', err.message); }
    db.prepare('UPDATE events SET is_active=0 WHERE id=?').run(eventId);
    return { success: true };
});

ipcMain.handle('export-event-report', async (event, eventId) => {
    try { return await buildEventReport(eventId); }
    catch (err) { return { success: false, error: err.message }; }
});

// Operator sering baru memutuskan soal upsell setelah event berjalan.
ipcMain.handle('update-event-upsell', (event, { eventId, enabled, price }) => {
    db.prepare('UPDATE events SET upsell_enabled=?, upsell_price=? WHERE id=?')
      .run(enabled ? 1 : 0, Math.max(0, Number(price) || 0), eventId);
    return { success: true };
});
ipcMain.handle('get-templates', () => db.prepare('SELECT * FROM templates ORDER BY id DESC').all().map(r => ({ ...r, slots: JSON.parse(r.slots_json) })));
ipcMain.handle('open-file-dialog', async () => { const res = await dialog.showOpenDialog({ filters: [{ name: 'Images', extensions: ['png'] }] }); return res.canceled ? null : res.filePaths[0]; });

ipcMain.handle('save-new-template', async (event, { tempPath }) => {
    try {
        const metadata = await sharp(tempPath).metadata();
        const filename = `tpl-${Date.now()}.png`;
        fs.copyFileSync(tempPath, path.join(USER_TEMPLATES_PATH, filename));
        const info = db.prepare(`INSERT INTO templates (filename, filepath, width, height, price, is_visible, slots_json, orientation) VALUES (?, ?, ?, ?, ?, 1, '[]', 'portrait')`)
          .run(filename, path.join(USER_TEMPLATES_PATH, filename), metadata.width, metadata.height, 15000);
        return { success: true, id: info.lastInsertRowid };
    } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('update-template', async (event, data) => { 
    db.prepare(`UPDATE templates SET price=?, is_visible=?, slots_json=?, orientation=? WHERE id=?`).run(data.price || 0, data.is_visible ? 1 : 0, JSON.stringify(data.slots || []), data.orientation || 'portrait', data.id); 
    return { success: true }; 
});

ipcMain.handle('delete-template', async (event, id) => { const tpl = db.prepare('SELECT filepath FROM templates WHERE id=?').get(id); if (tpl && fs.existsSync(tpl.filepath)) fs.unlinkSync(tpl.filepath); db.prepare('DELETE FROM templates WHERE id=?').run(id); return { success: true }; });

ipcMain.handle('start-customer-session', async (event, { eventId, customerName }) => {
    const ev = db.prepare('SELECT folder_name FROM events WHERE id=?').get(eventId);
    const now = new Date();
    const dateStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, '0') + "-" + String(now.getDate()).padStart(2, '0');
    const timeStr = String(now.getHours()).padStart(2, '0') + "-" + String(now.getMinutes()).padStart(2, '0') + "-" + String(now.getSeconds()).padStart(2, '0');
    const safeName = customerName ? customerName.replace(/[^a-zA-Z0-9]/g, '_') : 'TanpaNama';
    const folderName = `${dateStr}_${timeStr}_${safeName}`;
    const sessionDir = path.join(OUTPUT_PATH, ev.folder_name, folderName);
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
    return sessionDir; 
});

// Menerima data biner mentah, bukan string base64. Path file dikembalikan agar
// proses render cukup mengirim path — bukan mengirim ulang seluruh gambar.
ipcMain.handle('save-capture', async (event, { folderPath, buffer, index }) => {
    try {
        const dir = resolveInsideOutput(folderPath);
        if (!dir) return { success: false, error: 'Lokasi penyimpanan tidak sah.' };
        const slot = parseInt(index, 10);
        if (!Number.isInteger(slot) || slot < 1 || slot > 99) return { success: false, error: 'Nomor slot tidak sah.' };

        const filePath = path.join(dir, `raw_${slot}.jpg`);
        await fs.promises.writeFile(filePath, Buffer.from(buffer));
        return { success: true, filePath };
    } catch (err) { return { success: false, error: err.message }; }
});

// Nama file ditentukan di sini, bukan di renderer. Dulu semua rekaman ditulis
// ke 'video_session.webm' sehingga rekaman retake menimpa rekaman sesi utama.
ipcMain.handle('save-video', async (event, { folderPath, buffer, ext }) => {
    try {
        const dir = resolveInsideOutput(folderPath);
        if (!dir) return { success: false, error: 'Lokasi penyimpanan tidak sah.' };

        // Ekstensi dibatasi daftar putih; ia ikut menentukan nama file di disk.
        const safeExt = ext === 'mp4' ? 'mp4' : 'webm';
        const existing = fs.readdirSync(dir).filter(f => VIDEO_FILE_RE.test(f));
        const filename = `video_${existing.length + 1}.${safeExt}`;
        await fs.promises.writeFile(path.join(dir, filename), Buffer.from(buffer));
        return { success: true, filename };
    } catch (err) { return { success: false, error: err.message }; }
});

// EXCEL & RUTE FOLDER
ipcMain.handle('process-images', async (event, { photoPaths, templateId, sessionFolderAbsolute, eventId, customerName, paymentId }) => {
    try {
        // Gerbang otorisasi: tanpa transaksi yang lunas dan belum terpakai,
        // tidak ada lembar yang dirender. Harga diambil dari transaksi itu,
        // bukan dari nilai yang dikirim renderer.
        if (!paymentIsAlive(currentPayment) || currentPayment.id !== paymentId || currentPayment.status !== 'paid') {
            return { success: false, error: 'Transaksi belum lunas atau sudah kedaluwarsa. Silakan ulangi pembayaran.' };
        }
        if (String(currentPayment.templateId) !== String(templateId) || String(currentPayment.eventId) !== String(eventId)) {
            return { success: false, error: 'Data transaksi tidak cocok dengan frame yang dipilih.' };
        }

        const price = currentPayment.price;
        const retakeOf = currentPayment.retakeOf;
        const paymentMethod = currentPayment.method;

        // Folder Drive disiapkan sejak pembayaran lunas; di sini kita tunggu
        // sebentar kalau-kalau belum selesai. Bila gagal, alur tetap lanjut
        // dengan QR lokal dan folder dibuat menyusul oleh worker antrean.
        let driveFolder = currentPayment.driveFolder || null;
        if (!driveFolder && currentPayment.drivePending) {
            driveFolder = await Promise.race([
                currentPayment.drivePending,
                new Promise(r => setTimeout(() => r(null), 4000)),
            ]).catch(() => null);
        }

        // Sesi yang kehabisan waktu tanpa satu pun foto tidak boleh menghasilkan
        // lembar kosong yang tetap ditagih penuh (bug B15). Pembayaran sengaja
        // TIDAK dikonsumsi supaya pelanggan bisa mengulang.
        const slotsTotal = (photoPaths || []).length;
        const slotsFilled = (photoPaths || []).filter(Boolean).length;
        if (slotsFilled === 0) {
            return { success: false, empty: true, error: 'Belum ada foto yang diambil. Sesi dibatalkan dan pembayaran Anda masih berlaku — silakan mulai lagi.' };
        }

        const ev = db.prepare('SELECT folder_name FROM events WHERE id=?').get(eventId);
        const eventFolder = ev.folder_name;

        const tpl = db.prepare('SELECT * FROM templates WHERE id=?').get(templateId);
        const slots = JSON.parse(tpl.slots_json);

        // Foto dibaca langsung dari disk. Sebelumnya seluruh gambar dikirim
        // ulang dari renderer sebagai base64 — dua kali lintas IPC per foto.
        // Slot kosong (sesi kehabisan waktu) diisi kotak putih di sini, bukan
        // dengan PNG 1x1 kiriman renderer.
        const compositeOps = await Promise.all((photoPaths || []).map(async (rawPath, i) => {
            const s = slots[i] || { width: 400, height: 300, top: 0, left: 0 };
            const safePath = rawPath ? resolveInsideOutput(rawPath) : null;

            const buffer = (safePath && fs.existsSync(safePath))
                ? await sharp(safePath).resize({ width: s.width, height: s.height, fit: 'cover', position: 'center' }).toBuffer()
                : await sharp({ create: { width: s.width, height: s.height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();

            return { input: buffer, top: s.top, left: s.left };
        }));
        compositeOps.push({ input: tpl.filepath, top: 0, left: 0 });

        const outputFilename = `print-${Date.now()}.png`;
        const safeSessionFolder = resolveInsideOutput(sessionFolderAbsolute);
        if (sessionFolderAbsolute && !safeSessionFolder) {
            return { success: false, error: 'Lokasi folder sesi tidak sah.' };
        }
        const outputPath = safeSessionFolder ? path.join(safeSessionFolder, outputFilename) : path.join(OUTPUT_PATH, eventFolder, outputFilename);

        await sharp({ create: { width: tpl.width, height: tpl.height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
          .composite(compositeOps).png().toFile(outputPath);

        // XLSX AKUNTANSI
        const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
        const hppSnapshot = getCurrentHpp();

        // Token download bersifat rahasia dan tidak bisa ditebak — menggantikan
        // URL berbasis nama folder yang dulu bisa direkonstruksi siapa pun.
        const downloadToken = crypto.randomBytes(16).toString('hex');
        const ttlHours = settings.download_ttl_hours ?? 24;
        const expiresAt = ttlHours > 0 ? Date.now() + ttlHours * 3600 * 1000 : null;

        // Rekaman ditulis MediaRecorder secara asinkron selama sesi; di sinilah
        // daftarnya dibekukan supaya halaman unduhan tahu apa yang tersedia.
        let videoFiles = [];
        if (safeSessionFolder && fs.existsSync(safeSessionFolder)) {
            videoFiles = fs.readdirSync(safeSessionFolder)
                .filter(f => VIDEO_FILE_RE.test(f))
                .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
        }

        // status_cetak diisi MENUNGGU dulu; nilai sebenarnya ditulis setelah
        // printer benar-benar menjawab (lihat runPrintForSession).
        const info = db.prepare(`INSERT INTO sessions (event_id, customer_name, folder_name, session_folder, print_path, print_orientation, waktu, harga_jual, status_cetak, token_download, download_expires_at, retake_of, payment_method, video_files, hpp_snapshot, created_at_ms, slots_filled, slots_total, drive_folder_id, drive_folder_url, consent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(eventId, customerName || 'Tanpa Nama', eventFolder, safeSessionFolder || '', outputPath, tpl.orientation || 'portrait', new Date().toLocaleString('id-ID'), price || 0, 'MENUNGGU', downloadToken, expiresAt, retakeOf || null, paymentMethod, JSON.stringify(videoFiles), hppSnapshot, Date.now(), slotsFilled, slotsTotal, driveFolder?.id || '', driveFolder?.url || '', currentConsentAt);

        // Sekali pakai: transaksi yang sudah dirender tidak bisa dipakai lagi.
        currentPayment.consumed = true;

        // downloadUrl dipakai untuk QR pelanggan (harus alamat LAN), previewUrl
        // dipakai <img> di layar kiosk sendiri (cukup loopback, dan membuat CSP
        // tidak perlu mengizinkan alamat dinamis).
        const sessionId = info.lastInsertRowid;

        // Foto didahulukan (prioritas kecil = lebih dulu) karena itu yang
        // paling ditunggu pelanggan; video menyusul karena jauh lebih besar.
        if (driveService.isConfigured()) {
            driveService.enqueue({
                sessionId, eventId, filePath: outputPath,
                fileName: `${drivePrefix(customerName)}-foto.png`, kind: 'photo', priority: 10,
            });
            videoFiles.forEach((nama, i) => {
                driveService.enqueue({
                    sessionId, eventId,
                    filePath: path.join(safeSessionFolder, nama),
                    fileName: `${drivePrefix(customerName)}-video${i + 1}${path.extname(nama)}`,
                    kind: 'video', priority: 50,
                });
            });
            driveService.drainQueue().catch(() => {});
        }

        // QR pelanggan menunjuk folder Drive bila tersedia — tamu tidak perlu
        // terhubung ke WiFi venue sama sekali. Bila belum ada, jatuh ke halaman
        // lokal seperti sebelumnya.
        // QR hanya dibuat bila ada tujuan yang benar-benar bisa dibuka tamu.
        // Mode online: folder Drive. Mode offline: halaman lokal.
        const localAktif = localDownloadEnabled();
        const localUrl = localAktif ? `http://${serverIP}:${PORT}/d/${downloadToken}` : null;
        const downloadUrl = driveFolder?.url || localUrl;

        // Preview di layar kiosk selalu memakai berkas lokal — ia dilayani ke
        // loopback saja dan tidak terpengaruh sakelar di atas.
        const previewUrl = `http://localhost:${PORT}/d/${downloadToken}/photo`;
        const previewVideoUrls = videoFiles.map((_, i) => `http://localhost:${PORT}/d/${downloadToken}/video/${i}`);

        return { success: true, sessionId, driveUrl: driveFolder?.url || null, localUrl, printPath: outputPath, qrCode: downloadUrl ? await qrcode.toDataURL(downloadUrl) : null, downloadUrl, previewUrl, previewVideoUrls, videoCount: videoFiles.length };
    } catch (err) { return { success: false, error: err.message }; }
});

// =========================================================================
// RETENSI DATA PRIBADI (AUTO-PURGE)
//
// Foto dan video adalah data pribadi menurut UU 27/2022 (PDP) — apalagi berisi
// wajah, dan sebagian pelanggan bisa jadi anak-anak. Menyimpannya selamanya
// tanpa batas adalah risiko kepatuhan yang tidak perlu.
//
// Yang dihapus HANYA berkas medianya. Baris transaksi di database sengaja
// DIPERTAHANKAN, karena laporan keuangan event lama harus tetap utuh. Jadi
// kepatuhan privasi dan integritas pembukuan sama-sama terjaga.
//
// Sesi yang berkasnya belum selesai diunggah ke Drive TIDAK ikut dihapus —
// menghapus sebelum cadangan selesai berarti kehilangan permanen.
// =========================================================================
function purgeOldMedia({ dryRun = false } = {}) {
    const st = db.prepare('SELECT retention_days FROM settings WHERE id=1').get();
    const hari = Number(st?.retention_days) || 0;
    if (hari <= 0) return { success: true, skipped: true, reason: 'Retensi dinonaktifkan.', deleted: 0 };

    const batas = Date.now() - hari * 24 * 3600 * 1000;

    // created_at_ms baru ada sejak Fase 12; baris lama tanpa nilai itu dilewati
    // agar tidak terhapus berdasarkan tebakan.
    const kandidat = db.prepare(`
        SELECT s.* FROM sessions s
        WHERE s.purged_at IS NULL
          AND s.created_at_ms IS NOT NULL
          AND s.created_at_ms < ?
          AND s.session_folder IS NOT NULL AND s.session_folder != ''
          AND NOT EXISTS (
              SELECT 1 FROM upload_queue q
              WHERE q.session_id = s.id AND q.status IN ('pending','uploading')
          )
    `).all(batas);

    let terhapus = 0, gagal = 0;
    const rincian = [];

    for (const sesi of kandidat) {
        const dir = resolveInsideOutput(sesi.session_folder);
        if (!dir) continue;

        if (dryRun) { rincian.push({ id: sesi.id, folder: dir }); terhapus++; continue; }

        try {
            if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
            db.prepare('UPDATE sessions SET purged_at=? WHERE id=?').run(Date.now(), sesi.id);
            terhapus++;
        } catch (err) {
            gagal++;
            console.error('[RETENSI] Gagal menghapus', dir, err.message);
        }
    }

    if (terhapus > 0 && !dryRun) {
        console.log(`[RETENSI] ${terhapus} folder sesi lebih tua dari ${hari} hari dihapus.`);
    }
    return { success: true, deleted: terhapus, failed: gagal, retentionDays: hari, dryRun, rincian };
}

// =========================================================================
// LAPORAN KEUANGAN
//
// SQLite adalah sumber kebenaran; Excel dibangkitkan on-demand dari isinya.
// Sebelumnya setiap transaksi membaca ulang seluruh workbook, menambah satu
// baris, lalu menulis ulang seluruh file — O(n) per transaksi, memakai
// pustaka xlsx yang rentan, dan berisiko merusak satu-satunya laporan event
// bila listrik mati di tengah penulisan.
//
// HPP dibaca dari hpp_snapshot milik tiap baris, sehingga mengubah setting
// HPP tidak lagi mengubah laporan historis.
// =========================================================================
function getCurrentHpp() {
    const st = db.prepare('SELECT hpp_kertas, hpp_tinta, biaya_ops FROM settings WHERE id=1').get();
    return (st.hpp_kertas || 0) + (st.hpp_tinta || 0) + (st.biaya_ops || 0);
}

function describeSession(s) {
    if (s.upsell_of) return `CETAK TAMBAHAN ${s.print_qty}x dari #${s.upsell_of}`;
    if (s.retake_of) return `RETAKE dari #${s.retake_of}`;
    return 'PENJUALAN';
}

async function buildEventReport(eventId) {
    const ev = db.prepare('SELECT * FROM events WHERE id=?').get(eventId);
    if (!ev) return { success: false, error: 'Event tidak ditemukan.' };

    const sessions = db.prepare('SELECT * FROM sessions WHERE event_id=? ORDER BY id ASC').all(eventId);
    const rows = sessions.map(s => {
        const lembar = s.print_qty || 1;
        const beban = (s.hpp_snapshot || 0) * lembar;
        const pendapatan = s.harga_jual || 0;
        return {
            id: s.id,
            waktu: s.waktu || '',
            pelanggan: s.customer_name || 'Tanpa Nama',
            jenis: describeSession(s),
            metode: s.payment_method || '-',
            lembar,
            pendapatan,
            beban,
            laba: pendapatan - beban,
            status: s.status_cetak || '-',
        };
    });

    const dir = path.join(OUTPUT_PATH, ev.folder_name);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const excelPath = path.join(dir, 'Laporan_Keuangan.xlsx');

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SayGumi! Photobooth';
    wb.created = new Date();

    const ws = wb.addWorksheet('Laporan Keuangan');
    ws.columns = [
        { header: 'ID', key: 'id', width: 6 },
        { header: 'Tanggal & Waktu', key: 'waktu', width: 22 },
        { header: 'Nama Pelanggan', key: 'pelanggan', width: 24 },
        { header: 'Jenis', key: 'jenis', width: 26 },
        { header: 'Metode Bayar', key: 'metode', width: 14 },
        { header: 'Lembar', key: 'lembar', width: 9 },
        { header: 'Pendapatan', key: 'pendapatan', width: 15 },
        { header: 'Beban HPP', key: 'beban', width: 15 },
        { header: 'Laba Bersih', key: 'laba', width: 15 },
        { header: 'Status Cetak', key: 'status', width: 14 },
    ];

    ws.addRows(rows);

    const totalPendapatan = rows.reduce((a, r) => a + r.pendapatan, 0);
    const totalBeban = rows.reduce((a, r) => a + r.beban, 0);
    const totalLembar = rows.reduce((a, r) => a + r.lembar, 0);

    ws.addRow({});
    const totalRow = ws.addRow({
        pelanggan: 'TOTAL',
        lembar: totalLembar,
        pendapatan: totalPendapatan,
        beban: totalBeban,
        laba: totalPendapatan - totalBeban,
    });

    ws.getRow(1).font = { bold: true };
    totalRow.font = { bold: true };
    ['pendapatan', 'beban', 'laba'].forEach(k => { ws.getColumn(k).numFmt = '#,##0'; });

    // Tulis ke file sementara lalu rename, supaya laporan lama tidak rusak
    // bila proses mati di tengah penulisan.
    const tempPath = excelPath + '.tmp';
    await wb.xlsx.writeFile(tempPath);
    fs.renameSync(tempPath, excelPath);

    return { success: true, path: excelPath, rows: sessions.length };
}

// =========================================================================
// JALUR CETAK
// Satu-satunya tempat status_cetak ditulis, dipakai bersama oleh tombol
// [CETAK SEKARANG] di kiosk maupun reprint dari HP kasir.
// =========================================================================
async function runPrintForSession(sessionId, { isReprint = false, copiesOverride = null } = {}) {
    const session = db.prepare('SELECT * FROM sessions WHERE id=?').get(sessionId);
    if (!session) return { success: false, error: 'Data transaksi tidak ditemukan.' };
    if (!session.print_path) return { success: false, error: 'Transaksi ini tidak punya file hasil cetak.' };

    const st = db.prepare('SELECT * FROM settings WHERE id=1').get();
    if (st.print_enabled === 0) {
        db.prepare('UPDATE sessions SET status_cetak=?, print_error=? WHERE id=?').run('DILEWATI', null, sessionId);
        // `mode` inilah yang dibaca layar pelanggan; `warning` tinggal untuk
        // log dan panel operator.
        return { success: true, mode: 'skipped', warning: 'Sesi digital: cetak fisik dimatikan di pengaturan.' };
    }

    const result = await printPhoto({
        imagePath: session.print_path,
        deviceName: st.selected_printer || '',
        copies: copiesOverride || st.print_copies || 1,
        paperSize: st.print_paper_size || '',
        landscape: session.print_orientation === 'landscape',
        bypass: st.hw_bypass_mode === 1,
        pdfOutputPath: session.print_path.replace(/\.png$/i, '.pdf'),
    });

    const status = result.success ? (result.mode === 'pdf' ? 'PDF' : 'TERCETAK') : 'GAGAL';
    db.prepare('UPDATE sessions SET status_cetak=?, print_error=?, reprint_count=reprint_count+? WHERE id=?')
      .run(status, result.error || null, isReprint ? 1 : 0, sessionId);

    return result;
}

ipcMain.handle('print-photo', async (event, { sessionId }) => runPrintForSession(sessionId));

// Mencabut akses semua HP kasir yang pernah dipasangkan (mis. HP hilang, atau
// kasir berganti orang). Setelah ini QR harus dipindai ulang.
ipcMain.handle('rotate-cashier-token', () => { rotateCashierToken(); return { success: true }; });

// =========================================================================
// GOOGLE DRIVE
// =========================================================================
ipcMain.handle('gdrive-status', () => {
    const c = driveService.getConfig();
    return {
        enabled: c.enabled,
        connected: driveService.isConfigured(),
        usingBundled: c.usingBundled,
        hasClientId: !!c.clientId,
        hasClientSecret: !!c.clientSecret,
        // Saat memakai kredensial bawaan, jangan tampilkan nilainya di form
        // override — form itu khusus untuk kredensial milik klien sendiri.
        clientId: c.usingBundled ? '' : c.clientId,
        accountEmail: c.accountEmail,
        rootFolderId: c.rootFolderId,
        redirectUri: `http://127.0.0.1:${PORT}${driveService.REDIRECT_PATH}`,
        queue: driveService.queueStats(),
    };
});

ipcMain.handle('gdrive-save-credentials', (e, data) => {
    driveService.saveClientCredentials(data);
    return { success: true };
});

// Membuka jendela consent Google. Dipisah dari jendela kiosk agar layar
// pelanggan tidak pernah menampilkan halaman login.
ipcMain.handle('gdrive-connect', async () => {
    const mulai = driveService.beginAuth();
    if (!mulai.success) return mulai;

    // Jendela lama ditutup dulu agar tidak ada dua alur OAuth berjalan bersamaan.
    if (authWindow && !authWindow.isDestroyed()) authWindow.close();

    const authWin = new BrowserWindow({
        width: 520, height: 700, autoHideMenuBar: true, parent: mainWindow, modal: true,
        webPreferences: {
            nodeIntegration: false, contextIsolation: true, sandbox: true,
            // Partisi terpisah dari kiosk: sesi login Google tidak bercampur
            // dengan session aplikasi, dan jendela ini kebal terhadap aturan
            // apa pun yang dipasang pada default session.
            partition: 'oauth-google',
        },
    });
    authWindow = authWin;
    authWin.on('closed', () => { if (authWindow === authWin) authWindow = null; });
    authWin.loadURL(mulai.url);

    // Penutupan dilakukan oleh route /oauth2callback setelah kode otorisasi
    // benar-benar diterima.
    //
    // Sebelumnya jendela ditutup ketika URL-nya MEMUAT '/oauth2callback'. Itu
    // rapuh: pada halaman password, Google menyertakan URL otorisasi asli
    // sebagai parameter `continue`, dan di dalamnya ada redirect_uri kita —
    // sehingga pencocokan substring ikut cocok dan jendela menutup diri di
    // tengah pengguna mengetik password.
    return { success: true };
});

ipcMain.handle('gdrive-disconnect', () => { driveService.disconnect(); return { success: true }; });

ipcMain.handle('gdrive-retry-failed', (e, eventId) => {
    const jumlah = driveService.retryFailed(eventId || null);
    driveService.drainQueue().catch(() => {});
    return { success: true, requeued: jumlah };
});

ipcMain.handle('gdrive-upload-now', (e, eventId) => {
    driveService.drainQueue().catch(() => {});
    return { success: true, queue: driveService.queueStats(eventId || null) };
});

ipcMain.handle('gdrive-queue-stats', (e, eventId) => driveService.queueStats(eventId || null));

// Dipakai layar landing sebagai gerbang. Sengaja hanya memeriksa apakah AKUN
// sudah tertaut — bukan apakah internet sedang hidup — supaya event tetap bisa
// berjalan offline dengan unggahan mengantre.
ipcMain.handle('gdrive-is-linked', () => driveService.isConfigured());

ipcMain.handle('get-dashboard-data', async (event, eventId) => {
    const sessions = db.prepare('SELECT * FROM sessions WHERE event_id = ? ORDER BY id DESC').all(eventId);
    const ev = db.prepare('SELECT * FROM events WHERE id=?').get(eventId);
    const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
    // Beban memakai HPP yang dibekukan per transaksi. Memakai HPP saat ini
    // membuat laporan historis berubah setiap setting diubah (bug B2).
    const hppSaatIni = (settings.hpp_kertas || 0) + (settings.hpp_tinta || 0) + (settings.biaya_ops || 0);

    // Retake tidak menambah pendapatan, tapi tetap memakan kertas & tinta —
    // jadi ia dihitung pada beban, bukan pada omzet. Cetak tambahan menambah
    // keduanya, dan bisa lebih dari satu lembar per transaksi.
    let total_revenue = 0; sessions.forEach(s => { total_revenue += (s.harga_jual || 0); });
    const total_penjualan = sessions.filter(s => !s.retake_of && !s.upsell_of).length;
    const total_retake = sessions.filter(s => s.retake_of).length;
    const upsells = sessions.filter(s => s.upsell_of);
    const total_upsell = upsells.length;
    const total_upsell_revenue = upsells.reduce((sum, s) => sum + (s.harga_jual || 0), 0);

    // Beban dihitung per lembar, memakai HPP yang berlaku saat transaksi itu.
    // Baris lama (sebelum kolom ini ada) jatuh ke HPP saat ini.
    const total_lembar = sessions.reduce((sum, s) => sum + (s.print_qty || 1), 0);
    let total_beban_hpp = sessions.reduce((sum, s) => sum + ((s.hpp_snapshot || hppSaatIni) * (s.print_qty || 1)), 0);
    let saldo_awal = ev?.saldo_awal || 0;
    
    const localPath = path.join(OUTPUT_PATH, ev?.folder_name || '');
    // QR ini adalah satu-satunya jalan HP kasir mendapatkan token akses.
    const adminUrl = `http://${serverIP}:${PORT}/admin?t=${getCashierToken()}`;
    const adminQr = await qrcode.toDataURL(adminUrl);

    return { sessions, localPath, adminQr, gdriveLink: settings.gdrive_folder_id ? `Folder ID: ${settings.gdrive_folder_id}` : 'Belum disetting', upsell: { enabled: ev?.upsell_enabled === 1, price: ev?.upsell_price || 0 },
        drive: {
            configured: driveService.isConfigured(),
            folderUrl: ev?.drive_folder_url || '',
            queue: driveService.queueStats(eventId),
        },
        stats: { total_trx: sessions.length, total_penjualan, total_retake, total_upsell, total_upsell_revenue, total_lembar, total_revenue, total_beban_hpp, saldo_awal, sisa_saldo: saldo_awal - total_beban_hpp, laba_bersih: total_revenue - total_beban_hpp } };
});

// create-qris & check-payment dihapus: keduanya membiarkan renderer yang
// menentukan besaran tagihan dan menyimpulkan status lunas. Digantikan oleh
// begin-payment / get-payment-status yang otoritasnya ada di main process.