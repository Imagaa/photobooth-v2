import { useStore } from '../store/useStore';

// Terisolasi dalam komponennya sendiri supaya tick per detik hanya me-render
// badge ini, bukan seluruh layar kamera beserta elemen <video>-nya.
export default function SessionTimer() {
  const expiresAt = useStore(s => s.sessionExpiresAt);
  const timeLeft = useStore(s => s.timeLeftDisplay);

  if (!expiresAt) return null;

  const menit = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const detik = (timeLeft % 60).toString().padStart(2, '0');

  return (
    <div className="absolute top-6 right-6 text-white px-6 py-3 font-pixel text-xs md:text-sm border-4 border-black z-50 shadow-[6px_6px_0_0_#000] whitespace-nowrap" style={{ backgroundColor: 'var(--color-accent)' }}>
      [ WAKTU: {menit}:{detik} ]
    </div>
  );
}
