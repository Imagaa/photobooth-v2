// Uji integrasi pengubahan pintasan keyboard.
// Pertanyaan intinya: setelah operator merekam kombinasi baru dan
// menyimpannya, apakah kombinasi ITU yang berlaku dan yang lama berhenti?
const path = require('path');
const { app, BrowserWindow } = require('electron');
const AKAR = path.resolve(__dirname, '..', '..');
process.on('uncaughtException', (e) => { console.error('[FATAL]', e); process.exit(1); });

const hasil = [];
const cek = (n, l, c) => { hasil.push({ n, l }); console.log(l ? '  OK  ' : ' GAGAL', n, c !== undefined ? '— ' + JSON.stringify(c) : ''); };
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1500, height: 950, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload-stub.js'), contextIsolation: true, sandbox: false },
  });
  const galat = [];
  win.webContents.on('console-message', (e, lvl, m) => { if (lvl >= 2) galat.push(m); });
  await win.loadFile(path.join(AKAR, 'dist/index.html'));
  await tidur(1500);

  const js = (k) => win.webContents.executeJavaScript(k);
  const klik = async (t, jeda = 400) => {
    const r = await js(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(t)}); if(!b) return 'TIDAK ADA'; b.click(); return 'ok';})()`);
    if (r !== 'ok') console.log(`  [langkah] klik ${JSON.stringify(t)} -> ${r}`);
    await tidur(jeda);
    return r;
  };
  // Menekan tombol seperti pengguna: event keydown sungguhan di window.
  const tekanTombol = (key, { ctrl = false, shift = false, alt = false } = {}) => js(`(()=>{
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: ${JSON.stringify(key)}, ctrlKey: ${ctrl}, shiftKey: ${shift}, altKey: ${alt},
      bubbles: true, cancelable: true,
    }));
    return 'ok';
  })()`);
  const gerbangPin = () => js(`document.body.textContent.includes('[ AREA TERBATAS ]')`);
  const panelTerbuka = () => js(`document.body.textContent.includes('GLOBAL SETTINGS.INI')`);
  const tutupGerbang = () => klik('[ BATAL ]', 300);

  // --- Pintasan bawaan berlaku sejak awal
  await tekanTombol('P', { ctrl: true, shift: true }); await tidur(400);
  cek('Ctrl+Shift+P bawaan memicu gerbang PIN', await gerbangPin());
  await tutupGerbang();

  // Masuk ke panel & tab Aksesibilitas
  await js(`window.__uji.picu('panel','settings')`); await tidur(400);
  for (const d of ['1', '2', '3', '4']) await klik(d, 120);
  await klik('OK', 700);
  cek('panel Pengaturan terbuka', await panelTerbuka());
  await klik('[6] Aksesibilitas', 500);

  cek('daftar pintasan tampil', await js(`document.body.textContent.includes('Pintasan Keyboard')`));
  cek('menampilkan lambang panah, bukan ARROWUP',
      await js(`document.body.textContent.includes('Ctrl+↑')`));

  // --- Rekam kombinasi baru untuk "Buka Pengaturan"
  const rekamKe = async (indeks) => {
    const r = await js(`(()=>{
      const b = [...document.querySelectorAll('button')].filter(x => x.textContent.trim() === '[ REKAM ]');
      if (!b[${indeks}]) return 'TIDAK ADA';
      b[${indeks}].click(); return 'ok';
    })()`);
    await tidur(300);
    return r;
  };
  cek('tombol REKAM tersedia', (await rekamKe(0)) === 'ok');
  cek('baris yang direkam menampilkan TEKAN...', await js(`document.body.textContent.includes('TEKAN...')`));

  // Kombinasi tanpa Ctrl/Alt harus ditolak beserta alasannya.
  await tekanTombol('K', { shift: true }); await tidur(400);
  cek('kombinasi tanpa Ctrl/Alt ditolak dengan alasan',
      await js(`document.body.textContent.includes('Harus memakai Ctrl atau Alt')`));

  // Kombinasi sah direkam.
  await tekanTombol('K', { ctrl: true, alt: true }); await tidur(400);
  cek('kombinasi sah terekam', await js(`document.body.textContent.includes('Ctrl+Alt+K')`));

  // --- Bentrok kritis harus menghalangi penyimpanan
  await rekamKe(1);                                   // Master Template
  await tekanTombol('K', { ctrl: true, alt: true });   // sengaja sama
  await tidur(400);
  cek('bentrok antar aksi terdeteksi',
      await js(`document.body.textContent.includes('Sama dengan "Buka Pengaturan"')`));

  await klik('[ SIMPAN PENGATURAN ]', 600);
  cek('penyimpanan DITOLAK selama masih bentrok',
      await js(`document.body.textContent.includes('masih bentrok')`));
  await klik('[ LANJUT ]', 600);

  // Perbaiki bentroknya
  await rekamKe(1);
  await tekanTombol('J', { ctrl: true, alt: true }); await tidur(400);
  cek('bentrok hilang setelah diperbaiki',
      !(await js(`document.body.textContent.includes('Sama dengan')`)));

  await klik('[ SIMPAN PENGATURAN ]', 600);
  await klik('[ LANJUT ]', 700);
  const tersimpan = await js(`window.__uji.setting('shortcuts_json')`);
  cek('hanya yang berbeda dari bawaan yang disimpan',
      tersimpan.includes('settings') && tersimpan.includes('template') && !tersimpan.includes('close_session'),
      tersimpan);

  // --- Inti persoalannya: apakah pintasan BARU yang berlaku?
  await tekanTombol('K', { ctrl: true, alt: true }); await tidur(500);
  cek('pintasan BARU (Ctrl+Alt+K) memicu gerbang PIN', await gerbangPin());
  await tutupGerbang();

  await tekanTombol('P', { ctrl: true, shift: true }); await tidur(500);
  cek('pintasan LAMA (Ctrl+Shift+P) berhenti berlaku', !(await gerbangPin()));

  // Yang tidak diubah harus tetap jalan.
  await tekanTombol('D', { ctrl: true, shift: true }); await tidur(500);
  cek('pintasan yang tidak diubah tetap berlaku', await gerbangPin());
  await tutupGerbang();

  // --- Kembalikan ke bawaan
  await js(`window.__uji.picu('panel','settings')`); await tidur(400);
  if (await gerbangPin()) { for (const d of ['1','2','3','4']) await klik(d, 120); await klik('OK', 700); }
  await klik('[6] Aksesibilitas', 500);
  await klik('[ KEMBALIKAN BAWAAN ]', 400);
  cek('tombol kembalikan bawaan memulihkan tampilan',
      await js(`document.body.textContent.includes('Ctrl+Shift+P')`));
  await klik('[ SIMPAN PENGATURAN ]', 600);
  await klik('[ LANJUT ]', 700);
  cek('peta bawaan disimpan sebagai kosong',
      (await js(`window.__uji.setting('shortcuts_json')`)) === '');

  await tekanTombol('P', { ctrl: true, shift: true }); await tidur(500);
  cek('Ctrl+Shift+P berlaku kembali setelah dipulihkan', await gerbangPin());

  console.log('\n[GALAT]', galat.length ? galat : 'tidak ada');
  const gagal = hasil.filter((h) => !h.l);
  console.log(`\n=== ${hasil.length - gagal.length}/${hasil.length} lulus ===`);
  app.exit(gagal.length ? 1 : 0);
});
