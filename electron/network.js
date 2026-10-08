// =========================================================================
// PEMILIHAN ALAMAT IP
//
// IP inilah yang masuk ke QR pelanggan dan QR pairing kasir. Versi lama
// mengambil IPv4 non-internal PERTAMA dan hanya menyaring nama "vethernet",
// sehingga di mesin yang punya VPN, Hyper-V, Docker, atau WSL, QR bisa berisi
// alamat yang tidak dapat dijangkau HP siapa pun — sesi tampak berhasil tapi
// pelanggan tidak pernah bisa mengunduh (bug B11).
//
// Dipisah dari main.js agar logikanya bisa diuji tanpa runtime Electron.
// =========================================================================
const os = require('os');

// Adapter virtual/tunnel yang hampir tidak pernah menjadi jalur WiFi venue.
const VIRTUAL_IF_PATTERNS = [
    'vethernet', 'vmware', 'virtualbox', 'vbox', 'hyper-v', 'docker', 'wsl',
    'loopback', 'tap-', 'tun', 'vpn', 'zerotier', 'tailscale', 'radmin',
    'npcap', 'bluetooth', 'teredo', 'isatap',
];

function scoreInterface(name, address) {
    const lower = String(name || '').toLowerCase();
    let score = 0;

    // Rentang privat adalah yang benar-benar dipakai jaringan lokal venue.
    if (/^192\.168\./.test(address)) score += 100;
    else if (/^10\./.test(address)) score += 90;
    else if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) score += 80;
    else score += 10;

    // APIPA berarti DHCP gagal — alamat ini tidak berguna.
    if (/^169\.254\./.test(address)) score -= 200;

    if (VIRTUAL_IF_PATTERNS.some(p => lower.includes(p))) score -= 150;
    if (lower.includes('wi-fi') || lower.includes('wireless') || lower.includes('wlan')) score += 20;
    if (lower.includes('ethernet') && !lower.includes('vethernet')) score += 15;

    return score;
}

// Menerima bentuk yang sama seperti os.networkInterfaces() agar bisa diuji
// dengan data buatan.
function rankInterfaces(nets) {
    const hasil = [];
    for (const name of Object.keys(nets || {})) {
        for (const net of nets[name] || []) {
            if (net.family !== 'IPv4' || net.internal) continue;
            hasil.push({ name, address: net.address, score: scoreInterface(name, net.address) });
        }
    }
    return hasil.sort((a, b) => b.score - a.score);
}

function listNetworkInterfaces() {
    return rankInterfaces(os.networkInterfaces());
}

/**
 * @param {Array} daftar hasil rankInterfaces
 * @param {string} manual alamat yang dikunci operator, boleh kosong
 * @returns {{address: string, source: 'manual'|'auto'|'fallback', warning: string|null}}
 */
function pickAddress(daftar, manual = '') {
    if (manual) {
        if (daftar.some(i => i.address === manual)) {
            return { address: manual, source: 'manual', warning: null };
        }
        return {
            address: daftar.length ? daftar[0].address : '127.0.0.1',
            source: daftar.length ? 'auto' : 'fallback',
            warning: `IP manual ${manual} tidak lagi aktif, kembali ke deteksi otomatis.`,
        };
    }
    if (!daftar.length) return { address: '127.0.0.1', source: 'fallback', warning: 'Tidak ada adapter jaringan aktif.' };
    return { address: daftar[0].address, source: 'auto', warning: null };
}

module.exports = { VIRTUAL_IF_PATTERNS, scoreInterface, rankInterfaces, listNetworkInterfaces, pickAddress };
