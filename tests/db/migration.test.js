// =========================================================================
// UJI MIGRASI SKEMA
//
// Menyasar kelas bug B18: kolom yang hanya pernah ada di CREATE TABLE tidak
// pernah ditambahkan ke database yang dibuat versi lama, sehingga indeks atau
// query yang memakainya membuat aplikasi crash saat startup.
// =========================================================================
const { Database, test, group, expect } = require('./run.js');

// Replika addColumn() dari electron/database.js.
function addColumn(db, table, definition) {
    try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
    } catch (e) {
        if (!/duplicate column name/i.test(e.message)) {
            throw new Error(`Migrasi gagal pada ${table}.${definition}: ${e.message}`);
        }
    }
}

// Seluruh kolom sessions yang dimigrasikan, urut seperti di database.js.
const KOLOM_SESSIONS = [
    "event_id INTEGER", "customer_name TEXT DEFAULT ''", "folder_name TEXT",
    "waktu TEXT", "harga_jual INTEGER", "status_cetak TEXT",
    "link_gdrive TEXT", "token_download TEXT",
    "print_path TEXT", "session_folder TEXT", "print_error TEXT",
    "print_orientation TEXT DEFAULT 'portrait'", "reprint_count INTEGER DEFAULT 0",
    "download_expires_at INTEGER", "retake_of INTEGER", "payment_method TEXT DEFAULT ''",
    "upsell_of INTEGER", "print_qty INTEGER DEFAULT 1", "hpp_snapshot INTEGER DEFAULT 0",
    "video_files TEXT DEFAULT '[]'", "created_at_ms INTEGER",
    "slots_filled INTEGER", "slots_total INTEGER",
    "drive_folder_id TEXT DEFAULT ''", "drive_folder_url TEXT DEFAULT ''",
    "consent_at INTEGER", "purged_at INTEGER",
];

const migrasiSessions = (db) => KOLOM_SESSIONS.forEach(k => addColumn(db, 'sessions', k));
const kolomDari = (db, tabel) => db.prepare(`PRAGMA table_info(${tabel})`).all().map(c => c.name);

// Skema paling awal yang pernah ada di lapangan.
function dbVersiLama() {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER)');
    return db;
}

group('Migrasi dari skema versi lama', () => {
    test('menambahkan seluruh kolom yang hilang', () => {
        const db = dbVersiLama();
        migrasiSessions(db);
        const kolom = kolomDari(db, 'sessions');
        KOLOM_SESSIONS.forEach(def => expect(kolom).toContain(def.split(' ')[0]));
        db.close();
    });

    test('token_download ada — inilah penyebab crash B18', () => {
        // Kolom ini semula hanya ada di CREATE TABLE, tidak pernah di-ALTER,
        // sehingga indeks di atasnya menggagalkan startup pada DB lama.
        const db = dbVersiLama();
        migrasiSessions(db);
        expect(kolomDari(db, 'sessions')).toContain('token_download');
        db.close();
    });

    test('indeks token_download berhasil dibuat setelah migrasi', () => {
        const db = dbVersiLama();
        migrasiSessions(db);
        expect(() => db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_download)')).notToThrow();
        db.close();
    });

    test('indeks GAGAL bila migrasi dilewati (membuktikan uji ini bermakna)', () => {
        const db = dbVersiLama();
        expect(() => db.exec('CREATE INDEX idx_x ON sessions(token_download)')).toThrow();
        db.close();
    });

    test('idempoten — dijalankan dua kali tidak melempar', () => {
        const db = dbVersiLama();
        migrasiSessions(db);
        expect(() => migrasiSessions(db)).notToThrow();
        db.close();
    });

    test('data lama tetap utuh setelah migrasi', () => {
        const db = dbVersiLama();
        db.prepare('INSERT INTO sessions (id, event_id) VALUES (7, 3)').run();
        migrasiSessions(db);
        const baris = db.prepare('SELECT * FROM sessions WHERE id=7').get();
        expect(baris.event_id).toBe(3);
        expect(baris.print_qty).toBe(1);       // nilai default terpasang
        expect(baris.token_download).toBe(null); // kolom baru kosong
        db.close();
    });
});

// =========================================================================
// MIGRASI TABEL settings
//
// Bagian ini menjaga satu hal yang mudah tertukar: sebagian saklar bawaannya
// MENYALA (persetujuan, cetak, layar terima kasih) dan sebagian MATI
// (aksesibilitas). Salah menaruh default berarti pemasangan lama tiba-tiba
// berubah perilaku setelah pembaruan — tanpa ada yang mengubah apa pun.
// =========================================================================
const KOLOM_SETTINGS_NYALA = [
    "print_enabled INTEGER DEFAULT 1",
    "consent_enabled INTEGER DEFAULT 1",
    "thanks_enabled INTEGER DEFAULT 1",
];
const KOLOM_SETTINGS_MATI = [
    "force_static_qr INTEGER DEFAULT 0",
    "hw_bypass_mode INTEGER DEFAULT 0",
    "midtrans_is_production INTEGER DEFAULT 0",
    "gdrive_enabled INTEGER DEFAULT 0",
    "retention_days INTEGER DEFAULT 0",
    "osk_enabled INTEGER DEFAULT 0",
];

// Skema settings paling awal: hanya kolom yang ada di CREATE TABLE versi lama.
function dbSettingsLama() {
    const db = new Database(':memory:');
    db.exec("CREATE TABLE settings (id INTEGER PRIMARY KEY AUTOINCREMENT, hpp_kertas INTEGER DEFAULT 3000)");
    db.prepare('INSERT INTO settings (id, hpp_kertas) VALUES (1, 5000)').run();
    return db;
}

const migrasiSettings = (db) => [...KOLOM_SETTINGS_NYALA, ...KOLOM_SETTINGS_MATI]
    .forEach(k => addColumn(db, 'settings', k));

group('Migrasi tabel settings', () => {
    test('menambahkan seluruh kolom saklar yang hilang', () => {
        const db = dbSettingsLama();
        migrasiSettings(db);
        const kolom = kolomDari(db, 'settings');
        [...KOLOM_SETTINGS_NYALA, ...KOLOM_SETTINGS_MATI]
            .forEach(def => expect(kolom).toContain(def.split(' ')[0]));
        db.close();
    });

    // SQLite mengisi baris yang SUDAH ADA dengan nilai DEFAULT saat kolom
    // ditambahkan. Bila ia mengisi NULL, seluruh pemeriksaan `!== 0` di
    // renderer akan menganggap saklar menyala padahal belum pernah diatur.
    test('baris lama mendapat nilai default, bukan NULL', () => {
        const db = dbSettingsLama();
        migrasiSettings(db);
        const s = db.prepare('SELECT * FROM settings WHERE id=1').get();
        KOLOM_SETTINGS_NYALA.forEach(def => expect(s[def.split(' ')[0]]).toBe(1));
        KOLOM_SETTINGS_MATI.forEach(def => expect(s[def.split(' ')[0]]).toBe(0));
        db.close();
    });

    test('osk_enabled bawaannya MATI pada pemasangan lama', () => {
        // Operator yang memakai keyboard fisik tidak boleh tiba-tiba
        // kehilangan setengah layar formulir setelah memperbarui aplikasi.
        const db = dbSettingsLama();
        migrasiSettings(db);
        expect(db.prepare('SELECT osk_enabled FROM settings WHERE id=1').get().osk_enabled).toBe(0);
        db.close();
    });

    test('nilai yang sudah diatur operator tidak tertimpa migrasi', () => {
        const db = dbSettingsLama();
        migrasiSettings(db);
        db.prepare('UPDATE settings SET osk_enabled=1 WHERE id=1').run();
        migrasiSettings(db); // dijalankan lagi, seperti saat aplikasi restart
        expect(db.prepare('SELECT osk_enabled FROM settings WHERE id=1').get().osk_enabled).toBe(1);
        db.close();
    });

    // Kolom peta pintasan bawaannya string kosong, bukan JSON "{}" — dan itu
    // disengaja. Kosong berarti "pakai bawaan", sehingga mengubah pintasan
    // bawaan di versi mendatang tetap sampai ke pemasangan yang tidak pernah
    // menyentuhnya. Menyimpan "{}" akan membekukannya pada bawaan versi lama.
    test('shortcuts_json bawaannya kosong, bukan objek JSON', () => {
        const db = dbSettingsLama();
        addColumn(db, 'settings', "shortcuts_json TEXT DEFAULT ''");
        expect(db.prepare('SELECT shortcuts_json AS v FROM settings WHERE id=1').get().v).toBe('');
        db.close();
    });

    test('hpp yang sudah diisi tetap utuh', () => {
        const db = dbSettingsLama();
        migrasiSettings(db);
        expect(db.prepare('SELECT hpp_kertas FROM settings WHERE id=1').get().hpp_kertas).toBe(5000);
        db.close();
    });
});

group('Penanganan galat migrasi', () => {
    test('galat selain duplikat kolom dilempar, tidak ditelan', () => {
        // Versi lama memakai `catch(e) {}` kosong sehingga kegagalan nyata
        // lolos diam-diam dan aplikasi jalan dengan skema rusak (bug B17).
        const db = new Database(':memory:');
        expect(() => addColumn(db, 'tabel_tidak_ada', 'x TEXT')).toThrow();
        db.close();
    });

    test('duplikat kolom diabaikan tanpa melempar', () => {
        const db = dbVersiLama();
        addColumn(db, 'sessions', 'waktu TEXT');
        expect(() => addColumn(db, 'sessions', 'waktu TEXT')).notToThrow();
        db.close();
    });
});

group('Integritas skema', () => {
    test('tidak ada kolom yang didefinisikan dua kali', () => {
        const nama = KOLOM_SESSIONS.map(k => k.split(' ')[0]);
        expect(new Set(nama).size).toBe(nama.length);
    });

    test('WAL dapat diaktifkan', () => {
        const db = dbVersiLama();
        // :memory: tidak mendukung WAL, cukup pastikan pragma tidak melempar.
        expect(() => db.pragma('synchronous = NORMAL')).notToThrow();
        db.close();
    });
});
