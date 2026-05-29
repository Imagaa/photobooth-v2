import { create } from 'zustand';

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
    
    // ==========================================
    // 3. STATE HARDWARE & KASIR (Fase 2 & 3)
    // ==========================================
    isHardwareReady: false,
    waitingForPayment: false,
    setHardwareReady: (status) => set({ isHardwareReady: status }),
    setWaitingForPayment: (status) => set({ waitingForPayment: status }),

    // ==========================================
    // 4. RETRO DIALOG ENGINE
    // ==========================================
    dialog: { isOpen: false, message: '', type: 'alert', resolve: null },
    showDialog: (message, type = 'alert') => new Promise((resolve) => {
        set({ dialog: { isOpen: true, message, type, resolve } });
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
    
    // [REVISI]: Memastikan folder memori terhapus mutlak saat sesi batal/selesai
    resetCustomerSession: () => set({ 
        capturedPhotos: [], 
        retakesLeft: 3, 
        sessionFolder: null, 
        waitingForPayment: false 
    }),
    
    setupPayment: (amount, next) => set({ 
        paymentAmount: amount, 
        nextScreenAfterPayment: next, 
        currentScreen: 'payment', 
        waitingForPayment: true 
    }),
    
    // ==========================================
    // 6. FETCHER API DARI BACKEND ELECTRON
    // ==========================================
    fetchSettings: async () => { 
        if (window.electronAPI) {
            const data = await window.electronAPI.getSettings();
            set({ settings: data });
        }
    },
    fetchTemplates: async () => { 
        if (window.electronAPI) {
            set({ templates: await window.electronAPI.getTemplates() || [] }); 
        }
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
                // Auto routing: Jika ada event aktif, masuk ke Kiosk. Jika tidak, paksa ke Dashboard Sesi.
                set({ activeEvent: event, currentScreen: event ? 'landing' : 'session_manager' });
            } catch (e) {
                set({ activeEvent: null, currentScreen: 'session_manager' });
            }
        }
    }
}));