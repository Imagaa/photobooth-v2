# Uji Otomatis

## Menjalankan

```bash
npm test          # logika murni (Vitest)
npm run test:watch
npm run test:db   # uji database (runtime Electron)
npm run test:all  # keduanya
npm run verify    # lint + seluruh uji + build
```

## Kenapa ada dua runner

`better-sqlite3` dikompilasi untuk **ABI Electron**, bukan Node biasa. Mengimpornya
dari Vitest menghasilkan `NODE_MODULE_VERSION mismatch`. Karena itu:

| Runner | Menguji | Lingkungan |
|---|---|---|
| **Vitest** (`tests/*.test.js`) | Logika murni tanpa database | Node |
| **Runner sendiri** (`tests/db/`) | Skema & query SQLite | Electron (`ELECTRON_RUN_AS_NODE=1`) |

Runner database sengaja ditulis tanpa framework (≈60 baris di `tests/db/run.js`)
agar tidak menambah dependency hanya demi beberapa berkas uji.

> Selain uji di sini, ada **daftar periksa yang menyalakan aplikasi sungguhan**
> di [`tests/manual/`](manual/README.md) — dijalankan sengaja lewat
> `npm run test:app`, bukan otomatis. Ia menutup sebagian celah yang disebut
> di bagian "Yang TIDAK tercakup" di bawah.

## Apa yang diuji

| Berkas | Fokus |
|---|---|
| `admin-format.test.js` | Format Rupiah halaman kasir, ringkasan status cetak, sanitasi nama tema, pencarian & saringan riwayat |
| `admin-page.test.js` | Rangka halaman kasir tetap statis; skrip browser bebas SELURUH sink HTML dan `require`; setiap tab yang menampilkan data DB dibangun lewat DOM API |
| `drive.test.js` | PKCE, URL otorisasi OAuth, sanitasi nama folder, deteksi MIME |
| `drive-folder-id.test.js` | Menerima URL folder Drive yang ditempel, bukan hanya ID mentah |
| `download-page.test.js` | **Escaping XSS** pada halaman yang dibuka publik, panel Drive, masa berlaku |
| `secrets.test.js` | Hash PIN bersalt, penolakan PIN salah, masking rahasia |
| `format.test.js` | Formatter Rupiah dua arah |
| `network.test.js` | Pemilihan adapter jaringan (bug B11): Hyper-V, VPN, Docker, WSL, APIPA |
| `pricing.test.js` | Aturan harga upsell, validasi jumlah, penentuan metode bayar |
| `remote.test.js` | Daftar putih aksi dari HP kasir; menjaga panel admin tetap wajib PIN di layar kiosk |
| `status.test.js` | Diagnostik lapangan: ambang sisa disk, printer terpilih yang hilang, antrean unggah macet, urutan keparahan peringatan |
| `session.test.js` | Tenggat sesi & perilaku retake (bug B4), termasuk batas perpanjangan |
| `pintasan.test.js` | Pintasan keyboard kiosk: deteksi bentrok antar aksi dan dengan pintasan Windows, penolakan pintasan tanpa pengubah, pemulihan dari JSON rusak |
| `keyboard.test.js` | Keyboard on-screen panel admin: tata letak, SHIFT yang menetap, DEL/CLR, dan rangkaian ketikan nyata (ID folder Drive, email) |
| `riwayat.test.js` | Undo/redo editor template: pemangkasan cabang redo, penggabungan langkah, batas tumpukan |
| `db/migration.test.js` | Migrasi dari skema versi lama (bug B18), idempotensi, penanganan galat |
| `db/retention.test.js` | Seleksi auto-purge — terutama **tidak menghapus sesi yang unggahannya belum selesai** |

## Prinsip yang dipakai

**Uji menyasar aturan bisnis dan bug yang pernah terjadi**, bukan mengejar
cakupan baris. Setiap berkas menyebutkan bug atau temuan audit yang ia jaga,
sehingga jelas kenapa uji itu ada.

Beberapa uji sengaja membuktikan bahwa dirinya bermakna — misalnya
`indeks GAGAL bila migrasi dilewati` memastikan uji migrasi tidak lulus
secara kebetulan.

## Yang BELUM tercakup

Bagian ini penting agar tidak ada rasa aman yang keliru:

- **Komponen React & tata letak.** Bug layar Manajemen Sesi yang terpotong
  (regresi dari refactor) tidak akan tertangkap uji mana pun di sini — itu
  butuh uji visual/screenshot atau QA manual.
- **Panggilan Google Drive sungguhan.** Hanya fungsi murninya yang diuji;
  pertukaran token, pembuatan folder, dan unggahan belum pernah menyentuh
  Google.
- **Alur Electron end-to-end.** IPC, pencetakan, kamera, dan MediaRecorder
  hanya terverifikasi lewat QA manual.
- **Integrasi Midtrans.** Belum ada uji terhadap sandbox.
