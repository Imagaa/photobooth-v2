import { useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { SessionContext } from './context';
import { computeSessionDeadline, sessionDurationMs, retakeMinRemainingMs } from '../utils/session';
import { localUrl } from '../localUrl';

// =========================================================================
// CONTROLLER SESI PELANGGAN
//
// Pemilik tunggal seluruh ref perangkat keras (kamera, canvas, MediaRecorder)
// dan seluruh handler alur pelanggan. Layar-layar memanggilnya lewat context
// sehingga tidak perlu prop drilling, dan — yang lebih penting — handler ini
// TIDAK ikut memicu render ulang karena disimpan di ref/context yang stabil.
//
// Semua handler membaca state lewat useStore.getState() alih-alih menutup
// (closure) nilai render, supaya tidak pernah memakai data basi.
// =========================================================================
export function SessionProvider({ children }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    // Penyimpanan video berjalan asinkron di onstop. Ref ini dipakai agar proses
    // render hasil bisa menunggunya, kalau tidak daftar video terbaca kosong.
    const recordingDoneRef = useRef(null);
    const recordingResolveRef = useRef(null);
    const recordingExtRef = useRef('webm');
    // Object URL preview wajib dicabut manual, kalau tidak blob menumpuk di memori.
    const objectUrlsRef = useRef([]);
    const paymentPollRef = useRef(null);

    const st = () => useStore.getState();

    // ---------------------------------------------------------------------
    // Pembersihan
    // ---------------------------------------------------------------------
    const revokePreviewUrls = () => {
        objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        objectUrlsRef.current = [];
    };

    const stopPaymentPoll = () => {
        if (paymentPollRef.current) {
            clearTimeout(paymentPollRef.current);
            paymentPollRef.current = null;
        }
    };

    const resetSession = () => {
        stopPaymentPoll();
        revokePreviewUrls();
        st().resetCustomerSession();
    };

    // ---------------------------------------------------------------------
    // Kamera & rekaman
    // ---------------------------------------------------------------------
    // preserveDeadline dipakai oleh retake: sesi TIDAK diperpanjang, hanya
    // dijamin punya sisa waktu minimum agar retake bisa diselesaikan (bug B4).
    const startCameraAndTimer = async ({ preserveDeadline = false } = {}) => {
        const store = st();

        store.setSessionExpiresAt(computeSessionDeadline({
            now: Date.now(),
            currentDeadline: store.sessionExpiresAt,
            preserve: preserveDeadline,
            durationMs: sessionDurationMs(store.settings),
            minRemainingMs: retakeMinRemainingMs(store.settings),
        }));
        store.setScreen('camera');
        try {
            const cam = store.settings?.selected_camera;
            const videoConstraints = cam
                ? { deviceId: { exact: cam }, width: 1280, height: 720 }
                : { width: 1280, height: 720 };
            const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (e) {
            console.error('Kamera gagal', e);
            await store.showDialog('[ KAMERA GAGAL ]\nTidak bisa mengakses kamera:\n' + e.message + '\n\nHubungi petugas.');
            store.setScreen('landing');
        }
    };

    // Menghentikan rekaman lalu menunggu file benar-benar tertulis ke disk.
    // Wajib sebelum process-images, karena main membaca daftar video dari folder.
    const stopRecordingAndWait = async () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        } else if (!recordingDoneRef.current && videoRef.current?.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => t.stop());
        }
        if (recordingDoneRef.current) {
            await recordingDoneRef.current;
            recordingDoneRef.current = null;
        }
    };

    const beginRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') return;
        if (!videoRef.current?.srcObject) return;

        const stream = videoRef.current.srcObject;
        recordedChunksRef.current = [];

        // MP4/H.264 didahulukan: file .webm tidak bisa diputar aplikasi Foto
        // bawaan iOS, dan banyak pelanggan memakai iPhone. WebM tetap jadi
        // cadangan bila build Chromium tidak mendukung perekaman MP4.
        const mimeType = [
            'video/mp4;codecs=h264,aac',
            'video/mp4;codecs=h264',
            'video/mp4',
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
        ].find(t => MediaRecorder.isTypeSupported(t)) || '';

        const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
        recordingExtRef.current = ext;

        recordingDoneRef.current = new Promise(resolve => { recordingResolveRef.current = resolve; });

        mediaRecorderRef.current = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorderRef.current.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
        mediaRecorderRef.current.onstop = async () => {
            const blob = new Blob(recordedChunksRef.current, { type: mimeType || 'video/webm' });
            recordedChunksRef.current = [];
            try {
                const arrayBuffer = await blob.arrayBuffer();
                await window.electronAPI.saveVideo({
                    folderPath: st().sessionFolder,
                    buffer: arrayBuffer,
                    ext: recordingExtRef.current,
                });
            } catch (err) {
                console.error('Gagal menyimpan video sesi', err);
            }
            // Kamera baru dimatikan setelah rekaman tersimpan; mematikannya
            // lebih dulu memotong potongan terakhir.
            stream.getTracks().forEach(t => t.stop());
            recordingResolveRef.current?.();
        };
        mediaRecorderRef.current.start();
    };

    const takePhotoAction = async () => {
        const store = st();
        beginRecording();

        const current = [...store.capturedPhotos];
        for (let i = 0; i < current.length; i++) {
            if (current[i] !== null) continue;

            for (let c = 3; c > 0; c--) { st().setCountdown(`[ ${c} ]`); await new Promise(r => setTimeout(r, 1000)); }
            st().setCountdown('[ SNAP! ]');

            const v = videoRef.current, cvs = canvasRef.current;
            if (!v || !cvs) break;
            const ctx = cvs.getContext('2d');
            cvs.width = v.videoWidth; cvs.height = v.videoHeight;
            ctx.drawImage(v, 0, 0, cvs.width, cvs.height);

            // toBlob menghasilkan biner langsung; toDataURL dulu membuat string
            // base64 ~33% lebih besar yang harus melintas IPC dua kali.
            const blob = await new Promise(resolve => cvs.toBlob(resolve, 'image/jpeg', 0.9));
            if (!blob) {
                st().setCountdown(null);
                await st().showDialog('Gagal mengambil gambar dari kamera. Silakan coba lagi.');
                return;
            }

            const res = await window.electronAPI.saveCapture({
                folderPath: st().sessionFolder,
                buffer: await blob.arrayBuffer(),
                index: i + 1,
            });
            if (!res.success) {
                st().setCountdown(null);
                await st().showDialog('Gagal menyimpan foto:\n' + res.error);
                return;
            }

            const previewUrl = URL.createObjectURL(blob);
            objectUrlsRef.current.push(previewUrl);
            current[i] = { previewUrl, filePath: res.filePath };
            st().setCapturedPhotos([...current]);
            await new Promise(r => setTimeout(r, 1000));
        }

        st().setCountdown(null);

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            // Track kamera dimatikan di dalam onstop, setelah rekaman tersimpan.
            mediaRecorderRef.current.stop();
        } else if (videoRef.current?.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => t.stop());
        }

        st().setScreen('review');
    };

    // ---------------------------------------------------------------------
    // Cetak & penyelesaian
    // ---------------------------------------------------------------------
    const triggerPrint = async (sessionId) => {
        if (!sessionId) return;
        st().setPrintStatus({ state: 'printing', message: '[ MENGIRIM KE PRINTER... ]', mode: null });
        try {
            const r = await window.electronAPI.printPhoto({ sessionId });
            // `mode` diteruskan apa adanya ('printer' | 'pdf' | 'skipped') supaya
            // layar hasil yang memilih kalimatnya sendiri. Sebelumnya string
            // `warning` dari main process ditempel langsung ke layar pelanggan,
            // sehingga istilah operator seperti "bypass hardware" ikut terbaca.
            if (r.success) st().setPrintStatus({ state: 'ok', message: r.warning || '[ SEDANG DICETAK ]', mode: r.mode || 'printer' });
            else st().setPrintStatus({ state: 'error', message: r.error || 'Printer tidak merespons.', mode: r.mode || null });
        } catch (e) {
            st().setPrintStatus({ state: 'error', message: e.message, mode: null });
        }
    };

    const finalizeAndPrint = async (res) => {
        const store = st();
        if (!res.success) {
            // Sesi kosong (kehabisan waktu tanpa foto) bukan kegagalan teknis:
            // pembayaran masih berlaku, jadi pelanggan diarahkan mengulang.
            await store.showDialog(res.empty ? res.error : 'Gagal Merender: ' + res.error);
            if (res.empty) {
                revokePreviewUrls();
                store.setScreen('template');
            } else {
                store.setScreen('landing');
            }
            return;
        }
        store.setFinalResult(res);
        store.setScreen('result');
        triggerPrint(res.sessionId);

        window.electronAPI.getUpsellInfo(res.sessionId)
            .then(info => st().setUpsellAvailable(!!info.available))
            .catch(() => st().setUpsellAvailable(false));
    };

    const renderSheet = async () => {
        const store = st();
        store.setSessionExpiresAt(null);
        store.setScreen('loading');
        await stopRecordingAndWait();

        const s = st();
        const res = await window.electronAPI.processImages({
            photoPaths: s.capturedPhotos.map(p => p?.filePath || null),
            templateId: s.customerTemplate.id,
            eventId: s.activeEvent.id,
            customerName: s.customerName,
            paymentId: s.paymentId,
            sessionFolderAbsolute: s.sessionFolder,
        });
        await finalizeAndPrint(res);
    };

    // Dipanggil saat waktu sesi habis. Slot kosong dibiarkan null — main yang
    // mengisinya dengan kotak putih.
    const handleAutoFinish = async () => {
        const screen = st().currentScreen;
        if (screen !== 'camera' && screen !== 'review') return;
        await renderSheet();
    };

    // ---------------------------------------------------------------------
    // Pembayaran
    // ---------------------------------------------------------------------
    // Backoff bertahap: cepat di menit pertama saat pelanggan benar-benar
    // sedang membayar, lalu melambat. Sebelumnya 3 detik konstan sampai
    // transaksi kedaluwarsa — sekitar 600 panggilan API Midtrans per sesi
    // yang tidak diselesaikan.
    const jedaPolling = (mulai) => {
        const berjalan = Date.now() - mulai;
        if (berjalan < 60000) return 3000;
        if (berjalan < 300000) return 6000;
        return 12000;
    };

    const pollPaymentStatus = (id, onPaid) => {
        stopPaymentPoll();
        const mulai = Date.now();

        const tick = async () => {
            if (st().currentScreen !== 'payment') { stopPaymentPoll(); return; }

            const res = await window.electronAPI.getPaymentStatus(id);
            if (res.status === 'paid') {
                stopPaymentPoll();
                st().setStatusText('[ LUNAS! ]');
                setTimeout(() => { st().setWaitingForPayment(false); onPaid(); }, 1200);
                return;
            }
            if (res.status === 'failed' || res.status === 'expired') {
                stopPaymentPoll();
                st().setStatusText('[ GAGAL ]');
                const kembali = st().nextScreenAfterPayment === 'upsell' ? 'result' : 'landing';
                await st().showDialog('Pembayaran gagal atau kedaluwarsa.\n' + (res.error || 'Silakan ulangi dari awal.'));
                st().setWaitingForPayment(false);
                st().setScreen(kembali);
                return;
            }
            paymentPollRef.current = setTimeout(tick, jedaPolling(mulai));
        };

        paymentPollRef.current = setTimeout(tick, 3000);
    };

    const startCustomerPhoto = async (tpl) => {
        const store = st();
        const slotsArr = typeof tpl.slots === 'string' ? JSON.parse(tpl.slots) : (tpl.slots || []);
        if (!slotsArr.length) {
            await store.showDialog('[ TEMPLATE ERROR ]\nFrame ini tidak memiliki slot foto. Admin belum mengatur koordinat slot untuk template ini.', 'alert');
            return;
        }

        store.setCustomerTemplate(tpl);
        store.setCapturedPhotos(Array(slotsArr.length).fill(null));

        // Retake tetap lewat begin-payment supaya main yang menetapkan harganya
        // nol dan menautkannya ke transaksi asli.
        if (store.isRemoteRetake) {
            const pay = await window.electronAPI.beginPayment({
                eventId: store.activeEvent.id,
                templateId: tpl.id,
                customerName: store.customerName,
            });
            if (!pay.success) {
                await store.showDialog('Gagal memulai retake:\n' + pay.error);
                return;
            }
            store.setPaymentId(pay.paymentId);
            const folder = await window.electronAPI.startCustomerSession({ eventId: store.activeEvent.id, customerName: store.customerName });
            store.setSessionFolder(folder);
            store.setIsRemoteRetake(false);
            await startCameraAndTimer();
            return;
        }

        store.setScreen('input_name');
    };

    const submitNameAndPay = async () => {
        const store = st();
        if (!store.customerName) return await store.showDialog('Nama wajib diisi sebelum melanjutkan!');

        store.setStatusText('[ MEMBUKA TRANSAKSI... ]');
        const pay = await window.electronAPI.beginPayment({
            eventId: store.activeEvent.id,
            templateId: store.customerTemplate.id,
            customerName: store.customerName,
        });

        if (!pay.success) {
            await store.showDialog('Gagal membuka transaksi:\n' + pay.error);
            store.setScreen('template');
            return;
        }

        store.setPaymentId(pay.paymentId);
        const folder = await window.electronAPI.startCustomerSession({ eventId: store.activeEvent.id, customerName: store.customerName });
        store.setSessionFolder(folder);

        if (pay.status === 'paid') { await startCameraAndTimer(); return; }

        store.setupPayment(pay.price, 'camera');
        if (pay.method === 'manual') {
            store.setQrUrl(pay.staticQrPath ? localUrl(`/qr/${pay.staticQrPath}`) : null);
            store.setStatusText('[ MENUNGGU KASIR ]');
        } else {
            store.setQrUrl(pay.qrUrl);
            store.setStatusText('[ MENUNGGU PEMBAYARAN... ]');
        }
        pollPaymentStatus(pay.paymentId, startCameraAndTimer);
    };

    // ---------------------------------------------------------------------
    // Cetak tambahan (upsell)
    // ---------------------------------------------------------------------
    const openUpsell = async () => {
        const store = st();
        const info = await window.electronAPI.getUpsellInfo(store.finalResult?.sessionId);
        if (!info.available) return;
        store.setUpsell({ qty: 1, unitPrice: info.unitPrice, maxQty: info.maxQty });
        store.setScreen('upsell');
    };

    const submitUpsell = async () => {
        const store = st();
        store.setStatusText('[ MEMBUKA TRANSAKSI... ]');
        const pay = await window.electronAPI.beginUpsellPayment({
            sessionId: store.finalResult.sessionId,
            qty: store.upsell.qty,
        });
        if (!pay.success) {
            await store.showDialog('Gagal membuka transaksi:\n' + pay.error);
            store.setScreen('result');
            return;
        }

        store.setPaymentId(pay.paymentId);
        store.setupPayment(pay.price, 'upsell');
        if (pay.method === 'manual') {
            store.setQrUrl(pay.staticQrPath ? localUrl(`/qr/${pay.staticQrPath}`) : null);
            store.setStatusText(pay.price > 0 ? '[ MENUNGGU KASIR ]' : '[ MENUNGGU PERSETUJUAN KASIR ]');
        } else {
            store.setQrUrl(pay.qrUrl);
            store.setStatusText('[ MENUNGGU PEMBAYARAN... ]');
        }
        pollPaymentStatus(pay.paymentId, () => finishUpsell(pay.paymentId));
    };

    const finishUpsell = async (id) => {
        const store = st();
        const qty = store.upsell.qty;
        store.setScreen('result');
        store.setPrintStatus({ state: 'printing', message: '[ MENCETAK TAMBAHAN... ]', mode: null });

        const res = await window.electronAPI.confirmUpsell({ paymentId: id });
        if (res.success) st().setPrintStatus({ state: 'ok', message: res.warning || `[ ${qty} LEMBAR TAMBAHAN DICETAK ]`, mode: res.mode || 'printer' });
        else st().setPrintStatus({ state: 'error', message: res.error || 'Gagal mencetak lembar tambahan.', mode: res.mode || null });
    };

    // Retake satu slot dari layar review.
    const retakeSlot = async (index) => {
        const store = st();
        const next = [...store.capturedPhotos];
        next[index] = null;
        store.setCapturedPhotos(next);
        store.decrementRetake();
        await startCameraAndTimer({ preserveDeadline: true });
    };

    // Bersih-bersih saat aplikasi ditutup.
    useEffect(() => () => { stopPaymentPoll(); revokePreviewUrls(); }, []);

    const value = {
        videoRef, canvasRef,
        revokePreviewUrls, resetSession, stopPaymentPoll,
        startCameraAndTimer, takePhotoAction, stopRecordingAndWait,
        triggerPrint, renderSheet, handleAutoFinish,
        startCustomerPhoto, submitNameAndPay,
        openUpsell, submitUpsell, retakeSlot,
    };

    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
