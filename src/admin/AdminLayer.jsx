import { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useSession } from '../session/context';
import { formatRp, parseRp, THEMES, temaBerikutnya } from '../utils/format';
import { OskContext } from './oskContext';
import {
  AKSI, PINTASAN_BAWAAN, dariEvent, cariAksi, bisaBentrokSaatMengetik,
  formatPintasan, validasi, deteksiBentrok, gabungBawaan, keJson,
} from '../utils/pintasan';
import AdminPinGate from '../components/AdminPinGate';
import InputSentuh from '../components/InputSentuh';
import KeyboardAdmin from '../components/KeyboardAdmin';
import VisualEditor from '../components/VisualEditor';
import { PESAN_TERIMA_KASIH_BAWAAN, DETIK_BAWAAN } from '../screens/ThanksScreen';
import { localUrl } from '../localUrl';

// Tombol tutup modal. Sebelumnya hanya teks "[ X ]" tanpa padding — area
// sentuhnya ±40×14px, jauh di bawah ambang nyaman ±44px, dan umpan baliknya
// `hover:scale-125` yang tidak pernah menyala di layar sentuh.
const KELAS_TUTUP = 'shrink-0 w-14 h-14 flex items-center justify-center border-4 border-black text-white font-pixel text-base shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none transition-all';

// Daftar tab panel Pengaturan. Sebelumnya keenamnya ditulis sebagai baris
// JSX sepanjang ~250 karakter yang berbeda hanya pada dua kata — menambah
// satu tab berarti menyalin seluruh baris dan berharap tidak ada yang
// terlewat diubah.
const TAB_PENGATURAN = [
  { id: 'umum', label: '[1] Umum' },
  { id: 'midtrans', label: '[2] Pembayaran' },
  { id: 'hardware', label: '[3] Hardware' },
  { id: 'tema', label: '[4] Tema UI' },
  { id: 'gdrive', label: '[5] Google Drive' },
  { id: 'akses', label: '[6] Aksesibilitas' },
];

function TombolTab({ tab, aktif, onPilih }) {
  const dasar = 'text-left p-3 font-pixel text-[10px] md:text-xs border-4 border-black transition-all whitespace-nowrap';
  return (
    <button
      onClick={() => onPilih(tab.id)}
      className={`${dasar} ${aktif ? 'text-black translate-x-2 shadow-[-6px_6px_0_0_#000]' : 'bg-white hover:bg-gray-100 text-gray-700'}`}
      style={aktif ? { backgroundColor: 'var(--color-secondary)' } : {}}
    >
      {tab.label}
    </button>
  );
}

// =========================================================================
// LAPISAN ADMIN
//
// Seluruh state panel admin tinggal di sini, terpisah dari layar kiosk.
// Sebelumnya semuanya berada di App bersama state pelanggan, sehingga
// mengetik satu huruf di form Pengaturan me-render ulang layar kamera.
// =========================================================================
export default function AdminLayer() {
  const settings = useStore(s => s.settings);
  const templates = useStore(s => s.templates);
  const recentEvents = useStore(s => s.recentEvents);
  const activeEvent = useStore(s => s.activeEvent);
  const currentScreen = useStore(s => s.currentScreen);
  const showDialog = useStore(s => s.showDialog);
  const fetchSettings = useStore(s => s.fetchSettings);
  const fetchTemplates = useStore(s => s.fetchTemplates);
  const fetchActiveEvent = useStore(s => s.fetchActiveEvent);
  const fetchRecentEvents = useStore(s => s.fetchRecentEvents);

  const { resetSession } = useSession();

  const [isGlobalOpen, setGlobalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('umum');
  const [isTemplateOpen, setTemplateOpen] = useState(false);
  const [isDashboardOpen, setDashboardOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [globalData, setGlobalData] = useState({ hpp_kertas: '', hpp_tinta: '', biaya_ops: '', midtrans_server_key: '', midtrans_client_key: '', app_mode: 'online', active_theme: 'candy' });
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEventData, setNewEventData] = useState({ nama_event: '', saldo_awal: '', upsell_enabled: false, upsell_price: '' });
  const [selectedEventTemplates, setSelectedEventTemplates] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, event: null, local: true, gdrive: false });
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [network, setNetwork] = useState({ current: '', interfaces: [] });
  const [gdrive, setGdrive] = useState({ connected: false, queue: {} });
  const [gdriveForm, setGdriveForm] = useState({ clientId: '', clientSecret: '' });
  const [pendingPanel, setPendingPanel] = useState(null);
  const [pinIsDefault, setPinIsDefault] = useState(false);
  const [pinForm, setPinForm] = useState({ current: '', next: '' });
  const adminUnlockedRef = useRef(false);

  // ---------------------------------------------------------------------
  // KEYBOARD ON-SCREEN
  //
  // Input yang sedang difokuskan menitipkan ref-nya di sini, dan keyboard
  // mengirim ketikan lewat onChange milik input itu. Yang disimpan REF,
  // bukan nilainya — objek biasa akan membeku pada nilai saat fokus terjadi.
  // ---------------------------------------------------------------------
  const [oskTarget, setOskTarget] = useState(null);
  const oskAktifRef = useRef(null);
  const oskBlurTimer = useRef(null);

  const osk = useMemo(() => {
    const lepaskan = (ref) => {
      if (oskAktifRef.current !== ref) return;
      oskAktifRef.current = null;
      setOskTarget(null);
    };
    return {
      daftar: (ref) => {
        // Membatalkan pelepasan tertunda: berpindah antar input memicu blur
        // lebih dulu, dan tanpa ini keyboard berkedip mati-hidup.
        clearTimeout(oskBlurTimer.current);
        oskAktifRef.current = ref;
        setOskTarget(ref);
      },
      lepas: lepaskan,
      mungkinLepas: (ref) => {
        oskBlurTimer.current = setTimeout(() => lepaskan(ref), 150);
      },
    };
  }, []);

  useEffect(() => () => clearTimeout(oskBlurTimer.current), []);

  // ---------------------------------------------------------------------
  // PETA PINTASAN
  // Dibaca dari settings tersimpan; nilai rusak jatuh ke bawaan sehingga
  // kiosk tidak pernah kehilangan seluruh pintasannya.
  // ---------------------------------------------------------------------
  const petaPintasan = useMemo(() => gabungBawaan(settings?.shortcuts_json), [settings?.shortcuts_json]);
  const petaRef = useRef(petaPintasan);
  useEffect(() => { petaRef.current = petaPintasan; }, [petaPintasan]);

  // Peta yang sedang diedit di tab Aksesibilitas, terpisah dari yang berlaku.
  const [petaDraf, setPetaDraf] = useState(petaPintasan);
  const [merekam, setMerekam] = useState(null);
  const [pesanRekam, setPesanRekam] = useState('');
  const bentrokDraf = useMemo(() => deteksiBentrok(petaDraf), [petaDraf]);

  // Menangkap penekanan berikutnya sebagai pintasan baru. Listener dipasang
  // hanya selama perekaman, dengan capture agar ia mendahului pintasan yang
  // sedang berlaku — kalau tidak, merekam Ctrl+Shift+P justru membuka panel.
  useEffect(() => {
    if (!merekam) return;
    const tangkap = (e) => {
      const p = dariEvent(e);
      if (!p) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setMerekam(null); return; }
      const v = validasi(p);
      if (!v.ok) { setPesanRekam(v.error); return; }
      setPesanRekam('');
      setPetaDraf(prev => ({ ...prev, [merekam]: v.nilai }));
      setMerekam(null);
    };
    window.addEventListener('keydown', tangkap, true);
    return () => window.removeEventListener('keydown', tangkap, true);
  }, [merekam]);

  // Status Drive dipakai di dua tempat: panel Pengaturan dan gerbang di layar
  // landing. Keduanya harus diperbarui bersamaan — sebelumnya gerbang landing
  // hanya diperiksa sekali saat aplikasi start, sehingga menghubungkan Drive
  // di tengah sesi tidak menghilangkan pesan "belum terhubung".
  const refreshGdrive = async () => {
    const gd = await window.electronAPI.gdriveStatus();
    setGdrive(gd);
    useStore.getState().setDriveLinked(!!gd.connected);
    return gd;
  };

  const fetchDashboardData = async () => {
    const ev = await window.electronAPI.getActiveEvent();
    if (ev) setDashboardData(await window.electronAPI.getDashboardData(ev.id));
  };

  const applyPanel = (which) => {
    // Form disemai dari settings saat panel dibuka, bukan lewat effect yang
    // ikut berjalan setiap settings di-refetch — dulu itu menghapus editan
    // operator yang belum disimpan.
    if (which === 'settings') {
      setGlobalData({ ...(useStore.getState().settings || {}) });
      // Draf pintasan disemai ulang setiap panel dibuka, sama seperti form
      // lainnya — supaya editan yang tidak jadi disimpan tidak tertinggal.
      setPetaDraf(gabungBawaan(useStore.getState().settings?.shortcuts_json));
      setMerekam(null);
      setPesanRekam('');
    }
    setGlobalOpen(which === 'settings');
    setTemplateOpen(which === 'template');
    setDashboardOpen(which === 'dashboard');
    if (which === 'dashboard') fetchDashboardData();
  };

  const lockAdmin = () => {
    adminUnlockedRef.current = false;
    setGlobalOpen(false); setTemplateOpen(false); setDashboardOpen(false);
  };

  // Menutup sesi event dari kiosk. Jalur yang sama dipakai tombol D-pad bawah
  // di HP kasir, hanya saja ini butuh PIN admin karena dilakukan di mesin.
  const closeActiveSession = async () => {
    const ev = useStore.getState().activeEvent;
    if (!ev) {
      await showDialog('Tidak ada sesi event yang sedang berjalan.');
      return;
    }
    const ok = await showDialog(
      `Tutup sesi event "${ev.nama_event}"?\n\nLaporan keuangan akan dibekukan dan kiosk kembali ke layar Manajemen Sesi.`,
      'confirm'
    );
    if (!ok) return;

    await window.electronAPI.closeEvent(ev.id);
    resetSession();
    window.electronAPI.cancelPayment();
    lockAdmin();
    fetchActiveEvent();
    fetchRecentEvents();
  };

  // Mengembalikan kiosk ke layar landing. Dipakai HP kasir saat sesi
  // tersangkut — pelanggan pergi di tengah alur, atau layar berhenti di
  // pembayaran yang tidak jadi dibayar.
  const kembaliKeLanding = () => {
    // Tanpa event aktif, layar yang benar adalah Manajemen Sesi — memaksa
    // ke landing hanya akan menampilkan layar mulai untuk event yang tidak ada.
    if (!useStore.getState().activeEvent) return;
    resetSession();
    window.electronAPI.cancelPayment();
    // resetCustomerSession sengaja tidak menyentuh currentScreen, jadi
    // perpindahan layarnya harus disebut sendiri di sini.
    useStore.getState().setScreen('landing');
    lockAdmin();
  };

  // Satu pintu untuk semua aksi admin yang dilindungi PIN.
  const runAdminAction = (which) => {
    if (which === 'close_session') closeActiveSession();
    else if (which === 'landing') kembaliKeLanding();
    else applyPanel(which);
  };

  // Perputaran tema. Dipakai Ctrl+Panah di kiosk DAN tombol di HP kasir;
  // keduanya harus lewat sini supaya tidak bisa berputar ke arah berbeda.
  const gantiTema = (arah) => {
    const current = useStore.getState().settings || {};
    const next = temaBerikutnya(current.active_theme || THEMES[0], arah);
    setGlobalData(prev => ({ ...prev, active_theme: next }));
    window.electronAPI.saveSettings({ ...current, active_theme: next }).then(() => fetchSettings());
  };

  // Listener keydown dipasang sekali seumur komponen, jadi ia harus memanggil
  // versi terbaru lewat ref — kalau tidak ia memakai closure render pertama.
  // Penugasan ref dilakukan di effect, bukan saat render.
  const actionRef = useRef(runAdminAction);
  const temaRef = useRef(gantiTema);
  useEffect(() => { actionRef.current = runAdminAction; temaRef.current = gantiTema; });

  const saveGlobalSettings = async () => {
    // Bentrok kritis berarti salah satu pintasan tidak akan pernah bisa
    // dipakai, atau justru merebut fungsi yang menutup aplikasi. Menyimpannya
    // diam-diam akan membuat kiosk kehilangan akses admin di lapangan.
    const kritis = bentrokDraf.filter(b => b.tingkat === 'kritis');
    if (kritis.length) {
      await showDialog(`Pintasan masih bentrok:\n\n${kritis.map(b => '• ' + b.teks).join('\n')}\n\nPerbaiki dulu di tab Aksesibilitas.`);
      setSettingsTab('akses');
      return;
    }
    await window.electronAPI.saveSettings({ ...globalData, shortcuts_json: keJson(petaDraf) });
    fetchSettings();
    refreshGdrive();
    await showDialog('Pengaturan Berhasil Disimpan!');
    lockAdmin();
  };

  const updateMasterAttr = async (tpl, field, value) => {
    await window.electronAPI.updateTemplate({ ...tpl, [field]: value });
    fetchTemplates();
  };

  // Daftar hardware hanya perlu diambil sekali, untuk dropdown di Pengaturan.
  useEffect(() => {
    (async () => {
      try {
        const hw = await window.electronAPI.checkHardware();
        setAvailablePrinters(hw.printers || []);
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAvailableCameras(devices.filter(d => d.kind === 'videoinput'));
        setNetwork(await window.electronAPI.listNetworkInterfaces());
        const gd = await refreshGdrive();
        setGdriveForm(f => ({ ...f, clientId: gd.clientId || '' }));
      } catch { /* status hardware sudah dilaporkan di App */ }
    })();
  }, []);

  // Jendela OAuth melaporkan hasilnya lewat main process.
  useEffect(() => {
    if (!window.electronAPI.onGdriveAuthResult) return;
    window.electronAPI.onGdriveAuthResult(async (hasil) => {
      await refreshGdrive();
      showDialog(hasil.success
        ? 'Google Drive terhubung' + (hasil.email ? ' sebagai ' + hasil.email : '') + '.'
        : 'Gagal menghubungkan: ' + hasil.error);
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+X bentrok dengan "cut" bawaan. Jangan pernah menyita shortcut ini
      // saat operator sedang mengetik di form.
      const el = e.target;
      const sedangMengetik = el && (
        el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
      );

      const runGuarded = (which) => {
        if (adminUnlockedRef.current) actionRef.current(which);
        else setPendingPanel(which);
      };

      // Peta dibaca lewat ref, bukan closure, supaya pintasan yang baru
      // disimpan langsung berlaku tanpa perlu memasang ulang listener.
      const tekan = dariEvent(e);
      const aksi = cariAksi(petaRef.current, tekan);
      if (!aksi) return;

      // Ctrl+huruf tanpa pengubah lain beririsan dengan perintah pengeditan
      // teks. Menyitanya saat operator mengetik akan merusak potong/salin.
      if (sedangMengetik && bisaBentrokSaatMengetik(petaRef.current[aksi])) return;

      e.preventDefault();

      // Ganti tema langsung dari settings tersimpan, bukan dari buffer form —
      // pintasan ini bisa ditekan tanpa pernah membuka panel Pengaturan.
      if (aksi === 'tema_next') { temaRef.current('next'); return; }
      if (aksi === 'tema_prev') { temaRef.current('prev'); return; }
      runGuarded(aksi);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ---------------------------------------------------------------------
  // PERINTAH DARI HP KASIR
  //
  // Kiosk photobooth adalah layar sentuh TANPA keyboard fisik, sehingga
  // Ctrl+Shift+P/T/D dan Ctrl+Panah sebenarnya tidak pernah bisa ditekan
  // di sana. Jalur inilah yang membuatnya terjangkau.
  //
  // Perhatikan bahwa keduanya masuk lewat runGuarded/gantiTema yang SAMA
  // dengan jalur keyboard. HP tidak punya pintu belakang: panel admin tetap
  // memunculkan gerbang PIN di layar kiosk, persis seperti menekan
  // pintasannya sendiri.
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!window.electronAPI?.onRemotePanel) return;

    window.electronAPI.onRemotePanel((which) => {
      // 'landing' adalah kendali sesi, sekelas restart — token kasir sudah
      // cukup, sama seperti /api/close dan /api/restart yang sudah ada.
      if (which === 'landing') { actionRef.current('landing'); return; }
      if (adminUnlockedRef.current) actionRef.current(which);
      else setPendingPanel(which);
    });

    window.electronAPI.onRemoteTheme((arah) => temaRef.current(arah));
  }, []);

  return (
    <OskContext.Provider value={osk}>
      {pendingPanel && (
        <AdminPinGate
          onCancel={() => setPendingPanel(null)}
          onSuccess={() => {
            adminUnlockedRef.current = true;
            actionRef.current(pendingPanel);
            setPendingPanel(null);
            window.electronAPI.isAdminPinDefault().then(setPinIsDefault);
          }}
        />
      )}

      {currentScreen === 'session_manager' && (
      // `fixed inset-0` wajib di sini: AdminLayer adalah anak langsung dari
      // container root yang ber-`flex justify-center items-center`, sehingga
      // layar biasa akan menyusut selebar isinya lalu ditengahkan. Layar kiosk
      // lain aman karena dibungkus `w-full h-full` di dalam ScreenRouter.
      <div className="fixed inset-0 z-10 flex flex-col items-center justify-center p-8 overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
        {/* max-w dinaikkan dari 5xl: form buat sesi kini dua kolom, dan pratinjau
            frame butuh ruang supaya benar-benar terlihat sebelum dipilih. */}
        <div className="w-full max-w-7xl bg-white flex flex-col h-[88vh] border-8 border-black shadow-[16px_16px_0_0_rgba(0,0,0,1)] z-10">
          <div className="text-white font-pixel p-4 text-sm border-b-8 border-black flex justify-between items-center" style={{ backgroundColor: 'var(--color-primary)' }}>
            <div className="flex items-center gap-4 whitespace-nowrap"><span>[ MANAJEMEN SESI EVENT ]</span><button onClick={() => { if (adminUnlockedRef.current) applyPanel('settings'); else setPendingPanel('settings'); }} className="text-black px-4 py-2 border-4 border-black text-xs shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>[ PENGATURAN ]</button></div>
            {!showCreateForm && <button onClick={()=>setShowCreateForm(true)} className="text-white px-4 py-2 border-4 border-black shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all text-xs whitespace-nowrap" style={{ backgroundColor: 'var(--color-accent)' }}>[ BUAT SESI BARU ]</button>}
          </div>
          <div className="p-8 flex flex-col flex-1 min-h-0 bg-gray-100">
            {!showCreateForm && (
              <div className="flex flex-col flex-1 min-h-0">
                <h2 className="font-pixel text-xl mb-6 shrink-0 whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Riwayat Sesi Terakhir</h2>
                {recentEvents.length === 0 ? ( <p className="font-sys text-xl text-gray-500 font-bold">Belum ada riwayat event.</p> ) : (
                  <div className="grid grid-cols-2 gap-6 overflow-y-auto flex-1 min-h-0 pr-2">
                    {recentEvents.map(ev => (
                      <div key={ev.id} className="border-4 border-black p-6 flex flex-col bg-white transition-colors group shadow-[8px_8px_0_0_#000]" style={{ ':hover': { backgroundColor: 'var(--color-secondary)' } }}>
                        <h3 className="font-sys text-3xl font-bold mb-2 text-black">{ev.nama_event}</h3>
                        <p className="font-pixel text-[10px] text-gray-500 mb-6">{new Date(ev.created_at).toLocaleString()}</p>
                        <div className="mt-auto flex gap-2">
                           <button onClick={async()=>{ const isOk = await showDialog("Lanjutkan sesi ini?", 'confirm'); if(isOk) { await window.electronAPI.reopenEvent(ev.id); fetchActiveEvent(); } }} className="text-white flex-1 font-pixel border-4 border-black py-3 text-[10px] shadow-[4px_4px_0_0_#000] active:translate-y-1 whitespace-nowrap" style={{ backgroundColor: 'var(--color-primary)' }}>[ BUKA SESI ]</button>
                           <button onClick={async () => {
                             const r = await window.electronAPI.gdriveUploadNow(ev.id);
                             const q = r.queue || {};
                             await showDialog('Antrean unggah untuk event ini:\n\n' +
                               (q.pending || 0) + ' menunggu, ' + (q.uploading || 0) + ' berjalan, ' +
                               (q.done || 0) + ' selesai, ' + (q.failed || 0) + ' gagal.\n\n' +
                               'Unggahan berjalan di latar belakang selama aplikasi terbuka dan ada internet.');
                           }} className="text-white flex-1 font-pixel border-4 border-black py-3 text-[10px] shadow-[4px_4px_0_0_#000] active:translate-y-1 whitespace-nowrap" style={{ backgroundColor: 'var(--color-primary)' }}>[ UNGGAH ]</button>
                           <button onClick={() => setDeleteModal({ isOpen: true, event: ev, local: true, gdrive: false })} className="text-white flex-1 font-pixel border-4 border-black py-3 text-[10px] shadow-[4px_4px_0_0_#000] active:translate-y-1 bg-red-600 whitespace-nowrap">[ HAPUS ]</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {showCreateForm && (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center gap-4 mb-6 shrink-0">
                  {recentEvents.length > 0 && <button onClick={()=>setShowCreateForm(false)} className="text-white border-4 border-black font-pixel px-4 py-2 text-xs shadow-[4px_4px_0_0_#000] active:translate-y-1 whitespace-nowrap" style={{ backgroundColor: 'var(--color-accent)' }}>[ KEMBALI ]</button>}
                  <h2 className="font-pixel text-xl whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Buka Sesi Event Baru</h2>
                </div>
                {/* Dua kolom dalam satu kotak: isian event menurun ramping di kiri,
                    pemilihan frame mendapat seluruh sisa lebar di kanan. Sebelumnya
                    keduanya bertumpuk vertikal sehingga pratinjau frame hanya
                    kebagian sisa tinggi dan tampil terlalu kecil untuk dinilai. */}
                <div className="flex flex-1 min-h-0 gap-8">

                  {/* ---------------- KOLOM KIRI — ISIAN EVENT ---------------- */}
                  <div className="w-[340px] shrink-0 flex flex-col gap-5 pr-8 border-r-4 border-dashed border-gray-400 overflow-y-auto">

                    <div className="flex flex-col font-sys text-lg">
                      <label className="font-bold mb-2">Nama Event / Klien:</label>
                      <InputSentuh type="text" className="border-4 border-black p-3 outline-none" value={newEventData.nama_event} onChange={e=>setNewEventData({...newEventData, nama_event: e.target.value})} />
                    </div>

                    <div className="flex flex-col font-sys text-lg">
                      <label className="font-bold mb-2">Saldo Awal / Deposit (Rp):</label>
                      <InputSentuh type="text" className="border-4 border-black p-3 outline-none" value={formatRp(newEventData.saldo_awal)} onChange={e=>setNewEventData({...newEventData, saldo_awal: parseRp(e.target.value)})} placeholder="0" />
                    </div>

                    <div className="flex flex-col gap-3 pt-5 border-t-4 border-dashed border-gray-400">
                      <label className="flex items-start gap-3 font-sys text-base font-bold cursor-pointer bg-white border-4 border-black p-4 shadow-[4px_4px_0_0_#000]">
                        <input type="checkbox" className="w-6 h-6 shrink-0 mt-0.5" checked={!!newEventData.upsell_enabled} onChange={e=>setNewEventData({...newEventData, upsell_enabled: e.target.checked})} />
                        <span className="leading-snug">Izinkan Cetak Tambahan (Upsell)</span>
                      </label>

                      {newEventData.upsell_enabled ? (
                        <div className="flex flex-col font-sys">
                          <label className="font-bold mb-2 text-base">Harga per Lembar Tambahan (Rp):</label>
                          <InputSentuh type="text" className="border-4 border-black p-3 outline-none text-lg" value={formatRp(newEventData.upsell_price)} onChange={e=>setNewEventData({...newEventData, upsell_price: parseRp(e.target.value)})} placeholder="Ikut harga frame" />
                          <p className="text-sm text-gray-500 italic font-bold leading-snug mt-2">
                            Kosong atau 0 = harga mengikuti frame yang dibayar di awal. Sesi gratis tetap butuh persetujuan kasir.
                          </p>
                        </div>
                      ) : (
                        <p className="font-sys text-sm text-gray-500 italic font-bold leading-snug">
                          Centang bila pelanggan boleh memesan cetak tambahan setelah sesi.
                        </p>
                      )}
                    </div>

                    <button onClick={async()=>{ if(!newEventData.nama_event) return await showDialog("Nama Event wajib diisi!"); if(selectedEventTemplates.length===0) return await showDialog("Minimal pilih 1 template!"); const res = await window.electronAPI.createEvent({ nama_event: newEventData.nama_event, saldo_awal: parseRp(newEventData.saldo_awal) || 0, templates: selectedEventTemplates, upsell_enabled: newEventData.upsell_enabled, upsell_price: parseRp(newEventData.upsell_price) || 0 }); if(res.success) { setNewEventData({ nama_event: '', saldo_awal: '', upsell_enabled: false, upsell_price: '' }); setSelectedEventTemplates([]); setShowCreateForm(false); fetchActiveEvent(); fetchRecentEvents(); } else await showDialog("Sistem Gagal: " + res.error); }} className="text-black border-4 border-black font-pixel py-5 text-sm mt-auto shadow-[8px_8px_0_0_#000] active:translate-y-1 transition-all shrink-0 whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>[ BUKA EVENT SEKARANG ]</button>
                  </div>

                  {/* ---------------- KOLOM KANAN — PILIH FRAME ---------------- */}
                  <div className="flex-1 min-w-0 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-4 shrink-0 font-sys gap-4">
                      <label className="font-bold text-xl">Pilih &amp; Atur Harga Frame <span style={{ color: 'var(--color-accent)' }}>(WAJIB)</span></label>
                      <span className="font-pixel text-[10px] px-4 py-2 border-4 border-black whitespace-nowrap"
                            style={{ backgroundColor: selectedEventTemplates.length ? 'var(--color-secondary)' : '#e5e7eb', color: '#111' }}>
                        {selectedEventTemplates.length} FRAME DIPILIH
                      </span>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                      <div className="grid gap-6 pb-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                        {templates.filter(t=>t.is_visible).map(tpl => {
                          const isSelected = selectedEventTemplates.find(t=>t.id === tpl.id);
                          return (
                            <div
                              key={tpl.id}
                              onClick={(e) => {
                                if (e.target.tagName === 'INPUT') return;
                                const exists = selectedEventTemplates.find(t => t.id === tpl.id);
                                if (exists) setSelectedEventTemplates(selectedEventTemplates.filter(t => t.id !== tpl.id));
                                else setSelectedEventTemplates([...selectedEventTemplates, { ...tpl, override_price: tpl.price }]);
                              }}
                              // Tinggi kartu dibuat tetap agar grid tidak melompat-lompat
                              // saat frame dipilih — dulu munculnya kolom harga menggeser
                              // seluruh baris di bawahnya.
                              className={`relative border-4 p-3 flex flex-col gap-2 cursor-pointer select-none h-[420px] ${isSelected ? 'border-black shadow-[6px_6px_0_0_#000] -translate-y-1' : 'border-gray-400 shadow-[4px_4px_0_0_rgba(0,0,0,0.25)] hover:border-black'}`}
                              style={isSelected ? { backgroundColor: 'var(--color-primary)', color: 'white' } : { backgroundColor: 'white', color: 'black' }}
                            >
                              {isSelected && (
                                <div className="absolute -top-3 -left-3 w-9 h-9 border-4 border-black flex items-center justify-center font-pixel text-sm z-10"
                                     style={{ backgroundColor: 'var(--color-secondary)', color: '#111' }}>✓</div>
                              )}

                              <div className="flex-1 min-h-0 bg-gray-200 border-2 border-black flex justify-center relative p-2">
                                <img src={localUrl(`/templates/${tpl.filename}`)} className="h-full object-contain drop-shadow-md" />
                                <div className="absolute top-0 right-0 text-black px-2 py-1 text-[10px] font-pixel border-l-2 border-b-2 border-black whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>{tpl.orientation || 'portrait'}</div>
                              </div>

                              <span className="font-bold truncate text-sm shrink-0">{tpl.filename}</span>

                              {/* Ruang harga selalu disediakan; isinya berganti agar
                                  tinggi kartu tetap sama dipilih atau tidak. */}
                              <div className="min-h-[72px] shrink-0 flex flex-col justify-end">
                                {isSelected ? (
                                  <>
                                    <label className="text-xs font-bold mb-1" style={{ color: 'var(--color-secondary)' }}>Harga Sesi Ini (Rp):</label>
                                    <InputSentuh type="text" className="w-full border-2 border-black p-2 text-base outline-none text-black font-bold"
                                           value={formatRp(isSelected.override_price)}
                                           onChange={(e) => setSelectedEventTemplates(prev => prev.map(p => p.id === tpl.id ? { ...p, override_price: parseRp(e.target.value) } : p))} />
                                  </>
                                ) : (
                                  <p className="text-sm text-gray-500 font-bold italic">Ketuk untuk memilih</p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* MODAL HAPUS SESI DENGAN CHECKBOX */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex justify-center items-center p-6">
            <div className="bg-white border-8 border-black p-8 w-full max-w-lg" style={{ boxShadow: '16px 16px 0 0 var(--color-accent)' }}>
                <h2 className="font-pixel text-xl mb-4 text-red-600 whitespace-nowrap">[ HAPUS DATABASE SESI ]</h2>
                <p className="font-sys text-lg mb-6 font-bold">Anda yakin ingin menghapus "{deleteModal.event?.nama_event}"?</p>
                <div className="flex flex-col gap-4 mb-8">
                    <label className="flex items-center gap-3 font-sys text-xl cursor-pointer">
                        <input type="checkbox" className="w-6 h-6" checked={deleteModal.local} onChange={e=>setDeleteModal({...deleteModal, local: e.target.checked})} />
                        Hapus Direktori Fisik
                    </label>
                    <label className="flex items-center gap-3 font-sys text-xl cursor-pointer">
                        <input type="checkbox" className="w-6 h-6" checked={deleteModal.gdrive} onChange={e=>setDeleteModal({...deleteModal, gdrive: e.target.checked})} />
                        Hapus Backup di Google Drive
                    </label>
                </div>
                <div className="flex gap-4">
                    <button onClick={()=>setDeleteModal({...deleteModal, isOpen:false})} className="flex-1 border-4 border-black font-pixel py-3 text-xs whitespace-nowrap" style={{backgroundColor: 'var(--color-secondary)'}}>[ BATAL ]</button>
                    <button onClick={async ()=>{
                        await window.electronAPI.deleteEvent({eventId: deleteModal.event.id, deleteLocal: deleteModal.local, deleteGdrive: deleteModal.gdrive});
                        fetchRecentEvents();
                        setDeleteModal({...deleteModal, isOpen:false});
                    }} className="flex-1 bg-[#FF3B67] text-white border-4 border-black font-pixel py-3 text-xs whitespace-nowrap">[ HAPUS PERMANEN ]</button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL DASHBOARD */}
      {isDashboardOpen && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[100] p-10">
          <div className="bg-white border-8 border-black w-full max-w-6xl flex flex-col h-[90vh]" style={{ boxShadow: '16px 16px 0 0 var(--color-secondary)' }}>
            <div className="text-white font-pixel border-b-8 border-black p-4 text-sm flex justify-between items-center gap-4" style={{ backgroundColor: 'var(--color-primary)' }}>
              <span className="min-w-0 truncate">[ LIVE DASHBOARD - {activeEvent?.nama_event} ]</span>
              <button onClick={lockAdmin} className={KELAS_TUTUP} style={{ backgroundColor: 'var(--color-accent)' }}>X</button>
            </div>
            <div className="p-8 flex flex-col gap-6 overflow-y-auto bg-gray-100">
              <div className="flex gap-6">
                <div className="flex-1 bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000] flex flex-col gap-4">
                  <h3 className="font-pixel text-xs whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Akses Penyimpanan</h3>
                  <div className="font-sys text-base mt-2 flex flex-col gap-4">
                    <div><p className="font-bold">Direktori Lokal (Backup):</p><p className="text-gray-600 bg-gray-100 p-3 border-2 border-gray-400 select-all font-mono">{dashboardData?.localPath || 'Memuat...'}</p></div>
                    <button onClick={async () => {
                      const res = await window.electronAPI.exportEventReport(activeEvent.id);
                      if (res.success) await showDialog(`Laporan keuangan berhasil dibuat.\n\n${res.rows} transaksi tersimpan di:\n${res.path}`);
                      else await showDialog('Gagal membuat laporan: ' + res.error);
                    }} className="text-black font-pixel border-4 border-black py-3 text-xs shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap self-start px-6" style={{ backgroundColor: 'var(--color-secondary)' }}>[ EKSPOR LAPORAN EXCEL ]</button>
                    <p className="text-base text-gray-500 italic font-bold leading-tight">* Laporan dibangkitkan dari database saat tombol ditekan, dan otomatis dibuat ulang setiap sesi event ditutup.</p>
                    {globalData.app_mode === 'online' && ( <div><p className="font-bold">Google Drive:</p><p className="text-blue-600 bg-blue-50 p-3 border-2 border-blue-300 select-all break-all font-mono">{dashboardData?.gdriveLink || 'Memuat...'}</p></div> )}
                  </div>
                </div>
                <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000] flex flex-col items-center justify-center shrink-0 w-[260px]">
                  <h3 className="font-pixel text-xs mb-2 text-center whitespace-nowrap" style={{ color: 'var(--color-accent)' }}>Remote Cashier</h3>
                  {dashboardData?.adminQr ? <img src={dashboardData.adminQr} className="w-[140px] h-[140px] border-4 border-black p-1" alt="Admin QR" /> : <div className="w-[140px] h-[140px] border-4 flex items-center justify-center text-3xl">...</div>}
                  <p className="font-sys text-xs text-gray-500 mt-4 text-center leading-tight font-bold">Scan via HP Admin.<br/>QR ini berisi kunci akses — jangan dibagikan.</p>
                  <button onClick={async () => {
                     const ok = await showDialog('Cabut akses semua HP kasir yang sudah dipasangkan?\n\nSetelah ini kasir wajib scan ulang QR yang baru.', 'confirm');
                     if (!ok) return;
                     await window.electronAPI.rotateCashierToken();
                     await fetchDashboardData();
                     await showDialog('Akses lama dicabut. Silakan scan QR baru dari HP kasir.');
                  }} className="mt-4 w-full text-white font-pixel border-4 border-black py-2 text-[8px] shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-accent)' }}>[ CABUT AKSES HP ]</button>
                </div>
              </div>
              {/* STATUS UNGGAH GOOGLE DRIVE */}
              <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000] flex flex-col gap-3">
                <h3 className="font-pixel text-xs whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Unggahan Google Drive</h3>
                {dashboardData?.drive?.configured ? (
                  <>
                    <p className="font-sys text-lg">
                      <b>{dashboardData.drive.queue?.pending || 0}</b> menunggu ·
                      <b> {dashboardData.drive.queue?.uploading || 0}</b> berjalan ·
                      <b> {dashboardData.drive.queue?.done || 0}</b> selesai ·
                      <b style={{ color: (dashboardData.drive.queue?.failed || 0) > 0 ? 'var(--color-accent)' : 'inherit' }}> {dashboardData.drive.queue?.failed || 0}</b> gagal
                    </p>
                    {dashboardData.drive.queue?.lastError && (
                      <p className="font-sys text-base p-2 border-2 border-gray-400 bg-gray-100 break-words">
                        Kendala terakhir: {dashboardData.drive.queue.lastError}
                      </p>
                    )}
                    {dashboardData.drive.folderUrl && (
                      <p className="font-mono text-sm bg-gray-100 border-2 border-gray-400 p-2 select-all break-all">{dashboardData.drive.folderUrl}</p>
                    )}
                    <div className="flex gap-3 flex-wrap">
                      <button onClick={async () => {
                        await window.electronAPI.gdriveUploadNow(activeEvent.id);
                        await fetchDashboardData();
                      }} className="text-white font-pixel border-4 border-black px-5 py-3 text-[10px] shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-primary)' }}>[ UNGGAH SEKARANG ]</button>
                      <button onClick={async () => {
                        const r = await window.electronAPI.gdriveRetryFailed(activeEvent.id);
                        await fetchDashboardData();
                        await showDialog(r.requeued > 0 ? r.requeued + ' file dimasukkan ulang ke antrean.' : 'Tidak ada file gagal yang perlu diulang.');
                      }} className="text-black font-pixel border-4 border-black px-5 py-3 text-[10px] shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>[ ULANGI YANG GAGAL ]</button>
                      <button onClick={fetchDashboardData} className="bg-white text-black font-pixel border-4 border-black px-5 py-3 text-[10px] shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap">[ REFRESH ]</button>
                    </div>
                  </>
                ) : (
                  <p className="font-sys text-lg font-bold" style={{ color: 'var(--color-accent)' }}>
                    Google Drive belum terhubung — hasil sesi hanya tersimpan lokal.
                  </p>
                )}
              </div>

              {/* KONTROL UPSELL EVENT BERJALAN */}
              <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000] flex items-center gap-6 flex-wrap">
                <h3 className="font-pixel text-xs whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Cetak Tambahan</h3>
                <label className="font-sys text-lg font-bold flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-6 h-6" checked={!!dashboardData?.upsell?.enabled} onChange={async e => {
                    await window.electronAPI.updateEventUpsell({ eventId: activeEvent.id, enabled: e.target.checked, price: dashboardData?.upsell?.price || 0 });
                    fetchDashboardData();
                  }} />
                  Izinkan
                </label>
                {dashboardData?.upsell?.enabled && (
                  <div className="flex items-center gap-3 font-sys text-lg">
                    <span className="font-bold">Harga/lembar:</span>
                    <InputSentuh type="text" className="border-4 border-black p-2 w-40 outline-none font-bold" value={formatRp(dashboardData?.upsell?.price)} placeholder="ikut harga awal"
                      onChange={e => setDashboardData(d => ({ ...d, upsell: { ...d.upsell, price: parseRp(e.target.value) || 0 } }))}
                      onBlur={async e => {
                        await window.electronAPI.updateEventUpsell({ eventId: activeEvent.id, enabled: true, price: parseRp(e.target.value) || 0 });
                        fetchDashboardData();
                      }} />
                    <span className="text-base text-gray-500 italic font-bold">kosong = ikut harga awal sesi</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 gap-6">
                <div className="bg-white border-4 border-black p-4 text-center shadow-[4px_4px_0_0_#000]"><p className="font-sys text-gray-500 font-bold mb-1">Saldo Awal</p><p className="font-pixel text-xs" style={{ color: 'var(--color-primary)' }}>Rp {formatRp(dashboardData?.stats?.saldo_awal)}</p></div>
                <div className="bg-white border-4 border-black p-4 text-center shadow-[4px_4px_0_0_#000]"><p className="font-sys text-gray-500 font-bold mb-1">Penjualan</p><p className="font-pixel text-xs text-black">{dashboardData?.stats?.total_penjualan || 0} Sesi</p><p className="font-sys text-sm text-gray-500 mt-1">{dashboardData?.stats?.total_lembar || 0} lembar · {dashboardData?.stats?.total_retake || 0} retake</p></div>
                <div className="bg-white border-4 border-black p-4 text-center shadow-[4px_4px_0_0_#000]"><p className="font-sys text-gray-500 font-bold mb-1">Omzet</p><p className="font-pixel text-xs" style={{ color: 'var(--color-primary)' }}>Rp {formatRp(dashboardData?.stats?.total_revenue)}</p><p className="font-sys text-sm text-gray-500 mt-1">Upsell: {dashboardData?.stats?.total_upsell || 0}x / Rp {formatRp(dashboardData?.stats?.total_upsell_revenue)}</p></div>
                <div className="border-4 border-black p-4 text-center shadow-[8px_8px_0_0_#000]" style={{ backgroundColor: 'var(--color-secondary)' }}><p className="font-sys font-bold mb-1 text-black">Laba Bersih</p><p className="font-pixel text-sm text-black font-bold">Rp {formatRp(dashboardData?.stats?.laba_bersih)}</p><p className="font-sys text-sm text-black/60 mt-1">Sisa saldo: Rp {formatRp(dashboardData?.stats?.sisa_saldo)}</p></div>
              </div>
              <div className="bg-white border-4 border-black flex-1 flex flex-col shadow-[8px_8px_0_0_#000]">
                <div className="border-b-4 border-black p-3 font-pixel text-[10px] flex" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-secondary)' }}><div className="w-[180px]">WAKTU</div><div className="flex-1">PELANGGAN</div><div className="w-[180px]">STATUS</div><div className="w-[180px]">HARGA</div></div>
                <div className="overflow-y-auto font-sys text-xl min-h-[200px]">
                  {dashboardData?.sessions?.length === 0 && <p className="p-6 text-center text-gray-500 font-bold">Belum ada transaksi di sesi ini.</p>}
                  {dashboardData?.sessions?.map((s, i) => ( <div key={i} className="flex p-3 border-b-2 border-gray-200 hover:bg-yellow-50"><div className="w-[180px] text-base text-gray-500 pt-1">{s.waktu}</div><div className="flex-1 font-bold">{s.customer_name}</div><div className="w-[180px] font-bold text-green-600">{s.status_cetak}</div><div className="w-[180px] font-bold" style={{ color: 'var(--color-primary)' }}>Rp {formatRp(s.harga_jual)}</div></div> ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL GLOBAL SETTINGS */}
      {isGlobalOpen && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[90] p-10">
          <div className="bg-white border-8 border-black w-full max-w-5xl flex flex-col h-[90vh]" style={{ boxShadow: '16px 16px 0 0 var(--color-secondary)' }}>
            <div className="text-white font-pixel border-b-8 border-black p-4 text-sm flex justify-between items-center gap-4" style={{ backgroundColor: 'var(--color-primary)' }}>
               <span className="whitespace-nowrap">[ GLOBAL SETTINGS.INI ]</span>
               <button onClick={async ()=>{ const ok = await showDialog('Batal mengubah pengaturan? Semua yang belum disave akan hilang.', 'confirm'); if(ok) lockAdmin(); }} className={KELAS_TUTUP} style={{ backgroundColor: 'var(--color-accent)' }}>X</button>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
               <div className="w-[240px] bg-gray-200 border-r-8 border-black flex flex-col p-4 gap-3 shrink-0">
                  {TAB_PENGATURAN.map(t => (
                    <TombolTab key={t.id} tab={t} aktif={settingsTab === t.id} onPilih={setSettingsTab} />
                  ))}
               </div>

               <div className="flex-1 p-8 overflow-y-auto font-sys text-xl bg-white relative">
                  {settingsTab === 'gdrive' && (
                     <div className="flex flex-col gap-5 animate-fade-in">
                        <h2 className="font-pixel text-lg border-b-4 border-dashed border-gray-400 pb-4 whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Google Drive</h2>

                        <div className={`p-5 border-4 border-black shadow-[4px_4px_0_0_#000] ${gdrive.connected ? 'bg-green-50' : 'bg-gray-100'}`}>
                           <p className="font-bold text-lg">
                              Status: {gdrive.connected
                                 ? <span className="text-green-700">TERHUBUNG{gdrive.accountEmail ? ' — ' + gdrive.accountEmail : ''}</span>
                                 : <span style={{ color: 'var(--color-accent)' }}>BELUM TERHUBUNG</span>}
                           </p>
                           {gdrive.connected && (
                              <p className="font-sys text-base text-gray-600 mt-2">
                                 Antrean unggah: {gdrive.queue?.pending || 0} menunggu · {gdrive.queue?.uploading || 0} berjalan · {gdrive.queue?.done || 0} selesai · {gdrive.queue?.failed || 0} gagal
                              </p>
                           )}
                        </div>

                        {gdrive.usingBundled ? (
                           <div className="p-5 border-4 border-black bg-blue-50 shadow-[4px_4px_0_0_#000]">
                              <p className="font-bold text-lg" style={{ color: 'var(--color-primary)' }}>Kredensial bawaan aplikasi aktif</p>
                              <p className="font-sys text-base text-gray-700 mt-2 leading-snug">
                                 Tidak perlu membuka Google Cloud Console. Cukup tekan tombol
                                 <b> Hubungkan Akun Google</b> di bawah, lalu pilih akun Google tujuan penyimpanan.
                              </p>
                           </div>
                        ) : (
                           <div className="p-5 border-4 border-black bg-yellow-50 shadow-[4px_4px_0_0_#000]">
                              <p className="font-bold text-lg" style={{ color: 'var(--color-accent)' }}>Kredensial bawaan tidak ditemukan</p>
                              <p className="font-sys text-base text-gray-700 mt-2 leading-snug">
                                 Aplikasi ini dibangun tanpa kredensial OAuth bawaan. Isi Client ID dan
                                 Client Secret di bawah, atau hubungi penyedia aplikasi.
                              </p>
                           </div>
                        )}

                        <details className="bg-gray-100 border-4 border-black shadow-[4px_4px_0_0_#000]">
                           <summary className="p-4 font-bold text-lg cursor-pointer" style={{ color: 'var(--color-primary)' }}>
                              Kredensial OAuth sendiri (opsional)
                           </summary>
                           <div className="flex flex-col gap-3 p-5 pt-0">
                           <p className="text-base text-gray-600 font-bold leading-tight">
                              Hanya perlu diisi bila Anda ingin memakai project Google Cloud milik sendiri.
                              Aktifkan <b>Google Drive API</b>, buat <b>OAuth client ID</b> tipe <b>Desktop app</b>,
                              lalu daftarkan alamat redirect berikut:
                           </p>
                           <p className="font-mono text-base bg-white border-2 border-gray-400 p-2 select-all break-all">{gdrive.redirectUri || '...'}</p>

                           <label className="font-bold text-base mt-2">Client ID:</label>
                           <InputSentuh type="text" autoComplete="off" className="border-4 border-black p-3 outline-none text-base font-mono focus:bg-gray-200" value={gdriveForm.clientId} onChange={e=>setGdriveForm({...gdriveForm, clientId: e.target.value})} />

                           <label className="font-bold text-base mt-2">Client Secret:</label>
                           {gdrive.hasClientSecret && <p className="font-mono text-sm text-gray-500">Sudah tersimpan — kosongkan bila tidak ingin mengganti.</p>}
                           <InputSentuh type="password" autoComplete="off" className="border-4 border-black p-3 outline-none text-base font-mono focus:bg-gray-200" placeholder={gdrive.hasClientSecret ? 'Kosongkan jika tidak diganti' : 'Paste client secret...'} value={gdriveForm.clientSecret} onChange={e=>setGdriveForm({...gdriveForm, clientSecret: e.target.value})} />

                           <button onClick={async () => {
                              await window.electronAPI.gdriveSaveCredentials(gdriveForm);
                              setGdriveForm({ ...gdriveForm, clientSecret: '' });
                              await refreshGdrive();
                              await showDialog('Kredensial tersimpan.');
                           }} className="text-black font-pixel border-4 border-black py-3 text-xs shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all mt-2 whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>[ SIMPAN KREDENSIAL ]</button>
                           </div>
                        </details>

                        <div className="flex flex-col gap-3 bg-gray-100 p-5 border-4 border-black shadow-[4px_4px_0_0_#000]">
                           <label className="font-bold text-base">ID Folder Induk (opsional):</label>
                           <InputSentuh type="text" className="border-4 border-black p-3 outline-none font-mono focus:bg-gray-200" placeholder="Kosongkan = folder dibuat di root My Drive" value={globalData.gdrive_folder_id || ''} onChange={e=>setGlobalData({...globalData, gdrive_folder_id: e.target.value})} />
                           <p className="text-base text-gray-500 italic font-bold leading-tight">* Folder tiap event dibuat di dalam folder ini. Tekan SIMPAN PENGATURAN agar berlaku.</p>
                        </div>

                        <div className="flex gap-4">
                           {gdrive.connected ? (
                              <button onClick={async () => {
                                 const ok = await showDialog('Putuskan koneksi Google Drive?\n\nUnggahan yang belum selesai akan tertahan sampai dihubungkan kembali.', 'confirm');
                                 if (!ok) return;
                                 await window.electronAPI.gdriveDisconnect();
                                 await refreshGdrive();
                              }} className="text-white font-pixel border-4 border-black flex-1 py-4 text-xs shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-accent)' }}>[ PUTUSKAN KONEKSI ]</button>
                           ) : (
                              <button onClick={async () => {
                                 const res = await window.electronAPI.gdriveConnect();
                                 if (!res.success) await showDialog('Gagal: ' + res.error);
                              }} className="text-white font-pixel border-4 border-black flex-1 py-4 text-xs shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-primary)' }}>[ HUBUNGKAN AKUN GOOGLE ]</button>
                           )}
                           <button onClick={refreshGdrive} className="text-black font-pixel border-4 border-black px-6 py-4 text-xs shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>[ REFRESH ]</button>
                        </div>
                     </div>
                  )}

                  {settingsTab === 'akses' && (
                     <div className="flex flex-col gap-6 animate-fade-in">
                        <h2 className="font-pixel text-lg border-b-4 border-dashed border-gray-400 pb-4 whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Aksesibilitas</h2>

                        <div className="flex flex-col gap-3 p-5 border-4 border-black shadow-[4px_4px_0_0_#000] bg-gray-100">
                           <h3 className="font-bold text-xl" style={{ color: 'var(--color-primary)' }}>Keyboard On-Screen</h3>

                           <label className="font-bold flex items-center gap-3 text-base cursor-pointer mt-1">
                              <input
                                type="checkbox"
                                className="w-6 h-6 shrink-0"
                                checked={globalData.osk_enabled === 1}
                                onChange={e=>setGlobalData({...globalData, osk_enabled: e.target.checked ? 1 : 0})}
                              />
                              Tampilkan keyboard di layar saat mengisi form admin
                           </label>

                           <p className="text-base text-gray-600 italic font-bold leading-tight">
                              * Nyalakan bila mesin ini <b>layar sentuh tanpa keyboard fisik</b>.
                              Tanpa ini, kolom seperti Midtrans key dan ID folder Drive tidak bisa
                              diisi sama sekali dari mesin.
                           </p>
                           <p className="text-base text-gray-600 italic font-bold leading-tight">
                              * Biarkan mati bila Anda memakai keyboard fisik — keyboard layar
                              menutup sebagian form dan justru memperlambat.
                           </p>
                        </div>

                        <div className="flex flex-col gap-3 p-5 border-4 border-black shadow-[4px_4px_0_0_#000] bg-gray-100">
                           <div className="flex justify-between items-center gap-4 flex-wrap">
                              <h3 className="font-bold text-xl" style={{ color: 'var(--color-primary)' }}>Pintasan Keyboard</h3>
                              <button
                                onClick={() => { setPetaDraf({ ...PINTASAN_BAWAAN }); setMerekam(null); setPesanRekam(''); }}
                                className="font-pixel text-[10px] border-4 border-black px-4 py-3 shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none text-black"
                                style={{ backgroundColor: 'var(--color-secondary)' }}
                              >[ KEMBALIKAN BAWAAN ]</button>
                           </div>

                           <p className="text-base text-gray-600 italic font-bold leading-tight">
                              * Tekan <b>[ REKAM ]</b> lalu tekan kombinasi yang diinginkan. <b>Esc</b> membatalkan.
                              Pintasan wajib memakai <b>Ctrl</b> atau <b>Alt</b> — tanpa itu ia akan menyala
                              setiap kali hurufnya diketik pelanggan.
                           </p>

                           {pesanRekam && (
                             <p className="font-bold text-base p-3 border-4 border-black bg-red-100 text-red-800">{pesanRekam}</p>
                           )}

                           <div className="flex flex-col gap-2 mt-1">
                             {AKSI.map(a => {
                               const bentrok = bentrokDraf.find(b => b.aksi === a.id);
                               const sedang = merekam === a.id;
                               return (
                                 <div key={a.id} className="flex items-center gap-3 flex-wrap bg-white border-4 border-black p-3">
                                    <span className="font-bold flex-1 min-w-[180px] text-black">{a.label}</span>
                                    <span className="font-pixel text-[11px] border-4 border-black px-3 py-2 bg-gray-100 text-black min-w-[130px] text-center">
                                       {sedang ? 'TEKAN...' : formatPintasan(petaDraf[a.id])}
                                    </span>
                                    <button
                                      onClick={() => { setPesanRekam(''); setMerekam(sedang ? null : a.id); }}
                                      className="font-pixel text-[10px] border-4 border-black px-4 py-2 shadow-[3px_3px_0_0_#000] active:translate-y-1 active:shadow-none text-white"
                                      style={{ backgroundColor: sedang ? 'var(--color-accent)' : 'var(--color-primary)' }}
                                    >{sedang ? '[ BATAL ]' : '[ REKAM ]'}</button>
                                    {bentrok && (
                                      <p className={`w-full text-base font-bold leading-tight ${bentrok.tingkat === 'kritis' ? 'text-red-700' : 'text-amber-700'}`}>
                                         {bentrok.tingkat === 'kritis' ? '! ' : '- '}{bentrok.teks}
                                      </p>
                                    )}
                                 </div>
                               );
                             })}
                           </div>

                           <p className="text-base text-gray-600 italic font-bold leading-tight mt-1">
                              * Peringatan kuning berarti pintasan beririsan dengan perintah pengeditan
                              teks — ia tetap dipakai, tetapi diabaikan selama kursor berada di kolom isian.
                              Peringatan merah harus diperbaiki sebelum bisa disimpan.
                           </p>
                        </div>
                     </div>
                  )}

                  {settingsTab === 'tema' && (
                     <div className="flex flex-col gap-6 animate-fade-in">
                        <h2 className="font-pixel text-lg border-b-4 border-dashed border-gray-400 pb-4 whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Pilih Tema Kiosk</h2>
                        <div className="grid grid-cols-2 gap-6">
                           {[{ id: 'candy', name: 'Candy', colors: ['#007CC3', '#FFD453', '#FF3B67'] }, { id: 'bumblebee', name: 'Bumblebee', colors: ['#E5A93B', '#FAF2E3', '#754A05'] }, { id: 'neon', name: 'Neon', colors: ['#1E1F22', '#7F56FF', '#80FF56'] }, { id: 'fall', name: 'Fall', colors: ['#354E47', '#FAF2E3', '#DB627A'] }].map(t => (
                             <div key={t.id} onClick={() => setGlobalData({...globalData, active_theme: t.id})} className="p-4 border-4 cursor-pointer hover:-translate-y-1 transition-all shadow-[6px_6px_0_0_#000] flex flex-col bg-white" style={globalData.active_theme === t.id ? { borderColor: 'var(--color-primary)', outline: '4px solid var(--color-primary)' } : { borderColor: 'black' }}>
                                <span className="font-pixel text-[10px] mb-3 uppercase font-bold text-center">{t.name}</span>
                                <div className="flex h-16 w-full border-4 border-black"><div className="flex-1" style={{ backgroundColor: t.colors[0] }}></div><div className="flex-1" style={{ backgroundColor: t.colors[1] }}></div><div className="flex-1" style={{ backgroundColor: t.colors[2] }}></div></div>
                             </div>
                           ))}
                        </div>
                     </div>
                  )}
                  {settingsTab === 'umum' && (
                     <div className="flex flex-col gap-6 animate-fade-in">
                        <h2 className="font-pixel text-lg border-b-4 border-dashed border-gray-400 pb-4 whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Pengaturan Umum</h2>
                        <div className="flex items-center gap-4 bg-gray-100 p-5 border-4 border-black shadow-[4px_4px_0_0_#000]">
                           <label className="font-bold w-[150px] text-black">Mode Kiosk:</label>
                           <select className="border-4 border-black p-3 outline-none flex-1 font-bold text-black" value={globalData.app_mode} onChange={e=>setGlobalData({...globalData, app_mode: e.target.value})}>
                              <option value="online">ONLINE (Midtrans Aktif)</option>
                              <option value="offline">OFFLINE (Bayar Kasir / QR Statis)</option>
                           </select>
                        </div>
                        <div className="grid grid-cols-3 gap-6">
                           <div className="flex flex-col"><label className="font-bold mb-2">HPP Kertas (Rp)</label><InputSentuh type="text" className="border-4 border-black p-3 outline-none focus:bg-gray-200" value={formatRp(globalData.hpp_kertas)} onChange={e=>setGlobalData({...globalData, hpp_kertas: parseRp(e.target.value)})} /></div>
                           <div className="flex flex-col"><label className="font-bold mb-2">HPP Tinta (Rp)</label><InputSentuh type="text" className="border-4 border-black p-3 outline-none focus:bg-gray-200" value={formatRp(globalData.hpp_tinta)} onChange={e=>setGlobalData({...globalData, hpp_tinta: parseRp(e.target.value)})} /></div>
                           <div className="flex flex-col"><label className="font-bold mb-2">Biaya Ops (Rp)</label><InputSentuh type="text" className="border-4 border-black p-3 outline-none focus:bg-gray-200" value={formatRp(globalData.biaya_ops)} onChange={e=>setGlobalData({...globalData, biaya_ops: parseRp(e.target.value)})} /></div>
                        </div>
                        <hr className="border-2 border-dashed border-gray-300 my-2" />
                        <div className="flex flex-col bg-gray-100 p-5 border-4 border-black shadow-[4px_4px_0_0_#000]">
                           <label className="font-bold mb-2" style={{ color: 'var(--color-primary)' }}>Masa Berlaku Link Download (jam):</label>
                           <InputSentuh type="number" min="0" max="720" className="border-4 border-black p-3 outline-none focus:bg-gray-200" value={globalData.download_ttl_hours ?? 24} onChange={e=>setGlobalData({...globalData, download_ttl_hours: Math.max(0, parseInt(e.target.value, 10) || 0)})} />
                           <p className="text-base text-gray-600 italic font-bold mt-2 leading-tight">* QR download pelanggan otomatis mati setelah lewat batas ini. Isi 0 untuk tanpa batas (tidak disarankan).</p>
                        </div>

                        <hr className="border-2 border-dashed border-gray-300 my-2" />
                        <div className="flex flex-col gap-3 p-5 border-4 border-black shadow-[4px_4px_0_0_#000] bg-gray-100">
                           <h3 className="font-bold text-xl" style={{ color: 'var(--color-primary)' }}>Waktu Sesi Foto</h3>

                           <div className="grid grid-cols-2 gap-6 mt-1">
                              <div className="flex flex-col">
                                 <label className="font-bold mb-2 text-base">Durasi sesi (menit):</label>
                                 <InputSentuh type="number" min="1" max="60" className="border-4 border-black p-3 outline-none focus:bg-gray-200" value={globalData.session_minutes ?? 10} onChange={e=>setGlobalData({...globalData, session_minutes: Math.min(60, Math.max(1, parseInt(e.target.value, 10) || 1))})} />
                              </div>
                              <div className="flex flex-col">
                                 <label className="font-bold mb-2 text-base">Jaminan waktu retake (detik):</label>
                                 <InputSentuh type="number" min="0" max="600" className="border-4 border-black p-3 outline-none focus:bg-gray-200" value={globalData.retake_min_seconds ?? 90} onChange={e=>setGlobalData({...globalData, retake_min_seconds: Math.min(600, Math.max(0, parseInt(e.target.value, 10) || 0))})} />
                              </div>
                           </div>
                           <p className="text-base text-gray-600 italic font-bold leading-tight">
                              * Retake <b>tidak memperpanjang</b> sesi. Ia hanya menjamin sisa waktu minimum
                              agar retake bisa diselesaikan, sehingga satu pelanggan tidak menahan kiosk
                              terlalu lama. Isi 0 untuk mematikan jaminan ini.
                           </p>
                        </div>

                        <hr className="border-2 border-dashed border-gray-300 my-2" />
                        <div className="flex flex-col gap-3 p-5 border-4 border-black shadow-[4px_4px_0_0_#000] bg-gray-100">
                           <h3 className="font-bold text-xl" style={{ color: 'var(--color-primary)' }}>Data Pribadi Pelanggan</h3>

                           <label className="font-bold flex items-center gap-3 text-base cursor-pointer mt-1">
                              <input type="checkbox" className="w-6 h-6 shrink-0" checked={globalData.consent_enabled !== 0} onChange={e=>setGlobalData({...globalData, consent_enabled: e.target.checked ? 1 : 0})} />
                              Tampilkan layar persetujuan sebelum sesi
                           </label>
                           <p className="text-base text-gray-600 italic font-bold leading-tight">
                              * Layar ini menyebut secara eksplisit bahwa foto <b>dan video</b> direkam.
                              Matikan hanya bila Anda memasang papan pemberitahuan fisik di lokasi.
                           </p>

                           <label className="font-bold mt-3">Hapus otomatis media setelah (hari):</label>
                           <InputSentuh type="number" min="0" max="3650" className="border-4 border-black p-3 outline-none focus:bg-gray-200 max-w-xs" value={globalData.retention_days ?? 0} onChange={e=>setGlobalData({...globalData, retention_days: Math.max(0, parseInt(e.target.value, 10) || 0)})} />
                           <p className="text-base text-gray-600 italic font-bold leading-tight">
                              * <b>0 = tidak pernah menghapus.</b> Yang dihapus hanya foto dan video;
                              catatan transaksi tetap utuh agar laporan keuangan tidak rusak.
                              Sesi yang berkasnya belum selesai diunggah ke Drive tidak akan dihapus.
                           </p>

                           <div className="flex gap-3 flex-wrap mt-1">
                              <button onClick={async () => {
                                 const r = await window.electronAPI.runPurgeNow({ dryRun: true });
                                 if (r.skipped) return showDialog('Retensi masih dinonaktifkan (0 hari). Isi jumlah hari lalu simpan pengaturan lebih dulu.');
                                 await showDialog('Simulasi: ' + r.deleted + ' folder sesi akan dihapus dengan aturan saat ini.\n\nTidak ada yang dihapus pada simulasi.');
                              }} className="text-black font-pixel border-4 border-black px-5 py-3 text-[10px] shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>[ SIMULASI ]</button>

                              <button onClick={async () => {
                                 const cek = await window.electronAPI.runPurgeNow({ dryRun: true });
                                 if (cek.skipped) return showDialog('Retensi masih dinonaktifkan (0 hari).');
                                 if (!cek.deleted) return showDialog('Tidak ada media yang melewati batas retensi.');
                                 const ok = await showDialog(cek.deleted + ' folder sesi akan DIHAPUS PERMANEN dari mesin ini.\n\nLanjutkan?', 'confirm');
                                 if (!ok) return;
                                 const r = await window.electronAPI.runPurgeNow({});
                                 await showDialog(r.deleted + ' folder dihapus' + (r.failed ? ', ' + r.failed + ' gagal' : '') + '.');
                              }} className="text-white font-pixel border-4 border-black px-5 py-3 text-[10px] shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-accent)' }}>[ HAPUS SEKARANG ]</button>
                           </div>
                        </div>

                        <hr className="border-2 border-dashed border-gray-300 my-2" />
                        <div className="flex flex-col gap-4 p-5 border-4 border-black bg-gray-100 shadow-[4px_4px_0_0_#000]">
                           <label className="font-bold" style={{ color: 'var(--color-primary)' }}>Layar Terima Kasih:</label>

                           <label className="font-bold flex items-center gap-3 text-base cursor-pointer text-black">
                              <input type="checkbox" className="w-6 h-6 shrink-0" checked={globalData.thanks_enabled !== 0} onChange={e=>setGlobalData({...globalData, thanks_enabled: e.target.checked ? 1 : 0})} />
                              Tampilkan setelah pelanggan menekan SELESAI
                           </label>

                           {globalData.thanks_enabled !== 0 && (
                              <>
                                 <div className="flex flex-col">
                                    <label className="font-bold mb-2 text-base">Pesan yang Ditampilkan:</label>
                                    <textarea
                                       rows={3}
                                       maxLength={300}
                                       className="border-4 border-black p-3 outline-none focus:bg-gray-200 font-sys text-base resize-none"
                                       value={globalData.thanks_message ?? ''}
                                       onChange={e=>setGlobalData({...globalData, thanks_message: e.target.value})}
                                       placeholder={PESAN_TERIMA_KASIH_BAWAAN}
                                    />
                                    <p className="text-base text-gray-500 italic font-bold mt-2 leading-tight">* Kosongkan untuk memakai pesan bawaan. Tekan Enter untuk baris baru — tiap baris tampil terpisah.</p>
                                 </div>

                                 <div className="flex flex-col max-w-xs">
                                    <label className="font-bold mb-2 text-base">Tutup Otomatis Setelah (detik):</label>
                                    <input
                                       type="number" min="1" max="15"
                                       className="border-4 border-black p-3 outline-none focus:bg-gray-200"
                                       value={globalData.thanks_seconds ?? DETIK_BAWAAN}
                                       onChange={e=>setGlobalData({...globalData, thanks_seconds: Math.min(15, Math.max(1, parseInt(e.target.value, 10) || DETIK_BAWAAN))})}
                                    />
                                    <p className="text-base text-gray-500 italic font-bold mt-2 leading-tight">* 1–15 detik. Pelanggan juga bisa mengetuk layar untuk kembali lebih cepat.</p>
                                 </div>
                              </>
                           )}
                        </div>

                        <hr className="border-2 border-dashed border-gray-300 my-2" />
                        <div className="flex flex-col gap-3 p-5 border-4 border-black shadow-[4px_4px_0_0_#000]" style={{ backgroundColor: pinIsDefault ? '#FFE8E8' : '#f3f4f6' }}>
                           <label className="font-bold" style={{ color: 'var(--color-primary)' }}>PIN Admin (pelindung Ctrl+Shift+P / T / D):</label>
                           {pinIsDefault && <p className="font-bold text-base leading-tight" style={{ color: 'var(--color-accent)' }}>⚠ PIN masih memakai nilai bawaan (1234). Segera ganti — siapa pun yang tahu angka ini bisa membuka pengaturan dan menghapus data event.</p>}
                           <div className="grid grid-cols-2 gap-4">
                              <InputSentuh type="password" inputMode="numeric" autoComplete="off" className="border-4 border-black p-3 outline-none focus:bg-gray-200" placeholder="PIN lama" value={pinForm.current} onChange={e=>setPinForm({...pinForm, current: e.target.value.replace(/\D/g,'')})} />
                              <InputSentuh type="password" inputMode="numeric" autoComplete="off" className="border-4 border-black p-3 outline-none focus:bg-gray-200" placeholder="PIN baru (4-8 digit)" value={pinForm.next} onChange={e=>setPinForm({...pinForm, next: e.target.value.replace(/\D/g,'')})} />
                           </div>
                           <button onClick={async () => {
                              const res = await window.electronAPI.setAdminPin({ currentPin: pinForm.current, newPin: pinForm.next });
                              if (res.success) {
                                 setPinForm({ current: '', next: '' });
                                 setPinIsDefault(await window.electronAPI.isAdminPinDefault());
                                 await showDialog('PIN admin berhasil diganti.');
                              } else await showDialog('Gagal: ' + res.error);
                           }} disabled={!pinForm.current || !pinForm.next} className="text-white font-pixel border-4 border-black py-3 text-xs shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all disabled:opacity-40 whitespace-nowrap" style={{ backgroundColor: 'var(--color-primary)' }}>[ GANTI PIN ]</button>
                        </div>

                        <hr className="border-2 border-dashed border-gray-300 my-2" />
                        <label className="font-bold mt-2" style={{ color: 'var(--color-primary)' }}>ID Folder Google Drive (Induk Event):</label>
                        <InputSentuh type="text" className="border-4 border-black p-4 outline-none font-mono focus:bg-gray-200" placeholder="Paste ID Folder GDrive..." value={globalData.gdrive_folder_id} onChange={e=>setGlobalData({...globalData, gdrive_folder_id: e.target.value})} />
                        <p className="text-base text-gray-500 italic font-bold">* Kosongkan jika tidak auto-upload ke cloud.</p>
                     </div>
                  )}

                  {settingsTab === 'midtrans' && (
                     <div className="flex flex-col gap-6 animate-fade-in">
                        <h2 className="font-pixel text-lg border-b-4 border-dashed border-gray-400 pb-4 whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Gateway Pembayaran</h2>
                        <div className="flex flex-col gap-4 bg-gray-100 p-6 border-4 border-black shadow-[4px_4px_0_0_#000]">
                           <h3 className="font-bold text-xl whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>API Midtrans (Online)</h3>
                           <label className="font-bold flex items-center gap-3 text-sm text-white p-4 border-4 border-black cursor-pointer shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all" style={{ backgroundColor: globalData.midtrans_is_production === 1 ? 'var(--color-accent)' : 'var(--color-primary)' }}>
                              <input type="checkbox" className="w-6 h-6 shrink-0" checked={globalData.midtrans_is_production === 1} onChange={e=>setGlobalData({...globalData, midtrans_is_production: e.target.checked ? 1 : 0})} />
                              MODE PRODUCTION (UANG ASLI)
                           </label>
                           <p className="text-sm text-gray-600 italic font-bold leading-tight">* Jika tidak dicentang, semua transaksi memakai server Sandbox Midtrans dan TIDAK menagih uang sungguhan. Pastikan key yang diisi cocok dengan mode ini.</p>
                           <div className="flex flex-col gap-3 mt-2">
                              <label className="font-bold text-base">Server Key:</label>
                              {settings?.has_midtrans_server_key && (
                                 <p className="font-mono text-base bg-gray-200 border-2 border-gray-400 p-2">Terpasang: {settings.midtrans_server_key_masked}</p>
                              )}
                              <InputSentuh type="password" autoComplete="off" className="border-4 border-black p-3 outline-none text-base bg-white focus:bg-gray-200 font-mono" placeholder={settings?.has_midtrans_server_key ? 'Kosongkan jika tidak ingin mengganti' : 'Paste server key...'} value={globalData.midtrans_server_key || ''} onChange={e=>setGlobalData({...globalData, midtrans_server_key: e.target.value})} />
                              {settings?.secure_storage_available === false && (
                                 <p className="text-sm font-bold leading-tight" style={{ color: 'var(--color-accent)' }}>⚠ Keychain OS tidak tersedia di mesin ini — server key terpaksa disimpan apa adanya.</p>
                              )}
                              <label className="font-bold text-base mt-2">Client Key:</label>
                              <InputSentuh type="text" className="border-4 border-black p-3 outline-none text-base bg-white focus:bg-gray-200 font-mono" value={globalData.midtrans_client_key} onChange={e=>setGlobalData({...globalData, midtrans_client_key: e.target.value})} />
                           </div>
                        </div>

                        <div className="flex flex-col gap-4 bg-gray-100 p-6 border-4 border-black shadow-[4px_4px_0_0_#000] mt-2">
                           <h3 className="font-bold text-xl flex items-center justify-between whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>
                              QRIS Statis (Offline)
                              <label className="font-bold flex items-center gap-3 text-xs text-white p-3 border-4 border-black cursor-pointer shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all" style={{ backgroundColor: 'var(--color-primary)' }}>
                                 <input type="checkbox" className="w-5 h-5 shrink-0" checked={globalData.force_static_qr === 1} onChange={e=>setGlobalData({...globalData, force_static_qr: e.target.checked ? 1 : 0})} /> 
                                 PAKSA SELALU STATIS
                              </label>
                           </h3>
                           <div className="flex gap-8 items-start mt-4">
                              <div className="flex-1 flex flex-col gap-4">
                                 <p className="text-base text-gray-600 font-bold">Gambar ini akan dimunculkan di layar Kiosk saat mode Offline aktif. Pembayaran diverifikasi manual dari HP Kasir.</p>
                                 <button type="button" onClick={async () => { const path = await window.electronAPI.selectStaticQR(); if(path) setGlobalData({...globalData, static_qr_path: path}); }} className="text-black font-pixel border-4 border-black py-3 text-xs shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>[ UPLOAD GAMBAR QR BARU ]</button>
                              </div>
                              <div className="border-4 border-dashed border-gray-400 bg-white w-[180px] h-[180px] flex items-center justify-center shrink-0 p-2">
                                 {globalData.static_qr_path ? <img src={localUrl(`/qr/${globalData.static_qr_path}`)} className="max-w-full max-h-full object-contain" alt="QR Preview" /> : <span className="text-sm font-bold text-gray-400">Belum diupload</span>}
                              </div>
                           </div>
                        </div>
                     </div>
                  )}

                  {settingsTab === 'hardware' && (
                     <div className="flex flex-col gap-6 animate-fade-in">
                        <h2 className="font-pixel text-lg border-b-4 border-dashed border-gray-400 pb-4 whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Hardware & Mesin</h2>
                        <label className="font-bold flex items-center gap-4 text-sm text-white p-6 border-4 border-black cursor-pointer shadow-[8px_8px_0_0_#000] active:translate-y-1 transition-all mt-2" style={{ backgroundColor: 'var(--color-accent)' }}>
                           <input type="checkbox" className="w-6 h-6 shrink-0 accent-white" checked={globalData.hw_bypass_mode === 1} onChange={e=>setGlobalData({...globalData, hw_bypass_mode: e.target.checked ? 1 : 0})} /> 
                           AKTIFKAN MODE TROUBLESHOOTING (Bypass Pemblokir Kiosk)
                        </label>
                        <p className="text-base text-gray-600 px-2 italic font-bold">* Centang kotak di atas jika mesin gagal mendeteksi kamera/printer namun Anda ingin Kiosk tetap berjalan secara digital.</p>
                        
                        <div className="flex flex-col gap-4 mt-6 bg-gray-100 p-8 border-4 border-black shadow-[4px_4px_0_0_#000]">
                           <label className="font-bold text-xl whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Pilih Kamera Utama:</label>
                           <select className="border-4 border-black p-4 text-xl outline-none cursor-pointer focus:bg-gray-200" value={globalData.selected_camera} onChange={e=>setGlobalData({...globalData, selected_camera: e.target.value})}>
                              <option value="">-- Gunakan Kamera Bawaan Sistem --</option>
                              {availableCameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label}</option>)}
                           </select>

                           <label className="font-bold text-xl mt-6 whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Pilih Printer Thermal/Foto:</label>
                           <select className="border-4 border-black p-4 text-xl outline-none cursor-pointer focus:bg-gray-200" value={globalData.selected_printer} onChange={e=>setGlobalData({...globalData, selected_printer: e.target.value})}>
                              <option value="">-- Gunakan Printer Bawaan Sistem --</option>
                              {availablePrinters.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                           </select>
                        </div>

                        <div className="flex flex-col gap-4 mt-2 bg-gray-100 p-8 border-4 border-black shadow-[4px_4px_0_0_#000]">
                           <h3 className="font-bold text-xl whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Alamat Jaringan (QR)</h3>
                           <p className="text-base text-gray-600 font-bold leading-tight">Alamat ini yang dimasukkan ke QR pelanggan dan QR pairing kasir. Jika HP tidak bisa membuka link, kemungkinan sistem memilih adapter VPN/Hyper-V — pilih manual di sini.</p>
                           <p className="font-mono text-lg p-2 bg-white border-2 border-gray-400">Sedang dipakai: <b>{network.current || '...'}</b></p>
                           <select className="border-4 border-black p-3 outline-none cursor-pointer focus:bg-gray-200" value={globalData.server_ip_override || ''} onChange={e=>setGlobalData({...globalData, server_ip_override: e.target.value})}>
                              <option value="">-- Deteksi Otomatis (disarankan) --</option>
                              {network.interfaces.map(i => <option key={i.address} value={i.address}>{i.address} — {i.name}</option>)}
                           </select>
                        </div>

                        <div className="flex flex-col gap-4 mt-2 bg-gray-100 p-8 border-4 border-black shadow-[4px_4px_0_0_#000]">
                           <h3 className="font-bold text-xl whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Pengaturan Cetak</h3>

                           <label className="font-bold flex items-center gap-3 text-base cursor-pointer text-black mt-2">
                              <input type="checkbox" className="w-6 h-6 shrink-0" checked={globalData.print_enabled !== 0} onChange={e=>setGlobalData({...globalData, print_enabled: e.target.checked ? 1 : 0})} />
                              Aktifkan cetak otomatis setelah render
                           </label>

                           <div className="grid grid-cols-2 gap-6 mt-2">
                              <div className="flex flex-col">
                                 <label className="font-bold mb-2 text-base">Jumlah Kopi per Cetak:</label>
                                 <InputSentuh type="number" min="1" max="10" className="border-4 border-black p-3 outline-none focus:bg-gray-200" value={globalData.print_copies ?? 1} onChange={e=>setGlobalData({...globalData, print_copies: Math.max(1, parseInt(e.target.value, 10) || 1)})} />
                              </div>
                              <div className="flex flex-col">
                                 <label className="font-bold mb-2 text-base">Ukuran Kertas:</label>
                                 <select className="border-4 border-black p-3 outline-none cursor-pointer focus:bg-gray-200" value={globalData.print_paper_size || ''} onChange={e=>setGlobalData({...globalData, print_paper_size: e.target.value})}>
                                    <option value="">-- Ikuti Setelan Driver --</option>
                                    <option value="4R">4R (4x6 inci)</option>
                                    <option value="2x6">Photostrip (2x6 inci)</option>
                                    <option value="A6">A6</option>
                                    <option value="A5">A5</option>
                                    <option value="A4">A4</option>
                                 </select>
                              </div>
                           </div>
                           <p className="text-base text-gray-600 italic font-bold mt-2 leading-tight">* Jika MODE TROUBLESHOOTING aktif, hasil tidak dicetak fisik melainkan disimpan sebagai PDF di folder sesi — berguna untuk pengujian tanpa printer.</p>
                           <p className="text-base text-gray-600 italic font-bold leading-tight">* Mematikan cetak otomatis mengubah kiosk jadi <b>photobooth digital</b>: pelanggan tetap dapat foto &amp; video lewat QR, hanya tidak ada lembar fisik. Tawaran cetak tambahan ikut disembunyikan.</p>
                        </div>
                     </div>
                  )}
               </div>
            </div>

            <div className="border-t-8 border-black bg-gray-200 p-6 flex gap-6 shrink-0">
               <button onClick={async ()=>{ const ok = await showDialog('Batal mengubah pengaturan?', 'confirm'); if(ok) lockAdmin(); }} className="text-white font-pixel border-4 border-black flex-1 py-4 text-sm shadow-[6px_6px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-accent)' }}>[ BATAL (JANGAN SIMPAN) ]</button>
               <button onClick={saveGlobalSettings} className="text-white font-pixel border-4 border-black flex-1 py-4 text-sm shadow-[6px_6px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-primary)' }}>[ SIMPAN PENGATURAN ]</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL 3: MASTER TEMPLATE */}
      {isTemplateOpen && !editingTemplate && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[80] p-10">
          <div className="bg-white border-8 border-black w-full max-w-6xl flex flex-col h-[90vh]" style={{ boxShadow: '16px 16px 0 0 var(--color-secondary)' }}>
            <div className="text-white font-pixel border-b-8 border-black p-4 text-sm flex justify-between items-center gap-4" style={{ backgroundColor: 'var(--color-primary)' }}>
              <span className="whitespace-nowrap">[ MASTER TEMPLATE LIBRARY ]</span>
              <button onClick={lockAdmin} className={KELAS_TUTUP} style={{ backgroundColor: 'var(--color-accent)' }}>X</button>
            </div>
            <div className="p-8 flex flex-col gap-8 overflow-y-auto bg-gray-100">
              <div className="flex justify-between items-center bg-white p-6 border-4 border-black shadow-[8px_8px_0_0_#000]">
                <div><h2 className="font-pixel text-xl whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Database Master Template</h2></div>
                <button onClick={async () => { const path = await window.electronAPI.openFileDialog(); if (path) { const res = await window.electronAPI.saveNewTemplate({ tempPath: path }); if(res.success) { fetchTemplates(); } } }} className="text-black font-pixel border-4 border-black px-6 py-3 text-xs shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>[+] UPLOAD PNG BARU</button>
              </div>
              <div className="grid grid-cols-2 gap-6">
                {templates.map(tpl => (
                  <div key={tpl.id} className="bg-white border-4 border-black p-5 flex gap-6 shadow-[8px_8px_0_0_#000]">
                    <div className="w-[120px] h-[160px] bg-gray-200 flex justify-center items-center shrink-0 border-4 border-dashed border-gray-400 relative p-2">
                       <img src={localUrl(`/templates/${tpl.filename}`)} className="max-h-full object-contain" />
                       <div className="absolute -top-4 -right-4 bg-black px-2 py-1 text-[8px] font-pixel border-2 whitespace-nowrap" style={{ color: 'var(--color-secondary)', borderColor: 'var(--color-secondary)' }}>{tpl.orientation?.toUpperCase()}</div>
                    </div>
                    <div className="flex flex-col flex-1 font-sys gap-3">
                      <p className="font-bold truncate border-b-4 border-dashed border-gray-300 pb-2 text-xl" style={{ color: 'var(--color-primary)' }}>{tpl.filename}</p>
                      <div className="flex gap-4"><label className="text-base font-bold flex items-center gap-2 cursor-pointer text-gray-700"><input type="checkbox" className="w-5 h-5" checked={tpl.is_visible===1} onChange={e=>updateMasterAttr(tpl, 'is_visible', e.target.checked?1:0)} /> Tampil di Kiosk</label></div>
                      <div className="flex items-center gap-3 mt-1"><span className="text-sm font-bold px-3 py-1 border-2 border-black" style={{ backgroundColor: 'var(--color-secondary)' }}>Harga Dasar:</span><InputSentuh type="text" className="border-4 border-gray-300 p-2 w-32 outline-none font-bold text-lg focus:border-[#007CC3]" value={formatRp(tpl.price)} onChange={(e) => updateMasterAttr(tpl, 'price', parseRp(e.target.value))} /></div>
                      <div className="mt-auto flex gap-3">
                        <button onClick={() => setEditingTemplate(tpl)} className="text-white font-pixel border-4 border-black flex-1 py-3 text-[10px] shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-primary)' }}>[ Setting Template ]</button>
                        <button onClick={async () => { const ok = await showDialog("Hapus master template ini selamanya?", "confirm"); if(ok) { await window.electronAPI.deleteTemplate(tpl.id); fetchTemplates(); } }} className="text-white font-pixel border-4 border-black px-6 py-3 text-[10px] shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-accent)' }}>[ X ]</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {editingTemplate && <VisualEditor template={editingTemplate} onCancel={()=>setEditingTemplate(null)} onSave={async(s, newOrientation) => { await window.electronAPI.updateTemplate({ ...editingTemplate, slots: s, orientation: newOrientation }); fetchTemplates(); setEditingTemplate(null); showDialog("Setting Template Disimpan!"); }} />}

      {/* Melayang di bawah layar, di atas seluruh modal admin tetapi DI BAWAH
          gerbang PIN — gerbang itu punya keypad angkanya sendiri. Hanya muncul
          bila operator menyalakannya di tab Aksesibilitas. */}
      {settings?.osk_enabled === 1 && oskTarget && (
        <div data-osk="1" className="fixed bottom-0 left-0 right-0 z-[400]">
          <KeyboardAdmin target={oskTarget} onTutup={() => osk.lepas(oskTarget)} />
        </div>
      )}
    </OskContext.Provider>
  );
}
