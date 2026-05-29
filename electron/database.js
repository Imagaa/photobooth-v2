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
        app_mode TEXT DEFAULT 'online'
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
        slots_json TEXT DEFAULT '[]'
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
        INSERT INTO settings (hpp_kertas, hpp_tinta, biaya_ops, midtrans_server_key, midtrans_client_key, app_mode) 
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(3000, 2000, 0, '', '', 'online');
}

// FORCE MIGRATION
try { db.exec("ALTER TABLE sessions ADD COLUMN event_id INTEGER"); } catch(e) {}
try { db.exec("ALTER TABLE sessions ADD COLUMN customer_name TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE sessions ADD COLUMN folder_name TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE sessions ADD COLUMN waktu TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE sessions ADD COLUMN harga_jual INTEGER"); } catch(e) {}
try { db.exec("ALTER TABLE sessions ADD COLUMN status_cetak TEXT"); } catch(e) {}

// KOLOM FITUR BARU FASE 3
try { db.exec("ALTER TABLE settings ADD COLUMN static_qr_path TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE settings ADD COLUMN force_static_qr INTEGER DEFAULT 0"); } catch(e) {}
try { db.exec("ALTER TABLE settings ADD COLUMN gdrive_folder_id TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE settings ADD COLUMN selected_camera TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE settings ADD COLUMN selected_printer TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE settings ADD COLUMN hw_bypass_mode INTEGER DEFAULT 0"); } catch(e) {}

module.exports = db;