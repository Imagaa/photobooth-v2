// =========================================================================
// UJI ATURAN RETENSI (AUTO-PURGE)
//
// Auto-purge menghapus berkas secara permanen, jadi aturan seleksinya harus
// tepat. Yang paling berbahaya: menghapus sesi yang cadangan Drive-nya belum
// selesai — itu kehilangan permanen, bukan sekadar merepotkan.
// =========================================================================
const { Database, test, group, expect } = require('./run.js');

const HARI = 24 * 3600 * 1000;

// Query seleksi yang sama persis dengan purgeOldMedia() di electron/main.js.
const SQL_SELEKSI = `
    SELECT s.id FROM sessions s
    WHERE s.purged_at IS NULL
      AND s.created_at_ms IS NOT NULL
      AND s.created_at_ms < ?
      AND s.session_folder IS NOT NULL AND s.session_folder != ''
      AND NOT EXISTS (
          SELECT 1 FROM upload_queue q
          WHERE q.session_id = s.id AND q.status IN ('pending','uploading')
      )
`;

function buatDb() {
    const db = new Database(':memory:');
    db.exec(`
        CREATE TABLE sessions (
            id INTEGER PRIMARY KEY, created_at_ms INTEGER,
            session_folder TEXT, purged_at INTEGER
        );
        CREATE TABLE upload_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER, status TEXT
        );
    `);
    return db;
}

const tambahSesi = (db, id, umurHari, opts = {}) =>
    db.prepare('INSERT INTO sessions (id, created_at_ms, session_folder, purged_at) VALUES (?,?,?,?)')
      .run(id, opts.tanpaTimestamp ? null : Date.now() - umurHari * HARI,
           opts.folder !== undefined ? opts.folder : `C:/out/${id}`,
           opts.purgedAt || null);

const antre = (db, sessionId, status) =>
    db.prepare('INSERT INTO upload_queue (session_id, status) VALUES (?,?)').run(sessionId, status);

const seleksi = (db, retensiHari) =>
    db.prepare(SQL_SELEKSI).all(Date.now() - retensiHari * HARI).map(r => r.id);

group('Seleksi auto-purge', () => {
    test('memilih sesi yang melewati batas retensi', () => {
        const db = buatDb();
        tambahSesi(db, 1, 40);
        expect(seleksi(db, 30)).toEqual([1]);
        db.close();
    });

    test('melewati sesi yang masih dalam batas', () => {
        const db = buatDb();
        tambahSesi(db, 1, 5);
        expect(seleksi(db, 30)).toEqual([]);
        db.close();
    });

    test('TIDAK menghapus sesi yang unggahannya masih pending', () => {
        // Paling penting: menghapus sebelum cadangan Drive selesai berarti
        // berkas pelanggan hilang permanen.
        const db = buatDb();
        tambahSesi(db, 1, 40);
        antre(db, 1, 'pending');
        expect(seleksi(db, 30)).toEqual([]);
        db.close();
    });

    test('TIDAK menghapus sesi yang sedang diunggah', () => {
        const db = buatDb();
        tambahSesi(db, 1, 40);
        antre(db, 1, 'uploading');
        expect(seleksi(db, 30)).toEqual([]);
        db.close();
    });

    test('boleh menghapus bila unggahan sudah selesai', () => {
        const db = buatDb();
        tambahSesi(db, 1, 40);
        antre(db, 1, 'done');
        expect(seleksi(db, 30)).toEqual([1]);
        db.close();
    });

    test('boleh menghapus bila unggahan gagal permanen', () => {
        // Berkas gagal diunggah setelah 8 percobaan; menahannya selamanya
        // justru membuat retensi tidak pernah berjalan.
        const db = buatDb();
        tambahSesi(db, 1, 40);
        antre(db, 1, 'failed');
        expect(seleksi(db, 30)).toEqual([1]);
        db.close();
    });

    test('tidak memproses ulang sesi yang sudah dihapus', () => {
        const db = buatDb();
        tambahSesi(db, 1, 40, { purgedAt: Date.now() });
        expect(seleksi(db, 30)).toEqual([]);
        db.close();
    });

    test('melewati baris lama tanpa timestamp', () => {
        // Baris dari sebelum kolom created_at_ms ada. Menghapusnya berarti
        // menebak umurnya — tidak boleh.
        const db = buatDb();
        tambahSesi(db, 1, 40, { tanpaTimestamp: true });
        expect(seleksi(db, 30)).toEqual([]);
        db.close();
    });

    test('melewati baris tanpa folder sesi', () => {
        const db = buatDb();
        tambahSesi(db, 1, 40, { folder: '' });
        tambahSesi(db, 2, 40, { folder: null });
        expect(seleksi(db, 30)).toEqual([]);
        db.close();
    });

    test('memilih hanya yang memenuhi syarat dari campuran', () => {
        const db = buatDb();
        tambahSesi(db, 1, 40);                              // layak
        tambahSesi(db, 2, 5);                               // terlalu baru
        tambahSesi(db, 3, 40, { purgedAt: Date.now() });    // sudah dihapus
        tambahSesi(db, 4, 40, { tanpaTimestamp: true });    // tanpa timestamp
        tambahSesi(db, 5, 40, { folder: '' });              // tanpa folder
        tambahSesi(db, 6, 40); antre(db, 6, 'pending');     // unggahan tertunda
        tambahSesi(db, 7, 40); antre(db, 7, 'done');        // layak
        expect(seleksi(db, 30)).toEqual([1, 7]);
        db.close();
    });
});

group('Ambang retensi', () => {
    test('batas dihitung dari umur, bukan urutan id', () => {
        const db = buatDb();
        tambahSesi(db, 10, 100);
        tambahSesi(db, 20, 1);
        expect(seleksi(db, 30)).toEqual([10]);
        db.close();
    });

    test('retensi lebih longgar menyisakan lebih sedikit kandidat', () => {
        const db = buatDb();
        tambahSesi(db, 1, 40);
        expect(seleksi(db, 30)).toEqual([1]);
        expect(seleksi(db, 90)).toEqual([]);
        db.close();
    });
});
