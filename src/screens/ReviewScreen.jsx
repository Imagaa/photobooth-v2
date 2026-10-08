import { useStore } from '../store/useStore';
import { useSession } from '../session/context';
import CompositePreview from '../components/CompositePreview';
import SessionTimer from '../components/SessionTimer';

export default function ReviewScreen() {
  const template = useStore(s => s.customerTemplate);
  const photos = useStore(s => s.capturedPhotos);
  const retakesLeft = useStore(s => s.retakesLeft);
  const { renderSheet, retakeSlot } = useSession();

  const isLandscape = template?.orientation === 'landscape';
  // Gerbang waktu dihapus: retake kini dijamin punya sisa waktu minimum
  // (lihat computeSessionDeadline), jadi menutupnya di menit terakhir justru
  // menghalangi hak yang sudah dibayar pelanggan. Batasnya kini jatah retake.
  const bolehRetake = retakesLeft > 0;

  const gridClass = isLandscape
    ? 'flex flex-row overflow-x-auto gap-6 hide-scroll items-start'
    : 'grid grid-cols-2 gap-6 overflow-y-auto hide-scroll content-start pb-10';

  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-6 relative p-6 overflow-hidden z-10" style={{ backgroundColor: 'var(--color-bg)' }}>
      <SessionTimer />
      <h1 className="font-pixel text-2xl md:text-3xl drop-shadow-[4px_4px_0_#000] shrink-0 whitespace-nowrap" style={{ color: 'var(--color-secondary)' }}>Review Hasil Akhir</h1>

      <div className={`flex gap-8 w-full max-w-7xl flex-1 min-h-0 ${isLandscape ? 'flex-col' : 'flex-row'}`}>
        <div className={`${isLandscape ? 'h-[60%] w-full' : 'w-[45%] h-full'} bg-white border-8 border-black flex flex-col p-4 shrink-0`} style={{ boxShadow: '12px 12px 0 0 var(--color-secondary)' }}>
          {!isLandscape && <h2 className="font-pixel text-sm md:text-base text-center mb-2 shrink-0 whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Photostrip Kamu</h2>}
          <CompositePreview template={template} photos={photos} />
        </div>

        <div className={`flex-1 border-8 border-black bg-white flex min-h-0 ${isLandscape ? 'flex-row p-6 items-center' : 'flex-col p-6'}`} style={{ boxShadow: '12px 12px 0 0 var(--color-secondary)' }}>
          <div className={`flex-1 min-h-0 min-w-0 ${gridClass}`}>
            {photos.map((photo, i) => (
              <div key={i} className={`border-4 border-black p-4 flex flex-col items-center bg-gray-100 shrink-0 shadow-[6px_6px_0_0_#000] ${isLandscape ? 'w-[320px] h-auto' : 'w-full min-h-[250px]'}`}>
                <h3 className="font-pixel text-xs md:text-sm mb-2 whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Gaya {i + 1}</h3>
                {photo
                  ? <img src={photo.previewUrl} className="w-full aspect-video object-cover border-4 border-black scale-x-[-1]" />
                  : <div className="w-full aspect-video bg-gray-300 border-4 border-black flex items-center justify-center font-sys text-gray-500 text-lg font-bold">Kosong</div>}
                {bolehRetake && (
                  <button onClick={() => retakeSlot(i)} disabled={retakesLeft <= 0 || !photo} className="w-full mt-4 px-2 py-3 font-pixel text-[10px] md:text-xs border-4 border-black text-black hover:bg-white disabled:opacity-50 transition-colors shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>[ RETAKE FOTO ]</button>
                )}
              </div>
            ))}
          </div>

          <div className={`shrink-0 flex items-center gap-4 ${isLandscape ? 'flex-col w-[260px] ml-8' : 'flex-col mt-6 pt-6 border-t-8 border-dashed border-gray-300'}`}>
            {bolehRetake && <p className="font-pixel text-sm md:text-base text-black px-4 py-3 border-4 border-black shadow-[6px_6px_0_0_#000] text-center w-full whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>SISA RETAKE:<br/><br/>{retakesLeft}</p>}
            <button onClick={renderSheet} className="text-white font-pixel border-4 border-black w-full py-4 text-xl shadow-[8px_8px_0_0_#000] active:translate-y-1 transition-all flex-1 min-h-[80px] whitespace-nowrap" style={{ backgroundColor: 'var(--color-accent)' }}>[ CETAK SEKARANG ]</button>
          </div>
        </div>
      </div>
    </div>
  );
}
