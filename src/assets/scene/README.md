# Aset Pixel — menu awal (SceneBackdrop)

Seluruh gambar di folder ini dibuat dengan **PixelLab MCP**. Tidak ada aset
yang diunduh dari internet, sehingga tidak ada masalah hak cipta. Maskot
SayGumi adalah **karakter orisinal** bergaya platformer 16-bit — sengaja bukan
tiruan karakterzai apa pun.

Biaya total: **15 generasi** dari paket 40 (sisa 25).

---

## Daftar aset

| Berkas | Asal | Gen | Catatan |
|---|---|---|---|
| `monkey-run.png` | `create_character` + `animate_character` | 3 | 8 frame lari, arah timur |
| `monkey-jump.png` | ↑ | — | 9 frame lompat, arah timur |
| `monkey-idle.png` | ↑ | — | 4 frame bernapas, arah selatan |
| `hills.png` | `create_image_pixflux` | 1 | Bukit + pohon + lempeng tanah |
| `bushes.png` | `create_image_pixen` | 1 | Semak, transparan |
| `cloud-a.png` | `create_image_pixen` | 1 | Awan bulat, transparan |
| `cloud-b.png` | `create_image_pixen` | 1 | Awan pipih, transparan |
| `sun.png` | `create_image_pixen` | 1 | Matahari bermuka, transparan |
| `bird.png` | `create_image_pixen` | 1 | Burung, transparan |
| `block.png` | `create_image_pixen` | 1 | Blok tanya, transparan |
| `crab-walk.png` | `create_character` + `animate_character` | 2 | 6 frame jalan, arah timur |

### Aset yang bermasalah dan cara memperbaikinya

Tiga dari sebelas aset tidak bisa dipakai apa adanya. Semuanya lolos
`npm run build` tanpa satu pun galat — hanya pemeriksaan visual dan pengukuran
alpha yang menangkapnya.

**`sky.png` — dibuang.** Keluar sebagai pita vertikal sempit di tengah kanvas
dengan area kosong di kedua sisi (alpha 255 di pinggir, konten hanya di
tengah). Tidak ada versi prompt yang memperbaikinya dalam anggaran yang ada.
Diganti `linear-gradient` CSS.

**`hills.png` — dipotong 30px dari atas.** Aslinya membawa langitnya sendiri
sebagai pita pucat `#E6FDF4`, yang berbentrok dengan langit dan muncul
sebagai garis terang menyakitkan di atas bukit. Baris `#E6FDF4` dihapus sampai
baris pertama yang benar-benar berisi konten. Warna itu kini juga menjadi
ujung gradien langit CSS, jadi sambungannya tidak terlihat.

**`crab-walk.png` — dipotong dari 92px menjadi 37px per sel.** Sprite sheet
mentah memuat **dua kepiting per sel**: yang atas menghadap kanan, yang bawah
cermin dan terbalik, dihubungkan "tangkai" tipis. Template `walking` gagal pada
karakter ini. Baris atas (y 0–36, kaki di y=35) dipakai; sisanya dibuang.

**Langit tidak memakai gambar.** Aset langit dari PixelLab keluar sebagai pita
vertikal sempit di tengah kanvas dengan area kosong di kedua sisi, sehingga
tidak bisa dipakai sebagai latar full-bleed. Diganti `linear-gradient` CSS
dengan pita warna keras di `src/index.css`.

---

## ID PixelLab (untuk regenerate)

| Objek | UUID |
|---|---|
| Karakter SayGumi Monkey | `b2c42986-1521-42c6-8396-121226ffc6e1` |
| Grup animasi "lari" | `3354bb0e-cfdb-4de5-add9-914fddafdcee` |
| Grup animasi "lompat" | `a26af1d8-5f05-4eb8-a9a7-484cb2824e8e` |
| Grup animasi "diam" | `e9cd4ddb-c920-4f7e-a18c-92231dfbd81b` |
| Karakter Kepiting | `9620be87-66db-408c-8dfb-29049a121825` |
| Grup animasi "jalan" | `cee67441-a4cf-4d5c-8b41-6ea7002fda15` |

Unduh ulang sprite sheet karakter:

```
GET https://api.pixellab.ai/mcp/characters/<uuid>/spritesheet
Authorization: Bearer <token>
```

Hasilnya zip berisi satu PNG + JSON. Baris sheet (urutan **berubah** setiap
kali ada animasi baru ditambahkan — selalu baca JSON, jangan hardcode):

| Baris | Isi |
|---|---|
| 0 | 4 rotasi (south, west, east, north) |
| 1 | "lari" 8 frame, east |
| 2 | "lompat" 9 frame, east |
| 3 | "diam" 4 frame, south |

---

## Aturan yang WAJIB dijaga kalau menambah aset

1. **Semua gerakan dibuat dengan CSS, bukan AI.** Empat perilaku monkey
   (lari, lompat, diam, plus gerak continuous) seluruhnya keyframes. Pilih
   `animate_character` hanya untuk siklus siklus yang benar-benar butuh frame
   baru.
2. **Gunakan `no_background: true`** untuk semua aset selain latar penuh.
3. **Ukuran kanvas kecil saja.** Batas `create_image_pixen` adalah 512x512
   total area. Gambar lalu di-upscale dengan `image-rendering: pixelated`.
4. **Perkalian bulat saja.** Skala 1.5x membuat garis 1px bergeser dan tepi
   pixel terlihat pecah. Yang dipakai sekarang adalah 2x.
5. **Setelah mengunduh gambar baru, selalu periksa alpha di 9 titik** (4 sudut,
   4 tengah sisi, 1 pusat). Gambar dengan alpha 255 di pinggir tapi konten
   hanya di tengah adalah kegagalan diam-diam — persis yang terjadi pada aset
   langit.
6. **Potong langit yang terbawa.** `hills.png` semula menyertakan langitnya
   sendiri sebagai pita pucat di atas. Baris pale `#E6FDF4` dihapus sampai
   baris pertama yang benar-benar berisi konten. Warna `#E6FDF4` itu kini juga
   dipakai sebagai ujung gradien langit CSS agar sambungannya tidak terlihat.
7. **Verifikasi visual, jangan hanya `npm run build`.** Build hijau tidak
   menangkap layer yang salah tempat, gambar yang meluap, atau urutan render
   yang terbalik. Gunakan:

   ```bash
   npm run build
   npx electron tools/scene-shot.js dist/assets/index-<hash>.css
   ```

   Hasilnya `dist/_scene.png`. Alat ini di luar `dist/` karena `npm run build`
   menghapus folder itu; `electron-builder.yml` juga mengecualikan `dist/_*`
   dari paket agar screenshot tidak ikut masuk installer.
8. **Jangkarkan posisi obyek ke `--ground`.** Dihitung dari tinggi lempeng
   tanah di `hills.png` (28px dari 110) dikali skala strip (2x) = 56px. Ubah
   `--ground` hanya kalau `hills.png` juga diganti.
9. **`--tile-w` WAJIB sama dengan (lebar gambar × tinggi strip ÷ tinggi
   gambar).** Nilai ini bukan pilihan gaya — kalau tidak sama persis, gambar
   teregang. Contoh: `hills.png` 799×110 pada strip setinggi 220px →
   `--tile-w: 1598px`. Mengubah tinggi strip berarti menghitung ulang.
10. **Struktur strip: satu elemen, `repeat-x`, digeser tepat satu `--tile-w`.**
    Jangan pernah memakai dua elemen anak yang digeser 50%. Tiap anak memutar
    ulang fase background dari kolom nol di tepi kirinya sendiri, sehingga di
    sambungan keduanya fase melompat mundur sebesar `tile mod 50% elemen` —
    bukit dan semak terlihat berhenti lalu mulai lagi. Ini sempat membingungkan
    selama beberapa putaran karena gejalanya jauh dari penyebabnya.
11. **Gambar yang akan digeser wajib dibuat seamless.** Cara paling andal
    adalah tile `[asli | cermin]` dengan **kolom tepi cermin dibuang satu**:
    `RotateNoneFlipX` menyertakan kolom terakhir yang sama dua kali, dan
    duplikasi 1px itu persis yang terbaca sebagai garis potong. Setelah itu,
    tile bisa digandakan beruntun (bushes 255px → 510px) supaya polanya tidak
    terulang terlalu sering di layar.
12. **Semak ada di lapisan paling depan**, jadi ia menutupi kaki karakter.
    `--lift` (18px) menaikkan monkey dan blok tanya agar kaki monkey menyentuh
    puncak baris semak. **Kepiting tidak memakai `--lift`** — rumusnya sudah
    menghitung padding kaki sprite-nya sendiri, jadi menambahkan `--lift` di
    sana membuatnya melayang. Kalau semak diubah ukurannya, hitung ulang `--lift`
    dari perbedaan tinggi semak terhadap permukaan tanah.
