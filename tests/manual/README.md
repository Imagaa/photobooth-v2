# Daftar Periksa Aplikasi Sungguhan

Berkas di folder ini **benar-benar menyalakan aplikasi, menekan tombolnya, lalu
memeriksa apa yang terjadi di layar** — bukan sekadar memeriksa hitungan.

Bedanya dengan `npm run verify`:

| | `npm run verify` | `npm run test:app` |
|---|---|---|
| Yang diperiksa | Aturan & hitungan | Aplikasi sungguhan yang menyala |
| Lama | ±30 detik | ±3 menit |
| Perlu diingat? | Tidak, otomatis di CI | **Ya, dijalankan sengaja** |
| Bisa salah alarm? | Tidak | Sesekali bisa — lihat di bawah |

---

## Cara menjalankan

```bash
npm run test:app
```

Itu saja. Perintah ini membangun ulang aplikasi lebih dulu, lalu menjalankan
kelima pemeriksaan berurutan dan menampilkan ringkasan LULUS/GAGAL.

**Kapan dijalankan:** sebelum membuat installer baru (`npm run dist`), atau
setelah mengubah panel admin, halaman kasir, atau alur pintasan keyboard.

Selama pengembangan sehari-hari, `npm run verify` sudah cukup.

---

## Apa yang diperiksa

| Berkas | Yang dibuktikan |
|---|---|
| `perintah-hp.js` | Tombol di HP kasir **memunculkan gerbang PIN** di kiosk, isi panel tidak bocor sebelum PIN benar, tema berputar dua arah dan tersimpan, "kembali ke landing" membatalkan pembayaran menggantung |
| `tab-aksesibilitas.js` | Tab `[6]` muncul, saklar keyboard **bawaannya mati**, dan nilainya benar-benar ikut tersimpan |
| `keyboard-layar.js` | Ketikan keyboard layar masuk ke **state React**, bukan hanya menempel di layar — dibuktikan dengan memaksa render ulang lalu memeriksa nilainya bertahan |
| `pintasan-keyboard.js` | Pintasan yang diubah **benar-benar berlaku**, yang lama berhenti, bentrok menolak penyimpanan, dan tombol kembalikan bawaan memulihkan semuanya |
| `xss-halaman-kasir.js` | Nama pelanggan berisi kode jahat **tampil sebagai teks**, tidak membentuk elemen, dan tidak satu pun dieksekusi — diperiksa di keempat tab |

Ada satu berkas tambahan yang bukan pemeriksaan:

- `potret-halaman-kasir.js` — memotret halaman kasir ke `tests/manual/potret/`.
  Berguna saat mengubah tampilan. Jalankan dengan `npx electron tests/manual/potret-halaman-kasir.js`.

---

## Kalau ada yang GAGAL

**Jangan langsung simpulkan aplikasinya rusak.** Pemeriksaan di sini membuka
jendela sungguhan, dan itu bisa gagal karena sebab di luar aplikasi. Yang
pernah benar-benar terjadi:

| Gejala | Sebab | Tindakan |
|---|---|---|
| `UnknownVizError`, GPU process exited | Kartu grafis gagal melukis jendela | Jalankan ulang |
| Potret menampilkan layar yang salah | Jendela tersembunyi tidak dilukis ulang, gambarnya basi | Percayai hasil pemeriksaan DOM, bukan potretnya |
| Semua gagal sekaligus | Instans `npm run dev` sebelumnya masih hidup dan memegang port | Tutup jendela Electron; `scripts/dev.mjs` sudah membersihkan pohon prosesnya sendiri, jadi `Ctrl+C` di terminal lebih baik daripada menutup jendela |
| Hasil terasa "versi lama" | `dist/` belum dibangun ulang | `npm run build` |

Jalankan ulang sekali. Kalau gagal lagi dengan pesan yang **sama dan spesifik**
(misalnya "gerbang PIN tidak muncul"), barulah itu kerusakan sungguhan.

---

## Kenapa tidak dijadikan otomatis saja

Karena alarm yang sering keliru akan berhenti dipercaya — termasuk saat
alarmnya benar. Selama pemeriksaan ini masih sesekali gagal karena sebab di
atas, memasukkannya ke `npm run verify` justru membuat orang terbiasa
mengabaikan laporan merah.

Kalau suatu saat penyebab kerewelannya sudah tertutup, memindahkannya ke CI
tinggal menambahkan satu langkah di `.github/workflows/ci.yml`.

---

## Catatan teknis

`preload-stub.js` adalah `electronAPI` tiruan: ia menggantikan seluruh
sambungan ke database dan perangkat keras dengan data karangan, lalu membuka
kanal `window.__uji` supaya naskah bisa **memicu event seolah datang dari HP
kasir** dan mengintip apa yang dipanggil renderer.

Karena memakai tiruan, pemeriksaan di sini **tidak menyentuh database, foto,
maupun pengaturan asli Anda.**
