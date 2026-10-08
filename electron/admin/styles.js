// =========================================================================
// GAYA HALAMAN KASIR
//
// Tampilan konsol Gameboy/PSP sudah dilepas. Penggantinya rangka aplikasi
// biasa: tab di bawah untuk HP portrait, rel di samping untuk landscape.
//
// Aturan warna yang dipegang di sini: PERMUKAAN KONTEN SELALU NETRAL
// (putih dengan teks hitam), tema hanya mewarnai aksen. Tanpa aturan itu,
// tema Neon (--secondary ungu) membuat teks hitam nyaris tidak terbaca.
// =========================================================================

const STYLES = `
    /* Dilayani dari mesin kiosk sendiri — HP kasir sering tidak punya akses
       internet di venue. */
    @font-face {
        font-family: 'Press Start 2P';
        font-style: normal;
        font-weight: 400;
        font-display: block;
        src: url('/fonts/PressStart2P-Regular.ttf') format('truetype');
    }

    *, *::before, *::after { box-sizing: border-box; }

    :root {
        --primary: #007CC3; --secondary: #FFD453; --accent: #FF3B67;
        --aman-bawah: env(safe-area-inset-bottom, 0px);
        --aman-kiri: env(safe-area-inset-left, 0px);
    }
    body.theme-candy     { --primary: #007CC3; --secondary: #FFD453; --accent: #FF3B67; }
    body.theme-bumblebee { --primary: #E5A93B; --secondary: #FAF2E3; --accent: #754A05; }
    body.theme-neon      { --primary: #1E1F22; --secondary: #7F56FF; --accent: #7F56FF; }
    body.theme-fall      { --primary: #354E47; --secondary: #FAF2E3; --accent: #DB627A; }

    html, body { height: 100%; }
    body {
        margin: 0;
        font-family: 'Press Start 2P', monospace;
        background: #15161a;
        color: #fff;
        user-select: none;
        overscroll-behavior: none;
        -webkit-text-size-adjust: 100%;
        /* Kunci zoom cubit & ketuk-ganda: kasir menekan tombol cepat-cepat,
           ketukan beruntun tidak boleh berubah jadi zoom. */
        touch-action: manipulation;
    }

    /* ================== RANGKA ================== */
    .app { display: flex; flex-direction: column; height: 100svh; }
    .kolom-utama { display: flex; flex-direction: column; flex: 1; min-height: 0; min-width: 0; order: 1; }

    .topbar {
        background: var(--primary); border-bottom: 4px solid #000;
        padding: 14px; display: flex; align-items: center; gap: 10px;
        transition: background-color 0.5s ease; flex: none;
    }
    .judul {
        flex: 1; min-width: 0; font-size: 9px; line-height: 1.7;
        text-shadow: 2px 2px 0 rgba(0,0,0,0.4); overflow-wrap: anywhere;
    }
    .lampu { width: 10px; height: 10px; border-radius: 50%; flex: none; background: #4ADE80; box-shadow: 0 0 8px #4ADE80; }
    .lampu.mati { background: #6B7280; box-shadow: none; }

    .isi {
        flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;
        padding: 16px; padding-bottom: calc(16px + var(--aman-bawah));
    }
    .panel[hidden] { display: none; }

    /* ================== TAB ================== */
    .tabbar {
        display: flex; flex: none; order: 2;
        background: #0B0C0F; border-top: 4px solid #000;
        padding-bottom: var(--aman-bawah);
    }
    .tab {
        flex: 1; min-height: 64px; padding: 10px 4px;
        background: transparent; color: #9CA3AF; border: none;
        border-right: 2px solid #000;
        font-family: inherit; font-size: 8px; letter-spacing: 0.5px;
        cursor: pointer; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 7px;
    }
    .tab:last-child { border-right: none; }
    .tab.aktif { background: var(--accent); color: #fff; text-shadow: 1px 1px 0 rgba(0,0,0,0.5); }
    .tab:active { background: rgba(255,255,255,0.14); }
    .tab.aktif:active { background: var(--accent); }

    /* Titik penanda ada tagihan menunggu saat kasir sedang di tab lain. */
    .titik { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); visibility: hidden; }
    .titik.tampil { visibility: visible; animation: kedip 1s infinite; }
    .tab.aktif .titik { background: #fff; }
    @keyframes kedip { 0%, 100% { opacity: 1; } 50% { opacity: 0.15; } }

    /* ================== KARTU ================== */
    .kartu {
        background: #fff; color: #111; border: 4px solid #111;
        box-shadow: 6px 6px 0 rgba(0,0,0,0.55);
        padding: 18px; margin-bottom: 16px;
    }
    /* line-height eksplisit: label tab KONTROL cukup panjang untuk membungkus
       ke dua baris, dan tanpa ini baris keduanya menempel ke baris pertama. */
    .label { font-size: 7px; color: #6B7280; letter-spacing: 1px; line-height: 2; margin: 0 0 10px 0; }
    .nilai { font-size: 15px; line-height: 1.6; margin: 0; overflow-wrap: anywhere; }
    .harga { font-size: 22px; line-height: 1.4; margin: 0; color: var(--primary); }
    .catatan { font-size: 7px; line-height: 1.8; margin: 12px 0 0 0; padding: 10px; background: var(--primary); color: #fff; overflow-wrap: anywhere; }

    .peringatan {
        border: 3px solid #DC2626; background: #FEF2F2; color: #B91C1C;
        font-size: 7px; line-height: 1.9; padding: 12px; margin-bottom: 16px;
    }

    /* ================== BARIS STATUS ==================
       Label kiri, nilai kanan. Nilai boleh membungkus (nama printer bisa
       panjang), label tidak — supaya kolomnya tetap terbaca sebagai tabel. */
    .baris {
        display: flex; justify-content: space-between; gap: 12px;
        align-items: baseline; padding: 10px 0;
        border-bottom: 2px dashed #E5E7EB; font-size: 7px; line-height: 1.9;
    }
    .baris:last-child { border-bottom: none; }
    .baris-label { color: #6B7280; white-space: nowrap; letter-spacing: 0.5px; }
    .baris-nilai { color: #111; text-align: right; overflow-wrap: anywhere; }
    /* Latar tipis, bukan hanya warna teks: pembeda warna saja hilang bagi
       operator yang buta warna, dan layar HP di bawah matahari memucat. */
    .baris-waspada { background: #FFFBEB; margin: 0 -8px; padding-left: 8px; padding-right: 8px; }
    .baris-waspada .baris-nilai { color: #B45309; }
    .baris-kritis  { background: #FEF2F2; margin: 0 -8px; padding-left: 8px; padding-right: 8px; }
    .baris-kritis .baris-nilai { color: #B91C1C; }

    .peringatan-baris { font-size: 7px; line-height: 2; margin: 0 0 10px 0; padding: 10px; overflow-wrap: anywhere; }
    .peringatan-baris:last-child { margin-bottom: 0; }
    .peringatan-baris.kritis  { background: #FEF2F2; color: #B91C1C; border-left: 6px solid #DC2626; }
    .peringatan-baris.waspada { background: #FFFBEB; color: #B45309; border-left: 6px solid #F59E0B; }

    /* pre-line supaya "\\n" pada teks kosong benar-benar jadi baris baru
       tanpa perlu merangkai <br> ke innerHTML. */
    .kosong { text-align: center; color: #6B7280; font-size: 9px; line-height: 2.2; padding: 40px 16px; white-space: pre-line; }

    /* ================== TOMBOL ================== */
    .tombol {
        display: block; width: 100%; min-height: 56px; padding: 16px;
        font-family: inherit; font-size: 10px; line-height: 1.6;
        border: 4px solid #111; box-shadow: 4px 4px 0 #111; cursor: pointer;
        margin-bottom: 14px;
    }
    .tombol:active { box-shadow: none; transform: translate(4px, 4px); }
    .tombol:last-child { margin-bottom: 0; }
    /* Grid tombol tab KONTROL. Melar mengikuti lebar layar, tetapi tiap sel
       dijaga minimal 128px supaya labelnya tidak pernah terpotong di HP kecil. */
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); gap: 12px; }
    .grid .tombol { margin-bottom: 0; font-size: 8px; padding: 14px 8px; }

    .tombol-utama  { background: var(--accent); color: #fff; text-shadow: 1px 1px 0 rgba(0,0,0,0.4); }
    .tombol-netral { background: #fff; color: #111; }
    .tombol-bahaya { background: #DC2626; color: #fff; }

    /* ================== SARINGAN RIWAYAT ================== */
    .kolom-cari {
        width: 100%; min-height: 52px; padding: 14px;
        font-family: inherit; font-size: 9px; line-height: 1.6;
        border: 4px solid #111; background: #fff; color: #111;
        /* 16px mencegah iOS Safari mem-zoom halaman saat kolom difokuskan;
           tampilannya diperkecil lewat font-size di atas, bukan lewat ini. */
        -webkit-text-size-adjust: 100%;
    }
    .kolom-cari::placeholder { color: #9CA3AF; }
    .kolom-cari:focus { outline: 4px solid var(--accent); outline-offset: -4px; }

    .saringan { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .cip {
        min-height: 44px; padding: 10px 12px;
        font-family: inherit; font-size: 7px; line-height: 1.6;
        border: 3px solid #111; background: #fff; color: #111;
        cursor: pointer; box-shadow: 3px 3px 0 #111;
    }
    .cip:active { box-shadow: none; transform: translate(3px, 3px); }
    .cip.aktif { background: var(--accent); color: #fff; }
    .cip .jumlah { opacity: 0.65; margin-left: 6px; }
    .cip.kosong { opacity: 0.4; }

    .ringkas { font-size: 7px; line-height: 2; color: #9CA3AF; margin: 0 0 12px 0; text-align: center; }

    /* ================== RIWAYAT ================== */
    .item { background: #fff; color: #111; border: 4px solid #111; box-shadow: 4px 4px 0 rgba(0,0,0,0.55); padding: 14px; margin-bottom: 14px; }
    .item-kepala { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; border-bottom: 2px dashed #D1D5DB; padding-bottom: 10px; }
    .item-nama { font-size: 10px; line-height: 1.6; overflow-wrap: anywhere; }
    .item-harga { font-size: 9px; color: var(--primary); white-space: nowrap; }
    .item-meta { font-size: 6px; color: #6B7280; line-height: 2; margin-top: 10px; overflow-wrap: anywhere; }
    .item-aksi { display: flex; gap: 10px; margin-top: 12px; }
    .item-aksi .tombol { margin-bottom: 0; font-size: 8px; min-height: 48px; padding: 12px 8px; }

    /* ================== HAMPARAN ================== */
    .hamparan {
        position: fixed; inset: 0; z-index: 100;
        background: rgba(0,0,0,0.93); padding: 24px;
        display: none; flex-direction: column; justify-content: center;
    }
    .hamparan.tampil { display: flex; }
    .hamparan-judul { font-size: 12px; line-height: 1.8; color: #FF6B6B; margin: 0 0 18px 0; text-align: center; }
    .hamparan-pesan { font-size: 8px; line-height: 2.1; color: #E5E7EB; margin: 0 0 28px 0; text-align: center; overflow-wrap: anywhere; }

    /* Pesan sesaat, pengganti alert() bawaan browser. */
    .toast {
        position: fixed; left: 16px; right: 16px; z-index: 200;
        bottom: calc(84px + var(--aman-bawah));
        background: #111; color: #fff; border: 4px solid #fff;
        box-shadow: 4px 4px 0 rgba(0,0,0,0.6);
        font-size: 8px; line-height: 1.9; padding: 14px;
        display: none; overflow-wrap: anywhere;
    }
    .toast.tampil { display: block; }
    .toast.gagal { border-color: #DC2626; color: #FCA5A5; }

    /* ================== LAYAR PAIRING ================== */
    .pair {
        position: fixed; inset: 0; z-index: 300; background: #111;
        display: none; flex-direction: column; justify-content: center;
        align-items: center; text-align: center; padding: 32px;
    }
    .pair.tampil { display: flex; }
    .pair-judul { font-size: 13px; color: #FF6B6B; margin: 0 0 22px 0; line-height: 1.8; }
    .pair-teks { font-size: 8px; line-height: 2.4; color: #E5E7EB; margin: 0; }

    /* ================== LANDSCAPE: REL SAMPING ================== */
    @media (orientation: landscape) {
        .app { flex-direction: row; }
        .tabbar {
            order: 0; flex-direction: column; width: 108px; flex: none;
            border-top: none; border-right: 4px solid #000;
            padding-bottom: 0; padding-left: var(--aman-kiri);
        }
        .tab { flex: none; min-height: 76px; border-right: none; border-bottom: 2px solid #000; }
        .tab:last-child { border-bottom: none; }
        .isi { padding-bottom: 16px; }
        .toast { bottom: 20px; left: calc(124px + var(--aman-kiri)); }
    }

    /* Layar lebar (tablet kasir): jangan biarkan kartu melar sampai sulit dibaca. */
    @media (min-width: 720px) {
        .isi > .panel { max-width: 620px; margin: 0 auto; }
    }

    /* Umpan balik hover hanya untuk perangkat berpenunjuk. Di layar sentuh,
       hover "menempel" setelah ditekan dan menyesatkan. */
    @media (hover: hover) and (pointer: fine) {
        .tab:hover { background: rgba(255,255,255,0.08); }
        .tab.aktif:hover { background: var(--accent); }
        .tombol:hover { filter: brightness(1.08); }
    }
`;

module.exports = { STYLES };
