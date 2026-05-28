import { create } from 'zustand';

export const useStore = create((set) => ({
    settings: null, templates: [], serverIP: null,
    activeEvent: null, recentEvents: [],
    currentScreen: 'loading', sessionFolder: null, capturedPhotos: [], retakesLeft: 3, paymentAmount: 0, nextScreenAfterPayment: 'camera', 
    
    // STATE HARDWARE & KASIR BARU
    isHardwareReady: false,
    waitingForPayment: false,
    setHardwareReady: (status) => set({ isHardwareReady: status }),
    setWaitingForPayment: (status) => set({ waitingForPayment: status }),

    setScreen: (screen) => set({ currentScreen: screen }),
    setSessionFolder: (path) => set({ sessionFolder: path }),
    setCapturedPhotos: (photos) => set({ capturedPhotos: photos }),
    decrementRetake: () => set((state) => ({ retakesLeft: Math.max(0, state.retakesLeft - 1) })),
    
    resetCustomerSession: () => set({ capturedPhotos: [], retakesLeft: 3, sessionFolder: null, waitingForPayment: false }),
    setupPayment: (amount, next) => set({ paymentAmount: amount, nextScreenAfterPayment: next, currentScreen: 'payment', waitingForPayment: true }),
    
    fetchSettings: async () => { if (window.electronAPI) set({ settings: await window.electronAPI.getSettings() }); },
    fetchTemplates: async () => { if (window.electronAPI) set({ templates: await window.electronAPI.getTemplates() || [] }); },
    fetchServerIP: async () => { if (window.electronAPI) set({ serverIP: await window.electronAPI.getServerIP() }); },
    fetchRecentEvents: async () => { if (window.electronAPI) set({ recentEvents: await window.electronAPI.getRecentEvents() || [] }); },
    
    fetchActiveEvent: async () => {
        if (window.electronAPI) {
            try {
                const event = await window.electronAPI.getActiveEvent();
                set({ activeEvent: event, currentScreen: event ? 'landing' : 'session_manager' });
            } catch (e) {
                set({ activeEvent: null, currentScreen: 'session_manager' });
            }
        }
    }
}));