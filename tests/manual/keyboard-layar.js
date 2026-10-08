// Uji integrasi keyboard on-screen panel admin.
// Pertanyaan intinya: apakah ketikan keyboard benar-benar sampai ke STATE
// React (dan bertahan setelah render ulang), atau hanya mengubah tampilan.
const path = require('path');
const { app, BrowserWindow } = require('electron');
const AKAR = path.resolve(__dirname, '..', '..');
process.on('uncaughtException', (e) => { console.error('[FATAL]', e); process.exit(1); });

const hasil = [];
const cek = (n, l, c) => { hasil.push({ n, l }); console.log(l ? '  OK  ' : ' GAGAL', n, c !== undefined ? '— ' + JSON.stringify(c) : ''); };
const tidur = (ms) => new Promise(r => setTimeout(r, ms));

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
  // Semua interaksi melaporkan hasilnya, tidak melempar — supaya kegagalan
  // menunjukkan APA yang ada di layar, bukan sekadar "script failed".
  const klik = async (t, jeda = 400) => {
    const r = await js(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(t)}); if(!b) return 'TIDAK ADA'; b.click(); return 'ok';})()`);
    if (r !== 'ok') console.log(`  [langkah] klik ${JSON.stringify(t)} -> ${r}`);
    await tidur(jeda);
    return r;
  };
  const adaKeyboard = () => js(`!!document.querySelector('[data-osk]')`);
  const jumlahInput = () => js(`document.querySelectorAll('input[type=text]').length`);
  const SASARAN = `document.querySelector('input[placeholder^="Kosongkan = folder"]')`;
  const nilaiInput = () => js(`(${SASARAN}||{}).value`);
  // Jendela harness disembunyikan, jadi dokumennya tidak pernah memegang
  // fokus dan .focus() programatik TIDAK memicu event focus di Chromium.
  // Urutan di bawah meniru sentuhan sungguhan supaya React benar-benar
  // menerima onFocus — tanpa ini uji gagal karena harness, bukan aplikasi.
  const fokusInput = () => js(`(()=>{
    const i = document.querySelector('input[placeholder^="Kosongkan = folder"]');
    if (!i) return 'TIDAK ADA';
    i.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    i.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    i.focus();
    i.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    return 'ok';
  })()`);
  const panelTerbuka = () => js(`document.body.textContent.includes('GLOBAL SETTINGS.INI')`);
  const bukaPengaturan = async () => {
    await js(`window.__uji.picu('panel','settings')`); await tidur(400);
    // Gerbang PIN hanya muncul bila admin sedang terkunci.
    if (await js(`document.body.textContent.includes('[ AREA TERBATAS ]')`)) {
      for (const d of ['1', '2', '3', '4']) await klik(d, 120);
      await klik('OK', 700);
    }
    // Tab yang dipilih sebelumnya bertahan. Tab Aksesibilitas hanya berisi
    // checkbox, jadi kembalikan ke Umum yang punya kolom teks.
    await klik('[1] Umum', 400);
    return jumlahInput();
  };

  cek('panel Pengaturan terbuka', (await bukaPengaturan()) > 0);

  // --- Saklar MATI: keyboard tidak boleh muncul walau input difokuskan
  await fokusInput(); await tidur(300);
  cek('saklar mati: keyboard TIDAK muncul', !(await adaKeyboard()));

  // --- Nyalakan lewat tab Aksesibilitas, simpan
  cek('tab Aksesibilitas terbuka', (await klik('[6] Aksesibilitas')) === 'ok');
  const ubah = await js(`(()=>{
    const c = [...document.querySelectorAll('input[type=checkbox]')].find(x => x.closest('label')?.textContent.includes('keyboard di layar'));
    if (!c) return 'TIDAK ADA SAKLAR';
    c.click(); return c.checked ? 'nyala' : 'mati';
  })()`);
  cek('saklar OSK dinyalakan', ubah === 'nyala', ubah);

  await klik('[ SIMPAN PENGATURAN ]', 500);
  // Menyimpan memunculkan dialog konfirmasi lalu MENGUNCI panel kembali.
  await klik('[ LANJUT ]', 700);
  cek('panel tertutup setelah menyimpan', !(await panelTerbuka()));

  cek('panel Pengaturan dibuka ulang', (await bukaPengaturan()) > 0);
  cek('keyboard belum muncul sebelum ada input difokuskan', !(await adaKeyboard()));

  await klik('[5] Google Drive', 400);
  await fokusInput(); await tidur(400);
  cek('saklar nyala + input fokus: keyboard MUNCUL', await adaKeyboard());

  // --- Mengetik lewat tombol sungguhan di keyboard
  const tekan = async (label, jeda = 130) => {
    const r = await js(`(()=>{
      const akar = document.querySelector('[data-osk]');
      if (!akar) return 'KEYBOARD TIDAK ADA';
      const b = [...akar.querySelectorAll('button')].find(x => x.textContent.trim() === ${JSON.stringify(label)});
      if (!b) return 'TOMBOL TIDAK ADA';
      b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      b.click();
      return 'ok';
    })()`);
    if (r !== 'ok') console.log(`  [langkah] tekan ${JSON.stringify(label)} -> ${r}`);
    await tidur(jeda);
    return r;
  };

  cek('tombol CLR tersedia', (await tekan('CLR')) === 'ok');
  for (const k of ['a', 'b', '7', '-', '_']) await tekan(k);
  cek('nilai input mengikuti ketikan', (await nilaiInput()) === 'ab7-_', await nilaiInput());

  // Inti persoalannya. Bila keyboard hanya menyetel .value lewat DOM,
  // render ulang berikutnya akan mengembalikan nilainya seperti semula.
  await js(`window.__uji.picu('tema','next')`); await tidur(600);
  cek('nilai BERTAHAN setelah render ulang (bukti state React ikut berubah)',
      (await nilaiInput()) === 'ab7-_', await nilaiInput());

  await tekan('SHIFT'); await tekan('Q'); await tekan('W');
  cek('SHIFT menetap untuk beberapa huruf', (await nilaiInput()) === 'ab7-_QW', await nilaiInput());

  await tekan('TUTUP', 400);
  cek('tombol TUTUP menyembunyikan keyboard', !(await adaKeyboard()));

  console.log('\n[GALAT]', galat.length ? galat : 'tidak ada');
  const gagal = hasil.filter(h => !h.l);
  console.log(`\n=== ${hasil.length - gagal.length}/${hasil.length} lulus ===`);
  app.exit(gagal.length ? 1 : 0);
});
