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

    // =========================================================================
    // RESPONSIVE CONSOLE UI (GAMEBOY & PS VITA MODE)
    // =========================================================================
    expressApp.get('/admin', (req, res) => {
        res.send(`
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
                <title>SayGumi! Console</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
                    :root { --primary: #007CC3; --secondary: #FFD453; --accent: #FF3B67; }
                    body.theme-candy { --primary: #007CC3; --secondary: #FFD453; --accent: #FF3B67; }
                    body.theme-bumblebee { --primary: #E5A93B; --secondary: #FAF2E3; --accent: #754A05; }
                    body.theme-neon { --primary: #1E1F22; --secondary: #7F56FF; --accent: #80FF56; }
                    body.theme-fall { --primary: #354E47; --secondary: #FAF2E3; --accent: #DB627A; }
                    
                    body { font-family: 'Press Start 2P', cursive; background-color: var(--primary); margin: 0; padding: 0; overflow: hidden; transition: background-color 0.5s ease; user-select: none; }
                    
                    /* ANIMASI UX TUTORIAL */
                    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
                    @keyframes pulse-btn { 0% { transform: scale(1); box-shadow: 2px 2px 0 #111; } 50% { transform: scale(1.1); box-shadow: 4px 4px 0 #111; } 100% { transform: scale(1); box-shadow: 2px 2px 0 #111; } }
                    
                    /* Gameboy Portrait Layout (Default) */
                    .console-wrapper { display: flex; flex-direction: column; height: 100svh; padding: 20px; box-sizing: border-box; justify-content: space-between; }
                    
                    /* The Monitor */
                    .screen-bezel { background: #333; padding: 30px 20px 40px 20px; border-radius: 10px 10px 40px 10px; border: 4px solid #111; box-shadow: inset 4px 4px 10px rgba(0,0,0,0.8); display: flex; flex-direction: column; flex: 1; min-height: 0; position: relative; }
                    .screen-bezel::before { content: "BATTERY"; position: absolute; top: 12px; left: 35px; color: #888; font-size: 8px; }
                    .screen-bezel::after { content: ""; position: absolute; top: 11px; left: 20px; width: 8px; height: 8px; background: #FF3B67; border-radius: 50%; box-shadow: 0 0 5px #FF3B67; }
                    
                    .screen-display { background: var(--secondary); flex: 1; border: 4px solid #111; box-shadow: inset 2px 2px 5px rgba(0,0,0,0.5); overflow-y: auto; color: #111; padding: 15px 10px; display: flex; flex-direction: column; transition: background-color 0.5s; }
                    .screen-header { text-align: center; border-bottom: 4px solid #111; padding-bottom: 10px; margin-bottom: 10px; font-size: 10px; line-height: 1.5; }
                    
                    /* Controls Area */
                    .controls-area { display: flex; justify-content: space-between; align-items: center; padding: 30px 10px 10px 10px; flex: 0 0 auto; }
                    
                    /* Label Teks Putih Retro */
                    .d-label, .ab-label, .sys-label { font-size: 8px; color: #FFF; font-weight: bold; text-shadow: 2px 2px 0 rgba(0,0,0,0.5); pointer-events: none; text-align: center; }
                    
                    /* D-Pad (Danger Actions) */
                    .d-pad-container { position: relative; display: flex; flex-direction: column; align-items: center; gap: 5px; }
                    .d-pad { display: grid; grid-template-columns: repeat(3, 35px); grid-template-rows: repeat(3, 35px); gap: 0; margin-top: 10px; margin-bottom: 10px; }
                    .d-btn { background: #222; border: none; cursor: pointer; box-shadow: 2px 2px 0 #000; position: relative; outline: none; }
                    .d-btn:active { box-shadow: none; transform: translate(2px, 2px); }
                    .d-up { grid-column: 2; grid-row: 1; border-radius: 5px 5px 0 0; }
                    .d-down { grid-column: 2; grid-row: 3; border-radius: 0 0 5px 5px; }
                    .d-left { grid-column: 1; grid-row: 2; border-radius: 5px 0 0 5px; }
                    .d-right { grid-column: 3; grid-row: 2; border-radius: 0 5px 5px 0; }
                    .d-center { grid-column: 2; grid-row: 2; background: #222; box-shadow: none; z-index: 2; }
                    
                    /* A/B Buttons (Actions) */
                    .ab-buttons { display: flex; gap: 15px; transform: rotate(-15deg); }
                    .round-btn-wrapper { display: flex; flex-direction: column; align-items: center; gap: 10px; }
                    .round-btn { width: 55px; height: 55px; border-radius: 50%; background: var(--accent); border: 4px solid #111; box-shadow: 2px 4px 0 #111; cursor: pointer; transition: background-color 0.5s; outline: none; display: flex; justify-content: center; align-items: center; font-family: inherit; font-size: 16px; color: #fff; text-shadow: 2px 2px 0 #111; }
                    .round-btn:active { box-shadow: 0px 2px 0 #111; transform: translateY(2px); }
                    .btn-b { margin-top: 20px; }

                    /* Start/Select */
                    .sys-buttons { display: flex; justify-content: center; gap: 20px; padding-top: 10px; }
                    .sys-btn-wrapper { display: flex; flex-direction: column; align-items: center; gap: 5px; }
                    .sys-btn { width: 40px; height: 12px; background: #222; border-radius: 10px; box-shadow: 2px 2px 0 #111; transform: rotate(-15deg); cursor: pointer; }
                    .sys-btn:active { box-shadow: none; transform: rotate(-15deg) translate(2px, 2px); }

                    /* PS Vita Landscape Layout (Strict 3-Column) */
                    @media (orientation: landscape) {
                        .console-wrapper { flex-direction: row; align-items: center; padding: 15px; justify-content: center; gap: 20px; }
                        
                        /* Sisi Kiri (30%) - D-Pad & System */
                        .controls-left { flex: 0 0 25%; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 40px; }
                        .d-pad-container { align-items: center; transform: scale(1.1); margin-right: 10px; }
                        .sys-buttons { display: flex; gap: 20px; margin-right: 10px; }
                        
                        /* Sisi Tengah (40%) - Monitor */
                        .screen-bezel { flex: 0 0 45%; height: 95svh; border-radius: 20px; padding: 20px; max-width: 600px; margin: 0; }
                        
                        /* Sisi Kanan (30%) - A/B */
                        .controls-right { flex: 0 0 25%; display: flex; justify-content: flex-start; align-items: center; }
                        .ab-buttons { transform: scale(1.1) rotate(0deg); gap: 25px; padding-left: 10px; }
                        .ab-label { transform: rotate(0deg); }
                        .btn-b { margin-top: 40px; margin-left: -10px; }
                        
                        /* Sembunyikan elemen bawaan portrait jika ter-render ganda */
                        .controls-area { display: none; }
                    }
                    @media (orientation: portrait) {
                        .controls-left, .controls-right { display: none !important; }
                    }

                    /* Modal History */
                    .history-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.9); display: none; flex-direction: column; padding: 20px; z-index: 100; }
                    .history-modal.active { display: flex; }
                    .history-content { background: var(--secondary); flex: 1; border: 4px solid #111; padding: 15px; overflow-y: auto; color: #111; margin-bottom: 20px; transition: background-color 0.5s; }
                    .hist-item { border: 4px solid #111; padding: 12px; margin-bottom: 15px; background: #fff; font-size: 10px; line-height: 1.8; box-shadow: 4px 4px 0 #111; }
                    .hist-actions { display: flex; gap: 10px; margin-top: 10px; }
                    .hist-btn { flex: 1; background: var(--primary); color: #fff; border: 4px solid #111; font-family: inherit; font-size: 8px; padding: 12px; cursor: pointer; box-shadow: 2px 2px 0 #111; transition: background-color 0.5s; text-align: center; }
                    .hist-btn:active { box-shadow: none; transform: translate(2px, 2px); }
                    .close-btn { background: var(--accent); color: #fff; border: 4px solid #111; font-family: inherit; padding: 15px; font-size: 12px; cursor: pointer; box-shadow: 4px 4px 0 #111; transition: background-color 0.5s; }
                    .close-btn:active { box-shadow: none; transform: translate(2px, 2px); }
                </style>
                <script>
                    async function fetchPending() {
                        try {
                            const res = await fetch('/api/pending');
                            const data = await res.json();
                            
                            document.body.className = 'theme-' + (data.active_theme || 'candy');
                            document.getElementById('event-name').innerText = '[ LIVE: ' + (data.event_name || 'TIDAK ADA SESI') + ' ]';
                            
                            const m = document.getElementById('monitor-content');
                            if(!data.name) {
                                m.innerHTML = '<div style="text-align:center; margin-top:60px; opacity:0.6; font-size:12px; line-height:2; color:#111;">-- SYSTEM READY --<br><br>MENUNGGU INPUT...</div>';
                            } else {
                                // [UX TUTORIAL INJECTION] Animasi & Peringatan Cek Mutasi
                                m.innerHTML = \`
                                    <div style="text-align:center; margin-top:10px;">
                                        <p style="font-size:10px; margin-bottom:10px; color:#111;">PELANGGAN:</p>
                                        <p style="font-size:16px; color:#111; text-shadow:1px 1px 0 #fff;">\${data.name}</p>
                                        <p style="font-size:10px; margin-top:20px; margin-bottom:10px; color:#111;">TAGIHAN:</p>
                                        <p style="font-size:20px; color:#111; font-weight:bold; text-shadow:1px 1px 0 #fff;">Rp \${data.price.toLocaleString('id-ID')}</p>
                                        
                                        <div style="margin-top:20px; padding:10px; border:2px dashed #FF3B67; background:rgba(255,59,103,0.1); animation: blink 1.5s infinite;">
                                            <p style="font-size:8px; color:#FF3B67; font-weight:bold; line-height:1.5;">⚠️ CEK MUTASI REKENING SEBELUM VERIFIKASI!</p>
                                        </div>

                                        <div style="margin-top:25px; display:flex; flex-direction:column; align-items:center; gap:10px;">
                                            <div style="width:25px; height:25px; border-radius:50%; background:#FF3B67; border:2px solid #111; color:#fff; display:flex; justify-content:center; align-items:center; font-size:12px; animation: pulse-btn 1s infinite;">A</div>
                                            <p style="font-size:8px; color:#111; animation: blink 1s infinite;">PRESS [ A ] TO VERIFY</p>
                                        </div>
                                    </div>\`;
                            }
                        } catch(e) {}
                    }
                    setInterval(fetchPending, 2000);
                    window.onload = fetchPending;
                    
                    async function verifyAction() { await fetch('/api/verify'); fetchPending(); }
                    
                    async function openHistory() {
                        document.getElementById('history-modal').classList.add('active');
                        document.getElementById('history-list').innerHTML = '<div style="text-align:center; margin-top:40px;">MEMUAT DATABASE...</div>';
                        try {
                            const res = await fetch('/api/history');
                            const data = await res.json();
                            const list = document.getElementById('history-list');
                            list.innerHTML = '';
                            if(data.length === 0) { list.innerHTML = '<div style="text-align:center; margin-top:40px;">DATABASE KOSONG.</div>'; return; }
                            
                            data.forEach(s => {
                                list.innerHTML += \`
                                    <div class="hist-item">
                                        <div style="display:flex; justify-content:space-between; border-bottom:2px dashed #ccc; padding-bottom:5px;">
                                            <span>\${s.customer_name}</span>
                                            <span style="color:var(--primary);">Rp \${(s.harga_jual/1000)}k</span>
                                        </div>
                                        <div style="font-size:8px; color:#666; margin-top:5px; line-height:1.4;">\${s.waktu} <br>Status: \${s.status_cetak}</div>
                                        <div class="hist-actions">
                                            <button class="hist-btn" onclick="remoteRetake(\${s.id}, '\${s.customer_name}')">[ RETAKE ]</button>
                                            <button class="hist-btn" onclick="remoteReprint(\${s.id}, '\${s.customer_name}')">[ REPRINT ]</button>
                                        </div>
                                    </div>\`;
                            });
                        } catch(e) { document.getElementById('history-list').innerHTML = '<div style="text-align:center;">SYSTEM ERROR.</div>'; }
                    }
                    function closeHistory() { document.getElementById('history-modal').classList.remove('active'); }
                    
                    async function remoteRetake(id, name) { if(confirm('Mulai Retake untuk pelanggan: ' + name + '? Aplikasi akan otomatis membuka kamera.')) { await fetch('/api/remote-retake/'+id); closeHistory(); } }
                    async function remoteReprint(id, name) { if(confirm('Cetak ulang foto untuk: ' + name + '?')) { await fetch('/api/remote-reprint/'+id); alert('COMMAND SENT TO PRINTER!'); } }
                </script>
            </head>
            <body>
                <div class="console-wrapper">
                    
                    <div class="controls-left">
                        <div class="d-pad-container">
                            <div class="d-label label-up">RESTART</div>
                            <div class="d-pad">
                                <div class="d-btn d-up" onclick="if(confirm('RESTART MESIN KIOSK?')) fetch('/api/restart')"></div>
                                <div class="d-btn d-left"></div>
                                <div class="d-btn d-center"></div>
                                <div class="d-btn d-right"></div>
                                <div class="d-btn d-down" onclick="if(confirm('TUTUP EVENT BERJALAN?')) fetch('/api/close')"></div>
                            </div>
                            <div class="d-label label-down">TUTUP</div>
                        </div>
                        <div class="sys-buttons">
                            <div class="sys-btn-wrapper"><div class="sys-btn"></div><div class="sys-label">SELECT</div></div>
                            <div class="sys-btn-wrapper"><div class="sys-btn"></div><div class="sys-label">START</div></div>
                        </div>
                    </div>

                    <div class="screen-bezel">
                        <div class="screen-display">
                            <div class="screen-header" id="event-name">Loading...</div>
                            <div id="monitor-content" style="flex:1;"></div>
                        </div>
                    </div>

                    <div class="controls-right">
                        <div class="ab-buttons">
                            <div class="round-btn-wrapper btn-b">
                                <button class="round-btn" onclick="openHistory()">B</button>
                                <div class="ab-label">RIWAYAT</div>
                            </div>
                            <div class="round-btn-wrapper btn-a">
                                <button class="round-btn" onclick="verifyAction()">A</button>
                                <div class="ab-label">VERIFIKASI</div>
                            </div>
                        </div>
                    </div>

                    <div class="controls-area">
                        <div class="d-pad-container">
                            <div class="d-label label-up">RESTART</div>
                            <div class="d-pad">
                                <div class="d-btn d-up" onclick="if(confirm('RESTART MESIN KIOSK?')) fetch('/api/restart')"></div>
                                <div class="d-btn d-left"></div>
                                <div class="d-btn d-center"></div>
                                <div class="d-btn d-right"></div>
                                <div class="d-btn d-down" onclick="if(confirm('TUTUP EVENT BERJALAN?')) fetch('/api/close')"></div>
                            </div>
                            <div class="d-label label-down">TUTUP</div>
                        </div>

                        <div class="sys-buttons" style="flex-direction:column; gap:5px; margin-top:20px;">
                            <div class="sys-btn-wrapper"><div class="sys-btn"></div><div class="sys-label">SELECT</div></div>
                            <div class="sys-btn-wrapper"><div class="sys-btn"></div><div class="sys-label">START</div></div>
                        </div>

                        <div class="ab-buttons">
                            <div class="round-btn-wrapper btn-b">
                                <button class="round-btn" onclick="openHistory()">B</button>
                                <div class="ab-label">RIWAYAT</div>
                            </div>
                            <div class="round-btn-wrapper btn-a">
                                <button class="round-btn" onclick="verifyAction()">A</button>
                                <div class="ab-label">VERIFIKASI</div>
                            </div>
                        </div>
                    </div>

                </div>
                
                <div class="history-modal" id="history-modal">
                    <h2 style="color:var(--secondary); text-align:center; font-size:14px; margin-bottom:15px; text-shadow:2px 2px #000;">[ DATABASE ]</h2>
                    <div class="history-content" id="history-list"></div>
                    <button class="close-btn" onclick="closeHistory()">[ TUTUP ]</button>
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

    // API Kasir: Riwayat Pesanan
    expressApp.get('/api/history', (req, res) => {
        const ev = db.prepare('SELECT id FROM events WHERE is_active=1 ORDER BY id DESC LIMIT 1').get();
        if(!ev) return res.json([]);
        const sessions = db.prepare('SELECT * FROM sessions WHERE event_id=? ORDER BY id DESC').all(ev.id);
        res.json(sessions);
    });

    // API Kasir: Remote Retake & Reprint
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

// [HANDLER] Menghapus Sesi Event Fisik & Database
ipcMain.handle('delete-event', async (event, { eventId, deleteLocal, deleteGdrive }) => {
    try {
        const ev = db.prepare('SELECT folder_name FROM events WHERE id=?').get(eventId);
        if (ev) {
            if (deleteLocal) {
                const localPath = path.join(OUTPUT_PATH, ev.folder_name);
                if (fs.existsSync(localPath)) fs.rmSync(localPath, { recursive: true, force: true });
            }
            if (deleteGdrive) {
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