// Uji integrasi renderer untuk tab [6] Aksesibilitas.
const path = require('path');
const { app, BrowserWindow } = require('electron');
const AKAR = path.resolve(__dirname, '..', '..');
const KELUAR = process.env.KELUAR || path.join(__dirname, 'potret');
require('fs').mkdirSync(KELUAR, { recursive: true });
process.on('uncaughtException', (e) => { console.error('[FATAL]', e); process.exit(1); });

const hasil = [];
const cek = (nama, lulus, catatan) => {
  hasil.push({ nama, lulus });
  console.log(lulus ? '  OK  ' : ' GAGAL', nama, catatan !== undefined ? '— ' + JSON.stringify(catatan) : '');
};
const tidur = (ms) => new Promise(r => setTimeout(r, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1400, height: 900, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload-stub.js'), contextIsolation: true, sandbox: false } });
  win.showInactive();
  const galat = [];
  win.webContents.on('console-message', (e, lvl, m) => { if (lvl >= 2) galat.push(m); });
  await win.loadFile(path.join(AKAR, 'dist/index.html'));
  await tidur(1500);
  const js = (k) => win.webContents.executeJavaScript(k);
  const klikTeks = (t) => js(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(t)}); if(!b) return 'TIDAK ADA'; b.click(); return 'ok'; })()`);

  // Buka Pengaturan lewat perintah HP, lalu lewati gerbang PIN.
  await js(`window.__uji.picu('panel', 'settings')`); await tidur(400);
  for (const d of ['1','2','3','4']) await klikTeks(d);
  await klikTeks('OK'); await tidur(700);

  cek('tab [6] Aksesibilitas ada di daftar tab',
      await js(`!!document.body.textContent.includes('[6] Aksesibilitas')`));

  cek('membuka tab Aksesibilitas', (await klikTeks('[6] Aksesibilitas')) === 'ok');
  await tidur(500);

  cek('judul tab tampil', await js(`document.body.textContent.includes('Keyboard On-Screen')`));

  const kotak = `[...document.querySelectorAll('input[type=checkbox]')].filter(c => c.closest('label')?.textContent.includes('keyboard di layar'))[0]`;
  cek('saklar keyboard on-screen ada', await js(`!!${kotak}`));
  cek('saklar bawaannya MATI', (await js(`${kotak}.checked`)) === false);

  // Nyalakan, simpan, lalu periksa apa yang benar-benar dikirim ke main process.
  await js(`${kotak}.click()`); await tidur(300);
  cek('saklar bisa dinyalakan', await js(`${kotak}.checked`));

  await klikTeks('[ SIMPAN PENGATURAN ]');
  await tidur(600);
  const terkirim = await js(`window.__uji.panggilanTerakhir('saveSettings')`);
  const nilai = terkirim && terkirim[0] ? terkirim[0].osk_enabled : undefined;
  cek('osk_enabled ikut tersimpan bernilai 1', nilai === 1, { osk_enabled: nilai });

  console.log('\n[GALAT]', galat.length ? galat : 'tidak ada');
  const gagal = hasil.filter(h => !h.lulus);
  console.log(`\n=== ${hasil.length - gagal.length}/${hasil.length} lulus ===`);
  app.exit(gagal.length ? 1 : 0);
});
