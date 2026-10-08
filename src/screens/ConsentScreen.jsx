import { useStore } from '../store/useStore';
import { useSession } from '../session/context';

// =========================================================================
// LAYAR PERSETUJUAN
//
// Ditampilkan SEBELUM data apa pun dikumpulkan — sebelum nama diketik dan
// sebelum kamera menyala. Menempatkannya setelah pembayaran akan tidak adil:
// pelanggan sudah membayar ketika diberi tahu apa yang direkam.
//
// Perekaman video disebut secara eksplisit. Sebelum ini, video sesi direkam
// tanpa pernah disebutkan di layar mana pun (temuan S13).
// =========================================================================
export default function ConsentScreen() {
  const setScreen = useStore(s => s.setScreen);
  const settings = useStore(s => s.settings);
  const { resetSession } = useSession();

  const pakaiDrive = settings?.app_mode === 'online';

  const setuju = async () => {
    await window.electronAPI.recordConsent();
    setScreen('template');
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen p-8 z-10" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="bg-white border-8 border-black w-full max-w-4xl p-10" style={{ boxShadow: '16px 16px 0 0 var(--color-secondary)' }}>
        <h2 className="font-pixel text-2xl mb-6 text-center whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Sebelum Mulai</h2>

        <div className="font-sys text-2xl leading-relaxed text-gray-800 space-y-4">
          <p>Dengan melanjutkan, kamu setuju bahwa:</p>
          <ul className="space-y-3 pl-2">
            <li className="flex gap-3">
              <span style={{ color: 'var(--color-accent)' }}>▸</span>
              <span>Kami mengambil <b>foto</b> kamu sesuai jumlah slot pada frame yang dipilih.</span>
            </li>
            <li className="flex gap-3">
              <span style={{ color: 'var(--color-accent)' }}>▸</span>
              <span>Kami juga merekam <b>video di balik layar</b> selama sesi berlangsung.</span>
            </li>
            <li className="flex gap-3">
              <span style={{ color: 'var(--color-accent)' }}>▸</span>
              <span>
                Hasilnya disimpan di mesin ini
                {pakaiDrive && <> dan diunggah ke <b>Google Drive</b> milik penyelenggara</>}
                , lalu dibagikan kepadamu lewat QR code.
              </span>
            </li>
            <li className="flex gap-3">
              <span style={{ color: 'var(--color-accent)' }}>▸</span>
              <span>Nama yang kamu isi dipakai untuk menandai hasil fotomu.</span>
            </li>
          </ul>
          <p className="text-xl text-gray-600 pt-2">
            Kalau kamu keberatan, silakan tekan Batal atau hubungi petugas.
          </p>
        </div>

        <div className="flex gap-6 mt-10">
          <button
            onClick={() => { resetSession(); setScreen('landing'); }}
            className="text-white font-pixel border-4 border-black flex-1 py-6 text-base shadow-[8px_8px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >[ BATAL ]</button>
          <button
            onClick={setuju}
            className="text-black font-pixel border-4 border-black flex-[2] py-6 text-base shadow-[8px_8px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap"
            style={{ backgroundColor: 'var(--color-secondary)' }}
          >[ SAYA SETUJU, LANJUT ]</button>
        </div>
      </div>
    </div>
  );
}
