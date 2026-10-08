// =========================================================================
// KLIEN GOOGLE DRIVE
//
// Ditulis langsung di atas REST API Drive v3 memakai `fetch` bawaan runtime,
// bukan paket `googleapis`. Kita hanya butuh empat operasi (tukar token,
// segarkan token, buat folder, unggah file), sementara `googleapis` membawa
// puluhan MB dan banyak dependency transitif — bertentangan dengan kerja
// menekan permukaan audit.
//
// Autentikasi memakai OAuth 2.0 Desktop dengan loopback redirect + PKCE.
// Service account sengaja TIDAK dipakai: ia tidak punya kuota penyimpanan di
// My Drive biasa, sehingga unggahan akan gagal dengan storageQuotaExceeded
// kecuali memakai Shared Drive (butuh Google Workspace berbayar).
// =========================================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

// drive.file membatasi akses aplikasi hanya pada file yang ia buat sendiri —
// jauh lebih sempit daripada scope `drive` penuh.
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

// =========================================================================
// PKCE
// =========================================================================
function createPkce() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
}

function buildAuthUrl({ clientId, redirectUri, challenge, state }) {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPE,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
        // Memaksa layar consent agar refresh_token selalu diterbitkan; tanpa ini
        // Google hanya mengirimnya pada otorisasi pertama saja.
        prompt: 'consent',
        state,
    });
    return `${OAUTH_AUTH_URL}?${params.toString()}`;
}

async function postForm(url, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error_description || data.error || `HTTP ${res.status}`);
    }
    return data;
}

async function exchangeCode({ clientId, clientSecret, code, redirectUri, verifier }) {
    return postForm(OAUTH_TOKEN_URL, {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
    });
}

async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
    return postForm(OAUTH_TOKEN_URL, {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
    });
}

// =========================================================================
// OPERASI DRIVE
// =========================================================================
async function driveFetch(accessToken, url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(options.headers || {}),
        },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(`Drive API ${res.status}: ${text.slice(0, 300)}`);
        err.status = res.status;
        throw err;
    }
    return res;
}

async function createFolder(accessToken, { name, parentId }) {
    const res = await driveFetch(accessToken, `${DRIVE_API}/files?fields=id,name,webViewLink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            mimeType: FOLDER_MIME,
            ...(parentId ? { parents: [parentId] } : {}),
        }),
    });
    return res.json();
}

// Memberi izin baca ke siapa pun yang memegang link. Tanpa ini pelanggan harus
// login Google dan meminta akses.
async function shareAnyoneWithLink(accessToken, fileId) {
    await driveFetch(accessToken, `${DRIVE_API}/files/${fileId}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
}

function folderWebUrl(folderId) {
    return `https://drive.google.com/drive/folders/${folderId}`;
}

const MIME_BY_EXT = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function guessMime(filePath) {
    return MIME_BY_EXT[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

/**
 * Unggah resumable. Dipilih karena video sesi bisa puluhan MB dan koneksi
 * venue sering putus di tengah jalan — upload multipart biasa harus diulang
 * dari nol, sedangkan resumable bisa dilanjutkan.
 */
async function uploadFile(accessToken, { filePath, name, parentId, onProgress }) {
    const stat = fs.statSync(filePath);
    const mimeType = guessMime(filePath);

    const initRes = await driveFetch(accessToken, `${DRIVE_UPLOAD}?uploadType=resumable&fields=id,name,webViewLink`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Upload-Content-Type': mimeType,
            'X-Upload-Content-Length': String(stat.size),
        },
        body: JSON.stringify({ name, ...(parentId ? { parents: [parentId] } : {}) }),
    });

    const sessionUrl = initRes.headers.get('location');
    if (!sessionUrl) throw new Error('Drive tidak mengembalikan URL sesi unggah.');

    const CHUNK = 8 * 1024 * 1024; // 8 MB
    const handle = await fs.promises.open(filePath, 'r');
    try {
        let offset = 0;
        while (offset < stat.size) {
            const size = Math.min(CHUNK, stat.size - offset);
            const buffer = Buffer.alloc(size);
            await handle.read(buffer, 0, size, offset);

            const res = await fetch(sessionUrl, {
                method: 'PUT',
                headers: {
                    'Content-Length': String(size),
                    'Content-Range': `bytes ${offset}-${offset + size - 1}/${stat.size}`,
                },
                body: buffer,
            });

            // 308 = potongan diterima, lanjutkan. 200/201 = seluruh file selesai.
            if (res.status === 308) {
                offset += size;
                onProgress?.(offset, stat.size);
                continue;
            }
            if (res.ok) {
                onProgress?.(stat.size, stat.size);
                return res.json();
            }

            const text = await res.text().catch(() => '');
            throw new Error(`Unggah gagal ${res.status}: ${text.slice(0, 300)}`);
        }
        throw new Error('Unggah selesai tanpa respons akhir dari Drive.');
    } finally {
        await handle.close();
    }
}

/**
 * Mengambil ID folder dari apa pun yang ditempel operator.
 *
 * Meminta "ID folder" lalu berharap orang tidak menempel URL adalah harapan
 * yang keliru — menyalin link dari Drive justru yang paling wajar dilakukan.
 * Fungsi ini menerima keduanya:
 *
 *   https://drive.google.com/drive/folders/<ID>?usp=drive_link
 *   https://drive.google.com/open?id=<ID>
 *   <ID>
 */
function extractFolderId(input) {
    const teks = String(input || '').trim();
    if (!teks) return '';

    // Bentuk .../folders/<ID>
    const cocokFolder = teks.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (cocokFolder) return cocokFolder[1];

    // Bentuk ?id=<ID>
    const cocokQuery = teks.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (cocokQuery) return cocokQuery[1];

    // Sudah berupa ID mentah.
    if (/^[a-zA-Z0-9_-]+$/.test(teks)) return teks;

    return '';
}

// Mengambil identitas akun yang terhubung. Memakai endpoint `about` milik Drive
// yang sudah tercakup scope drive.file — endpoint userinfo menuntut scope
// tambahan dan akan memaksa operator menyetujui ulang.
async function getAccountInfo(accessToken) {
    try {
        const res = await driveFetch(accessToken, `${DRIVE_API}/about?fields=user`);
        const data = await res.json();
        return { email: data.user?.emailAddress || '', name: data.user?.displayName || '' };
    } catch {
        return { email: '', name: '' };
    }
}

// Nama folder/berkas Drive tidak boleh mengandung karakter yang membingungkan
// saat ditelusuri, dan dibatasi panjangnya agar tetap terbaca.
function sanitizeName(value, fallback = 'Tanpa Nama') {
    const bersih = String(value || '')
        .replace(/[\\/:*?"<>|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return (bersih || fallback).slice(0, 120);
}

module.exports = {
    SCOPE,
    extractFolderId,
    getAccountInfo,
    createPkce,
    buildAuthUrl,
    exchangeCode,
    refreshAccessToken,
    createFolder,
    shareAnyoneWithLink,
    folderWebUrl,
    uploadFile,
    guessMime,
    sanitizeName,
};
