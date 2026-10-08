import { useStore } from '../store/useStore';
import { useSession } from '../session/context';
import SceneBackdrop from '../components/SceneBackdrop';

export default function LandingScreen() {
  const activeEvent = useStore(s => s.activeEvent);
  const settings = useStore(s => s.settings);
  const isHardwareReady = useStore(s => s.isHardwareReady);
  const isDriveLinked = useStore(s => s.isDriveLinked);
  const setScreen = useStore(s => s.setScreen);
  const { resetSession } = useSession();

  const bypass = settings?.hw_bypass_mode === 1;

  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-12 relative overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Scene parallax di belakang segalanya. Di-render sebelum tombol
          apa pun supaya tidak pernah menutupi interaksi — pointer-events
          dimatikan di .scene-root. Efek CRT tetap paling atas (z-index
          9999) karena di-mount dari App.jsx, bukan dari layar ini. */}
      <SceneBackdrop />

      <div className="absolute top-6 left-6 border-4 border-black px-4 py-2 font-pixel text-xs text-white shadow-[6px_6px_0_0_#000] animate-pulse z-20 whitespace-nowrap" style={{ backgroundColor: 'var(--color-accent)' }}>[ LIVE: {activeEvent?.nama_event} ]</div>
      <div className="absolute top-6 right-6 bg-black border-4 px-4 py-2 font-pixel text-xs shadow-[6px_6px_0_0_#000] z-20 whitespace-nowrap" style={{ color: 'var(--color-secondary)', borderColor: 'var(--color-secondary)' }}>MODE: {settings?.app_mode?.toUpperCase() || 'ONLINE'}</div>

      <div className="text-center mt-12 z-20">
        <h1 className="font-pixel text-5xl md:text-7xl mb-6 tracking-widest whitespace-nowrap" style={{ color: 'var(--color-secondary)', filter: 'drop-shadow(8px 8px 0 var(--color-accent))' }}>SayGumi!</h1>
        <p className="font-pixel text-lg md:text-2xl text-white drop-shadow-[4px_4px_0_#000] animate-pulse whitespace-nowrap">INSERT COIN / TAP TO START</p>
      </div>

      {(!isHardwareReady && !bypass) ? (
        <button disabled className="border-8 border-black font-pixel text-white px-8 py-6 text-xl opacity-50 cursor-not-allowed shadow-[12px_12px_0_0_#000] relative z-20 whitespace-nowrap" style={{ backgroundColor: 'var(--color-accent)' }}>[ HARDWARE OFFLINE ]</button>
      ) : !isDriveLinked ? (
        <div className="flex flex-col items-center gap-4 relative z-20">
          <button disabled className="border-8 border-black font-pixel text-white px-8 py-6 text-lg opacity-60 cursor-not-allowed shadow-[12px_12px_0_0_#000] whitespace-nowrap" style={{ backgroundColor: 'var(--color-accent)' }}>[ GOOGLE DRIVE BELUM TERHUBUNG ]</button>
          <p className="font-sys text-lg font-bold text-white drop-shadow-[2px_2px_0_#000] text-center max-w-xl leading-snug">
            Petugas: buka Pengaturan (Ctrl+Shift+P) &rarr; tab Google Drive,
            lalu tekan Hubungkan Akun Google.<br />
            Cukup sekali saat ada internet; setelah itu event boleh berjalan offline.
          </p>
        </div>
      ) : (
        <button onClick={() => {
          resetSession();
          // Persetujuan diminta sebelum data apa pun dikumpulkan. Operator
          // boleh mematikannya bila memakai papan pemberitahuan fisik.
          setScreen(settings?.consent_enabled === 0 ? 'template' : 'consent');
        }} className="border-8 border-black font-pixel text-black px-10 py-5 text-xl md:text-3xl hover:bg-white hover:-translate-y-2 active:translate-y-2 active:shadow-[4px_4px_0_0_#000] shadow-[12px_12px_0_0_#000] transition-all relative z-20 animate-bounce whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>[ MULAI SEKARANG ]</button>
      )}
    </div>
  );
}
