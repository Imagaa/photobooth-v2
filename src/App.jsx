import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { SessionProvider } from './session/SessionContext';
import { useSession } from './session/context';

import ArcadeEffects from './components/ArcadeEffects';
import RetroDialog from './components/RetroDialog';
import AdminLayer from './admin/AdminLayer';

import LandingScreen from './screens/LandingScreen';
import ConsentScreen from './screens/ConsentScreen';
import TemplateScreen from './screens/TemplateScreen';
import InputNameScreen from './screens/InputNameScreen';
import PaymentScreen from './screens/PaymentScreen';
import CameraScreen from './screens/CameraScreen';
import ReviewScreen from './screens/ReviewScreen';
import UpsellScreen from './screens/UpsellScreen';
import ResultScreen from './screens/ResultScreen';
import ThanksScreen from './screens/ThanksScreen';

// =========================================================================
// ROUTER LAYAR
// Hanya berlangganan currentScreen, sehingga perubahan state lain tidak
// memicu perpindahan/render ulang layar.
// =========================================================================
function ScreenRouter() {
  const screen = useStore(s => s.currentScreen);

  switch (screen) {
    // Layar Manajemen Sesi dirender AdminLayer, karena state-nya milik admin.
    case 'session_manager': return null;
    case 'landing': return <LandingScreen />;
    case 'consent': return <ConsentScreen />;
    case 'template': return <TemplateScreen />;
    case 'input_name': return <InputNameScreen />;
    case 'payment': return <PaymentScreen />;
    case 'camera': return <CameraScreen />;
    case 'review': return <ReviewScreen />;
    case 'upsell': return <UpsellScreen />;
    case 'result': return <ResultScreen />;
    case 'thanks': return <ThanksScreen />;
    case 'loading':
    default:
      return (
        <div className="flex h-screen items-center justify-center font-pixel text-2xl md:text-4xl animate-pulse whitespace-nowrap" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-secondary)' }}>
          [ MEMUAT SISTEM... ]
        </div>
      );
  }
}

// =========================================================================
// TIMER SESI
// Mengelola hitung mundur dan auto-finish di satu tempat. Interval per detik
// hanya menyentuh store; hanya komponen SessionTimer yang ikut re-render.
// =========================================================================
function SessionTimerEngine() {
  const expiresAt = useStore(s => s.sessionExpiresAt);
  const setTimeLeftDisplay = useStore(s => s.setTimeLeftDisplay);
  const { handleAutoFinish } = useSession();

  useEffect(() => {
    if (!expiresAt) return;
    const tick = setInterval(() => {
      setTimeLeftDisplay(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    }, 1000);
    const doom = setTimeout(() => { handleAutoFinish(); }, Math.max(0, expiresAt - Date.now()));
    return () => { clearInterval(tick); clearTimeout(doom); };
  }, [expiresAt, setTimeLeftDisplay, handleAutoFinish]);

  return null;
}

// =========================================================================
// JEMBATAN EVENT DARI HP KASIR
// =========================================================================
function RemoteBridge() {
  const { startCameraAndTimer, resetSession } = useSession();

  useEffect(() => {
    if (!window.electronAPI?.onRemoteVerify) return;
    const st = () => useStore.getState();

    window.electronAPI.onRemoteVerify(() => {
      if (st().waitingForPayment) {
        st().setStatusText('[ VERIFIKASI SUKSES! ]');
        setTimeout(() => {
          st().setWaitingForPayment(false);
          // Verifikasi upsell diselesaikan oleh polling pembayaran, bukan di sini.
          if (st().nextScreenAfterPayment !== 'upsell') startCameraAndTimer();
        }, 1000);
      }
    });

    window.electronAPI.onRemoteClose(async () => {
      const ev = st().activeEvent;
      if (!ev) return;
      await window.electronAPI.closeEvent(ev.id);
      resetSession();
      window.electronAPI.cancelPayment();
      st().fetchActiveEvent();
      st().fetchRecentEvents();
    });

    window.electronAPI.onRemoteRestart(() => { window.location.reload(); });

    window.electronAPI.onRemoteRetake((session) => {
      st().setCustomerName(session.customer_name);
      st().setIsRemoteRetake(true);
      st().setScreen('template');
    });

    window.electronAPI.onRemoteReprint((session) => {
      st().showDialog(`[ SYSTEM LOG ]\nMencetak ulang foto untuk pelanggan: ${session.customer_name}.\nCek layar HP kasir untuk hasilnya.`, 'alert');
    });
  }, [startCameraAndTimer, resetSession]);

  return null;
}

// =========================================================================
// BOOTSTRAP
// =========================================================================
function Bootstrap() {
  const [hwStatus, setHwStatus] = useState(null);

  useEffect(() => {
    const st = useStore.getState();
    st.fetchSettings();
    st.fetchTemplates();
    st.fetchServerIP();
    st.fetchActiveEvent();
    st.fetchRecentEvents();

    (async () => {
      let msg = '';
      try {
        const hw = await window.electronAPI.checkHardware();
        msg += hw.printers?.length > 0 ? '[ PRINTER: OK ] ' : '[ PRINTER: ERROR ] ';
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        msg += videoInputs.length > 0 ? '[ KAMERA: OK ]' : '[ KAMERA: ERROR ]';
        useStore.getState().setHardwareReady(hw.printers?.length > 0 && videoInputs.length > 0);
      } catch {
        msg += '[ HARDWARE ERROR ]';
        useStore.getState().setHardwareReady(false);
      }
      // Gerbang Drive diperiksa terpisah dari hardware. Ini status konfigurasi
      // (akun tertaut), bukan status koneksi internet.
      try {
        useStore.getState().setDriveLinked(await window.electronAPI.gdriveIsLinked());
      } catch { useStore.getState().setDriveLinked(false); }

      setHwStatus(msg);
      setTimeout(() => setHwStatus(null), 6000);
    })();
  }, []);

  if (!hwStatus) return null;
  return (
    <div className="absolute top-8 left-1/2 -translate-x-1/2 text-black px-10 py-5 border-8 border-black font-sys font-bold z-[200] shadow-[8px_8px_0_0_#000] animate-bounce text-xl text-center whitespace-pre-wrap" style={{ backgroundColor: 'var(--color-secondary)' }}>
      {hwStatus}
    </div>
  );
}

// Tema dipasang ke <body> lewat komponen sendiri agar perubahan tema tidak
// menyentuh pohon render lain.
function ThemeBinder() {
  const theme = useStore(s => s.settings?.active_theme);

  useEffect(() => {
    // Hanya kelas tema yang diganti; kelas lain pada body dipertahankan (bug B16).
    const body = document.body;
    [...body.classList].filter(c => c.startsWith('theme-')).forEach(c => body.classList.remove(c));
    body.classList.add(`theme-${theme || 'candy'}`);

    // Transisi warna hanya dinyalakan selama pergantian tema. Di luar itu
    // seluruh aplikasi bebas dari animasi box-shadow yang mahal.
    const root = document.documentElement;
    root.classList.add('theme-switching');
    const timer = setTimeout(() => root.classList.remove('theme-switching'), 600);
    return () => clearTimeout(timer);
  }, [theme]);

  return null;
}

export default function App() {
  const isLanding = useStore(s => s.currentScreen === 'landing');

  return (
    <SessionProvider>
      <div className="w-screen h-screen overflow-hidden relative flex justify-center items-center bg-black">
        <ArcadeEffects />
        {isLanding && <div className="crt-overlay"></div>}

        <ThemeBinder />
        <Bootstrap />
        <RemoteBridge />
        <SessionTimerEngine />
        <RetroDialog />

        <div className="w-full h-full relative z-10">
          <ScreenRouter />
        </div>

        <AdminLayer />
      </div>
    </SessionProvider>
  );
}
