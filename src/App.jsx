import { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useStore } from './store/useStore';

// ==========================================
// UTILITY: FORMATTER RUPIAH 
// ==========================================
const formatRp = (val) => {
  if (val === '' || val === null || val === undefined || isNaN(val)) return '';
  return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};
const parseRp = (val) => {
  if (typeof val !== 'string') return val;
  const parsed = parseInt(val.replace(/\./g, ''), 10);
  return isNaN(parsed) ? '' : parsed;
};

// ==========================================
// VISUAL TEMPLATE EDITOR
// ==========================================
function VisualEditor({ template, onSave, onCancel }) {
  const initialSlots = typeof template.slots === 'string' ? JSON.parse(template.slots) : (template.slots || []);
  const [slots, setSlots] = useState(initialSlots);
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      const scaleX = (containerRef.current.clientWidth - 40) / Number(template.width);
      const scaleY = (containerRef.current.clientHeight - 40) / Number(template.height);
      setScale(Math.min(scaleX, scaleY, 1));
    }
  }, [template]);

  const handlePointerDown = (e, index, action) => {
    e.preventDefault();
    const startX = e.clientX; const startY = e.clientY; const startSlot = { ...slots[index] };
    const handlePointerMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / scale; const dy = (moveEvent.clientY - startY) / scale;
      const newSlots = [...slots];
      if (action === 'move') newSlots[index] = { ...startSlot, left: Math.round(startSlot.left + dx), top: Math.round(startSlot.top + dy) };
      else if (action === 'resize') newSlots[index] = { ...startSlot, width: Math.max(50, Math.round(startSlot.width + dx)), height: Math.max(50, Math.round(startSlot.height + dy)) };
      setSlots(newSlots);
    };
    const handlePointerUp = () => { window.removeEventListener('mousemove', handlePointerMove); window.removeEventListener('mouseup', handlePointerUp); };
    window.addEventListener('mousemove', handlePointerMove); window.addEventListener('mouseup', handlePointerUp);
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[80] flex p-6 gap-6">
      <div ref={containerRef} className="flex-1 editor-canvas-container flex items-center justify-center relative overflow-hidden">
        <div style={{ width: Number(template.width), height: Number(template.height), transform: `scale(${scale})`, transformOrigin: 'center center', backgroundImage: `url('http://localhost:3000/templates/${template.filename}')`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }} className="relative shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-white shrink-0">
          {slots.map((slot, i) => (
            <div key={i} className="slot-box" style={{ top: slot.top, left: slot.left, width: slot.width, height: slot.height }} onMouseDown={(e) => handlePointerDown(e, i, 'move')}>
              {i + 1}<div className="resize-handle" onMouseDown={(e) => { e.stopPropagation(); handlePointerDown(e, i, 'resize'); }} />
            </div>
          ))}
        </div>
      </div>
      <div className="w-[350px] retro-window bg-white flex flex-col shrink-0">
        <div className="retro-header">⚙️ EDITOR TEMPLATE</div>
        <div className="p-4 flex flex-col gap-4 flex-1 overflow-y-auto">
          <button onClick={() => setSlots([...slots, { top: 50, left: 50, width: 300, height: 200 }])} className="retro-btn py-2">➕ TAMBAH SLOT FOTO</button>
          <div className="font-sys text-lg border-t-2 border-dashed border-gray-400 pt-4 mt-2">
            {slots.map((slot, i) => (
              <div key={i} className="flex justify-between items-center bg-gray-100 p-2 border-2 border-retro-border mb-2">
                <span>Slot {i + 1}</span>
                <button onClick={() => setSlots(slots.filter((_, idx) => idx !== i))} className="text-red-600 font-bold hover:scale-110">X</button>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t-4 border-retro-border flex gap-2">
          <button onClick={onCancel} className="retro-btn-danger flex-1 py-2 text-sm">BATAL</button>
          <button onClick={() => onSave(slots)} className="retro-btn flex-1 py-2 text-sm">SIMPAN</button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// [BARU] VIRTUAL KEYBOARD (RETRO TOUCHSCREEN)
// ==========================================
function VirtualKeyboard({ value, onChange, onEnter }) {
  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE']
  ];

  const handleKeyPress = (key) => {
    if (key === 'BACKSPACE') { onChange(value.slice(0, -1)); } 
    else if (key === 'SPACE') { onChange(value + ' '); } 
    else { onChange(value + key); }
  };

  return (
    <div className="bg-gray-800 p-6 border-4 border-retro-border mt-8 w-full max-w-4xl mx-auto shadow-[8px_8px_0_0_#222] select-none">
      {rows.map((row, i) => (
        <div key={i} className="flex justify-center gap-2 mb-3">
          {row.map(key => (
            <button key={key} onClick={() => handleKeyPress(key)} className={`bg-gray-200 border-b-4 border-gray-400 active:border-b-0 active:translate-y-1 font-pixel text-2xl p-4 hover:bg-white transition-all ${key === 'BACKSPACE' ? 'px-6 bg-red-200 border-red-400 hover:bg-red-300' : 'w-16 h-16 flex items-center justify-center'}`}>
              {key === 'BACKSPACE' ? '⌫' : key}
            </button>
          ))}
        </div>
      ))}
      <div className="flex justify-center gap-4 mt-2">
        <button onClick={() => handleKeyPress('SPACE')} className="bg-gray-200 border-b-4 border-gray-400 active:border-b-0 active:translate-y-1 font-pixel text-2xl px-32 py-4 hover:bg-white">SPACE</button>
        <button onClick={onEnter} className="bg-green-400 border-b-4 border-green-600 active:border-b-0 active:translate-y-1 font-pixel text-2xl px-12 py-4 hover:bg-green-300">ENTER / LANJUT</button>
      </div>
    </div>
  );
}

// ==========================================
// KOMPONEN UTAMA
// ==========================================
export default function App() {
  const store = useStore();
  
  // States - Admin Modals
  const [isGlobalOpen, setGlobalOpen] = useState(false);
  const [isTemplateOpen, setTemplateOpen] = useState(false);
  const [isDashboardOpen, setDashboardOpen] = useState(false); 
  const [dashboardData, setDashboardData] = useState(null); 
  
  const [globalData, setGlobalData] = useState({ hpp_kertas: '', hpp_tinta: '', biaya_ops: '', midtrans_server_key: '', midtrans_client_key: '', app_mode: 'online' });
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [hwStatus, setHwStatus] = useState(null);

  // States - Session Manager
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEventData, setNewEventData] = useState({ nama_event: '', saldo_awal: '' });
  const [selectedEventTemplates, setSelectedEventTemplates] = useState([]); 

  // States - Customer Flow
  const [customerTemplate, setCustomerTemplate] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [finalResult, setFinalResult] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [statusText, setStatusText] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [countdown, setCountdown] = useState(null);
  
  // Timer Sesi & Live Preview Ref
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null);
  const [timeLeftDisplay, setTimeLeftDisplay] = useState(0);
  
  const previewContainerRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(1);
  const reviewPreviewContainerRef = useRef(null);
  const [reviewPreviewScale, setReviewPreviewScale] = useState(1);

  // [BARU] Hardware & Kasir State
  const [hwStatus, setHwStatus] = useState(null);
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [availableCameras, setAvailableCameras] = useState([]);

  const capturedPhotosRef = useRef(store.capturedPhotos);
  const currentScreenRef = useRef(store.currentScreen);
  useEffect(() => { capturedPhotosRef.current = store.capturedPhotos; }, [store.capturedPhotos]);
  useEffect(() => { currentScreenRef.current = store.currentScreen; }, [store.currentScreen]);

  useEffect(() => {
    store.fetchSettings(); store.fetchTemplates(); store.fetchServerIP(); 
    store.fetchActiveEvent(); store.fetchRecentEvents();
    
    // [BARU] Cek Hardware & Ambil List Device
    const initHardware = async () => {
      let msg = "";
      try {
        const hw = await window.electronAPI.checkHardware();
        setAvailablePrinters(hw.printers || []);
        msg += hw.printers?.length > 0 ? `🖨️ Printer OK. ` : `❌ Printer Tidak Terdeteksi. `;

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(device => device.kind === 'videoinput');
        setAvailableCameras(videoInputs);
        msg += videoInputs.length > 0 ? `📷 Kamera OK.` : `❌ Kamera Error.`;

        if(hw.printers?.length > 0 && videoInputs.length > 0) store.setHardwareReady(true);
        else store.setHardwareReady(false);
      } catch(e) { msg += `❌ Hardware Error.`; store.setHardwareReady(false); }

      setHwStatus(msg);
      setTimeout(() => setHwStatus(null), 6000); // Pudar dalam 6 detik
    };
    initHardware();

    // [BARU] Listener Remote Cashier
    if (window.electronAPI.onRemoteVerify) {
      window.electronAPI.onRemoteVerify(() => {
        if (useStore.getState().waitingForPayment) {
          setStatusText("Verifikasi Sukses!");
          setTimeout(() => {
            store.setWaitingForPayment(false);
            executeStartSessionTimer(); // Lanjut ke kamera
          }, 1000);
        }
      });
      window.electronAPI.onRemoteClose(() => {
        store.resetCustomerSession();
        store.setScreen('landing');
      });
      window.electronAPI.onRemoteRestart(() => {
        window.location.reload();
      });
    }

    const handleKeyDown = async (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') { setGlobalOpen(p=>!p); setTemplateOpen(false); setDashboardOpen(false); }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') { setTemplateOpen(p=>!p); setGlobalOpen(false); setDashboardOpen(false); }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') { 
        setDashboardOpen(p=>!p); setGlobalOpen(false); setTemplateOpen(false); 
        fetchDashboardData(); 
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'x') {
        const ev = await window.electronAPI.getActiveEvent();
        if (ev && confirm(`TUTUP event "${ev.nama_event}" secara permanen?`)) {
          await window.electronAPI.closeEvent(ev.id);
          store.fetchActiveEvent(); 
          store.fetchRecentEvents(); 
          setShowCreateForm(false); 
          setDashboardOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => { if (store.settings) setGlobalData(store.settings); }, [store.settings]);

  // Kalkulasi Skala Live Preview Kamera & Review (Anti-Melar)
  useEffect(() => {
    const updateScale = () => {
      if (previewContainerRef.current && customerTemplate) {
        const sX = (previewContainerRef.current.clientWidth - 16) / Number(customerTemplate.width);
        const sY = (previewContainerRef.current.clientHeight - 16) / Number(customerTemplate.height);
        setPreviewScale(Math.min(sX, sY, 1));
      }
      if (reviewPreviewContainerRef.current && customerTemplate) {
        const sX = (reviewPreviewContainerRef.current.clientWidth - 16) / Number(customerTemplate.width);
        const sY = (reviewPreviewContainerRef.current.clientHeight - 16) / Number(customerTemplate.height);
        setReviewPreviewScale(Math.min(sX, sY, 1));
      }
    };
    const timer = setTimeout(updateScale, 100);
    window.addEventListener('resize', updateScale);
    return () => { clearTimeout(timer); window.removeEventListener('resize', updateScale); };
  }, [store.currentScreen, customerTemplate, store.capturedPhotos]);

  const fetchDashboardData = async () => {
    const ev = await window.electronAPI.getActiveEvent();
    if (ev) {
      const data = await window.electronAPI.getDashboardData(ev.id);
      setDashboardData(data);
    }
  };

  useEffect(() => {
    if (!sessionExpiresAt) return;
    const displayInterval = setInterval(() => { setTimeLeftDisplay(Math.max(0, Math.floor((sessionExpiresAt - Date.now()) / 1000))); }, 1000);
    const timeToWait = sessionExpiresAt - Date.now();
    const doomTimer = setTimeout(() => { handleAutoFinish(); }, Math.max(0, timeToWait));
    return () => { clearInterval(displayInterval); clearTimeout(doomTimer); };
  }, [sessionExpiresAt, customerTemplate]);

  // LISTENER REMOTE CASHIER (DARI HP ADMIN)
  useEffect(() => {
    if (!window.electronAPI.onManualVerify) return;
    window.electronAPI.onManualVerify(() => {
      // Cek apakah Kiosk sedang benar-benar di layar payment
      if (currentScreenRef.current === 'payment') {
        setStatusText("Verifikasi Sukses!");
        setTimeout(() => { store.setScreen('input_name'); }, 1000);
      }
    });
    return () => { window.electronAPI.offManualVerify(); };
  }, []);

  const handleAutoFinish = async () => {
    const screen = currentScreenRef.current;
    if (screen !== 'camera' && screen !== 'review') return; 

    setSessionExpiresAt(null);
    if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());

    const blankImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
    const filledPhotos = capturedPhotosRef.current.map(p => p || blankImage);
    
    store.setCapturedPhotos(filledPhotos);
    store.setScreen('loading');

    const res = await window.electronAPI.processImages({ 
      photosBase64: filledPhotos, 
      templateId: customerTemplate.id, 
      eventFolder: store.activeEvent.folder_name,
      eventId: store.activeEvent.id,
      customerName: customerName,
      price: customerTemplate.override_price
    });

    if(res.success) { setFinalResult(res); store.setScreen('result'); } 
    else { alert("Gagal Merender: " + res.error); store.setScreen('landing'); }
  };

  const saveGlobalSettings = async (e) => { e.preventDefault(); await window.electronAPI.saveSettings(globalData); store.fetchSettings(); alert("Pengaturan Disimpan!"); setGlobalOpen(false); };
  const uploadMasterTemplate = async () => { const filePath = await window.electronAPI.openFileDialog(); if (filePath) { const res = await window.electronAPI.saveNewTemplate({ tempPath: filePath }); if (res.success) store.fetchTemplates(); } };
  const updateMasterAttr = async (tpl, field, value) => { await window.electronAPI.updateTemplate({ ...tpl, [field]: value }); store.fetchTemplates(); };

  const toggleEventTemplate = (tpl) => {
    const exists = selectedEventTemplates.find(t => t.id === tpl.id);
    if (exists) setSelectedEventTemplates(selectedEventTemplates.filter(t => t.id !== tpl.id));
    else setSelectedEventTemplates([...selectedEventTemplates, { ...tpl, override_price: tpl.price }]);
  };

  const createEventSession = async () => {
    if(!newEventData.nama_event) return alert("Nama Event wajib diisi!");
    if(selectedEventTemplates.length === 0) return alert("Minimal pilih 1 template!");
    const res = await window.electronAPI.createEvent({ nama_event: newEventData.nama_event, saldo_awal: parseRp(newEventData.saldo_awal) || 0, templates: selectedEventTemplates });
    if(res.success) { setNewEventData({ nama_event: '', saldo_awal: '' }); setSelectedEventTemplates([]); setShowCreateForm(false); store.fetchActiveEvent(); store.fetchRecentEvents(); } 
    else alert("Sistem Gagal: " + res.error);
  };
  const reopenEvent = async (eventId) => { if(confirm("Lanjutkan sesi ini?")) { await window.electronAPI.reopenEvent(eventId); store.fetchActiveEvent(); } };

  // CUSTOMER FLOW HANDLERS
  const startCustomerPhoto = async (tpl) => {
    setCustomerTemplate(tpl);
    const slotsArr = typeof tpl.slots === 'string' ? JSON.parse(tpl.slots) : (tpl.slots || []);
    store.setCapturedPhotos(Array(slotsArr.length).fill(null));

    const folder = await window.electronAPI.startCustomerSession(store.activeEvent.id);
    store.setSessionFolder(folder);

    // [REVISI]: Selalu masuk Input Nama terlebih dahulu!
    store.setScreen('input_name');
  };

  // [BARU]: Dipanggil SETELAH nama diinput di Virtual Keyboard
  const submitNameAndPay = () => {
    if(!customerName) return alert("Nama wajib diisi!");

    const isFree = customerTemplate.override_price <= 0;
    const isOffline = globalData.app_mode === 'offline';
    const forceStatic = globalData.force_static_qr === 1;

    if (isFree) {
        executeStartSessionTimer(); // Lanjut kamera
    } else if (isOffline || forceStatic) {
        // MODE OFFLINE / STATIS (Tahan di layar Payment)
        store.setupPayment(customerTemplate.override_price, 'camera');
        setQrUrl(`http://localhost:3000/qr/${globalData.static_qr_path}`);
        setStatusText("Menunggu Kasir Memverifikasi...");
    } else {
        // MODE ONLINE MIDTRANS
        store.setupPayment(customerTemplate.override_price, 'camera');
        initMidtrans(customerTemplate.override_price);
    }
  };

  const initMidtrans = async (amount) => {
    setQrUrl(null); setStatusText("Membuat Tagihan...");
    const res = await window.electronAPI.createQris(amount);
    if(res.success) {
      setQrUrl(res.qrUrl); setStatusText("Menunggu Pembayaran...");
      const chk = setInterval(async () => {
        const st = await window.electronAPI.checkPayment(res.orderId);
        if(st.success && st.status === 'settlement') { 
            clearInterval(chk); 
            setStatusText("Lunas!"); 
            setTimeout(() => { store.setWaitingForPayment(false); executeStartSessionTimer(); }, 1500); 
        }
        // Hentikan jika layar pindah (di-cancel/timeout)
        if (useStore.getState().currentScreen !== 'payment') clearInterval(chk);
      }, 3000);
    } else setStatusText("Error Midtrans");
  };

  const executeStartSessionTimer = async () => {
    setSessionExpiresAt(Date.now() + 600000); 
    store.setScreen('camera');
    
    // [REVISI]: Gunakan Kamera Spesifik dari Dropdown Settings jika diset
    try { 
        const videoConstraints = globalData.selected_camera ? { deviceId: { exact: globalData.selected_camera }, width: 1280, height: 720 } : { width: 1280, height: 720 };
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints }); 
        if(videoRef.current) videoRef.current.srcObject = stream; 
    } catch(e) { console.error("Kamera gagal", e); }
  };

  const takePhotoAction = async () => {
    const current = [...store.capturedPhotos];
    for(let i=0; i<current.length; i++) {
      if(current[i] !== null) continue;
      for(let c=3; c>0; c--) { setCountdown(c); await new Promise(r=>setTimeout(r,1000)); }
      setCountdown('📸');
      const v = videoRef.current; const cvs = canvasRef.current; const ctx = cvs.getContext('2d');
      cvs.width = v.videoWidth; cvs.height = v.videoHeight; ctx.drawImage(v, 0, 0, cvs.width, cvs.height);
      const b64 = cvs.toDataURL('image/jpeg', 0.9);
      await window.electronAPI.saveCapture({ folderPath: store.sessionFolder, base64Data: b64, index: i+1 });
      current[i] = b64; store.setCapturedPhotos([...current]);
      await new Promise(r=>setTimeout(r,1000));
    }
    setCountdown(null); store.setScreen('review');
    if(videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t=>t.stop());
  };

  const processStitching = async () => {
    setSessionExpiresAt(null); 
    store.setScreen('loading');
    
    const res = await window.electronAPI.processImages({ 
      photosBase64: store.capturedPhotos, 
      templateId: customerTemplate.id, 
      eventFolder: store.activeEvent.folder_name,
      eventId: store.activeEvent.id,
      customerName: customerName,
      price: customerTemplate.override_price
    });
    
    if(res.success) { setFinalResult(res); store.setScreen('result'); } 
    else { alert("Gagal Merender: " + res.error); store.setScreen('landing'); }
  };

  // ==========================================
  // RENDER LAYAR APLIKASI
  // ==========================================
  const renderScreen = () => {
    if (store.currentScreen === 'loading') return <div className="flex h-screen items-center justify-center bg-retro-bg font-sys text-3xl">MEMUAT SISTEM...</div>;

    if (store.currentScreen === 'session_manager') return (
      <div className="flex flex-col items-center justify-center h-screen bg-retro-bg p-8 overflow-hidden">
        <div className="retro-window w-full max-w-5xl bg-white flex flex-col h-[85vh]">
          <div className="retro-header flex justify-between items-center">
            <div className="flex items-center gap-4">
               <span>📅 MANAJEMEN SESI EVENT</span>
               <button onClick={() => setGlobalOpen(true)} className="bg-gray-300 hover:bg-gray-400 text-black px-3 py-1 border-2 border-black text-sm shadow-sm" title="Global Settings">
                  ⚙️ PENGATURAN
               </button>
            </div>
            {/* ================================== */}

            {!showCreateForm && <button onClick={()=>setShowCreateForm(true)} className="bg-white text-black px-4 font-bold border-2 border-black hover:bg-yellow-200">BUAT SESI BARU</button>}
          </div>

          <div className="p-8 flex flex-col flex-1 overflow-y-auto">
            {!showCreateForm && (
              <div className="flex flex-col h-full">
                <h2 className="font-pixel text-2xl mb-6">Riwayat Sesi Terakhir</h2>
                {store.recentEvents.length === 0 ? ( <p className="font-sys text-xl text-gray-500">Belum ada riwayat event.</p> ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {store.recentEvents.map(ev => (
                      <div key={ev.id} className="border-4 border-retro-border p-4 flex flex-col bg-gray-50 hover:bg-white hover:border-blue-500 group">
                        <h3 className="font-sys text-2xl font-bold mb-2">{ev.nama_event}</h3>
                        <p className="font-pixel text-[10px] text-gray-500 mb-4">{new Date(ev.created_at).toLocaleString()}</p>
                        <button onClick={()=>reopenEvent(ev.id)} className="retro-btn py-2 text-sm mt-auto opacity-0 group-hover:opacity-100 transition-opacity">Buka & Lanjutkan Sesi Ini</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showCreateForm && (
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-4 mb-6">
                  {store.recentEvents.length > 0 && <button onClick={()=>setShowCreateForm(false)} className="retro-btn-danger px-4 py-2 text-xs">KEMBALI</button>}
                  <h2 className="font-pixel text-2xl">Buka Sesi Event Baru</h2>
                </div>
                <div className="grid grid-cols-2 gap-6 border-b-4 border-retro-border pb-6">
                  <div className="flex flex-col font-sys text-xl"><label className="font-bold">Nama Event / Klien:</label><input type="text" className="border-4 border-retro-border p-2 outline-none" value={newEventData.nama_event} onChange={e=>setNewEventData({...newEventData, nama_event: e.target.value})} /></div>
                  <div className="flex flex-col font-sys text-xl"><label className="font-bold">Saldo Awal / Deposit (Rp):</label><input type="text" className="border-4 border-retro-border p-2 outline-none" value={formatRp(newEventData.saldo_awal)} onChange={e=>setNewEventData({...newEventData, saldo_awal: parseRp(e.target.value)})} placeholder="0" /></div>
                </div>
                <div className="flex flex-col font-sys text-xl mt-6 flex-1 overflow-y-auto pr-4">
                  <label className="font-bold mb-4">Pilih & Atur Harga Frame (WAJIB):</label>
                  <div className="grid grid-cols-3 gap-4 pb-10">
                    {store.templates.filter(t=>t.is_visible).map(tpl => {
                      const isSelected = selectedEventTemplates.find(t=>t.id === tpl.id);
                      return (
                        <div key={tpl.id} className={`border-4 p-2 flex flex-col gap-2 cursor-pointer transition-all ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-300 hover:border-blue-300'}`} onClick={(e) => { if(e.target.tagName !== 'INPUT') toggleEventTemplate(tpl); }}>
                          <div className="h-[120px] bg-gray-200 flex justify-center"><img src={`http://localhost:3000/templates/${tpl.filename}`} className="h-full object-contain" /></div>
                          <div className="flex items-center gap-2"><input type="checkbox" checked={!!isSelected} onChange={() => toggleEventTemplate(tpl)} className="w-5 h-5" /><span className="font-bold truncate text-sm">{tpl.filename}</span></div>
                          {isSelected && (
                            <div className="mt-auto">
                              <label className="text-xs font-bold text-retro-header">Harga Sesi Ini (Rp):</label>
                              <input type="text" className="w-full border-2 border-black p-1 text-sm outline-none" value={formatRp(isSelected.override_price)} onChange={(e) => setSelectedEventTemplates(prev => prev.map(p => p.id === tpl.id ? {...p, override_price: parseRp(e.target.value)} : p))} />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <button onClick={createEventSession} className="retro-btn py-4 text-xl mt-4 bg-retro-success shrink-0">BUKA EVENT SEKARANG</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );

    if (store.currentScreen === 'landing') return (
      <div className="flex flex-col items-center justify-center h-screen space-y-8 bg-retro-bg relative">
        <div className="absolute top-4 left-4 bg-white border-4 border-retro-border px-4 py-2 font-pixel text-sm text-retro-header shadow-md animate-pulse">🔴 LIVE: {store.activeEvent?.nama_event}</div>
        <div className="absolute top-4 right-4 bg-black text-white border-2 border-white px-3 py-1 font-pixel text-[10px] tracking-widest shadow-[2px_2px_0_0_#999]">
          MODE: {store.settings?.app_mode?.toUpperCase() || 'ONLINE'}
        </div>
        <div className="retro-window p-8 text-center animate-bounce">
          <h1 className="font-pixel text-6xl text-retro-border mb-4">SayGumi!</h1>
          <p className="font-sys text-2xl text-gray-600 tracking-wider">Tap anywhere to start</p>
        </div>
        
        {/* [REVISI]: Hardware Blocker UI */}
        {(!store.isHardwareReady && globalData.hw_bypass_mode !== 1) ? (
            <button disabled className="retro-btn-danger px-10 py-6 text-2xl opacity-50 cursor-not-allowed">
               HARDWARE OFFLINE (TIDAK SIAP)
            </button>
        ) : (
            <button onClick={() => { store.resetCustomerSession(); setCustomerName(''); setSessionExpiresAt(null); store.setScreen('template'); }} className="retro-btn px-10 py-6 text-2xl hover:brightness-110">
               MULAI SEKARANG
            </button>
        )}
      </div>
    );

    if (store.currentScreen === 'template') {
      const eventTemplates = JSON.parse(store.activeEvent?.templates_json || '[]');
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-retro-bg p-10">
          <h1 className="font-pixel text-4xl mb-8">Pilih Frame Favoritmu</h1>
          <div className="flex gap-8 overflow-y-auto max-w-6xl">
            {eventTemplates.map(tpl => (
              <div key={tpl.id} onClick={() => startCustomerPhoto(tpl)} className="retro-window w-[250px] bg-white cursor-pointer hover:scale-105 flex flex-col">
                <div className="h-[350px] bg-gray-200 border-b-4 border-retro-border p-2 relative flex justify-center items-center">
                  <img src={`http://localhost:3000/templates/${tpl.filename}`} className="max-w-full max-h-full object-contain drop-shadow-lg" />
                  <div className="absolute top-2 right-2 font-pixel text-[10px] text-white px-2 py-1 border-2 border-retro-border bg-retro-header">{tpl.override_price <= 0 ? 'GRATIS' : `Rp ${(tpl.override_price/1000)}k`}</div>
                </div>
                <div className="p-4 text-center font-pixel text-sm group-hover:bg-blue-100">PILIH FRAME</div>
              </div>
            ))}
          </div>
          <button onClick={() => store.setScreen('landing')} className="retro-btn-danger px-8 py-3 absolute bottom-8 left-8">KEMBALI</button>
        </div>
      );
    }

    if (store.currentScreen === 'payment') return <div className="flex flex-col items-center justify-center h-screen bg-retro-bg"><div className="retro-window w-[400px] p-6 bg-white text-center"><h2 className="font-pixel text-2xl mb-4">Scan QRIS</h2><div className="font-sys text-5xl font-bold text-retro-success mb-6">Rp {store.paymentAmount.toLocaleString('id-ID')}</div><div className="w-[280px] h-[280px] mx-auto border-4 border-retro-border flex items-center justify-center bg-gray-100 mb-6">{qrUrl ? <img src={qrUrl} className="w-[90%] h-[90%] object-contain" /> : <div className="animate-spin text-4xl">⏳</div>}</div><div className="font-sys text-2xl font-bold text-red-600">{statusText}</div></div></div>;
    
    if (store.currentScreen === 'input_name') return (
      <div className="flex flex-col items-center justify-center h-screen bg-retro-bg p-8">
        <div className="retro-window w-full max-w-4xl p-8 bg-white text-center shadow-[8px_8px_0_0_#222]">
          <h2 className="font-pixel text-3xl mb-6">Siapa Nama Kamu?</h2>
          {/* [REVISI]: Input menjadi ReadOnly, bergantung pada Virtual Keyboard */}
          <input type="text" readOnly className="w-full border-8 border-black p-6 text-center font-sys text-4xl outline-none bg-gray-100" placeholder="Ketik dari keyboard di bawah..." value={customerName} />
          
          {/* VIRTUAL KEYBOARD INJECTION */}
          <VirtualKeyboard value={customerName} onChange={setCustomerName} onEnter={submitNameAndPay} />
        </div>
      </div>
    );

    if (store.currentScreen === 'camera') {
      const slotsArr = typeof customerTemplate?.slots === 'string' ? JSON.parse(customerTemplate.slots) : (customerTemplate?.slots || []);
      
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-retro-bg relative p-6 overflow-hidden">
          {sessionExpiresAt && (
            <div className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 font-pixel text-xl border-4 border-retro-border z-50 shadow-[4px_4px_0_0_#333]">
              ⏳ {Math.floor(timeLeftDisplay / 60).toString().padStart(2, '0')}:{(timeLeftDisplay % 60).toString().padStart(2, '0')}
            </div>
          )}
          
          <h2 className="font-pixel text-3xl text-center mb-4 text-retro-header drop-shadow-md">
              Gaya ke-{store.capturedPhotos.filter(p => p !== null).length + 1}
          </h2>

          <div className="flex gap-6 w-full max-w-7xl h-[75vh] items-stretch">
            <div className="w-[70%] retro-window bg-white flex flex-col p-4 relative shadow-[8px_8px_0_0_#333]">
              <div className="relative flex-1 border-4 border-retro-border bg-gray-900 overflow-hidden flex justify-center items-center">
                <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"></video>
                {countdown && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                    <span className="font-pixel text-9xl text-white drop-shadow-[6px_6px_0_rgba(242,109,109,1)]">
                      {countdown}
                    </span>
                  </div>
                )}
              </div>
              <button 
                onClick={takePhotoAction} 
                disabled={countdown !== null} 
                className={`retro-btn w-full py-4 mt-4 text-2xl shrink-0 ${countdown !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                📸 AMBIL FOTO
              </button>
            </div>

            <div className="w-[30%] retro-window bg-white flex flex-col p-4 shrink-0 shadow-[8px_8px_0_0_#333]">
              <h2 className="font-pixel text-lg text-center mb-4 shrink-0">Preview</h2>
              <div ref={previewContainerRef} className="flex-1 min-h-0 border-4 border-retro-border bg-gray-200 relative overflow-hidden flex justify-center items-center p-2">
                  {customerTemplate && (
                      <div className="shrink-0" style={{
                          width: Number(customerTemplate.width),
                          height: Number(customerTemplate.height),
                          minWidth: Number(customerTemplate.width),
                          minHeight: Number(customerTemplate.height),
                          transform: `scale(${previewScale})`,
                          transformOrigin: 'center center',
                          position: 'relative',
                          backgroundColor: 'transparent'
                      }}>
                          {slotsArr.map((slot, i) => (
                              <div key={i} style={{
                                  position: 'absolute', top: slot.top, left: slot.left, width: slot.width, height: slot.height,
                                  backgroundColor: '#ddd', overflow: 'hidden'
                              }}>
                                  {store.capturedPhotos[i] ? (
                                      <img src={store.capturedPhotos[i]} className="w-full h-full object-cover scale-x-[-1]" alt={`Slot ${i+1}`} />
                                  ) : (
                                      <div className="w-full h-full border-2 border-dashed border-gray-400 flex items-center justify-center">
                                          <span className="font-sys text-gray-500 font-bold">Slot {i+1}</span>
                                      </div>
                                  )}
                              </div>
                          ))}
                          <img src={`http://localhost:3000/templates/${customerTemplate.filename}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }} />
                      </div>
                  )}
              </div>
              <div className="font-sys text-center mt-4 text-lg text-gray-600 font-bold bg-yellow-100 border-4 border-black p-3 shadow-[4px_4px_0_0_#333] shrink-0">
                 Sisa Jepretan: {store.capturedPhotos.filter(p => p === null).length}
              </div>
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden"></canvas>
        </div>
      );
    }

    // =========================================================
    // [BUG FIXED]: LAYAR REVIEW (ASPECT-VIDEO AGAR ANTI-SCROLL)
    // =========================================================
    if (store.currentScreen === 'review') {
      const slotsArr = typeof customerTemplate?.slots === 'string' ? JSON.parse(customerTemplate.slots) : (customerTemplate?.slots || []);
      
      // Logika grid dinamis berdasarkan jumlah foto agar tidak luber ke bawah
      const photoCount = store.capturedPhotos.length;
      const gridColsClass = photoCount >= 5 ? 'grid-cols-3' : 'grid-cols-2';

      return (
        <div className="flex flex-col items-center justify-center h-screen bg-retro-bg space-y-4 relative p-6 overflow-hidden">
          {sessionExpiresAt && (
             <div className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 font-pixel text-xl border-4 border-retro-border z-50 shadow-[4px_4px_0_0_#333]">
                ⏳ {Math.floor(timeLeftDisplay / 60).toString().padStart(2, '0')}:{(timeLeftDisplay % 60).toString().padStart(2, '0')}
             </div>
          )}
          
          <h1 className="font-pixel text-4xl text-retro-header drop-shadow-md shrink-0">Review Hasil Akhir</h1>
          
          <div className="flex gap-8 w-full max-w-7xl flex-1 min-h-0">
             {/* KIRI: PREVIEW TEMPLATE FULL */}
             <div className="w-[45%] retro-window bg-white flex flex-col p-4 shrink-0 shadow-[8px_8px_0_0_#333]">
                <h2 className="font-pixel text-lg text-center mb-4 shrink-0">Photostrip Kamu</h2>
                <div ref={reviewPreviewContainerRef} className="flex-1 min-h-0 border-4 border-retro-border bg-gray-200 relative overflow-hidden flex justify-center items-center p-2">
                    {customerTemplate && (
                        <div className="shrink-0" style={{
                            width: Number(customerTemplate.width),
                            height: Number(customerTemplate.height),
                            minWidth: Number(customerTemplate.width),
                            minHeight: Number(customerTemplate.height),
                            transform: `scale(${reviewPreviewScale})`,
                            transformOrigin: 'center center',
                            position: 'relative'
                        }}>
                            {slotsArr.map((slot, i) => (
                                <div key={i} style={{
                                    position: 'absolute', top: slot.top, left: slot.left, width: slot.width, height: slot.height,
                                    backgroundColor: '#ddd', overflow: 'hidden'
                                }}>
                                    {store.capturedPhotos[i] ? (
                                        <img src={store.capturedPhotos[i]} className="w-full h-full object-cover scale-x-[-1]" />
                                    ) : null}
                                </div>
                            ))}
                            <img src={`http://localhost:3000/templates/${customerTemplate.filename}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }} />
                        </div>
                    )}
                </div>
             </div>

             {/* KANAN: LIST FOTO & RETAKE DENGAN ASPECT-VIDEO */}
             <div className="flex-1 retro-window bg-white flex flex-col p-4 md:p-6 shadow-[8px_8px_0_0_#333] overflow-y-auto min-h-0">
                <div className={`grid ${gridColsClass} gap-3 auto-rows-max`}>
                  {store.capturedPhotos.map((photo, i) => (
                    <div key={i} className="border-4 border-retro-border p-2 flex flex-col items-center bg-gray-50">
                      <h3 className="font-pixel text-xs md:text-sm mb-1 md:mb-2">Gaya {i + 1}</h3>
                      {/* aspect-video menjamin tinggi foto menyesuaikan lebar grid, membuang limit h-150px yang menyebabkan overflow */}
                      {photo ? (
                        <img src={photo} className="w-full aspect-video object-cover border-2 border-retro-border scale-x-[-1]" />
                      ) : (
                        <div className="w-full aspect-video bg-gray-300 border-2 border-retro-border flex items-center justify-center font-sys text-gray-500 text-xs">Kosong</div>
                      )}
                      {timeLeftDisplay > 60 && ( 
                          <button 
                            onClick={() => { const nw = [...store.capturedPhotos]; nw[i]=null; store.setCapturedPhotos(nw); store.decrementRetake(); store.setScreen('camera'); executeStartSessionTimer(); }} 
                            disabled={store.retakesLeft <= 0 || !photo} 
                            className="w-full mt-2 px-2 py-1 md:py-2 font-pixel text-[10px] md:text-xs border-2 border-retro-border bg-gray-200 hover:bg-yellow-100 disabled:opacity-50 transition-colors"
                          >
                              🔄 Retake
                          </button> 
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-auto pt-4 flex flex-col items-center gap-3">
                  {timeLeftDisplay > 60 && <p className="font-sys text-lg md:text-xl font-bold bg-white px-4 py-1 border-2 border-retro-border shadow-sm">Sisa Retake: {store.retakesLeft}</p>}
                  <button onClick={processStitching} className="retro-btn w-full py-3 md:py-4 text-xl md:text-2xl bg-retro-success shrink-0">🖨️ CETAK SEKARANG</button>
                </div>
             </div>
          </div>
        </div>
      );
    }

    if (store.currentScreen === 'result') return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4 bg-retro-bg p-6 overflow-hidden">
        <h1 className="font-pixel text-5xl text-retro-border drop-shadow-md shrink-0">SayGumi!</h1>
        <h2 className="font-sys text-2xl font-bold mb-2 shrink-0">Selesai! Scan QR Code untuk Download</h2>
        
        <div className="flex gap-8 items-stretch w-full max-w-5xl flex-1 min-h-0 pb-4">
          <div className="w-[65%] retro-window bg-white p-4 flex justify-center items-center overflow-hidden relative shadow-[8px_8px_0_0_rgba(0,0,0,0.5)]">
            <img 
              src={finalResult?.downloadUrl} 
              className="max-h-full max-w-full object-contain border-4 border-gray-200 bg-white shadow-lg" 
              alt="Final Photostrip" 
            />
          </div>

          <div className="w-[35%] retro-window bg-white p-6 flex flex-col items-center justify-center gap-4 shrink-0 shadow-[8px_8px_0_0_rgba(0,0,0,0.5)] overflow-y-auto">
            <p className="font-pixel text-lg text-center text-retro-header">Ambil Softfile</p>
            <div className="border-8 border-retro-border p-3 bg-gray-50 shadow-inner">
              <img src={finalResult?.qrCode} className="w-[180px] h-[180px] lg:w-[220px] lg:h-[220px] object-contain" alt="QR Code" />
            </div>
            <p className="font-sys text-center text-gray-500 font-bold text-sm lg:text-base mt-2 px-2 leading-tight">
               File resolusi tinggi tersimpan di server lokal. Segera download sebelum ditutup.
            </p>
            <button 
              onClick={() => { store.resetCustomerSession(); store.setScreen('landing'); }} 
              className="retro-btn w-full py-4 mt-auto text-xl shrink-0"
            >
              SELESAI
            </button>
          </div>
        </div>
      </div>
    );

    return null;
  };

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      
      {/* [BARU]: TOAST NOTIFICATION HARDWARE */}
      {hwStatus && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-yellow-200 text-black px-8 py-4 border-4 border-black font-sys font-bold z-[200] shadow-[4px_4px_0_0_#000] animate-bounce text-xl text-center whitespace-pre-wrap">
            {hwStatus}
        </div>
      )}

      {renderScreen()}

      {/* ==========================================
          MODAL 1: LIVE DASHBOARD EVENT (Ctrl+Shift+D)
      ========================================== */}
      {isDashboardOpen && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[100] p-10">
          <div className="retro-window w-full max-w-6xl bg-gray-100 flex flex-col h-[90vh]">
            <div className="retro-header bg-green-700">LIVE DASHBOARD - {store.activeEvent?.nama_event} <button onClick={()=>setDashboardOpen(false)}>X</button></div>
            
            <div className="p-6 flex flex-col gap-6 overflow-y-auto">
              
              {/* [BARU] INFO PENYIMPANAN & REMOTE KASIR */}
              <div className="flex gap-4">
                <div className="flex-1 bg-white border-4 border-retro-border p-4 shadow-[4px_4px_0_0_#222] flex flex-col gap-2">
                  <h3 className="font-pixel text-lg text-retro-header">Akses Penyimpanan</h3>
                  <div className="font-sys text-sm mt-2 flex flex-col gap-3">
                    <div>
                      <p className="font-bold">📁 Direktori Lokal (Backup):</p>
                      <p className="text-gray-600 bg-gray-100 p-2 border-2 border-gray-300 select-all">{dashboardData?.localPath || 'Memuat...'}</p>
                    </div>
                    {globalData.app_mode === 'online' && (
                    <div>
                      <p className="font-bold">☁️ Google Drive:</p>
                      <p className="text-blue-600 bg-blue-50 p-2 border-2 border-blue-200 select-all break-all">{dashboardData?.gdriveLink || 'Memuat...'}</p>
                    </div>
                    )}
                  </div>
                </div>

                <div className="bg-white border-4 border-retro-border p-4 shadow-[4px_4px_0_0_#222] flex flex-col items-center justify-center shrink-0 w-[220px]">
                  <h3 className="font-pixel text-sm mb-2 text-center text-green-700">Remote Cashier</h3>
                  {dashboardData?.adminQr ? (
                     <img src={dashboardData.adminQr} className="w-[120px] h-[120px] border-4 border-gray-200" alt="Admin QR" />
                  ) : ( <div className="w-[120px] h-[120px] border-4 flex items-center justify-center">⏳</div> )}
                  <p className="font-sys text-[10px] text-gray-500 mt-2 text-center leading-tight">Scan via HP Admin</p>
                </div>
              </div>

              {/* Top Stats Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white border-4 border-retro-border p-4 text-center">
                  <p className="font-sys text-gray-500">Deposit Awal</p>
                  <p className="font-pixel text-xl text-blue-600">Rp {formatRp(dashboardData?.stats?.saldo_awal)}</p>
                </div>
                {/* ... (Pertahankan card statistik dan tabel riwayat sama seperti sebelumnya) ... */}
                <div className="bg-white border-4 border-retro-border p-4 text-center">
                  <p className="font-sys text-gray-500">Total Transaksi</p>
                  <p className="font-pixel text-xl text-black">{dashboardData?.stats?.total_trx || 0} Lembar</p>
                </div>
                <div className="bg-white border-4 border-retro-border p-4 text-center">
                  <p className="font-sys text-gray-500">Beban HPP</p>
                  <p className="font-pixel text-xl text-red-600">Rp {formatRp(dashboardData?.stats?.total_beban_hpp)}</p>
                </div>
                <div className="bg-white border-4 border-retro-border p-4 text-center shadow-[4px_4px_0_0_#222]">
                  <p className="font-sys font-bold">Laba Bersih</p>
                  <p className={`font-pixel text-2xl ${dashboardData?.stats?.sisa_saldo < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    Rp {formatRp(dashboardData?.stats?.sisa_saldo)}
                  </p>
                </div>
              </div>

              {/* Tabel Riwayat Sesi */}
              <div className="bg-white border-4 border-retro-border flex-1 flex flex-col">
                <div className="bg-gray-200 border-b-4 border-retro-border p-2 font-pixel text-sm flex">
                  <div className="w-[150px]">WAKTU</div><div className="flex-1">NAMA PELANGGAN</div><div className="w-[150px]">STATUS</div><div className="w-[150px]">HARGA</div>
                </div>
                <div className="overflow-y-auto font-sys text-lg min-h-[200px]">
                  {dashboardData?.sessions?.length === 0 && <p className="p-4 text-center text-gray-500">Belum ada transaksi.</p>}
                  {dashboardData?.sessions?.map((s, i) => (
                    <div key={i} className="flex p-2 border-b-2 border-gray-100 hover:bg-yellow-50">
                      <div className="w-[150px] text-sm text-gray-500">{s.waktu}</div>
                      <div className="flex-1 font-bold">{s.customer_name}</div>
                      <div className="w-[150px] text-green-600">{s.status_cetak}</div>
                      <div className="w-[150px]">Rp {formatRp(s.harga_jual)}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 2: GLOBAL SETTINGS (Ctrl+Shift+P)
      ========================================== */}
      {isGlobalOpen && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[90] p-10">
          <div className="retro-window w-[800px] bg-white flex flex-col max-h-[90vh]">
            <div className="retro-header bg-gray-800">GLOBAL SETTINGS.INI <button onClick={()=>setGlobalOpen(false)}>X</button></div>
            <form onSubmit={saveGlobalSettings} className="p-8 overflow-y-auto flex flex-col gap-6 font-sys text-xl">
              <div className="flex items-center gap-4 bg-yellow-100 p-4 border-2 border-black">
                <label className="font-bold">Mode Aplikasi:</label>
                <select className="border-2 border-black p-1 outline-none" value={globalData.app_mode} onChange={e=>setGlobalData({...globalData, app_mode: e.target.value})}>
                  <option value="online">ONLINE (Midtrans Aktif)</option>
                  <option value="offline">OFFLINE (Bayar Kasir)</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col"><label className="font-bold">HPP Kertas (Rp)</label><input type="text" className="border-4 p-2 outline-none" value={formatRp(globalData.hpp_kertas)} onChange={e=>setGlobalData({...globalData, hpp_kertas: parseRp(e.target.value)})} /></div>
                <div className="flex flex-col"><label className="font-bold">HPP Tinta (Rp)</label><input type="text" className="border-4 p-2 outline-none" value={formatRp(globalData.hpp_tinta)} onChange={e=>setGlobalData({...globalData, hpp_tinta: parseRp(e.target.value)})} /></div>
                <div className="flex flex-col"><label className="font-bold">Biaya Ops (Rp)</label><input type="text" className="border-4 p-2 outline-none" value={formatRp(globalData.biaya_ops)} onChange={e=>setGlobalData({...globalData, biaya_ops: parseRp(e.target.value)})} /></div>
              </div>
              {/* [REVISI]: Pengaturan Midtrans, QR Statis, dan Hardware */}
              <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 border-4 border-retro-border">
                  <div className="flex flex-col gap-2">
                      <label className="font-bold text-sm">Midtrans Server Key:</label>
                      <input type="text" className="border-4 p-2 outline-none text-sm" value={globalData.midtrans_server_key} onChange={e=>setGlobalData({...globalData, midtrans_server_key: e.target.value})} />
                      <label className="font-bold text-sm mt-2">Midtrans Client Key:</label>
                      <input type="text" className="border-4 p-2 outline-none text-sm" value={globalData.midtrans_client_key} onChange={e=>setGlobalData({...globalData, midtrans_client_key: e.target.value})} />
                      
                      <hr className="my-2 border-2 border-dashed border-gray-400" />
                      
                      <label className="font-bold text-sm">Pilih Kamera Utama:</label>
                      <select className="border-4 p-2 text-sm outline-none" value={globalData.selected_camera} onChange={e=>setGlobalData({...globalData, selected_camera: e.target.value})}>
                         <option value="">-- Deteksi Otomatis Sistem --</option>
                         {availableCameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label}</option>)}
                      </select>

                      <label className="font-bold text-sm mt-2">Pilih Printer Thermal/Foto:</label>
                      <select className="border-4 p-2 text-sm outline-none" value={globalData.selected_printer} onChange={e=>setGlobalData({...globalData, selected_printer: e.target.value})}>
                         <option value="">-- Deteksi Otomatis Sistem --</option>
                         {availablePrinters.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                      </select>
                      
                      <label className="font-bold flex items-center gap-2 text-sm text-red-800 mt-2 p-2 bg-red-100 border-2 border-red-300">
                          <input type="checkbox" className="w-5 h-5" checked={globalData.hw_bypass_mode === 1} onChange={e=>setGlobalData({...globalData, hw_bypass_mode: e.target.checked ? 1 : 0})} /> 
                          Troubleshooting / Bypass Hardware Blocker
                      </label>
                  </div>
                  <div className="flex flex-col gap-2 border-l-4 border-retro-border pl-6">
                      <label className="font-bold flex items-center gap-2 text-sm text-blue-800 bg-blue-50 p-2 border-2 border-blue-200">
                          <input type="checkbox" className="w-5 h-5 shrink-0" checked={globalData.force_static_qr === 1} onChange={e=>setGlobalData({...globalData, force_static_qr: e.target.checked ? 1 : 0})} /> 
                          Paksa Gunakan QR Statis (Bypass Midtrans)
                      </label>
                      
                      <div className="flex gap-4 items-start mt-2">
                          <button type="button" onClick={async () => { const path = await window.electronAPI.selectStaticQR(); if(path) setGlobalData({...globalData, static_qr_path: path}); }} className="retro-btn py-2 text-xs flex-1">UPLOAD GAMBAR QR STATIS</button>
                          {globalData.static_qr_path && (
                              <div className="border-4 border-gray-300 p-1 bg-white w-[100px] h-[100px] flex items-center justify-center shrink-0">
                                 <img src={`http://localhost:3000/qr/${globalData.static_qr_path}`} className="max-w-full max-h-full object-contain" alt="QR Preview" />
                              </div>
                          )}
                      </div>
                      
                      <hr className="my-2 border-2 border-dashed border-gray-400" />
                      <label className="font-bold mt-2 text-sm">ID Folder Google Drive (Induk):</label>
                      <input type="text" className="border-4 p-2 outline-none text-sm" placeholder="Paste ID Folder GDrive..." value={globalData.gdrive_folder_id} onChange={e=>setGlobalData({...globalData, gdrive_folder_id: e.target.value})} />
                  </div>
              </div>
              <button type="submit" className="retro-btn py-4 bg-retro-success mt-4">SIMPAN PENGATURAN MESIN</button>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 3: MASTER TEMPLATE (Ctrl+Shift+T)
      ========================================== */}
      {isTemplateOpen && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[90] p-10">
          <div className="retro-window w-full max-w-6xl bg-gray-100 flex flex-col h-[90vh]">
            <div className="retro-header bg-blue-800">MASTER TEMPLATE LIBRARY <button onClick={()=>setTemplateOpen(false)}>X</button></div>
            <div className="p-6 flex flex-col gap-6 overflow-y-auto">
              <div className="flex justify-between items-center bg-white p-4 border-4 border-retro-border">
                <div><h2 className="font-pixel text-xl">Database Master Template</h2></div>
                <button onClick={uploadMasterTemplate} className="retro-btn px-6 py-3">➕ UPLOAD PNG BARU</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {store.templates.map(tpl => (
                  <div key={tpl.id} className="bg-white border-4 p-4 flex gap-4">
                    <div className="w-[100px] h-[140px] bg-gray-200 flex justify-center items-center shrink-0 border-2"><img src={`http://localhost:3000/templates/${tpl.filename}`} className="max-h-full object-contain" /></div>
                    <div className="flex flex-col flex-1 font-sys gap-2">
                      <p className="font-bold truncate border-b-2 pb-1">{tpl.filename}</p>
                      <div className="flex gap-4"><label className="text-sm"><input type="checkbox" checked={tpl.is_visible===1} onChange={e=>updateMasterAttr(tpl, 'is_visible', e.target.checked?1:0)} /> Tampil di List</label></div>
                      <div className="flex items-center gap-2 mt-2"><span className="text-sm font-bold">Harga Dasar: Rp</span><input type="text" className="border-2 p-1 w-24 outline-none" value={formatRp(tpl.price)} onChange={(e) => updateMasterAttr(tpl, 'price', parseRp(e.target.value))} /></div>
                      <div className="mt-auto flex gap-2">
                        <button onClick={() => setEditingTemplate(tpl)} className="retro-btn flex-1 py-1 text-xs">Atur Slot</button>
                        <button onClick={() => { if(confirm("Hapus master template?")) window.electronAPI.deleteTemplate(tpl.id).then(()=>store.fetchTemplates()); }} className="retro-btn-danger px-3 py-1 text-xs font-bold">X</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {editingTemplate && <VisualEditor template={editingTemplate} onCancel={()=>setEditingTemplate(null)} onSave={async(s) => { await updateMasterAttr(editingTemplate, 'slots', s); setEditingTemplate(null); alert("Disimpan!"); }} />}
    </div>
  );
}