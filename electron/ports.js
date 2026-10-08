// =========================================================================
// RESOLUSI PORT
//
// Aplikasi ini memakai dua port: satu untuk server lokal Express (HP kasir &
// QR unduhan), satu lagi untuk Vite di mode pengembangan. Keduanya dulu
// ditulis mati di source, sehingga di laptop yang ALSO menjalankan proyek
// lain, `npm run dev` gagal:
//
//   1. Vite diam-diam pindah ke port berikutnya, sementara Electron tetap
//      membuka localhost:5173 — hasilnya bukan error, tapi kiosk menampilkan
//      aplikasi orang lain.
//   2. Server lokal gagal mengikat 3000 (EADDRINUSE).
//
// Modul ini memusatkan-policy port: preferensi tetap 3000/5173 supaya mesin
// kios di lokasi behaves like before, tapi otomatis mundur ke port bebas bila
// preferensi sedang dipakai. Untuk klien OAuth Google tipe Desktop, port
// loopback boleh berubah-ubah, jadi redirect URI tetap sah.
//
// Dipisah dari main.js agar bisa diuji tanpa runtime Electron.
// =========================================================================
const net = require('net');

// Dipertahankan sebagai nilai awal supaya QR, panel admin, dan dokumentasi
// tidak berubah untuk pemakaian normal.
const DEFAULT_SERVER_PORT = 3000;
const DEFAULT_DEV_PORT = 5173;

const MIN_PORT = 1;
const MAX_PORT = 65535;

// Sembilan belas port berikutnya dianggap lebih dari cukup; kalau semuanya
// penuh berarti yang salah bukan laptop-nya.
const MAX_PORT_ATTEMPTS = 20;

/**
 * Mengubah input bebas (env, argumen CLI) menjadi nomor port yang sah.
 * Nilai tidak valid mengembalikan `fallback`, bukan melempar error —
 * konfigurasi salah tidak boleh membuat aplikasi gagal menyala.
 *
 * @param {string|number|undefined|null} value
 * @param {number} fallback
 * @returns {number}
 */
function parsePort(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    const n = Number.parseInt(String(value), 10);
    if (!Number.isInteger(n) || n < MIN_PORT || n > MAX_PORT) return fallback;
    return n;
}

/**
 * Menyamakan bentuk URL dev server agar bisa dipakai oleh loadURL, filter
 * onHeadersReceived, dan CSP tanpa perbandingan string yang rapuh.
 * Input tanpa skema tetap diterima karena itu yang biasa ditulis manual.
 *
 * @param {string|undefined} value
 * @param {number} defaultPort
 * @returns {string} origin tanpa path, mis. "http://localhost:5173"
 */
function normalizeDevUrl(value, defaultPort = DEFAULT_DEV_PORT) {
    const raw = String(value || '').trim();
    if (!raw) return `http://localhost:${defaultPort}`;

    const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    let url;
    try {
        url = new URL(withScheme);
    } catch {
        return `http://localhost:${defaultPort}`;
    }
    if (!url.hostname) return `http://localhost:${defaultPort}`;
    // Path, query, dan hash dibuang: CSP dan pencocokan navigasi hanya
    // boleh membandingkan origin.
    return url.origin;
}

/**
 * CSP memakai ws:// untuk HMR Vite. http://localhost:5173 -> ws://localhost:5173
 *
 * @param {string} origin
 * @returns {string}
 */
function wsOriginFrom(origin) {
    return String(origin || '').replace(/^http/, 'ws');
}

/**
 * Mengikat server pada satu port dan resolve dengan objek server.
 * Reject pada error — pemanggil yang memutuskan mau mundur atau berhenti.
 *
 * @param {import('net').Server} server
 * @param {number} port 0 berarti minta OS memilih port bebas
 * @param {string} host
 * @returns {Promise<import('net').Server>}
 */
function listenOnce(server, port, host) {
    return new Promise((resolve, reject) => {
        function onError(err) {
            server.removeListener('listening', onListening);
            // Server yang gagal tidak pernah listening, tapi tetap dirapikan
            // agar tidak menahan descriptor.
            try { server.close(); } catch { /* sudah tertutup */ }
            reject(err);
        }
        function onListening() {
            server.removeListener('error', onError);
            resolve(server);
        }
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, host);
    });
}

/**
 * Menyala di port yang bebas, mundur dari `preferred` bila sedang dipakai.
 * Port 0 dipakai sebagai jaring pengaman terakhir: OS selalu memberi port
 * bebas, jadi server lokal tidak pernah menggagalkan startup.
 *
 * @param {import('net').Server} server
 * @param {object} options
 * @param {number} options.preferred
 * @param {string} options.host
 * @param {(msg: string) => void} [options.onFallback]
 * @returns {Promise<{server: import('net').Server, port: number, fallback: boolean}>}
 */
async function listenWithFallback(server, { preferred, host, onFallback = () => {} }) {
    try {
        await listenOnce(server, preferred, host);
        return { server, port: preferred, fallback: false };
    } catch (err) {
        if (err.code !== 'EADDRINUSE') throw err;
        onFallback(
            `Port ${preferred} sedang dipakai proses lain. `
            + 'Server lokal pindah ke port otomatis — QR kasir memakai port baru ini.'
        );
    }

    try {
        await listenOnce(server, 0, host);
        return { server, port: server.address().port, fallback: true };
    } catch (err) {
        if (err.code !== 'EADDRINUSE') throw err;
        // Port 0 praktis tidak mungkin terpakai. Kalau sampai terjadi, yang
        // salah bukan port melainkan kondisi mesin yang tidak wajar.
        throw err;
    }
}

/**
 * Mencari port bebas mulai dari `preferred`, naik satu per satu. Dipakai
 * orkestrator `npm run dev` supaya Vite dan Electron memakai port yang sama
 * tanpa perlu menulis port mati di mana pun.
 *
 * Setiap kandidat diperiksa DUA kali: sekali di 127.0.0.1 dan sekali di
 * wildcard. Keduanya perlu, karena di Windows kedua arah bisa lupau satu
 * sama lain — proses yang memegang wildcard tidak selalu menolak probe
 * loopback, dan sebaliknya. Satu probe saja akan memilih port yang nanti
 * dipakai Vite dan ditolak dengan pesan "port in use on a wildcard address".
 *
 * @param {number} preferred
 * @param {object} [options]
 * @param {number} [options.attempts]
 * @returns {Promise<number>}
 */
function findFreePort(preferred, { attempts = MAX_PORT_ATTEMPTS } = {}) {
    // Urutannya tidak penting; kedua alamat wajib lolos.
    const PROBE_HOSTS = ['127.0.0.1', '::'];

    const probeOnce = (candidate, host) => new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.once('error', reject);
        probe.once('listening', () => probe.close(() => resolve(candidate)));
        probe.listen(candidate, host);
    });

    const tryPort = async (candidate, remaining) => {
        for (const host of PROBE_HOSTS) {
            try {
                await probeOnce(candidate, host);
            } catch (err) {
                if (err.code === 'EADDRINUSE' && remaining > 0) {
                    return tryPort(candidate + 1, remaining - 1);
                }
                throw err;
            }
        }
        return candidate;
    };

    return tryPort(preferred, attempts - 1);
}

module.exports = {
    DEFAULT_SERVER_PORT,
    DEFAULT_DEV_PORT,
    MIN_PORT,
    MAX_PORT,
    MAX_PORT_ATTEMPTS,
    parsePort,
    normalizeDevUrl,
    wsOriginFrom,
    listenWithFallback,
    findFreePort,
};
