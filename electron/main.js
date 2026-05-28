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

// Buat folder khusus QR Statis agar aman diakses Express
const STATIC_QR_PATH = path.join(app.getPath('userData'), 'static_qr');
if (!fs.existsSync(STATIC_QR_PATH)) fs.mkdirSync(STATIC_QR_PATH, { recursive: true });

function getLocalIP() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal && !name.toLowerCase().includes('vethernet')) {
                return net.address;
            }
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
    expressApp.use('/qr', express.static(STATIC_QR_PATH)); // [BARU] Akses gambar QR statis

    // [BARU] Halaman Remote Kasir untuk HP Admin
    expressApp.get('/admin', (req, res) => {
        res.send(`
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>SayGumi! Cashier Hub</title>
            </head>
            <body style="font-family: sans-serif; text-align: center; padding: 20px; background: #f4f4f4;">
                <h2>SayGumi! Remote Cashier</h2>
                <p style="color: #666;">Tekan tombol di bawah HANYA JIKA pelanggan sudah transfer ke QRIS Statis.</p>
                <br/>
                <button onclick="fetch('/api/verify').then(()=>alert('Pelanggan berhasil diloloskan ke kamera!'))" 
                        style="padding: 20px; font-size: 18px; font-weight: bold; background: #4CAF50; color: white; border: none; border-radius: 8px; width: 100%; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    ✅ VERIFIKASI PEMBAYARAN
                </button>
            </body>
            </html>
        `);
    });

    // Endpoint yang ditembak oleh tombol di HP Admin
    expressApp.get('/api/verify', (req, res) => {
        if(mainWindow) mainWindow.webContents.send('manual-verify-trigger');
        res.json({ success: true });
    });

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
        fullscreen: true,       // Memaksa layar penuh menutupi taskbar
        autoHideMenuBar: true,  // Menyembunyikan menu File, Edit, View
        frame: false,           // Menghapus border dan tombol [X] Windows
        kiosk: true,            // Mengunci mode Kiosk
        webPreferences: { 
            nodeIntegration: false, 
            contextIsolation: true, 
            preload: path.join(__dirname, 'preload.js') 
        }
    });
    
    if (process.env.NODE_ENV === 'development') { 
        mainWindow.loadURL('http://localhost:5173'); 
    } else { 
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html')); 
    }
}

app.on('window-all-closed', () => { 
    if (process.platform !== 'darwin') app.quit(); 
});

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
        midtrans_server_key=?, midtrans_client_key=?, app_mode=? 
        WHERE id=1
    `);
    stmt.run(
        data.hpp_kertas || 0, 
        data.hpp_tinta || 0, 
        data.biaya_ops || 0, 
        data.midtrans_server_key || '', 
        data.midtrans_client_key || '', 
        data.app_mode || 'online'
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
    // Simpan ke folder yang di-expose Express
    const newPath = path.join(app.getPath('userData'), 'static_qr', filename);
    fs.copyFileSync(res.filePaths[0], newPath);
    
    return filename; // Hanya return nama filenya saja
});