import { create } from 'zustand';

// =========================================================================
// STORE APLIKASI
//
// Seluruh state alur pelanggan tinggal di sini supaya tiap layar bisa
// berlangganan hanya pada potongan yang ia pakai lewat selector. Sebelumnya
// App.jsx memanggil useStore() tanpa selector, sehingga satu perubahan state
// apa pun me-render ulang seluruh aplikasi — termasuk elemen video kamera
// dan preview komposit.
//
// Aturan pakai: SELALU pakai selector, mis. useStore(s => s.currentScreen).
// Untuk beberapa nilai sekaligus gunakan useShallow.
// =========================================================================
export const useStore = create((set) => ({
    // ==========================================
    // 1. DATA GLOBAL & KONFIGURASI
    // ==========================================
    settings: null,
    templates: [],
    serverIP: null,
    activeEvent: null,
    recentEvents: [],

    // ==========================================
    // 2. STATE CUSTOMER FLOW & NAVIGASI
    // ==========================================
    currentScreen: 'loading',
    sessionFolder: null,
    capturedPhotos: [],
    retakesLeft: 3,
    paymentAmount: 0,
    nextScreenAfterPayment: 'camera',

    // Detail sesi pelanggan yang berjalan
    customerTab: 'portrait',
    customerTemplate: null,
    customerName: '',
    finalResult: null,
    paymentId: null,
    qrUrl: null,
    statusText: '',
    countdown: null,
    // `mode` diisi main process: 'printer' | 'pdf' | 'skipped'. Layar hasil
    // memakainya untuk membedakan sesi digital-only dari cetak fisik.
    printStatus: { state: 'idle', message: '', mode: null },
    sessionExpiresAt: null,
    timeLeftDisplay: 0,
    isRemoteRetake: false,

    // Cetak tambahan
    upsell: { qty: 1, unitPrice: 0, maxQty: 10 },
    upsellAvailable: false,

    // ==========================================
    // 3. STATE HARDWARE & KASIR
    // ==========================================
    // Gerbang kiosk: akun Drive harus sudah tertaut sebelum sesi boleh dimulai.
    // Ini status konfigurasi, bukan status koneksi internet.
    isDriveLinked: false,
    setDriveLinked: (status) => set({ isDriveLinked: status }),

    isHardwareReady: false,
    waitingForPayment: false,
    setHardwareReady: (status) => set({ isHardwareReady: status }),
    setWaitingForPayment: (status) => set({ waitingForPayment: status }),

    // ==========================================
    // 4. RETRO DIALOG ENGINE
    // ==========================================
    dialog: { isOpen: false, message: '', type: 'alert', resolve: null },
    showDialog: (message, type = 'alert') => new Promise((resolve) => {
        set((state) => {
            // Dialog yang tertimpa harus tetap menyelesaikan promise-nya, kalau
            // tidak pemanggil menggantung selamanya (bug B14).
            if (state.dialog.isOpen && state.dialog.resolve) state.dialog.resolve(false);
            return { dialog: { isOpen: true, message, type, resolve } };
        });
    }),
    closeDialog: (result) => set((state) => {
        if (state.dialog.resolve) state.dialog.resolve(result);
        return { dialog: { isOpen: false, message: '', type: 'alert', resolve: null } };
    }),

    // ==========================================
    // 5. FUNGSI MANIPULASI STATE
    // ==========================================
    setScreen: (screen) => set({ currentScreen: screen }),
    setSessionFolder: (path) => set({ sessionFolder: path }),
    setCapturedPhotos: (photos) => set({ capturedPhotos: photos }),
    decrementRetake: () => set((state) => ({ retakesLeft: Math.max(0, state.retakesLeft - 1) })),

    setCustomerTab: (tab) => set({ customerTab: tab }),
    setCustomerTemplate: (tpl) => set({ customerTemplate: tpl }),
    setCustomerName: (name) => set({ customerName: name }),
    setFinalResult: (res) => set({ finalResult: res }),
    setPaymentId: (id) => set({ paymentId: id }),
    setQrUrl: (url) => set({ qrUrl: url }),
    setStatusText: (text) => set({ statusText: text }),
    setCountdown: (value) => set({ countdown: value }),
    setPrintStatus: (status) => set({ printStatus: status }),
    setSessionExpiresAt: (ts) => set({ sessionExpiresAt: ts }),
    setTimeLeftDisplay: (secs) => set({ timeLeftDisplay: secs }),
    setIsRemoteRetake: (flag) => set({ isRemoteRetake: flag }),
    setUpsell: (upsell) => set({ upsell }),
    setUpsellAvailable: (flag) => set({ upsellAvailable: flag }),

    resetCustomerSession: () => set({
        capturedPhotos: [],
        retakesLeft: 3,
        sessionFolder: null,
        waitingForPayment: false,
        customerName: '',
        customerTemplate: null,
        finalResult: null,
        paymentId: null,
        qrUrl: null,
        statusText: '',
        countdown: null,
        printStatus: { state: 'idle', message: '', mode: null },
        sessionExpiresAt: null,
        timeLeftDisplay: 0,
        upsellAvailable: false,
        upsell: { qty: 1, unitPrice: 0, maxQty: 10 },
    }),

    setupPayment: (amount, next) => set({
        paymentAmount: amount,
        nextScreenAfterPayment: next,
        currentScreen: 'payment',
        waitingForPayment: true,
    }),

    // ==========================================
    // 6. FETCHER API DARI BACKEND ELECTRON
    // ==========================================
    fetchSettings: async () => {
        if (window.electronAPI) set({ settings: await window.electronAPI.getSettings() });
    },
    fetchTemplates: async () => {
        if (window.electronAPI) set({ templates: await window.electronAPI.getTemplates() || [] });
    },
    fetchServerIP: async () => {
        if (window.electronAPI) set({ serverIP: await window.electronAPI.getServerIP() });
    },
    fetchRecentEvents: async () => {
        if (window.electronAPI) set({ recentEvents: await window.electronAPI.getRecentEvents() || [] });
    },
    fetchActiveEvent: async () => {
        if (window.electronAPI) {
            try {
                const event = await window.electronAPI.getActiveEvent();
                // Auto routing: ada event aktif -> Kiosk, tidak ada -> Manajemen Sesi.
                set({ activeEvent: event, currentScreen: event ? 'landing' : 'session_manager' });
            } catch {
                set({ activeEvent: null, currentScreen: 'session_manager' });
            }
        }
    },
}));
