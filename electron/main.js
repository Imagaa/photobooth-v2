const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const sharp = require('sharp');
const qrcode = require('qrcode');
const midtransClient = require('midtrans-client');
const express = require('express');

const db = require('./database');

// ==========================================
// 1. SETUP LINGKUNGAN FOLDER
// ==========================================
const USER_TEMPLATES_PATH = path.join(app.getPath('userData'), 'user_templates');
const OUTPUT_PATH = path.join(app.getPath('documents'), 'Photobooth_Output'); 

if (!fs.existsSync(USER_TEMPLATES_PATH)) fs.mkdirSync(USER_TEMPLATES_PATH, { recursive: true });
if (!fs.existsSync(OUTPUT_PATH)) fs.mkdirSync(OUTPUT_PATH, { recursive: true });

// ==========================================
// 2. EXPRESS SERVER (KASIR & DOWNLOAD)
// ==========================================
const expressApp = express();
const PORT = 3000;
let serverIP = 'localhost';

const STATIC_QR_PATH = path.join(app.getPath('userData'), 'static_qr');
if (!fs.existsSync(STATIC_QR_PATH)) fs.mkdirSync(STATIC_QR_PATH, { recursive: true });

// [BARU] Memori untuk menyimpan data pelanggan yang sedang antre bayar
let currentPendingCustomer = null; 

function getLocalIP() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal && !name.toLowerCase().includes('vethernet')) return net.address;
        }
    }
    return '127.0.0.1';
}

app.whenReady().then(() => {
    serverIP = getLocalIP();
    
    expressApp.get('/api/status', (req, res) => {
        const settings = db.prepare('SELECT app_mode FROM settings WHERE id=1').get();
        const activeEvent = db.prepare('SELECT nama_event FROM events WHERE is_active=1 ORDER BY id DESC LIMIT 1').get();
        res.json({ status: 'OK', machine_ip: serverIP, mode: settings?.app_mode, event: activeEvent?.nama_event || 'Tidak Ada Sesi' });
    });

    expressApp.use('/download', express.static(OUTPUT_PATH));
    expressApp.use('/templates', express.static(USER_TEMPLATES_PATH));
    expressApp.use('/qr', express.static(STATIC_QR_PATH));

    // ==========================================
    // UI WEB REMOTE CASHIER (DENGAN LIST ANTREAN)
    // ==========================================
    expressApp.get('/admin', (req, res) => {
        res.send(`
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>SayGumi! Cashier Hub</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; background: #222; color: #fff; }
                    .card { background: #333; padding: 20px; border-radius: 8px; border: 2px solid #555; text-align: center; }
                    .btn { display: block; width: 100%; padding: 15px; margin-bottom: 15px; font-size: 16px; font-weight: bold; border: none; cursor: pointer; text-transform: uppercase; border-radius: 5px; }
                    .btn-verify { background: #4CAF50; color: white; margin-top: 20px; }
                    .btn-danger { background: #f44336; color: white; }
                    .btn-warning { background: #ffeb3b; color: #000; }
                </style>
                <script>
                    async function loadPending() {
                        try {
                            const res = await fetch('/api/pending');
                            const data = await res.json();
                            const container = document.getElementById('pending-container');
                            if(!data || !data.name) {
                                container.innerHTML = '<p style="text-align:center; color:#888; margin: 40px 0;">Tidak ada pelanggan yang menunggu verifikasi pembayaran.</p>';
                            } else {
                                container.innerHTML = '<div class="card"><h2 style="margin-top:0;">👤 ' + data.name + '</h2><p style="color:#aaa;">Frame: ' + data.template + '</p><h1 style="color:#4CAF50; font-size: 32px; margin: 10px 0;">Rp ' + data.price.toLocaleString('id-ID') + '</h1><button class="btn btn-verify" onclick="verify()">✅ Verifikasi & Loloskan</button></div>';
                            }
                        } catch(e) {}
                    }
                    async function verify() { await fetch('/api/verify'); loadPending(); }
                    setInterval(loadPending, 2000); // Cek antrean setiap 2 detik
                    window.onload = loadPending;
                </script>
            </head>
            <body>
                <h2 style="text-align:center; margin-bottom: 30px;">📸 SayGumi! Cashier</h2>
                <h3 style="color: #aaa;">Antrean Pembayaran:</h3>
                <div id="pending-container">Memuat...</div>

                <hr style="border-color: #444; margin: 40px 0;" />
                <h3 style="color: #aaa;">Remote Control Mesin:</h3>
                <button class="btn btn-warning" onclick="if(confirm('Akhiri dan Tutup Event Berjalan?')) fetch('/api/close')">🔒 Tutup Sesi Event</button>
                <button class="btn btn-danger" onclick="if(confirm('Restart aplikasi Photobooth?')) fetch('/api/restart')">🔄 Restart Aplikasi</button>
            </body>
            </html>
        `);
    });

    expressApp.get('/api/pending', (req, res) => res.json(currentPendingCustomer || {}));
    expressApp.get('/api/verify', (req, res) => { 
        currentPendingCustomer = null; 
        if(mainWindow) mainWindow.webContents.send('remote-verify'); 
        res.json({ success: true }); 
    });
    expressApp.get('/api/close', (req, res) => { if(mainWindow) mainWindow.webContents.send('remote-close'); res.json({ success: true }); });
    expressApp.get('/api/restart', (req, res) => { if(mainWindow) mainWindow.webContents.send('remote-restart'); res.json({ success: true }); });

    expressApp.listen(PORT, '0.0.0.0', () => console.log(`[LOCAL SERVER] Menyala di http://${serverIP}:${PORT}`));
    createWindow();
});

// ==========================================
// 3. ELECTRON BROWSER WINDOW
// ==========================================
let mainWindow;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280, height: 720, 
        fullscreen: true,       // Layar Penuh menutupi taskbar
        autoHideMenuBar: true,  // Menyembunyikan file, edit, view
        frame: false,           // Menghapus tombol silang/minimize Windows
        webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
    });
    if (process.env.NODE_ENV === 'development') { 
        mainWindow.loadURL('http://localhost:5173'); 
        // mainWindow.webContents.openDevTools(); // DIHAPUS agar inspect element tidak terbuka otomatis
    } 
    else { mainWindow.loadFile(path.join(__dirname, '../dist/index.html')); }
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ==========================================
// 4. IPC HANDLERS: GLOBAL SETTINGS
// ==========================================
ipcMain.handle('ping', () => 'PONG');
ipcMain.handle('get-server-ip', () => serverIP);
ipcMain.handle('get-settings', () => db.prepare('SELECT * FROM settings WHERE id=1').get());

ipcMain.handle('save-settings', (event, data) => {
    const stmt = db.prepare(`
        UPDATE settings SET 
        hpp_kertas=?, hpp_tinta=?, biaya_ops=?, 
        midtrans_server_key=?, midtrans_client_key=?, app_mode=?,
        static_qr_path=?, force_static_qr=?, gdrive_folder_id=?,
        selected_camera=?, selected_printer=?, hw_bypass_mode=?
        WHERE id=1
    `);
    
    stmt.run(
        data.hpp_kertas || 0, 
        data.hpp_tinta || 0, 
        data.biaya_ops || 0, 
        data.midtrans_server_key || '', 
        data.midtrans_client_key || '', 
        data.app_mode || 'online',
        data.static_qr_path || '',
        data.force_static_qr || 0,
        data.gdrive_folder_id || '',
        data.selected_camera || '',
        data.selected_printer || '',
        data.hw_bypass_mode || 0
    );
    return true;
});

// ==========================================
// 5. IPC HANDLERS: EVENT SESSION MANAGEMENT
// ==========================================
ipcMain.handle('get-active-event', () => {
    return db.prepare('SELECT * FROM events WHERE is_active=1 ORDER BY id DESC LIMIT 1').get();
});

ipcMain.handle('get-recent-events', () => {
    return db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 10').all();
});

ipcMain.handle('reopen-event', (event, eventId) => {
    db.prepare('UPDATE events SET is_active=0').run();
    db.prepare('UPDATE events SET is_active=1 WHERE id=?').run(eventId);
    return { success: true };
});

ipcMain.handle('create-event', (event, data) => {
    try {
        db.prepare('UPDATE events SET is_active=0').run();
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        const folderName = `${dateStr}_${data.nama_event.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        const info = db.prepare(`
            INSERT INTO events (nama_event, folder_name, saldo_awal, is_active, templates_json) 
            VALUES (?, ?, ?, 1, ?)
        `).run(data.nama_event, folderName, data.saldo_awal || 0, JSON.stringify(data.templates));

        const eventDir = path.join(OUTPUT_PATH, folderName);
        if (!fs.existsSync(eventDir)) {
            fs.mkdirSync(eventDir, { recursive: true });
        }
        
        return { success: true, id: info.lastInsertRowid };
    } catch (err) { 
        return { success: false, error: err.message }; 
    }
});

ipcMain.handle('close-event', (event, eventId) => { 
    db.prepare('UPDATE events SET is_active=0 WHERE id=?').run(eventId); 
    return { success: true }; 
});

// ==========================================
// 6. IPC HANDLERS: MASTER TEMPLATES
// ==========================================
ipcMain.handle('get-templates', () => {
    return db.prepare('SELECT * FROM templates ORDER BY id DESC').all().map(r => ({ ...r, slots: JSON.parse(r.slots_json) }));
});

ipcMain.handle('open-file-dialog', async () => { 
    const res = await dialog.showOpenDialog({ filters: [{ name: 'Images', extensions: ['png'] }] }); 
    return res.canceled ? null : res.filePaths[0]; 
});

ipcMain.handle('save-new-template', async (event, { tempPath }) => {
    try {
        const metadata = await sharp(tempPath).metadata();
        const filename = `tpl-${Date.now()}.png`;
        const newPath = path.join(USER_TEMPLATES_PATH, filename);
        fs.copyFileSync(tempPath, newPath);
        
        const info = db.prepare(`
            INSERT INTO templates (filename, filepath, width, height, price, is_visible, slots_json) 
            VALUES (?, ?, ?, ?, ?, 1, '[]')
        `).run(filename, newPath, metadata.width, metadata.height, 15000);
        
        return { success: true, id: info.lastInsertRowid };
    } catch (e) { 
        return { success: false, error: e.message }; 
    }
});

ipcMain.handle('update-template', async (event, data) => { 
    db.prepare(`UPDATE templates SET price=?, is_visible=?, slots_json=? WHERE id=?`)
      .run(data.price || 0, data.is_visible ? 1 : 0, JSON.stringify(data.slots || []), data.id); 
    return { success: true }; 
});

ipcMain.handle('delete-template', async (event, id) => {
    const tpl = db.prepare('SELECT filepath FROM templates WHERE id=?').get(id);
    if (tpl && fs.existsSync(tpl.filepath)) fs.unlinkSync(tpl.filepath);
    db.prepare('DELETE FROM templates WHERE id=?').run(id);
    return { success: true };
});

// ==========================================
// 7. IPC HANDLERS: TRANSAKSI CUSTOMER & ENGINE
// ==========================================
ipcMain.handle('start-customer-session', async (event, eventId) => {
    const ev = db.prepare('SELECT folder_name FROM events WHERE id=?').get(eventId);
    if (!ev) throw new Error("Event tidak ditemukan!");
    const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    const sessionDir = path.join(OUTPUT_PATH, ev.folder_name, `${timeStr}_Customer`);
    fs.mkdirSync(sessionDir, { recursive: true });
    return sessionDir;
});

ipcMain.handle('save-capture', async (event, { folderPath, base64Data, index }) => {
    try { 
        fs.writeFileSync(path.join(folderPath, `raw_${index}.jpg`), Buffer.from(base64Data.split(';base64,').pop(), 'base64')); 
        return { success: true }; 
    } catch (err) { 
        return { success: false, error: err.message }; 
    }
});

ipcMain.handle('process-images', async (event, { photosBase64, templateId, eventFolder, eventId, customerName, price }) => {
    try {
        const tpl = db.prepare('SELECT * FROM templates WHERE id=?').get(templateId);
        const slots = JSON.parse(tpl.slots_json);
        
        const compositeOps = await Promise.all(photosBase64.map(async (b64, i) => {
            const s = slots[i] || { width: 400, height: 300, top: 0, left: 0 };
            const imgBuffer = Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const resized = await sharp(imgBuffer).resize({ width: s.width, height: s.height, fit: 'cover', position: 'center' }).toBuffer();
            return { input: resized, top: s.top, left: s.left };
        }));
        
        compositeOps.push({ input: tpl.filepath, top: 0, left: 0 });

        const outputFilename = `print-${Date.now()}.png`;
        const outputPath = path.join(OUTPUT_PATH, eventFolder, outputFilename); 
        
        await sharp({ create: { width: tpl.width, height: tpl.height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
            .composite(compositeOps).png().toFile(outputPath);

        db.prepare(`
            INSERT INTO sessions (event_id, customer_name, folder_name, waktu, harga_jual, status_cetak) 
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(eventId, customerName || 'Tanpa Nama', eventFolder, new Date().toLocaleString('id-ID'), price || 0, 'TERCETAK');
        
        const downloadUrl = `http://${serverIP}:${PORT}/download/${eventFolder}/${outputFilename}`;
        return { success: true, printPath: outputPath, qrCode: await qrcode.toDataURL(downloadUrl), downloadUrl };
    } catch (err) { 
        return { success: false, error: err.message }; 
    }
});

// ==========================================
// 8. IPC HANDLERS: DASHBOARD P&L & FILE INFO
// ==========================================
ipcMain.handle('get-dashboard-data', async (event, eventId) => {
    const sessions = db.prepare('SELECT * FROM sessions WHERE event_id = ? ORDER BY id DESC').all(eventId);
    const ev = db.prepare('SELECT * FROM events WHERE id=?').get(eventId);
    const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
    
    const hpp_total = (settings.hpp_kertas || 0) + (settings.hpp_tinta || 0) + (settings.biaya_ops || 0);
    let total_revenue = 0;
    sessions.forEach(s => { total_revenue += (s.harga_jual || 0); });
    
    const total_beban_hpp = sessions.length * hpp_total;
    const saldo_awal = ev?.saldo_awal || 0;
    
    // Generate Info Direktori & QR Admin
    const localPath = path.join(OUTPUT_PATH, ev?.folder_name || '');
    const adminUrl = `http://${serverIP}:${PORT}/admin`;
    const adminQr = await qrcode.toDataURL(adminUrl);

    return {
        sessions,
        localPath,
        adminQr,
        gdriveLink: settings.gdrive_folder_id ? `Folder ID: ${settings.gdrive_folder_id}` : 'Belum disetting di Global Settings',
        stats: {
            total_trx: sessions.length,
            total_revenue,
            total_beban_hpp,
            saldo_awal,
            sisa_saldo: saldo_awal - total_beban_hpp,
            laba_bersih: total_revenue - total_beban_hpp
        }
    };
});

// ==========================================
// 9. IPC HANDLERS: MIDTRANS
// ==========================================
ipcMain.handle('create-qris', async (e, amount) => {
    const st = db.prepare('SELECT midtrans_server_key, midtrans_client_key FROM settings WHERE id=1').get();
    if (!st || !st.midtrans_server_key) return { success: false, error: "API Key belum diset!" };
    try {
        const api = new midtransClient.CoreApi({ isProduction: false, serverKey: st.midtrans_server_key, clientKey: st.midtrans_client_key });
        const oid = `ORD-${Date.now()}`;
        const res = await api.charge({ payment_type: "qris", transaction_details: { order_id: oid, gross_amount: amount }, qris: { acquirer: "gopay" } });
        const qrAction = res.actions?.find(a => a.name === 'generate-qr-code');
        if (qrAction) return { success: true, orderId: oid, qrUrl: qrAction.url };
        return { success: false, error: "Gagal Midtrans" };
    } catch (e) { 
        return { success: false, error: e.message }; 
    }
});

ipcMain.handle('check-payment', async (e, oid) => {
    const st = db.prepare('SELECT midtrans_server_key, midtrans_client_key FROM settings WHERE id=1').get();
    try { 
        const api = new midtransClient.CoreApi({ isProduction: false, serverKey: st.midtrans_server_key, clientKey: st.midtrans_client_key });
        const statusRes = await api.transaction.status(oid);
        return { success: true, status: statusRes.transaction_status }; 
    } catch (e) { 
        return { success: false, error: e.message }; 
    }
});

// ==========================================
// 10. IPC HANDLERS: HARDWARE & STATIC FILES
// ==========================================
ipcMain.handle('check-hardware', async () => {
    try {
        const printers = await mainWindow.webContents.getPrintersAsync();
        return { success: true, printers: printers };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('select-static-qr', async () => {
    const res = await dialog.showOpenDialog({ filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }] });
    if (res.canceled) return null;
    
    const filename = `qr-statis-${Date.now()}${path.extname(res.filePaths[0])}`;
    const newPath = path.join(app.getPath('userData'), 'static_qr', filename);
    fs.copyFileSync(res.filePaths[0], newPath);
    
    return filename; 
});

ipcMain.handle('set-pending-payment', (e, data) => { currentPendingCustomer = data; return true; });
ipcMain.handle('clear-pending-payment', (e) => { currentPendingCustomer = null; return true; });