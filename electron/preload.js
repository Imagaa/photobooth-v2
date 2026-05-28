const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    ping: (message) => ipcRenderer.invoke('ping', message),
    
    // --- GLOBAL SETTINGS ---
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
    getServerIP: () => ipcRenderer.invoke('get-server-ip'), 
    
    // [BARU] Hardware, File Picker, & Listener HP Admin
    checkHardware: () => ipcRenderer.invoke('check-hardware'),
    selectStaticQR: () => ipcRenderer.invoke('select-static-qr'),
    onRemoteVerify: (callback) => ipcRenderer.on('remote-verify', () => callback()),
    onRemoteClose: (callback) => ipcRenderer.on('remote-close', () => callback()),
    onRemoteRestart: (callback) => ipcRenderer.on('remote-restart', () => callback()),
    removeRemoteListeners: () => {
        ipcRenderer.removeAllListeners('remote-verify');
        ipcRenderer.removeAllListeners('remote-close');
        ipcRenderer.removeAllListeners('remote-restart');
    },
    
    // --- EVENT SESSION MANAGEMENT ---
    getActiveEvent: () => ipcRenderer.invoke('get-active-event'),
    getRecentEvents: () => ipcRenderer.invoke('get-recent-events'), 
    reopenEvent: (eventId) => ipcRenderer.invoke('reopen-event', eventId), 
    createEvent: (data) => ipcRenderer.invoke('create-event', data),
    closeEvent: (eventId) => ipcRenderer.invoke('close-event', eventId),

    // --- Menarik data untuk Dashboard Kasir (Ctrl+Shift+D) ---
    getDashboardData: (eventId) => ipcRenderer.invoke('get-dashboard-data', eventId),

    // --- MASTER TEMPLATES ---
    getTemplates: () => ipcRenderer.invoke('get-templates'),
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    saveNewTemplate: (data) => ipcRenderer.invoke('save-new-template', data),
    updateTemplate: (data) => ipcRenderer.invoke('update-template', data),
    deleteTemplate: (id) => ipcRenderer.invoke('delete-template', id),

    // --- TRANSAKSI & CAPTURE ---
    startCustomerSession: (eventId) => ipcRenderer.invoke('start-customer-session', eventId),
    saveCapture: (data) => ipcRenderer.invoke('save-capture', data),
    processImages: (data) => ipcRenderer.invoke('process-images', data),
    
    // --- PEMBAYARAN MIDTRANS ---
    createQris: (amount) => ipcRenderer.invoke('create-qris', amount),
    checkPayment: (orderId) => ipcRenderer.invoke('check-payment', orderId),

    // --- Listener untuk Remote Kasir (HP Admin)
    onManualVerify: (callback) => ipcRenderer.on('manual-verify-trigger', () => callback()),
    offManualVerify: () => ipcRenderer.removeAllListeners('manual-verify-trigger'),
});