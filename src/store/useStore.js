import { create } from 'zustand';

export const useStore = create((set) => ({
    settings: null, templates: [], serverIP: null,
    activeEvent: null, recentEvents: [],
    currentScreen: 'loading', sessionFolder: null, capturedPhotos: [], retakesLeft: 3, paymentAmount: 0, nextScreenAfterPayment: 'camera', 
    
    // [BARU] State untuk Hardware Blocker & Antrean Kasir
    isHardwareReady: false,
    waitingForPayment: false,
    setHardwareReady: (status) => set({ isHardwareReady: status }),
    setWaitingForPayment: (status) => set({ waitingForPayment: status }),

    setScreen: (screen) => set({ currentScreen: screen }),
    setSessionFolder: (path) => set({ sessionFolder: path }),
    setCapturedPhotos: (photos) => set({ capturedPhotos: photos }),
    decrementRetake: () => set((state) => ({ retakesLeft: Math.max(0, state.retakesLeft - 1) })),
    
    // [REVISI] Reset waitingForPayment saat sesi direset
    resetCustomerSession: () => set({ capturedPhotos: [], retakesLeft: 3, sessionFolder: null, waitingForPayment: false }),
    
    // [REVISI] Set waitingForPayment true saat masuk layar pembayaran
    setupPayment: (amount, next) => set({ paymentAmount: amount, nextScreenAfterPayment: next, currentScreen: 'payment', waitingForPayment: true }),
    
    fetchSettings: async () => { if (window.electronAPI) set({ settings: await window.electronAPI.getSettings() }); },
    fetchTemplates: async () => { if (window.electronAPI) set({ templates: await window.electronAPI.getTemplates() || [] }); },
    fetchServerIP: async () => { if (window.electronAPI) set({ serverIP: await window.electronAPI.getServerIP() }); },
    
    // [BARU] Fetch riwayat event
    fetchRecentEvents: async () => {
        if (window.electronAPI) set({ recentEvents: await window.electronAPI.getRecentEvents() || [] });
    },

    fetchActiveEvent: async () => {
        if (window.electronAPI) {
            const event = await window.electronAPI.getActiveEvent();
            if (event) {
                set({ activeEvent: event, currentScreen: 'landing' });
            } else {
                set({ activeEvent: null, currentScreen: 'session_manager' });
            }
        }
    }
}));