const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const sharp = require('sharp');
const qrcode = require('qrcode');
const midtransClient = require('midtrans-client');
const express = require('express');

const db = require('./database');

const USER_TEMPLATES_PATH = path.join(app.getPath('userData'), 'user_templates');
const OUTPUT_PATH = path.join(app.getPath('documents'), 'Photobooth_Output'); 
const STATIC_QR_PATH = path.join(app.getPath('userData'), 'static_qr');

if (!fs.existsSync(USER_TEMPLATES_PATH)) fs.mkdirSync(USER_TEMPLATES_PATH, { recursive: true });
if (!fs.existsSync(OUTPUT_PATH)) fs.mkdirSync(OUTPUT_PATH, { recursive: true });
if (!fs.existsSync(STATIC_QR_PATH)) fs.mkdirSync(STATIC_QR_PATH, { recursive: true });

let currentPendingCustomer = null; 

const expressApp = express();
const PORT = 3000;
let serverIP = 'localhost';

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

    // [ROMBAK TOTAL] Antarmuka Gameboy (Portrait) & PS Vita (Landscape)
    expressApp.get('/admin', (req, res) => {
        res.send(`
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
                <title>SayGumi! Cashier</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
                    :root { --primary: #007CC3; --secondary: #FFD453; --accent: #FF3B67; --bg: #007CC3; }
                    body.theme-candy { --primary: #007CC3; --secondary: #FFD453; --accent: #FF3B67; --bg: #007CC3; }
                    body.theme-bumblebee { --primary: #E5A93B; --secondary: #FAF2E3; --accent: #754A05; --bg: #E5A93B; }
                    body.theme-neon { --primary: #1E1F22; --secondary: #7F56FF; --accent: #80FF56; --bg: #1E1F22; }
                    body.theme-fall { --primary: #354E47; --secondary: #FAF2E3; --accent: #DB627A; --bg: #354E47; }
                    
                    body { font-family: 'Press Start 2P', cursive; background: var(--bg); color: #fff; margin:0; overflow: hidden; transition: background-color 0.5s ease; user-select: none; }
                    
                    /* Gameboy Portrait Base */
                    .container { display: flex; flex-direction: column; height: 100vh; padding: 15px; box-sizing: border-box; gap: 15px; }
                    .monitor { background: #111; border: 6px solid var(--secondary); flex: 1; padding: 15px; overflow-y: auto; color: var(--secondary); box-shadow: inset 4px 4px 0 #000; display: flex; flex-direction: column; transition: border-color 0.5s, color 0.5s; }
                    .d-pad, .action-buttons { display: flex; flex-direction: column; gap: 10px; }
                    
                    /* PS Vita Landscape Base */
                    @media (orientation: landscape) {
                        .container { flex-direction: row; align-items: stretch; justify-content: center; padding: 20px; }
                        .monitor { flex: 2; margin: 0 10px; }
                        .d-pad, .action-buttons { flex: 1; justify-content: center; }
                    }

                    .btn { background: var(--secondary); color: #000; border: 4px solid #000; font-family: 'Press Start 2P'; padding: 15px; font-size: 10px; cursor: pointer; text-transform: uppercase; box-shadow: 4px 4px 0 #000; text-align: center; transition: background-color 0.5s; }
                    .btn:active { transform: translateY(2px); box-shadow: 2px 2px 0 #000; }
                    .btn-danger { background: var(--accent); color: #fff; }
                    .btn-primary { background: var(--primary); color: #fff; }
                    
                    .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 100; flex-direction: column; padding: 15px; }
                    .modal.active { display: flex; }
                    .modal-content { background: var(--primary); border: 6px solid var(--secondary); flex: 1; overflow-y: auto; padding: 10px; margin-bottom: 15px; transition: background-color 0.5s, border-color 0.5s; }
                    .history-item { background: #fff; color: #000; padding: 10px; margin-bottom: 10px; border: 4px solid #000; font-size: 10px; display:flex; flex-direction: column; gap: 10px; }
                    .history-item-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px dashed #ccc; padding-bottom: 5px; }
                    .history-actions { display: flex; gap: 10px; }
                    .history-actions button { flex: 1; padding: 10px; font-size: 8px; }
                </style>
                <script>
                    async function fetchPending() {
                        try {
                            const res = await fetch('/api/pending');
                            const data = await res.json();
                            document.body.className = 'theme-' + (data.active_theme || 'candy');
                            document.getElementById('event-name').innerText = '[ LIVE: ' + (data.event_name || 'Tidak Ada Sesi') + ' ]';
                            
                            const m = document.getElementById('monitor-content');
                            if(!data.name) {
                                m.innerHTML = '<div style="text-align:center; margin-top:50px; opacity:0.5; font-size:12px; line-height:2;">-- SIAP --<br>TIDAK ADA ANTREAN</div>';
                            } else {
                                m.innerHTML = '<div style="text-align:center; margin-top:10px;"><p style="font-size:10px; color:#fff;">Pelanggan:</p><p style="font-size:16px;">' + data.name + '</p><p style="font-size:10px; color:#fff; margin-top:20px;">Tagihan:</p><p style="font-size:20px; color:#fff;">Rp ' + data.price.toLocaleString('id-ID') + '</p></div>';
                            }
                        } catch(e) {}
                    }
                    setInterval(fetchPending, 2000);
                    window.onload = fetchPending;
                    
                    async function verify() { await fetch('/api/verify'); fetchPending(); }
                    
                    async function openHistory() {
                        document.getElementById('history-modal').classList.add('active');
                        document.getElementById('history-list').innerHTML = '<div style="text-align:center; color:#fff; margin-top:20px;">Memuat data...</div>';
                        try {
                            const res = await fetch('/api/history');
                            const data = await res.json();
                            const list = document.getElementById('history-list');
                            list.innerHTML = '';
                            if(data.length === 0) { list.innerHTML = '<div style="text-align:center; color:#fff; margin-top:20px;">Belum ada penjualan.</div>'; return; }
                            
                            data.forEach(s => {
                                list.innerHTML += \`
                                    <div class="history-item">
                                        <div class="history-item-header">
                                            <span>\${s.customer_name}</span>
                                            <span style="color:var(--primary);">Rp \${(s.harga_jual/1000)}k</span>
                                        </div>
                                        <div style="font-size:8px; color:#666;">\${s.waktu} | Status: \${s.status_cetak}</div>
                                        <div class="history-actions">
                                            <button class="btn btn-primary" onclick="remoteRetake(\${s.id}, '\${s.customer_name}')">[ RETAKE ]</button>
                                            <button class="btn" onclick="remoteReprint(\${s.id}, '\${s.customer_name}')">[ REPRINT ]</button>
                                        </div>
                                    </div>\`;
                            });
                        } catch(e) { document.getElementById('history-list').innerHTML = '<div style="text-align:center; color:#fff;">Error memuat data.</div>'; }
                    }
                    function closeHistory() { document.getElementById('history-modal').classList.remove('active'); }
                    
                    async function remoteRetake(id, name) { if(confirm('Mulai Retake untuk pelanggan: ' + name + '? Aplikasi akan otomatis membuka kamera.')) { await fetch('/api/remote-retake/'+id); closeHistory(); } }
                    async function remoteReprint(id, name) { if(confirm('Cetak ulang foto untuk: ' + name + '?')) { await fetch('/api/remote-reprint/'+id); alert('Perintah cetak ulang dikirim!'); } }
                </script>
            </head>
            <body>
                <div class="container">
                    <div class="d-pad">
                        <button class="btn btn-danger" onclick="if(confirm('Tutup Sesi Event Berjalan?')) fetch('/api/close')">[ TUTUP EVENT ]</button>
                        <button class="btn btn-danger" onclick="if(confirm('Restart Mesin Kiosk?')) fetch('/api/restart')">[ RESTART MESIN ]</button>
                    </div>
                    
                    <div class="monitor">
                        <div id="event-name" style="text-align:center; font-size:10px; margin-bottom:15px; border-bottom:4px solid currentColor; padding-bottom:10px; line-height:1.5;">Loading...</div>
                        <div id="monitor-content" style="flex:1;"></div>
                    </div>

                    <div class="action-buttons">
                        <button class="btn" style="padding:25px 15px; font-size:14px;" onclick="verify()">[ VERIFIKASI ]</button>
                        <button class="btn btn-primary" onclick="openHistory()">[ RIWAYAT PESANAN ]</button>
                    </div>
                </div>
                
                <div class="modal" id="history-modal">
                    <h2 style="color:var(--secondary); text-align:center; font-size:14px; margin-bottom:15px; text-shadow:2px 2px #000;">[ RIWAYAT PESANAN ]</h2>
                    <div class="modal-content" id="history-list"></div>
                    <button class="btn btn-danger" onclick="closeHistory()">[ KEMBALI ]</button>
                </div>
            </body>
            </html>
        `);
    });

    expressApp.get('/api/pending', (req, res) => {
        const st = db.prepare('SELECT active_theme FROM settings WHERE id=1').get();
        const ev = db.prepare('SELECT nama_event FROM events WHERE is_active=1 ORDER BY id DESC LIMIT 1').get();
        res.json({
            ...(currentPendingCustomer || {}),
            active_theme: st?.active_theme || 'candy',
            event_name: ev?.nama_event || 'Tidak Ada Sesi'
        });
    });
    
    expressApp.get('/api/verify', (req, res) => { currentPendingCustomer = null; if(mainWindow) mainWindow.webContents.send('remote-verify'); res.json({ success: true }); });
    expressApp.get('/api/close', (req, res) => { if(mainWindow) mainWindow.webContents.send('remote-close'); res.json({ success: true }); });
    expressApp.get('/api/restart', (req, res) => { if(mainWindow) mainWindow.webContents.send('remote-restart'); res.json({ success: true }); });

    // [BARU] API Kasir: Riwayat Pesanan
    expressApp.get('/api/history', (req, res) => {
        const ev = db.prepare('SELECT id FROM events WHERE is_active=1 ORDER BY id DESC LIMIT 1').get();
        if(!ev) return res.json([]);
        const sessions = db.prepare('SELECT * FROM sessions WHERE event_id=? ORDER BY id DESC').all(ev.id);
        res.json(sessions);
    });

    // [BARU] API Kasir: Remote Retake & Reprint
    expressApp.get('/api/remote-retake/:id', (req, res) => {
        const session = db.prepare('SELECT * FROM sessions WHERE id=?').get(req.params.id);
        if(mainWindow && session) mainWindow.webContents.send('remote-retake', session);
        res.json({ success: true });
    });
    expressApp.get('/api/remote-reprint/:id', (req, res) => {
        const session = db.prepare('SELECT * FROM sessions WHERE id=?').get(req.params.id);
        if(mainWindow && session) mainWindow.webContents.send('remote-reprint', session);
        res.json({ success: true });
    });

    expressApp.listen(PORT, '0.0.0.0', () => console.log(`[LOCAL SERVER] Menyala di http://${serverIP}:${PORT}`));
    createWindow();
});

let mainWindow;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280, height: 720, 
        fullscreen: true,       
        autoHideMenuBar: true,  
        frame: false,           
        webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
    });
    if (process.env.NODE_ENV === 'development') { mainWindow.loadURL('http://localhost:5173'); } 
    else { mainWindow.loadFile(path.join(__dirname, '../dist/index.html')); }
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('ping', () => 'PONG');
ipcMain.handle('get-server-ip', () => serverIP);

ipcMain.handle('get-settings', () => db.prepare('SELECT * FROM settings WHERE id=1').get());

ipcMain.handle('save-settings', (event, data) => {
    db.prepare(`
        UPDATE settings SET 
        hpp_kertas=?, hpp_tinta=?, biaya_ops=?, midtrans_server_key=?, midtrans_client_key=?, app_mode=?,
        static_qr_path=?, force_static_qr=?, gdrive_folder_id=?, selected_camera=?, selected_printer=?, hw_bypass_mode=?,
        active_theme=?
        WHERE id=1
    `).run(
        data.hpp_kertas || 0, data.hpp_tinta || 0, data.biaya_ops || 0, data.midtrans_server_key || '', data.midtrans_client_key || '', data.app_mode || 'online',
        data.static_qr_path || '', data.force_static_qr ? 1 : 0, data.gdrive_folder_id || '', data.selected_camera || '', data.selected_printer || '', data.hw_bypass_mode ? 1 : 0,
        data.active_theme || 'candy'
    );
    return true;
});

ipcMain.handle('set-pending-payment', (e, data) => { currentPendingCustomer = data; return true; });
ipcMain.handle('clear-pending-payment', (e) => { currentPendingCustomer = null; return true; });

ipcMain.handle('check-hardware', async () => {
    try { return { success: true, printers: await mainWindow.webContents.getPrintersAsync() }; } 
    catch (error) { return { success: false, error: error.message }; }
});

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

// [BARU & BRUTAL] Handler Hapus Sesi Event Fisik & Database
ipcMain.handle('delete-event', async (event, { eventId, deleteLocal, deleteGdrive }) => {
    try {
        const ev = db.prepare('SELECT folder_name FROM events WHERE id=?').get(eventId);
        if (ev) {
            if (deleteLocal) {
                const localPath = path.join(OUTPUT_PATH, ev.folder_name);
                if (fs.existsSync(localPath)) fs.rmSync(localPath, { recursive: true, force: true });
            }
            if (deleteGdrive) {
                // Logika placeholder GDrive. Implementasi API GDrive butuh service account.
                console.log("[DRIVE-SIM] Meminta penghapusan cloud untuk folder:", ev.folder_name);
            }
        }
        db.prepare('DELETE FROM sessions WHERE event_id=?').run(eventId);
        db.prepare('DELETE FROM events WHERE id=?').run(eventId);
        return { success: true };
    } catch(err) { 
        return { success: false, error: err.message }; 
    }
});

ipcMain.handle('create-event', (event, data) => {
    try {
        db.prepare('UPDATE events SET is_active=0').run();
        const dateStr = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`;
        const folderName = `${dateStr}_${data.nama_event.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const info = db.prepare(`INSERT INTO events (nama_event, folder_name, saldo_awal, is_active, templates_json) VALUES (?, ?, ?, 1, ?)`)
          .run(data.nama_event, folderName, data.saldo_awal || 0, JSON.stringify(data.templates));
        const eventDir = path.join(OUTPUT_PATH, folderName);
        if (!fs.existsSync(eventDir)) fs.mkdirSync(eventDir, { recursive: true });
        return { success: true, id: info.lastInsertRowid };
    } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('close-event', (event, eventId) => { db.prepare('UPDATE events SET is_active=0 WHERE id=?').run(eventId); return { success: true }; });

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
    db.prepare(`UPDATE templates SET price=?, is_visible=?, slots_json=?, orientation=? WHERE id=?`)
      .run(data.price || 0, data.is_visible ? 1 : 0, JSON.stringify(data.slots || []), data.orientation || 'portrait', data.id); 
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

ipcMain.handle('save-capture', async (event, { folderPath, base64Data, index }) => {
    try { fs.writeFileSync(path.join(folderPath, `raw_${index}.jpg`), Buffer.from(base64Data.split(';base64,').pop(), 'base64')); return { success: true }; } 
    catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('save-video', async (event, { folderPath, buffer }) => {
    try { fs.writeFileSync(path.join(folderPath, 'video_session.webm'), Buffer.from(buffer)); return { success: true }; } 
    catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('process-images', async (event, { photosBase64, templateId, eventFolder, eventId, customerName, price }) => {
    try {
        const tpl = db.prepare('SELECT * FROM templates WHERE id=?').get(templateId);
        const slots = JSON.parse(tpl.slots_json);
        const compositeOps = await Promise.all(photosBase64.map(async (b64, i) => {
            const s = slots[i] || { width: 400, height: 300, top: 0, left: 0 };
            return { input: await sharp(Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64')).resize({ width: s.width, height: s.height, fit: 'cover', position: 'center' }).toBuffer(), top: s.top, left: s.left };
        }));
        compositeOps.push({ input: tpl.filepath, top: 0, left: 0 });

        const outputFilename = `print-${Date.now()}.png`;
        const outputPath = path.join(OUTPUT_PATH, eventFolder, outputFilename); 

        await sharp({ create: { width: tpl.width, height: tpl.height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
          .composite(compositeOps).png().toFile(outputPath);

        db.prepare(`INSERT INTO sessions (event_id, customer_name, folder_name, waktu, harga_jual, status_cetak) VALUES (?, ?, ?, ?, ?, ?)`).run(eventId, customerName || 'Tanpa Nama', eventFolder, new Date().toLocaleString('id-ID'), price || 0, 'TERCETAK');

        const downloadUrl = `http://${serverIP}:${PORT}/download/${eventFolder}/${outputFilename}`;
        return { success: true, printPath: outputPath, qrCode: await qrcode.toDataURL(downloadUrl), downloadUrl };
    } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('get-dashboard-data', async (event, eventId) => {
    const sessions = db.prepare('SELECT * FROM sessions WHERE event_id = ? ORDER BY id DESC').all(eventId);
    const ev = db.prepare('SELECT * FROM events WHERE id=?').get(eventId);
    const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
    const hpp_total = (settings.hpp_kertas || 0) + (settings.hpp_tinta || 0) + (settings.biaya_ops || 0);
    
    let total_revenue = 0;
    sessions.forEach(s => { total_revenue += s.harga_jual; });
    let total_beban_hpp = sessions.length * hpp_total;
    let saldo_awal = ev?.saldo_awal || 0;
    
    const localPath = path.join(OUTPUT_PATH, ev?.folder_name || '');
    const adminUrl = `http://${serverIP}:${PORT}/admin`;
    const adminQr = await qrcode.toDataURL(adminUrl);

    return {
        sessions, localPath, adminQr,
        gdriveLink: settings.gdrive_folder_id ? `Folder ID: ${settings.gdrive_folder_id}` : 'Belum disetting',
        stats: { total_trx: sessions.length, total_revenue, total_beban_hpp, saldo_awal, sisa_saldo: saldo_awal - total_beban_hpp, laba_bersih: total_revenue - total_beban_hpp }
    };
});

ipcMain.handle('create-qris', async (e, amount) => {
    const st = db.prepare('SELECT midtrans_server_key, midtrans_client_key FROM settings WHERE id=1').get();
    try {
        const api = new midtransClient.CoreApi({ isProduction: false, serverKey: st.midtrans_server_key, clientKey: st.midtrans_client_key });
        const oid = `ORD-${Date.now()}`;
        const res = await api.charge({ payment_type: "qris", transaction_details: { order_id: oid, gross_amount: amount }, qris: { acquirer: "gopay" } });
        const qr = res.actions?.find(a => a.name === 'generate-qr-code');
        if (qr) return { success: true, orderId: oid, qrUrl: qr.url };
        return { success: false, error: "Gagal Midtrans" };
    } catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('check-payment', async (e, oid) => {
    const st = db.prepare('SELECT midtrans_server_key, midtrans_client_key FROM settings WHERE id=1').get();
    try { return { success: true, status: (await new midtransClient.CoreApi({ isProduction: false, serverKey: st.midtrans_server_key, clientKey: st.midtrans_client_key }).transaction.status(oid)).transaction_status }; } 
    catch (e) { return { success: false, error: e.message }; }
});