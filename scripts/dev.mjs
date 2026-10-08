#!/usr/bin/env node
// =========================================================================
// ORKESTRATOR `npm run dev`
//
// Vite dan Electron harus sepakat pada satu port. Script lama memakai
// `wait-on tcp:5173`, padahal angka itu ditulis mati di tiga tempat
// (package.json, vite.config.js, electron/main.js). Di laptop yang juga
// menjalankan proyek lain, Vite diam-diam pindah ke 5174 sementara Electron
// tetap membuka 5173 — bukan error, tapi kiosk menampilkan aplikasi orang
// lain (bug B24).
//
// Script ini membeli satu port bebas, lalu meneruskannya ke kedua proses
// lewat env. Tidak ada lagi angka port yang ditulis mati di jalur ini.
// =========================================================================
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ports = require('../electron/ports.js');

/**
 * Menemukan berkas binari sebuah paket.
 *
 * `require.resolve('vite/bin/vite.js')` tidak bisa dipakai: Vite mendeklarasikan
 * field "exports" yang tidak menyertakan ./bin, jadi Node menolak dengan
 * ERR_PACKAGE_PATH_NOT_EXPORTED. package.json-nya sendiri tetap diekspor,
 * jadi jalurnya diturunkan dari situ lewat field "bin".
 */
function resolveBin(pkg, binName) {
  const pkgJson = require.resolve(`${pkg}/package.json`);
  const rootDir = path.dirname(pkgJson);
  const binField = require(pkgJson).bin;
  const relPath = typeof binField === 'string' ? binField : binField?.[binName];
  if (!relPath) throw new Error(`Tidak menemukan bin "${binName}" di paket ${pkg}`);
  return path.join(rootDir, relPath);
}

const viteBin = resolveBin('vite', 'vite');
const electronBin = resolveBin('electron', 'electron');

/**
 * Menunggu sampai ada yang menerima koneksi di `port`.
 * Menggantikan wait-on, yang hanya bisa menunggu angka port mati.
 *
 * `localhost` di Windows bisa berarti ::1 (IPv6) ATAU 127.0.0.1, tergantung
 * urutan resolusi. Vite yang mengikat wildcard membuat probe ke salah satunya
 * tetap berhasil, jadi memeriksa hanya satu alamat bisa menunggu selamanya
 * untuk port yang sebenarnya sudah siap.
 */
function canConnect(port, host) {
    return new Promise((resolve) => {
        const socket = net.connect({ port, host });
        socket.once('connect', () => { socket.destroy(); resolve(true); });
        socket.once('error', () => { socket.destroy(); resolve(false); });
    });
}

async function canConnectAnyhow(port) {
    for (const host of ['127.0.0.1', '::1']) {
        if (await canConnect(port, host)) return true;
    }
    return false;
}

async function waitForPort(port, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        if (await canConnectAnyhow(port)) return;
        if (Date.now() > deadline) {
            throw new Error(`Vite tidak siap di port ${port} setelah ${timeoutMs / 1000} detik`);
        }
        await new Promise((r) => setTimeout(r, 200));
    }
}

const children = [];
let shuttingDown = false;

/**
 * Mematikan satu proses beserta seluruh keturunannya.
 *
 * Tidak boleh hanya child.kill(): Vite dan Electron masing-masing menypawn
 * proses renderer/utility, dan prosesrenderer itulah yang tetap memegang port
 * setelah Ctrl+C. Sisa proses itulah penyebab `npm run dev` kedua gagal
 * dengan EADDRINUSE.
 */
function killTree(child) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    if (process.platform === 'win32') {
        // Windows tidak punya process group; taskkill /T ikut membunuhnya.
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
        try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill(); }
    }
}

function shutdown(code) {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) killTree(child);
    process.exitCode = code;
    // Jeda pendek supaya taskkill sempat bekerja sebelum proses ini hilang.
    setTimeout(() => process.exit(code), 500).unref();
}

function launch(label, command, args, env) {
    const child = spawn(command, args, {
        cwd: root,
        stdio: 'inherit',
        env: { ...process.env, ...env },
        // Process group sendiri, supaya killTree bisa menjatuhkan semua
        // keturunan dengan satu sinyal.
        detached: process.platform !== 'win32',
    });

    child.on('error', (err) => {
        console.error(`[dev] ${label} gagal dijalankan:`, err.message);
        shutdown(1);
    });

    // Satu proses berhenti = keseluruhan berhenti, supaya tidak tertinggal
    // Vite yang masih memegang port.
    child.on('exit', (code, signal) => {
        if (!shuttingDown) shutdown(code ?? (signal ? 1 : 0));
    });

    children.push(child);
    return child;
}

for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => shutdown(0));
}

// PB_DEV_PORT dipakai operator yang Favorite port-nya (mis. bookmark DevTools).
// Tanpa itu, preferredPort tetap 5173 supaya perilaku bawaan tidak berubah.
const preferredPort = ports.parsePort(process.env.PB_DEV_PORT, ports.DEFAULT_DEV_PORT);

// Kalau preferredPort dipakai proses lain, mundur ke 5174, 5175, dan seterusnya.
const devPort = await ports.findFreePort(preferredPort);
const devUrl = `http://localhost:${devPort}`;

if (devPort !== preferredPort) {
    console.log(`[dev] Port ${preferredPort} dipakai proses lain — Vite memakai ${devPort}.`);
}
console.log(`[dev] Vite    : ${devUrl}`);
console.log('[dev] Electron: membuka dev server di atas. Ctrl+C untuk berhenti.');

launch('vite', process.execPath, [viteBin, '--port', String(devPort), '--strictPort'], {
    BROWSER: 'none',
});

try {
    await waitForPort(devPort);
} catch (err) {
    console.error(`[dev] ${err.message}`);
    shutdown(1);
}

// VITE_DEV_SERVER_URL dibaca electron/ports.js. --strictPort di atas memastikan
// Vite TIDAK melompat ke port lain tanpa sepengetahuan kita: kalau ada yang
// berebut antara pemeriksaan dan listen, kita dapat pesan jelas, bukan kiosk
// yang diam-diam membuka halaman aplikasi lain.
launch('electron', process.execPath, [electronBin, '.'], {
    NODE_ENV: 'development',
    VITE_DEV_SERVER_URL: devUrl,
});
