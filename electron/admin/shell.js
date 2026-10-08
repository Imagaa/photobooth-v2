// =========================================================================
// RANGKA HTML HALAMAN KASIR
//
// Hanya kerangka statis. Tidak ada satu pun data dari database di sini —
// seluruh nilai dinamis diisi client.js lewat textContent/createElement,
// karena nama pelanggan tersimpan di DB dan akan jadi stored XSS bila
// dirangkai ke innerHTML.
//
// Urutan DOM sengaja menaruh <nav> sebelum kolom utama: di landscape ia
// menjadi rel kiri secara alami, dan di portrait CSS `order` memindahkannya
// ke bawah. Satu DOM untuk dua orientasi, tanpa duplikasi tombol seperti
// tata letak Gameboy yang lama (dulu D-pad & A/B ditulis dua kali).
// =========================================================================

const SHELL = `
    <div class="app">
        <nav class="tabbar" id="tabbar">
            <button type="button" class="tab aktif" data-tab="tagihan" aria-label="Tagihan">
                <span>TAGIHAN</span>
                <span class="titik" id="titik-tagihan"></span>
            </button>
            <button type="button" class="tab" data-tab="riwayat" aria-label="Riwayat">
                <span>RIWAYAT</span>
                <span class="titik"></span>
            </button>
            <button type="button" class="tab" data-tab="kontrol" aria-label="Kontrol">
                <span>KONTROL</span>
                <span class="titik"></span>
            </button>
            <button type="button" class="tab" data-tab="status" aria-label="Status">
                <span>STATUS</span>
                <span class="titik" id="titik-status"></span>
            </button>
        </nav>

        <div class="kolom-utama">
            <header class="topbar">
                <div class="judul" id="nama-event">MEMUAT...</div>
                <div class="lampu mati" id="lampu" title="Status koneksi"></div>
            </header>

            <main class="isi">
                <section class="panel" id="panel-tagihan"></section>

                <section class="panel" id="panel-riwayat" hidden>
                    <div class="kartu">
                        <p class="label">CARI NAMA PELANGGAN</p>
                        <input type="search" id="cari-riwayat" class="kolom-cari"
                               placeholder="ketik nama..." autocomplete="off"
                               autocorrect="off" autocapitalize="none" spellcheck="false">
                        <div class="saringan" id="saringan-status"></div>
                    </div>
                    <p class="ringkas" id="ringkas-riwayat"></p>
                    <div id="daftar-riwayat"></div>
                </section>

                <section class="panel" id="panel-kontrol" hidden>
                    <div class="kartu">
                        <p class="label">PANEL ADMIN &mdash; PIN DIMINTA DI LAYAR KIOSK</p>
                        <div class="grid">
                            <button type="button" class="tombol tombol-netral" data-panel="settings">PENGATURAN</button>
                            <button type="button" class="tombol tombol-netral" data-panel="template">TEMPLATE</button>
                            <button type="button" class="tombol tombol-netral" data-panel="dashboard">DASHBOARD</button>
                        </div>
                    </div>

                    <div class="kartu">
                        <p class="label">TAMPILAN</p>
                        <div class="grid">
                            <button type="button" class="tombol tombol-netral" data-tema="prev">&lt; TEMA</button>
                            <button type="button" class="tombol tombol-netral" data-tema="next">TEMA &gt;</button>
                        </div>
                    </div>

                    <div class="kartu">
                        <p class="label">KENDALI SESI</p>
                        <button type="button" class="tombol tombol-netral" data-panel="landing">[ KEMBALI KE LANDING ]</button>
                        <button type="button" class="tombol tombol-netral" id="btn-restart">[ RESTART APLIKASI ]</button>
                        <button type="button" class="tombol tombol-bahaya" id="btn-close">[ TUTUP SESI EVENT ]</button>
                    </div>
                </section>

                <section class="panel" id="panel-status" hidden>
                    <div id="isi-status"></div>
                </section>
            </main>
        </div>
    </div>

    <div class="hamparan" id="hamparan">
        <h2 class="hamparan-judul" id="hamparan-judul"></h2>
        <p class="hamparan-pesan" id="hamparan-pesan"></p>
        <button type="button" class="tombol tombol-bahaya" id="hamparan-ya"></button>
        <button type="button" class="tombol tombol-netral" id="hamparan-batal">[ BATAL ]</button>
    </div>

    <div class="toast" id="toast"></div>

    <div class="pair" id="pair">
        <h2 class="pair-judul">[ AKSES DITOLAK ]</h2>
        <p class="pair-teks">
            HP INI BELUM DIPASANGKAN.<br><br>
            Buka LIVE DASHBOARD di mesin kiosk<br>
            (Ctrl + Shift + D)<br>
            lalu SCAN ULANG QR REMOTE CASHIER.
        </p>
    </div>
`;

module.exports = { SHELL };
