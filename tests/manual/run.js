// =========================================================================
// PENJALAN DAFTAR PERIKSA MANUAL
//
// Menjalankan seluruh pemeriksaan yang perlu MENYALAKAN aplikasi sungguhan,
// satu per satu, lalu melaporkan ringkasannya.
//
//     npm run test:app
//
// Kenapa terpisah dari `npm run verify`: pemeriksaan di sini membuka jendela
// aplikasi sungguhan, sehingga lebih lambat dan sesekali gagal karena sebab
// di luar aplikasi (kartu grafis, jendela yang tidak sempat dilukis). Alarm
// yang sering keliru akan berhenti dipercaya — jadi ia dijalankan sengaja,
// saat mau merilis, bukan pada setiap perubahan kecil.
// =========================================================================
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const AKAR = path.resolve(__dirname, '..', '..');

const PEMERIKSAAN = [
    { berkas: 'perintah-hp.js', judul: 'Perintah dari HP kasir → gerbang PIN, tema, landing' },
    { berkas: 'tab-aksesibilitas.js', judul: 'Tab Aksesibilitas & saklar keyboard on-screen' },
    { berkas: 'keyboard-layar.js', judul: 'Keyboard on-screen benar-benar mengubah state' },
    { berkas: 'pintasan-keyboard.js', judul: 'Pintasan keyboard dapat diubah & bentrok ditolak' },
    { berkas: 'xss-halaman-kasir.js', judul: 'Anti-XSS seluruh tab halaman kasir' },
];

// Renderer diperiksa dari hasil build, bukan dari sumbernya. Tanpa langkah
// ini, pemeriksaan bisa lulus untuk versi lama tanpa ada yang menyadarinya.
if (!fs.existsSync(path.join(AKAR, 'dist', 'index.html'))) {
    console.error('\ndist/ belum ada. Jalankan dulu:  npm run build\n');
    process.exit(1);
}

const electron = path.join(AKAR, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');
const hasil = [];

for (const p of PEMERIKSAAN) {
    console.log(`\n${'='.repeat(70)}\n  ${p.judul}\n${'='.repeat(70)}`);
    const r = spawnSync(electron, [path.join(__dirname, p.berkas)], {
        cwd: AKAR, stdio: 'inherit', shell: true, timeout: 5 * 60 * 1000,
    });
    hasil.push({ ...p, lulus: r.status === 0 });
}

console.log(`\n${'='.repeat(70)}\n  RINGKASAN\n${'='.repeat(70)}`);
hasil.forEach(h => console.log(`  ${h.lulus ? 'LULUS' : 'GAGAL'}  ${h.judul}`));

const gagal = hasil.filter(h => !h.lulus);
console.log(`\n  ${hasil.length - gagal.length}/${hasil.length} pemeriksaan lulus\n`);

if (gagal.length) {
    console.log('  Sebelum menyimpulkan ada kerusakan, periksa dulu kemungkinan ini:');
    console.log('  - jendela aplikasi gagal dilukis (kartu grafis) — coba jalankan ulang');
    console.log('  - port 3000 sedang dipakai aplikasi lain yang masih berjalan');
    console.log('  - dist/ belum dibangun ulang setelah kode diubah (npm run build)\n');
    process.exit(1);
}
