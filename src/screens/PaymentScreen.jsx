import { useStore } from '../store/useStore';

export default function PaymentScreen() {
  const paymentAmount = useStore(s => s.paymentAmount);
  const qrUrl = useStore(s => s.qrUrl);
  const statusText = useStore(s => s.statusText);

  const gratis = paymentAmount <= 0;

  return (
    <div className="flex flex-col items-center justify-center h-screen z-10" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="bg-white border-8 border-black w-[500px] p-10 text-center" style={{ boxShadow: '16px 16px 0 0 var(--color-secondary)' }}>
        <h2 className="font-pixel text-xl mb-4 whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>{gratis ? 'Konfirmasi Petugas' : 'Scan QRIS'}</h2>
        <div className="font-sys text-6xl font-bold mb-8" style={{ color: 'var(--color-accent)' }}>{gratis ? 'GRATIS' : `Rp ${paymentAmount.toLocaleString('id-ID')}`}</div>

        {gratis ? (
          <div className="w-[320px] h-[320px] mx-auto border-8 border-black flex items-center justify-center bg-gray-100 mb-8 p-8">
            <p className="font-sys text-2xl font-bold text-gray-600 leading-tight">Silakan tunggu,<br/>petugas sedang<br/>memproses permintaanmu.</p>
          </div>
        ) : (
          <div className="w-[320px] h-[320px] mx-auto border-8 border-black flex items-center justify-center bg-gray-100 mb-8">
            {qrUrl ? <img src={qrUrl} className="w-[90%] h-[90%] object-contain" /> : <div className="animate-spin text-4xl">⏳</div>}
          </div>
        )}

        <div className="font-sys text-xl font-bold text-black p-3 border-4 border-black whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>{statusText}</div>
      </div>
    </div>
  );
}
