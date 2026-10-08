import { useState } from 'react';
import { useStore } from '../store/useStore';
import { useSession } from '../session/context';

// =========================================================================
// LAYAR HASIL
//
// Dua kotak, dan susunannya SAMA untuk template portrait maupun landscape:
//
//   kiri  → photostrip, mendapat seluruh ruang kotaknya
//   kanan → video di balik layar + tiga tombol aksi
//
// QR tidak lagi ditempel di layar ini. Dulu QR, penjelasan cara scan, status
// cetak, dan tombol berebut ruang di kotak kanan sehingga layarnya penuh dan
// tidak ada yang menonjol. Sekarang QR pindah ke popup yang dibuka tombol
// "Download Softfile" — pelanggan yang tidak butuh softfile tidak perlu
// melihatnya sama sekali.
// =========================================================================

export default function ResultScreen() {
  const finalResult = useStore(s => s.finalResult);
  const printStatus = useStore(s => s.printStatus);
  const upsellAvailable = useStore(s => s.upsellAvailable);
  const setScreen = useStore(s => s.setScreen);
  const thanksEnabled = useStore(s => s.settings?.thanks_enabled !== 0);
  const { triggerPrint, openUpsell, resetSession } = useSession();

  const selesai = () => {
    // Sesi dibersihkan lebih dulu, baru layar penutup ditampilkan — layar
    // terima kasih tidak memakai data sesi apa pun, jadi tidak ada gunanya
    // menahan foto dan URL pratinjau di memori selama beberapa detik itu.
    resetSession();
    setScreen(thanksEnabled ? 'thanks' : 'landing');
  };

  const [qrTerbuka, setQrTerbuka] = useState(false);

  const videos = finalResult?.previewVideoUrls || [];
  const adaVideo = videos.length > 0;
  const adaQr = !!finalResult?.qrCode;

  // Sesi tanpa cetak fisik. Dua jalur berbeda di main process bermuara ke
  // sini: cetak sengaja dimatikan (photobooth digital-only), dan mode
  // troubleshooting yang mengalihkan hasil ke PDF. Bagi pelanggan keduanya
  // sama saja — tidak ada lembar yang keluar — jadi keduanya diceritakan
  // sebagai fitur, bukan sebagai kegagalan atau istilah teknis.
  const tanpaCetak = printStatus.mode === 'skipped' || printStatus.mode === 'pdf';

  // Menawarkan "cetak lagi" pada sesi yang cetaknya memang dimatikan adalah
  // menagih pelanggan untuk sesuatu yang tidak akan keluar. Mode PDF tidak
  // ikut disembunyikan — itu mode uji coba operator, yang justru perlu
  // menjalankan alur upsell sampai selesai.
  const bolehUpsell = upsellAvailable && printStatus.mode !== 'skipped';

  return (
    <div className="flex flex-col h-screen p-5 gap-4 overflow-hidden z-10" style={{ backgroundColor: 'var(--color-bg)' }}>

      <div className="flex items-baseline justify-center gap-5 shrink-0">
        <h1 className="font-pixel text-2xl drop-shadow-[4px_4px_0_#000] whitespace-nowrap" style={{ color: 'var(--color-secondary)' }}>SayGumi!</h1>
        <h2 className="font-sys text-2xl font-bold text-white drop-shadow-[2px_2px_0_#000]">
          {tanpaCetak ? 'Selesai! Fotomu siap diunduh' : 'Selesai! Fotomu sedang dicetak'}
        </h2>
      </div>

      <div className="flex gap-5 flex-1 min-h-0">

        {/* ===================== KOTAK KIRI — PHOTOSTRIP ===================== */}
        <div className="w-[56%] bg-white border-8 border-black p-4 flex items-center justify-center min-h-0" style={{ boxShadow: '10px 10px 0 0 var(--color-secondary)' }}>
          <img src={finalResult?.previewUrl} className="max-h-full max-w-full object-contain border-4 border-gray-300 bg-white" alt="Hasil foto" />
        </div>

        {/* ================= KOTAK KANAN — VIDEO + AKSI ================= */}
        <div className="flex-1 bg-white border-8 border-black p-5 flex flex-col items-center gap-4 min-h-0" style={{ boxShadow: '10px 10px 0 0 var(--color-accent)' }}>

          {adaVideo ? (
            <div className="w-full flex-1 min-h-0 flex flex-col gap-2 items-center justify-center">
              <p className="font-pixel text-[10px] text-center whitespace-nowrap shrink-0" style={{ color: 'var(--color-primary)' }}>
                VIDEO DI BALIK LAYAR{videos.length > 1 ? ` (${videos.length})` : ''}
              </p>
              {/* `h-full w-auto` — bukan lebar penuh + object-contain. Elemen
                  video jadi selebar rasio aslinya, sehingga tidak ada bilah
                  hitam di kiri-kanan dan gambarnya tidak terlihat gepeng. */}
              <div className="flex gap-3 w-full flex-1 min-h-0 justify-center items-center">
                {videos.map((url, i) => (
                  <video
                    key={url}
                    src={url}
                    className="h-full w-auto max-w-full border-4 border-black"
                    autoPlay={i === 0}
                    muted
                    loop
                    playsInline
                    controls={videos.length > 1}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full flex-1 min-h-0 flex items-center justify-center">
              <p className="font-sys text-xl font-bold text-gray-400 text-center leading-snug px-4">
                Foto kamu sudah siap.<br />Ambil softfile-nya lewat tombol di bawah.
              </p>
            </div>
          )}

          {/* --- status cetak --- */}
          {printStatus.state === 'error' ? (
            <div className="w-full border-4 border-black p-3 text-center shrink-0" style={{ backgroundColor: 'var(--color-accent)' }}>
              <p className="font-pixel text-[9px] text-white leading-relaxed">[ CETAK GAGAL ]</p>
              <p className="font-sys text-white text-sm font-bold mt-1 leading-tight break-words">{printStatus.message}</p>
              <button onClick={() => triggerPrint(finalResult?.sessionId)} className="mt-2 w-full text-black border-4 border-black font-pixel py-3 text-[9px] shadow-[3px_3px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>[ COBA CETAK LAGI ]</button>
            </div>
          ) : (
            <div className="w-full border-4 border-black p-3 text-center shrink-0 bg-gray-100">
              <p className={`font-sys text-base font-bold text-gray-700 leading-snug ${printStatus.state === 'printing' ? 'animate-pulse' : ''}`}>
                {tanpaCetak
                  ? <>📱 <b>Sesi digital</b> — tanpa cetak fisik. Semua fotomu tersimpan aman dan siap diunduh.</>
                  : printStatus.state === 'ok'
                    ? <>🖨️ Fotomu <b>sedang dicetak</b>. Ambil di tempat keluar kertas, ya.</>
                    : <>🖨️ Menyiapkan cetakan…</>}
              </p>
            </div>
          )}

          {/* --- tiga tombol aksi --- */}
          <div className="w-full flex flex-col gap-3 shrink-0">
            <button onClick={() => setQrTerbuka(true)} className="text-white border-4 border-black font-pixel w-full py-5 text-sm shadow-[5px_5px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-primary)' }}>[ DOWNLOAD SOFTFILE ]</button>
            {bolehUpsell && (
              <button onClick={openUpsell} className="text-white border-4 border-black font-pixel w-full py-5 text-sm shadow-[5px_5px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-accent)' }}>[ CETAK LAGI ]</button>
            )}
            <button onClick={selesai} className="text-black border-4 border-black font-pixel w-full py-5 text-sm shadow-[5px_5px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>[ SELESAI ]</button>
          </div>
        </div>
      </div>

      {qrTerbuka && (
        <PopupQr
          finalResult={finalResult}
          adaQr={adaQr}
          onTutup={() => setQrTerbuka(false)}
        />
      )}
    </div>
  );
}

// =========================================================================
// POPUP QR — kiri kode, kanan cara memakainya.
// =========================================================================
function PopupQr({ finalResult, adaQr, onTutup }) {
  const langkah = [
    'Buka aplikasi Kamera di HP kamu.',
    'Arahkan ke kode QR di sebelah kiri.',
    'Ketuk notifikasi yang muncul untuk membuka halaman unduhan.',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6" onClick={onTutup}>
      <div
        className="bg-white border-8 border-black flex flex-col max-w-5xl w-full max-h-full"
        style={{ boxShadow: '14px 14px 0 0 var(--color-accent)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-white font-pixel p-4 text-sm border-b-8 border-black whitespace-nowrap shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>[ AMBIL SOFTFILE ]</div>

        <div className="flex flex-1 min-h-0 overflow-y-auto">

          {/* --- kiri: kode QR --- */}
          <div className="shrink-0 p-8 flex items-center justify-center bg-gray-100 border-r-8 border-black">
            {adaQr ? (
              <div className="border-4 border-black p-4 bg-white">
                <img
                  src={finalResult.qrCode}
                  className="object-contain"
                  style={{ width: 'clamp(200px, 32vh, 340px)', height: 'clamp(200px, 32vh, 340px)' }}
                  alt="QR Code unduhan"
                />
              </div>
            ) : (
              // Mode online tapi folder Drive belum sempat dibuat (mis. internet
              // putus saat sesi). Berkasnya tetap aman dan akan diunggah oleh
              // antrean; yang belum ada hanya alamatnya.
              <div
                className="border-4 border-dashed border-gray-400 flex items-center justify-center text-center p-6"
                style={{ width: 'clamp(200px, 32vh, 340px)', height: 'clamp(200px, 32vh, 340px)' }}
              >
                <p className="font-sys text-lg font-bold text-gray-500 leading-snug">Kode QR belum siap</p>
              </div>
            )}
          </div>

          {/* --- kanan: instruksi --- */}
          <div className="flex-1 min-w-0 p-8 flex flex-col gap-5 justify-center">
            {adaQr ? (
              <>
                <h3 className="font-sys text-3xl font-bold text-black leading-tight">Scan untuk mengambil filemu</h3>

                <ol className="flex flex-col gap-4">
                  {langkah.map((teks, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <span className="shrink-0 w-10 h-10 border-4 border-black font-pixel text-sm flex items-center justify-center" style={{ backgroundColor: 'var(--color-secondary)', color: '#111' }}>{i + 1}</span>
                      <span className="font-sys text-xl font-bold text-gray-700 leading-snug">{teks}</span>
                    </li>
                  ))}
                </ol>

                <div className="border-4 border-black bg-gray-100 p-4">
                  <p className="font-sys text-lg text-gray-700 font-bold leading-snug">
                    {finalResult?.driveUrl ? (
                      <>Isi folder <b>Google Drive</b> milikmu: foto resolusi tinggi
                      {finalResult?.videoCount > 0 && <> dan <b>{finalResult.videoCount} video</b></>}.
                      <br />Unggahan berjalan di latar belakang — kalau belum lengkap, buka lagi beberapa menit kemudian.</>
                    ) : (
                      <>Berisi <b>foto resolusi tinggi</b>
                      {finalResult?.videoCount > 0 && <> dan <b>{finalResult.videoCount} video</b></>}.
                      <br />Simpan sekarang, ya — link ini hanya aktif untuk sementara.</>
                    )}
                  </p>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-sys text-3xl font-bold text-black leading-tight">Link-nya sedang disiapkan</h3>
                <p className="font-sys text-xl font-bold text-gray-700 leading-snug">
                  Semua foto dan video kamu <b>sudah tersimpan aman</b> di mesin, tidak ada yang hilang.
                  Koneksi internet sedang bermasalah, jadi link unduhannya belum bisa dibuat sekarang.
                </p>
                <div className="border-4 border-black p-4" style={{ backgroundColor: 'var(--color-secondary)' }}>
                  <p className="font-sys text-xl font-bold text-black leading-snug">
                    Silakan hubungi petugas — filemu akan dikirimkan setelah koneksi kembali normal.
                  </p>
                </div>
              </>
            )}

            <button onClick={onTutup} className="text-black border-4 border-black font-pixel w-full py-5 text-sm mt-2 shadow-[6px_6px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>[ TUTUP ]</button>
          </div>
        </div>
      </div>
    </div>
  );
}
