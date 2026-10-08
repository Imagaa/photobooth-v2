// =========================================================================
// HALAMAN KASIR — PERAKIT
//
// Halaman ini dilayani ke HP kasir lewat jaringan lokal. Tugas berkas ini
// hanya merangkai potongan: gaya, rangka HTML, dan dua berkas skrip.
//
// Kenapa skripnya dibaca dari disk lalu disisipkan, bukan ditulis sebagai
// string di sini:
//   - client.js & format.js jadi berkas .js sungguhan yang dibaca ESLint
//   - format.js bisa di-require Vitest dan diuji tanpa browser
//   - salah ketik ketahuan saat `npm run lint`, bukan di HP kasir saat acara
//
// Dibaca sekali saat modul dimuat: isinya tidak berubah selama aplikasi
// hidup, dan readFileSync bekerja normal di dalam arsip asar.
// =========================================================================

const fs = require('fs');
const path = require('path');
const { STYLES } = require('./styles');
const { SHELL } = require('./shell');

const bacaSkrip = (nama) => fs.readFileSync(path.join(__dirname, nama), 'utf8');

const FORMAT_JS = bacaSkrip('format.js');
const CLIENT_JS = bacaSkrip('client.js');

function renderAdminPage() {
    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
    <meta name="color-scheme" content="dark">
    <title>SayGumi! Kasir</title>
    <style>${STYLES}</style>
</head>
<body class="theme-candy">
${SHELL}
    <script>${FORMAT_JS}</script>
    <script>${CLIENT_JS}</script>
</body>
</html>`;
}

module.exports = { renderAdminPage };
