// Preload tiruan: menggantikan electronAPI sungguhan dengan boneka, lalu
// membuka kanal __uji supaya harness bisa memicu event "dari HP kasir" dan
// mengintip apa yang terjadi di renderer.
const { contextBridge } = require('electron');

const cb = {};
const dipanggil = [];
const daftar = (nama) => (fn) => { cb[nama] = fn; };
const catat = (nama, hasil) => (...args) => { dipanggil.push({ nama, args }); return Promise.resolve(hasil); };

const settings = {
    active_theme: 'candy', app_mode: 'offline', hpp_kertas: 3000, hpp_tinta: 2000,
    biaya_ops: 0, print_enabled: 1, print_copies: 1, session_minutes: 10,
    retake_min_seconds: 90, consent_enabled: 1, retention_days: 0,
    thanks_enabled: 1, thanks_seconds: 3, thanks_message: '', osk_enabled: 0,
    midtrans_client_key: '', static_qr_path: '', force_static_qr: 0,
    selected_camera: '', selected_printer: '', hw_bypass_mode: 1,
    download_ttl_hours: 24, server_ip_override: '', gdrive_folder_id: '',
};
const eventAktif = { id: 1, nama_event: 'Pesta Ultah Budi', folder_name: '2026-07-28_Pesta', saldo_awal: 0, is_active: 1, templates_json: '[]', upsell_enabled: 0, upsell_price: 0 };

contextBridge.exposeInMainWorld('electronAPI', {
    ping: catat('ping', 'pong'),
    getSettings: catat('getSettings', settings),
    saveSettings: (data) => { dipanggil.push({ nama: 'saveSettings', args: [data] }); Object.assign(settings, data); return Promise.resolve({ success: true }); },
    getServerIP: catat('getServerIP', '192.168.1.2'),
    listNetworkInterfaces: catat('listNetworkInterfaces', { current: '192.168.1.2', interfaces: [] }),
    verifyAdminPin: catat('verifyAdminPin', { success: true }),
    isAdminPinDefault: catat('isAdminPinDefault', false),
    setAdminPin: catat('setAdminPin', { success: true }),
    checkHardware: catat('checkHardware', { printers: ['Printer Uji'] }),
    selectStaticQR: catat('selectStaticQR', null),
    getActiveEvent: catat('getActiveEvent', eventAktif),
    getRecentEvents: catat('getRecentEvents', []),
    reopenEvent: catat('reopenEvent', {}), createEvent: catat('createEvent', {}),
    closeEvent: catat('closeEvent', {}), deleteEvent: catat('deleteEvent', {}),
    getDashboardData: catat('getDashboardData', { sessions: [], localPath: '', adminQr: '', gdriveLink: '', upsell: { enabled: false, price: 0 }, queue: {} }),
    exportEventReport: catat('exportEventReport', {}), rotateCashierToken: catat('rotateCashierToken', {}),
    getTemplates: catat('getTemplates', []),
    openFileDialog: catat('openFileDialog', null), saveNewTemplate: catat('saveNewTemplate', {}),
    updateTemplate: catat('updateTemplate', {}), deleteTemplate: catat('deleteTemplate', {}),
    beginPayment: catat('beginPayment', {}), getPaymentStatus: catat('getPaymentStatus', {}),
    cancelPayment: catat('cancelPayment', {}),
    recordConsent: catat('recordConsent', {}), runPurgeNow: catat('runPurgeNow', {}),
    getUpsellInfo: catat('getUpsellInfo', {}), beginUpsellPayment: catat('beginUpsellPayment', {}),
    confirmUpsell: catat('confirmUpsell', {}), updateEventUpsell: catat('updateEventUpsell', {}),
    gdriveStatus: catat('gdriveStatus', { connected: true, queue: {}, clientId: '' }),
    gdriveSaveCredentials: catat('gdriveSaveCredentials', {}), gdriveConnect: catat('gdriveConnect', {}),
    gdriveDisconnect: catat('gdriveDisconnect', {}), gdriveRetryFailed: catat('gdriveRetryFailed', {}),
    gdriveUploadNow: catat('gdriveUploadNow', {}), gdriveQueueStats: catat('gdriveQueueStats', {}),
    gdriveIsLinked: catat('gdriveIsLinked', true),
    startCustomerSession: catat('startCustomerSession', {}), saveCapture: catat('saveCapture', {}),
    processImages: catat('processImages', {}), printPhoto: catat('printPhoto', {}),
    saveVideo: catat('saveVideo', {}),

    onRemoteVerify: daftar('verify'), onRemoteClose: daftar('close'),
    onRemoteRestart: daftar('restart'), onRemoteRetake: daftar('retake'),
    onRemoteReprint: daftar('reprint'), onGdriveAuthResult: daftar('gdriveAuth'),
    onRemotePanel: daftar('panel'), onRemoteTheme: daftar('tema'),
});

contextBridge.exposeInMainWorld('__uji', {
    // Meniru main process yang mengirim event ke renderer.
    picu: (nama, arg) => { if (!cb[nama]) throw new Error('callback belum terdaftar: ' + nama); cb[nama](arg); },
    terdaftar: () => Object.keys(cb),
    panggilan: () => dipanggil.map((d) => d.nama),
    panggilanTerakhir: (nama) => { const f = dipanggil.filter((d) => d.nama === nama); return f.length ? f[f.length - 1].args : null; },
    tema: () => settings.active_theme,
    setting: (k) => settings[k],
});
