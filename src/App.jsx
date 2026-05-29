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
// KOMPONEN RETRO DIALOG GLOBAL
// ==========================================
function RetroDialog() {
  const { dialog, closeDialog } = useStore();
  if (!dialog.isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/90 z-[999] flex justify-center items-center p-6">
      <div className="bg-white w-full max-w-lg text-center p-8 flex flex-col gap-6 shadow-[16px_16px_0_0_#FFD453] border-8 border-black">
        <h2 className="font-pixel text-3xl mb-2 text-[#007CC3]">{dialog.type === 'confirm' ? '⚠️ KONFIRMASI' : '🔔 INFORMASI'}</h2>
        <p className="font-sys text-xl font-bold text-gray-700 whitespace-pre-wrap">{dialog.message}</p>
        <div className="flex gap-4 justify-center mt-6">
          {dialog.type === 'confirm' && <button onClick={() => closeDialog(false)} className="bg-[#FF3B67] hover:bg-red-700 text-white font-pixel border-4 border-black flex-1 py-4 text-xl shadow-[4px_4px_0_0_#000] hover:translate-y-1 transition-all">BATAL</button>}
          <button onClick={() => closeDialog(true)} className="bg-[#FFD453] hover:bg-yellow-400 text-black font-pixel border-4 border-black flex-1 py-4 text-xl shadow-[4px_4px_0_0_#000] hover:translate-y-1 transition-all">OK / LANJUT</button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// VIRTUAL KEYBOARD (TOUCHSCREEN)
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
    <div className="bg-[#007CC3] p-6 border-8 border-black mt-8 w-full max-w-4xl mx-auto shadow-[12px_12px_0_0_#FFD453] select-none">
      {rows.map((row, i) => (
        <div key={i} className="flex justify-center gap-2 mb-3">
          {row.map(key => (
            <button key={key} onClick={() => handleKeyPress(key)} className={`bg-white border-b-4 border-black active:border-b-0 active:translate-y-1 font-pixel text-xl md:text-2xl p-3 md:p-4 hover:bg-[#FFD453] transition-all ${key === 'BACKSPACE' ? 'px-6 bg-[#FF3B67] text-white hover:bg-red-500' : 'w-12 h-12 md:w-16 md:h-16 flex items-center justify-center'}`}>{key === 'BACKSPACE' ? '⌫' : key}</button>
          ))}
        </div>
      ))}
      <div className="flex justify-center gap-4 mt-2">
        <button onClick={() => handleKeyPress('SPACE')} className="bg-white border-b-4 border-black active:border-b-0 active:translate-y-1 font-pixel text-xl px-24 py-4 hover:bg-[#FFD453]">SPACE</button>
        <button onClick={onEnter} className="bg-[#FFD453] border-b-4 border-black active:border-b-0 active:translate-y-1 font-pixel text-xl px-8 py-4 hover:bg-yellow-400">ENTER / LANJUT</button>
      </div>
    </div>
  );
}

// ==========================================
// VISUAL TEMPLATE EDITOR (SUPPORT TOUCH)
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
    const startX = e.touches ? e.touches[0].clientX : e.clientX; 
    const startY = e.touches ? e.touches[0].clientY : e.clientY; 
    const startSlot = { ...slots[index] };

    const handlePointerMove = (moveEvent) => {
      const currentX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const dx = (currentX - startX) / scale; const dy = (currentY - startY) / scale;
      const newSlots = [...slots];
      if (action === 'move') newSlots[index] = { ...startSlot, left: Math.round(startSlot.left + dx), top: Math.round(startSlot.top + dy) };
      else if (action === 'resize') newSlots[index] = { ...startSlot, width: Math.max(50, Math.round(startSlot.width + dx)), height: Math.max(50, Math.round(startSlot.height + dy)) };
      setSlots(newSlots);
    };

    const handlePointerUp = () => { 
      window.removeEventListener('mousemove', handlePointerMove); window.removeEventListener('mouseup', handlePointerUp); 
      window.removeEventListener('touchmove', handlePointerMove); window.removeEventListener('touchend', handlePointerUp); 
    };

    window.addEventListener('mousemove', handlePointerMove); window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false }); window.addEventListener('touchend', handlePointerUp);
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex p-6 gap-6">
      <div ref={containerRef} className="flex-1 bg-[#333] flex items-center justify-center relative overflow-hidden" style={{ backgroundImage: 'linear-gradient(45deg, #444 25%, transparent 25%, transparent 75%, #444 75%, #444), linear-gradient(45deg, #444 25%, transparent 25%, transparent 75%, #444 75%, #444)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 10px 10px' }}>
        <div style={{ width: Number(template.width), height: Number(template.height), transform: `scale(${scale})`, transformOrigin: 'center center', backgroundImage: `url('http://localhost:3000/templates/${template.filename}')`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }} className="relative shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-white shrink-0">
          {slots.map((slot, i) => (
            <div key={i} className="absolute border-4 border-dashed border-[#FF3B67] bg-[#FF3B67]/30 flex items-center justify-center font-bold text-[#FF3B67] text-3xl select-none cursor-move" style={{ top: slot.top, left: slot.left, width: slot.width, height: slot.height }} onMouseDown={(e) => handlePointerDown(e, i, 'move')} onTouchStart={(e) => handlePointerDown(e, i, 'move')}>
              {i + 1}
              <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-transparent cursor-se-resize flex items-center justify-center" onMouseDown={(e) => { e.stopPropagation(); handlePointerDown(e, i, 'resize'); }} onTouchStart={(e) => { e.stopPropagation(); handlePointerDown(e, i, 'resize'); }}>
                 <div className="w-6 h-6 bg-[#FFD453] border-4 border-black pointer-events-none" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="w-[350px] bg-white flex flex-col shrink-0 border-8 border-black shadow-[12px_12px_0_0_#FFD453]">
        <div className="bg-[#007CC3] text-white font-pixel p-4 text-lg border-b-8 border-black">⚙️ EDITOR ({template.orientation?.toUpperCase()})</div>
        <div className="p-4 flex flex-col gap-4 flex-1 overflow-y-auto">
          <button onClick={() => setSlots([...slots, { top: 50, left: 50, width: 300, height: 200 }])} className="bg-[#FFD453] border-4 border-black font-pixel py-4 text-xl shadow-[4px_4px_0_0_#000] hover:translate-y-1 transition-all">➕ TAMBAH SLOT</button>
          <div className="font-sys text-lg border-t-4 border-dashed border-gray-400 pt-4 mt-2">
            {slots.map((slot, i) => (
              <div key={i} className="flex justify-between items-center bg-gray-100 p-2 border-4 border-black mb-2">
                <span className="font-bold">Slot {i + 1}</span>
                <button onClick={() => setSlots(slots.filter((_, idx) => idx !== i))} className="text-[#FF3B67] font-bold hover:scale-125 p-2 text-xl">❌</button>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t-8 border-black flex gap-2">
          <button onClick={onCancel} className="bg-[#FF3B67] text-white border-4 border-black font-pixel flex-1 py-4 text-lg shadow-[4px_4px_0_0_#000] hover:translate-y-1">BATAL</button>
          <button onClick={() => onSave(slots)} className="bg-[#007CC3] text-white border-4 border-black font-pixel flex-1 py-4 text-lg shadow-[4px_4px_0_0_#000] hover:translate-y-1">SIMPAN</button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// KOMPONEN UTAMA (SayGumi! App)
// ==========================================
export default function App() {
  const store = useStore();
  
  const [isGlobalOpen, setGlobalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('umum'); 
  const [isTemplateOpen, setTemplateOpen] = useState(false);
  const [isDashboardOpen, setDashboardOpen] = useState(false); 
  const [dashboardData, setDashboardData] = useState(null); 
  
  const [globalData, setGlobalData] = useState({ hpp_kertas: '', hpp_tinta: '', biaya_ops: '', midtrans_server_key: '', midtrans_client_key: '', app_mode: 'online' });
  const [orientationModal, setOrientationModal] = useState(null); 
  const [editingTemplate, setEditingTemplate] = useState(null);   

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEventData, setNewEventData] = useState({ nama_event: '', saldo_awal: '' });
  const [selectedEventTemplates, setSelectedEventTemplates] = useState([]); 

  const [customerTab, setCustomerTab] = useState('portrait'); 
  const [customerTemplate, setCustomerTemplate] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [finalResult, setFinalResult] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [statusText, setStatusText] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [countdown, setCountdown] = useState(null);
  
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null);
  const [timeLeftDisplay, setTimeLeftDisplay] = useState(0);
  const [hwStatus, setHwStatus] = useState(null);
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [availableCameras, setAvailableCameras] = useState([]);
  
  const previewContainerRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(1);
  const reviewPreviewContainerRef = useRef(null);
  const [reviewPreviewScale, setReviewPreviewScale] = useState(1);

  const capturedPhotosRef = useRef(store.capturedPhotos);
  const currentScreenRef = useRef(store.currentScreen);
  useEffect(() => { capturedPhotosRef.current = store.capturedPhotos; }, [store.capturedPhotos]);
  useEffect(() => { currentScreenRef.current = store.currentScreen; }, [store.currentScreen]);

  useEffect(() => {
    if (store.currentScreen === 'landing' && window.electronAPI.clearPendingPayment) window.electronAPI.clearPendingPayment();
  }, [store.currentScreen]);

  useEffect(() => {
    store.fetchSettings(); store.fetchTemplates(); store.fetchServerIP(); store.fetchActiveEvent(); 
    window.electronAPI.getRecentEvents().then(events => { store.fetchRecentEvents(); setShowCreateForm(events?.length === 0); });

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
        store.setHardwareReady(hw.printers?.length > 0 && videoInputs.length > 0);
      } catch(e) { msg += `❌ Hardware Error.`; store.setHardwareReady(false); }
      setHwStatus(msg); setTimeout(() => setHwStatus(null), 6000);
    };
    initHardware();

    if (window.electronAPI.onRemoteVerify) {
      window.electronAPI.onRemoteVerify(() => {
        if (useStore.getState().waitingForPayment) {
          setStatusText("Verifikasi Sukses!");
          setTimeout(() => { store.setWaitingForPayment(false); executeStartSessionTimer(); }, 1000);
        }
      });
      window.electronAPI.onRemoteClose(async () => {
        const ev = useStore.getState().activeEvent;
        if(ev) {
            await window.electronAPI.closeEvent(ev.id); store.fetchActiveEvent(); store.fetchRecentEvents(); setShowCreateForm(false); setDashboardOpen(false); store.resetCustomerSession(); setCustomerName(''); setSessionExpiresAt(null); if (window.electronAPI.clearPendingPayment) window.electronAPI.clearPendingPayment();
        }
      });
      window.electronAPI.onRemoteRestart(() => { window.location.reload(); });
    }
    
    const handleKeyDown = async (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') { setGlobalOpen(p=>!p); setTemplateOpen(false); setDashboardOpen(false); }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') { setTemplateOpen(p=>!p); setGlobalOpen(false); setDashboardOpen(false); }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') { setDashboardOpen(p=>!p); setGlobalOpen(false); setTemplateOpen(false); fetchDashboardData(); }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'x') {
        const ev = await window.electronAPI.getActiveEvent();
        if (ev) {
          const isConfirmed = await store.showDialog(`TUTUP event "${ev.nama_event}" secara permanen?`, 'confirm');
          if (isConfirmed) { await window.electronAPI.closeEvent(ev.id); store.fetchActiveEvent(); store.fetchRecentEvents(); setShowCreateForm(false); setDashboardOpen(false); }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => { if (store.settings) setGlobalData(store.settings); }, [store.settings]);

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

  const fetchDashboardData = async () => { const ev = await window.electronAPI.getActiveEvent(); if (ev) setDashboardData(await window.electronAPI.getDashboardData(ev.id)); };

  useEffect(() => {
    if (!sessionExpiresAt) return;
    const displayInterval = setInterval(() => { setTimeLeftDisplay(Math.max(0, Math.floor((sessionExpiresAt - Date.now()) / 1000))); }, 1000);
    const doomTimer = setTimeout(() => { handleAutoFinish(); }, Math.max(0, sessionExpiresAt - Date.now()));
    return () => { clearInterval(displayInterval); clearTimeout(doomTimer); };
  }, [sessionExpiresAt, customerTemplate]);

  const handleAutoFinish = async () => {
    if (currentScreenRef.current !== 'camera' && currentScreenRef.current !== 'review') return; 
    setSessionExpiresAt(null);
    if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    const blankImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
    const filledPhotos = capturedPhotosRef.current.map(p => p || blankImage);
    store.setCapturedPhotos(filledPhotos); store.setScreen('loading');
    const res = await window.electronAPI.processImages({ photosBase64: filledPhotos, templateId: customerTemplate.id, eventFolder: store.activeEvent.folder_name, eventId: store.activeEvent.id, customerName: customerName, price: customerTemplate.override_price });
    if(res.success) { setFinalResult(res); store.setScreen('result'); } else { await store.showDialog("Gagal Merender: " + res.error); store.setScreen('landing'); }
  };

  const saveGlobalSettings = async (e) => { e.preventDefault(); await window.electronAPI.saveSettings(globalData); store.fetchSettings(); await store.showDialog("Pengaturan Berhasil Disimpan!"); setGlobalOpen(false); };
  const uploadMasterTemplate = async () => { const filePath = await window.electronAPI.openFileDialog(); if (filePath) { const res = await window.electronAPI.saveNewTemplate({ tempPath: filePath }); if (res.success) store.fetchTemplates(); } };
  const updateMasterAttr = async (tpl, field, value) => { await window.electronAPI.updateTemplate({ ...tpl, [field]: value }); store.fetchTemplates(); };

  // ==========================================
  // CUSTOMER FLOW HANDLERS
  // ==========================================
  const startCustomerPhoto = async (tpl) => {
    const slotsArr = typeof tpl.slots === 'string' ? JSON.parse(tpl.slots) : (tpl.slots || []);
    if (!slotsArr || slotsArr.length === 0) {
        await store.showDialog("TEMPLATE ERROR: Frame ini tidak memiliki slot foto. Admin belum mengatur koordinat slot untuk template ini.", "alert");
        return;
    }
    setCustomerTemplate(tpl);
    store.setCapturedPhotos(Array(slotsArr.length).fill(null));
    const folder = await window.electronAPI.startCustomerSession(store.activeEvent.id);
    store.setSessionFolder(folder);
    store.setScreen('input_name');
  };

  const submitNameAndPay = async () => {
    if(!customerName) return await store.showDialog("Nama wajib diisi sebelum melanjutkan!");
    const isFree = customerTemplate.override_price <= 0;
    const isOffline = globalData.app_mode === 'offline';
    const forceStatic = globalData.force_static_qr === 1;

    if (isFree) { executeStartSessionTimer(); } 
    else if (isOffline || forceStatic) {
        store.setupPayment(customerTemplate.override_price, 'camera');
        setQrUrl(`http://${store.serverIP}:3000/qr/${globalData.static_qr_path}`);
        setStatusText("Menunggu Kasir Memverifikasi...");
        if (window.electronAPI.setPendingPayment) window.electronAPI.setPendingPayment({ name: customerName, template: customerTemplate.filename, price: customerTemplate.override_price });
    } else {
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
        if(st.success && st.status === 'settlement') { clearInterval(chk); setStatusText("Lunas!"); setTimeout(() => { store.setWaitingForPayment(false); executeStartSessionTimer(); }, 1500); }
        if (useStore.getState().currentScreen !== 'payment') clearInterval(chk);
      }, 3000);
    } else setStatusText("Error Midtrans");
  };

  const executeStartSessionTimer = async () => {
    setSessionExpiresAt(Date.now() + 600000); store.setScreen('camera');
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
    setSessionExpiresAt(null); store.setScreen('loading');
    const res = await window.electronAPI.processImages({ photosBase64: store.capturedPhotos, templateId: customerTemplate.id, eventFolder: store.activeEvent.folder_name, eventId: store.activeEvent.id, customerName: customerName, price: customerTemplate.override_price });
    if(res.success) { setFinalResult(res); store.setScreen('result'); } else { await store.showDialog("Gagal Merender: " + res.error); store.setScreen('landing'); }
  };

  // ==========================================
  // RENDER LAYAR APLIKASI
  // ==========================================
  const renderScreen = () => {
    if (store.currentScreen === 'loading') return <div className="flex h-screen items-center justify-center bg-[#007CC3] text-[#FFD453] font-pixel text-4xl animate-pulse">MEMUAT SISTEM...</div>;

    if (store.currentScreen === 'session_manager') return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#007CC3] p-8 overflow-hidden">
        <div className="w-full max-w-5xl bg-white flex flex-col h-[85vh] border-8 border-black shadow-[16px_16px_0_0_#FFD453]">
          <div className="bg-[#007CC3] text-white font-pixel p-4 text-xl border-b-8 border-black flex justify-between items-center">
            <div className="flex items-center gap-4"><span>📅 MANAJEMEN SESI EVENT</span><button onClick={() => setGlobalOpen(true)} className="bg-[#FFD453] hover:bg-yellow-400 text-black px-4 py-2 border-4 border-black text-sm shadow-[4px_4px_0_0_#000] hover:translate-y-1 transition-all" title="Global Settings">⚙️ PENGATURAN</button></div>
            {!showCreateForm && <button onClick={()=>setShowCreateForm(true)} className="bg-[#FF3B67] text-white px-4 py-2 border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-y-1 transition-all">BUAT SESI BARU</button>}
          </div>
          <div className="p-8 flex flex-col flex-1 overflow-y-auto bg-gray-100">
            {!showCreateForm && (
              <div className="flex flex-col h-full">
                <h2 className="font-pixel text-3xl mb-6 text-[#007CC3]">Riwayat Sesi Terakhir</h2>
                {store.recentEvents.length === 0 ? ( <p className="font-sys text-xl text-gray-500">Belum ada riwayat event.</p> ) : (
                  <div className="grid grid-cols-2 gap-6">
                    {store.recentEvents.map(ev => (
                      <div key={ev.id} className="border-4 border-black p-6 flex flex-col bg-white hover:bg-[#FFD453] transition-colors group shadow-[8px_8px_0_0_#000]">
                        <h3 className="font-sys text-3xl font-bold mb-2 text-black">{ev.nama_event}</h3>
                        <p className="font-pixel text-xs text-gray-500 mb-6">{new Date(ev.created_at).toLocaleString()}</p>
                        <button onClick={async()=>{ const isOk = await store.showDialog("Lanjutkan sesi ini?", 'confirm'); if(isOk) { await window.electronAPI.reopenEvent(ev.id); store.fetchActiveEvent(); } }} className="bg-[#007CC3] text-white font-pixel border-4 border-black py-3 text-sm mt-auto shadow-[4px_4px_0_0_#000] hover:translate-y-1">Buka & Lanjutkan Sesi Ini</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {showCreateForm && (
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-4 mb-6">
                  {store.recentEvents.length > 0 && <button onClick={()=>setShowCreateForm(false)} className="bg-[#FF3B67] text-white border-4 border-black font-pixel px-4 py-3 shadow-[4px_4px_0_0_#000] hover:translate-y-1">KEMBALI</button>}
                  <h2 className="font-pixel text-3xl text-[#007CC3]">Buka Sesi Event Baru</h2>
                </div>
                <div className="grid grid-cols-2 gap-6 border-b-4 border-dashed border-gray-400 pb-6">
                  <div className="flex flex-col font-sys text-xl"><label className="font-bold mb-2">Nama Event / Klien:</label><input type="text" className="border-4 border-black p-3 outline-none" value={newEventData.nama_event} onChange={e=>setNewEventData({...newEventData, nama_event: e.target.value})} /></div>
                  <div className="flex flex-col font-sys text-xl"><label className="font-bold mb-2">Saldo Awal / Deposit (Rp):</label><input type="text" className="border-4 border-black p-3 outline-none" value={formatRp(newEventData.saldo_awal)} onChange={e=>setNewEventData({...newEventData, saldo_awal: parseRp(e.target.value)})} placeholder="0" /></div>
                </div>
                <div className="flex flex-col font-sys text-xl mt-6 flex-1 overflow-y-auto pr-4">
                  <label className="font-bold mb-4">Pilih & Atur Harga Frame (WAJIB):</label>
                  <div className="grid grid-cols-3 gap-6 pb-10">
                    {store.templates.filter(t=>t.is_visible).map(tpl => {
                      const isSelected = selectedEventTemplates.find(t=>t.id === tpl.id);
                      return (
                        <div key={tpl.id} className={`border-4 border-black p-3 flex flex-col gap-3 cursor-pointer transition-all shadow-[4px_4px_0_0_#000] ${isSelected ? 'bg-[#007CC3] text-white' : 'bg-white hover:bg-gray-100 text-black'}`} onClick={(e) => { if(e.target.tagName !== 'INPUT') { const exists = selectedEventTemplates.find(t=>t.id === tpl.id); if(exists) setSelectedEventTemplates(selectedEventTemplates.filter(t=>t.id!==tpl.id)); else setSelectedEventTemplates([...selectedEventTemplates, {...tpl, override_price: tpl.price}]); } }}>
                          <div className="h-[140px] bg-gray-200 border-2 border-black flex justify-center relative p-2"><img src={`http://localhost:3000/templates/${tpl.filename}`} className="h-full object-contain drop-shadow-md" /><div className="absolute top-0 right-0 bg-[#FFD453] text-black px-2 py-1 text-[10px] font-pixel border-l-2 border-b-2 border-black">{tpl.orientation || 'portrait'}</div></div>
                          <div className="flex items-center gap-2"><input type="checkbox" checked={!!isSelected} onChange={() => {}} className="w-5 h-5" /><span className="font-bold truncate text-sm">{tpl.filename}</span></div>
                          {isSelected && ( <div className="mt-auto"><label className="text-xs font-bold text-[#FFD453] drop-shadow-md">Harga Sesi Ini (Rp):</label><input type="text" className="w-full border-2 border-black p-2 text-sm outline-none text-black" value={formatRp(isSelected.override_price)} onChange={(e) => setSelectedEventTemplates(prev => prev.map(p => p.id === tpl.id ? {...p, override_price: parseRp(e.target.value)} : p))} /></div> )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <button onClick={async()=>{ if(!newEventData.nama_event) return await store.showDialog("Nama Event wajib diisi!"); if(selectedEventTemplates.length===0) return await store.showDialog("Minimal pilih 1 template!"); const res = await window.electronAPI.createEvent({ nama_event: newEventData.nama_event, saldo_awal: parseRp(newEventData.saldo_awal) || 0, templates: selectedEventTemplates }); if(res.success) { setNewEventData({ nama_event: '', saldo_awal: '' }); setSelectedEventTemplates([]); setShowCreateForm(false); store.fetchActiveEvent(); store.fetchRecentEvents(); } else await store.showDialog("Sistem Gagal: " + res.error); }} className="bg-[#FFD453] text-black border-4 border-black font-pixel py-5 text-2xl mt-6 shadow-[8px_8px_0_0_#000] hover:translate-y-1 transition-all shrink-0">BUKA EVENT SEKARANG</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );

    if (store.currentScreen === 'landing') return (
      <div className="flex flex-col items-center justify-center h-screen space-y-12 bg-[#007CC3] relative">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#000 2px, transparent 2px), linear-gradient(90deg, #000 2px, transparent 2px)', backgroundSize: '40px 40px' }}></div>
        
        <div className="absolute top-6 left-6 bg-[#FF3B67] border-4 border-black px-6 py-3 font-pixel text-xl text-white shadow-[6px_6px_0_0_#000] animate-pulse">🔴 LIVE: {store.activeEvent?.nama_event}</div>
        <div className="absolute top-6 right-6 bg-black text-[#FFD453] border-4 border-[#FFD453] px-6 py-3 font-pixel text-xl shadow-[6px_6px_0_0_#000]">MODE: {store.settings?.app_mode?.toUpperCase() || 'ONLINE'}</div>
        
        <div className="text-center mt-12">
          <h1 className="font-pixel text-7xl md:text-9xl text-[#FFD453] drop-shadow-[8px_8px_0_#FF3B67] mb-6 tracking-widest">SayGumi!</h1>
          <p className="font-pixel text-2xl md:text-4xl text-white drop-shadow-[4px_4px_0_#000] animate-pulse">INSERT COIN / TAP TO START</p>
        </div>
        
        {(!store.isHardwareReady && globalData.hw_bypass_mode !== 1) ? (
            <button disabled className="bg-[#FF3B67] border-8 border-black font-pixel text-white px-12 py-8 text-3xl opacity-50 cursor-not-allowed shadow-[12px_12px_0_0_#000] relative z-10">HARDWARE OFFLINE (TIDAK SIAP)</button>
        ) : (
            <button onClick={() => { store.resetCustomerSession(); setCustomerName(''); setSessionExpiresAt(null); store.setScreen('template'); }} className="bg-[#FFD453] border-8 border-black font-pixel text-black px-16 py-8 text-4xl md:text-5xl hover:bg-white hover:-translate-y-2 shadow-[12px_12px_0_0_#000] transition-all relative z-10 animate-bounce">MULAI SEKARANG</button>
        )}
      </div>
    );

    // SMART TEMPLATE SELECTOR (INVISIBLE SCROLL & TABS)
    if (store.currentScreen === 'template') {
      const eventTemplates = JSON.parse(store.activeEvent?.templates_json || '[]');
      const hasPortrait = eventTemplates.some(t => t.orientation !== 'landscape');
      const hasLandscape = eventTemplates.some(t => t.orientation === 'landscape');
      if (!hasPortrait && customerTab === 'portrait') setCustomerTab('landscape');
      if (!hasLandscape && customerTab === 'landscape') setCustomerTab('portrait');
      const filteredTemplates = eventTemplates.filter(t => (customerTab === 'landscape' ? t.orientation === 'landscape' : t.orientation !== 'landscape'));

      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#007CC3] p-10 overflow-hidden relative">
          <h1 className="font-pixel text-5xl mb-6 text-[#FFD453] drop-shadow-[4px_4px_0_#000] shrink-0">Pilih Frame Favoritmu</h1>
          
          {hasPortrait && hasLandscape && (
             <div className="flex gap-6 mb-10 shrink-0">
                <button onClick={() => setCustomerTab('portrait')} className={`font-pixel px-10 py-4 text-2xl border-8 border-black transition-all ${customerTab === 'portrait' ? 'bg-[#FFD453] text-black shadow-[8px_8px_0_0_#000] translate-y-1' : 'bg-gray-300 text-gray-500 hover:bg-white shadow-[8px_8px_0_0_#000]'}`}>📱 PORTRAIT</button>
                <button onClick={() => setCustomerTab('landscape')} className={`font-pixel px-10 py-4 text-2xl border-8 border-black transition-all ${customerTab === 'landscape' ? 'bg-[#FFD453] text-black shadow-[8px_8px_0_0_#000] translate-y-1' : 'bg-gray-300 text-gray-500 hover:bg-white shadow-[8px_8px_0_0_#000]'}`}>📺 LANDSCAPE</button>
             </div>
          )}

          <div className={`flex gap-10 hide-scroll pb-10 ${customerTab === 'landscape' ? 'flex-col overflow-y-auto h-[65vh] items-center w-[600px] mx-auto' : 'flex-row overflow-x-auto w-full max-w-7xl items-center pt-4'}`}>
            {filteredTemplates.map(tpl => (
              <div key={tpl.id} onClick={() => startCustomerPhoto(tpl)} className={`bg-white border-8 border-black cursor-pointer hover:scale-105 hover:-translate-y-2 transition-all shadow-[12px_12px_0_0_#000] flex flex-col shrink-0 ${customerTab === 'landscape' ? 'w-[500px]' : 'w-[320px]'}`}>
                <div className={`${customerTab === 'landscape' ? 'h-[250px]' : 'h-[420px]'} bg-gray-200 border-b-8 border-black p-4 relative flex justify-center items-center`}>
                  <img src={`http://localhost:3000/templates/${tpl.filename}`} className="max-w-full max-h-full object-contain drop-shadow-xl" />
                  <div className="absolute top-4 right-4 font-pixel text-lg text-[#FFD453] px-4 py-2 border-4 border-black bg-[#FF3B67] shadow-[4px_4px_0_0_#000]">{tpl.override_price <= 0 ? 'GRATIS' : `Rp ${(tpl.override_price/1000)}k`}</div>
                </div>
                <div className="p-6 text-center font-pixel text-2xl bg-[#FFD453] text-black">PILIH FRAME</div>
              </div>
            ))}
          </div>
          <button onClick={() => store.setScreen('landing')} className="bg-[#FF3B67] text-white border-4 border-black font-pixel px-8 py-4 absolute bottom-8 left-8 text-xl shadow-[4px_4px_0_0_#000] hover:translate-y-1 transition-all">KEMBALI</button>
        </div>
      );
    }

    if (store.currentScreen === 'input_name') return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#007CC3] p-8">
        <div className="bg-white border-8 border-black w-full max-w-4xl p-10 text-center shadow-[16px_16px_0_0_#FFD453]">
          <h2 className="font-pixel text-4xl mb-8 text-[#007CC3]">Siapa Nama Kamu?</h2>
          <input type="text" readOnly className="w-full border-8 border-black p-6 text-center font-sys text-4xl outline-none bg-gray-100 text-black font-bold" placeholder="Ketik dari keyboard di bawah..." value={customerName} />
          <VirtualKeyboard value={customerName} onChange={setCustomerName} onEnter={submitNameAndPay} />
        </div>
      </div>
    );

    if (store.currentScreen === 'payment') return <div className="flex flex-col items-center justify-center h-screen bg-[#007CC3]"><div className="bg-white border-8 border-black shadow-[16px_16px_0_0_#FFD453] w-[500px] p-10 text-center"><h2 className="font-pixel text-3xl mb-6 text-[#007CC3]">Scan QRIS</h2><div className="font-sys text-6xl font-bold text-[#FF3B67] mb-8">Rp {store.paymentAmount.toLocaleString('id-ID')}</div><div className="w-[320px] h-[320px] mx-auto border-8 border-black flex items-center justify-center bg-gray-100 mb-8">{qrUrl ? <img src={qrUrl} className="w-[90%] h-[90%] object-contain" /> : <div className="animate-spin text-4xl">⏳</div>}</div><div className="font-sys text-2xl font-bold text-black bg-[#FFD453] p-3 border-4 border-black">{statusText}</div></div></div>;

    // ADAPTIVE CAMERA SCREEN (Optimalisasi Ruang Kerja)
    if (store.currentScreen === 'camera') {
      const slotsArr = typeof customerTemplate?.slots === 'string' ? JSON.parse(customerTemplate.slots) : (customerTemplate?.slots || []);
      const isLandscape = customerTemplate?.orientation === 'landscape';
      
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#007CC3] relative p-6 overflow-hidden">
          {sessionExpiresAt && <div className="absolute top-6 right-6 bg-[#FF3B67] text-white px-6 py-3 font-pixel text-2xl border-4 border-black z-50 shadow-[6px_6px_0_0_#000]">⏳ {Math.floor(timeLeftDisplay / 60).toString().padStart(2, '0')}:{(timeLeftDisplay % 60).toString().padStart(2, '0')}</div>}
          <h2 className="font-pixel text-4xl text-center mb-6 text-[#FFD453] drop-shadow-[4px_4px_0_#000] shrink-0">Gaya ke-{store.capturedPhotos.filter(p => p !== null).length + 1}</h2>

          <div className={`flex gap-6 w-full max-w-7xl items-stretch ${isLandscape ? 'flex-col h-[85vh]' : 'flex-row h-[80vh]'}`}>
            
            {/* LIVE VIEW BESAR DENGAN ONCLICK */}
            <div className={`${isLandscape ? 'h-[70%] w-full flex-row' : 'w-[70%] h-full flex-col'} border-8 border-black bg-black flex p-2 shadow-[12px_12px_0_0_#FFD453] relative cursor-pointer hover:shadow-[16px_16px_0_0_#FFD453] transition-all`} onClick={countdown === null ? takePhotoAction : undefined}>
              <div className="relative flex-1 bg-black overflow-hidden flex justify-center items-center">
                <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"></video>
                
                {countdown === null && (
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/80 text-[#FFD453] px-8 py-4 border-4 border-[#FFD453] font-pixel text-xl md:text-2xl z-10 pointer-events-none text-center shadow-[6px_6px_0_0_#000] animate-pulse">
                        👆 TEKAN LAYAR UNTUK MULAI TAKE FOTO
                    </div>
                )}
                {countdown && <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20"><span className="font-pixel text-[150px] text-[#FFD453] drop-shadow-[12px_12px_0_#FF3B67]">{countdown}</span></div>}
              </div>
            </div>

            <div className={`${isLandscape ? 'h-[30%] w-full flex-row' : 'w-[30%] h-full flex-col'} bg-white border-8 border-black flex p-4 shrink-0 shadow-[12px_12px_0_0_#FFD453]`}>
              {!isLandscape && <h2 className="font-pixel text-2xl text-center mb-4 shrink-0 text-[#007CC3]">Preview</h2>}
              <div ref={previewContainerRef} className="flex-1 min-h-0 min-w-0 border-4 border-dashed border-gray-400 bg-gray-100 relative overflow-hidden flex justify-center items-center p-2">
                  {customerTemplate && (
                      <div className="shrink-0" style={{ width: Number(customerTemplate.width), height: Number(customerTemplate.height), minWidth: Number(customerTemplate.width), minHeight: Number(customerTemplate.height), transform: `scale(${previewScale})`, transformOrigin: 'center center', position: 'relative', backgroundColor: 'transparent' }}>
                          {slotsArr.map((slot, i) => (
                              <div key={i} style={{ position: 'absolute', top: slot.top, left: slot.left, width: slot.width, height: slot.height, backgroundColor: '#ddd', overflow: 'hidden' }}>
                                  {store.capturedPhotos[i] ? <img src={store.capturedPhotos[i]} className="w-full h-full object-cover scale-x-[-1]" /> : <div className="w-full h-full border-4 border-dashed border-gray-400 flex items-center justify-center"><span className="font-sys text-gray-400 font-bold text-5xl">{i+1}</span></div>}
                              </div>
                          ))}
                          <img src={`http://localhost:3000/templates/${customerTemplate.filename}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }} />
                      </div>
                  )}
              </div>
              <div className={`font-sys text-center font-bold bg-[#FF3B67] text-white border-4 border-black shadow-[4px_4px_0_0_#000] shrink-0 flex items-center justify-center ${isLandscape ? 'w-[180px] h-full ml-4 text-3xl' : 'w-full py-4 mt-4 text-2xl'}`}>Sisa:<br/>{store.capturedPhotos.filter(p => p === null).length}</div>
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden"></canvas>
        </div>
      );
    }

    // ADAPTIVE REVIEW SCREEN (Grid Retake Besar)
    if (store.currentScreen === 'review') {
      const slotsArr = typeof customerTemplate?.slots === 'string' ? JSON.parse(customerTemplate.slots) : (customerTemplate?.slots || []);
      const isLandscape = customerTemplate?.orientation === 'landscape';
      
      // GRID LOGIC FIX: Menggunakan content-start dan minimal batas ukuran agar card tidak menyusut (bantet)
      const gridClass = isLandscape 
            ? 'flex flex-row overflow-x-auto gap-6 hide-scroll items-start' 
            : `grid grid-cols-2 gap-6 overflow-y-auto hide-scroll content-start pb-10`;

      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#007CC3] space-y-6 relative p-6 overflow-hidden">
          {sessionExpiresAt && <div className="absolute top-6 right-6 bg-[#FF3B67] text-white px-6 py-3 font-pixel text-2xl border-4 border-black z-50 shadow-[6px_6px_0_0_#000]">⏳ {Math.floor(timeLeftDisplay / 60).toString().padStart(2, '0')}:{(timeLeftDisplay % 60).toString().padStart(2, '0')}</div>}
          <h1 className="font-pixel text-5xl text-[#FFD453] drop-shadow-[4px_4px_0_#000] shrink-0">Review Hasil Akhir</h1>
          
          <div className={`flex gap-8 w-full max-w-7xl flex-1 min-h-0 ${isLandscape ? 'flex-col' : 'flex-row'}`}>
             <div className={`${isLandscape ? 'h-[60%] w-full' : 'w-[45%] h-full'} bg-white border-8 border-black flex flex-col p-4 shrink-0 shadow-[12px_12px_0_0_#FFD453]`}>
                {!isLandscape && <h2 className="font-pixel text-2xl text-center mb-4 shrink-0 text-[#007CC3]">Photostrip Kamu</h2>}
                <div ref={reviewPreviewContainerRef} className="flex-1 min-h-0 border-4 border-dashed border-gray-400 bg-gray-100 relative overflow-hidden flex justify-center items-center p-2">
                    {customerTemplate && (
                        <div className="shrink-0" style={{ width: Number(customerTemplate.width), height: Number(customerTemplate.height), minWidth: Number(customerTemplate.width), minHeight: Number(customerTemplate.height), transform: `scale(${reviewPreviewScale})`, transformOrigin: 'center center', position: 'relative' }}>
                            {slotsArr.map((slot, i) => (
                                <div key={i} style={{ position: 'absolute', top: slot.top, left: slot.left, width: slot.width, height: slot.height, backgroundColor: '#ddd', overflow: 'hidden' }}>
                                    {store.capturedPhotos[i] ? <img src={store.capturedPhotos[i]} className="w-full h-full object-cover scale-x-[-1]" /> : null}
                                </div>
                            ))}
                            <img src={`http://localhost:3000/templates/${customerTemplate.filename}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }} />
                        </div>
                    )}
                </div>
             </div>

             <div className={`flex-1 border-8 border-black bg-white flex shadow-[12px_12px_0_0_#FFD453] min-h-0 ${isLandscape ? 'flex-row p-6 items-center' : 'flex-col p-6'}`}>
                
                <div className={`flex-1 min-h-0 min-w-0 ${gridClass}`}>
                  {store.capturedPhotos.map((photo, i) => (
                    <div key={i} className={`border-4 border-black p-4 flex flex-col items-center bg-gray-100 shrink-0 shadow-[6px_6px_0_0_#000] ${isLandscape ? 'w-[320px] h-auto' : 'w-full min-h-[250px]'}`}>
                      <h3 className="font-pixel text-lg md:text-xl mb-3 text-[#007CC3]">Gaya {i + 1}</h3>
                      {photo ? <img src={photo} className="w-full aspect-video object-cover border-4 border-black scale-x-[-1]" /> : <div className="w-full aspect-video bg-gray-300 border-4 border-black flex items-center justify-center font-sys text-gray-500 text-lg font-bold">Kosong</div>}
                      {timeLeftDisplay > 60 && <button onClick={() => { const nw = [...store.capturedPhotos]; nw[i]=null; store.setCapturedPhotos(nw); store.decrementRetake(); store.setScreen('camera'); executeStartSessionTimer(); }} disabled={store.retakesLeft <= 0 || !photo} className="w-full mt-4 px-2 py-3 font-pixel text-sm md:text-base border-4 border-black bg-[#FFD453] hover:bg-yellow-400 disabled:opacity-50 transition-colors shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none">🔄 RETAKE FOTO</button>}
                    </div>
                  ))}
                </div>

                <div className={`shrink-0 flex items-center gap-4 ${isLandscape ? 'flex-col w-[220px] ml-8' : 'flex-col mt-6 pt-6 border-t-8 border-dashed border-gray-300'}`}>
                  {timeLeftDisplay > 60 && <p className="font-pixel text-xl md:text-2xl text-black bg-[#FFD453] px-6 py-4 border-4 border-black shadow-[6px_6px_0_0_#000] text-center w-full">SISA RETAKE:<br/>{store.retakesLeft}</p>}
                  <button onClick={processStitching} className="bg-[#FF3B67] hover:bg-red-700 text-white font-pixel border-4 border-black w-full py-6 text-3xl shadow-[8px_8px_0_0_#000] hover:translate-y-1 transition-all flex-1 min-h-[100px]">🖨️ CETAK SEKARANG</button>
                </div>

             </div>
          </div>
        </div>
      );
    }

    if (store.currentScreen === 'result') return (
      <div className="flex flex-col items-center justify-center h-screen space-y-6 bg-[#007CC3] p-6 overflow-hidden">
        <h1 className="font-pixel text-6xl text-[#FFD453] drop-shadow-[6px_6px_0_#000] shrink-0">SayGumi!</h1>
        <h2 className="font-sys text-3xl font-bold mb-4 shrink-0 text-white drop-shadow-[2px_2px_0_#000]">Selesai! Scan QR Code untuk Download</h2>
        <div className="flex gap-10 items-stretch w-full max-w-5xl flex-1 min-h-0 pb-6">
          <div className="w-[60%] bg-white border-8 border-black p-6 flex justify-center items-center overflow-hidden relative shadow-[16px_16px_0_0_#FFD453]"><img src={finalResult?.downloadUrl} className="max-h-full max-w-full object-contain border-4 border-gray-300 bg-white drop-shadow-xl" alt="Final Photostrip" /></div>
          <div className="w-[40%] bg-white border-8 border-black p-8 flex flex-col items-center justify-center gap-6 shrink-0 shadow-[16px_16px_0_0_#FF3B67] overflow-y-auto">
            <p className="font-pixel text-2xl text-center text-[#007CC3]">Ambil Softfile</p>
            <div className="border-8 border-black p-4 bg-gray-100 shadow-inner"><img src={finalResult?.qrCode} className="w-[200px] h-[200px] object-contain" alt="QR Code" /></div>
            <p className="font-sys text-center text-gray-600 font-bold text-lg mt-2 px-2 leading-tight">File resolusi tinggi tersimpan di server lokal. Segera download sebelum ditutup.</p>
            <button onClick={() => { store.resetCustomerSession(); store.setScreen('landing'); }} className="bg-[#FFD453] text-black border-4 border-black font-pixel w-full py-6 mt-auto text-3xl shadow-[6px_6px_0_0_#000] hover:translate-y-1 transition-all shrink-0">SELESAI</button>
          </div>
        </div>
      </div>
    );

    return null;
  };

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <RetroDialog />
      
      {hwStatus && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-[#FFD453] text-black px-10 py-5 border-8 border-black font-sys font-bold z-[200] shadow-[8px_8px_0_0_#000] animate-bounce text-2xl text-center whitespace-pre-wrap">
            {hwStatus}
        </div>
      )}

      {renderScreen()}

      {/* ==========================================
          MODAL 1: LIVE DASHBOARD EVENT (Ctrl+Shift+D)
      ========================================== */}
      {isDashboardOpen && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[100] p-10">
          <div className="bg-white border-8 border-black w-full max-w-6xl flex flex-col h-[90vh] shadow-[16px_16px_0_0_#FFD453]">
            <div className="bg-[#007CC3] text-white font-pixel border-b-8 border-black p-6 text-2xl flex justify-between">LIVE DASHBOARD - {store.activeEvent?.nama_event} <button onClick={()=>setDashboardOpen(false)} className="text-[#FF3B67] hover:text-white hover:scale-125">X</button></div>
            <div className="p-8 flex flex-col gap-6 overflow-y-auto bg-gray-100">
              <div className="flex gap-6">
                <div className="flex-1 bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000] flex flex-col gap-4">
                  <h3 className="font-pixel text-xl text-[#007CC3]">Akses Penyimpanan</h3>
                  <div className="font-sys text-base mt-2 flex flex-col gap-4">
                    <div><p className="font-bold">📁 Direktori Lokal (Backup):</p><p className="text-gray-600 bg-gray-100 p-3 border-2 border-gray-400 select-all font-mono">{dashboardData?.localPath || 'Memuat...'}</p></div>
                    {globalData.app_mode === 'online' && ( <div><p className="font-bold">☁️ Google Drive:</p><p className="text-blue-600 bg-blue-50 p-3 border-2 border-blue-300 select-all break-all font-mono">{dashboardData?.gdriveLink || 'Memuat...'}</p></div> )}
                  </div>
                </div>
                <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000] flex flex-col items-center justify-center shrink-0 w-[260px]">
                  <h3 className="font-pixel text-lg mb-4 text-center text-[#FF3B67]">Remote Cashier</h3>
                  {dashboardData?.adminQr ? <img src={dashboardData.adminQr} className="w-[140px] h-[140px] border-4 border-black p-1" alt="Admin QR" /> : <div className="w-[140px] h-[140px] border-4 flex items-center justify-center text-3xl">⏳</div>}
                  <p className="font-sys text-xs text-gray-500 mt-4 text-center leading-tight font-bold">Scan via HP Admin</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-6">
                <div className="bg-white border-4 border-black p-4 text-center shadow-[4px_4px_0_0_#000]"><p className="font-sys text-gray-500 font-bold mb-1">Saldo/Deposit Awal</p><p className="font-pixel text-2xl text-[#007CC3]">Rp {formatRp(dashboardData?.stats?.saldo_awal)}</p></div>
                <div className="bg-white border-4 border-black p-4 text-center shadow-[4px_4px_0_0_#000]"><p className="font-sys text-gray-500 font-bold mb-1">Total Transaksi</p><p className="font-pixel text-2xl text-black">{dashboardData?.stats?.total_trx || 0} Lembar</p></div>
                <div className="bg-white border-4 border-black p-4 text-center shadow-[4px_4px_0_0_#000]"><p className="font-sys text-gray-500 font-bold mb-1">Beban HPP</p><p className="font-pixel text-2xl text-[#FF3B67]">Rp {formatRp(dashboardData?.stats?.total_beban_hpp)}</p></div>
                <div className="bg-[#FFD453] border-4 border-black p-4 text-center shadow-[8px_8px_0_0_#000]"><p className="font-sys font-bold mb-1 text-black">Laba Bersih</p><p className={`font-pixel text-3xl ${dashboardData?.stats?.sisa_saldo < 0 ? 'text-[#FF3B67]' : 'text-green-800'}`}>Rp {formatRp(dashboardData?.stats?.sisa_saldo)}</p></div>
              </div>
              <div className="bg-white border-4 border-black flex-1 flex flex-col shadow-[8px_8px_0_0_#000]">
                <div className="bg-[#007CC3] text-[#FFD453] border-b-4 border-black p-3 font-pixel text-base flex"><div className="w-[180px]">WAKTU</div><div className="flex-1">PELANGGAN</div><div className="w-[180px]">STATUS</div><div className="w-[180px]">HARGA</div></div>
                <div className="overflow-y-auto font-sys text-xl min-h-[200px]">
                  {dashboardData?.sessions?.length === 0 && <p className="p-6 text-center text-gray-500 font-bold">Belum ada transaksi di sesi ini.</p>}
                  {dashboardData?.sessions?.map((s, i) => ( <div key={i} className="flex p-3 border-b-2 border-gray-200 hover:bg-yellow-50"><div className="w-[180px] text-base text-gray-500 pt-1">{s.waktu}</div><div className="flex-1 font-bold">{s.customer_name}</div><div className="w-[180px] font-bold text-green-600">{s.status_cetak}</div><div className="w-[180px] font-bold text-[#007CC3]">Rp {formatRp(s.harga_jual)}</div></div> ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 2: GLOBAL SETTINGS (STICKY & TABBED)
      ========================================== */}
      {isGlobalOpen && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[90] p-10">
          <div className="bg-white border-8 border-black w-full max-w-5xl flex flex-col h-[90vh] shadow-[16px_16px_0_0_#FFD453]">
            <div className="bg-[#007CC3] text-white font-pixel border-b-8 border-black p-6 text-2xl flex justify-between">
               <span>⚙️ GLOBAL SETTINGS.INI</span>
               <button onClick={async ()=>{ const ok = await store.showDialog('Batal mengubah pengaturan? Semua yang belum disave akan hilang.', 'confirm'); if(ok) setGlobalOpen(false); }} className="text-[#FF3B67] hover:text-white hover:scale-125 font-bold">X</button>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
               {/* Sisi Kiri: Tab Navigation */}
               <div className="w-[280px] bg-gray-200 border-r-8 border-black flex flex-col p-4 gap-3 shrink-0">
                  <button onClick={() => setSettingsTab('umum')} className={`text-left p-4 font-pixel text-lg border-4 border-black transition-all ${settingsTab === 'umum' ? 'bg-[#FFD453] text-black translate-x-2 shadow-[-6px_6px_0_0_#000]' : 'bg-white hover:bg-gray-100 text-gray-700'}`}>1. Harga & Mode</button>
                  <button onClick={() => setSettingsTab('midtrans')} className={`text-left p-4 font-pixel text-lg border-4 border-black transition-all ${settingsTab === 'midtrans' ? 'bg-[#FFD453] text-black translate-x-2 shadow-[-6px_6px_0_0_#000]' : 'bg-white hover:bg-gray-100 text-gray-700'}`}>2. Pembayaran</button>
                  <button onClick={() => setSettingsTab('hardware')} className={`text-left p-4 font-pixel text-lg border-4 border-black transition-all ${settingsTab === 'hardware' ? 'bg-[#FFD453] text-black translate-x-2 shadow-[-6px_6px_0_0_#000]' : 'bg-white hover:bg-gray-100 text-gray-700'}`}>3. Hardware</button>
               </div>

               {/* Sisi Kanan: Content Area */}
               <div className="flex-1 p-8 overflow-y-auto font-sys text-xl bg-white relative">
                  {settingsTab === 'umum' && (
                     <div className="flex flex-col gap-6 animate-fade-in">
                        <h2 className="font-pixel text-3xl border-b-4 border-dashed border-gray-400 pb-4 text-[#007CC3]">Pengaturan Umum</h2>
                        <div className="flex items-center gap-4 bg-[#FFD453] p-5 border-4 border-black shadow-[4px_4px_0_0_#000]">
                           <label className="font-bold w-[150px] text-black">Mode Kiosk:</label>
                           <select className="border-4 border-black p-3 outline-none flex-1 font-bold text-[#007CC3]" value={globalData.app_mode} onChange={e=>setGlobalData({...globalData, app_mode: e.target.value})}>
                              <option value="online">🟢 ONLINE (Midtrans Aktif)</option>
                              <option value="offline">🟠 OFFLINE (Bayar Kasir / QR Statis)</option>
                           </select>
                        </div>
                        <div className="grid grid-cols-3 gap-6">
                           <div className="flex flex-col"><label className="font-bold mb-2">HPP Kertas (Rp)</label><input type="text" className="border-4 border-black p-3 outline-none focus:bg-yellow-50" value={formatRp(globalData.hpp_kertas)} onChange={e=>setGlobalData({...globalData, hpp_kertas: parseRp(e.target.value)})} /></div>
                           <div className="flex flex-col"><label className="font-bold mb-2">HPP Tinta (Rp)</label><input type="text" className="border-4 border-black p-3 outline-none focus:bg-yellow-50" value={formatRp(globalData.hpp_tinta)} onChange={e=>setGlobalData({...globalData, hpp_tinta: parseRp(e.target.value)})} /></div>
                           <div className="flex flex-col"><label className="font-bold mb-2">Biaya Ops (Rp)</label><input type="text" className="border-4 border-black p-3 outline-none focus:bg-yellow-50" value={formatRp(globalData.biaya_ops)} onChange={e=>setGlobalData({...globalData, biaya_ops: parseRp(e.target.value)})} /></div>
                        </div>
                        <hr className="border-2 border-dashed border-gray-300 my-2" />
                        <label className="font-bold mt-2 text-[#007CC3]">ID Folder Google Drive (Induk Event):</label>
                        <input type="text" className="border-4 border-black p-4 outline-none font-mono focus:bg-yellow-50" placeholder="Paste ID Folder GDrive..." value={globalData.gdrive_folder_id} onChange={e=>setGlobalData({...globalData, gdrive_folder_id: e.target.value})} />
                        <p className="text-base text-gray-500 italic font-bold">* Kosongkan jika tidak auto-upload ke cloud.</p>
                     </div>
                  )}

                  {settingsTab === 'midtrans' && (
                     <div className="flex flex-col gap-6 animate-fade-in">
                        <h2 className="font-pixel text-3xl border-b-4 border-dashed border-gray-400 pb-4 text-[#007CC3]">Gateway Pembayaran</h2>
                        <div className="flex flex-col gap-4 bg-gray-100 p-6 border-4 border-black shadow-[4px_4px_0_0_#000]">
                           <h3 className="font-bold text-[#007CC3] text-2xl">API Midtrans (Online Mode)</h3>
                           <div className="flex flex-col gap-3 mt-2">
                              <label className="font-bold text-base">Server Key:</label>
                              <input type="text" className="border-4 border-black p-3 outline-none text-base bg-white focus:bg-yellow-50 font-mono" value={globalData.midtrans_server_key} onChange={e=>setGlobalData({...globalData, midtrans_server_key: e.target.value})} />
                              <label className="font-bold text-base mt-2">Client Key:</label>
                              <input type="text" className="border-4 border-black p-3 outline-none text-base bg-white focus:bg-yellow-50 font-mono" value={globalData.midtrans_client_key} onChange={e=>setGlobalData({...globalData, midtrans_client_key: e.target.value})} />
                           </div>
                        </div>

                        <div className="flex flex-col gap-4 bg-gray-100 p-6 border-4 border-black shadow-[4px_4px_0_0_#000] mt-2">
                           <h3 className="font-bold text-[#007CC3] text-2xl flex items-center justify-between">
                              QRIS Statis (Offline Mode)
                              <label className="font-bold flex items-center gap-3 text-base text-white bg-[#007CC3] p-3 border-4 border-black cursor-pointer shadow-[4px_4px_0_0_#000] hover:translate-y-1 transition-all">
                                 <input type="checkbox" className="w-6 h-6 shrink-0" checked={globalData.force_static_qr === 1} onChange={e=>setGlobalData({...globalData, force_static_qr: e.target.checked ? 1 : 0})} /> 
                                 PAKSA SELALU STATIS
                              </label>
                           </h3>
                           <div className="flex gap-8 items-start mt-4">
                              <div className="flex-1 flex flex-col gap-4">
                                 <p className="text-base text-gray-600 font-bold">Gambar ini akan dimunculkan di layar Kiosk saat mode Offline aktif. Pembayaran diverifikasi manual dari HP Kasir.</p>
                                 <button type="button" onClick={async () => { const path = await window.electronAPI.selectStaticQR(); if(path) setGlobalData({...globalData, static_qr_path: path}); }} className="bg-[#FFD453] text-black font-pixel border-4 border-black py-4 text-base shadow-[4px_4px_0_0_#000] hover:translate-y-1 transition-all">📁 UPLOAD GAMBAR QR BARU</button>
                              </div>
                              <div className="border-4 border-dashed border-gray-400 bg-white w-[180px] h-[180px] flex items-center justify-center shrink-0 p-2">
                                 {globalData.static_qr_path ? <img src={`http://${store.serverIP}:3000/qr/${globalData.static_qr_path}`} className="max-w-full max-h-full object-contain" alt="QR Preview" /> : <span className="text-sm font-bold text-gray-400">Belum diupload</span>}
                              </div>
                           </div>
                        </div>
                     </div>
                  )}

                  {settingsTab === 'hardware' && (
                     <div className="flex flex-col gap-6 animate-fade-in">
                        <h2 className="font-pixel text-3xl border-b-4 border-dashed border-gray-400 pb-4 text-[#007CC3]">Hardware & Mesin</h2>
                        <label className="font-bold flex items-center gap-4 text-xl text-white bg-[#FF3B67] p-6 border-4 border-black cursor-pointer shadow-[8px_8px_0_0_#000] hover:translate-y-1 transition-all mt-2">
                           <input type="checkbox" className="w-8 h-8 shrink-0 accent-white" checked={globalData.hw_bypass_mode === 1} onChange={e=>setGlobalData({...globalData, hw_bypass_mode: e.target.checked ? 1 : 0})} /> 
                           AKTIFKAN MODE TROUBLESHOOTING (Bypass Pemblokir Kiosk)
                        </label>
                        <p className="text-base text-gray-600 px-2 italic font-bold">* Centang kotak merah di atas jika mesin gagal mendeteksi kamera/printer namun Anda ingin Kiosk tetap berjalan secara digital.</p>
                        
                        <div className="flex flex-col gap-4 mt-6 bg-gray-100 p-8 border-4 border-black shadow-[4px_4px_0_0_#000]">
                           <label className="font-bold text-xl text-[#007CC3]">📷 Pilih Kamera Utama:</label>
                           <select className="border-4 border-black p-4 text-xl outline-none cursor-pointer focus:bg-yellow-50" value={globalData.selected_camera} onChange={e=>setGlobalData({...globalData, selected_camera: e.target.value})}>
                              <option value="">-- Gunakan Kamera Bawaan Sistem --</option>
                              {availableCameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label}</option>)}
                           </select>

                           <label className="font-bold text-xl text-[#007CC3] mt-6">🖨️ Pilih Printer Thermal/Foto:</label>
                           <select className="border-4 border-black p-4 text-xl outline-none cursor-pointer focus:bg-yellow-50" value={globalData.selected_printer} onChange={e=>setGlobalData({...globalData, selected_printer: e.target.value})}>
                              <option value="">-- Gunakan Printer Bawaan Sistem --</option>
                              {availablePrinters.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                           </select>
                        </div>
                     </div>
                  )}
               </div>
            </div>

            {/* Sticky Footer Modal */}
            <div className="border-t-8 border-black bg-gray-200 p-6 flex gap-6 shrink-0">
               <button onClick={async ()=>{ const ok = await store.showDialog('Batal mengubah pengaturan?', 'confirm'); if(ok) setGlobalOpen(false); }} className="bg-[#FF3B67] hover:bg-red-700 text-white font-pixel border-4 border-black flex-1 py-5 text-2xl shadow-[6px_6px_0_0_#000] hover:translate-y-1 transition-all">BATAL (JANGAN SIMPAN)</button>
               <button onClick={saveGlobalSettings} className="bg-[#007CC3] hover:bg-blue-800 text-[#FFD453] font-pixel border-4 border-black flex-1 py-5 text-2xl shadow-[6px_6px_0_0_#000] hover:translate-y-1 transition-all">SIMPAN PENGATURAN</button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 3: MASTER TEMPLATE & ORIENTATION
      ========================================== */}
      {isTemplateOpen && !editingTemplate && !orientationModal && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[80] p-10">
          <div className="bg-white border-8 border-black w-full max-w-6xl flex flex-col h-[90vh] shadow-[16px_16px_0_0_#FFD453]">
            <div className="bg-[#007CC3] text-white font-pixel border-b-8 border-black p-6 text-2xl flex justify-between"><span>MASTER TEMPLATE LIBRARY</span><button onClick={()=>setTemplateOpen(false)} className="text-[#FF3B67] hover:text-white font-bold">X</button></div>
            <div className="p-8 flex flex-col gap-8 overflow-y-auto bg-gray-100">
              <div className="flex justify-between items-center bg-white p-6 border-4 border-black shadow-[8px_8px_0_0_#000]">
                <div><h2 className="font-pixel text-3xl text-[#007CC3]">Database Master Template</h2></div>
                <button onClick={async () => { const path = await window.electronAPI.openFileDialog(); if (path) { const res = await window.electronAPI.saveNewTemplate({ tempPath: path }); if(res.success) { store.fetchTemplates(); setOrientationModal(res.id); } } }} className="bg-[#FFD453] text-black font-pixel border-4 border-black px-8 py-4 text-xl shadow-[4px_4px_0_0_#000] hover:translate-y-1 transition-all">➕ UPLOAD PNG BARU</button>
              </div>
              <div className="grid grid-cols-2 gap-6">
                {store.templates.map(tpl => (
                  <div key={tpl.id} className="bg-white border-4 border-black p-5 flex gap-6 shadow-[8px_8px_0_0_#000]">
                    <div className="w-[120px] h-[160px] bg-gray-200 flex justify-center items-center shrink-0 border-4 border-dashed border-gray-400 relative p-2">
                       <img src={`http://localhost:3000/templates/${tpl.filename}`} className="max-h-full object-contain" />
                       <div className="absolute -top-4 -right-4 bg-black text-[#FFD453] px-3 py-1 text-xs font-pixel border-2 border-[#FFD453]">{tpl.orientation?.toUpperCase()}</div>
                    </div>
                    <div className="flex flex-col flex-1 font-sys gap-3">
                      <p className="font-bold truncate border-b-4 border-dashed border-gray-300 pb-2 text-2xl text-[#007CC3]">{tpl.filename}</p>
                      <div className="flex gap-4"><label className="text-base font-bold flex items-center gap-2 cursor-pointer text-gray-700"><input type="checkbox" className="w-5 h-5 accent-[#007CC3]" checked={tpl.is_visible===1} onChange={e=>updateMasterAttr(tpl, 'is_visible', e.target.checked?1:0)} /> Tampil di Kiosk</label></div>
                      <div className="flex items-center gap-3 mt-1"><span className="text-base font-bold bg-[#FFD453] px-3 py-1 border-2 border-black">Harga Dasar:</span><input type="text" className="border-4 border-gray-300 p-2 w-32 outline-none font-bold text-lg focus:border-[#007CC3]" value={formatRp(tpl.price)} onChange={(e) => updateMasterAttr(tpl, 'price', parseRp(e.target.value))} /></div>
                      <div className="mt-auto flex gap-3">
                        <button onClick={() => setOrientationModal(tpl.id)} className="bg-[#007CC3] text-white font-pixel border-4 border-black flex-1 py-3 text-sm shadow-[4px_4px_0_0_#000] hover:translate-y-1 transition-all">Orientasi & Slot</button>
                        <button onClick={async () => { const ok = await store.showDialog("Hapus master template ini selamanya?", "confirm"); if(ok) { await window.electronAPI.deleteTemplate(tpl.id); store.fetchTemplates(); } }} className="bg-[#FF3B67] text-white font-pixel border-4 border-black px-6 py-3 text-sm shadow-[4px_4px_0_0_#000] hover:translate-y-1 transition-all">X</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ORIENTATION PICKER MODAL (MUNCUL SEBELUM EDITOR) */}
      {orientationModal && (
        <div className="fixed inset-0 bg-black/90 flex justify-center items-center z-[90] p-10 animate-fade-in">
           <div className="bg-[#007CC3] border-8 border-black w-full max-w-4xl p-12 flex flex-col text-center shadow-[16px_16px_0_0_#FFD453]">
              <h2 className="font-pixel text-4xl mb-4 text-[#FFD453] drop-shadow-[4px_4px_0_#000]">Tentukan Orientasi Bingkai</h2>
              <p className="font-sys text-2xl font-bold text-white mb-12 drop-shadow-md">Pilihan ini akan mengatur tata letak adaptif layar kamera pelanggan.</p>
              
              <div className="flex gap-10 justify-center mb-12">
                 <button onClick={() => { const tpl = store.templates.find(t=>t.id === orientationModal); setEditingTemplate({...tpl, orientation: 'portrait'}); setOrientationModal(null); }} className="flex flex-col items-center gap-6 bg-white p-8 border-8 border-black shadow-[12px_12px_0_0_#000] hover:-translate-y-2 hover:shadow-[16px_16px_0_0_#FFD453] transition-all w-[320px]">
                    <div className="w-[200px] h-[160px] border-4 border-gray-400 bg-gray-100 flex gap-2 p-2">
                       <div className="flex-1 bg-gray-800 flex items-center justify-center text-4xl">📷</div>
                       <div className="w-[50px] bg-blue-200 border-2 border-blue-400 flex flex-col gap-1 p-1"><div className="flex-1 bg-white"/><div className="flex-1 bg-white"/><div className="flex-1 bg-white"/></div>
                    </div>
                    <span className="font-pixel text-2xl text-[#007CC3]">PORTRAIT<br/><span className="text-base text-gray-500">(Berdiri)</span></span>
                 </button>

                 <button onClick={() => { const tpl = store.templates.find(t=>t.id === orientationModal); setEditingTemplate({...tpl, orientation: 'landscape'}); setOrientationModal(null); }} className="flex flex-col items-center gap-6 bg-white p-8 border-8 border-black shadow-[12px_12px_0_0_#000] hover:-translate-y-2 hover:shadow-[16px_16px_0_0_#FFD453] transition-all w-[320px]">
                    <div className="w-[200px] h-[160px] border-4 border-gray-400 bg-gray-100 flex flex-col gap-2 p-2">
                       <div className="flex-1 bg-gray-800 flex items-center justify-center text-4xl">📷</div>
                       <div className="h-[40px] bg-blue-200 border-2 border-blue-400 flex gap-1 p-1"><div className="flex-1 bg-white"/><div className="flex-1 bg-white"/><div className="flex-1 bg-white"/></div>
                    </div>
                    <span className="font-pixel text-2xl text-[#007CC3]">LANDSCAPE<br/><span className="text-base text-gray-500">(Tidur)</span></span>
                 </button>
              </div>
              <button onClick={() => setOrientationModal(null)} className="bg-[#FF3B67] text-white border-4 border-black font-pixel py-5 text-2xl w-[250px] mx-auto shadow-[6px_6px_0_0_#000] hover:translate-y-1 transition-all">BATAL</button>
           </div>
        </div>
      )}

      {/* Z-INDEX AMAN KARENA MODAL SEBELUMNYA DIHILANGKAN */}
      {editingTemplate && <VisualEditor template={editingTemplate} onCancel={()=>setEditingTemplate(null)} onSave={async(s) => { await updateMasterAttr(editingTemplate, 'slots', s); await updateMasterAttr(editingTemplate, 'orientation', editingTemplate.orientation); setEditingTemplate(null); store.showDialog("Koordinat & Orientasi Disimpan!"); }} />}
    </div>
  );
}