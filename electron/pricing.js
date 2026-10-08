// =========================================================================
// ATURAN HARGA
//
// Seluruh penentuan harga terjadi di main process — renderer tidak pernah
// boleh menentukan nominal (temuan S2). Fungsi di sini murni: ia menerima
// data yang sudah dibaca dari DB, bukan mengaksesnya sendiri, supaya bisa
// diuji tanpa database maupun runtime Electron.
// =========================================================================

/**
 * Harga frame untuk satu event, diambil dari snapshot templates_json milik
 * event tersebut — bukan dari harga master template, karena operator bisa
 * meng-override harga per event.
 *
 * @returns {number|null} null berarti template tidak terdaftar pada event ini
 */
function getEventTemplatePrice(templatesJson, templateId) {
    let list = [];
    try { list = JSON.parse(templatesJson || '[]'); } catch { return null; }
    if (!Array.isArray(list)) return null;

    const tpl = list.find(t => String(t.id) === String(templateId));
    if (!tpl) return null;
    return Number(tpl.override_price) || 0;
}

/**
 * Harga satu lembar cetak tambahan.
 *
 * Urutan aturannya:
 *   1. upsell_price event bila diisi (> 0)
 *   2. harga asli sesi tersebut
 *   3. untuk baris retake yang harganya 0, telusuri ke sesi induknya —
 *      tanpa ini pelanggan mendapat harga nol hanya karena sesinya kebetulan
 *      hasil retake
 *   4. nol (event gratis) — tetap butuh persetujuan kasir, bukan lolos otomatis
 *
 * @param {function} lookupParent (id) => baris sesi induk, boleh mengembalikan null
 * @returns {number|null} null berarti upsell tidak diaktifkan untuk event ini
 */
function getUpsellUnitPrice(session, event, lookupParent = () => null) {
    if (!event || !event.upsell_enabled) return null;

    const override = Number(event.upsell_price) || 0;
    if (override > 0) return override;

    if (session.harga_jual > 0) return session.harga_jual;

    if (session.retake_of) {
        const parent = lookupParent(session.retake_of);
        if (parent && parent.harga_jual > 0) return parent.harga_jual;
    }
    return 0;
}

const MAX_UPSELL_QTY = 10;

function validateUpsellQty(qty) {
    // Sengaja memakai Number(), bukan parseInt(): parseInt('1.5') menghasilkan 1
    // sehingga input pecahan diterima diam-diam dan dipotong. Menolaknya terang-
    // terangan lebih baik daripada menagih jumlah yang tidak diminta pemanggil.
    const jumlah = Number(qty);
    if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > MAX_UPSELL_QTY) {
        return { valid: false, error: `Jumlah cetak harus bilangan bulat 1-${MAX_UPSELL_QTY}.` };
    }
    return { valid: true, qty: jumlah };
}

/** Metode pembayaran yang berlaku untuk suatu nominal & mode aplikasi. */
function resolvePaymentMethod({ total, appMode, forceStaticQr }) {
    // Nominal nol TIDAK lolos otomatis: event gratis tetap butuh persetujuan
    // kasir supaya cetak tambahan tidak bisa diambil tanpa batas.
    if (total <= 0) return 'manual';
    if (appMode === 'offline' || forceStaticQr === 1) return 'manual';
    return 'midtrans';
}

module.exports = {
    MAX_UPSELL_QTY,
    getEventTemplatePrice,
    getUpsellUnitPrice,
    validateUpsellQty,
    resolvePaymentMethod,
};
