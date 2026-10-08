// =========================================================================
// HARNESS SCREENSHOT SCENE (sekali pakai, tidak ikut build)
//
// Letakkan DI LUAR dist/ karena `npm run build` menghapus dist/ beserta
// apa pun di dalamnya.
//
// Gunanya: memeriksa SceneBackdrop tanpa menjalankan aplikasi penuh. Layar
// landing hanya muncul kalau store sudah menerima data event dari backend,
// jadi screenshot halaman aplikasi tidak akan pernah menunjukk scene.
//
//   npx electron tools/scene-shot.js <nama-css-di-dist>
// =========================================================================
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PREVIEW = path.join(DIST, '_preview.html');
const OUT = path.join(DIST, '_scene.png');

// Markup scene sengaja ditulis ulang di sini, meniru SceneBackdrop.jsx.
// Kalau keduanya berbeda, harness ini justrulies tentang hasil sebenarnya.
const HTML = `<!doctype html>
<html><head><meta charset="UTF-8"><link rel="stylesheet" href="./assets/__CSS__">
<style>
  body { margin: 0; background: #1b1030; }
  .mock-title { position:absolute; top:15%; left:0; right:0; text-align:center;
    font-family:'Press Start 2P',monospace; font-size:44px; color:#ffd447;
    text-shadow:8px 8px 0 #e4572e; letter-spacing:.1em; z-index:20; }
  .mock-sub { position:absolute; top:26%; left:0; right:0; text-align:center;
    font-family:'Press Start 2P',monospace; font-size:15px; color:#fff; z-index:20; }
  .mock-cta { position:absolute; top:41%; left:50%; transform:translateX(-50%);
    font-family:'Press Start 2P',monospace; font-size:24px; color:#000;
    background:#7ec850; border:8px solid #000; padding:22px 32px; z-index:20;
    box-shadow:12px 12px 0 0 #000; }
</style></head><body>
<div style="position:relative;width:100vw;height:100vh;overflow:hidden">
  <div class="scene-root">
    <div class="scene-layer scene-sky"></div>
    <div class="scene-layer scene-strip scene-strip-bukit" style="--dur:110s"></div>
    <div class="scene-sun"></div>
    <div class="scene-cloud scene-cloud-a"></div>
    <div class="scene-cloud scene-cloud-b"></div>
    <div class="scene-bird scene-bird-a"></div>
    <div class="scene-bird scene-bird-b"></div>
    <div class="scene-blocks">
      <div class="scene-block" style="left:12%;animation-delay:0s"></div>
      <div class="scene-block" style="left:17%;animation-delay:.6s"></div>
      <div class="scene-block" style="left:81%;animation-delay:.3s"></div>
    </div>
    <div class="scene-monkey-wrap">
      <div class="scene-monkey"></div>
      <div class="scene-monkey scene-monkey-jump"></div>
      <div class="scene-monkey scene-monkey-idle"></div>
    </div>
    <div class="scene-crab-wrap"></div>
    <div class="scene-layer scene-strip scene-strip-semak" style="--dur:34s"></div>
    <div class="scene-haze"></div>
  </div>
  <div class="mock-title">SayGumi!</div>
  <div class="mock-sub">INSERT COIN / TAP TO START</div>
  <div class="mock-cta">[ MULAI SEKARANG ]</div>
  <div class="crt-overlay"></div>
</div></body></html>`;

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const cssName = process.argv[2];
  if (!cssName) { console.error('Pakai: electron tools/scene-shot.js <css-file>'); app.quit(); return; }
  fs.writeFileSync(PREVIEW, HTML.replace('__CSS__', cssName));

  const win = new BrowserWindow({
    width: 1280, height: 720, show: false, frame: false,
    // Offscreen rendering (OSR) adalah satu-satunya cara andal memotret scene
    // yang sedang beranimasi. Tanpa ini, jendela tersembunyi tidak
    // menjalankan animasi maupun rAF, dan capturePage selalu mengembalikan
    // frame yang sama berapa pun lama kita menunggu maupun mengatur
    // currentTime.
    webPreferences: { offscreen: true, backgroundThrottling: false },
  });
  await win.loadFile(PREVIEW);
  // Beri waktu gambar selesai di-decode.
  await new Promise((r) => setTimeout(r, 1200));

  // Waktu tangkap ditentukan secara DETERMINISTIK lewat Web Animations API,
  // bukan dengan menunggu. Menunggu tidak berhasil: jendela tersembunyi tidak
  // menjalankan animasi di Chromium, sehingga setiap tangkapan menghasilkan
  // berkas identik apa pun lamanya kita menunggu.
  //
  // Argumen ke-4 = waktu dalam milidetik. Sheet "diam" monkey hanya terlihat
  // pada 46-58% siklus 7 detik, jadi pemeriksaan state butuh waktu spesifik.
  const at = process.argv[4] === undefined ? null : Number(process.argv[4]);
  if (at !== null) {
    await win.webContents.executeJavaScript(`
      document.getAnimations().forEach((a) => {
        a.pause();
        a.currentTime = ${at};
      });
    `);
    // Mengubah currentTime tidak memicu repaint pada jendela tersembunyi, jadi
    // capturePage membaca frame terakhir yang sudah terpaint. invalidate()
    // memaksa compositor menggambar ulang state yang baru.
    win.webContents.invalidate();
  }
  await new Promise((r) => setTimeout(r, 500));

  const img = await win.capturePage();
  fs.writeFileSync(OUT, img.toPNG());
  console.log('tersimpan:', OUT, fs.statSync(OUT).size, 'byte');

  // HTML sementara ikut dihapus. Screenshot sengaja DISISAKAN supaya bisa
  // dilihat; electron-builder.yml sudah mengecualikan dist/_* dari paket,
  // jadi file ini aman walau ada di dist/.
  fs.rmSync(PREVIEW, { force: true });
  app.quit();
});






