# SayGumi! Photobooth

Aplikasi kiosk photobooth self-service untuk acara — pelanggan memilih frame,
membayar lewat QRIS, berfoto dengan hitung mundur, lalu hasilnya dicetak dan
dikirim ke Google Drive mereka.

Dibangun dengan Electron + React untuk mesin photobooth Windows.

---

## Bagaimana cara kerjanya

Aplikasi ini terdiri dari tiga permukaan yang berjalan dari satu proses:

| Permukaan | Untuk siapa | Akses |
|---|---|---|
| **Layar Kiosk** | Pelanggan | Layar sentuh mesin photobooth |
| **Remote Cashier** | Kasir | Browser HP, dipasangkan lewat QR |
| **Halaman Unduhan** | Pelanggan | QR di layar hasil |

Alur sesi pelanggan:

```
Landing → Persetujuan → Pilih Frame → Isi Nama → Bayar (QRIS)
   → Foto (hitung mundur, 10 menit) → Review & Retake → Cetak
   → QR hasil  →  [ Cetak Lagi? ]
```

Kasir memantau dan menyetujui pembayaran dari HP lewat halaman web bertab —
**TAGIHAN**, **RIWAYAT**, **KONTROL**, dan **STATUS** — yang menyesuaikan diri:
tab di bawah saat HP dipegang tegak, rel di samping saat dimiringkan.

---

## Fitur utama

- **Cetak fisik** ke printer terpilih, dengan fallback PDF untuk pengujian tanpa printer
- **Pembayaran QRIS** — Midtrans (online) atau QR statis + verifikasi kasir (offline)
- **Video di balik layar** direkam otomatis dan ikut diberikan ke pelanggan
- **Google Drive** — folder per pelanggan, unggahan latar belakang yang tahan
  putus koneksi dan restart aplikasi
- **Cetak tambahan (upsell)** dengan harga yang dapat diatur per event
- **Pembukuan otomatis** — HPP, laba bersih, dan ekspor laporan Excel per event
- **Editor slot visual** untuk mengatur posisi foto pada frame lewat drag & drop
- **Empat tema** yang dapat diganti saat aplikasi berjalan
- Panel admin terlindungi PIN, dan **persetujuan pelanggan** sebelum sesi dimulai
- **Diagnostik lapangan di HP kasir** — sisa disk, printer hilang, antrean unggah
  macet, dan PIN yang masih bawaan, semuanya diringkas jadi daftar tindakan

---

## Menjalankan

### Prasyarat

- **Node.js 22+** dan npm
- **Windows** — target utama; `better-sqlite3` dikompilasi per platform
- Toolchain build native (Visual Studio Build Tools) untuk `better-sqlite3`

### Pasang & jalankan

```bash
npm install     # membangun ulang modul native untuk Electron
npm run dev     # Vite + Electron
```

### Port yang sedang dipakai

`npm run dev` tidak menuntut port tertentu. Port **5173** dan **3000** hanya
dipakai sebagai pilihan pertama; kalau sedang dipakai proses lain — hal yang
wajar di laptop yang menjalankan beberapa proyek sekaligus — keduanya otomatis
pindah ke port bebas dan nomor yang dipakai dicetak ke terminal:

```
[dev] Port 5173 dipakai proses lain — Vite memakai 5174.
[LOCAL SERVER] Port 3000 sedang dipakai proses lain. Server lokal pindah ke
              port otomatis — QR kasir memakai port baru ini.
[LOCAL SERVER] Menyala di http://192.168.1.202:3001 (port cadangan)
```

Kalau ingin mengunci port sendiri (mis. untuk bookmark debugger), set
`PB_DEV_PORT`:

```bash
set PB_DEV_PORT=5200 && npm run dev     # PowerShell: $env:PB_DEV_PORT=5200
```

### Perintah lain

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Mode pengembangan |
| `npm run build` | Build renderer ke `dist/` |
| `npm run lint` | ESLint untuk `electron/`, `src/`, `tests/` |
| `npm test` | 447 uji logika murni (Vitest) |
| `npm run test:db` | 28 uji database (lewat runtime Electron) |
| `npm run verify` | **lint + seluruh uji + build** — dipakai CI |
| `npm run test:app` | Menyalakan aplikasi sungguhan & memeriksanya (±3 menit) — jalankan sebelum merilis |
| `npm run pack` | Build tidak terpaket ke `release/win-unpacked/` (cepat, untuk uji) |
| `npm run dist` | **Installer siap edar** ke `release/` |

---

## Konfigurasi awal

Buka panel admin dengan **`Ctrl` + `Shift` + `P`**. PIN bawaannya `1234` —
**segera ganti** lewat tab Umum.

| Tab | Yang perlu diisi |
|---|---|
| **Umum** | HPP kertas/tinta, mode kiosk, PIN admin, retensi data |
| **Pembayaran** | Midtrans server & client key, mode sandbox/production |
| **Hardware** | Pilih kamera, printer, ukuran kertas, alamat jaringan |
| **Google Drive** | Hubungkan akun Google (satu klik) |
| **Aksesibilitas** | Keyboard on-screen, dan **pintasan keyboard yang dapat diubah** |

### Pintasan keyboard

| Pintasan | Fungsi |
|---|---|
| `Ctrl+Shift+P` | Pengaturan |
| `Ctrl+Shift+T` | Master template |
| `Ctrl+Shift+D` | Live dashboard |
| `Ctrl+X` | Tutup sesi event |
| `Ctrl+↑` / `Ctrl+↓` | Ganti tema |

Semuanya dilindungi PIN, diabaikan saat kursor berada di kolom teks, dan
**dapat diubah** lewat tab Aksesibilitas — lengkap dengan pendeteksi bentrok
terhadap pintasan Windows dan tombol kembalikan ke bawaan.

> **Kiosk layar sentuh tidak punya keyboard**, sehingga pintasan di atas tidak
> bisa ditekan di sana sama sekali. Semuanya juga tersedia sebagai tombol di
> tab **KONTROL** pada HP kasir. Panel admin tetap meminta PIN **di layar
> kiosk** — HP hanya memicu, ia tidak melewati lapisan keamanan mana pun.

### Latar parallax menu awal

Layar "INSERT COIN" punya latar pixel-art bergerak: bukit dan semak bergeser
dengan kecepatan berbeda, dua awan melintas, matahari berdenyut, burung
berayun, blok tanya mengambang, dan maskot monyet SayGumi berlari lalu
seskali berhenti bernapas dan melompat.

Semua **gerakan dibuat dengan CSS keyframes**, bukan AI — 40 generasi PixelLab
tidak akan cukup kalau tiap gerakan dibuat gambar. Yang dibayar AI hanya
gambar diam dan tiga siklus sprite (lari, lompat, bernapas).

Latar ini hanya muncul di layar awal. Aset, biaya, UUID PixelLab, dan aturan
yang harus dijaga saat menambah aset baru ada di
[`src/assets/scene/README.md`](src/assets/scene/README.md).

### Google Drive (untuk vendor)

Kredensial OAuth ditanam saat build, sehingga **klien tidak perlu membuka Google
Cloud Console** — mereka cukup menekan *Hubungkan Akun Google*.

Sebagai vendor, siapkan sekali:

1. Salin `electron/oauth-credentials.example.json` → `oauth-credentials.json`
2. Ikuti petunjuk di dalam berkas itu untuk membuat OAuth Client ID tipe *Desktop app*
3. Isi `clientId` dan `clientSecret`

Berkas tersebut masuk `.gitignore` tetapi tetap ikut terbundel ke aplikasi.

---

## Membuat installer

```bash
npm run dist
```

Menghasilkan dua berkas di `release/`, masing-masing ±105 MB:

| Berkas | Untuk apa |
|---|---|
| `SayGumi Photobooth Setup 1.0.0.exe` | **Installer biasa.** Dipasang sekali, membuat shortcut desktop & Start Menu, muncul di Add/Remove Programs. **Inilah yang dipakai untuk mesin photobooth permanen.** |
| `SayGumi-Photobooth-1.0.0-portable.exe` | **Portable.** Klik langsung tanpa dipasang, tidak membuat shortcut. Berguna untuk mencoba di mesin lain atau menjalankan dari flashdisk. |

Installer memberi teknisi pilihan lokasi instalasi, dan **uninstall tidak menghapus
data** — database, template, dan hasil foto operator tetap aman.

### Apa itu "installer NSIS"?

Kalau Anda pernah memasang Chrome atau WhatsApp Desktop, Anda pernah membuka
`Setup.exe` dan menekan **Next → Next → Install**. Jendela itulah **installer** —
program kecil yang menyalin aplikasi ke tempat yang benar dan membuat shortcut.

**NSIS** adalah alat gratis yang **membuat** installer semacam itu. `npm run dist`
memanggilnya sendiri di balik layar; Anda tidak perlu memasang atau mempelajarinya.

> **Installer NSIS** = berkas `Setup.exe`-nya. **Portable** = aplikasi yang sama,
> tapi tinggal klik tanpa dipasang.

Ukuran ±105 MB itu wajar: setiap aplikasi Electron membawa mesin browser Chromium
sendiri, sama seperti Discord, Slack, dan VS Code.

> ⚠️ **Belum ada code signing.** Windows SmartScreen akan menampilkan layar biru
> *"Windows protected your PC — Unknown publisher"* saat pemasangan pertama. Ini
> bukan berarti berkasnya bervirus — Windows hanya belum mengenal penerbitnya.
> Tekan **More info → Run anyway**. Menghilangkan peringatan ini butuh sertifikat
> code signing berbayar (±200–500 USD/tahun).

Penjelasan lengkap — termasuk langkah pemasangan di mesin photobooth — ada di
[DOCUMENTATION.md § 19](DOCUMENTATION.md#19-packaging--distribusi).

---

## Struktur proyek

```
electron/     Main process — IPC, server lokal, cetak, Drive, database
src/          Renderer React
  screens/      Layar kiosk pelanggan
  admin/        Panel admin (state terpisah dari kiosk)
  session/      Controller sesi: kamera, rekaman, bayar, cetak
  store/        State Zustand — selalu diakses lewat selector
  assets/scene/ Aset pixel menu awal + README asal-usul tiap gambar
tools/         Alat bantu pengembangan (tidak ikut dipaket)
tests/        475 uji otomatis
```

Data runtime disimpan di:

| Lokasi | Isi |
|---|---|
| `%APPDATA%/photobooth-v2/` | Database SQLite, template, QR statis |
| `Documents/Photobooth_Output/` | Hasil foto, video, laporan keuangan |

---

## Status

Aplikasi ini sudah berfungsi penuh untuk pemakaian di lapangan, dengan beberapa
catatan jujur:

| Hal | Status |
|---|---|
| Alur kiosk, cetak, pembayaran, upsell, pembukuan | ✅ Berjalan & teruji manual |
| Keamanan | ✅ 14 dari 14 temuan audit ditutup |
| Uji otomatis | ✅ 475 uji + CI — **belum mencakup komponen React & integrasi** |
| Google Drive | ⚠️ Terimplementasi penuh, **belum diuji dengan akun sungguhan** |
| Packaging | ✅ Installer NSIS + portable — ⚠️ belum ada code signing & auto-update |
| Integrasi website vendor | 📋 Rancangan siap, belum diimplementasikan |

---

## Dokumentasi

**[DOCUMENTATION.md](DOCUMENTATION.md)** memuat referensi lengkap: arsitektur,
skema database, kontrak IPC, HTTP API, seluruh temuan audit beserta statusnya,
dan rencana yang belum dikerjakan.

**[tests/README.md](tests/README.md)** menjelaskan cara menjalankan uji dan —
yang tidak kalah penting — apa saja yang **belum** tercakup olehnya.

**[tests/manual/README.md](tests/manual/README.md)** menjelaskan daftar periksa
yang benar-benar menyalakan aplikasi: kapan dijalankan, dan cara membedakan
kegagalan sungguhan dari alarm palsu.
