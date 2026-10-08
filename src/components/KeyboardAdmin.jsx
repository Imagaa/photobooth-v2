import { useState } from 'react';
import { BARIS_ANGKA, BARIS_HURUF, BARIS_SIMBOL, terapkanTombol, hurufTampil } from '../utils/keyboard';

const TOMBOL = 'border-4 border-black font-pixel shadow-[3px_3px_0_0_#000] active:translate-y-[3px] active:shadow-none transition-all select-none';

function Tombol({ label, onTekan, kelas = '', gaya = {}, lebar = 'w-14' }) {
  return (
    <button
      type="button"
      // Tanpa ini, menekan tombol memindahkan fokus dari input dan keyboard
      // langsung menutup dirinya sendiri sebelum ketikan sempat terkirim.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onTekan}
      className={`${TOMBOL} ${lebar} h-14 text-sm flex items-center justify-center ${kelas}`}
      style={gaya}
    >
      {label}
    </button>
  );
}

// =========================================================================
// KEYBOARD ON-SCREEN PANEL ADMIN
//
// Hanya muncul bila operator menyalakannya di tab Aksesibilitas DAN ada
// input yang sedang difokuskan. Ia tidak pernah menyentuh DOM input:
// seluruh ketikan dikirim lewat onChange milik input itu sendiri, sehingga
// controlled component React tetap menjadi satu-satunya sumber kebenaran.
// =========================================================================
export default function KeyboardAdmin({ target, onTutup }) {
  const [shift, setShift] = useState(false);

  if (!target) return null;

  const tekan = (tombol) => {
    if (tombol === 'SHIFT') { setShift(s => !s); return; }
    const { value, onChange } = target.current;
    const baru = terapkanTombol(value, tombol, { shift });
    // Bentuk event tiruan yang cukup: seluruh handler di panel admin hanya
    // membaca e.target.value.
    onChange({ target: { value: baru } });
  };

  return (
    <div
      className="border-t-8 border-black p-3 select-none"
      style={{ backgroundColor: 'var(--color-primary)' }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex justify-center gap-2 mb-2">
        {BARIS_ANGKA.map(k => (
          <Tombol key={k} label={k} onTekan={() => tekan(k)} kelas="bg-white text-black" />
        ))}
        <Tombol label="DEL" lebar="w-24" kelas="text-white" gaya={{ backgroundColor: 'var(--color-accent)' }} onTekan={() => tekan('DEL')} />
      </div>

      {BARIS_HURUF.map((baris, i) => (
        <div key={i} className="flex justify-center gap-2 mb-2">
          {i === 2 && (
            <Tombol
              label="SHIFT"
              lebar="w-24"
              kelas={shift ? 'text-black' : 'bg-white text-black'}
              gaya={shift ? { backgroundColor: 'var(--color-secondary)' } : {}}
              onTekan={() => tekan('SHIFT')}
            />
          )}
          {baris.map(k => (
            <Tombol key={k} label={hurufTampil(k, shift)} onTekan={() => tekan(k)} kelas="bg-white text-black" />
          ))}
          {i === 2 && (
            <Tombol label="CLR" lebar="w-24" kelas="bg-white text-black" onTekan={() => tekan('CLR')} />
          )}
        </div>
      ))}

      <div className="flex justify-center gap-2">
        {BARIS_SIMBOL.map(k => (
          <Tombol key={k} label={k} onTekan={() => tekan(k)} kelas="bg-white text-black" />
        ))}
        <Tombol label="SPACE" lebar="w-64" kelas="bg-white text-black" onTekan={() => tekan('SPACE')} />
        <Tombol label="TUTUP" lebar="w-24" kelas="text-black" gaya={{ backgroundColor: 'var(--color-secondary)' }} onTekan={onTutup} />
      </div>
    </div>
  );
}
