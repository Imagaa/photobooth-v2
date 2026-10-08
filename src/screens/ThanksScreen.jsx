import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';

// Dipakai bila operator belum menulis pesannya sendiri. Sengaja tidak
// menyebut nama acara atau vendor supaya tetap masuk akal apa adanya.
export const PESAN_TERIMA_KASIH_BAWAAN = 'Terima kasih sudah mampir!\nSemoga hasilnya bikin kamu senyum seharian.';

export const DETIK_BAWAAN = 3;

// =========================================================================
// LAYAR TERIMA KASIH
//
// Penutup singkat sebelum kiosk kembali ke layar awal. Selain sopan, layar
// ini juga berguna secara praktis: ia memberi jeda agar pelanggan menyingkir
// dari depan kamera sebelum orang berikutnya mulai.
//
// Bisa dimatikan dari pengaturan — pada acara dengan antrean panjang, tiga
// detik dikali seratus pelanggan bukan waktu yang sepele.
// =========================================================================
export default function ThanksScreen() {
  const settings = useStore(s => s.settings);
  const setScreen = useStore(s => s.setScreen);

  const pesan = (settings?.thanks_message || '').trim() || PESAN_TERIMA_KASIH_BAWAAN;
  const detik = Math.min(15, Math.max(1, Number(settings?.thanks_seconds) || DETIK_BAWAAN));

  const [mulaiHitung, setMulaiHitung] = useState(false);

  useEffect(() => {
    // Ditunda satu frame supaya transisi bilah waktunya benar-benar berjalan;
    // kalau lebar akhir dipasang di render pertama, tidak ada yang dianimasikan.
    const frame = requestAnimationFrame(() => setMulaiHitung(true));
    const timer = setTimeout(() => setScreen('landing'), detik * 1000);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [detik, setScreen]);

  return (
    // Seluruh layar bisa diketuk untuk langsung menutup — pelanggan yang sudah
    // selesai tidak perlu menunggu hitungan habis.
    <div
      onClick={() => setScreen('landing')}
      className="flex h-screen w-full flex-col items-center justify-center gap-8 p-10 cursor-pointer select-none"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <h1 className="font-pixel text-4xl drop-shadow-[6px_6px_0_#000] whitespace-nowrap" style={{ color: 'var(--color-secondary)' }}>SayGumi!</h1>

      <div className="bg-white border-8 border-black px-12 py-10 max-w-4xl" style={{ boxShadow: '14px 14px 0 0 var(--color-accent)' }}>
        {pesan.split('\n').map((baris, i) => (
          <p key={i} className="font-sys text-4xl font-bold text-black text-center leading-snug">{baris}</p>
        ))}
      </div>

      <div className="w-[320px] h-4 border-4 border-black bg-white overflow-hidden">
        <div
          className="h-full"
          style={{
            width: mulaiHitung ? '0%' : '100%',
            backgroundColor: 'var(--color-primary)',
            transition: `width ${detik}s linear`,
          }}
        />
      </div>

      <p className="font-sys text-lg font-bold text-white/70 drop-shadow-[2px_2px_0_#000]">Ketuk layar untuk kembali sekarang</p>
    </div>
  );
}
