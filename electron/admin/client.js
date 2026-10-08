/* global formatRupiah, formatRupiahSingkat, kelasTema, barisMeta, teksKonfirmasi, jedaPoll */
/* global STATUS_SARINGAN, saringRiwayat, hitungStatus, ringkasSaringan */

// =========================================================================
// LOGIKA HALAMAN KASIR (berjalan di browser HP, bukan di Node)
//
// Berkas ini sengaja berupa .js sungguhan, bukan string di dalam template
// HTML, supaya ESLint benar-benar membacanya. Versi lamanya adalah 200-an
// baris di dalam backtick — salah ketik apa pun di sana lolos begitu saja
// sampai ketahuan di HP kasir, di tengah acara.
//
// ATURAN YANG TIDAK BOLEH DILANGGAR: nama pelanggan datang dari database
// dan HARUS masuk lewat textContent / createElement. Jangan pernah
// merangkainya ke innerHTML — itu jalur stored XSS (temuan S6).
// =========================================================================

(function () {
    'use strict';

    // Token diambil dari QR pairing (?t=...) lalu disimpan di localStorage.
    // Dikirim sebagai header Authorization — bukan cookie — supaya request
    // lintas-situs tidak bisa membawanya (proteksi CSRF struktural).
    const TOKEN_KEY = 'saygumi_cashier_token';

    let pollTimer = null;
    let adaPending = false;
    let tabAktif = 'tagihan';
    let toastTimer = null;
    let selesaikanKonfirmasi = null;
    let statusTerakhirMs = 0;
    let kueriCari = '';
    let statusAktif = 'SEMUA';

    // Status ditarik jauh lebih jarang daripada tagihan: isinya berubah dalam
    // hitungan menit (disk terisi, antrean jalan), bukan detik. Menariknya
    // setiap putaran polling hanya membebani kiosk tanpa memberi informasi baru.
    const JEDA_STATUS_MS = 60000;

    const el = (id) => document.getElementById(id);

    // ================== SESI & JARINGAN ==================

    (function ambilTokenDariUrl() {
        const url = new URL(window.location.href);
        const t = url.searchParams.get('t');
        if (!t) return;
        localStorage.setItem(TOKEN_KEY, t);
        // Dihapus dari address bar supaya token tidak tertinggal di riwayat
        // browser maupun ikut terbawa saat kasir memotret layarnya.
        url.searchParams.delete('t');
        history.replaceState(null, '', url.pathname + url.search);
    })();

    function tampilkanPairing(tampil) {
        el('pair').classList.toggle('tampil', tampil);
    }

    async function api(path, options) {
        const token = localStorage.getItem(TOKEN_KEY) || '';
        if (!token) { tampilkanPairing(true); throw new Error('BELUM DIPASANGKAN'); }

        const opts = options || {};
        const res = await fetch(path, {
            ...opts,
            headers: { ...(opts.headers || {}), 'Authorization': 'Bearer ' + token },
        });

        if (res.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            tampilkanPairing(true);
            throw new Error('TOKEN DITOLAK');
        }
        if (res.status === 429) throw new Error('TERLALU BANYAK PERMINTAAN');
        return res;
    }

    const post = (path) => api(path, { method: 'POST' });

    // ================== PERKAKAS DOM ==================

    function buatP(kelas, teks) {
        const e = document.createElement('p');
        e.className = kelas;
        e.textContent = teks;
        return e;
    }

    function buatTombol(kelas, teks, onKlik) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tombol ' + kelas;
        b.textContent = teks;
        b.addEventListener('click', onKlik);
        return b;
    }

    function buatKartu(anak) {
        const d = document.createElement('div');
        d.className = 'kartu';
        anak.forEach((a) => d.appendChild(a));
        return d;
    }

    function buatKosong(teks) {
        const d = document.createElement('div');
        d.className = 'kosong';
        d.textContent = teks;
        return d;
    }

    function kosongkan(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    // ================== PESAN & KONFIRMASI ==================

    function pesan(teks, gagal) {
        const t = el('toast');
        t.textContent = teks;
        t.classList.toggle('gagal', !!gagal);
        t.classList.add('tampil');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('tampil'), 4000);
    }

    // Pengganti confirm() bawaan: dialog native terasa asing di halaman ini
    // dan pada sebagian browser HP bisa terblokir. Mengembalikan Promise
    // supaya pemanggilnya tetap bisa ditulis lurus dengan await.
    function konfirmasi(teks) {
        el('hamparan-judul').textContent = teks.judul;
        el('hamparan-pesan').textContent = teks.pesan;
        el('hamparan-ya').textContent = '[ ' + teks.aksi + ' ]';
        el('hamparan').classList.add('tampil');
        return new Promise((resolve) => { selesaikanKonfirmasi = resolve; });
    }

    function tutupKonfirmasi(jawaban) {
        el('hamparan').classList.remove('tampil');
        const resolve = selesaikanKonfirmasi;
        selesaikanKonfirmasi = null;
        if (resolve) resolve(jawaban);
    }

    // ================== TAB ==================

    const TAB = ['tagihan', 'riwayat', 'kontrol', 'status'];

    function pilihTab(nama) {
        tabAktif = nama;
        document.querySelectorAll('.tab').forEach((t) => {
            t.classList.toggle('aktif', t.dataset.tab === nama);
        });
        TAB.forEach((n) => { el('panel-' + n).hidden = n !== nama; });
        el('titik-tagihan').classList.toggle('tampil', adaPending && nama !== 'tagihan');
        if (nama === 'riwayat') muatRiwayat();
        if (nama === 'status') muatStatus();
    }

    // ================== TAB: TAGIHAN ==================

    function renderTagihan(data) {
        const panel = el('panel-tagihan');
        kosongkan(panel);

        if (!data || !data.name) {
            panel.appendChild(buatKosong('TIDAK ADA TAGIHAN.\n\nMenunggu pelanggan...'));
            return;
        }

        const isi = [
            buatP('label', 'PELANGGAN'),
            buatP('nilai', data.name),
        ];
        if (data.note) isi.push(buatP('catatan', data.note));
        isi.push(buatP('label', 'TAGIHAN'));
        isi.push(buatP('harga', formatRupiah(data.price)));
        // Label harga diberi jarak dari blok nama di atasnya.
        isi[isi.length - 2].style.marginTop = '18px';

        const ingat = document.createElement('div');
        ingat.className = 'peringatan';
        ingat.textContent = 'CEK MUTASI REKENING SEBELUM VERIFIKASI!';

        panel.appendChild(buatKartu(isi));
        panel.appendChild(ingat);
        panel.appendChild(buatTombol('tombol-utama', '[ VERIFIKASI PEMBAYARAN ]', verifikasi));
    }

    async function verifikasi() {
        try {
            await post('/api/verify');
            pesan('PEMBAYARAN DIVERIFIKASI.');
            await tarikTagihan();
        } catch (e) {
            pesan('GAGAL: ' + e.message, true);
        }
    }

    // ================== TAB: RIWAYAT ==================

    // Kartu riwayat dibangun lewat DOM API. Nama pelanggan tidak pernah
    // menyentuh innerHTML maupun atribut onclick.
    function buatItemRiwayat(s) {
        const item = document.createElement('div');
        item.className = 'item';

        const kepala = document.createElement('div');
        kepala.className = 'item-kepala';
        const nama = document.createElement('span');
        nama.className = 'item-nama';
        nama.textContent = s.customer_name || '(TANPA NAMA)';
        const harga = document.createElement('span');
        harga.className = 'item-harga';
        harga.textContent = formatRupiahSingkat(s.harga_jual);
        kepala.append(nama, harga);

        const meta = document.createElement('div');
        meta.className = 'item-meta';
        meta.textContent = barisMeta(s);

        const aksi = document.createElement('div');
        aksi.className = 'item-aksi';
        aksi.append(
            buatTombol('tombol-netral', '[ RETAKE ]', () => retake(s)),
            buatTombol('tombol-netral', '[ REPRINT ]', () => reprint(s)),
        );

        item.append(kepala, meta, aksi);
        return item;
    }

    // Daftar mentah disimpan supaya mengetik di kolom cari menyaring seketika
    // tanpa memanggil server pada setiap huruf.
    let riwayatMentah = [];

    function gambarSaringan() {
        const wadah = el('saringan-status');
        kosongkan(wadah);
        const jumlah = hitungStatus(riwayatMentah);

        STATUS_SARINGAN.forEach((st) => {
            const b = document.createElement('button');
            b.type = 'button';
            // Status yang tidak muncul sama sekali di event ini diredupkan,
            // bukan disembunyikan — posisinya jadi tetap dan bisa dihafal.
            b.className = 'cip' + (st === statusAktif ? ' aktif' : '') + (jumlah[st] === 0 ? ' kosong' : '');
            b.textContent = st;
            const n = document.createElement('span');
            n.className = 'jumlah';
            n.textContent = String(jumlah[st] || 0);
            b.appendChild(n);
            b.addEventListener('click', () => { statusAktif = st; gambarRiwayat(); });
            wadah.appendChild(b);
        });
    }

    function gambarRiwayat() {
        const daftar = el('daftar-riwayat');
        kosongkan(daftar);

        const tampil = saringRiwayat(riwayatMentah, { cari: kueriCari, status: statusAktif });
        el('ringkas-riwayat').textContent = ringkasSaringan(tampil.length, riwayatMentah.length);
        gambarSaringan();

        if (!riwayatMentah.length) {
            daftar.appendChild(buatKosong('BELUM ADA TRANSAKSI.'));
            return;
        }
        if (!tampil.length) {
            daftar.appendChild(buatKosong('TIDAK ADA YANG COCOK.\n\nCoba ubah pencarian atau saringan.'));
            return;
        }
        tampil.forEach((s) => daftar.appendChild(buatItemRiwayat(s)));
    }

    async function muatRiwayat() {
        const daftar = el('daftar-riwayat');
        if (!riwayatMentah.length) {
            kosongkan(daftar);
            daftar.appendChild(buatKosong('MEMUAT RIWAYAT...'));
        }
        try {
            const res = await api('/api/history');
            riwayatMentah = await res.json();
            gambarRiwayat();
        } catch (e) {
            kosongkan(daftar);
            daftar.appendChild(buatKosong('GAGAL MEMUAT: ' + e.message));
        }
    }

    async function retake(s) {
        const setuju = await konfirmasi({
            judul: 'MULAI RETAKE?',
            pesan: 'Kiosk akan langsung membuka kamera untuk ' + (s.customer_name || 'pelanggan ini') + '.',
            aksi: 'YA, RETAKE',
        });
        if (!setuju) return;
        try {
            await post('/api/remote-retake/' + s.id);
            pesan('RETAKE DIMULAI DI KIOSK.');
            pilihTab('tagihan');
        } catch (e) {
            pesan('GAGAL: ' + e.message, true);
        }
    }

    async function reprint(s) {
        const setuju = await konfirmasi({
            judul: 'CETAK ULANG?',
            pesan: 'Foto ' + (s.customer_name || 'pelanggan ini') + ' akan dicetak sekali lagi.',
            aksi: 'YA, CETAK',
        });
        if (!setuju) return;
        try {
            const res = await post('/api/remote-reprint/' + s.id);
            const r = await res.json();
            if (r.success) pesan(r.warning ? 'BERHASIL, TAPI: ' + r.warning : 'BERHASIL DICETAK.');
            else pesan('GAGAL CETAK: ' + (r.error || 'Printer tidak merespons.'), true);
        } catch (e) {
            pesan('GAGAL: ' + e.message, true);
        }
        muatRiwayat();
    }

    // ================== TAB: STATUS ==================

    function buatBaris(label, nilai, tingkat) {
        const b = document.createElement('div');
        b.className = 'baris' + (tingkat && tingkat !== 'ok' ? ' baris-' + tingkat : '');
        const k = document.createElement('span');
        k.className = 'baris-label';
        k.textContent = label;
        const v = document.createElement('span');
        v.className = 'baris-nilai';
        v.textContent = nilai;
        b.append(k, v);
        return b;
    }

    function kartuPeringatan(daftar) {
        const d = document.createElement('div');
        d.className = 'kartu';
        d.appendChild(buatP('label', 'PERLU PERHATIAN'));
        daftar.forEach((p) => {
            const baris = document.createElement('p');
            baris.className = 'peringatan-baris ' + (p.tingkat === 'kritis' ? 'kritis' : 'waspada');
            baris.textContent = (p.tingkat === 'kritis' ? '! ' : '- ') + p.teks;
            d.appendChild(baris);
        });
        return d;
    }

    function renderStatus(s) {
        const wadah = el('isi-status');
        kosongkan(wadah);

        // Yang bermasalah ditaruh paling atas. Kalau semuanya ditampilkan
        // sederajat, yang penting tenggelam dan kasir berhenti membacanya.
        if (s.peringatan && s.peringatan.length) {
            wadah.appendChild(kartuPeringatan(s.peringatan));
        } else {
            const aman = document.createElement('div');
            aman.className = 'kartu';
            aman.appendChild(buatP('label', 'PERLU PERHATIAN'));
            aman.appendChild(buatP('nilai', 'TIDAK ADA MASALAH.'));
            wadah.appendChild(aman);
        }

        const mesin = document.createElement('div');
        mesin.className = 'kartu';
        mesin.appendChild(buatP('label', 'MESIN'));
        mesin.appendChild(buatBaris('EVENT', s.event || 'TIDAK ADA SESI'));
        mesin.appendChild(buatBaris('MODE', String(s.mode || '-').toUpperCase()));
        mesin.appendChild(buatBaris('ALAMAT', s.server.ip + ':' + s.server.port));
        mesin.appendChild(buatBaris('PRINTER', s.printer.teks, s.printer.tingkat));
        mesin.appendChild(buatBaris('SISA DISK', s.disk.bebas + ' / ' + s.disk.total, s.disk.tingkat));
        wadah.appendChild(mesin);

        const drive = document.createElement('div');
        drive.className = 'kartu';
        drive.appendChild(buatP('label', 'GOOGLE DRIVE'));
        drive.appendChild(buatBaris('AKUN', s.drive.terhubung ? (s.drive.akun || 'TERHUBUNG') : 'BELUM TERHUBUNG',
            s.drive.terhubung ? 'ok' : 'waspada'));
        const q = s.drive.antrean;
        drive.appendChild(buatBaris('MENUNGGU', String(q.pending), q.pending > 0 ? 'waspada' : 'ok'));
        drive.appendChild(buatBaris('BERJALAN', String(q.uploading)));
        drive.appendChild(buatBaris('SELESAI', String(q.done)));
        drive.appendChild(buatBaris('GAGAL', String(q.failed), q.failed > 0 ? 'kritis' : 'ok'));
        if (q.lastError) {
            const e = document.createElement('p');
            e.className = 'peringatan-baris waspada';
            e.textContent = 'GALAT TERAKHIR: ' + q.lastError;
            drive.appendChild(e);
        }
        wadah.appendChild(drive);

        const segar = buatTombol('tombol-netral', '[ MUAT ULANG ]', muatStatus);
        wadah.appendChild(segar);
    }

    async function muatStatus() {
        const wadah = el('isi-status');
        if (!wadah.firstChild) wadah.appendChild(buatKosong('MEMUAT STATUS...'));
        statusTerakhirMs = Date.now();
        try {
            const res = await api('/api/status');
            const s = await res.json();
            renderStatus(s);
            // Titik pada tab STATUS menyala saat ada temuan, supaya kasir tahu
            // tanpa harus membuka tabnya satu per satu.
            el('titik-status').classList.toggle('tampil', (s.peringatan || []).length > 0);
        } catch (e) {
            kosongkan(wadah);
            wadah.appendChild(buatKosong('GAGAL MEMUAT: ' + e.message));
        }
    }

    // ================== TAB: KONTROL ==================

    // Kiosk photobooth adalah layar sentuh tanpa keyboard fisik, jadi
    // Ctrl+Shift+P/T/D dan Ctrl+Panah tidak pernah bisa ditekan di sana.
    // Tombol-tombol ini satu-satunya cara menjangkaunya.
    async function kirimPanel(which) {
        if (which === 'landing') {
            const setuju = await konfirmasi({
                judul: 'KEMBALI KE LANDING?',
                pesan: 'Sesi pelanggan yang sedang berjalan dibatalkan dan kiosk kembali ke layar mulai.',
                aksi: 'YA, KEMBALI',
            });
            if (!setuju) return;
        }
        try {
            const res = await post('/api/panel/' + which);
            const r = await res.json();
            if (!r.success) { pesan('DITOLAK: ' + (r.error || 'Perintah tidak dikenal.'), true); return; }
            // Panel admin memunculkan gerbang PIN DI LAYAR KIOSK, bukan di HP.
            // Tanpa pesan ini, kasir menekan tombol lalu mengira tidak terjadi
            // apa-apa — padahal keypad PIN sudah menunggu di mesin.
            pesan(r.butuhPin ? 'CEK LAYAR KIOSK — MASUKKAN PIN ADMIN.' : 'PERINTAH DIKIRIM.');
        } catch (e) {
            pesan('GAGAL: ' + e.message, true);
        }
    }

    async function kirimTema(arah) {
        try {
            await post('/api/theme/' + arah);
            // Tema HP mengikuti tema kiosk. Ditarik langsung supaya perubahannya
            // terlihat seketika, bukan menunggu putaran polling berikutnya.
            await tarikTagihan();
        } catch (e) {
            pesan('GAGAL: ' + e.message, true);
        }
    }

    async function aksiKiosk(tipe, path) {
        const setuju = await konfirmasi(teksKonfirmasi(tipe));
        if (!setuju) return;
        try {
            await post(path);
            pesan(tipe === 'restart' ? 'PERINTAH RESTART DIKIRIM.' : 'SESI EVENT DITUTUP.');
            await tarikTagihan();
        } catch (e) {
            pesan('GAGAL: ' + e.message, true);
        }
    }

    // ================== POLLING ==================

    async function tarikTagihan() {
        try {
            const res = await api('/api/pending');
            const data = await res.json();

            tampilkanPairing(false);
            el('lampu').classList.remove('mati');
            document.body.className = kelasTema(data.active_theme);
            el('nama-event').textContent = 'LIVE: ' + (data.event_name || 'TIDAK ADA SESI');

            adaPending = !!data.name;
            el('titik-tagihan').classList.toggle('tampil', adaPending && tabAktif !== 'tagihan');
            renderTagihan(data);
        } catch (e) {
            el('lampu').classList.add('mati');
        }
    }

    // Polling berhenti total saat layar HP mati atau aplikasi di-background,
    // lalu langsung menyusul begitu kasir kembali membuka halamannya.
    function jadwalkanPoll() {
        clearTimeout(pollTimer);
        if (document.hidden) return;
        pollTimer = setTimeout(async () => {
            await tarikTagihan();
            // Titik peringatan pada tab STATUS harus tetap hidup walau kasir
            // sedang membuka tab lain — justru saat itulah ia berguna.
            if (Date.now() - statusTerakhirMs >= JEDA_STATUS_MS) await muatStatus();
            jadwalkanPoll();
        }, jedaPoll(adaPending));
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { clearTimeout(pollTimer); return; }
        tarikTagihan();
        jadwalkanPoll();
    });

    // ================== PEMASANGAN ==================

    document.querySelectorAll('.tab').forEach((t) => {
        t.addEventListener('click', () => pilihTab(t.dataset.tab));
    });

    // Menyaring dari data yang sudah ada di memori, jadi tidak perlu jeda
    // tunda — hasilnya berubah seiring huruf diketik.
    el('cari-riwayat').addEventListener('input', (e) => {
        kueriCari = e.target.value;
        gambarRiwayat();
    });

    document.querySelectorAll('[data-panel]').forEach((b) => {
        b.addEventListener('click', () => kirimPanel(b.dataset.panel));
    });
    document.querySelectorAll('[data-tema]').forEach((b) => {
        b.addEventListener('click', () => kirimTema(b.dataset.tema));
    });

    el('btn-restart').addEventListener('click', () => aksiKiosk('restart', '/api/restart'));
    el('btn-close').addEventListener('click', () => aksiKiosk('close', '/api/close'));
    el('hamparan-ya').addEventListener('click', () => tutupKonfirmasi(true));
    el('hamparan-batal').addEventListener('click', () => tutupKonfirmasi(false));

    tarikTagihan();
    muatStatus();
    jadwalkanPoll();
})();
