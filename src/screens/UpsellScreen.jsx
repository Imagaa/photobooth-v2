import { useStore } from '../store/useStore';
import { useSession } from '../session/context';
import { formatRp } from '../utils/format';

export default function UpsellScreen() {
  const upsell = useStore(s => s.upsell);
  const setUpsell = useStore(s => s.setUpsell);
  const setScreen = useStore(s => s.setScreen);
  const { submitUpsell } = useSession();

  const total = upsell.unitPrice * upsell.qty;

  return (
    <div className="flex flex-col items-center justify-center h-screen p-8 z-10" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="bg-white border-8 border-black w-full max-w-3xl p-10 text-center" style={{ boxShadow: '16px 16px 0 0 var(--color-secondary)' }}>
        <h2 className="font-pixel text-2xl mb-3 whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Mau Cetak Lagi?</h2>
        <p className="font-sys text-2xl font-bold text-gray-600 mb-8">Tambah lembar untuk dibagikan ke teman!</p>

        <div className="flex items-center justify-center gap-8 mb-8">
          <button onClick={() => setUpsell({ ...upsell, qty: Math.max(1, upsell.qty - 1) })} className="bg-white border-8 border-black font-pixel text-3xl w-24 h-24 shadow-[6px_6px_0_0_#000] active:translate-y-1 active:shadow-none text-black">−</button>
          <div className="font-pixel text-6xl w-32 text-black">{upsell.qty}</div>
          <button onClick={() => setUpsell({ ...upsell, qty: Math.min(upsell.maxQty, upsell.qty + 1) })} className="bg-white border-8 border-black font-pixel text-3xl w-24 h-24 shadow-[6px_6px_0_0_#000] active:translate-y-1 active:shadow-none text-black">+</button>
        </div>

        <div className="border-4 border-black p-5 mb-8" style={{ backgroundColor: 'var(--color-secondary)' }}>
          {upsell.unitPrice > 0 ? (
            <>
              <p className="font-sys text-xl font-bold text-black">{upsell.qty} lembar × Rp {formatRp(upsell.unitPrice)}</p>
              <p className="font-pixel text-2xl mt-3 text-black">Rp {formatRp(total)}</p>
            </>
          ) : (
            <p className="font-sys text-2xl font-bold text-black">GRATIS — menunggu persetujuan kasir</p>
          )}
        </div>

        <div className="flex gap-6">
          <button onClick={() => setScreen('result')} className="text-white font-pixel border-4 border-black flex-1 py-5 text-sm shadow-[6px_6px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-accent)' }}>[ BATAL ]</button>
          <button onClick={submitUpsell} className="text-black font-pixel border-4 border-black flex-1 py-5 text-sm shadow-[6px_6px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>[ LANJUT BAYAR ]</button>
        </div>
      </div>
    </div>
  );
}
