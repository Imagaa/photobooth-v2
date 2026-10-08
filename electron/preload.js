const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    ping: (message) => ipcRenderer.invoke('ping', message),
    
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
    getServerIP: () => ipcRenderer.invoke('get-server-ip'),
    // Versi sinkron dipakai renderer untuk membangun URL aset
    // (template, QR statis) langsung di dalam JSX. Nilai ini sudah final
    // saat preload pertama kali dipanggil, karena server lokal menyala
    // sebelum jendela dibuat.
    getServerPort: () => ipcRenderer.sendSync('get-server-port'),
    listNetworkInterfaces: () => ipcRenderer.invoke('list-network-interfaces'),
    
    // Gerbang PIN untuk panel admin
    verifyAdminPin: (pin) => ipcRenderer.invoke('verify-admin-pin', pin),
    isAdminPinDefault: () => ipcRenderer.invoke('is-admin-pin-default'),
    setAdminPin: (data) => ipcRenderer.invoke('set-admin-pin', data),

    checkHardware: () => ipcRenderer.invoke('check-hardware'),
    selectStaticQR: () => ipcRenderer.invoke('select-static-qr'),
    
    // Sinyal dari HP Kasir ke Kiosk (React)
    onRemoteVerify: (callback) => ipcRenderer.on('remote-verify', () => callback()),
    onRemoteClose: (callback) => ipcRenderer.on('remote-close', () => callback()),
    onRemoteRestart: (callback) => ipcRenderer.on('remote-restart', () => callback()),
    onRemoteRetake: (callback) => ipcRenderer.on('remote-retake', (e, data) => callback(data)),
    onRemoteReprint: (callback) => ipcRenderer.on('remote-reprint', (e, data) => callback(data)),
    // Kiosk layar sentuh tidak punya keyboard, jadi Ctrl+Shift+P/T/D dan
    // Ctrl+Panah hanya terjangkau lewat HP kasir.
    onRemotePanel: (callback) => ipcRenderer.on('remote-panel', (e, which) => callback(which)),
    onRemoteTheme: (callback) => ipcRenderer.on('remote-theme', (e, arah) => callback(arah)),
    
    // Otorisasi pembayaran dipegang main process; renderer hanya membuka
    // transaksi lalu menanyakan statusnya.
    beginPayment: (data) => ipcRenderer.invoke('begin-payment', data),
    getPaymentStatus: (paymentId) => ipcRenderer.invoke('get-payment-status', paymentId),
    cancelPayment: () => ipcRenderer.invoke('cancel-payment'),

    // Kepatuhan data pribadi
    recordConsent: () => ipcRenderer.invoke('record-consent'),
    runPurgeNow: (opts) => ipcRenderer.invoke('run-purge-now', opts),

    // Cetak tambahan (upsell)
    getUpsellInfo: (sessionId) => ipcRenderer.invoke('get-upsell-info', sessionId),
    beginUpsellPayment: (data) => ipcRenderer.invoke('begin-upsell-payment', data),
    confirmUpsell: (data) => ipcRenderer.invoke('confirm-upsell', data),
    updateEventUpsell: (data) => ipcRenderer.invoke('update-event-upsell', data),

    getActiveEvent: () => ipcRenderer.invoke('get-active-event'),
    getRecentEvents: () => ipcRenderer.invoke('get-recent-events'),
    reopenEvent: (eventId) => ipcRenderer.invoke('reopen-event', eventId),
    createEvent: (data) => ipcRenderer.invoke('create-event', data),
    closeEvent: (eventId) => ipcRenderer.invoke('close-event', eventId),
    
    // Menghapus data SQLite & Folder Fisik
    deleteEvent: (data) => ipcRenderer.invoke('delete-event', data),
    
    getDashboardData: (eventId) => ipcRenderer.invoke('get-dashboard-data', eventId),
    exportEventReport: (eventId) => ipcRenderer.invoke('export-event-report', eventId),
    rotateCashierToken: () => ipcRenderer.invoke('rotate-cashier-token'),

    // Google Drive
    gdriveStatus: () => ipcRenderer.invoke('gdrive-status'),
    gdriveSaveCredentials: (data) => ipcRenderer.invoke('gdrive-save-credentials', data),
    gdriveConnect: () => ipcRenderer.invoke('gdrive-connect'),
    gdriveDisconnect: () => ipcRenderer.invoke('gdrive-disconnect'),
    gdriveRetryFailed: (eventId) => ipcRenderer.invoke('gdrive-retry-failed', eventId),
    gdriveUploadNow: (eventId) => ipcRenderer.invoke('gdrive-upload-now', eventId),
    gdriveQueueStats: (eventId) => ipcRenderer.invoke('gdrive-queue-stats', eventId),
    gdriveIsLinked: () => ipcRenderer.invoke('gdrive-is-linked'),
    onGdriveAuthResult: (cb) => ipcRenderer.on('gdrive-auth-result', (e, data) => cb(data)),

    getTemplates: () => ipcRenderer.invoke('get-templates'),
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    saveNewTemplate: (data) => ipcRenderer.invoke('save-new-template', data),
    updateTemplate: (data) => ipcRenderer.invoke('update-template', data),
    deleteTemplate: (id) => ipcRenderer.invoke('delete-template', id),

    startCustomerSession: (data) => ipcRenderer.invoke('start-customer-session', data),
    saveCapture: (data) => ipcRenderer.invoke('save-capture', data),
    processImages: (data) => ipcRenderer.invoke('process-images', data),
    printPhoto: (data) => ipcRenderer.invoke('print-photo', data),
    saveVideo: (data) => ipcRenderer.invoke('save-video', data)
});