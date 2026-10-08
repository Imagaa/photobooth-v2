// =========================================================================
// KONFIGURASI BAWAAN APLIKASI
//
// Kredensial OAuth milik VENDOR yang ditanam saat build. Tujuannya agar klien
// yang menerima aplikasi ini cukup menekan "Hubungkan Akun Google" — mereka
// tidak perlu membuka Google Cloud Console sama sekali.
//
// File sumbernya (oauth-credentials.json) ada di .gitignore, tetapi tetap ikut
// terbundel ke dalam hasil build. Lihat oauth-credentials.example.json untuk
// cara membuatnya.
// =========================================================================
const fs = require('fs');
const path = require('path');

function loadBundledOAuth() {
    const file = path.join(__dirname, 'oauth-credentials.json');
    try {
        if (!fs.existsSync(file)) return { clientId: '', clientSecret: '' };
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        return {
            clientId: String(raw.clientId || '').trim(),
            clientSecret: String(raw.clientSecret || '').trim(),
        };
    } catch (err) {
        console.error('[CONFIG] oauth-credentials.json tidak terbaca:', err.message);
        return { clientId: '', clientSecret: '' };
    }
}

const bundledOAuth = loadBundledOAuth();

module.exports = {
    bundledOAuth,
    hasBundledOAuth: !!(bundledOAuth.clientId && bundledOAuth.clientSecret),
};
