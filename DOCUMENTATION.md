# SayGumi! Photobooth v2 — Dokumentasi Teknis & Audit

Dokumen ini adalah satu-satunya sumber acuan untuk aplikasi kiosk photobooth
**SayGumi!**: cara kerjanya, kondisi terkini setiap temuan audit, dan rencana
yang belum dikerjakan.

**Cara membaca dokumen ini:**

| Kalau Anda ingin… | Baca bagian |
|---|---|
| Tahu apa aplikasi ini dan bagaimana bentuknya | [Bagian A](#bagian-a--orientasi) |
| Memahami kode: skema, IPC, API, alur layar | [Bagian B](#bagian-b--referensi-teknis) |
| Tahu apa yang sudah & belum ada | [Bagian C](#bagian-c--kondisi-fitur) |
| Melihat temuan keamanan, performa, dan bug | [Bagian D](#bagian-d--audit--temuan) |
| Tahu langkah berikutnya | [Bagian E](#bagian-e--rencana--tindakan) |
| Menjalankan atau merilis aplikasi | [Bagian F](#bagian-f--operasional) |

**Penanda status yang dipakai di seluruh dokumen:**

| Tanda | Arti |
|---|---|
| ✅ | Sudah dikerjakan dan diverifikasi |
| 🟨 | Dikerjakan sebagian; sisanya dijelaskan di tempat |
| ⬜ | Belum dikerjakan |
| ⚠️ | Butuh tindakan manual dari Anda |
| 🔴 🟠 🟡 | Tingkat keparahan temuan: kritis, tinggi/sedang, rendah |

---

## Daftar Isi

**[Bagian A — Orientasi](#bagian-a--orientasi)**
- [Status Perbaikan](#status-perbaikan)
- [1. Ringkasan Proyek](#1-ringkasan-proyek)
- [2. Tech Stack](#2-tech-stack)
- [3. Arsitektur](#3-arsitektur)
- [4. Struktur File](#4-struktur-file)

**[Bagian B — Referensi Teknis](#bagian-b--referensi-teknis)**
- [5. Model Data (SQLite)](#5-model-data-sqlite)
- [6. Alur Aplikasi (State Machine)](#6-alur-aplikasi-state-machine)
- [6b. Tab Aksesibilitas](#6b-tab-aksesibilitas)
- [7. Kontrak IPC](#7-kontrak-ipc-35-channel)
- [8. HTTP API Lokal](#8-http-api-lokal-00003000)
- [8b. Halaman Kasir (HP)](#8b-halaman-kasir-hp)
- [9. Integrasi Google Drive](#9-integrasi-google-drive)
- [9b. Retensi Data & Persetujuan](#9b-retensi-data--persetujuan)

**[Bagian C — Kondisi Fitur](#bagian-c--kondisi-fitur)**
- [10. Fitur yang Sudah Ada](#10-fitur-yang-sudah-ada)
- [11. Fitur yang BELUM Ada](#11-fitur-yang-belum-ada)

**[Bagian D — Audit & Temuan](#bagian-d--audit--temuan)**
- [12. Temuan Keamanan](#12-temuan-keamanan)
- [13. Temuan Optimasi & Performa](#13-temuan-optimasi--performa)
- [14. Bug Fungsional](#14-bug-fungsional)

**[Bagian E — Rencana & Tindakan](#bagian-e--rencana--tindakan)**
- [15. Rencana: Integrasi Website Vendor](#15-rencana-integrasi-website-vendor)
- [16. Rekomendasi Berprioritas](#16-rekomendasi-berprioritas)

**[Bagian F — Operasional](#bagian-f--operasional)**
- [17. Menjalankan Proyek](#17-menjalankan-proyek)
- [18. Pengujian Otomatis](#18-pengujian-otomatis)
- [18b. Daftar Periksa Aplikasi Sungguhan](#18b-daftar-periksa-aplikasi-sungguhan)
- [19. Packaging & Distribusi](#19-packaging--distribusi)
- [20. Ringkasan Penilaian](#20-ringkasan-penilaian)

---

# Bagian A — Orientasi

## Status Perbaikan

### Fase 1 — Blocker produksi & keamanan

| Task | Lingkup | Status |
|---|---|---|
| #1 | Implementasi printing fisik | ✅ Selesai |
| #2 | Autentikasi HTTP API + XSS `/admin` | ✅ Selesai |
| #3 | Token download per sesi | ✅ Selesai |
| #4 | Otorisasi pembayaran server-side | ✅ Selesai |
| #5 | PIN admin + proteksi Midtrans server key | ✅ Selesai |
| #6 | Hardening BrowserWindow + cleanup dependency mati | ✅ Selesai |

### Fase 2 — Performa, arsitektur & kelengkapan fitur

| Task | Lingkup | Status |
|---|---|---|
| #7 | Kirim video sesi ke pelanggan (B7 + B8) | ✅ Selesai |
| #8 | Hilangkan double-IPC base64 pada jalur foto (P1) | ✅ Selesai |
| #9 | Pecah `App.jsx` + selector Zustand (P2) | ✅ Selesai |
| #10 | Excel on-demand, transisi CSS, overlay CRT, polling (P3–P7) | ✅ Selesai |
| #11 | Upgrade dependency rentan (S10) | ✅ Selesai |
| #12 | Preview video di layar hasil | ✅ Selesai |
| #13 | Fitur upselling cetak tambahan | ✅ Selesai |
| #14 | Format video MP4 (kompatibel iPhone) | ✅ Selesai |
| #15 | Rapikan layout layar hasil | ✅ Selesai |
| — | Shortcut `Ctrl+X` tutup sesi | ✅ Ditambahkan |

### Fase 3 — Integrasi & stabilisasi lapangan

| Task | Lingkup | Status |
|---|---|---|
| #16 | Autentikasi Google Drive (OAuth desktop + PKCE) | ✅ Selesai |
| #17 | Antrean unggah Drive asinkron, tahan offline & restart | ✅ Selesai |
| #18 | Subfolder pelanggan + QR mengarah ke Drive | ✅ Selesai |
| #19 | Consent pelanggan + auto-purge data | ✅ Selesai |
| #20 | Stabilisasi bug lapangan (B11, B15, B6, B16) | ✅ Selesai |
| #21 | Nonaktifkan unduhan lokal di mode online | ✅ Selesai |
| #22 | Rancangan integrasi website vendor | ✅ Rencana ditulis ([Bagian 15](#15-rencana-integrasi-website-vendor)) |

### Fase 5 — Jaring pengaman otomatis

| Task | Lingkup | Status |
|---|---|---|
| #24 | Pasang Vitest + uji modul murni | ✅ Selesai |
| #25 | Ekstrak logika murni dari `main.js` agar dapat diuji | ✅ Selesai |
| #26 | Uji migrasi DB & aturan retensi | ✅ Selesai |
| #27 | Script `npm test` + CI GitHub Actions | ✅ Selesai |

**475 uji berjalan otomatis** lewat `npm run verify`. Rinciannya di
[Bagian 18](#18-pengujian-otomatis).

### Fase 6 — Distribusi

| Task | Lingkup | Status |
|---|---|---|
| #29 | Packaging `electron-builder` (NSIS + portable) | ✅ Selesai |

Installer siap edar dihasilkan lewat `npm run dist`. Penjelasan lengkap — termasuk
**apa itu NSIS** dalam bahasa awam — ada di [Bagian 19](#19-packaging--distribusi).

**Yang masih terbuka:**
- Implementasi integrasi website vendor (rencananya sudah siap di [Bagian 15](#15-rencana-integrasi-website-vendor))
- Code signing & auto-update ([Bagian 19](#19-packaging--distribusi))
- Uji Google Drive dengan akun sungguhan
- 1 bug non-kritis, B5 ([Bagian 14](#14-bug-fungsional))

> ⚠️ **Integrasi Google Drive belum pernah menyentuh Google sungguhan.** Seluruh
> bagian murninya lulus uji unit, lint, dan build, tetapi pertukaran token OAuth,
> pembuatan folder, izin share, dan resumable upload **baru bisa dibuktikan setelah
> kredensial vendor terpasang**.

Verifikasi: `npm run lint` (direktori `electron/` bersih), `npm run build`, uji
migrasi DB terhadap simulasi skema lama, uji unit logika PIN/masking/harga
upsell/laporan, uji escaping halaman unduhan, dan smoke test seluruh dependency
produksi di runtime Electron. **QA end-to-end manual Fase 1 dinyatakan lulus oleh
operator; Fase 2 belum dikonfirmasi.**

> ⚠️ **Tindakan manual yang masih menunggu Anda:** file `.env` sengaja **tidak**
> dihapus. Isinya Midtrans key production yang sudah jadi dead code (`dotenv`
> sudah dihapus), tetapi Anda masih membutuhkan nilainya untuk tahu key mana yang
> harus dicabut di dashboard Midtrans. **Rotasi key tersebut, baru hapus `.env`.**

---

## 1. Ringkasan Proyek

**SayGumi! Photobooth v2** adalah aplikasi **kiosk photobooth self-service** untuk pasar Indonesia,
dibangun sebagai aplikasi desktop Electron yang berjalan fullscreen tanpa frame di mesin photobooth.

Konsep operasionalnya:

- **Layar Kiosk (Electron/React)** — dihadapkan ke pelanggan. Pelanggan memilih frame, input nama,
  bayar (QRIS), foto dengan countdown, review + retake, lalu dapat QR code untuk download hasil.
- **Remote Cashier (HP kasir)** — halaman web bergaya konsol Gameboy/PSP yang dilayani oleh
  Express server lokal di port `3000`. Kasir memverifikasi pembayaran manual, melihat riwayat,
  trigger retake/reprint, restart, dan tutup sesi — semuanya lewat WiFi lokal.
- **Model bisnis event-based** — operator membuka "Sesi Event" (nama klien, saldo awal/deposit,
  pilihan frame + harga override per event). Semua transaksi, folder output, dan laporan
  keuangan dikelompokkan per event.
- **Akuntansi built-in** — HPP (kertas, tinta, biaya ops) dikonfigurasi global; laba bersih
  dihitung per transaksi dan diekspor ke Excel per event.

Identitas visual: **retro 8-bit / arcade** (font Press Start 2P, border tebal, hard shadow,
efek CRT scanline, 4 tema warna yang bisa diganti live).

**Bahasa domain**: kode dan UI berbahasa Indonesia (`nama_event`, `harga_jual`, `saldo_awal`,
`status_cetak`, `biaya_ops`). Komentar dalam bahasa Indonesia dengan gaya informal.

---

## 2. Tech Stack

| Layer | Teknologi | Versi |
|---|---|---|
| Shell desktop | Electron | ^41.2.1 |
| UI | React | ^19.2.4 |
| State management | Zustand | ^5.0.12 |
| Styling | Tailwind CSS 3 + CSS Variables | ^3.4.19 |
| Bundler | Vite | ^8.0.4 |
| Database | better-sqlite3 (sinkron, embedded) | ^12.9.0 |
| Image compositing | sharp (libvips) | ^0.35.3 |
| HTTP server lokal | Express | ^5.2.1 |
| Payment gateway | midtrans-client (Core API, QRIS) | ^1.4.3 |
| Cloud storage | Google Drive REST v3 lewat `fetch` bawaan | — (tanpa dependency) |
| QR generation | qrcode | ^1.5.4 |
| Laporan | exceljs | ^4.4.0 |
| Native rebuild | @electron/rebuild | ^4.0.3 |
| Pengujian | Vitest + runner sendiri untuk SQLite | ^4.1.10 |
| Packaging | electron-builder (NSIS + portable) | ^26.15.3 |

**Module system**: `"type": "commonjs"` — proses Electron pakai CommonJS, sumber React pakai
ESM (ditangani Vite).

---

## 3. Arsitektur

```
┌────────────────────────────────────────────────────────────────────────────┐
│  MESIN PHOTOBOOTH (Windows)                                                │
│                                                                            │
│  ┌──────────────────────────────┐      ┌────────────────────────────────┐  │
│  │  RENDERER (React, 3477 LOC)  │      │  MAIN PROCESS (Node, 3277 LOC) │  │
│  │                              │      │                                │  │
│  │  App.jsx ── ScreenRouter     │◄────►│  ├─ better-sqlite3 (DB, WAL)   │  │
│  │  store/useStore (selector)   │ IPC  │  ├─ sharp (compositing)        │  │
│  │  session/SessionContext      │ 46ch │  ├─ exceljs (laporan on-demand)│  │
│  │    └ kamera, rekaman,        │      │  ├─ qrcode (QR download+admin) │  │
│  │      bayar, cetak, upsell    │      │  ├─ midtrans-client (QRIS)     │  │
│  │  admin/AdminLayer            │      │  ├─ printer.js (cetak fisik)   │  │
│  │  screens/(10) components/(8) │      │  ├─ drive-service.js (antrean) │  │
│  └──────────────────────────────┘      │  ├─ secrets.js (safeStorage)   │  │
│                                        │  └─ express :3000 (0.0.0.0)    │  │
│      preload.js (contextBridge)        └───────────────┬────────────────┘  │
│      sandbox: true, CSP aktif                          │                   │
└────────────────────────────────────────────────────────┼───────────────────┘
                                                         │  WiFi / LAN
                        ┌────────────────────────────────▼──────────────────┐
                        │  HP KASIR    → /admin?t=<token>   🔒 Bearer       │
                        │  HP PELANGGAN → /d/<token>        🎫 per sesi     │
                        └───────────────────────────────────────────────────┘
```

**Isolasi**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
CSP aktif di dev maupun produksi, `setWindowOpenHandler` deny, guard `will-navigate`.

**Pembagian tanggung jawab di renderer** (hasil Task #9):

| Lapisan | Tanggung jawab |
|---|---|
| `store/useStore.js` | State alur pelanggan; diakses **selalu lewat selector** |
| `session/SessionContext.jsx` | Ref perangkat keras + seluruh handler alur; membaca state via `getState()` |
| `admin/AdminLayer.jsx` | State & modal admin, terpisah total dari kiosk |
| `screens/`, `components/` | Presentasi; berlangganan hanya potongan state yang dipakai |

**Jalur data foto** (setelah Task #8):
kamera → `<video>` → `<canvas>` → **`toBlob` biner** → IPC sekali → disk (`raw_N.jpg`)
→ renderer menyimpan **path**, bukan gambar → saat cetak hanya path dikirim → sharp
membaca dari disk → `print-<ts>.png`.

**Otorisasi pembayaran** (setelah Task #4): main process satu-satunya penentu harga
dan status lunas. `process-images` menolak merender tanpa transaksi lunas yang belum
terpakai dan cocok dengan template + event yang diminta.

### Direktori runtime

| Konstanta | Lokasi | Isi |
|---|---|---|
| `USER_TEMPLATES_PATH` | `%APPDATA%/photobooth-v2/user_templates` | PNG frame master |
| `STATIC_QR_PATH` | `%APPDATA%/photobooth-v2/static_qr` | Gambar QRIS statis |
| `OUTPUT_PATH` | `Documents/Photobooth_Output` | Hasil foto + video + laporan |
| DB | `%APPDATA%/photobooth-v2/photobooth_v2.db` | SQLite (+ `-wal`, `-shm`) |

Struktur output: `Photobooth_Output/<tanggal>_<NamaEvent>/<tanggal>_<jam>_<NamaPelanggan>/`
berisi `raw_1..N.jpg`, `video_1..N.mp4` (atau `.webm`), dan `print-<timestamp>.png`.
`Laporan_Keuangan.xlsx` berada di level folder event — **tidak lagi dilayani lewat HTTP**
sejak `express.static(OUTPUT_PATH)` dihapus.

---

## 4. Struktur File

```
photobooth-v2/
├── electron/                       (4256 LOC)
│   ├── main.js         1433 — IPC handlers, Express, state pembayaran, laporan
│   ├── admin/          1089 — halaman kasir (lihat Bagian 8b)
│   │   ├── client.js    537 — logika browser HP (berkas .js, dibaca ESLint)
│   │   ├── styles.js    254 — gaya rangka responsif
│   │   ├── format.js    143 — logika murni + penyaringan riwayat, diuji Vitest
│   │   ├── shell.js     110 — rangka HTML statis
│   │   └── index.js      45 — perakit halaman
│   ├── drive-service.js 315 — kredensial, folder, antrean unggah
│   ├── drive.js         275 — klien REST Drive v3 (OAuth PKCE, resumable upload)
│   ├── database.js      232 — skema, migrasi, indeks, WAL
│   ├── printer.js       154 — mesin cetak fisik + fallback PDF
│   ├── download-page.js 113 — halaman unduhan pelanggan (foto + video)
│   ├── pricing.js        84 — aturan harga & validasi (murni, dapat diuji)
│   ├── network.js        78 — pemilihan adapter jaringan (murni, dapat diuji)
│   ├── status.js        149 — penilaian diagnostik lapangan (murni, diuji)
│   ├── remote.js         56 — daftar putih aksi dari HP kasir (murni, diuji)
│   ├── preload.js        76 — contextBridge, 46 API
│   ├── secrets.js        70 — safeStorage, masking, hash PIN
│   ├── app-config.js     35 — kredensial OAuth bawaan yang ditanam saat build
│   └── assets/              — font Press Start 2P untuk HP kasir
├── src/                            (4126 LOC)
│   ├── admin/AdminLayer.jsx 1198 — seluruh state & modal admin
│   ├── admin/oskContext.js   — kanal keyboard on-screen
│   ├── App.jsx          212 — router layar + bootstrap/timer/remote/tema
│   ├── store/useStore.js 160 — seluruh state alur pelanggan
│   ├── session/
│   │   ├── SessionContext.jsx 450 — controller: kamera, rekaman, bayar, cetak
│   │   └── context.js      11 — context + hook useSession
│   ├── screens/             (10 file, 19–242 baris)
│   │   ├── LandingScreen, ConsentScreen, TemplateScreen, InputNameScreen
│   │   ├── PaymentScreen, CameraScreen, ReviewScreen, UpsellScreen
│   │   └── ResultScreen, ThanksScreen
│   ├── components/          (8 file, 19–548 baris)
│   │   ├── ArcadeEffects, RetroDialog, AdminPinGate, VirtualKeyboard
│   │   ├── InputSentuh, KeyboardAdmin (keyboard on-screen panel admin)
│   │   └── VisualEditor, AreaGeser, CompositePreview, SessionTimer
│   ├── utils/
│   │   ├── format.js     26 — formatter Rupiah, tema, perputaran tema
│   │   ├── session.js    56 — tenggat sesi & aturan retake (murni, diuji)
│   │   ├── keyboard.js   65 — tata letak & tombol keyboard on-screen (murni, diuji)
│   │   ├── pintasan.js  165 — peta pintasan + deteksi bentrok (murni, diuji)
│   │   └── riwayat.js    80 — penyusunan riwayat transaksi (murni, diuji)
│   ├── assets/              — font Press Start 2P (di-bundle Vite)
│   └── index.css            — tema CSS variables, reset
├── tests/                          (475 uji otomatis + 5 periksa manual)
│   ├── *.test.js            — logika murni, dijalankan Vitest (447 uji)
│   ├── db/                  — skema & query SQLite, runtime Electron (28 uji)
│   ├── manual/              — daftar periksa aplikasi sungguhan (npm run test:app)
│   └── README.md            — cara menjalankan + apa yang BELUM tercakup
├── .github/workflows/ci.yml ✅ lint + uji + build di windows-latest
├── vitest.config.js         ✅ konfigurasi uji
├── electron-builder.yml     ✅ konfigurasi packaging (NSIS + portable)
├── build/icon.png           ✅ ikon aplikasi (pixel-art, tema Candy)
├── release/                 ✅ hasil installer (di-gitignore)
├── .env                 ⚠️ Midtrans key plaintext, sudah dead code
├── eslint.config.mjs    ✅ diperbaiki; `no-use-before-define` aktif
├── vite.config.js       ✅ plugin penyuntik CSP untuk build produksi
└── package.json         ✅ script `lint`, `test`, `verify`, `pack`, `dist`
```

**Catatan arsitektur.** Struktur ini hasil Task #9. Sebelumnya `src/App.jsx`
adalah satu file 1.240 baris berisi seluruh UI, dengan `const store = useStore()`
tanpa selector — sehingga **satu perubahan state apa pun me-render ulang seluruh
aplikasi**, termasuk elemen `<video>` kamera dan preview komposit.

Tiga pemisahan utamanya:

- **`store/useStore.js`** memegang seluruh state alur pelanggan. Setiap komponen
  berlangganan hanya potongan yang dipakainya lewat selector.
- **`session/SessionContext.jsx`** memegang seluruh ref perangkat keras dan
  handler alur. Handler membaca state lewat `useStore.getState()`, bukan closure
  render, sehingga tidak pernah memakai data basi dan tidak memicu render.
- **`admin/AdminLayer.jsx`** memegang seluruh state admin, terpisah dari kiosk.
  Mengetik di form Pengaturan tidak lagi menyentuh layar kamera.

Dua komponen sengaja diisolasi untuk performa: `SessionTimer` (agar tick per
detik hanya me-render badge seukuran tombol) dan `CompositePreview` (di-`memo`,
karena ia bagian paling berat dan dulu ikut dirender ulang setiap detik).

---

# Bagian B — Referensi Teknis

## 5. Model Data (SQLite)

### `settings` — baris tunggal (`id=1`)

| Kolom | Tipe | Default | Fungsi |
|---|---|---|---|
| `hpp_kertas` | INTEGER | 3000 | HPP kertas per cetak |
| `hpp_tinta` | INTEGER | 2000 | HPP tinta per cetak |
| `biaya_ops` | INTEGER | 0 | Biaya operasional per cetak |
| `midtrans_server_key` | TEXT | `''` | ⚠️ plaintext |
| `midtrans_client_key` | TEXT | `''` | |
| `app_mode` | TEXT | `online` | `online` (Midtrans) / `offline` (kasir) |
| `static_qr_path` | TEXT | `''` | Nama file QRIS statis |
| `force_static_qr` | INTEGER | 0 | Paksa QR statis walau mode online |
| `gdrive_folder_id` | TEXT | `''` | ✅ Folder Induk Drive opsional; menerima URL folder yang ditempel, bukan hanya ID mentah |
| `selected_camera` | TEXT | `''` | deviceId kamera |
| `selected_printer` | TEXT | `''` | ✅ kini dipakai `printer.js` |
| `hw_bypass_mode` | INTEGER | 0 | Bypass pemblokir hardware + alihkan cetak ke PDF |
| `active_theme` | TEXT | `candy` | candy/bumblebee/neon/fall |
| `print_copies` | INTEGER | 1 | ✅ jumlah kopi per cetak |
| `print_paper_size` | TEXT | `''` | ✅ `4R`/`2x6`/`A6`/`A5`/`A4`, kosong = ikut driver |
| `print_enabled` | INTEGER | 1 | ✅ matikan cetak otomatis |
| `cashier_token` | TEXT | `''` | ✅ token akses HP kasir (32 hex) |
| `download_ttl_hours` | INTEGER | 24 | ✅ masa berlaku link download, 0 = tanpa batas |
| `midtrans_is_production` | INTEGER | 0 | ✅ sandbox vs production (dulu hardcoded) |
| `admin_pin_hash` | TEXT | `''` | ✅ scrypt bersalt, pelindung panel admin |
| `session_minutes` | INTEGER | 10 | ✅ durasi sesi foto |
| `retake_min_seconds` | INTEGER | 90 | ✅ jaminan sisa waktu saat retake (bug B4); 0 = dimatikan |
| `thanks_enabled` | INTEGER | 1 | ✅ tampilkan layar terima kasih setelah SELESAI |
| `thanks_seconds` | INTEGER | 3 | ✅ durasi tutup otomatis, dibatasi 1–15 detik |
| `thanks_message` | TEXT | `''` | ✅ pesan penutup; kosong = pakai teks bawaan |
| `server_ip_override` | TEXT | `''` | ✅ kunci alamat IP bila deteksi otomatis memilih adapter VPN/Hyper-V (bug B11) |
| `consent_enabled` | INTEGER | 1 | ✅ tampilkan layar persetujuan sebelum sesi |
| `retention_days` | INTEGER | 0 | ✅ umur maksimum berkas media; **0 = tidak pernah menghapus** |
| `gdrive_enabled` | INTEGER | 0 | ✅ status integrasi Drive |
| `gdrive_client_id` | TEXT | `''` | ✅ menimpa kredensial bawaan bila diisi |
| `gdrive_client_secret` | TEXT | `''` | ✅ terenkripsi `safeStorage` |
| `gdrive_refresh_token` | TEXT | `''` | ✅ terenkripsi `safeStorage` |
| `gdrive_account_email` | TEXT | `''` | ✅ akun yang tertaut, untuk ditampilkan di Pengaturan |
| `osk_enabled` | INTEGER | 0 | ✅ BARU: keyboard on-screen untuk panel admin. **Default MATI** — lihat [Bagian 6b](#6b-tab-aksesibilitas) |
| `shortcuts_json` | TEXT | `''` | ✅ BARU: peta pintasan keyboard. **Kosong = pakai bawaan**, dan hanya yang diubah operator yang disimpan |

### `templates` — master library frame

`id`, `filename` (UNIQUE), `filepath`, `is_free` ⚠️*unused*, `price`, `is_visible`,
`width`, `height`, `slots_json` (array `{top,left,width,height}`), `orientation`.

### `events` — sesi event

`id`, `nama_event`, `folder_name`, `saldo_awal`, `is_active`, `templates_json`
(snapshot template + `override_price`), `created_at`.

| Kolom | Keterangan |
|---|---|
| `upsell_enabled` | ✅ izinkan cetak tambahan pada event ini |
| `upsell_price` | ✅ harga per lembar tambahan. **0 berarti "ikut harga awal sesi"**, bukan gratis |
| `drive_folder_id` | ✅ folder Drive milik event, sekaligus folder dokumentasi owner |
| `drive_folder_url` | ✅ alamat folder event untuk dibagikan ke owner |

### `sessions` — transaksi per pelanggan

| Kolom | Keterangan |
|---|---|
| `id`, `event_id`, `customer_name` | — |
| `folder_name` | ⚠️ masih berisi nama folder **event**, bukan folder sesi (bug B5 belum ditutup) |
| `session_folder` | ✅ BARU: path absolut folder sesi |
| `waktu` | TEXT `toLocaleString('id-ID')` — **hanya untuk tampilan**; penyortiran & filter memakai `created_at_ms` |
| `harga_jual` | ✅ kini selalu berasal dari DB, bukan dari renderer |
| `status_cetak` | ✅ nyata: `MENUNGGU`/`TERCETAK`/`PDF`/`GAGAL`/`DILEWATI` |
| `print_path` | ✅ BARU: file hasil komposit — prasyarat reprint |
| `print_orientation` | ✅ BARU: orientasi lembar saat dicetak |
| `print_error` | ✅ BARU: alasan kegagalan cetak |
| `reprint_count` | ✅ BARU: jumlah cetak ulang |
| `token_download` | ✅ kini dipakai — token 32 hex untuk `/d/:token` |
| `download_expires_at` | ✅ BARU: epoch ms kedaluwarsa link |
| `retake_of` | ✅ BARU: id transaksi asal — retake tidak dihitung sebagai penjualan |
| `payment_method` | ✅ BARU: `free`/`manual`/`midtrans`/`retake` |
| `video_files` | ✅ BARU: JSON array nama file video milik sesi |
| `upsell_of` | ✅ BARU: id sesi asal untuk baris cetak tambahan |
| `print_qty` | ✅ BARU: jumlah lembar — dasar perhitungan beban HPP |
| `hpp_snapshot` | ✅ BARU: HPP per lembar **saat transaksi terjadi** (menutup bug B2) |
| `created_at_ms` | ✅ BARU: timestamp epoch agar riwayat bisa disortir & difilter rentang tanggal (menutup bug B6) |
| `slots_filled` / `slots_total` | ✅ BARU: berapa slot benar-benar terisi saat lembar dirender (bug B15) |
| `drive_folder_id` | ✅ BARU: subfolder pelanggan di Drive |
| `drive_folder_url` | ✅ BARU: alamat yang masuk ke QR pada mode online |
| `consent_at` | ✅ BARU: jejak audit persetujuan, timestamp diambil **di main process** |
| `purged_at` | ✅ BARU: kapan media sesi ini dihapus auto-purge |
| `link_gdrive` | ⚠️ peninggalan skema lama, tidak dipakai — digantikan `drive_folder_url` |

### `upload_queue` — antrean unggah Google Drive

Disimpan di database, bukan di memori, supaya antrean **bertahan melewati restart
aplikasi dan pemadaman listrik di tengah acara**.

| Kolom | Fungsi |
|---|---|
| `session_id`, `event_id` | Pemilik berkas |
| `file_path`, `file_name` | Berkas sumber di disk dan nama tujuannya di Drive |
| `kind` | `photo` / `video` / `report` |
| `priority` | Foto `10` → video `50` → laporan `90`; angka kecil dikerjakan lebih dulu |
| `status` | `pending` / `uploading` / `done` / `failed` |
| `attempts`, `last_error` | Retry sampai 8 kali sebelum ditandai `failed` |
| `drive_file_id` | Hasil unggahan |
| `created_at_ms`, `updated_at_ms` | Umur & kemajuan antrean |

Indeks: `idx_queue_status` (status, priority) untuk pemilihan pekerjaan berikutnya,
dan `idx_queue_event` untuk statistik per event di Live Dashboard.

Kolom `status` juga menjadi pengaman auto-purge: sesi yang masih punya baris
`pending`/`uploading` **tidak boleh** dihapus — lihat [Bagian 9b](#9b-retensi-data--persetujuan).

### Strategi migrasi

✅ **Diperbaiki.** `addColumn()` kini hanya menelan error `duplicate column name`; kegagalan
migrasi lain dilempar, bukan didiamkan sampai aplikasi jalan dengan skema rusak (bug B17).

✅ Indeks `idx_sessions_event` (event_id) dan `idx_sessions_token` (token_download)
ditambahkan; `journal_mode = WAL` dan `synchronous = NORMAL` diaktifkan.

⚠️ Masih belum ada: tabel versi skema, rollback, dan foreign key.

---

## 6. Alur Aplikasi (State Machine)

`store.currentScreen` mengendalikan seluruh routing (tidak ada router):

```
                    loading
                       │  fetchActiveEvent()
        ┌──────────────┴───────────────┐
   ada event aktif              tidak ada event
        │                              │
     landing ◄──────────────────► session_manager
        │  [MULAI SEKARANG]        (buat/buka/hapus event, buka Settings)
        ▼
    template   ← pilih frame (tab Portrait / Landscape)
        │
        ├── isRemoteRetake → begin-payment (harga 0, retake_of terisi) ──┐
        ▼                                                               │
    input_name  ← virtual keyboard A-Z+space                            │
        │                                                               │
        ▼                                                               │
    begin-payment  ← MAIN PROCESS menetapkan harga dari templates_json  │
        │                                                               │
        ├─ status 'paid' (gratis / retake) ─────────────────────────────┤
        ▼                                                               │
     payment                                                            │
        ├─ method 'manual'   → QR statis + tunggu kasir tekan [A]        │
        └─ method 'midtrans' → QRIS + main query status tiap 3s          │
        │                                                               │
        ▼◄──────────────────────────────────────────────────────────────┘
     camera   ← timer 10 menit, countdown 3-2-1, MediaRecorder jalan
        │
        ▼
     review   ← retake (maks 3, hanya jika sisa waktu > 60s)
        │  [CETAK SEKARANG]
        ▼
    loading → processImages (sharp composite + Excel + insert session)
        │
        ▼
     result   ← preview foto + video + QR download
        │
        ├─ [ CETAK LAGI ] (jika event mengizinkan upsell)
        │      ▼
        │   upsell  ← pilih jumlah lembar
        │      ▼
        │   payment ← Midtrans / QR statis / persetujuan kasir bila gratis
        │      ▼
        │   cetak N lembar → kembali ke result
        │
        └─ [ SELESAI ] → landing
```

**Timeout otomatis**: durasi sesi dapat diatur operator (bawaan 10 menit). Saat habis,
sesi dirender apa adanya — slot kosong diisi kotak putih oleh main process.

✅ **Retake tidak memperpanjang sesi** (bug B4). Ia mempertahankan tenggat yang sedang
berjalan, dengan satu pengecualian: bila sisa waktu di bawah lantai minimum (bawaan
90 detik), tenggat diangkat ke lantai itu.

Alasannya dua arah. Dulu setiap retake memberi 10 menit penuh yang baru, sehingga satu
pelanggan dengan 3 jatah retake bisa menahan kiosk sampai ~40 menit dan memblokir
antrean. Sebaliknya, menghapus perpanjangan sama sekali juga salah: pelanggan yang
menekan retake di menit ke-9 hanya punya sisa 1 menit, kemungkinan besar tidak selesai,
lalu kena auto-finish dengan slot kosong — padahal retake adalah hak yang sudah dibayar.

Lantai waktu menyelesaikan keduanya, dan perpanjangannya terbatas secara matematis:
durasi awal + (jatah retake × lantai) = **maksimal ~15 menit**, bukan 40.

Gerbang retake kini berbasis **sisa jatah**, bukan sisa waktu. Menutupnya di menit
terakhir tidak lagi diperlukan karena lantai waktu sudah menjamin retake dapat selesai.

**Gerbang otorisasi** ✅: `process-images` menolak merender bila tidak ada transaksi yang
lunas, belum terpakai, dan cocok dengan `templateId` + `eventId` yang diminta. Transaksi
ditandai `consumed` setelah dipakai — satu pembayaran hanya menghasilkan satu lembar.
Transaksi kedaluwarsa otomatis setelah 30 menit.

### Shortcut Admin (semuanya dilindungi PIN sejak Task #5)

| Shortcut | Aksi |
|---|---|
| `Ctrl+Shift+P` | Global Settings (termasuk Midtrans server key plaintext) |
| `Ctrl+Shift+T` | Master Template Library |
| `Ctrl+Shift+D` | Live Dashboard |
| `Ctrl+X` | ✅ BARU: Tutup sesi event (PIN + konfirmasi; diabaikan saat fokus di kolom teks) |
| `Ctrl+↑` / `Ctrl+↓` | Ganti tema (langsung tersimpan ke DB) |

> ⚠️ **Kiosk layar sentuh tidak punya keyboard fisik**, sehingga pintasan di atas
> tidak bisa ditekan di sana. Semuanya juga tersedia sebagai tombol di tab
> **KONTROL** pada HP kasir — lihat [Bagian 8b](#8b-halaman-kasir-hp).
>
> Kombinasinya **dapat diubah operator** lewat tab Aksesibilitas; yang di atas
> adalah bawaannya. Lihat [Bagian 6b](#6b-tab-aksesibilitas).

---

## 6b. Tab Aksesibilitas

Tab `[6]` di panel Pengaturan, rumah bagi pengaturan yang menyesuaikan aplikasi
dengan **cara mesin itu dipakai**, bukan dengan bisnisnya.

Penghuni pertamanya `osk_enabled` — saklar keyboard on-screen untuk panel admin.

**Kenapa default MATI, padahal fiturnya berguna.** Karena dua pemasangan yang
sah-sah saja menuntut jawaban berlawanan:

| Pemasangan | Tanpa keyboard layar | Dengan keyboard layar |
|---|---|---|
| Kiosk layar sentuh murni | Kolom seperti Midtrans key dan ID folder Drive **tidak bisa diisi sama sekali** | Berfungsi |
| Ada keyboard fisik | Berfungsi, cepat | Keyboard menutup separuh formulir, memperlambat |

Menebak salah satu berarti setengah pemasangan dirugikan. Default mati dipilih
karena itu **perilaku yang sudah berjalan hari ini** — pemasangan lama tidak
boleh berubah perilaku setelah pembaruan tanpa ada yang mengubah apa pun.

Konsekuensi teknisnya: saklar ini satu-satunya yang diperiksa dengan
`=== 1` alih-alih `!== 0` seperti saklar lain di sekitarnya. Uji migrasi
database menjaga pembedaan itu secara eksplisit — kolom bawaan-nyala harus
bernilai `1` dan bawaan-mati harus bernilai `0` pada baris settings yang sudah
ada, bukan `NULL`.

### Keyboard on-screen panel admin

Menyalakan saklar itu memunculkan keyboard melayang di bawah layar setiap kali
kolom di panel admin difokuskan.

**Kenapa ini tidak sesederhana "menulis ke elemen input".** Seluruh kolom di
panel admin adalah *controlled component* React. Menyetel `.value` elemennya
dari luar **tidak** memperbarui state — React memasang setter-nya sendiri pada
`HTMLInputElement.prototype`, sehingga perubahan dari DOM tertimpa pada render
berikutnya dan nilainya kembali seperti semula. Ketikan tampak masuk, lalu
hilang begitu ada yang memicu render.

Karena itu keyboard **tidak menyentuh DOM sama sekali**:

```
input difokuskan  →  InputSentuh mendaftarkan ref-nya ke kanal OSK
tombol ditekan    →  keyboard memanggil onChange MILIK input itu
                  →  setState  →  render  →  nilai baru
```

Jalur datanya tetap satu — persis seperti pengetikan sungguhan.

Yang didaftarkan adalah **ref**, bukan nilainya. Kalau yang dititipkan objek
biasa, ia membeku pada nilai saat fokus terjadi, dan huruf kedua akan menimpa
huruf pertama karena keyboard masih membaca nilai lama.

| Keputusan | Alasan |
|---|---|
| Tombol memakai `onMouseDown` + `preventDefault` | Tanpa ini, menekan tombol memindahkan fokus dari input dan keyboard menutup dirinya sendiri sebelum ketikan terkirim |
| Penambahan selalu di **akhir**, bukan di posisi kursor | Input terkendali React mengembalikan kursor ke akhir setiap render; menyisipkan di tengah justru menghasilkan urutan huruf yang tidak terduga. Tombol **CLR** ada supaya mengoreksi nilai panjang tidak berarti menekan DEL puluhan kali |
| SHIFT **menetap**, bukan sekali pakai | Mengetik `SB-Mid-server-…` berarti menyalakan sekali, bukan menekan SHIFT di setiap huruf |
| Simbol `. - _ @ /` | Dipilih dari nilai yang benar-benar diketik: ID folder Drive, alamat email akun, path. Tanpanya sebagian kolom tidak bisa diisi sama sekali |
| Melayang di `z-400` | Di atas seluruh modal admin, tetapi **di bawah gerbang PIN** — gerbang itu punya keypad angkanya sendiri |

22 kolom di panel admin diubah menjadi `InputSentuh`. Checkbox tidak, karena
tidak ada yang perlu diketik di sana.

### Pintasan keyboard yang dapat diubah

Keenam pintasan kiosk dapat diganti operator dari tab ini. Peta tersimpan di
`settings.shortcuts_json`, dan **hanya yang benar-benar diubah yang disimpan** —
peta yang seluruhnya bawaan disimpan sebagai string kosong. Alasannya: mengubah
bawaan di versi mendatang tetap sampai ke pemasangan yang tidak pernah
menyentuhnya. Menyimpan seluruh peta akan membekukannya pada bawaan versi lama.

Cara merekam: tekan `[ REKAM ]`, lalu tekan kombinasinya. `Esc` membatalkan.
Listener perekam dipasang dengan **capture** agar mendahului pintasan yang
sedang berlaku — tanpa itu, merekam `Ctrl+Shift+P` justru membuka panel.

**Dua aturan yang ditegakkan, bukan disarankan:**

| Aturan | Kenapa |
|---|---|
| Wajib memakai **Ctrl atau Alt** | Pintasan tanpa pengubah menyala setiap kali hurufnya diketik — di kiosk yang punya kolom nama pelanggan, itu fatal |
| Bentrok **kritis** menghalangi penyimpanan | Dua aksi dengan pintasan sama berarti salah satunya tidak akan pernah bisa dipakai; merebut `Ctrl+W`/`Ctrl+R` berarti kiosk menutup atau memuat ulang sendiri di tengah sesi |

Bentrok dipisah dua tingkat karena akibatnya berbeda jauh:

| Tingkat | Contoh | Perlakuan |
|---|---|---|
| 🔴 Kritis | `Ctrl+W` menutup jendela, `Ctrl+R` memuat ulang, `Ctrl+Shift+I` DevTools, atau sama dengan aksi lain | Tidak bisa disimpan |
| 🟡 Waspada | `Ctrl+C`, `Ctrl+V`, `Ctrl+X` — perintah pengeditan teks | Tetap dipakai, **diabaikan selama kursor di kolom isian** |

Pembagian itu bukan kompromi: **`Ctrl+X` bawaan sendiri berada di kategori
waspada.** Ia memang beririsan dengan "potong", dan itu disadari sejak awal —
`bisaBentrokSaatMengetik()` membuat aturan itu eksplisit dan diuji, bukan
sekadar satu `if` khusus yang tertanam di tengah handler seperti sebelumnya.

Peta dibaca lewat ref, bukan closure, sehingga pintasan yang baru disimpan
langsung berlaku tanpa perlu memasang ulang listener. JSON rusak, aksi tak
dikenal, dan pintasan tidak sah dibuang lalu diganti bawaan — kiosk tidak boleh
kehilangan seluruh pintasannya, dan dengan itu akses admin, hanya karena satu
baris JSON cacat.

**Satu jebakan yang ditutup uji.** `terapkanTombol` semula membandingkan tombol
dengan tata letak yang tersimpan huruf kapital, sehingga pemanggil yang
mengirim `'h'` ketikannya **dibuang tanpa suara**. Komponennya memang selalu
mengirim huruf besar, tetapi fungsi yang diam-diam membuang masukan adalah
kegagalan yang jauh lebih sulit dilacak daripada sekadar salah kapitalisasi.
Perbandingannya kini tidak peka huruf besar-kecil.

---

## 7. Kontrak IPC (46 channel)

Semua handler di `electron/main.js`, di-expose di `electron/preload.js`.
Sinkronisasi `preload` ↔ `main` diverifikasi dengan diff otomatis.

**Sistem & konfigurasi**
`ping`, `get-server-ip`, `list-network-interfaces`, `get-settings`, `save-settings`,
`check-hardware`, `select-static-qr`, `rotate-cashier-token`.

**Keamanan admin** ✅ Fase 1
`verify-admin-pin`, `is-admin-pin-default`, `set-admin-pin`.

**Event**
`get-active-event`, `get-recent-events`, `create-event`, `reopen-event`,
`close-event`, `delete-event`, `get-dashboard-data`, `export-event-report` ✅,
`update-event-upsell` ✅.

**Template**
`get-templates`, `open-file-dialog`, `save-new-template`, `update-template`,
`delete-template`.

**Sesi foto**
`start-customer-session`, `save-capture`, `save-video`, `process-images`.

**Pembayaran** ✅ Fase 1
`begin-payment`, `get-payment-status`, `cancel-payment`.

**Cetak tambahan** ✅ Fase 2
`get-upsell-info`, `begin-upsell-payment`, `confirm-upsell`.

**Cetak**
`print-photo`.

**Kepatuhan data pribadi** ✅ Fase 3
`record-consent`, `run-purge-now`.

**Google Drive** ✅ Fase 3
`gdrive-status`, `gdrive-save-credentials`, `gdrive-connect`, `gdrive-disconnect`,
`gdrive-is-linked`, `gdrive-queue-stats`, `gdrive-upload-now`, `gdrive-retry-failed`.

**Event push main → renderer** (7): `remote-verify`, `remote-close`,
`remote-restart`, `remote-retake`, `remote-reprint`, serta ✅ `remote-panel`
dan `remote-theme` untuk tab KONTROL di HP ([Bagian 8b](#8b-halaman-kasir-hp)).

### Perubahan kontrak yang perlu diingat

| Channel | Perubahan |
|---|---|
| `process-images` | Menerima **`photoPaths`** (array path file), bukan `photosBase64`. Juga menerima `paymentId`, **bukan `price`** — harga ditentukan main dari DB. |
| `save-capture` | Menerima **ArrayBuffer biner**, bukan string base64. Mengembalikan `filePath`. |
| `save-video` | Menerima `ext` (`mp4`/`webm`); nama file ditentukan main, bukan renderer. |
| `get-settings` | **Tidak lagi mengirim** `midtrans_server_key`, `admin_pin_hash`, `cashier_token`. Hanya bentuk tersamar. |
| `create-qris`, `check-payment` | ❌ Dihapus (renderer menentukan nominal & menyimpulkan status). |
| `set-pending-payment`, `clear-pending-payment` | ❌ Dihapus, digantikan state di main. |

---

## 8. HTTP API Lokal (`0.0.0.0:3000`)

✅ **Diperbaiki di Task #2 & #3.**

| Method | Endpoint | Auth | Fungsi |
|---|---|---|---|
| GET | `/admin` | — | Kerangka UI kasir (tanpa data) |
| GET | `/api/pending` | 🔒 Bearer | Tagihan yang menunggu verifikasi manual |
| POST | `/api/verify` | 🔒 Bearer | Menyetujui pembayaran manual |
| POST | `/api/close` | 🔒 Bearer | Tutup sesi event |
| POST | `/api/restart` | 🔒 Bearer | Reload aplikasi kiosk |
| GET | `/api/history` | 🔒 Bearer | Transaksi event aktif |
| POST | `/api/remote-retake/:id` | 🔒 Bearer | Menandai retake |
| POST | `/api/remote-reprint/:id` | 🔒 Bearer | Cetak ulang (nyata) |
| POST | `/api/panel/:which` | 🔒 Bearer | Memicu panel admin / kembali ke landing ✅ |
| POST | `/api/theme/:arah` | 🔒 Bearer | Ganti tema (`next` / `prev`) ✅ |
| GET | `/api/status` | 🔒 Bearer | Diagnostik lapangan: disk, printer, antrean Drive, PIN ✅ |
| GET | `/d/:token` | 🎫 Token sesi | Halaman unduhan pelanggan (foto + video) |
| GET | `/d/:token/photo` | 🎫 Token sesi | File foto hasil |
| GET | `/d/:token/video/:n` | 🎫 Token sesi | File video sesi |
| GET | `/fonts/*` | — | Font Press Start 2P untuk HP kasir |
| GET | `/oauth2callback` | 🏠 Loopback | Callback OAuth Google Drive |
| GET | `/templates/*` | 🏠 Loopback | Hanya dari kiosk sendiri |
| GET | `/qr/*` | 🏠 Loopback | Hanya dari kiosk sendiri |

> Ketiga route `/d/*` **dinonaktifkan pada mode online** — lihat
> [sakelar unduhan lokal](#sakelar-unduhan-lokal). Pengecualiannya adalah preview
> di layar kiosk yang datang lewat loopback.

**Model keamanan:**

- **Token kasir** — 24 byte acak di `settings.cashier_token`, diberikan lewat QR pairing
  (`/admin?t=<token>`). HP menyimpannya di `localStorage` lalu **menghapusnya dari URL**
  (`history.replaceState`) agar tidak tertinggal di address bar atau screenshot.
- **Header, bukan cookie** — dikirim sebagai `Authorization: Bearer`. Ini menutup CSRF
  secara struktural: browser tidak bisa mengirim header custom lintas-situs tanpa preflight
  CORS, dan CORS tidak diaktifkan. Semua aksi juga sudah POST.
- **Perbandingan waktu-tetap** (`crypto.timingSafeEqual`) saat memvalidasi token.
- **Rate limit** 180 request/menit per IP pada `/api/*` dan `/d/*`.
- **`express.static(OUTPUT_PATH)` dihapus total** — diganti `/d/:token` yang hanya melayani
  satu file milik satu sesi, dengan validasi bahwa path hasil resolusi berada di dalam
  `OUTPUT_PATH`.

⚠️ `/admin` sendiri masih dilayani tanpa auth, tapi isinya hanya kerangka kosong — tanpa
token, semua panggilan `/api/` di dalamnya ditolak dan yang muncul adalah layar pairing.

---

## 8b. Halaman Kasir (HP)

### Dari konsol Gameboy ke aplikasi bertab

Versi awal halaman kasir meniru konsol genggam: casing 3D, D-pad, tombol A/B,
dan layar LCD ber-scanline. Tampilan itu **sudah dilepas**. Tiga alasan yang
membuatnya tidak bertahan di lapangan:

1. **Aksinya tidak muat.** D-pad + A/B hanya menyediakan empat tombol. Setiap
   fitur baru terpaksa ditumpuk sebagai mode tersembunyi di tombol yang sama —
   B berarti "riwayat" kecuali sedang konfirmasi, lalu berarti "batal".
2. **Tata letaknya diduplikasi.** Portrait dan landscape masing-masing punya
   salinan D-pad dan A/B sendiri di DOM, disembunyikan bergantian lewat
   `display: none`. Dua sumber kebenaran untuk tombol yang sama.
3. **Ukurannya dikunci ke viewport.** `height: 45svh` pada bezel membuat isi
   layar terpotong di HP pendek, dan tenggelam di tablet.

Penggantinya rangka aplikasi biasa dengan empat tab: **TAGIHAN**, **RIWAYAT**,
**KONTROL**, dan **STATUS**. Satu DOM untuk dua orientasi — CSS `order` memindahkan navigasi
ke bawah saat portrait dan menjadi rel kiri saat landscape.

### Pemecahan berkas

Dulu satu berkas 413 baris berisi HTML, CSS, dan JavaScript sebagai satu string
raksasa di dalam backtick. Konsekuensinya: **ESLint tidak pernah membacanya.**
Salah ketik apa pun di dalam string itu lolos dari `npm run verify` dan baru
ketahuan di HP kasir, di tengah acara.

| Berkas | Baris | Isi | Dibaca ESLint | Diuji |
|---|---|---|---|---|
| `admin/client.js` | 537 | Logika browser: token, polling, tab, render | ✅ | ✅ struktural + XSS DOM |
| `admin/styles.js` | 254 | Gaya rangka responsif | — | — |
| `admin/format.js` | 143 | Logika murni: Rupiah, status, tema, penyaringan riwayat | ✅ | ✅ Vitest |
| `admin/shell.js` | 110 | Rangka HTML statis | — | ✅ (dijaga tetap statis) |
| `admin/index.js` | 45 | Perakit | ✅ | ✅ |

`client.js` dan `format.js` adalah **berkas `.js` sungguhan** yang dibaca dari
disk lalu disisipkan ke `<script>` saat halaman dirakit. Keduanya diberi blok
ESLint tersendiri dengan global browser — dan `require` sengaja **tidak**
tersedia di sana, karena di browser HP tidak ada module loader yang akan
menjalankannya.

`format.js` dimuat dua kali: sebagai `<script>` klasik di browser (deklarasi
fungsinya menjadi global) dan lewat `require()` dari Vitest, memakai penjagaan
`typeof module !== 'undefined'`.

### Tab KONTROL — kenapa ia ada

Ini bukan kenyamanan, melainkan **satu-satunya cara** menjangkau sebagian fungsi
admin. Kiosk photobooth adalah layar sentuh **tanpa keyboard fisik**, sehingga
`Ctrl+Shift+P/T/D` dan `Ctrl+Panah` sebenarnya tidak pernah bisa ditekan di sana.
Selama ini pintasan itu hanya terjangkau bila teknisi menancapkan keyboard USB.

| Tombol | Setara pintasan | Gerbang PIN di kiosk |
|---|---|---|
| PENGATURAN | `Ctrl+Shift+P` | ✅ Ya |
| TEMPLATE | `Ctrl+Shift+T` | ✅ Ya |
| DASHBOARD | `Ctrl+Shift+D` | ✅ Ya |
| `<` TEMA / TEMA `>` | `Ctrl+↑` / `Ctrl+↓` | — |
| KEMBALI KE LANDING | — (baru) | — |
| RESTART APLIKASI | — | — |
| TUTUP SESI EVENT | `Ctrl+X` | — |

**HP tidak punya pintu belakang.** Perintah dari HP masuk lewat `runGuarded()`
dan `gantiTema()` yang **persis sama** dengan jalur keyboard di `AdminLayer`.
Menekan PENGATURAN di HP tidak membuka apa pun — ia memunculkan keypad PIN di
layar kiosk, sama seperti menekan pintasannya sendiri. Karena itu HP memberi
pesan *"CEK LAYAR KIOSK — MASUKKAN PIN ADMIN"*; tanpa itu kasir menekan tombol
lalu mengira tidak terjadi apa-apa.

Pembagian mana yang butuh PIN bukan selera, melainkan mengikuti preseden yang
sudah ada:

| Kategori | Isi | Alasan |
|---|---|---|
| **Panel admin** | settings, template, dashboard | Membuka harga, kunci Midtrans, dan laporan — butuh PIN |
| **Kendali sesi** | landing, restart, close | Setara `/api/restart` & `/api/close` yang sudah lama ada: mengendalikan alur, tidak membuka data. Token kasir sudah cukup |

Daftar putihnya tinggal di `electron/remote.js` — modul murni, sehingga nilai
yang datang sebagai potongan URL tidak pernah diteruskan mentah ke renderer.
Tanpa daftar itu, siapa pun yang memegang token bisa menyuruh kiosk melakukan
hal yang tidak pernah dirancang.

### Tab STATUS — diagnostik lapangan

Masalah yang ia tutup: seluruh tanda bahaya hanya terlihat di layar kiosk,
padahal **justru saat ada masalah operator sedang tidak berdiri di sana** — ia
mengurus antrean tamu, bukan menatap mesin.

| Yang dipantau | Kenapa penting |
|---|---|
| **Sisa disk** | Habis di tengah acara = foto gagal disimpan **setelah pelanggan membayar** |
| **Printer terpilih** | Nama printer berubah setelah driver diinstal ulang; cetak diam-diam jatuh ke printer bawaan |
| **Antrean unggah Drive** | Menunggu / berjalan / selesai / **gagal** + galat terakhir |
| **PIN admin** | Peringatan selama masih `1234` |
| **Alamat server & mode** | Untuk memastikan HP dan kiosk berada di jaringan yang sama |

Prinsip tampilannya: **yang sehat tidak ditampilkan sebagai peringatan.** Kartu
*PERLU PERHATIAN* hanya berisi temuan yang benar-benar menuntut tindakan,
diurutkan kritis lebih dulu. Kalau semua kondisi ikut dipajang sederajat, yang
penting tenggelam dan operator berhenti membacanya.

Penilaiannya tinggal di `electron/status.js` — murni, tidak mengambil data
sendiri. Ambangnya dipilih dari sudut pandang acara yang sedang berjalan, bukan
sudut pandang komputer:

| Ambang | Nilai | Alasan |
|---|---|---|
| Disk kritis | < 2 GB | ±80 sesi tersisa — cukup menyelesaikan acara ini, tidak lebih |
| Disk waspada | < 10 GB | Masih ada waktu bertindak sebelum mentok |
| Antrean gagal | ≥ 1 | Berkas pelanggan **belum punya cadangan**; bila retensi menghapus media lokalnya, hilang permanen |

**Satu bug ditemukan oleh ujinya sendiri.** `Number(null)` menghasilkan `0`,
sehingga pembacaan disk yang **gagal** dilaporkan sebagai *"0 B — foto bisa
gagal disimpan"*. Itu alarm palsu, dan alarm palsu membuat operator berhenti
mempercayai peringatan yang sungguhan. Sekarang "tidak terbaca" dan "menipis"
adalah dua pesan berbeda.

Status ditarik jauh lebih jarang daripada tagihan (60 detik vs 2–5 detik):
isinya berubah dalam hitungan menit, bukan detik. Titik penanda pada tab tetap
diperbarui walau kasir sedang membuka tab lain — justru saat itulah ia berguna.

### Tab RIWAYAT — pencarian & saringan status

Acara 100 tamu menghasilkan ratusan baris. Menggulir mencari satu nama di layar
HP tidak realistis, dan yang paling sering dicari kasir justru transaksi yang
**gagal dicetak** — karena itu keduanya menjadi penyaring, bukan hiasan.

| Perilaku | Alasan |
|---|---|
| Menyaring dari data di memori, bukan memanggil server tiap huruf | Hasil berubah seiring ketikan tanpa membebani kiosk |
| Pencarian tidak peka huruf besar-kecil, spasi tepi diabaikan | Kasir mengetik terburu-buru sambil melayani antrean |
| Saringan status menampilkan **angka jumlah** | Kasir tahu ada berapa yang gagal tanpa perlu menekannya |
| Status yang tidak muncul di event ini **diredupkan, bukan disembunyikan** | Posisinya tetap dan bisa dihafal |
| Status tak dikenal tetap dihitung di SEMUA | Kalau tidak, totalnya berbohong dan kasir mengira ada transaksi hilang |
| "MENAMPILKAN N DARI M" hanya muncul saat ada yang tersaring | Menampilkannya selalu hanya menambah kebisingan |

### Yang dijaga uji otomatis

| Aturan | Kenapa |
|---|---|
| `client.js` tidak memakai satu pun sink HTML (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`) | Batas paling tegas untuk menjaga S6 tertutup — bila tidak ada sink, nama pelanggan **tidak mungkin** sampai ke parser HTML, berapa pun jumlah tab yang menampilkannya |
| Tidak ada handler dipasang lewat `setAttribute('on…')` | Atribut event menerima string yang dieksekusi sebagai kode — sama berbahayanya dengan `innerHTML` |
| Setiap fungsi render tab dibangun lewat DOM API | Daftar ini ikut bertambah setiap ada tab baru, sehingga tab yang lupa diamankan ketahuan |
| Rangka HTML tidak memuat `${` | Rangka harus tetap statis; interpolasi ke dalamnya adalah jalur stored XSS |
| Tidak ada atribut `onclick` sebaris | Semua penangan dipasang lewat `addEventListener` |
| Sumber tidak memuat `</script>` atau `<!--` | Parser HTML menutup elemen script pada `</script>` **pertama**, termasuk yang berada di dalam komentar JavaScript. Satu kalimat komentar yang menyebut tag penutup akan memotong halaman di tengah |
| Tidak ada `require`/`import` | Berjalan sebagai script klasik tanpa bundler |
| `format.js` dimuat sebelum `client.js` | Client memakai fungsinya |
| Setiap panel di daftar putih punya tombolnya di HP | Panel baru yang didaftarkan tetapi lupa diberi tombol jadi tidak terjangkau — persis masalah yang ingin ditutup tab KONTROL |

Aturan `</script>` bukan kehati-hatian teoretis: komentar di berkas-berkas itu
justru banyak membicarakan tag script, dan pemeriksaannya sengaja dilakukan pada
sumber **mentah** — bukan versi yang komentarnya sudah dibuang.

### Verifikasi visual & integrasi

Halaman ini diperiksa dengan memuatnya di Chromium sungguhan (lewat runtime
Electron, dengan server tiruan berisi data karangan), bukan hanya lewat uji
string. Yang dibuktikan di sana: tidak ada galat konsol, rangka portrait dan
landscape keduanya benar, konfirmasi dua langkah berjalan, dan nama pelanggan
berisi `<img src=x onerror=alert(1)>` **tampil sebagai teks** — tidak ada elemen
`<img>` yang terbentuk di DOM.

**Uji XSS DOM sungguhan (Task #6).** Uji struktural membuktikan sink HTML tidak
dipakai; harness terpisah membuktikan *akibatnya* di browser. Setiap kolom yang
datang dari database — nama pelanggan, catatan, nama event, waktu, alasan gagal
cetak, nama printer, akun Drive, galat antrean, bahkan pesan galat dari server —
diisi muatan `<img onerror>`, `<svg onload>`, dan `<script>` yang menandai
dirinya bila tereksekusi. **12 pemeriksaan, semuanya lulus:**

- nol elemen `img`/`svg`/`script`/`iframe` terbentuk di keempat tab
- nol atribut `on…` terpasang dari data
- muatan tampil sebagai **teks biasa** di layar
- kueri pencarian jahat tidak mengubah cara daftar dibangun
- `window.__xss === 0` — tidak satu pun muatan berhasil dieksekusi

Penjagaan strukturalnya juga dibuktikan bermakna: menyuntikkan `innerHTML` ke
`renderTagihan` membuat dua uji gagal, dan keduanya hijau lagi setelah
dikembalikan.

Sisi kiosknya diperiksa terpisah dengan memuat bundel React hasil build di
Electron, memasang `electronAPI` tiruan, lalu **memicu event seolah datang dari
HP kasir** dan memeriksa DOM yang dihasilkan. Empat belas pemeriksaan, semuanya
lulus, termasuk yang paling menentukan:

- ketiga panel admin memunculkan gerbang PIN, bukan langsung terbuka
- isi panel Pengaturan **tidak bocor sebelum PIN benar**
- tema berputar dua arah dan benar-benar tersimpan lewat `saveSettings`
- perintah `landing` tidak menuntut PIN dan membatalkan pembayaran menggantung

Ini sekaligus **cakupan uji React pertama** di proyek ini. Sebelumnya lapisan
itu sepenuhnya kosong — lihat catatan di [Bagian 18](#18-pengujian-otomatis).
Naskahnya kini tersimpan di `tests/manual/` dan dijalankan lewat
`npm run test:app`; lihat [Bagian 18b](#18b-daftar-periksa-aplikasi-sungguhan).

---

## 9. Integrasi Google Drive

### Mengapa Drive, dan masalah apa yang ia selesaikan

Sebelum Drive, seluruh pengantaran hasil lewat jaringan lokal. Untuk acara 100
tamu dengan foto ~5 MB + video ~20 MB, itu berarti **~2,5 GB diunduh dari kiosk**
dan **100 perangkat harus join WiFi venue**. Yang lebih dulu jebol biasanya bukan
volume, melainkan jumlah koneksi — router konsumer tersendat di 30–50 klien aktif
dan DHCP pool sering hanya 50 alamat.

Dengan Drive, kiosk mengunggah sekali lewat koneksinya sendiri, lalu tamu
mengunduh dari CDN Google memakai kuota masing-masing. **Beban jaringan venue
menjadi nol.**

### Model distribusi kredensial

Kredensial OAuth adalah milik **vendor** (pemilik aplikasi), bukan milik klien.
Vendor mendaftar **satu kali** di Google Cloud Console, kredensialnya ditanam ke
aplikasi saat build, dan klien cukup menekan `[ HUBUNGKAN AKUN GOOGLE ]`.

| Berkas | Peran |
|---|---|
| `electron/oauth-credentials.example.json` | Template + petunjuk pembuatan (masuk repo) |
| `electron/oauth-credentials.json` | Kredensial asli — **di-gitignore**, tetapi ikut terbundel ke exe |
| `electron/app-config.js` | Memuat kredensial bawaan; kosong bila berkas tidak ada |

Field Client ID/Secret di Pengaturan **tidak dihapus**, hanya dilipat ke dalam
`<details>` berlabel opsional — untuk klien korporat yang ingin memakai project
Google Cloud mereka sendiri. Bila diisi, nilai itu menimpa kredensial bawaan.

> ⚠️ **Dua hal yang harus diketahui vendor sebelum merilis:**
>
> 1. **Client secret pada aplikasi desktop dapat diekstrak dari binary.** Google
>    sendiri menyatakan ia tidak diperlakukan sebagai rahasia untuk aplikasi
>    terinstal — itulah alasan **PKCE** dipakai, dan sudah terpasang. Bila
>    disalahgunakan, rotasi client-nya di Google Cloud Console.
> 2. **Ada batas ~100 pengguna sebelum verifikasi Google.** Scope yang dipakai
>    adalah `drive.file` (aplikasi hanya bisa menyentuh berkas yang ia buat
>    sendiri) justru karena bebannya paling ringan. Google beberapa kali mengubah
>    klasifikasi scope, jadi **konfirmasi status verifikasi saat mendaftar**.

### Autentikasi

OAuth 2.0 Desktop dengan **loopback redirect + PKCE**. Alamat redirect:
`http://127.0.0.1:3000/oauth2callback`, dikunci ke loopback lewat middleware
`onlyLoopback`.

Service account **sengaja tidak dipakai**: ia tidak punya kuota penyimpanan di My
Drive biasa, sehingga unggahan gagal dengan `storageQuotaExceeded` kecuali memakai
Shared Drive (butuh Google Workspace berbayar).

`client_secret` dan `refresh_token` disimpan terenkripsi lewat `safeStorage`;
access token hanya hidup di memori dan tidak pernah menyentuh disk.

### Struktur folder

```
[Folder Induk opsional]
└── <Nama Event>/                         ← dibuat saat event dibuat
    ├── Laporan_Keuangan.xlsx             ← diunggah saat event ditutup
    ├── Ani Wijaya - Pesta Ultah/         ← dibuat saat pembayaran lunas
    │   ├── Ani Wijaya-foto.png
    │   └── Ani Wijaya-video1.mp4
    └── Budi Santoso - Pesta Ultah/
        └── ...
```

Folder event sekaligus berfungsi sebagai folder dokumentasi owner. Setiap folder
diberi izin *anyone with the link → reader* agar pelanggan tidak perlu login
Google.

### Kapan folder dibuat

Subfolder pelanggan dibuat saat **pembayaran lunas**, lewat satu fungsi
`markPaymentPaid()` yang dipanggil dari **ketiga** jalur pelunasan: gratis/retake,
verifikasi kasir, dan settlement Midtrans. Menambal salah satu saja akan membuat
dua jalur lain diam-diam tidak membuat folder.

Pembuatan berjalan **di latar belakang** dan tidak memblokir apa pun — pelanggan
langsung masuk ke kamera sementara folder dibuat. Saat render, sistem menunggu
maksimal **4 detik** kalau-kalau belum selesai, lalu jalan terus tanpa Drive bila
gagal.

### Antrean unggah

| Aspek | Perilaku |
|---|---|
| Penyimpanan | Tabel `upload_queue` di SQLite — **bertahan melewati restart aplikasi dan mati listrik** |
| Prioritas | Foto `10` → video `50` → laporan `90`. Video 80% volume, jadi menyusul |
| Worker | Jalan tiap 15 detik, satu berkas per putaran agar kegagalan cepat terdeteksi |
| Retry | Sampai 8 kali sebelum ditandai `failed` |
| Unggah | **Resumable** berpotongan 8 MB — koneksi venue sering putus di tengah, dan unggahan biasa harus mengulang dari nol |
| Folder yatim | Sesi yang foldernya belum sempat dibuat (mis. offline) dibuatkan otomatis saat antrean diproses |
| Pemicu | Otomatis tiap 15 detik **dan** tombol manual di Live Dashboard serta Manajemen Sesi |

### Sakelar unduhan lokal

| Mode | Unduhan lokal | Isi QR |
|---|---|---|
| **Online** | ❌ Nonaktif | Folder Google Drive |
| **Offline** | ✅ Aktif | Halaman lokal `/d/<token>` |

Pada mode online, melayani unduhan lokal justru mengembalikan beban jaringan yang
ingin dihindari. Pada mode offline, jalur lokal adalah satu-satunya pengantaran
yang tersedia.

**Seluruh kode jalur lokal dipertahankan utuh, tidak dihapus** — ia akan dipakai
kembali saat integrasi website vendor siap (lihat [Bagian 15](#15-rencana-integrasi-website-vendor)).

Pengecualian: preview di layar kiosk tetap memakai jalur lokal lewat loopback,
karena ia datang dari mesin itu sendiri dan tidak membebani jaringan.

### Bila QR tidak bisa dibuat

Terjadi saat mode online tetapi folder Drive gagal dibuat (mis. internet putus).
Layar hasil menampilkan pesan bahwa foto **sudah tercetak dan tersimpan aman**,
softfile akan diunggah begitu koneksi tersedia, dan pelanggan diarahkan menghubungi
petugas. Berkas tetap masuk antrean, jadi tidak ada yang hilang.

---

## 9b. Retensi Data & Persetujuan

### Layar persetujuan

Ditampilkan setelah `[ MULAI SEKARANG ]`, **sebelum** nama diketik dan sebelum
kamera menyala. Penempatan ini disengaja: menaruhnya setelah pembayaran berarti
pelanggan baru diberi tahu apa yang direkam ketika uangnya sudah keluar.

Isinya menyebut secara eksplisit bahwa **foto dan video** direkam — sebelum ini,
video sesi direkam tanpa pernah disebut di layar mana pun.

Persetujuan dicatat sebagai `sessions.consent_at`, dan **timestamp-nya diambil di
main process** lewat IPC `record-consent`, bukan dikirim renderer — supaya jejak
audit ini tidak bisa dikarang dari sisi UI.

Operator dapat mematikannya lewat Pengaturan → Umum bila memasang papan
pemberitahuan fisik di lokasi.

### Auto-purge

| Aspek | Perilaku |
|---|---|
| Pengaturan | `retention_days`, **default 0 = tidak pernah menghapus** |
| Jadwal | Saat startup, lalu tiap 24 jam (kiosk sering menyala berhari-hari) |
| Yang dihapus | **Hanya folder media** (foto + video) |
| Yang dipertahankan | **Seluruh baris transaksi** — laporan keuangan event lama harus tetap utuh |
| Pengaman unggahan | Sesi yang masih punya antrean `pending`/`uploading` **tidak** dihapus — menghapus sebelum cadangan selesai berarti kehilangan permanen |
| Pengaman data lama | Baris tanpa `created_at_ms` (dibuat sebelum Fase 12) dilewati, agar tidak dihapus berdasarkan tebakan |
| Jejak | `sessions.purged_at` diisi, sehingga sesi yang sama tidak diproses dua kali |
| Perkakas | Tombol **Simulasi** (menghitung tanpa menghapus) dan **Hapus Sekarang** dengan konfirmasi jumlah |

Pemisahan "hapus media, simpan transaksi" adalah inti desainnya: kepatuhan privasi
dan integritas pembukuan sama-sama terjaga tanpa saling mengorbankan.

Aturan seleksinya diuji terisolasi dengan 6 kasus: sesi tua terpilih, sesi baru
dilewati, sesi yang sudah dihapus tidak diproses ulang, baris tanpa timestamp
dilewati, baris tanpa folder dilewati, dan sesi dengan unggahan tertunda tidak
ikut terhapus.

---

# Bagian C — Kondisi Fitur

## 10. Fitur yang Sudah Ada

### Kiosk Pelanggan
- ✅ Pemilihan frame dengan tab Portrait/Landscape otomatis (hanya muncul jika kedua orientasi tersedia)
- ✅ Virtual on-screen keyboard (QWERTY A–Z, SPACE, DEL) untuk kiosk touchscreen tanpa keyboard fisik
- ✅ Countdown 3-2-1 + "SNAP!" per slot foto, otomatis lanjut ke slot berikutnya
- ✅ Live preview komposit — foto ditempel real-time di posisi slot di atas overlay frame
- ✅ Mirror preview (`scale-x-[-1]`) agar terasa seperti bercermin
- ✅ Retake per slot, maksimal 3x, dikunci jika sisa waktu < 60 detik
- ✅ Timer sesi 10 menit dengan display MM:SS dan auto-finish
- ✅ Perekaman video behind-the-scenes seluruh sesi (MediaRecorder → `video_N.mp4`)
- ✅ QR code hasil → pelanggan download file resolusi penuh dari server lokal
- ✅ Frame gratis (harga ≤ 0 melewati layar pembayaran)
- ✅ Layout adaptif portrait vs landscape di layar kamera & review

### Cetak Fisik ✅ BARU (Task #1)
- ✅ Cetak senyap ke printer terpilih lewat hidden `BrowserWindow` + `webContents.print()`
- ✅ Menunggu gambar ter-decode sebelum cetak (tanpa ini hasilnya lembar kosong)
- ✅ Validasi nama printer ke `getPrintersAsync()`, fallback ke printer default + warning
- ✅ Timeout 60 detik agar driver menggantung tidak membekukan sesi pelanggan
- ✅ Ukuran kertas 4R / photostrip 2x6 / A6 / A5 / A4, atau ikut setelan driver
- ✅ Orientasi landscape mengikuti orientasi template
- ✅ Jumlah kopi per cetak, dan toggle matikan cetak otomatis
- ✅ **Fallback PDF** saat mode bypass hardware — alur kiosk bisa diuji tanpa printer
- ✅ Status cetak nyata + tombol `[ COBA CETAK LAGI ]` di layar hasil
- ✅ Reprint dari HP kasir benar-benar mencetak dan melaporkan hasil sebenarnya

### Pengiriman Hasil ✅ BARU (Task #7, #12, #14, #15)
- ✅ QR pelanggan membuka **halaman unduhan** bergaya retro & mobile-friendly
- ✅ Foto resolusi penuh + **video di balik layar** dengan pemutar & tombol simpan
- ✅ Rekaman **MP4/H.264** (diverifikasi didukung build Electron ini) agar bisa
  diputar aplikasi Foto bawaan iOS; WebM tetap jadi cadangan otomatis
- ✅ Rekaman retake tersimpan terpisah, tidak lagi menimpa rekaman sesi utama
- ✅ Layar hasil kiosk: tiga kolom seimbang — foto, video, QR + aksi

### Cetak Tambahan / Upsell ✅ BARU (Task #13)
- ✅ Tombol `[ CETAK LAGI ]` di layar hasil, muncul hanya bila event mengizinkan
- ✅ Pilih jumlah lembar (1–10) dengan total harga live
- ✅ Harga: `upsell_price` event bila diisi, kalau kosong ikut harga awal sesi;
  untuk sesi hasil retake, ditelusuri ke sesi induknya
- ✅ Bila harga nol (event gratis): **tetap wajib persetujuan kasir**, tanpa Midtrans
- ✅ Kasir melihat label `CETAK TAMBAHAN N LEMBAR` agar tahu yang ia setujui
- ✅ Akuntansi: baris upsell tertaut `upsell_of`, masuk omzet, HPP dihitung per lembar
- ✅ Setting per event bisa diubah saat event sedang berjalan lewat Live Dashboard

### Google Drive ✅ BARU (Task #16, #17, #18)
- ✅ OAuth desktop + PKCE; kredensial vendor ditanam saat build sehingga klien
  **tidak perlu membuka Google Cloud Console**
- ✅ Folder per event (sekaligus dokumentasi owner) + subfolder per pelanggan
- ✅ QR mengarah ke folder Drive — tamu tidak perlu join WiFi venue
- ✅ Antrean unggah tahan restart & mati listrik, retry hingga 8 kali
- ✅ Resumable upload 8 MB per potongan untuk video besar
- ✅ Unggah otomatis saat internet terdeteksi + tombol manual per event
- ✅ Gerbang di layar landing: sesi tidak boleh dimulai sebelum akun Drive tertaut
  (memeriksa status konfigurasi, **bukan** koneksi internet — agar mode offline tetap jalan)

### Kepatuhan Data Pribadi ✅ BARU (Task #19)
- ✅ **Layar persetujuan** sebelum sesi dimulai — ditempatkan sebelum nama diketik
  dan sebelum kamera menyala, bukan setelah pembayaran
- ✅ Menyebut **foto dan video** secara eksplisit; sebelumnya video direkam tanpa
  pernah disebut di layar mana pun
- ✅ Menyebut penyimpanan lokal dan unggahan Google Drive bila mode online aktif
- ✅ Jejak audit `consent_at` dicatat **di main process**, bukan diklaim renderer
- ✅ Dapat dimatikan operator bila memakai papan pemberitahuan fisik
- ✅ **Auto-purge** berbasis umur berkas, berjalan saat startup dan tiap 24 jam
- ✅ Tombol **Simulasi** untuk melihat dampak sebelum menghapus apa pun

### Pembayaran
- ✅ Mode ONLINE: Midtrans Core API QRIS (acquirer GoPay)
- ✅ Mode OFFLINE: QRIS statis (upload gambar) + verifikasi manual kasir
- ✅ Toggle "PAKSA SELALU STATIS" untuk override mode online
- ✅ Toggle sandbox/production (Task #4 — dulu hardcoded sandbox)
- ✅ Otorisasi di main process; harga diambil dari DB, bukan dari renderer
- ✅ Penanganan status `deny`/`cancel`/`expire`/`failure` yang dulu tidak ada
- ✅ Retake tidak dihitung sebagai penjualan baru (`retake_of`)

### Remote Cashier (HP)
- ✅ UI skeuomorphic konsol Gameboy (portrait) / PSP (landscape) dengan D-pad + tombol A/B
- ✅ Tombol A = verifikasi bayar, B = riwayat, D-pad ↑ = restart, ↓ = tutup sesi
- ✅ Layar konfirmasi 2-langkah untuk aksi destruktif
- ✅ Riwayat transaksi live + aksi Retake / Reprint per transaksi
- ✅ Tema HP mengikuti tema kiosk secara otomatis (polling 2s)
- ✅ Akses via QR code yang ditampilkan di Live Dashboard

### Admin / Operator
- ✅ Manajemen Sesi Event: buat, buka ulang, tutup, hapus (dengan opsi hapus folder fisik)
- ✅ Harga override per template per event (`templates_json` snapshot)
- ✅ Master Template Library: upload PNG, toggle visibilitas, harga dasar, hapus
- ✅ **Visual Slot Editor** — drag & drop + resize slot foto di atas gambar frame,
  dengan auto-scaling, dukungan mouse & touch, toggle orientasi
- ✅ Live Dashboard: saldo awal, total transaksi, beban HPP, tabel transaksi, path folder lokal
- ✅ Deteksi hardware saat startup (printer via Electron, kamera via `enumerateDevices`)
- ✅ Pemblokir kiosk jika hardware tidak terdeteksi + mode bypass troubleshooting
- ✅ Pemilihan kamera & printer spesifik dari dropdown
- ✅ 4 tema warna (Candy, Bumblebee, Neon, Fall) — hot-swap dengan transisi 0.5s
- ✅ Akuntansi HPP → laba bersih, ekspor `Laporan_Keuangan.xlsx` per event

### Presentasi
- ✅ Fullscreen frameless kiosk mode, scrollbar disembunyikan, `user-select: none`
- ✅ Efek CRT scanline + flicker, hard shadow 8-bit, animasi bounce/pulse/blink
- ✅ Dialog retro kustom (mengganti `alert`/`confirm` native) dengan API berbasis Promise

---

## 11. Fitur yang BELUM Ada

### ✅ Sudah diselesaikan di Fase 1

| Fitur | Status |
|---|---|
| **PRINTING** | ✅ `electron/printer.js` — cetak senyap, fallback PDF, retry, status nyata |
| **REPRINT** | ✅ Main process yang mencetak; HP kasir menerima hasil sebenarnya |
| **Midtrans production** | ✅ Toggle `midtrans_is_production` di tab Pembayaran |
| **Autentikasi kasir** | ✅ Token pairing lewat QR + `Authorization: Bearer` |
| **Download token** | ✅ `token_download` dipakai di `/d/:token`, dengan masa berlaku |
| **Pengiriman video** | ✅ Halaman unduhan + format MP4 kompatibel iOS |
| **Upselling cetak tambahan** | ✅ Alur lengkap dengan pembayaran & akuntansi |
| **Ekspor laporan** | ✅ On-demand dari SQLite + otomatis saat event ditutup |
| **Google Drive upload** | ✅ Terimplementasi penuh — bukan lagi simulasi |

### 🔴 Kritis

Tidak ada lagi fitur yang dijanjikan UI tetapi kosong implementasinya. Google Drive
— satu-satunya yang tersisa pada audit sebelumnya — sudah diselesaikan di Task
#16–#18.

> ⚠️ Sisa simulasi: checkbox **"Hapus Backup di Google Drive"** pada dialog hapus
> event masih `console.log("[DRIVE-SIM] ...")`. Penghapusan folder Drive belum
> diimplementasikan.

### ✅ Sudah diselesaikan di Fase 3 & 6

| Fitur | Status |
|---|---|
| **PIN admin** | ✅ Shortcut `Ctrl+Shift+P/T/D` dilindungi scrypt bersalt (Task #5) |
| **Retensi data & auto-purge** | ✅ `retention_days` + purge terjadwal (Task #19) |
| **Consent / privacy notice** | ✅ Layar persetujuan sebelum sesi dimulai (Task #19) |
| **Packaging & distribusi** | ✅ Installer NSIS + portable lewat `npm run dist` (Task #29) — lihat [Bagian 19](#19-packaging--distribusi) |
| **Test suite & CI** | ✅ 475 uji otomatis + CI Windows (Task #24–#27) |

### 🟠 Fitur operasional yang masih hilang

- ~~**Webhook Midtrans**~~ — **dibatalkan setelah ditinjau ulang.** Webhook menuntut
  Midtrans bisa menghubungi mesin kiosk dari internet, sedangkan kiosk duduk di
  belakang NAT jaringan venue tanpa alamat publik. Tanpa server relay, webhook tidak
  akan pernah sampai. **Polling dari main process adalah arsitektur yang tepat di sini.**
- **Kirim hasil via WhatsApp / Email** — umum di photobooth komersial, tidak ada
- **Filter foto / efek** (B&W, sepia, beauty, AR sticker) — tidak ada
- **Refund / void transaksi** — tidak ada
- **Diskon, voucher, kode promo, paket bundling** — tidak ada
- **Laporan lintas event / rekap harian-bulanan** — hanya per event
- **Ekspor CSV/PDF** — hanya XLSX
- **Kalibrasi printer** (margin, cut, DPI, ukuran kertas) — tidak ada
- **Monitoring consumable** (sisa kertas/tinta) — tidak ada
- **Health check / auto-recovery** saat kamera dicabut mid-sesi
- **Auto-update** (`electron-updater`) — installer sudah ada, tetapi belum ada
  mekanisme pembaruan otomatis. Butuh target publikasi dan idealnya code signing
- **Startup otomatis saat booting** — belum dikonfigurasi; untuk kiosk permanen
  ini biasanya diinginkan
- **Logging terstruktur** — hanya `console.log`, tidak ada file log untuk troubleshooting di lapangan
- **Backup / restore database**
- **Multi-bahasa** — hardcode bahasa Indonesia
- **Suara / audio feedback** — tema arcade tanpa SFX; `.speaker-grill` di HP hanya dekoratif

### 🟡 Kualitas rekayasa yang hilang

- ~~**Nol test**~~ — ✅ 475 uji otomatis (Vitest + runner SQLite sendiri).
  ⚠️ Belum mencakup komponen React, Drive sungguhan, dan alur Electron end-to-end
- ~~**Nol CI/CD**~~ — ✅ `.github/workflows/ci.yml` di windows-latest
- ~~**Tidak ada script `lint`**~~ — ✅ `npm run lint` untuk `electron/`, `src/`, `tests/`
- ~~**Tidak ada README**~~ — ✅ `README.md` + `tests/README.md`
- **Tidak ada TypeScript / PropTypes** — `@types/react` terpasang tapi tidak dipakai
- **Riwayat git tidak informatif** — commit terakhir semuanya berjudul `"latest code"`
- **Tidak ada code signing** — installer belum ditandatangani, SmartScreen memperingatkan
  *"Unknown publisher"*. Lihat [Bagian 19](#19-packaging--distribusi)

---

# Bagian D — Audit & Temuan

## 12. Temuan Keamanan

### Ringkasan

| # | Temuan | Severity | Status |
|---|---|---|---|
| S1 | Seluruh HTTP API tanpa autentikasi di `0.0.0.0:3000` | 🔴 Critical | ✅ **Ditutup** (Task #2) — token Bearer wajib di semua `/api/*` |
| S2 | Bypass pembayaran via `/api/verify` dan `/api/remote-retake` | 🔴 Critical | ✅ **Ditutup** (Task #2 + #4) — endpoint tertoken, otorisasi di main, `/api/verify` hanya berlaku untuk tagihan manual yang pending |
| S3 | Foto & video pelanggan dapat diakses siapa pun di LAN | 🔴 Critical | ✅ **Ditutup** (Task #3) — `express.static(OUTPUT_PATH)` dihapus, diganti `/d/:token` per sesi + kedaluwarsa |
| S4 | Midtrans **server key** plaintext + tampil di UI tanpa masking | 🔴 High | ✅ **Ditutup** (Task #5) — `safeStorage` OS keychain, tidak pernah dikirim ke renderer, input `type=password`, hanya 4 digit terakhir yang tampil |
| S5 | Semua aksi state-changing pakai GET → CSRF / drive-by | 🟠 High | ✅ **Ditutup** (Task #2) — POST + auth lewat header, bukan cookie |
| S6 | Stored XSS di halaman `/admin` lewat `customer_name` | 🟠 High | ✅ **Ditutup** (Task #2) — `createElement`/`textContent`, tanpa inline `onclick` |
| S7 | Panel admin kiosk tanpa PIN (physical access) | 🟠 High | ✅ **Ditutup** (Task #5) — gerbang PIN scrypt bersalt + keypad on-screen |
| S8 | Tidak ada CSP, `sandbox`, atau guard navigasi di BrowserWindow | 🟠 Medium | ✅ **Ditutup** (Task #6) — CSP dev+prod, `sandbox: true`, `setWindowOpenHandler` deny, guard `will-navigate` |
| S9 | IPC menerima path filesystem arbitrer dari renderer | 🟠 Medium | ✅ **Ditutup** (Task #6) — `resolveInsideOutput()` pada `save-capture`, `save-video`, `process-images` |
| S10 | Dependency rentan: `xlsx` (no fix), `sharp`, `form-data`, `qs`, `body-parser` | 🟠 Medium | ✅ **Ditutup** (Task #11) — `xlsx` dihapus, `sharp` 0.35.3, sisanya di-patch. Lihat catatan residual di bawah |
| S11 | Midtrans key nyata di `.env` (dead code, tidak dipakai) | 🟡 Medium | 🟨 **Sebagian** — `dotenv` dihapus dari dependencies; **rotasi key & hapus `.env` masih tugas manual operator** |
| S12 | `/api/restart` = DoS tanpa rate limit | 🟡 Medium | ✅ **Ditutup** (Task #2) — 180 req/menit per IP + wajib token |
| S13 | Kepatuhan data pribadi (UU PDP) — video diam-diam, retensi tanpa batas | 🟡 Medium | ✅ **Ditutup** (Task #19) — layar persetujuan menyebut foto **dan video** secara eksplisit, jejak `consent_at` dicatat di main process, retensi otomatis dapat diatur operator |
| S14 | DevTools & shortcut Electron tidak dinonaktifkan di produksi | 🟡 Low | ✅ **Ditutup** (Task #6) — F12 & Ctrl+Shift+I diblokir, `devtools-opened` langsung ditutup |

**Ringkasan: 14 dari 14 temuan ditutup, 1 sebagian (S11), 0 terbuka.**
Seluruh temuan Critical dan High sudah tidak berlaku lagi. Sisa satu-satunya
adalah S11, yang menunggu tindakan manual Anda (rotasi Midtrans key di `.env`).

#### Catatan residual dependency (S10)

`npm audit` masih melaporkan satu advisory: **`brace-expansion` (DoS)** lewat rantai
`exceljs → archiver → archiver-utils → glob@7 → minimatch@3`.

Ini **sengaja tidak dipaksakan**, dengan alasan yang diverifikasi:

- Memaksa `brace-expansion@5` secara global **mematahkan ESLint** — `minimatch@3`
  memakai default export CommonJS yang dihapus di v5. Override sudah dipersempit ke
  subtree `exceljs` (lihat `overrides` di `package.json`), yang menutup satu dari dua
  jalur; jalur kedua ter-dedupe dengan ESLint dan tidak bisa dipisah tanpa memaksa
  `minimatch@9` ke dalam `glob@7` — risiko mematahkan penulisan file Excel.
- **Jalurnya tidak terjangkau.** Kerentanan hanya aktif bila `minimatch`/`glob`
  dipanggil dengan pola brace yang sengaja dibuat jahat. `exceljs` hanya memakai
  `archiver.append()` untuk menyusun zip xlsx — API `archiver.glob()` tidak pernah
  dipanggil, dan kode aplikasi ini tidak memakai glob sama sekali (diverifikasi
  dengan grep).

Bandingkan dengan yang dihapus: `xlsx` punya prototype pollution + ReDoS yang
**benar-benar terjangkau**, karena kode lama mem-parse file Excel dari folder
`Documents` yang bisa diedit siapa pun, pada setiap transaksi.

Kalau nol mutlak di `npm audit` diperlukan, opsinya mengganti laporan ke CSV
(tanpa dependency sama sekali), dengan konsekuensi format file berubah.

### Detail

> Bagian di bawah ini mendeskripsikan **kondisi asli saat audit**, dipertahankan
> sebagai catatan sejarah dan penjelasan mengapa perbaikannya dirancang demikian.
> Status terkini setiap temuan ada di tabel ringkasan di atas.

#### S1 — Seluruh HTTP API tanpa autentikasi 🔴

`expressApp.listen(PORT, '0.0.0.0')` (`main.js:336`) membuka 11 endpoint ke seluruh jaringan.
Tidak ada middleware auth, tidak ada allowlist IP, tidak ada token, tidak ada rate limit.

Siapa pun yang terhubung ke WiFi yang sama (di venue event: **semua tamu**) dapat:
- Membuka `/admin` dan mengendalikan kasir sepenuhnya
- Menutup sesi event yang sedang berjalan (`/api/close`)
- Merestart aplikasi kiosk di tengah sesi pelanggan (`/api/restart`)
- Membaca seluruh riwayat transaksi termasuk nama pelanggan & pendapatan (`/api/history`)
- Membaca nama & tagihan pelanggan yang sedang di layar (`/api/pending`)

**Mitigasi**: bearer token / session cookie yang di-provision lewat QR pairing, bind ke
interface spesifik, allowlist IP kasir, rate limiting.

#### S2 — Bypass pembayaran 🔴

Dua jalur foto gratis tanpa bayar, dapat dipicu oleh siapa pun di LAN:

1. `GET /api/verify` → `mainWindow.webContents.send('remote-verify')` → renderer
   (`App.jsx:284-289`) memeriksa `waitingForPayment` lalu langsung `executeStartSessionTimer()`.
   Berlaku **baik di mode offline maupun online** — jadi pelanggan yang scan QRIS Midtrans
   pun bisa dilewati.
2. `GET /api/remote-retake/:id` → `App.jsx:298-302` men-set `isRemoteRetake = true`,
   yang di `startCustomerPhoto` (`App.jsx:374-380`) **melewati layar nama dan pembayaran
   sepenuhnya**.

Keputusan otorisasi pembayaran sepenuhnya berada di renderer/LAN, tanpa verifikasi
server-side.

#### S3 — Kebocoran foto & video pelanggan 🔴

```js
expressApp.use('/download', express.static(OUTPUT_PATH));
```

`OUTPUT_PATH` berisi **seluruh riwayat semua event**: `raw_N.jpg`, `print-*.png`, dan
`video_session.webm` (rekaman video seluruh sesi) untuk setiap pelanggan yang pernah pakai
mesin ini. Tidak ada auth, tidak ada scoping per sesi, tidak ada expiry.

`Laporan_Keuangan.xlsx` juga berada di dalam `OUTPUT_PATH/<event>/` — artinya
**laporan keuangan bisa diunduh publik** di `/download/<folder_event>/Laporan_Keuangan.xlsx`,
dan nama folder event dapat direkonstruksi dari `/api/history` atau dari format
`YYYY-MM-DD_NamaEvent` yang dapat diduga.

Directory listing memang mati secara default di `express.static`, tapi nama file bukan rahasia
dan `token_download` (yang tampaknya dirancang untuk ini) tidak pernah diimplementasikan.

#### S4 — Midtrans server key terekspos 🔴

- Disimpan plaintext di kolom `settings.midtrans_server_key` (SQLite tanpa enkripsi)
- Ditampilkan di UI dengan `<input type="text">` (`App.jsx:875`), bukan `type="password"`,
  tanpa masking — terlihat penuh di layar kiosk publik saat operator membuka settings
- Server key Midtrans = kewenangan penuh charge, cek status, dan refund atas akun merchant

**Mitigasi**: `safeStorage` Electron atau OS keychain, mask input, tampilkan hanya 4 karakter
terakhir, jangan pernah kirim server key ke renderer (`get-settings` saat ini mengirim
seluruh row termasuk server key ke renderer).

#### S5 — CSRF via GET 🟠

Semua endpoint yang mengubah state adalah `GET` tanpa CSRF token dan tanpa cek `Origin`.
Cukup satu halaman web yang dibuka di HP mana pun di LAN:

```html
<img src="http://192.168.1.50:3000/api/verify">
<img src="http://192.168.1.50:3000/api/close">
```

…untuk memberi sesi gratis atau menutup event. Tidak perlu interaksi kasir.

#### S6 — Stored XSS di `/admin` 🟠

`main.js:220-231` menyusun HTML riwayat dengan `innerHTML +=` dan menginterpolasi
`customer_name` langsung, termasuk **ke dalam atribut `onclick` yang dibungkus kutip tunggal**:

```js
list.innerHTML += `<span>${s.customer_name}</span>
  ... onclick="remoteRetake(${s.id}, '${s.customer_name}')" ...`;
```

Nama pelanggan tersimpan di DB, jadi ini **stored XSS**. Saat ini sebagian tertahan karena
virtual keyboard hanya menghasilkan A–Z dan spasi — tapi itu kontrol UI, bukan kontrol
keamanan: satu kali menambah keyboard fisik, input numerik, atau seeding DB dari sumber lain
akan langsung mengeksploitasi. `/api/pending` juga menyuntikkan `data.name` ke `innerHTML`
(`main.js:163`).

Payload XSS di halaman `/admin` dapat memanggil `/api/verify`, `/api/close`, dan
mengeksfiltrasi seluruh `/api/history` — kompromi penuh sisi kasir.

**Mitigasi**: gunakan `textContent` / `createElement`, atau escape HTML + attribute.

#### S7 — Panel admin tanpa PIN 🟠

`App.jsx:234-237`: `Ctrl+Shift+P/T/D` membuka Global Settings, Template Library, dan Dashboard
tanpa otentikasi apa pun. Pada mesin kiosk publik, siapa pun yang bisa menyentuh keyboard
(atau menghubungkan keyboard USB/BLE) dapat membaca Midtrans server key, mengubah harga,
menghapus event beserta seluruh folder fisiknya (`fs.rmSync` recursive), dan mengubah HPP.

#### S8 — Hardening BrowserWindow kurang 🟠

`contextIsolation`/`nodeIntegration` sudah benar, tetapi tidak ada:
- **Content-Security-Policy** — `index.html` tanpa meta CSP, tidak ada
  `onHeadersReceived` yang menyuntikkan CSP
- `sandbox: true` pada webPreferences
- `setWindowOpenHandler` → `{ action: 'deny' }`
- Handler `will-navigate` untuk memblokir navigasi keluar
- `webSecurity` tidak dinyatakan eksplisit (default aman, tapi sebaiknya eksplisit)

`src/index.css:1` juga melakukan `@import url('https://fonts.googleapis.com/...')` — renderer
memuat resource remote dari internet. Ini juga berarti font gagal dan UI berubah bentuk pada
mesin offline (dan photobooth sering dipakai di venue tanpa internet).

#### S9 — IPC menerima path arbitrer 🟠

```js
ipcMain.handle('save-capture', async (event, { folderPath, base64Data, index }) => {
    fs.writeFileSync(path.join(folderPath, `raw_${index}.jpg`), ...);
});
```

`folderPath` (juga `save-video.folderPath` dan `process-images.sessionFolderAbsolute`) datang
mentah dari renderer tanpa validasi bahwa path berada di dalam `OUTPUT_PATH`. Secara praktik
nilainya berasal dari main process, tapi jika renderer pernah dikompromi (lihat S8 — tanpa CSP),
ini menjadi arbitrary file write dengan hak akses user. `index` juga tidak divalidasi sebagai
integer sehingga bisa mengandung `../`.

**Mitigasi**: simpan session folder sebagai state di main process (mirip
`currentPendingCustomer`) dan jangan pernah terima path dari renderer; atau validasi dengan
`path.resolve(...).startsWith(OUTPUT_PATH)`.

#### S10 — Dependency rentan 🟠

Hasil `npm audit --omit=dev` (6 kerentanan, 4 high):

| Paket | Isu | Status |
|---|---|---|
| `xlsx@0.18.5` | Prototype Pollution (GHSA-4r6h-8v6p-xvw6), ReDoS (GHSA-5pgg-2g8v-p4x9) | **Tidak ada fix di npm** — versi npm SheetJS sudah tidak dirawat |
| `sharp@0.34.5` | Kerentanan libvips (CVE-2026-33327/33328/35590/35591) | Fix di `sharp@0.35.x` (breaking) |
| `form-data` | CRLF injection | `npm audit fix` |
| `qs` | DoS pada `qs.stringify` | `npm audit fix` |
| `body-parser` | DoS saat limit invalid | `npm audit fix` |

`xlsx` paling menonjol karena `process-images` **membaca kembali** file
`Laporan_Keuangan.xlsx` dari disk pada setiap transaksi (`main.js:488`). File itu berada di
folder `Documents` yang bisa diedit user dan **dapat diunduh publik** (S3) — jalur
prototype-pollution yang nyata. Pindah ke `exceljs`, atau `xlsx` dari CDN resmi SheetJS.

#### S11 — Midtrans key di `.env` 🟡

`.env` berisi `MIDTRANS_SERVER_KEY` dan `MIDTRANS_CLIENT_KEY` dengan prefix `Mid-server-` /
`Mid-client-` — **prefix production** (sandbox berawalan `SB-Mid-`).

Hal baiknya: `.env` ada di `.gitignore` dan `git log --all -- .env` kosong — **key belum pernah
masuk ke riwayat git**. `dotenv` juga tercantum di dependencies tapi **tidak pernah
di-`require`** di mana pun, sehingga file ini adalah dead code sepenuhnya.

**Rekomendasi**: karena key production ini duduk plaintext di disk pengembangan dan tidak
berfungsi apa-apa — **rotasi key di dashboard Midtrans**, hapus `.env`, dan hapus
dependency `dotenv`.

#### S12 — DoS tanpa rate limit 🟡

`GET /api/restart` → `window.location.reload()`. Skrip sederhana yang memanggil endpoint ini
berulang membuat kiosk tidak pernah bisa dipakai. Semua endpoint lain juga tanpa rate limit;
`/api/pending` mengeksekusi 2 query SQLite per request.

#### S13 — Kepatuhan data pribadi 🟡

- Seluruh sesi **direkam video** (`MediaRecorder` di `App.jsx:432-439`) — UI tidak pernah
  memberi tahu pelanggan bahwa ada perekaman video, hanya foto yang dikomunikasikan
- Tidak ada layar consent, tidak ada privacy notice, tidak ada opsi opt-out
- Foto, video, dan nama tersimpan permanen tanpa kebijakan retensi atau mekanisme
  penghapusan atas permintaan subjek data
- Data biometrik wajah + nama = data pribadi menurut **UU 27/2022 (PDP)**; ditambah S3
  (akses publik di LAN) ini adalah eksposur kepatuhan yang serius, terutama jika pengguna
  photobooth termasuk anak-anak

---

## 13. Temuan Optimasi & Performa

| # | Temuan | Dampak | Status |
|---|---|---|---|
| P1 | Base64 foto melintasi IPC dua kali | 🔴 Tinggi | ✅ **Diperbaiki** (Task #8) — `toBlob` biner, sekali lintas, path dikirim saat cetak. Payload turun ~63% |
| P2 | `const store = useStore()` — subscribe seluruh store | 🔴 Tinggi | ✅ **Diperbaiki** (Task #9) — selector granular di semua komponen, `App.jsx` 1240 → 199 baris |
| P3 | Excel dibaca-ulang & ditulis-penuh setiap transaksi | 🟠 Sedang | ✅ **Diperbaiki** (Task #10) — on-demand dari SQLite, atomic temp+rename |
| P4 | Transisi CSS global 0.5s di semua elemen | 🟠 Sedang | ✅ **Diperbaiki** (Task #10) — di-scope ke `.theme-switching` (~600ms saat ganti tema) |
| P5 | Overlay CRT dirender dobel & menganimasi terus | 🟠 Sedang | ✅ **Diperbaiki** (Task #9 & #10) — dirender sekali, dipromosikan ke layer compositing |
| P6 | Sync FS + SQLite di main process (blocking) | 🟠 Sedang | 🟨 **Sebagian** — `save-capture`/`save-video` sudah async; sisanya masih sinkron |
| P7 | Polling kasir 2s & Midtrans 3s tanpa backoff | 🟠 Sedang | ✅ **Diperbaiki** (Task #10) — kasir adaptif 2s/5s + berhenti saat layar mati; Midtrans backoff 3→6→12s |
| P8 | `setState` dipanggil saat render | 🟠 Sedang | ✅ **Diperbaiki** (Task #9) — dipindah ke effect dengan guard |
| P9 | Tidak ada indeks DB, tanpa WAL | 🟡 Rendah | ✅ **Diperbaiki** (Task #1 & #3) — indeks `event_id` & `token_download`, WAL aktif |
| P10 | Aset gambar via HTTP `localhost:3000` | 🟡 Rendah | 🟨 **Sebagian** — konsisten ke loopback & dikunci `onlyLoopback`, tapi masih lewat HTTP |
| P11 | Output PNG tanpa kompresi/quantisasi | 🟡 Rendah | ⬜ Terbuka |
| P12 | Dead code: `App.css`, `assets/`, `dotenv`, `qrcode.react` | 🟡 Rendah | ✅ **Diperbaiki** (Task #6) — semuanya dihapus |

**Ringkasan: 9 dari 12 temuan performa diperbaiki, 2 sebagian, 1 terbuka.**

### Detail

#### P1 — Base64 melintas IPC dua kali 🔴

Untuk setiap foto:
1. `canvas.toDataURL('image/jpeg', 0.9)` pada resolusi penuh 1280×720 → string base64 ±350–500 KB
2. Dikirim ke main via `save-capture` → ditulis ke disk
3. **Disimpan juga di state React** (`store.capturedPhotos`) → memicu re-render seluruh App
4. Saat `[CETAK]`, **seluruh array base64 dikirim ulang** ke main via `process-images`
5. Main mem-decode base64 → Buffer → sharp

Untuk template 4-slot itu ±2 MB string yang di-structured-clone lewat IPC dua kali, plus
seluruh array tersimpan di memori renderer, plus salinan di `capturedPhotosRef`.

**Perbaikan**: `save-capture` mengembalikan path file; kirim array path ke `process-images`;
sharp membaca langsung dari disk. Untuk preview, gunakan `canvas.toBlob()` +
`URL.createObjectURL()` daripada data URL base64.

#### P2 — Subscribe seluruh store 🔴

```js
const store = useStore();   // App.jsx:183
```

Zustand tanpa selector = komponen re-render pada **setiap** perubahan state store. Karena
`App` adalah satu komponen 973 baris yang merender seluruh aplikasi, setiap tick (setiap foto
tersimpan, setiap perubahan dialog, setiap fetch) memicu rekonsiliasi seluruh tree —
termasuk elemen `<video>`, preview komposit, dan grid template.

Diperparah: `VirtualKeyboard` dan `RetroDialog` didefinisikan di module scope (baik) tapi
tidak di-`memo`, dan `VirtualKeyboard` di-render ulang pada setiap ketikan nama.

**Perbaikan**: selector granular (`useStore(s => s.currentScreen)`), `useShallow` untuk objek,
pecah `App.jsx` per layar menjadi komponen terpisah.

#### P3 — Excel O(n) per transaksi 🟠

`main.js:487-496`: setiap transaksi membaca ulang seluruh workbook dari disk, mem-parse-nya,
append satu baris, lalu menulis kembali seluruh file secara sinkron. Pada event 500 transaksi,
transaksi ke-500 memparsing 499 baris. Ditambah:

- **Risiko korupsi**: `xlsx.writeFile` tanpa atomic write (tulis ke temp + rename) — mati
  listrik di tengah tulis akan merusak satu-satunya laporan keuangan event
- Menggunakan library yang rentan (S10) pada file yang bisa dimodifikasi dari luar

**Perbaikan**: SQLite adalah sumber kebenaran; generate Excel **on-demand** saat event ditutup
atau saat operator klik ekspor. Jika perlu log berjalan, pakai append-only CSV.

#### P4 — Transisi CSS global 🟠

```css
body, div, p, h1, h2, h3, span, button, input, select {
  transition-property: background-color, border-color, color, box-shadow;
  transition-duration: 0.5s;
}
```

Selector ini mengenai **hampir setiap elemen DOM**. Setiap hover, setiap perubahan state
menghasilkan animasi 500 ms pada `box-shadow` — properti yang tidak di-composite GPU dan
memicu paint. Pada layar review dengan puluhan kotak berbayang, ini adalah penyebab utama
UI terasa berat. Terlihat bahwa developer sudah menyadari ini dan menambal per-komponen
dengan `transition: none !important` di `.slot-box`, `.resize-handle`, `.resize-handle-inner`
(`index.css:94, 98, 103`) — gejala bahwa aturan globalnya terlalu luas.

**Perbaikan**: batasi transisi pada kelas utilitas eksplisit (`.theme-transition`), dan hanya
saat tema benar-benar berganti.

#### P5 — Overlay CRT selalu menganimasi 🟠

`.crt-overlay` adalah elemen fullscreen `position: fixed` dengan `animation: flicker 0.15s
infinite` yang mengubah `opacity` — repaint layer seukuran viewport terus-menerus. Hanya
dipasang di layar `landing` (`App.jsx:735`), tetapi komponen `<ArcadeEffects />` (yang hanya
menyuntikkan `<style>`) dirender **dua kali** — di root (`App.jsx:736`) dan di dalam layar
landing (`App.jsx:549`) — jadi tag `<style>` duplikat masuk ke DOM.

#### P6 — Blocking I/O di main process 🟠

Seluruh `main.js` memakai `fs.existsSync`, `fs.writeFileSync`, `fs.copyFileSync`, `fs.rmSync`,
dan `better-sqlite3` (sinkron by design). Karena main process adalah **jalur tunggal** untuk
seluruh IPC dan event loop window, penulisan JPEG besar atau `fs.rmSync` recursive pada folder
event besar akan **membekukan UI kiosk** di depan pelanggan.

**Perbaikan**: `fs.promises` untuk operasi berat, pindahkan compositing sharp + Excel ke
`utilityProcess`/worker.

#### P7 — Polling tidak efisien 🟠

- HP kasir: `setInterval(fetchPending, 2000)` selamanya — 2 query SQLite + 1 HTTP round-trip
  setiap 2 detik selama event berlangsung berjam-jam, bahkan saat idle
- Midtrans: polling tiap 3 detik tanpa **timeout maksimum** dan tanpa backoff. Jika pelanggan
  meninggalkan layar payment tanpa mengganti screen, interval tetap jalan
  (`App.jsx:414` hanya clear jika `currentScreen !== 'payment'`)
- Tidak ada Server-Sent Events / WebSocket, padahal Express sudah ada dan komunikasi
  main→renderer sudah event-driven

#### P8 — `setState` selama render 🟠

```js
if (!hasPortrait && customerTab === 'portrait') setCustomerTab('landscape');
if (!hasLandscape && customerTab === 'landscape') setCustomerTab('portrait');
```

Dipanggil di body `renderScreen()` (`App.jsx:571-572`), bukan di effect. Ini anti-pattern React;
jika sebuah event tidak punya template portrait maupun landscape, kedua kondisi bisa saling
memicu → **render loop tak berujung**. Juga `JSON.parse(store.activeEvent?.templates_json)`
dijalankan setiap render (`App.jsx:568`) tanpa memo dan tanpa `try/catch`.

#### P9 — DB tanpa indeks & tanpa WAL 🟡

`sessions` di-query dengan `WHERE event_id = ?` di 3 tempat (`main.js:321, 509`) tanpa indeks
→ full table scan. `better-sqlite3` juga tidak dikonfigurasi `PRAGMA journal_mode = WAL` dan
`PRAGMA synchronous = NORMAL`, yang biasanya memberi peningkatan tulis signifikan untuk
beban seperti ini.

#### P10 — Aset lewat HTTP loopback 🟡

Preview template di renderer memakai `http://localhost:3000/templates/${filename}` — hardcode,
padahal `store.serverIP` tersedia dan dipakai di tempat lain (inkonsistensi). Setiap gambar
frame melewati stack HTTP Express alih-alih protokol kustom Electron
(`protocol.handle('app://')`) atau `file://`. Juga berarti **UI rusak total jika port 3000
sudah dipakai proses lain** — dan tidak ada penanganan `EADDRINUSE`: `expressApp.listen`
tanpa handler error akan membuat main process crash saat startup.

> **Status terbaru: sudah ditutup.** Tujuh pemanggilan `localhost:3000` di `src/` kini memakai
> `localUrl()` (`src/localUrl.js`), yang membaca port sungguhan dari main process. Konsekuensi
> HTTP-nya (setiap gambar frame melewati stack Express) sengaja dibiarkan — bukan bug, hanya
> pilihan desain yang belum dinilai ulang.

#### P11 — Output tanpa optimasi 🟡

`sharp(...).png().toFile(outputPath)` tanpa `compressionLevel` / `palette` / `quality`.
PNG 32-bit ukuran cetak (mis. 1200×1800) bisa 5–15 MB — file itulah yang harus diunduh
pelanggan lewat WiFi venue. Untuk cetak memang PNG tepat, tapi sebaiknya sediakan **JPEG
kualitas tinggi terpisah untuk download** dan PNG untuk printer.

#### P12 — Dead code & dependency tak terpakai 🟡

| Item | Keterangan |
|---|---|
| `src/App.css` (184 baris) | Boilerplate Vite, tidak diimport di mana pun |
| `src/assets/hero.png`, `react.svg`, `vite.svg` | Tidak direferensikan |
| `dotenv` | Terpasang, tidak pernah di-`require` |
| `qrcode.react` | Terpasang, tidak pernah diimport (QR dibuat di main pakai `qrcode`) |
| `@types/react`, `@types/react-dom` | Tidak ada TypeScript di proyek |
| `settings.selected_printer` | Ditulis, tidak pernah dibaca |
| `templates.is_free` | Kolom mati (logika gratis pakai `price <= 0`) |
| `sessions.link_gdrive`, `sessions.token_download` | Kolom mati |
| `store.nextScreenAfterPayment` | Di-set di `setupPayment`, tidak pernah dibaca |
| `ipcMain.handle('ping')` | Sisa debug |

---

## 14. Bug Fungsional

| # | Bug | Status |
|---|---|---|
| B1 | Kartu **"Laba Bersih"** di dashboard menampilkan `sisa_saldo`, bukan `laba_bersih` | ✅ **Diperbaiki** (Task #4) — kini menampilkan `laba_bersih`, sisa saldo jadi baris sekunder |
| B2 | `total_beban_hpp` dihitung dengan HPP **saat ini** → laporan historis berubah retroaktif | ✅ **Diperbaiki** (Task #10) — kolom `hpp_snapshot` membekukan HPP per transaksi. Baris lama (sebelum kolom ada) masih jatuh ke HPP saat ini |
| B3 | **Retake membuat baris `sessions` baru dengan harga penuh** → pendapatan ganda | ✅ **Diperbaiki** (Task #4) — `retake_of` + harga 0; dashboard memisahkan penjualan vs retake |
| B4 | Retake mereset timer sesi ke 10 menit penuh | ✅ **Diperbaiki** (Task #30) — tenggat asli dipertahankan + lantai waktu; diuji 14 kasus termasuk skenario terburuk |
| B5 | `sessions.folder_name` menyimpan nama folder **event**, bukan folder sesi | 🟨 **Sebagian** — kolom `session_folder` & `print_path` ditambahkan; `folder_name` masih menyesatkan |
| B6 | `sessions.waktu` TEXT `toLocaleString` — tidak sortable/parseable | ✅ **Diperbaiki** (Task #20) — kolom `created_at_ms` (epoch) ditambahkan; `waktu` tetap ada untuk tampilan |
| B7 | Video direkam tapi tidak pernah diberikan ke pelanggan | ✅ **Diperbaiki** (Task #7) — halaman unduhan + preview di layar hasil |
| B8 | Rekaman retake menimpa file video yang sama | ✅ **Diperbaiki** (Task #7) — penamaan `video_N` ditentukan main process |
| B9 | `getUserMedia` gagal hanya di-`console.error` — pelanggan lihat layar hitam | ✅ **Diperbaiki** (Task #9) — dialog error lalu kembali ke landing |
| B10 | `isProduction: false` di-hardcode | ✅ **Diperbaiki** (Task #4) — toggle di tab Pembayaran |
| B11 | `getLocalIP()` bisa memilih adapter VPN/Hyper-V yang tidak terjangkau HP | ✅ **Diperbaiki** (Task #20) — adapter diberi peringkat (rentang privat diutamakan, APIPA dibuang, 18 pola adapter virtual diturunkan) + override manual di Pengaturan. Diuji 6 skenario: Hyper-V, Tailscale, Docker, WSL, DHCP gagal |
| B12 | `expressApp.listen` tanpa error handler → crash senyap saat port dipakai | ✅ **Diperbaiki** (Task #2) — dialog error yang menjelaskan konsekuensinya |
| B13 | Parameter `eventFolder` dikirim renderer tapi tidak pernah dipakai | ✅ **Diperbaiki** (Task #4) — dihapus saat mengganti `price` → `paymentId` |
| B14 | `store.showDialog` Promise tidak pernah resolve bila dialog kedua menimpa | ✅ **Diperbaiki** (Task #9) — dialog tertimpa di-resolve `false` |
| B15 | `handleAutoFinish` mencetak lembar dengan slot kosong, tetap tercatat bayar penuh | ✅ **Diperbaiki** (Task #20) — sesi tanpa satu pun foto ditolak dan **pembayaran tidak dikonsumsi**, pelanggan diarahkan mengulang. Sesi terisi sebagian dicatat lewat `slots_filled`/`slots_total` |
| B16 | `document.body.className` di-set penuh, menimpa kelas lain | ✅ **Diperbaiki** (Task #20) — hanya kelas `theme-*` yang diganti |
| B17 | Migrasi `ALTER TABLE` menelan semua error | ✅ **Diperbaiki** (Task #1) — hanya `duplicate column name` yang diabaikan |
| B18 | **BARU/regresi** — `token_download` & `link_gdrive` hanya ada di `CREATE TABLE`, tidak pernah punya `ALTER TABLE`. Indeks baru di atas `token_download` membuat aplikasi crash saat startup pada DB lama (`no such column: token_download`). | ✅ **Diperbaiki** — `addColumn` untuk kedua kolom; diverifikasi terhadap simulasi skema lama, idempoten |

| B19 | **BARU/regresi** — `videoFiles` dipakai sebelum dideklarasikan (TDZ), membuat render gagal dengan `Cannot access 'videoFiles' before initialization` | ✅ **Diperbaiki** — urutan dibetulkan; aturan lint `no-use-before-define` diaktifkan agar kelas bug ini tertangkap |
| B20 | `JSON.parse(templates_json)` tanpa try/catch membuat layar pilih frame crash total bila data rusak | ✅ **Diperbaiki** (Task #9) |
| B21 | Effect penyalin `settings` → form menghapus editan operator yang belum disimpan setiap kali settings di-refetch | ✅ **Diperbaiki** (Task #9) — form disemai sekali saat panel dibuka |
| B22 | `validateUpsellQty(1.5)` lolos karena `parseInt('1.5')` menghasilkan `1` — input pecahan diterima diam-diam lalu dipotong | ✅ **Diperbaiki** (Task #25) — **ditemukan oleh uji otomatis**; diganti ke `Number()` + `Number.isInteger()` |
| B23 | Layar Manajemen Sesi terpotong & tidak penuh setelah refactor Task #9 — ia menjadi flex item langsung di container root yang ber-`justify-center`, tanpa `w-full` | ✅ **Diperbaiki** — dijadikan `fixed inset-0 z-10`. **Lolos dari lint, build, dan seluruh uji**; hanya tertangkap QA manual |
| B24 | **BARU** — port Vite (5173) ditulis mati di `package.json`, `vite.config.js`, dan `electron/main.js`. Di laptop yang juga menjalankan proyek lain, Vite **diam-diam pindah ke 5174** sementara Electron tetap membuka 5173: kiosk menampilkan aplikasi orang lain **tanpa satu pun error**. Server lokal juga gagal di `EADDRINUSE` saat 3000 dipakai | ✅ **Diperbaiki** — `electron/ports.js` (policy port tunggal, diuji 16 kasus), orkestrator `scripts/dev.mjs` membeli port bebas lalu meneruskannya lewat env, `strictPort` menggagalkan lompatan diam-diam, CSP memakai wildcard port loopback, dan tujuh `localhost:3000` di `src/` kini lewat `localUrl()`. `Ctrl+C` sekarang juga membersihkan seluruh pohon proses (sebelumnya Vite tetap memegang port untuk `npm run dev` berikutnya) |

**Ringkasan: 23 dari 24 bug diperbaiki, 1 sebagian (B5), 0 terbuka.**

| Bug | Status | Catatan |
|---|---|---|
| B4 | ✅ Diperbaiki | Retake **tidak lagi memperpanjang sesi**; ia mempertahankan tenggat asli dengan jaminan waktu minimum agar retake tetap dapat diselesaikan. Skenario terburuk turun dari ~40 menit menjadi ≤15 menit. Durasi sesi & lantai waktu dapat diatur operator |
| B5 | 🟨 Sebagian | `folder_name` masih menyimpan nama folder event; kolom `session_folder` & `print_path` sudah ditambahkan sebagai penggantinya |
| B12 | ✅ | — |
| B18–B23 | ✅ | Ditemukan & diperbaiki selama pengerjaan. B22 ditemukan uji otomatis; B23 (tata letak) hanya tertangkap QA manual — bukti bahwa keduanya saling melengkapi |
| B24 | ✅ | **Ditemukan saat `npm run dev` gagal di laptop yang menjalankan beberapa proyek sekaligus.** Tidak ada satu pun pengujian yang menangkapnya — build, lint, dan 447 uji semuanya hijau. Kegagalan hanya muncul saat dua proses benar-benar berebut port, yaitu kondisi yang tidak pernah dibuat oleh uji otomatis |

Tidak ada lagi bug yang menunggu keputusan produk. Yang tersisa hanya sebagian B5
(`folder_name` menyimpan nama folder event sehingga namanya menyesatkan) — ini soal
kerapian data, bukan gangguan operasional: `session_folder` dan `print_path` sudah
menjadi sumber kebenaran, dan `folder_name` dipertahankan agar baris lama tetap terbaca.

---

# Bagian E — Rencana & Tindakan

## 15. Rencana: Integrasi Website Vendor

> **Status: rencana, belum diimplementasikan.** Bagian ini adalah rancangan yang
> disepakati untuk dikerjakan berikutnya, ditulis agar keputusan desainnya tidak
> hilang dan agar vendor bisa menyiapkan sisi website lebih dulu.

### Tujuan

Setiap pemilik aplikasi (vendor) punya website sendiri. Mereka harus bisa
menyambungkan kiosk ke website itu supaya data foto mengalir ke sistem mereka —
untuk galeri pelanggan, CRM, atau apa pun yang mereka bangun. Ini juga jalur yang
akan **menggantikan peran unduhan lokal** yang kini dinonaktifkan di mode online.

### Mengapa push, bukan pull

Kiosk duduk di belakang NAT jaringan venue tanpa alamat publik. Website vendor
**tidak bisa** menghubungi kiosk. Karena itu arahnya harus **kiosk mendorong data
keluar** (webhook), bukan website menariknya.

Alasan yang sama membuat webhook Midtrans tidak cocok untuk arsitektur ini — dan
itulah sebabnya status pembayaran tetap dipoll dari main process.

### Bentuk integrasi

Tiga pengaturan baru per aplikasi:

| Pengaturan | Isi |
|---|---|
| `webhook_url` | Endpoint HTTPS milik vendor |
| `webhook_secret` | Kunci rahasia bersama, disimpan terenkripsi lewat `safeStorage` |
| `webhook_enabled` | Sakelar aktif/nonaktif |

### Kontrak payload

`POST <webhook_url>` dengan `Content-Type: application/json`:

```json
{
  "event": "session.completed",
  "delivery_id": "d7f3a9c1e5b24680",
  "timestamp": "2026-07-27T14:05:00.000Z",
  "kiosk": { "id": "kiosk-a1b2c3", "app_version": "1.0.0" },
  "session": {
    "id": 128,
    "customer_name": "Ani Wijaya",
    "created_at": "2026-07-27T14:03:11.000Z",
    "slots_filled": 4,
    "slots_total": 4,
    "print_qty": 1,
    "status_cetak": "TERCETAK",
    "payment": { "method": "midtrans", "amount": 15000, "kind": "sale" },
    "drive": {
      "folder_url": "https://drive.google.com/drive/folders/...",
      "photo_url": "https://drive.google.com/file/d/.../view",
      "video_urls": ["https://drive.google.com/file/d/.../view"]
    }
  },
  "event_info": { "id": 7, "nama_event": "Pesta Ultah", "folder_url": "https://..." }
}
```

Payload sengaja **membawa link Drive, bukan berkas mentah**. Ukurannya kecil
(< 2 KB), sehingga pengiriman cepat dan hemat kuota; vendor mengambil berkasnya
dari Drive bila perlu.

Untuk vendor yang tidak memakai Drive, disediakan mode kedua:
`multipart/form-data` dengan berkas foto terlampir. Dipilih lewat setelan
`webhook_payload_mode` (`links` | `files`).

### Autentikasi & anti-pemalsuan

Mengikuti pola yang sudah lazim (Stripe, GitHub):

```
X-SayGumi-Signature: sha256=<hex HMAC-SHA256 dari raw body memakai webhook_secret>
X-SayGumi-Timestamp: <epoch detik>
X-SayGumi-Delivery: <delivery_id>
```

Vendor memverifikasi dengan menghitung ulang HMAC atas **raw body** (bukan hasil
parse JSON) dan membandingkannya secara waktu-tetap. Timestamp dipakai menolak
replay: tolak bila selisihnya lebih dari 5 menit.

Kiosk hanya menerima endpoint **HTTPS** — tanpa TLS, secret dan data pelanggan
terkirim terbuka.

### Idempotensi

`delivery_id` bersifat tetap per sesi. Karena antrean melakukan retry, satu sesi
bisa terkirim lebih dari sekali. **Vendor wajib memperlakukan `delivery_id` yang
sama sebagai duplikat** dan mengabaikannya.

### Kontrak respons

| Respons vendor | Perlakuan kiosk |
|---|---|
| `2xx` | Sukses, antrean dibersihkan |
| `4xx` (selain 408/429) | Gagal permanen — tidak diulang, ditandai `failed` |
| `408`, `429`, `5xx`, timeout, koneksi gagal | Diulang dengan backoff |

Backoff: 30 detik → 2 menit → 10 menit → 30 menit → 2 jam, maksimal 8 kali.
Timeout permintaan 30 detik.

### Antrean

Memakai pola yang sama dengan antrean Drive: tabel `webhook_queue` di SQLite
sehingga **bertahan melewati restart dan mati listrik**, dengan worker latar
belakang. Acara offline menumpuk antrean, lalu terkirim sendiri saat internet
kembali.

### Peristiwa yang dikirim

| Peristiwa | Kapan |
|---|---|
| `session.completed` | Lembar selesai dirender |
| `session.printed` | Status cetak final (berhasil/gagal) |
| `upsell.completed` | Cetak tambahan dibayar & dicetak |
| `event.closed` | Sesi event ditutup, disertai ringkasan omzet |

### Perkakas untuk vendor

- Tombol **[ KIRIM TEST PAYLOAD ]** di Pengaturan yang mengirim `session.completed`
  berisi data contoh, menampilkan status HTTP dan isi respons — supaya vendor bisa
  memastikan endpoint mereka benar tanpa menunggu pelanggan sungguhan.
- **Riwayat pengiriman** (20 terakhir): waktu, peristiwa, status HTTP, jumlah
  percobaan, galat terakhir.
- **Cuplikan kode verifikasi** HMAC dalam PHP, Node.js, dan Python untuk
  ditempelkan vendor ke website mereka.

### Yang perlu diputuskan sebelum implementasi

1. Apakah `session.completed` dikirim **sebelum** unggahan Drive selesai (link
   sudah ada tapi berkas mungkin belum), atau **setelah** semua berkas terunggah?
   Yang pertama lebih cepat, yang kedua lebih pasti.
2. Apakah vendor boleh mendaftarkan lebih dari satu endpoint?
3. Perlukah kiosk mengirim ulang data historis saat endpoint baru dipasang
   (*backfill*), atau hanya sesi baru?

---

## 16. Rekomendasi Berprioritas

### Fase 1 — Blocker produksi (harus sebelum dipakai komersial)

1. ✅ **Implementasikan printing** — `electron/printer.js`, cetak senyap ke
   `settings.selected_printer`, status nyata, retry manual, fallback PDF untuk QA.
2. ✅ **Autentikasi HTTP API** — token pairing lewat QR, `Authorization: Bearer`,
   semua aksi jadi POST, rate limit.
3. ✅ **Amankan `/download`** — `token_download` diimplementasikan sebagai `/d/:token`
   dengan masa berlaku. `express.static(OUTPUT_PATH)` dihapus total, sehingga
   `Laporan_Keuangan.xlsx` tidak lagi terekspos meski tetap berada di folder event.
4. ✅ **Otorisasi pembayaran server-side** — harga dari DB, status dari main process,
   gerbang otorisasi di `process-images`, transaksi sekali pakai.
   ⚠️ **Webhook + verifikasi signature SHA512 masih belum ada** — polling tetap dipakai,
   hanya saja sekarang dilakukan main process, bukan renderer.
5. ✅ **Perbaiki XSS di `/admin`** — `createElement`/`textContent`, tanpa inline `onclick`.
6. ✅ **Enkripsi & mask Midtrans server key** — `safeStorage`, key tidak pernah dikirim
   ke renderer, hanya bentuk tersamarnya. Key plaintext lama dienkripsi saat startup.
7. ✅ **PIN admin** untuk `Ctrl+Shift+P/T/D` dan tombol `[ PENGATURAN ]` — scrypt bersalt,
   keypad on-screen, terkunci ulang setiap panel ditutup.
8. ✅ **Packaging** — `electron-builder` menghasilkan installer NSIS + portable
   (`npm run dist`). ⬜ Auto-update dan code signing belum ada.
9. 🟨 **Rotasi Midtrans key** — `dotenv` sudah dihapus dari dependencies; rotasi key dan
   penghapusan `.env` masih tugas manual operator.

**Sisa Fase 1: rotasi key (poin 9), serta code signing & auto-update (poin 8).**
Webhook Midtrans (poin 4) **dibatalkan** — lihat alasannya di Bagian 11.

### Tambahan hardening yang sudah terpasang (Task #6)

- **CSP dua jalur** — `onHeadersReceived` untuk halaman dev (HTTP), dan `<meta>` yang
  disuntikkan plugin Vite untuk build produksi. Ini perlu karena produksi memuat halaman
  lewat `file://` yang tidak punya response header, sehingga `onHeadersReceived` tidak
  pernah berlaku di sana. Kedua policy harus dijaga sinkron.
- **`sandbox: true`** pada renderer — aman karena preload hanya memakai `contextBridge`
  dan `ipcRenderer`.
- **`setWindowOpenHandler` → deny** dan guard **`will-navigate`**.
- **DevTools diblokir di produksi** (F12, Ctrl+Shift+I, dan `devtools-opened`).
- **Validasi path IPC** — `resolveInsideOutput()` memastikan `save-capture`, `save-video`,
  dan `process-images` tidak bisa menulis di luar `Photobooth_Output`.
- **Font Press Start 2P di-self-host** (OFL) — menghapus permintaan jaringan keluar dari
  renderer, sekaligus memperbaiki tata letak UI yang dulu rusak di venue tanpa internet.
  Satu salinan di-bundle Vite untuk kiosk, satu dilayani Express di `/fonts` untuk HP kasir.
- **Dead code dihapus** — `dotenv`, `qrcode.react`, `src/App.css`, dan aset boilerplate Vite.

### Fase 2 — Stabilitas & performa ✅ SELESAI

10. ✅ **Hilangkan double-IPC base64** — `toBlob` biner, path dikirim saat cetak.
11. ✅ **Selector Zustand + pecah `App.jsx`** — 1240 → 199 baris, 22 file.
12. ✅ **Excel on-demand dari SQLite**, dengan `hpp_snapshot` per transaksi.
13. ✅ **Transisi CSS di-scope** dan overlay CRT dipromosikan ke layer compositing.
14. ✅ **CSP, sandbox, guard navigasi** (sudah di Fase 1).
15. ✅ **Font Press Start 2P di-self-host** (sudah di Fase 1).
16. ✅ **Validasi path IPC** (sudah di Fase 1).
17. ✅ **Upgrade dependency** — `xlsx` dihapus, `sharp` 0.35.3. Residual dijelaskan di Bagian 11.
18. ✅ **Indeks DB + WAL**.
19. ✅ **Error handler `EADDRINUSE`**; ⬜ pemilihan interface jaringan manual (B11) belum.
20. ✅ **B1, B2, B3 diperbaiki** — akuntansi sudah benar.

### Fase 3 — Integrasi & kelengkapan produk ✅ SEBAGIAN SELESAI

21. ✅ **Video diberikan ke pelanggan** — halaman unduhan + MP4 kompatibel iOS.
22. ✅ **Upselling cetak tambahan** — alur pembayaran & akuntansi lengkap.
23. ✅ **Google Drive upload sungguhan** — OAuth PKCE, folder per pelanggan,
    antrean tahan offline. Bukan lagi simulasi.
24. ✅ **Stabilisasi bug lapangan** — B11 (IP salah adapter), B15 (sesi kosong
    ditagih penuh), B6, B16.
25. ✅ **Unduhan lokal dinonaktifkan di mode online** — beban jaringan venue
    berpindah ke Drive.
26. ✅ **Rancangan integrasi website vendor** — kontrak payload, HMAC, antrean,
    idempotensi. Lihat [Bagian 15](#15-rencana-integrasi-website-vendor).
27. ❌ ~~**Webhook Midtrans**~~ — **dibatalkan**, tidak cocok untuk kiosk di
    belakang NAT. Polling dari main process adalah arsitektur yang benar.

### Fase 4 — Sisa pekerjaan

28. ⬜ **Implementasi integrasi website vendor** — rencananya sudah siap.
30. 🟨 **Packaging** — `electron-builder` menghasilkan installer NSIS + portable
    ([Bagian 19](#19-packaging--distribusi)). Tersisa code signing dan auto-update.
31. ⬜ **Penghapusan folder Drive** saat event dihapus (kini masih `[DRIVE-SIM]`).
32. ⬜ **Filter foto, voucher/diskon, kirim via WhatsApp.**
33. ⬜ **Logging file terstruktur** untuk troubleshooting di lapangan.
34. ✅ **Test suite + CI** — 475 uji otomatis lewat `npm run verify`, berjalan di
    CI Windows. Lihat [Bagian 18](#18-pengujian-otomatis).
    ⚠️ Belum mencakup komponen React, panggilan Drive sungguhan, dan alur Electron.
35. 🟨 **README** — `README.md` utama dan `tests/README.md` sudah ada.
    Tersisa konvensi commit message yang bermakna (riwayat masih "latest code").

---

# Bagian F — Operasional

## 17. Menjalankan Proyek

```powershell
npm install            # menjalankan electron-rebuild untuk better-sqlite3
npm run dev            # Vite + Electron (NODE_ENV=development)
npm run build          # build Vite → dist/ (renderer saja)
npm run lint           # ESLint untuk electron/, src/, dan tests/
npm test               # 447 uji logika murni
npm run test:db        # 28 uji database (lewat runtime Electron)
npm run verify         # lint + seluruh uji + build  ← dipakai CI
npm run test:app       # menyalakan aplikasi sungguhan & memeriksanya (±3 menit)
npm run pack           # build tidak terpaket → release/win-unpacked/ (cepat, untuk uji)
npm run dist           # installer siap edar → release/
```

Rincian pengujian ada di [Bagian 18](#18-pengujian-otomatis); rincian packaging
ada di [Bagian 19](#19-packaging--distribusi).

Mode produksi memuat `dist/index.html` lewat `loadFile`.

**Prasyarat**: toolchain build native Windows untuk `better-sqlite3` (`sharp` 0.35
memakai binary prebuilt lewat `@img/sharp-win32-x64`). Port `3000` harus bebas.

**Catatan `overrides`**: `package.json` memuat blok `overrides` yang mempersempit
versi `brace-expansion` dan `uuid` **khusus di subtree `exceljs`**. Jangan menaikkannya
menjadi override global — `brace-expansion@5` menghapus default export CommonJS dan
akan mematahkan ESLint. Penjelasan lengkap ada di Bagian 11.

**PIN admin default** adalah `1234`, dipasang otomatis saat pertama kali dijalankan.
Panel Pengaturan menampilkan peringatan merah selama PIN masih default.

---

---

## 18. Pengujian Otomatis

### Perintah

```bash
npm test          # 447 uji logika murni (Vitest)
npm run test:watch
npm run test:db   # 28 uji database (runtime Electron)
npm run test:all  # keduanya — 475 uji
npm run verify    # lint + seluruh uji + build  ← dipakai CI
npm run test:app  # daftar periksa aplikasi sungguhan — DISENGAJA, bukan otomatis
```

### Kenapa ada dua runner

`better-sqlite3` dikompilasi untuk **ABI Electron**, bukan Node biasa.
Mengimpornya dari Vitest gagal dengan `NODE_MODULE_VERSION mismatch`.

| Runner | Jumlah | Menguji | Lingkungan |
|---|---|---|---|
| **Vitest** (`tests/*.test.js`) | 152 | Logika murni tanpa database | Node |
| **Runner sendiri** (`tests/db/`) | 28 | Skema & query SQLite | Electron (`ELECTRON_RUN_AS_NODE=1`) |

Runner database ditulis tanpa framework (±60 baris di `tests/db/run.js`) agar
tidak menambah dependency hanya demi beberapa berkas uji.

### Cakupan

| Berkas | Fokus | Menjaga temuan |
|---|---|---|
| `drive.test.js` | PKCE, URL otorisasi OAuth, sanitasi nama folder, deteksi MIME | — |
| `drive-folder-id.test.js` | Menerima URL folder Drive yang ditempel, bukan hanya ID mentah | — |
| `riwayat.test.js` | Undo/redo Visual Slot Editor: batas tumpukan, cabang baru setelah undo | — |
| `download-page.test.js` | **Escaping XSS** halaman publik, panel Drive, masa berlaku | S6 |
| `admin-format.test.js` | Format Rupiah kasir, status cetak, sanitasi tema, penyaringan riwayat | — |
| `admin-page.test.js` | Rangka kasir tetap statis; skrip browser bebas seluruh sink HTML; tiap tab dibangun lewat DOM API | S6 |
| `remote.test.js` | Daftar putih aksi dari HP kasir + pemisahan mana yang wajib PIN | S1, S7 |
| `status.test.js` | Ambang disk, deteksi printer hilang, antrean macet, urutan keparahan | — |
| `secrets.test.js` | Hash PIN bersalt, penolakan PIN salah, masking rahasia | S4, S7 |
| `format.test.js` | Formatter Rupiah dua arah | — |
| `network.test.js` | Pemilihan adapter: Hyper-V, VPN, Docker, WSL, APIPA | B11 |
| `pricing.test.js` | Aturan harga upsell, validasi jumlah, metode bayar | S2, B3 |
| `session.test.js` | Tenggat sesi & perilaku retake, termasuk batas perpanjangan | B4 |
| `keyboard.test.js` | Tata letak & penerapan tombol keyboard on-screen, termasuk rangkaian ketikan nyata | — |
| `pintasan.test.js` | Peta pintasan, deteksi bentrok antar aksi & dengan pintasan sistem, pemulihan dari JSON rusak | — |
| `db/migration.test.js` | Migrasi skema lama, idempotensi, penanganan galat, default saklar `settings` | B17, B18 |
| `db/retention.test.js` | Seleksi auto-purge | S13 |

### Prinsip yang dipakai

**Uji menyasar aturan bisnis dan bug yang pernah benar-benar terjadi**, bukan
mengejar cakupan baris. Setiap berkas menyebutkan temuan audit yang ia jaga,
sehingga jelas kenapa uji itu ada dan kapan boleh dihapus.

Beberapa uji sengaja membuktikan dirinya bermakna. Contohnya
`indeks GAGAL bila migrasi dilewati` memastikan uji migrasi tidak lulus secara
kebetulan — tanpa itu, uji migrasi bisa saja hijau padahal migrasinya tidak
melakukan apa-apa.

Tiga aturan yang paling dijaga karena konsekuensinya paling mahal:

1. **Escaping XSS** pada halaman yang dibuka publik — jalur yang sama dengan S6.
2. **Migrasi dari skema lama** — kelas bug B18 membuat aplikasi crash saat startup.
3. **Auto-purge tidak boleh menghapus sesi yang unggahannya belum selesai** —
   ini kehilangan permanen, bukan sekadar merepotkan.

### Bug yang ditemukan oleh uji

`validateUpsellQty(1.5)` semula **lolos**: `parseInt('1.5')` menghasilkan `1`,
sehingga input pecahan diterima diam-diam lalu dipotong. Tidak berbahaya, tetapi
validasi yang memotong tanpa memberi tahu menyembunyikan kesalahan pemanggil.
Diperbaiki memakai `Number()` + `Number.isInteger()`.

### Dampak pada arsitektur

Agar dapat diuji, logika harus keluar dari `main.js` yang membutuhkan runtime
Electron. Dua modul baru lahir dari sini — `network.js` dan `pricing.js` —
keduanya murni, menerima data sebagai argumen alih-alih mengakses database
sendiri. Efek sampingnya `main.js` ikut mengecil.

### CI

`.github/workflows/ci.yml` berjalan pada **windows-latest**, bukan Ubuntu.
Aplikasi ini menyasar Windows dan `better-sqlite3` dikompilasi per platform —
CI di Linux akan menguji lingkungan yang bukan lingkungan produksi.

Urutan langkahnya: pasang dependency → rebuild modul native → lint → uji murni →
uji database → build → audit.

Audit dependency **dilaporkan tetapi tidak menggagalkan CI**, karena satu
advisory transitif yang tersisa (`brace-expansion` lewat `exceljs`) sudah
ditinjau dan terbukti tidak terjangkau — lihat [Bagian 12](#12-temuan-keamanan).

### ⚠️ Yang BELUM tercakup

Bagian ini penting agar tidak muncul rasa aman yang keliru:

| Area | Status | Konsekuensinya |
|---|---|---|
| **Komponen React & tata letak** | 🟨 | Bug layar Manajemen Sesi yang terpotong (regresi refactor Task #9) **tidak akan tertangkap** uji otomatis di sini. Sebagian celah ini ditutup [daftar periksa manual](#18b-daftar-periksa-aplikasi-sungguhan) yang memuat bundel React di Electron dan memeriksa DOM — tetapi ia **dijalankan sengaja lewat `npm run test:app`**, bukan otomatis |
| **Panggilan Google Drive sungguhan** | ❌ | Hanya fungsi murninya yang diuji; pertukaran token, pembuatan folder, dan unggahan belum pernah menyentuh Google |
| **Alur Electron end-to-end** | ❌ | IPC, pencetakan, kamera, MediaRecorder hanya terverifikasi lewat QA manual |
| **Integrasi Midtrans** | ❌ | Belum ada uji terhadap sandbox |

Kesimpulannya: **test suite ini menjaga logika dan data, bukan tampilan dan
integrasi.** Sebagian celah itu kini ditutup daftar periksa di bawah.

---

## 18b. Daftar Periksa Aplikasi Sungguhan

```bash
npm run test:app     # ±3 menit
```

Lima pemeriksaan yang **benar-benar menyalakan aplikasi, menekan tombolnya,
lalu memeriksa DOM yang dihasilkan.** Naskahnya di `tests/manual/`, petunjuk
lengkapnya di [`tests/manual/README.md`](tests/manual/README.md).

| Berkas | Yang dibuktikan |
|---|---|
| `perintah-hp.js` | Tombol di HP **memunculkan gerbang PIN**, isi panel tidak bocor sebelum PIN benar, tema berputar & tersimpan |
| `tab-aksesibilitas.js` | Saklar keyboard bawaannya mati dan nilainya benar-benar ikut tersimpan |
| `keyboard-layar.js` | Ketikan masuk ke **state React**, dibuktikan dengan memaksa render ulang |
| `pintasan-keyboard.js` | Pintasan baru berlaku, yang lama berhenti, bentrok menolak penyimpanan |
| `xss-halaman-kasir.js` | Muatan jahat tampil sebagai teks di keempat tab dan tidak satu pun dieksekusi |

### Kenapa terpisah dari `npm run verify`

Bukan karena kurang penting — justru sebaliknya. Alasannya **keandalan alarm**.

Pemeriksaan ini membuka jendela sungguhan, dan itu sesekali gagal karena sebab
di luar aplikasi: kompositor GPU menolak melukis, jendela tersembunyi
mengembalikan gambar basi, port 3000 masih dipegang instans lain. Ketiganya
benar-benar terjadi saat pengembangannya.

Alarm yang sering keliru akan berhenti dipercaya — termasuk saat alarmnya
benar. Menaruh pemeriksaan yang rewel di jalur yang dilihat setiap hari justru
melatih orang mengabaikan laporan merah. Karena itu ia dijalankan **sengaja**,
saat mau merilis, dengan README yang menjelaskan cara membedakan kegagalan
sungguhan dari alarm palsu.

Bila penyebab kerewelannya suatu saat tertutup, memindahkannya ke CI tinggal
menambah satu langkah di `.github/workflows/ci.yml`.

### Yang tetap tidak tercakup

Pemeriksaan ini memakai `electronAPI` tiruan, jadi ia **tidak** menyentuh
database, kamera, printer, Google Drive, maupun Midtrans sungguhan. Ia
membuktikan **antarmuka dan alur perintahnya benar**, bukan perangkat
kerasnya. Untuk itu, QA manual tetap satu-satunya jaring pengaman.

---

## 19. Packaging & Distribusi

### Perintah

```bash
npm run pack     # build tidak terpaket ke release/win-unpacked/ — cepat, untuk uji
npm run dist     # installer siap edar ke release/
```

Keduanya menjalankan `npm run build` lebih dulu, karena renderer harus sudah
ter-build sebelum dipaketkan.

### Apa itu "installer NSIS"? (penjelasan untuk yang awam)

Kalau Anda pernah memasang aplikasi di Windows — Chrome, WhatsApp Desktop,
Photoshop — Anda pasti pernah membuka berkas bernama `Setup.exe`, lalu muncul
jendela yang bertanya *"Mau dipasang di folder mana?"*, Anda tekan **Next → Next
→ Install**, tunggu bar hijau, selesai, dan tiba-tiba ada ikon baru di Desktop.

**Jendela itulah yang disebut installer.** Ia bukan aplikasinya, melainkan
"petugas pemasangan": sebuah program kecil yang tugasnya menyalin berkas aplikasi
ke tempat yang benar, membuat shortcut, dan mendaftarkan aplikasi ke Windows.

**NSIS** (*Nullsoft Scriptable Install System*) adalah **alat untuk membuat
petugas pemasangan itu**. Ia gratis, sudah dipakai puluhan tahun, dan menghasilkan
wizard `Setup.exe` klasik yang tadi dijelaskan. Jadi:

> **"Installer NSIS"** = berkas `Setup.exe` yang memasang aplikasi ke komputer,
> dibuat memakai alat bernama NSIS.

Anda **tidak perlu memasang atau mempelajari NSIS**. `electron-builder` sudah
memanggilnya sendiri di balik layar saat Anda mengetik `npm run dist`. Anda cukup
tahu bahwa hasil berkas `Setup.exe` itu berasal dari sana.

#### Analogi

Bayangkan aplikasi ini adalah **perabot lemari IKEA**:

| | Analogi | Di proyek ini |
|---|---|---|
| **Installer NSIS** | Tukang yang datang ke rumah, merakit lemari, memasangnya ke dinding, dan membuang kardusnya | `Setup.exe` — menyalin berkas ke folder program, membuat shortcut, mendaftar ke Windows |
| **Portable** | Kardus yang Anda buka sendiri lalu pakai apa adanya, tanpa dipasang ke dinding | `portable.exe` — klik, langsung jalan, tidak menempel ke sistem |

Keduanya berisi **aplikasi yang sama persis**. Yang berbeda hanya cara ia mendarat
di komputer.

### Dua bentuk keluaran

| Berkas | Ukuran | Bentuk |
|---|---|---|
| `SayGumi Photobooth Setup 1.0.0.exe` | ~105 MB | Installer NSIS |
| `SayGumi-Photobooth-1.0.0-portable.exe` | ~105 MB | Portable, tanpa instalasi |

Ukurannya besar karena setiap aplikasi Electron membawa **mesin browser Chromium
sendiri** ke dalam berkasnya. Itu wajar dan bukan tanda ada yang salah — Discord,
Slack, dan VS Code berukuran sekelas ini karena alasan yang sama.

| | Installer NSIS | Portable |
|---|---|---|
| Cara pakai | Dipasang sekali, jalan dari Start Menu | Klik langsung |
| Shortcut desktop & Start Menu | ✅ Dibuat otomatis | ❌ |
| Muncul di Add/Remove Programs | ✅ Bisa di-uninstall rapi | ❌ |
| Lokasi berkas | Permanen di folder pilihan | Diekstrak ke folder sementara tiap dijalankan |
| Waktu buka | Cepat | Lebih lambat — perlu mengekstrak dulu tiap kali |
| Bisa diatur menyala saat booting | ✅ | Sulit |
| Cocok untuk | **Mesin photobooth permanen** | Uji coba, pindah mesin, flashdisk |

Untuk kiosk yang menyala seharian di venue, **yang dipakai adalah installer NSIS**.
Bentuk portable disediakan untuk keperluan sekali jalan: mencoba di laptop lain,
demo ke calon klien, atau memeriksa sesuatu di mesin cadangan tanpa mengotori
sistemnya.

### Cara memasangnya di mesin photobooth

1. Salin `SayGumi Photobooth Setup 1.0.0.exe` ke mesin (flashdisk atau jaringan).
2. Klik dua kali. Windows SmartScreen akan menampilkan peringatan biru
   *"Windows protected your PC"* — ini **normal**, penyebabnya dijelaskan di
   bagian *Yang belum* di akhir bab ini. Tekan **More info → Run anyway**.
3. Pilih folder instalasi bila ingin memindahkannya, lalu **Install**.
4. Buka aplikasi dari shortcut Desktop.
5. Tekan `Ctrl+Shift+P`, masukkan PIN bawaan `1234`, lalu **segera ganti PIN**
   dan isi pengaturan printer, kamera, Midtrans, dan Google Drive.
   Pada mode online, sesi tidak bisa dimulai sebelum akun Drive tertaut.

Untuk memperbarui ke versi baru: jalankan `Setup.exe` versi baru di atas yang lama.
Data operator (database, template, hasil foto) **tidak tersentuh** karena berada di
folder terpisah — lihat [lokasi data](#lokasi-data-pada-aplikasi-terpaket) di bawah.

### Keputusan konfigurasi

| Setelan | Nilai | Alasan |
|---|---|---|
| `oneClick` | `false` | Kiosk dipasang teknisi, bukan pengguna akhir — mereka perlu memilih lokasi instalasi |
| `perMachine` | `false` | Instalasi per pengguna tidak menuntut hak administrator. Konsekuensinya lokasi bawaan adalah `%LOCALAPPDATA%\Programs\`, bukan `Program Files` |
| `deleteAppDataOnUninstall` | `false` | **Uninstall tidak menghapus database, template, dan hasil foto.** Menghapusnya berarti menghilangkan riwayat transaksi operator |
| `asar` | `true` | Kode aplikasi dibungkus satu arsip |
| `npmRebuild` | `true` | Modul native dibangun ulang untuk ABI Electron target |

### Tiga jebakan yang ditangani

**1. Modul native rusak di dalam asar.** `better-sqlite3` dan `sharp` memuat berkas
biner `.node` yang **tidak dapat dibaca dari dalam arsip asar**. Tanpa di-unpack,
aplikasi mati saat startup dengan galat *"cannot open .node file"*. Ditangani lewat
`asarUnpack`.

**2. Kredensial OAuth ada di `.gitignore` tetapi wajib terbundel.**
`electron/oauth-credentials.json` tidak masuk repo, tetapi harus ikut ke dalam exe —
tanpanya klien terpaksa membuka Google Cloud Console sendiri, yang justru ingin
dihindari. Pola `files` sudah mencakupnya.

**3. Font untuk HP kasir.** Dilayani lewat `express.static`; streaming dari asar
tidak selalu andal, jadi `electron/assets/**` ikut di-unpack.

### Lokasi data pada aplikasi terpaket

Electron menurunkan folder data dari **`name` di `package.json`**, bukan dari
`productName`. Jadi meskipun aplikasi bernama "SayGumi Photobooth", datanya tetap
berada di:

```
%APPDATA%/photobooth-v2/           database, template, QR statis
Documents/Photobooth_Output/       hasil foto, video, laporan
```

Konsekuensinya: **mode pengembangan dan aplikasi terpaket memakai data yang sama.**
Ini disengaja agar data tidak yatim, tetapi berarti dua instans **dari aplikasi ini**
tidak boleh berjalan bersamaan — keduanya akan berebut port 3000 dan berkasnya.
Perhatikan bahwa ini bukan bentrok dengan proyek lain di laptop: port yang dipakai
proses apa pun otomatis dilepas (lihat bug B24). Yang perlu dihindari hanya
menjalankan dua salinan SayGumi! sekaligus, karena keduanya memakai database yang sama.

### Yang sudah diverifikasi

- ✅ Isi asar benar: `dist/` + seluruh `electron/` ikut; `src/`, `tests/`, dan
  konfigurasi pengembangan **tidak** ikut
- ✅ Build tidak terpaket **benar-benar berjalan** — server lokal menyala dan
  memilih alamat LAN yang benar (`192.168.1.2`), membuktikan perbaikan B11 juga
  bekerja pada hasil build
- ✅ Modul native termuat — database terbentuk tanpa galat
- ✅ Portable **benar-benar berjalan** — terverifikasi lewat daftar proses

### ⚠️ Yang belum

| Hal | Status | Catatan |
|---|---|---|
| **Installer NSIS dijalankan** | ❌ | Berkasnya terbentuk dan terverifikasi isinya, tetapi belum pernah benar-benar dipasang. Memasangnya mengubah sistem (Start Menu, shortcut, registry) — itu keputusan operator, bukan sesuatu yang pantas dilakukan otomatis |
| **Code signing** | ❌ | Windows SmartScreen menampilkan *"Unknown publisher"* pada pemasangan pertama. Lihat penjelasan di bawah |
| **Auto-update** | ❌ | Butuh target publikasi (GitHub Releases, S3, atau server sendiri). Belum diputuskan |
| **Startup otomatis saat booting** | ❌ | Belum dikonfigurasi; untuk kiosk permanen ini biasanya diinginkan |

#### Tentang peringatan "Unknown publisher"

Windows memasang **stempel digital** pada berkas `.exe` untuk membuktikan siapa
pembuatnya dan bahwa isinya tidak diubah orang lain di tengah jalan. Stempel ini
disebut **code signing**, dan sertifikatnya harus dibeli dari penerbit tepercaya
(±200–500 USD per tahun).

Aplikasi ini **belum ditandatangani**, jadi Windows tidak tahu siapa penerbitnya
dan menampilkan layar biru *"Windows protected your PC — Unknown publisher"*.

Yang perlu dipahami: ini **bukan berarti berkasnya bervirus atau rusak**. Windows
hanya berkata *"saya tidak mengenal pembuat ini"*. Tekan **More info → Run anyway**
dan pemasangan berjalan normal.

Kapan ini mulai layak dibeli: saat installer mulai dikirim ke klien yang tidak
Anda kenal langsung, atau saat auto-update dipasang — pembaruan yang tidak
ditandatangani jauh lebih mudah dipalsukan. Selama distribusinya masih dari tangan
ke tangan ke klien yang sudah kenal, *Run anyway* sudah cukup.

## 20. Ringkasan Penilaian

| Aspek | Audit awal | Sekarang | Catatan |
|---|---|---|---|
| Kejelasan konsep produk | 🟢 Kuat | 🟢 Kuat | Alur kiosk + remote cashier dipikirkan matang, sangat sesuai konteks photobooth event di Indonesia |
| UX / identitas visual | 🟢 Kuat | 🟢 Kuat | Tema arcade konsisten; virtual keyboard, visual slot editor, dan halaman unduhan pelanggan adalah pekerjaan bagus |
| Kelengkapan fitur | 🔴 Kritis | 🟢 Kuat | Cetak, reprint, pengiriman video, upselling, dan Google Drive sudah nyata — bukan lagi simulasi |
| Keamanan | 🔴 Kritis | 🟢 Kuat | 14 dari 14 temuan ditutup; seluruh Critical & High hilang. Sisa: rotasi Midtrans key (tindakan manual) |
| Performa | 🟠 Perlu perbaikan | 🟢 Kuat | 9 dari 12 temuan diperbaiki; jalur foto, render, dan polling semuanya diperbaiki |
| Integritas data / akuntansi | 🟠 Perlu perbaikan | 🟢 Kuat | Laba bersih, penggandaan retake, HPP retroaktif, dan HPP per lembar semuanya benar |
| Arsitektur | 🟠 Perlu perbaikan | 🟢 Kuat | Monolit 1240 baris dipecah jadi 22 file dengan pemisahan tanggung jawab yang jelas |
| Kesiapan rekayasa | 🔴 Kritis | 🟡 Cukup | Lint, **475 uji otomatis, CI Windows, dan packaging** sudah berjalan. Tersisa: code signing, auto-update, dan cakupan uji untuk komponen React & integrasi |

### Kesimpulan

Aplikasi ini berubah dari "belum layak produksi" menjadi **layak dipakai di lapangan
dan sudah dapat didistribusikan**.

Yang sudah tidak jadi masalah: fungsi cetak sudah nyata, permukaan jaringan tidak lagi
terbuka bebas di WiFi venue, pembayaran tidak bisa dilewati dari LAN maupun renderer,
rahasia tidak lagi plaintext, akuntansi bisa dipercaya, dan performanya diperbaiki di
titik-titik yang paling terasa oleh pelanggan.

**Blocker distribusi sudah ditutup.** `npm run dist` menghasilkan installer NSIS dan
versi portable yang siap dibawa ke mesin photobooth mana pun. Yang tersisa bukan lagi
blocker, melainkan penghalus: **code signing** (menghilangkan peringatan SmartScreen)
dan **auto-update** (agar perbaikan tidak perlu dipasang manual satu per satu).
Keduanya baru mendesak ketika unit sudah tersebar di banyak lokasi.

**Perubahan besar sejak audit awal pada model pengantaran hasil.** Semula seluruh
hasil diantar lewat jaringan lokal, yang berarti setiap tamu harus join WiFi venue —
tidak realistis untuk acara 100 orang. Kini mode online mengantar lewat Google Drive
sehingga beban jaringan venue menjadi nol, sementara mode offline tetap memakai jalur
lokal. Jalur lokal **tidak dihapus**, melainkan disiapkan untuk peran barunya sebagai
fondasi integrasi website vendor.

Dua pekerjaan yang sebaiknya tidak ditunda lama: **webhook Midtrans dengan verifikasi
signature** (polling sudah aman karena dilakukan main process, tapi webhook lebih tepat
dan lebih hemat), dan **rotasi Midtrans key** yang masih tertinggal di `.env`.

**Utang teknis terbesar sudah dibayar.** Dahulu tidak ada satu pun test otomatis;
seluruh verifikasi bersandar pada lint, build, uji sekali pakai, dan QA manual. Kini
**475 uji berjalan otomatis** dan menjaga aturan bisnis serta bug yang pernah benar-benar
terjadi — termasuk escaping XSS, migrasi skema, aturan harga, dan pengaman auto-purge.

Namun perlu ditegaskan agar tidak menimbulkan rasa aman yang keliru: **test suite ini
menjaga logika dan data, bukan tampilan dan integrasi.** Bug layar Manajemen Sesi yang
terpotong — regresi dari refactor Task #9 — adalah contoh nyata: ia lolos dari lint,
build, dan seluruh uji, dan hanya tertangkap oleh QA manual. Cakupan untuk komponen
React, panggilan Google Drive sungguhan, dan alur Electron end-to-end masih kosong.