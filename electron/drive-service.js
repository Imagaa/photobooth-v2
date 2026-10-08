// =========================================================================
// LAYANAN GOOGLE DRIVE
//
// Menjembatani klien REST (drive.js) dengan database dan siklus hidup aplikasi:
// menyimpan kredensial terenkripsi, menyegarkan access token, membuat folder
// event & pelanggan, serta menjalankan antrean unggah di latar belakang.
//
// Seluruh operasi jaringan di sini bersifat "best effort": kegagalan koneksi
// tidak boleh menghentikan alur kiosk. Item yang gagal tetap di antrean dan
// dicoba lagi saat internet tersedia.
// =========================================================================
const drive = require('./drive');
const secrets = require('./secrets');
const { bundledOAuth, hasBundledOAuth } = require('./app-config');

const REDIRECT_PATH = '/oauth2callback';
const MAX_ATTEMPTS = 8;

let db = null;
// Hanya dipakai sebelum main.js memanggil init(). Nilai ini defensif:
// redirect URI sebenarnya selalu datang dari pemanggil, karena port server
// lokal bisa berbeda dari 3000 bila port itu sedang dipakai proses lain.
let getRedirectUri = () => `http://127.0.0.1:${require('./ports').DEFAULT_SERVER_PORT}${REDIRECT_PATH}`;

// Access token hanya hidup di memori — tidak pernah disentuh disk.
let accessToken = null;
let accessTokenExpiry = 0;

// State OAuth yang sedang berjalan (verifier PKCE + state acak).
let pendingAuth = null;

let workerTimer = null;
let workerBusy = false;
let lastQueueError = null;

function init(database, redirectUriResolver) {
    db = database;
    if (redirectUriResolver) getRedirectUri = redirectUriResolver;
}

// =========================================================================
// KREDENSIAL
// =========================================================================
function getConfig() {
    const st = db.prepare('SELECT * FROM settings WHERE id=1').get() || {};

    // Kredensial di DB adalah override opsional; bila kosong, pakai yang
    // ditanam saat build agar klien tidak perlu menyentuh Google Cloud Console.
    const overrideId = st.gdrive_client_id || '';
    const overrideSecret = secrets.decryptSecret(st.gdrive_client_secret || '');
    const pakaiOverride = !!(overrideId && overrideSecret);

    return {
        enabled: st.gdrive_enabled === 1,
        usingBundled: !pakaiOverride && hasBundledOAuth,
        clientId: pakaiOverride ? overrideId : bundledOAuth.clientId,
        clientSecret: pakaiOverride ? overrideSecret : bundledOAuth.clientSecret,
        refreshToken: secrets.decryptSecret(st.gdrive_refresh_token || ''),
        rootFolderId: drive.extractFolderId(st.gdrive_folder_id),
        accountEmail: st.gdrive_account_email || '',
    };
}

function isConfigured() {
    const c = getConfig();
    return !!(c.enabled && c.clientId && c.clientSecret && c.refreshToken);
}

function saveClientCredentials({ clientId, clientSecret }) {
    const current = db.prepare('SELECT gdrive_client_secret FROM settings WHERE id=1').get();
    // Secret kosong berarti "jangan ubah" — renderer tidak pernah memegangnya.
    const secretToStore = clientSecret
        ? secrets.encryptSecret(String(clientSecret).trim())
        : (current?.gdrive_client_secret || '');
    db.prepare('UPDATE settings SET gdrive_client_id=?, gdrive_client_secret=? WHERE id=1')
      .run(String(clientId || '').trim(), secretToStore);
}

function disconnect() {
    db.prepare("UPDATE settings SET gdrive_refresh_token='', gdrive_account_email='', gdrive_enabled=0 WHERE id=1").run();
    accessToken = null;
    accessTokenExpiry = 0;
}

// =========================================================================
// OAUTH
// =========================================================================
function beginAuth() {
    const c = getConfig();
    if (!c.clientId || !c.clientSecret) {
        return { success: false, error: 'Client ID dan Client Secret harus diisi lebih dulu.' };
    }
    const { verifier, challenge } = drive.createPkce();
    const state = require('crypto').randomBytes(16).toString('hex');
    pendingAuth = { verifier, state, createdAt: Date.now() };

    return {
        success: true,
        url: drive.buildAuthUrl({
            clientId: c.clientId,
            redirectUri: getRedirectUri(),
            challenge,
            state,
        }),
    };
}

// Dipanggil route /oauth2callback setelah Google mengarahkan balik.
async function completeAuth({ code, state }) {
    if (!pendingAuth || pendingAuth.state !== state) {
        return { success: false, error: 'State OAuth tidak cocok. Ulangi proses login.' };
    }
    const { verifier } = pendingAuth;
    pendingAuth = null;

    const c = getConfig();
    try {
        const tokens = await drive.exchangeCode({
            clientId: c.clientId,
            clientSecret: c.clientSecret,
            code,
            redirectUri: getRedirectUri(),
            verifier,
        });

        if (!tokens.refresh_token) {
            return { success: false, error: 'Google tidak mengirim refresh token. Cabut akses aplikasi di akun Google lalu ulangi.' };
        }

        accessToken = tokens.access_token;
        accessTokenExpiry = Date.now() + (tokens.expires_in || 3600) * 1000 - 60000;

        const akun = await drive.getAccountInfo(accessToken);
        const email = akun.email;

        db.prepare('UPDATE settings SET gdrive_refresh_token=?, gdrive_account_email=?, gdrive_enabled=1 WHERE id=1')
          .run(secrets.encryptSecret(tokens.refresh_token), email);

        return { success: true, email };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function getAccessToken() {
    if (accessToken && Date.now() < accessTokenExpiry) return accessToken;

    const c = getConfig();
    if (!c.clientId || !c.clientSecret || !c.refreshToken) {
        throw new Error('Google Drive belum terhubung.');
    }
    const tokens = await drive.refreshAccessToken({
        clientId: c.clientId,
        clientSecret: c.clientSecret,
        refreshToken: c.refreshToken,
    });
    accessToken = tokens.access_token;
    accessTokenExpiry = Date.now() + (tokens.expires_in || 3600) * 1000 - 60000;
    return accessToken;
}

// =========================================================================
// FOLDER
// =========================================================================
async function ensureEventFolder(eventId) {
    const ev = db.prepare('SELECT * FROM events WHERE id=?').get(eventId);
    if (!ev) throw new Error('Event tidak ditemukan.');
    if (ev.drive_folder_id) return { id: ev.drive_folder_id, url: ev.drive_folder_url };

    const token = await getAccessToken();
    const c = getConfig();
    const folder = await drive.createFolder(token, {
        name: drive.sanitizeName(ev.nama_event, 'Event'),
        parentId: c.rootFolderId || null,
    });
    await drive.shareAnyoneWithLink(token, folder.id);
    const url = drive.folderWebUrl(folder.id);

    db.prepare('UPDATE events SET drive_folder_id=?, drive_folder_url=? WHERE id=?').run(folder.id, url, eventId);
    return { id: folder.id, url };
}

// Subfolder per pelanggan — inilah alamat yang masuk ke QR.
async function createCustomerFolder({ eventId, customerName }) {
    const ev = db.prepare('SELECT nama_event FROM events WHERE id=?').get(eventId);
    const parent = await ensureEventFolder(eventId);
    const token = await getAccessToken();

    const name = drive.sanitizeName(
        `${customerName || 'Tanpa Nama'} - ${ev?.nama_event || 'Event'}`,
        'Pelanggan'
    );
    const folder = await drive.createFolder(token, { name, parentId: parent.id });
    await drive.shareAnyoneWithLink(token, folder.id);

    return { id: folder.id, url: drive.folderWebUrl(folder.id) };
}

// =========================================================================
// ANTREAN UNGGAH
// =========================================================================
function enqueue({ sessionId, eventId, filePath, fileName, kind, priority = 100 }) {
    db.prepare(`INSERT INTO upload_queue (session_id, event_id, file_path, file_name, kind, priority, status, created_at_ms, updated_at_ms)
                VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)
      .run(sessionId || null, eventId || null, filePath, fileName, kind, priority, Date.now(), Date.now());
}

function queueStats(eventId = null) {
    const where = eventId ? 'WHERE event_id=?' : '';
    const args = eventId ? [eventId] : [];
    const rows = db.prepare(`SELECT status, COUNT(*) c FROM upload_queue ${where} GROUP BY status`).all(...args);
    const out = { pending: 0, uploading: 0, done: 0, failed: 0 };
    rows.forEach(r => { out[r.status] = r.c; });
    return { ...out, lastError: lastQueueError };
}

async function processOne(item) {
    const fs = require('fs');
    if (!fs.existsSync(item.file_path)) {
        db.prepare("UPDATE upload_queue SET status='failed', last_error=?, updated_at_ms=? WHERE id=?")
          .run('File sudah tidak ada di disk.', Date.now(), item.id);
        return;
    }

    const session = item.session_id
        ? db.prepare('SELECT * FROM sessions WHERE id=?').get(item.session_id)
        : null;

    // Sesi yang foldernya belum sempat dibuat (mis. offline saat itu) dibuatkan
    // sekarang, supaya file punya tujuan.
    let parentId = session?.drive_folder_id || '';
    if (!parentId && session) {
        const folder = await createCustomerFolder({ eventId: session.event_id, customerName: session.customer_name });
        db.prepare('UPDATE sessions SET drive_folder_id=?, drive_folder_url=? WHERE id=?')
          .run(folder.id, folder.url, session.id);
        parentId = folder.id;
    }
    if (!parentId && item.event_id) {
        parentId = (await ensureEventFolder(item.event_id)).id;
    }

    const token = await getAccessToken();
    const uploaded = await drive.uploadFile(token, {
        filePath: item.file_path,
        name: item.file_name,
        parentId: parentId || null,
    });

    db.prepare("UPDATE upload_queue SET status='done', drive_file_id=?, last_error=NULL, updated_at_ms=? WHERE id=?")
      .run(uploaded.id, Date.now(), item.id);
}

async function drainQueue() {
    if (workerBusy || !isConfigured()) return;
    workerBusy = true;
    try {
        // Satu item per putaran agar unggahan besar tidak memblokir apa pun,
        // dan agar kegagalan jaringan cepat terdeteksi.
        const item = db.prepare(`SELECT * FROM upload_queue
                                 WHERE status='pending' AND attempts < ?
                                 ORDER BY priority ASC, id ASC LIMIT 1`).get(MAX_ATTEMPTS);
        if (!item) return;

        db.prepare("UPDATE upload_queue SET status='uploading', attempts=attempts+1, updated_at_ms=? WHERE id=?")
          .run(Date.now(), item.id);

        try {
            await processOne(item);
            lastQueueError = null;
        } catch (err) {
            lastQueueError = err.message;
            const attempts = item.attempts + 1;
            const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
            db.prepare('UPDATE upload_queue SET status=?, last_error=?, updated_at_ms=? WHERE id=?')
              .run(status, err.message, Date.now(), item.id);
        }
    } finally {
        workerBusy = false;
    }
}

function startWorker(intervalMs = 15000) {
    if (workerTimer) return;
    workerTimer = setInterval(() => { drainQueue().catch(() => {}); }, intervalMs);
    workerTimer.unref?.();
}

function stopWorker() {
    if (workerTimer) { clearInterval(workerTimer); workerTimer = null; }
}

// Mengulang item yang sudah menyerah — dipakai tombol manual di Manajemen Sesi.
function retryFailed(eventId = null) {
    const where = eventId ? 'AND event_id=?' : '';
    const args = eventId ? [eventId] : [];
    const info = db.prepare(`UPDATE upload_queue SET status='pending', attempts=0, last_error=NULL, updated_at_ms=${Date.now()}
                             WHERE status='failed' ${where}`).run(...args);
    return info.changes;
}

module.exports = {
    REDIRECT_PATH,
    init,
    getConfig,
    isConfigured,
    saveClientCredentials,
    disconnect,
    beginAuth,
    completeAuth,
    ensureEventFolder,
    createCustomerFolder,
    enqueue,
    queueStats,
    drainQueue,
    startWorker,
    stopWorker,
    retryFailed,
};
