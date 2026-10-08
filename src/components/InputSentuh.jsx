import { useEffect, useRef } from 'react';
import { useOsk } from '../admin/oskContext';

// =========================================================================
// INPUT YANG SADAR KEYBOARD ON-SCREEN
//
// Pengganti <input> di panel admin. Perilakunya identik dengan input biasa;
// satu-satunya tambahan adalah ia mendaftarkan dirinya ke kanal OSK saat
// difokuskan, sehingga keyboard tahu ke mana harus mengirim ketikan.
//
// Yang didaftarkan adalah REF, bukan nilainya. Kalau yang dititipkan objek
// biasa, ia membeku pada nilai saat fokus terjadi — huruf kedua akan
// menimpa huruf pertama karena keyboard masih membaca nilai lama.
// =========================================================================
export default function InputSentuh({ value, onChange, onFocus, onBlur, ...sisa }) {
  const osk = useOsk();
  const ref = useRef({ value, onChange });

  // Diperbarui setiap render supaya keyboard selalu membaca nilai terkini.
  useEffect(() => { ref.current = { value, onChange }; });

  // Bila komponen ini hilang saat masih terdaftar (misalnya operator
  // berpindah tab Pengaturan), keyboard harus ikut melepasnya — kalau tidak
  // ia mengirim ketikan ke input yang sudah tidak ada.
  useEffect(() => () => { if (osk) osk.lepas(ref); }, [osk]);

  return (
    <input
      {...sisa}
      value={value}
      onChange={onChange}
      onFocus={(e) => { if (osk) osk.daftar(ref); if (onFocus) onFocus(e); }}
      onBlur={(e) => { if (osk) osk.mungkinLepas(ref); if (onBlur) onBlur(e); }}
    />
  );
}
