// =========================================================================
// VALIDASI AKSI JARAK JAUH DARI HP KASIR
//
// Kenapa ini berdiri sendiri dan bukan `if` di tengah route:
//
// Nilai yang datang lewat `/api/panel/:which` adalah potongan URL yang bisa
// diisi apa saja, lalu diteruskan ke renderer sebagai perintah membuka panel.
// Meneruskannya mentah-mentah berarti main process menjadi corong bagi
// siapa pun yang memegang token untuk menyuruh kiosk melakukan hal yang
// tidak pernah dirancang. Daftar putih di sini adalah satu-satunya pintu.
//
// Modul murni: tidak menyentuh Electron, database, maupun jaringan, sehingga
// aturannya bisa diuji tanpa menyalakan aplikasi.
// =========================================================================

// Panel admin — ketiganya tetap melewati gerbang PIN di layar kiosk.
// HP hanya MEMICU, tidak pernah membuka sendiri.
const PANEL_ADMIN = ['settings', 'template', 'dashboard'];

// Kendali sesi — setara /api/restart dan /api/close yang sudah ada:
// cukup token kasir, tanpa PIN. Alasannya konsisten, bukan kelonggaran:
// ketiganya mengendalikan alur kiosk, tidak membuka data atau pengaturan.
const KENDALI_SESI = ['landing'];

const PANEL_DIIZINKAN = [...PANEL_ADMIN, ...KENDALI_SESI];

const ARAH_TEMA = ['next', 'prev'];

function validasiPanel(nama) {
    if (!PANEL_DIIZINKAN.includes(nama)) {
        return { ok: false, error: 'Panel tidak dikenal.' };
    }
    return { ok: true, nilai: nama };
}

function validasiArahTema(arah) {
    if (!ARAH_TEMA.includes(arah)) {
        return { ok: false, error: 'Arah tema tidak dikenal.' };
    }
    return { ok: true, nilai: arah };
}

// Dipakai renderer untuk memutuskan apakah aksi ini perlu gerbang PIN.
function butuhPin(nama) {
    return PANEL_ADMIN.includes(nama);
}

module.exports = {
    PANEL_ADMIN,
    KENDALI_SESI,
    PANEL_DIIZINKAN,
    ARAH_TEMA,
    validasiPanel,
    validasiArahTema,
    butuhPin,
};
