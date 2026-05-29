const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    ping: (message) => ipcRenderer.invoke('ping', message),
    
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
    getServerIP: () => ipcRenderer.invoke('get-server-ip'), 
    
    checkHardware: () => ipcRenderer.invoke('check-hardware'),
    selectStaticQR: () => ipcRenderer.invoke('select-static-qr'),
    
    // Sinyal dari HP Kasir ke Kiosk (React)
    onRemoteVerify: (callback) => ipcRenderer.on('remote-verify', () => callback()),
    onRemoteClose: (callback) => ipcRenderer.on('remote-close', () => callback()),
    onRemoteRestart: (callback) => ipcRenderer.on('remote-restart', () => callback()),
    onRemoteRetake: (callback) => ipcRenderer.on('remote-retake', (e, data) => callback(data)),
    onRemoteReprint: (callback) => ipcRenderer.on('remote-reprint', (e, data) => callback(data)),
    
    setPendingPayment: (data) => ipcRenderer.invoke('set-pending-payment', data),
    clearPendingPayment: () => ipcRenderer.invoke('clear-pending-payment'),

    getActiveEvent: () => ipcRenderer.invoke('get-active-event'),
    getRecentEvents: () => ipcRenderer.invoke('get-recent-events'),
    reopenEvent: (eventId) => ipcRenderer.invoke('reopen-event', eventId),
    createEvent: (data) => ipcRenderer.invoke('create-event', data),
    closeEvent: (eventId) => ipcRenderer.invoke('close-event', eventId),
    
    // Menghapus data SQLite & Folder Fisik
    deleteEvent: (data) => ipcRenderer.invoke('delete-event', data),
    
    getDashboardData: (eventId) => ipcRenderer.invoke('get-dashboard-data', eventId),

    getTemplates: () => ipcRenderer.invoke('get-templates'),
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    saveNewTemplate: (data) => ipcRenderer.invoke('save-new-template', data),
    updateTemplate: (data) => ipcRenderer.invoke('update-template', data),
    deleteTemplate: (id) => ipcRenderer.invoke('delete-template', id),

    startCustomerSession: (data) => ipcRenderer.invoke('start-customer-session', data),
    saveCapture: (data) => ipcRenderer.invoke('save-capture', data),
    processImages: (data) => ipcRenderer.invoke('process-images', data),
    saveVideo: (data) => ipcRenderer.invoke('save-video', data),
    
    createQris: (amount) => ipcRenderer.invoke('create-qris', amount),
    checkPayment: (orderId) => ipcRenderer.invoke('check-payment', orderId)
});