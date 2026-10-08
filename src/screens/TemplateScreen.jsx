import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useSession } from '../session/context';
import AreaGeser from '../components/AreaGeser';
import { localUrl } from '../localUrl';

function parseTemplates(json) {
  try { return JSON.parse(json || '[]'); }
  catch { return []; }
}

export default function TemplateScreen() {
  const activeEvent = useStore(s => s.activeEvent);
  const customerTab = useStore(s => s.customerTab);
  const setCustomerTab = useStore(s => s.setCustomerTab);
  const setScreen = useStore(s => s.setScreen);
  const { startCustomerPhoto } = useSession();

  // Dulu JSON.parse dijalankan tanpa try/catch, sehingga templates_json yang
  // rusak membuat layar ini crash total.
  const eventTemplates = parseTemplates(activeEvent?.templates_json);

  const hasPortrait = eventTemplates.some(t => t.orientation !== 'landscape');
  const hasLandscape = eventTemplates.some(t => t.orientation === 'landscape');

  // Koreksi tab dilakukan di effect. Sebelumnya setState dipanggil saat render,
  // yang bisa memicu render loop kalau event tidak punya kedua orientasi.
  useEffect(() => {
    if (!hasPortrait && hasLandscape && customerTab === 'portrait') setCustomerTab('landscape');
    else if (!hasLandscape && hasPortrait && customerTab === 'landscape') setCustomerTab('portrait');
  }, [hasPortrait, hasLandscape, customerTab, setCustomerTab]);

  const filtered = eventTemplates.filter(t =>
    customerTab === 'landscape' ? t.orientation === 'landscape' : t.orientation !== 'landscape'
  );

  return (
    <div className="flex flex-col items-center justify-center h-screen p-10 overflow-hidden relative z-10" style={{ backgroundColor: 'var(--color-bg)' }}>
      <h1 className="font-pixel text-2xl md:text-3xl mb-4 drop-shadow-[4px_4px_0_#000] shrink-0 whitespace-nowrap" style={{ color: 'var(--color-secondary)' }}>Pilih Frame Favoritmu</h1>

      {hasPortrait && hasLandscape && (
        <div className="flex gap-6 mb-8 shrink-0">
          <button onClick={() => setCustomerTab('portrait')} className={`font-pixel px-6 py-3 text-sm border-8 border-black transition-all whitespace-nowrap ${customerTab === 'portrait' ? 'text-black shadow-[8px_8px_0_0_#000] translate-y-1' : 'bg-gray-300 text-gray-500 hover:bg-white shadow-[8px_8px_0_0_#000]'}`} style={customerTab === 'portrait' ? { backgroundColor: 'var(--color-secondary)' } : {}}>[ PORTRAIT ]</button>
          <button onClick={() => setCustomerTab('landscape')} className={`font-pixel px-6 py-3 text-sm border-8 border-black transition-all whitespace-nowrap ${customerTab === 'landscape' ? 'text-black shadow-[8px_8px_0_0_#000] translate-y-1' : 'bg-gray-300 text-gray-500 hover:bg-white shadow-[8px_8px_0_0_#000]'}`} style={customerTab === 'landscape' ? { backgroundColor: 'var(--color-secondary)' } : {}}>[ LANDSCAPE ]</button>
        </div>
      )}

      <AreaGeser
        arah={customerTab === 'landscape' ? 'vertikal' : 'horizontal'}
        wrapperClassName={customerTab === 'landscape' ? 'h-[65vh] w-[600px] mx-auto' : 'w-full max-w-7xl'}
        className={`flex gap-10 pb-10 ${customerTab === 'landscape' ? 'flex-col overflow-y-auto h-full items-center' : 'flex-row overflow-x-auto items-center pt-4'}`}
      >
        {filtered.map(tpl => (
          <div key={tpl.id} onClick={() => startCustomerPhoto(tpl)} className={`bg-white border-8 border-black cursor-pointer hover:scale-105 hover:-translate-y-2 active:scale-95 transition-all shadow-[12px_12px_0_0_#000] flex flex-col shrink-0 ${customerTab === 'landscape' ? 'w-[500px]' : 'w-[320px]'}`}>
            <div className={`${customerTab === 'landscape' ? 'h-[250px]' : 'h-[420px]'} bg-gray-200 border-b-8 border-black p-4 relative flex justify-center items-center`}>
              <img src={localUrl(`/templates/${tpl.filename}`)} className="max-w-full max-h-full object-contain drop-shadow-xl" />
              <div className="absolute top-4 right-4 font-pixel text-[10px] text-white px-3 py-2 border-4 border-black shadow-[4px_4px_0_0_#000] whitespace-nowrap" style={{ backgroundColor: 'var(--color-accent)' }}>{tpl.override_price <= 0 ? 'GRATIS' : `Rp ${(tpl.override_price / 1000)}k`}</div>
            </div>
            <div className="p-4 text-center font-pixel text-sm text-black whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>[ PILIH FRAME ]</div>
          </div>
        ))}
      </AreaGeser>

      <button onClick={() => setScreen('landing')} className="text-white border-4 border-black font-pixel px-6 py-3 absolute bottom-6 left-6 text-xs shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-accent)' }}>[ KEMBALI ]</button>
    </div>
  );
}
