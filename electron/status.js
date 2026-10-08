// =========================================================================
// PENILAIAN STATUS LAPANGAN
//
// Modul ini TIDAK mengambil data — ia hanya menilai data yang diberikan.
// Pemisahan itu disengaja: pengambilannya butuh Electron, database, dan
// filesystem, sedangkan aturan "kapan operator harus khawatir" justru bagian
// yang paling mudah salah dan paling perlu diuji.
//
// Semua ambang di sini dipilih dari sudut pandang acara yang sedang berjalan,
// bukan dari sudut pandang komputer. Kehabisan disk di tengah acara berarti
// foto pelanggan gagal disimpan setelah mereka membayar — jadi ambangnya
// sengaja longgar, memberi waktu bertindak sebelum benar-benar mentok.
// =========================================================================

const GB = 1024 ** 3;

// Satu sesi menghasilkan ±25 MB (foto + video). 2 GB ≈ 80 sesi tersisa:
// cukup untuk menyelesaikan acara yang sedang berjalan, tidak lebih.
const DISK_KRITIS = 2 * GB;
const DISK_WASPADA = 10 * GB;

const TINGKAT = { OK: 'ok', WASPADA: 'waspada', KRITIS: 'kritis' };

// Urutan keparahan, dipakai untuk menyortir daftar peringatan.
const BOBOT = { kritis: 0, waspada: 1, ok: 2 };

// "Tidak diketahui" harus dibedakan dari "nol". Number(null) menghasilkan 0,
// sehingga tanpa pemeriksaan ini pembacaan disk yang GAGAL akan dilaporkan
// sebagai "0 B — foto bisa gagal disimpan": alarm palsu yang membuat operator
// berhenti mempercayai peringatan yang sungguhan.
function tidakDiketahui(n) {
    if (n === null || n === undefined || n === '') return true;
    const b = Number(n);
    return !Number.isFinite(b) || b < 0;
}

function formatBytes(n) {
    if (tidakDiketahui(n)) return '—';
    const b = Number(n);
    if (b >= GB) return (b / GB).toFixed(1).replace('.', ',') + ' GB';
    if (b >= 1024 * 1024) return Math.round(b / (1024 * 1024)) + ' MB';
    if (b >= 1024) return Math.round(b / 1024) + ' KB';
    return b + ' B';
}

function tingkatDisk(bebasBytes) {
    // Nilai tidak diketahui bukan berarti aman — tapi juga bukan bukti bahaya.
    // Dilaporkan sebagai waspada supaya tidak diam-diam terlihat sehat.
    if (tidakDiketahui(bebasBytes)) return TINGKAT.WASPADA;
    const b = Number(bebasBytes);
    if (b < DISK_KRITIS) return TINGKAT.KRITIS;
    if (b < DISK_WASPADA) return TINGKAT.WASPADA;
    return TINGKAT.OK;
}

function ringkasAntrean(q) {
    const a = q || {};
    const angka = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const pending = angka(a.pending);
    const uploading = angka(a.uploading);
    const done = angka(a.done);
    const failed = angka(a.failed);
    const belum = pending + uploading;

    let tingkat = TINGKAT.OK;
    // Gagal berarti berkas pelanggan TIDAK punya cadangan di Drive — itu
    // kehilangan permanen bila media lokalnya nanti ikut terhapus retensi.
    if (failed > 0) tingkat = TINGKAT.KRITIS;
    else if (belum > 0) tingkat = TINGKAT.WASPADA;

    return { pending, uploading, done, failed, belum, tingkat, lastError: a.lastError || null };
}

function ringkasPrinter({ dipilih, tersedia, cetakAktif, bypass } = {}) {
    const daftar = Array.isArray(tersedia) ? tersedia : [];

    if (bypass) {
        return { tingkat: TINGKAT.WASPADA, teks: 'MODE BYPASS — cetak dialihkan ke PDF' };
    }
    if (cetakAktif === false) {
        return { tingkat: TINGKAT.WASPADA, teks: 'CETAK OTOMATIS DIMATIKAN' };
    }
    if (daftar.length === 0) {
        return { tingkat: TINGKAT.KRITIS, teks: 'TIDAK ADA PRINTER TERDETEKSI' };
    }
    // Kelas kesalahan paling sering di lapangan: printer diganti atau namanya
    // berubah setelah driver diinstal ulang, sementara pengaturan masih
    // menunjuk nama lama. Cetak tetap jalan ke printer bawaan — diam-diam.
    if (dipilih && !daftar.includes(dipilih)) {
        return { tingkat: TINGKAT.KRITIS, teks: `PRINTER "${dipilih}" TIDAK DITEMUKAN — jatuh ke bawaan` };
    }
    if (!dipilih) {
        return { tingkat: TINGKAT.WASPADA, teks: 'BELUM ADA PRINTER DIPILIH — memakai bawaan sistem' };
    }
    return { tingkat: TINGKAT.OK, teks: dipilih };
}

// Menyaring seluruh diagnostik menjadi daftar hal yang benar-benar perlu
// ditindaklanjuti. Yang sehat tidak muncul — kalau semua ikut ditampilkan,
// yang penting tenggelam dan operator berhenti membacanya.
function daftarPeringatan(mentah) {
    const m = mentah || {};
    const keluar = [];

    if (m.pinBawaan) {
        keluar.push({ tingkat: TINGKAT.KRITIS, teks: 'PIN ADMIN MASIH BAWAAN (1234) — SEGERA GANTI' });
    }

    const disk = tingkatDisk(m.diskBebasBytes);
    if (disk !== TINGKAT.OK) {
        // "SISA DISK —" tidak memberi tahu apa pun. Bila angkanya memang tidak
        // terbaca, katakan begitu, jangan menyamar sebagai ruang yang menipis.
        keluar.push({
            tingkat: disk,
            teks: tidakDiketahui(m.diskBebasBytes)
                ? 'SISA DISK TIDAK TERBACA'
                : `SISA DISK ${formatBytes(m.diskBebasBytes)}` + (disk === TINGKAT.KRITIS ? ' — FOTO BISA GAGAL DISIMPAN' : ''),
        });
    }

    const printer = ringkasPrinter(m.printer);
    if (printer.tingkat !== TINGKAT.OK) keluar.push(printer);

    const antrean = ringkasAntrean(m.antrean);
    if (antrean.failed > 0) {
        keluar.push({ tingkat: TINGKAT.KRITIS, teks: `${antrean.failed} UNGGAHAN DRIVE GAGAL — BELUM ADA CADANGAN` });
    }

    // Mode online mengantar hasil lewat Drive. Tanpa akun tertaut, QR untuk
    // pelanggan tidak bisa dibuat sama sekali.
    if (m.modeOnline && !m.driveTerhubung) {
        keluar.push({ tingkat: TINGKAT.KRITIS, teks: 'MODE ONLINE TAPI GOOGLE DRIVE BELUM TERHUBUNG' });
    }

    return keluar.sort((a, b) => BOBOT[a.tingkat] - BOBOT[b.tingkat]);
}

// Tingkat paling parah di antara seluruh temuan — dipakai lampu ringkas
// di HP supaya kasir tahu ada masalah tanpa membuka tab STATUS.
function tingkatTertinggi(peringatan) {
    if (!Array.isArray(peringatan) || peringatan.length === 0) return TINGKAT.OK;
    return peringatan.reduce((t, p) => (BOBOT[p.tingkat] < BOBOT[t] ? p.tingkat : t), TINGKAT.OK);
}

module.exports = {
    GB, DISK_KRITIS, DISK_WASPADA, TINGKAT,
    formatBytes, tingkatDisk, ringkasAntrean, ringkasPrinter,
    daftarPeringatan, tingkatTertinggi,
};
