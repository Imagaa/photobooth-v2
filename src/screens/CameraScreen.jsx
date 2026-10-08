import { useStore } from '../store/useStore';
import { useSession } from '../session/context';
import CompositePreview from '../components/CompositePreview';
import SessionTimer from '../components/SessionTimer';

export default function CameraScreen() {
  const template = useStore(s => s.customerTemplate);
  const photos = useStore(s => s.capturedPhotos);
  const countdown = useStore(s => s.countdown);
  const { videoRef, canvasRef, takePhotoAction } = useSession();

  const isLandscape = template?.orientation === 'landscape';
  const terisi = photos.filter(p => p !== null).length;
  const sisa = photos.filter(p => p === null).length;

  return (
    <div className="flex flex-col items-center justify-center h-screen relative p-6 overflow-hidden z-10" style={{ backgroundColor: 'var(--color-bg)' }}>
      <SessionTimer />
      <h2 className="font-pixel text-xl md:text-2xl text-center mb-4 drop-shadow-[4px_4px_0_#000] shrink-0 whitespace-nowrap" style={{ color: 'var(--color-secondary)' }}>Gaya ke-{terisi + 1}</h2>

      <div className={`flex gap-6 w-full max-w-7xl items-stretch ${isLandscape ? 'flex-col h-[85vh]' : 'flex-row h-[80vh]'}`}>
        <div
          className={`${isLandscape ? 'h-[70%] w-full flex-row' : 'w-[70%] h-full flex-col'} border-8 border-black bg-black flex p-2 relative cursor-pointer active:translate-y-1 transition-all`}
          style={{ boxShadow: '12px 12px 0 0 var(--color-secondary)' }}
          onClick={countdown === null ? takePhotoAction : undefined}
        >
          <div className="relative flex-1 bg-black overflow-hidden flex justify-center items-center">
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"></video>

            {countdown === null && (
              <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/80 px-6 py-4 border-4 font-pixel text-xs md:text-sm z-10 pointer-events-none text-center shadow-[6px_6px_0_0_#000] animate-pulse whitespace-nowrap" style={{ color: 'var(--color-secondary)', borderColor: 'var(--color-secondary)' }}>
                [ TEKAN LAYAR UNTUK MULAI TAKE FOTO ]
              </div>
            )}
            {countdown && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 overflow-hidden">
                <span className="font-pixel text-6xl md:text-8xl drop-shadow-[8px_8px_0_rgba(0,0,0,1)] text-center whitespace-nowrap" style={{ color: 'var(--color-secondary)' }}>{countdown}</span>
              </div>
            )}
          </div>
        </div>

        <div className={`${isLandscape ? 'h-[30%] w-full flex-row' : 'w-[30%] h-full flex-col'} bg-white border-8 border-black flex p-4 shrink-0`} style={{ boxShadow: '12px 12px 0 0 var(--color-secondary)' }}>
          {!isLandscape && <h2 className="font-pixel text-sm md:text-base text-center mb-2 shrink-0 whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Preview</h2>}
          <CompositePreview template={template} photos={photos} showPlaceholder />
          <div className={`font-sys text-center font-bold text-white border-4 border-black shadow-[4px_4px_0_0_#000] shrink-0 flex items-center justify-center ${isLandscape ? 'w-[180px] h-full ml-4 text-3xl' : 'w-full py-4 mt-4 text-2xl'}`} style={{ backgroundColor: 'var(--color-accent)' }}>Sisa:<br/>{sisa}</div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden"></canvas>
    </div>
  );
}
