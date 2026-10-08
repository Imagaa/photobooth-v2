// =========================================================================
// URL ASET LOKAL
//
// Template dan QR statis dilayani Express di loopback. Nomor portnya tidak
// selalu 3000: kalau port itu sedang dipakai proses lain, server lokal mundur
// ke port bebas (lihat electron/ports.js). Menulis 3000 langsung di tiap
// komponen berarti gambar tidak muncul diam-diam di laptop yang menjalankan
// beberapa proyek sekaligus.
//
// Pola lama (bug P10) juga menyalin angka yang sama ke tujuh berkas. Semua
// pemanggilan sekarang lewat `localUrl()` di sini, sehingga portnya hanya
// dibaca di satu tempat.
// =========================================================================

// Nilai bawaan hanya dipakai kalau preload belum tersedia — mis. saat
// opened di browser tanpa Electron, atau pada render pertama sebelum preload
// selesai. Setelah itu nilainya selalu benar.
const FALLBACK_PORT = 3000;

let cachedPort = FALLBACK_PORT;

function readPort() {
    if (cachedPort !== FALLBACK_PORT) return cachedPort;
    const api = typeof window !== 'undefined' ? window.electronAPI : null;
    if (api && typeof api.getServerPort === 'function') {
        const port = api.getServerPort();
        if (Number.isInteger(port) && port > 0 && port < 65536) cachedPort = port;
    }
    return cachedPort;
}

/**
 * Membangun URL absolut menuju aset yang dilayani server lokal.
 *
 * @param {string} path jalur relatif, mis. "/templates/frame.png"
 * @returns {string}
 */
export function localUrl(path) {
    const suffix = String(path || '').startsWith('/') ? path : `/${path || ''}`;
    return `http://localhost:${readPort()}${suffix}`;
}

/**
 * URL dengan host yang bisa dipilih. Default loopback; dipakai bila perlu
 * mengirim ke perangkat lain di jaringan venue.
 *
 * @param {string} host
 * @param {string} path
 * @returns {string}
 */
export function localUrlOn(host, path) {
    const suffix = String(path || '').startsWith('/') ? path : `/${path || ''}`;
    return `http://${host || 'localhost'}:${readPort()}${suffix}`;
}
