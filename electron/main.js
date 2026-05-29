const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const sharp = require('sharp');
const qrcode = require('qrcode');
const midtransClient = require('midtrans-client');
const express = require('express');
const xlsx = require('xlsx');

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
        for (const net of nets[name]) { if (net.family === 'IPv4' && !net.internal && !name.toLowerCase().includes('vethernet')) return net.address; }
    }
    return '127.0.0.1';
}

app.whenReady().then(() => {
    serverIP = getLocalIP();
    expressApp.use('/download', express.static(OUTPUT_PATH));
    expressApp.use('/templates', express.static(USER_TEMPLATES_PATH));
    expressApp.use('/qr', express.static(STATIC_QR_PATH));

    // =========================================================================
    // UI KASIR (GAMEBOY 3D & PSP) - RASIO SEMPURNA, ANTI OVERFLOW, GRAFIS LEGEND
    // =========================================================================
    expressApp.get('/admin', (req, res) => {
        res.send(`
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
                <title>SayGumi! Console</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
                    :root { --primary: #007CC3; --secondary: #FFD453; --accent: #FF3B67; }
                    body.theme-candy { --primary: #007CC3; --secondary: #FFD453; --accent: #FF3B67; }
                    body.theme-bumblebee { --primary: #E5A93B; --secondary: #FAF2E3; --accent: #754A05; }
                    body.theme-neon { --primary: #1E1F22; --secondary: #7F56FF; --accent: #80FF56; }
                    body.theme-fall { --primary: #354E47; --secondary: #FAF2E3; --accent: #DB627A; }
                    
                    /* CASING 3D TEXTURE */
                    body { 
                        font-family: 'Press Start 2P', cursive; margin: 0; padding: 0; overflow: hidden; user-select: none;
                        background-color: var(--primary); transition: background-color 0.5s ease;
                        background-image: linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
                        background-size: 15px 15px;
                        box-shadow: inset 15px 15px 30px rgba(255,255,255,0.2), inset -15px -15px 30px rgba(0,0,0,0.4);
                    }
                    
                    /* ORNAMEN CASING LUAR */
                    .console-groove { position: absolute; inset: 10px; border: 2px solid rgba(0,0,0,0.2); border-radius: 20px; pointer-events: none; box-shadow: inset 1px 1px 2px rgba(255,255,255,0.3), 1px 1px 2px rgba(0,0,0,0.3); z-index: 0; }
                    .console-wrapper { display: flex; flex-direction: column; height: 100svh; width: 100vw; padding: 2vh 5vw; box-sizing: border-box; justify-content: space-between; position: relative; z-index: 1; }
                    
                    /* ANIMASI */
                    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
                    @keyframes pulse-btn { 0% { transform: scale(1); box-shadow: 2px 2px 0 #111; } 50% { transform: scale(1.1); box-shadow: 4px 4px 0 #111; } 100% { transform: scale(1); box-shadow: 2px 2px 0 #111; } }
                    
                    /* THE MONITOR (Pengecilan Rasio LCD) */
                    .screen-bezel { background: #222; padding: 3vh 3vw 4vh 3vw; border-radius: 10px 10px 40px 10px; border: 4px solid #111; box-shadow: inset 5px 5px 15px rgba(0,0,0,0.9), 8px 8px 0 rgba(0,0,0,0.3); display: flex; flex-direction: column; height: 45svh; width: 100%; max-width: 400px; margin: 0 auto; position: relative; box-sizing: border-box; }
                    
                    .speaker-grill { height: 6px; width: 50px; margin: 0 auto 1.5vh auto; background: repeating-linear-gradient(90deg, #111, #111 3px, transparent 3px, transparent 6px); border-radius: 3px; box-shadow: inset 1px 1px 2px rgba(0,0,0,0.8); }
                    .brand-logo { text-align: center; font-family: 'Press Start 2P', cursive; font-size: clamp(10px, 3vw, 14px); color: rgba(0,0,0,0.5); text-shadow: 1px 1px 0 rgba(255,255,255,0.2); margin-bottom: 2vh; letter-spacing: 2px; }
                    
                    .screen-bezel::before { content: "BATTERY"; position: absolute; top: 12%; left: 8%; color: #888; font-size: 5px; }
                    .screen-bezel::after { content: ""; position: absolute; top: 10.5%; left: 4%; width: 5px; height: 5px; background: #FF3B67; border-radius: 50%; box-shadow: 0 0 5px #FF3B67; }
                    
                    .screen-display-wrapper { flex: 1; position: relative; border: 4px solid #111; box-shadow: inset 2px 2px 8px rgba(0,0,0,0.8); display: flex; flex-direction: column; background: var(--secondary); transition: background-color 0.5s; overflow: hidden; border-radius: 2px; }
                    .screen-display-wrapper::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px); box-shadow: inset 0 0 20px rgba(0,0,0,0.6); z-index: 10; }
                    
                    .screen-display { flex: 1; overflow-y: auto; color: #111; padding: 10px; display: flex; flex-direction: column; z-index: 1; }
                    .screen-header { text-align: center; border-bottom: 3px solid #111; padding-bottom: 5px; margin-bottom: 8px; font-size: 8px; line-height: 1.5; }
                    
                    /* LEGEND LCD DENGAN ICON CSS (Murni Geometri) */
                    .screen-legend { background: #111; color: var(--secondary); font-size: 6px; padding: 8px 5px; text-align: center; border-top: 2px solid #111; z-index: 1; line-height: 2; transition: color 0.5s; letter-spacing: 0.5px; }
                    .lg-dpad { display: inline-block; width: 10px; height: 10px; background: #333; position: relative; vertical-align: middle; margin: 0 3px; clip-path: polygon(33% 0, 66% 0, 66% 33%, 100% 33%, 100% 66%, 66% 66%, 66% 100%, 33% 100%, 33% 66%, 0 66%, 0 33%, 33% 33%); }
                    .lg-up { position: absolute; top: 1px; left: 3px; width: 0; height: 0; border-left: 2px solid transparent; border-right: 2px solid transparent; border-bottom: 2px solid #888; }
                    .lg-down { position: absolute; bottom: 1px; left: 3px; width: 0; height: 0; border-left: 2px solid transparent; border-right: 2px solid transparent; border-top: 2px solid #888; }
                    .lg-btn { display: inline-block; width: 10px; height: 10px; border-radius: 50%; color: #fff; background: var(--accent); text-align: center; line-height: 10px; font-size: 5px; vertical-align: middle; margin: 0 3px; border: 1px solid #000; transition: background 0.5s;}

                    /* AREA KONTROL (Membesar) */
                    .controls-area { display: flex; justify-content: space-between; align-items: center; flex: 1; width: 100%; max-width: 450px; margin: 0 auto; box-sizing: border-box; padding: 0 2vw; }
                    
                    /* D-PAD PS2 (Lebih Besar) */
                    .d-pad-container { display: flex; flex-direction: column; align-items: center; }
                    .d-pad { display: grid; grid-template-columns: repeat(3, clamp(35px, 12vw, 45px)); grid-template-rows: repeat(3, clamp(35px, 12vw, 45px)); gap: 2px; }
                    .d-btn { background: #222; border: 2px solid #111; cursor: pointer; box-shadow: 2px 2px 0 #000; position: relative; outline: none; border-radius: 4px; display: flex; justify-content: center; align-items: center; }
                    .d-btn:active { box-shadow: none; transform: translate(2px, 2px); }
                    .d-up { grid-column: 2; grid-row: 1; border-radius: 8px 8px 3px 3px; }
                    .d-down { grid-column: 2; grid-row: 3; border-radius: 3px 3px 8px 8px; }
                    .d-left { grid-column: 1; grid-row: 2; border-radius: 8px 3px 3px 8px; pointer-events: none;}
                    .d-right { grid-column: 3; grid-row: 2; border-radius: 3px 8px 8px 3px; pointer-events: none;}
                    .d-center { grid-column: 2; grid-row: 2; background: transparent; box-shadow: none; border: none; pointer-events: none; }
                    
                    .d-btn::before { content: ''; position: absolute; border-style: solid; }
                    .d-up::before { border-width: 0 6px 8px 6px; border-color: transparent transparent #555 transparent; top: 8px; }
                    .d-down::before { border-width: 8px 6px 0 6px; border-color: #555 transparent transparent transparent; bottom: 8px; }
                    
                    /* A/B BUTTONS (Lebih Besar) */
                    .ab-buttons { display: flex; gap: 15px; transform: rotate(-15deg); }
                    .round-btn { width: clamp(60px, 18vw, 75px); height: clamp(60px, 18vw, 75px); border-radius: 50%; background: var(--accent); border: 5px solid #111; box-shadow: 3px 5px 0 #111; cursor: pointer; transition: background-color 0.5s; outline: none; display: flex; justify-content: center; align-items: center; font-family: inherit; font-size: 20px; color: #fff; text-shadow: 2px 2px 0 #111; }
                    .round-btn:active { box-shadow: 0px 2px 0 #111; transform: translateY(3px); }
                    .btn-b { margin-top: 30px; }

                    /* PSP LANDSCAPE MODE */
                    @media (orientation: landscape) {
                        .console-wrapper { flex-direction: row; align-items: center; padding: 2vh 2vw; gap: 2vw; }
                        .controls-left { flex: 0 0 25%; display: flex; justify-content: flex-end; align-items: center; }
                        .d-pad-container { transform: scale(1); margin-right: 20px; }
                        .screen-bezel { flex: 0 0 45%; height: 90svh; border-radius: 20px; padding: 15px; margin: 0; box-shadow: inset 4px 4px 10px rgba(0,0,0,0.8), 8px 8px 0 rgba(0,0,0,0.3); }
                        .controls-right { flex: 0 0 25%; display: flex; justify-content: flex-start; align-items: center; }
                        .ab-buttons { transform: scale(1) rotate(0deg); gap: 20px; padding-left: 20px; }
                        .btn-b { margin-top: 40px; margin-left: -10px; }
                        .controls-area { display: none; }
                    }
                    @media (orientation: portrait) { .controls-left, .controls-right { display: none !important; } }

                    /* MODAL HISTORY */
                    .history-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.9); display: none; flex-direction: column; padding: 20px; z-index: 100; }
                    .history-modal.active { display: flex; }
                    .history-content { background: var(--secondary); flex: 1; border: 4px solid #111; padding: 15px; overflow-y: auto; color: #111; margin-bottom: 20px; transition: background-color 0.5s; }
                    .hist-item { border: 4px solid #111; padding: 10px; margin-bottom: 12px; background: #fff; font-size: 8px; line-height: 1.8; box-shadow: 4px 4px 0 #111; }
                    .hist-actions { display: flex; gap: 10px; margin-top: 10px; }
                    .hist-btn { flex: 1; background: var(--primary); color: #fff; border: 4px solid #111; font-family: inherit; font-size: 7px; padding: 10px; cursor: pointer; box-shadow: 2px 2px 0 #111; transition: background-color 0.5s; text-align: center; }
                    .hist-btn:active { box-shadow: none; transform: translate(2px, 2px); }
                    .close-btn { background: var(--accent); color: #fff; border: 4px solid #111; font-family: inherit; padding: 15px; font-size: 10px; cursor: pointer; box-shadow: 4px 4px 0 #111; transition: background-color 0.5s; }
                    .close-btn:active { box-shadow: none; transform: translate(2px, 2px); }
                </style>
                <script>
                    let confirmState = null;

                    async function fetchPending() {
                        try {
                            const res = await fetch('/api/pending');
                            const data = await res.json();
                            document.body.className = 'theme-' + (data.active_theme || 'candy');
                            document.getElementById('event-name').innerText = '[ LIVE: ' + (data.event_name || 'TIDAK ADA SESI') + ' ]';
                            
                            if(confirmState) return;

                            const m = document.getElementById('monitor-content');
                            if(!data.name) {
                                m.innerHTML = '<div style="text-align:center; margin-top:5vh; opacity:0.6; font-size:10px; line-height:2; color:#111;">-- SYSTEM READY --<br><br>MENUNGGU INPUT...</div>';
                            } else {
                                m.innerHTML = \`
                                    <div style="text-align:center; margin-top:1vh;">
                                        <p style="font-size:8px; margin-bottom:5px; color:#111;">PELANGGAN:</p>
                                        <p style="font-size:12px; color:#111; text-shadow:1px 1px 0 #fff;">\${data.name}</p>
                                        <p style="font-size:8px; margin-top:15px; margin-bottom:5px; color:#111;">TAGIHAN:</p>
                                        <p style="font-size:16px; color:#111; font-weight:bold; text-shadow:1px 1px 0 #fff;">Rp \${data.price.toLocaleString('id-ID')}</p>
                                        
                                        <div style="margin-top:15px; padding:8px; border:2px solid #FF3B67; background:rgba(255,59,103,0.15);">
                                            <p style="font-size:6px; color:#FF3B67; font-weight:bold; line-height:1.5;">CEK MUTASI REKENING SEBELUM VERIFIKASI!</p>
                                        </div>

                                        <div style="margin-top:15px; display:flex; flex-direction:column; align-items:center; gap:8px;">
                                            <div style="width:20px; height:20px; border-radius:50%; background:#FF3B67; border:2px solid #111; color:#fff; display:flex; justify-content:center; align-items:center; font-size:10px; animation: pulse-btn 1s infinite;">A</div>
                                            <p style="font-size:6px; color:#111; animation: blink 1s infinite;">PRESS [ A ] TO VERIFY</p>
                                        </div>
                                    </div>\`;
                            }
                        } catch(e) {}
                    }
                    setInterval(fetchPending, 2000);
                    window.onload = fetchPending;
                    
                    function requestConfirm(type) {
                        confirmState = type;
                        const m = document.getElementById('monitor-content');
                        const isRestart = type === 'restart';
                        m.innerHTML = \`
                            <div style="text-align:center; margin-top:4vh; color:#111;">
                                <h3 style="font-size:12px; color:#FF3B67; margin-bottom:15px; animation: blink 1s infinite;">⚠️ WARNING</h3>
                                <p style="font-size:8px; line-height:1.8; color:#111;">\${isRestart ? 'Sistem akan di-restart.<br>Sesi belum tersimpan akan hilang.' : 'Sesi Event akan ditutup permanen.<br>Kembali ke layar Dashboard.'}</p>
                                <div style="margin-top:25px; font-size:6px; line-height:2.5;">
                                    <span style="color:#FF3B67; font-weight:bold;">PRESS [ A ] TO \${isRestart ? 'RESTART' : 'CLOSE'}</span><br>
                                    <span>PRESS [ B ] TO CANCEL</span>
                                </div>
                            </div>
                        \`;
                    }

                    async function handleButtonA() {
                        if(confirmState === 'restart') { await fetch('/api/restart'); confirmState = null; fetchPending(); } 
                        else if(confirmState === 'close') { await fetch('/api/close'); confirmState = null; fetchPending(); } 
                        else { await fetch('/api/verify'); fetchPending(); }
                    }

                    function handleButtonB() {
                        if(confirmState) { confirmState = null; fetchPending(); } 
                        else { openHistory(); }
                    }

                    async function openHistory() {
                        document.getElementById('history-modal').classList.add('active');
                        document.getElementById('history-list').innerHTML = '<div style="text-align:center; margin-top:40px;">MEMUAT DATABASE...</div>';
                        try {
                            const res = await fetch('/api/history');
                            const data = await res.json();
                            const list = document.getElementById('history-list');
                            list.innerHTML = '';
                            if(data.length === 0) { list.innerHTML = '<div style="text-align:center; margin-top:40px; font-size:10px;">DATABASE KOSONG.</div>'; return; }
                            
                            data.forEach(s => {
                                list.innerHTML += \`
                                    <div class="hist-item">
                                        <div style="display:flex; justify-content:space-between; border-bottom:2px dashed #ccc; padding-bottom:5px;">
                                            <span>\${s.customer_name}</span>
                                            <span style="color:var(--primary);">Rp \${(s.harga_jual/1000)}k</span>
                                        </div>
                                        <div style="font-size:6px; color:#666; margin-top:5px; line-height:1.4;">\${s.waktu} <br>Status: \${s.status_cetak}</div>
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
                <div class="console-groove"></div>
                <div class="console-wrapper">
                    
                    <div class="controls-left">
                        <div class="d-pad-container">
                            <div class="d-pad">
                                <div class="d-btn d-up" onclick="requestConfirm('restart')"></div>
                                <div class="d-btn d-left"></div>
                                <div class="d-btn d-center"></div>
                                <div class="d-btn d-right"></div>
                                <div class="d-btn d-down" onclick="requestConfirm('close')"></div>
                            </div>
                        </div>
                    </div>

                    <div class="screen-bezel">
                        <div class="speaker-grill"></div>
                        <div class="brand-logo">SayGumi!</div>
                        <div class="screen-display-wrapper">
                            <div class="screen-display">
                                <div class="screen-header" id="event-name">Loading...</div>
                                <div id="monitor-content" style="flex:1;"></div>
                            </div>
                            <div class="screen-legend">
                                <span class="lg-dpad"><i class="lg-up"></i></span> RESTART | <span class="lg-dpad"><i class="lg-down"></i></span> TUTUP<br>
                                <span class="lg-btn">A</span> VERIFIKASI | <span class="lg-btn">B</span> RIWAYAT
                            </div>
                        </div>
                    </div>

                    <div class="controls-right">
                        <div class="ab-buttons">
                            <div class="round-btn-wrapper btn-b"><button class="round-btn" onclick="handleButtonB()">B</button></div>
                            <div class="round-btn-wrapper btn-a"><button class="round-btn" onclick="handleButtonA()">A</button></div>
                        </div>
                    </div>

                    <div class="controls-area">
                        <div class="d-pad-container">
                            <div class="d-pad">
                                <div class="d-btn d-up" onclick="requestConfirm('restart')"></div>
                                <div class="d-btn d-left"></div>
                                <div class="d-btn d-center"></div>
                                <div class="d-btn d-right"></div>
                                <div class="d-btn d-down" onclick="requestConfirm('close')"></div>
                            </div>
                        </div>

                        <div class="ab-buttons">
                            <div class="round-btn-wrapper btn-b"><button class="round-btn" onclick="handleButtonB()">B</button></div>
                            <div class="round-btn-wrapper btn-a"><button class="round-btn" onclick="handleButtonA()">A</button></div>
                        </div>
                    </div>

                </div>
                
                <div class="history-modal" id="history-modal">
                    <h2 style="color:var(--secondary); text-align:center; font-size:12px; margin-bottom:15px; text-shadow:2px 2px #000;">[ DATABASE ]</h2>
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
        res.json({ ...(currentPendingCustomer || {}), active_theme: st?.active_theme || 'candy', event_name: ev?.nama_event || 'Tidak Ada Sesi' });
    });
    
    expressApp.get('/api/verify', (req, res) => { currentPendingCustomer = null; if(mainWindow) mainWindow.webContents.send('remote-verify'); res.json({ success: true }); });
    expressApp.get('/api/close', (req, res) => { if(mainWindow) mainWindow.webContents.send('remote-close'); res.json({ success: true }); });
    expressApp.get('/api/restart', (req, res) => { if(mainWindow) mainWindow.webContents.send('remote-restart'); res.json({ success: true }); });

    expressApp.get('/api/history', (req, res) => {
        const ev = db.prepare('SELECT id FROM events WHERE is_active=1 ORDER BY id DESC LIMIT 1').get();
        if(!ev) return res.json([]);
        const sessions = db.prepare('SELECT * FROM sessions WHERE event_id=? ORDER BY id DESC').all(ev.id);
        res.json(sessions);
    });

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
        width: 1280, height: 720, fullscreen: true, autoHideMenuBar: true, frame: false,           
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
    db.prepare(`UPDATE settings SET hpp_kertas=?, hpp_tinta=?, biaya_ops=?, midtrans_server_key=?, midtrans_client_key=?, app_mode=?, static_qr_path=?, force_static_qr=?, gdrive_folder_id=?, selected_camera=?, selected_printer=?, hw_bypass_mode=?, active_theme=? WHERE id=1`)
    .run(data.hpp_kertas || 0, data.hpp_tinta || 0, data.biaya_ops || 0, data.midtrans_server_key || '', data.midtrans_client_key || '', data.app_mode || 'online', data.static_qr_path || '', data.force_static_qr ? 1 : 0, data.gdrive_folder_id || '', data.selected_camera || '', data.selected_printer || '', data.hw_bypass_mode ? 1 : 0, data.active_theme || 'candy');
    return true;
});

ipcMain.handle('set-pending-payment', (e, data) => { currentPendingCustomer = data; return true; });
ipcMain.handle('clear-pending-payment', (e) => { currentPendingCustomer = null; return true; });

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

ipcMain.handle('save-capture', async (event, { folderPath, base64Data, index }) => {
    try { fs.writeFileSync(path.join(folderPath, `raw_${index}.jpg`), Buffer.from(base64Data.split(';base64,').pop(), 'base64')); return { success: true }; } 
    catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('save-video', async (event, { folderPath, buffer }) => {
    try { fs.writeFileSync(path.join(folderPath, 'video_session.webm'), Buffer.from(buffer)); return { success: true }; } 
    catch (err) { return { success: false, error: err.message }; }
});

// EXCEL & RUTE FOLDER
ipcMain.handle('process-images', async (event, { photosBase64, templateId, sessionFolderAbsolute, eventId, customerName, price }) => {
    try {
        const ev = db.prepare('SELECT folder_name FROM events WHERE id=?').get(eventId);
        const eventFolder = ev.folder_name;

        const tpl = db.prepare('SELECT * FROM templates WHERE id=?').get(templateId);
        const slots = JSON.parse(tpl.slots_json);
        const compositeOps = await Promise.all(photosBase64.map(async (b64, i) => {
            const s = slots[i] || { width: 400, height: 300, top: 0, left: 0 };
            return { input: await sharp(Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64')).resize({ width: s.width, height: s.height, fit: 'cover', position: 'center' }).toBuffer(), top: s.top, left: s.left };
        }));
        compositeOps.push({ input: tpl.filepath, top: 0, left: 0 });

        const outputFilename = `print-${Date.now()}.png`;
        const outputPath = sessionFolderAbsolute ? path.join(sessionFolderAbsolute, outputFilename) : path.join(OUTPUT_PATH, eventFolder, outputFilename); 

        await sharp({ create: { width: tpl.width, height: tpl.height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
          .composite(compositeOps).png().toFile(outputPath);

        // XLSX AKUNTANSI
        const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
        const hppTotal = (settings.hpp_kertas || 0) + (settings.hpp_tinta || 0) + (settings.biaya_ops || 0);
        const labaBersih = (price || 0) - hppTotal;
        
        const excelPath = path.join(OUTPUT_PATH, eventFolder, 'Laporan_Keuangan.xlsx');
        let wb; let ws;
        const logData = {
            "Tanggal & Waktu": new Date().toLocaleString('id-ID'),
            "ID Transaksi": `TRX-${Date.now()}`,
            "Nama Pelanggan": customerName || 'Tanpa Nama',
            "Harga Jual (Pendapatan)": price || 0,
            "HPP Kertas & Tinta (Beban)": hppTotal,
            "Laba Bersih": labaBersih
        };

        if (fs.existsSync(excelPath)) {
            wb = xlsx.readFile(excelPath);
            ws = wb.Sheets[wb.SheetNames[0]];
            xlsx.utils.sheet_add_json(ws, [logData], { skipHeader: true, origin: -1 });
        } else {
            wb = xlsx.utils.book_new();
            ws = xlsx.utils.json_to_sheet([logData]);
            xlsx.utils.book_append_sheet(wb, ws, "Laporan Keuangan");
        }
        xlsx.writeFile(wb, excelPath);

        db.prepare(`INSERT INTO sessions (event_id, customer_name, folder_name, waktu, harga_jual, status_cetak) VALUES (?, ?, ?, ?, ?, ?)`).run(eventId, customerName || 'Tanpa Nama', eventFolder, new Date().toLocaleString('id-ID'), price || 0, 'TERCETAK');

        const sessionFolderName = sessionFolderAbsolute ? path.basename(sessionFolderAbsolute) : '';
        const downloadPath = sessionFolderAbsolute ? `${eventFolder}/${sessionFolderName}/${outputFilename}` : `${eventFolder}/${outputFilename}`;
        const downloadUrl = `http://${serverIP}:${PORT}/download/${downloadPath}`;
        
        return { success: true, printPath: outputPath, qrCode: await qrcode.toDataURL(downloadUrl), downloadUrl };
    } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('get-dashboard-data', async (event, eventId) => {
    const sessions = db.prepare('SELECT * FROM sessions WHERE event_id = ? ORDER BY id DESC').all(eventId);
    const ev = db.prepare('SELECT * FROM events WHERE id=?').get(eventId);
    const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
    const hpp_total = (settings.hpp_kertas || 0) + (settings.hpp_tinta || 0) + (settings.biaya_ops || 0);
    
    let total_revenue = 0; sessions.forEach(s => { total_revenue += s.harga_jual; });
    let total_beban_hpp = sessions.length * hpp_total;
    let saldo_awal = ev?.saldo_awal || 0;
    
    const localPath = path.join(OUTPUT_PATH, ev?.folder_name || '');
    const adminUrl = `http://${serverIP}:${PORT}/admin`;
    const adminQr = await qrcode.toDataURL(adminUrl);

    return { sessions, localPath, adminQr, gdriveLink: settings.gdrive_folder_id ? `Folder ID: ${settings.gdrive_folder_id}` : 'Belum disetting', stats: { total_trx: sessions.length, total_revenue, total_beban_hpp, saldo_awal, sisa_saldo: saldo_awal - total_beban_hpp, laba_bersih: total_revenue - total_beban_hpp } };
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