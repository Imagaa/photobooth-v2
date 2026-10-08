// =========================================================================
// HALAMAN UNDUHAN PELANGGAN
// Dibuka dari QR di layar hasil. Melayani foto dan video sesi.
// Halaman ini dirender di server dan memuat nama pelanggan, jadi semua nilai
// dinamis WAJIB di-escape.
// =========================================================================

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatExpiry(epochMs) {
    if (!epochMs) return 'Tidak dibatasi';
    return new Date(epochMs).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * @param {object} session baris sessions
 * @param {string[]} videos daftar nama file video yang benar-benar ada di disk
 */
function renderDownloadPage(session, videos, drive = {}) {
    const token = encodeURIComponent(session.token_download);
    const name = escapeHtml(session.customer_name || 'Tanpa Nama');
    const expiry = escapeHtml(formatExpiry(session.download_expires_at));

    const videoBlocks = videos.map((file, i) => {
        const isMp4 = /\.mp4$/i.test(file);
        return `
        <div class="card">
            <div class="card-title">VIDEO ${i + 1}</div>
            <video controls preload="metadata" playsinline src="/d/${token}/video/${i}"></video>
            <a class="btn" href="/d/${token}/video/${i}?dl=1" download>[ SIMPAN VIDEO ${i + 1} ]</a>
            ${isMp4 ? '' : '<p class="warn">Format WebM — di iPhone mungkin perlu dibuka lewat aplikasi pemutar video.</p>'}
        </div>`;
    }).join('');

    return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>SayGumi! - Hasil Foto ${name}</title>
<style>
    @font-face {
        font-family: 'Press Start 2P';
        font-style: normal; font-weight: 400; font-display: block;
        src: url('/fonts/PressStart2P-Regular.ttf') format('truetype');
    }
    * { box-sizing: border-box; }
    body {
        margin: 0; padding: 20px 14px 40px; background: #007CC3; color: #111;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        background-image: linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
        background-size: 15px 15px;
    }
    .wrap { max-width: 520px; margin: 0 auto; }
    h1 { font-family: 'Press Start 2P', cursive; font-size: 20px; color: #FFD453; text-align: center;
         text-shadow: 4px 4px 0 #FF3B67; margin: 10px 0 6px; }
    .sub { text-align: center; color: #fff; font-weight: 700; margin-bottom: 20px; font-size: 15px; }
    .card { background: #fff; border: 6px solid #111; box-shadow: 8px 8px 0 rgba(0,0,0,0.35);
            padding: 14px; margin-bottom: 22px; }
    .card-title { font-family: 'Press Start 2P', cursive; font-size: 10px; margin-bottom: 12px; color: #007CC3; }
    img, video { display: block; width: 100%; height: auto; border: 3px solid #111; background: #eee; }
    .btn { display: block; text-align: center; margin-top: 12px; padding: 16px 10px;
           font-family: 'Press Start 2P', cursive; font-size: 11px; line-height: 1.6;
           background: #FFD453; color: #111; border: 4px solid #111; box-shadow: 4px 4px 0 #111;
           text-decoration: none; }
    .btn:active { box-shadow: none; transform: translate(4px, 4px); }
    .note { background: rgba(0,0,0,0.35); color: #fff; border: 3px dashed rgba(255,255,255,0.5);
            padding: 12px; font-size: 13px; line-height: 1.6; text-align: center; }
    .empty { text-align: center; color: #666; font-size: 14px; padding: 10px 0; }
    .warn { margin: 10px 0 0; font-size: 12px; line-height: 1.5; color: #8a5a00; background: #FFF3D0;
            border: 2px solid #E5A93B; padding: 8px; }
    .drive-info { margin: 0; font-size: 14px; line-height: 1.6; color: #333; }
    .btn-drive { background: #1a73e8; color: #fff; }
</style>
</head>
<body>
<div class="wrap">
    <h1>SayGumi!</h1>
    <div class="sub">Hasil sesi: ${name}</div>

    <div class="card">
        <div class="card-title">FOTO</div>
        <img src="/d/${token}/photo" alt="Hasil foto">
        <a class="btn" href="/d/${token}/photo?dl=1" download>[ SIMPAN FOTO ]</a>
    </div>

    ${videos.length ? videoBlocks : '<div class="card"><div class="card-title">VIDEO</div><div class="empty">Tidak ada rekaman video untuk sesi ini.</div></div>'}

    ${drive.folderUrl ? `
    <div class="card">
        <div class="card-title">SIMPAN PERMANEN</div>
        <p class="drive-info">
            Semua foto dan video sesi ini juga tersimpan di Google Drive.
            Link Drive <b>tidak kedaluwarsa</b> — simpan atau bagikan ke temanmu.
        </p>
        ${drive.pending > 0 ? `<p class="warn">Masih ada ${drive.pending} file yang sedang diunggah. Prosesnya bisa memakan waktu beberapa menit — buka lagi link Drive-nya nanti untuk melihat file terbaru.</p>` : ''}
        <a class="btn btn-drive" href="${escapeHtml(drive.folderUrl)}" target="_blank" rel="noopener">[ BUKA FOLDER GOOGLE DRIVE ]</a>
    </div>` : ''}

    <div class="note">Link lokal ini berlaku sampai<br><b>${expiry}</b><br><br>Simpan filemu sekarang ya!</div>
</div>
</body>
</html>`;
}

module.exports = { renderDownloadPage, escapeHtml };
