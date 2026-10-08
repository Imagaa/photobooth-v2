import { useState } from 'react';

// Kiosk berdiri di tempat umum; tanpa gerbang ini siapa pun yang bisa
// menyentuh keyboard dapat membuka pengaturan dan menghapus data event.
export default function AdminPinGate({ onSuccess, onCancel }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const submit = async (value) => {
    setChecking(true);
    const res = await window.electronAPI.verifyAdminPin(value);
    setChecking(false);
    if (res.success) { onSuccess(); return; }
    setError('PIN SALAH');
    setPin('');
  };

  const press = (digit) => {
    if (checking) return;
    setError('');
    const next = (pin + digit).slice(0, 8);
    setPin(next);
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[500] flex justify-center items-center p-6">
      <div className="bg-white border-8 border-black p-8 w-full max-w-md text-center" style={{ boxShadow: '16px 16px 0 0 var(--color-accent)' }}>
        <h2 className="font-pixel text-lg mb-2 whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>[ AREA TERBATAS ]</h2>
        <p className="font-sys text-lg font-bold text-gray-600 mb-6">Masukkan PIN Admin</p>

        <div className="border-4 border-black bg-gray-100 py-5 mb-2 font-pixel text-2xl tracking-[0.4em] text-black min-h-[64px] flex items-center justify-center">
          {pin.replace(/./g, '*') || <span className="text-gray-400 text-sm tracking-normal">····</span>}
        </div>
        <div className="h-6 mb-3 font-pixel text-[10px]" style={{ color: 'var(--color-accent)' }}>{error}</div>

        <div className="grid grid-cols-3 gap-3">
          {['1','2','3','4','5','6','7','8','9'].map(d => (
            <button key={d} onClick={() => press(d)} className="bg-white border-4 border-black font-pixel text-xl py-5 shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none text-black">{d}</button>
          ))}
          <button onClick={() => { setPin(''); setError(''); }} className="border-4 border-black font-pixel text-[10px] py-5 shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none text-black" style={{ backgroundColor: 'var(--color-secondary)' }}>CLR</button>
          <button onClick={() => press('0')} className="bg-white border-4 border-black font-pixel text-xl py-5 shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none text-black">0</button>
          <button onClick={() => submit(pin)} disabled={pin.length < 4 || checking} className="text-white border-4 border-black font-pixel text-[10px] py-5 shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none disabled:opacity-40" style={{ backgroundColor: 'var(--color-primary)' }}>OK</button>
        </div>

        <button onClick={onCancel} className="mt-6 w-full text-white border-4 border-black font-pixel py-3 text-xs shadow-[4px_4px_0_0_#000] active:translate-y-1 transition-all" style={{ backgroundColor: 'var(--color-accent)' }}>[ BATAL ]</button>
      </div>
    </div>
  );
}
