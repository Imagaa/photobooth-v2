const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

const dbPath = path.join(app.getPath('userData'), 'photobooth_v2.db');
const db = new Database(dbPath);

db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hpp_kertas INTEGER DEFAULT 3000,
        hpp_tinta INTEGER DEFAULT 2000,
        biaya_ops INTEGER DEFAULT 0,
        midtrans_server_key TEXT DEFAULT '',
        midtrans_client_key TEXT DEFAULT '',
        app_mode TEXT DEFAULT 'online',
        static_qr_path TEXT DEFAULT '',
        force_static_qr INTEGER DEFAULT 0,
        gdrive_folder_id TEXT DEFAULT '',
        selected_camera TEXT DEFAULT '',
        selected_printer TEXT DEFAULT '',
        hw_bypass_mode INTEGER DEFAULT 0,
        active_theme TEXT DEFAULT 'candy'
    );
    CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE,
        filepath TEXT,
        is_free INTEGER DEFAULT 0,
        price INTEGER DEFAULT 15000,
        is_visible INTEGER DEFAULT 1,
        width INTEGER,
        height INTEGER,
        slots_json TEXT DEFAULT '[]',
        orientation TEXT DEFAULT 'portrait'
    );
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_event TEXT,
        folder_name TEXT,
        saldo_awal INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        templates_json TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER,
        customer_name TEXT DEFAULT '',
        folder_name TEXT,
        waktu TEXT,
        harga_jual INTEGER,
        status_cetak TEXT,
        link_gdrive TEXT,
        token_download TEXT
    );
`);

const stmt = db.prepare('SELECT COUNT(*) as count FROM settings');
if (stmt.get().count === 0) {
    db.prepare(`
        INSERT INTO settings (hpp_kertas, hpp_tinta, biaya_ops, midtrans_server_key, midtrans_client_key, app_mode, active_theme) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(3000, 2000, 0, '', '', 'online', 'candy');
}

// ==========================================
// FORCE MIGRATION (ANTI DATA HILANG)
// Hanya error "kolom sudah ada" yang boleh diabaikan. Kegagalan migrasi lain
// harus dilempar, bukan ditelan diam-diam sampai aplikasi jalan dengan skema rusak.
// ==========================================
function addColumn(table, definition) {
    try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
    } catch (e) {
        if (!/duplicate column name/i.test(e.message)) {
            throw new Error(`Migrasi gagal pada ${table}.${definition}: ${e.message}`);
        }
    }
}

addColumn('sessions', "event_id INTEGER");
addColumn('sessions', "customer_name TEXT DEFAULT ''");
addColumn('sessions', "folder_name TEXT");
addColumn('sessions', "waktu TEXT");
addColumn('sessions', "harga_jual INTEGER");
addColumn('sessions', "status_cetak TEXT");
// Keduanya hanya pernah ada di CREATE TABLE, jadi database yang dibuat versi
// lama tidak memilikinya. token_download sekarang dipakai untuk link download
// dan diindeks, jadi wajib dimigrasikan.
addColumn('sessions', "link_gdrive TEXT");
addColumn('sessions', "token_download TEXT");

// KOLOM FITUR FASE 3 (QR & HARDWARE)
addColumn('settings', "static_qr_path TEXT DEFAULT ''");
addColumn('settings', "force_static_qr INTEGER DEFAULT 0");
addColumn('settings', "gdrive_folder_id TEXT DEFAULT ''");
addColumn('settings', "selected_camera TEXT DEFAULT ''");
addColumn('settings', "selected_printer TEXT DEFAULT ''");
addColumn('settings', "hw_bypass_mode INTEGER DEFAULT 0");

// KOLOM FITUR FASE 4 (ORIENTASI TEMPLATE)
addColumn('templates', "orientation TEXT DEFAULT 'portrait'");

// KOLOM FITUR FASE 5 (TEMA DINAMIS)
addColumn('settings', "active_theme TEXT DEFAULT 'candy'");

// KOLOM FITUR FASE 6 (CETAK FISIK)
addColumn('settings', "print_copies INTEGER DEFAULT 1");
addColumn('settings', "print_paper_size TEXT DEFAULT ''");
addColumn('settings', "print_enabled INTEGER DEFAULT 1");
// print_path & session_folder dibutuhkan agar reprint bisa menemukan file aslinya.
addColumn('sessions', "print_path TEXT");
addColumn('sessions', "session_folder TEXT");
addColumn('sessions', "print_error TEXT");
addColumn('sessions', "print_orientation TEXT DEFAULT 'portrait'");
addColumn('sessions', "reprint_count INTEGER DEFAULT 0");

// KOLOM FITUR FASE 7 (KEAMANAN AKSES KASIR & DOWNLOAD)
addColumn('settings', "cashier_token TEXT DEFAULT ''");
addColumn('settings', "download_ttl_hours INTEGER DEFAULT 24");
addColumn('sessions', "download_expires_at INTEGER");

// KOLOM FITUR FASE 8 (OTORISASI PEMBAYARAN)
addColumn('settings', "midtrans_is_production INTEGER DEFAULT 0");
// Retake tidak boleh dihitung sebagai penjualan baru; barisnya ditandai dan
// harga_jual-nya nol agar laporan tidak menggandakan pendapatan.
addColumn('sessions', "retake_of INTEGER");
addColumn('sessions', "payment_method TEXT DEFAULT ''");

// KOLOM FITUR FASE 11 (UPSELLING CETAK TAMBAHAN)
// upsell_price 0 berarti "ikuti harga awal sesi", bukan gratis.
addColumn('events', "upsell_enabled INTEGER DEFAULT 0");
addColumn('events', "upsell_price INTEGER DEFAULT 0");
// Baris upsell tertaut ke sesi asal; ia menambah omzet tapi bukan sesi foto baru.
addColumn('sessions', "upsell_of INTEGER");
// Jumlah lembar yang dicetak baris ini — dasar perhitungan beban HPP.
addColumn('sessions', "print_qty INTEGER DEFAULT 1");
// HPP per lembar SAAT transaksi terjadi. Tanpa ini, mengubah setting HPP
// mengubah laporan historis secara retroaktif (bug B2).
addColumn('sessions', "hpp_snapshot INTEGER DEFAULT 0");

// KOLOM FITUR FASE 10 (PENGIRIMAN VIDEO)
// Daftar nama file video milik sesi, JSON array. Dulu video direkam tapi tidak
// pernah tercatat maupun diberikan ke pelanggan.
addColumn('sessions', "video_files TEXT DEFAULT '[]'");

// KOLOM FITUR FASE 12 (STABILISASI LAPANGAN)
// Operator bisa mengunci alamat IP bila deteksi otomatis memilih adapter
// VPN/Hyper-V yang tidak terjangkau HP pelanggan (bug B11).
addColumn('settings', "server_ip_override TEXT DEFAULT ''");
// Timestamp epoch agar riwayat bisa disortir & difilter rentang tanggal;
// kolom waktu yang lama hanya string tampilan (bug B6).
addColumn('sessions', "created_at_ms INTEGER");
// Berapa slot benar-benar terisi saat lembar dirender (bug B15).
addColumn('sessions', "slots_filled INTEGER");
addColumn('sessions', "slots_total INTEGER");

// KOLOM FITUR FASE 13 (GOOGLE DRIVE)
// client_secret & refresh_token disimpan terenkripsi lewat safeStorage.
addColumn('settings', "gdrive_enabled INTEGER DEFAULT 0");
addColumn('settings', "gdrive_client_id TEXT DEFAULT ''");
addColumn('settings', "gdrive_client_secret TEXT DEFAULT ''");
addColumn('settings', "gdrive_refresh_token TEXT DEFAULT ''");
addColumn('settings', "gdrive_account_email TEXT DEFAULT ''");
// Folder Drive milik event, sekaligus folder dokumentasi owner.
addColumn('events', "drive_folder_id TEXT DEFAULT ''");
addColumn('events', "drive_folder_url TEXT DEFAULT ''");
// Subfolder per pelanggan; inilah alamat yang masuk ke QR.
addColumn('sessions', "drive_folder_id TEXT DEFAULT ''");
addColumn('sessions', "drive_folder_url TEXT DEFAULT ''");

// KOLOM FITUR FASE 14 (KEPATUHAN DATA PRIBADI)
// Layar persetujuan sebelum sesi. Default menyala karena ini soal kepatuhan.
addColumn('settings', "consent_enabled INTEGER DEFAULT 1");
// Umur maksimum berkas media dalam hari. 0 = tidak menghapus apa pun.
// Sengaja default 0 agar tidak ada penghapusan yang mengejutkan operator.
addColumn('settings', "retention_days INTEGER DEFAULT 0");
// Jejak audit: kapan pelanggan menyetujui, dan kapan medianya dihapus.
addColumn('sessions', "consent_at INTEGER");
addColumn('sessions', "purged_at INTEGER");

// KOLOM FITUR FASE 15 (WAKTU SESI)
// Durasi sesi foto, dan lantai waktu yang dijamin saat pelanggan menekan retake
// di menit terakhir (bug B4).
addColumn('settings', "session_minutes INTEGER DEFAULT 10");
addColumn('settings', "retake_min_seconds INTEGER DEFAULT 90");

// KOLOM FITUR FASE 16 (LAYAR TERIMA KASIH)
// Layar penutup singkat setelah pelanggan menekan SELESAI. Teksnya dibuat
// bisa diubah karena tiap penyelenggara punya gaya sapaan sendiri, dan
// durasinya karena antrean panjang butuh perpisahan yang lebih cepat.
addColumn('settings', "thanks_enabled INTEGER DEFAULT 1");
addColumn('settings', "thanks_seconds INTEGER DEFAULT 3");
addColumn('settings', "thanks_message TEXT DEFAULT ''");

// KOLOM FITUR FASE 17 (AKSESIBILITAS)
// Keyboard on-screen untuk panel admin. Default MATI: operator yang memakai
// keyboard fisik tidak boleh tiba-tiba kehilangan setengah layar formulir.
// Yang membutuhkannya adalah kiosk layar sentuh murni — dan itu keputusan
// pemasangan, bukan sesuatu yang pantas ditebak aplikasi.
addColumn('settings', "osk_enabled INTEGER DEFAULT 0");
// Peta pintasan keyboard. Kosong = pakai bawaan, dan itu disengaja: hanya
// yang benar-benar diubah operator yang disimpan, sehingga mengubah bawaan
// di versi mendatang tetap sampai ke pemasangan yang tidak pernah menyentuhnya.
addColumn('settings', "shortcuts_json TEXT DEFAULT ''");

// KOLOM FITUR FASE 9 (PIN ADMIN)
// Disimpan sebagai scrypt hash bersalt. Kosong = PIN belum pernah diatur.
addColumn('settings', "admin_pin_hash TEXT DEFAULT ''");

// Antrean unggah Drive. Disimpan di DB (bukan memori) supaya antrean bertahan
// melewati restart aplikasi dan pemadaman listrik di tengah acara.
db.exec(`
    CREATE TABLE IF NOT EXISTS upload_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        event_id INTEGER,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        kind TEXT NOT NULL,
        priority INTEGER DEFAULT 100,
        status TEXT DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        last_error TEXT,
        drive_file_id TEXT,
        created_at_ms INTEGER,
        updated_at_ms INTEGER
    );
`);
db.exec("CREATE INDEX IF NOT EXISTS idx_queue_status ON upload_queue(status, priority)");
db.exec("CREATE INDEX IF NOT EXISTS idx_queue_event ON upload_queue(event_id)");

// Link download divalidasi lewat token, jadi kolom ini jadi jalur lookup utama.
db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_download)");

// Query riwayat & dashboard selalu memfilter event_id.
db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_event ON sessions(event_id)");

// WAL memberi throughput tulis jauh lebih baik untuk pola beban kiosk ini.
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

module.exports = db;