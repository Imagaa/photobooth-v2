import { useStore } from '../store/useStore';

export default function RetroDialog() {
  const dialog = useStore(s => s.dialog);
  const closeDialog = useStore(s => s.closeDialog);

  if (!dialog.isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-[999] flex justify-center items-center p-6">
      <div className="bg-white w-full max-w-lg text-center p-8 flex flex-col gap-6 border-8 border-black" style={{ boxShadow: '16px 16px 0 0 var(--color-secondary)' }}>
        <h2 className="font-pixel text-xl mb-2 whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>{dialog.type === 'confirm' ? '[ KONFIRMASI ]' : '[ INFORMASI ]'}</h2>
        <p className="font-sys text-lg font-bold text-gray-700 whitespace-pre-wrap">{dialog.message}</p>
        <div className="flex gap-4 justify-center mt-6">
          {dialog.type === 'confirm' && <button onClick={() => closeDialog(false)} className="text-white font-pixel border-4 border-black flex-1 py-4 text-sm shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-accent)' }}>[ BATAL ]</button>}
          <button onClick={() => closeDialog(true)} className="text-black font-pixel border-4 border-black flex-1 py-4 text-sm shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>[ LANJUT ]</button>
        </div>
      </div>
    </div>
  );
}
