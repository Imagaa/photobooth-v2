import { useCallback, useEffect, useRef, useState } from 'react';

// =========================================================================
// AREA GESER
//
// Scrollbar dimatikan secara global di index.css demi tampilan kiosk. Di
// mouse itu tidak apa-apa — masih ada roda. Di layar sentuh akibatnya serius:
// tidak ada satu pun tanda bahwa suatu area masih menyimpan isi di luar
// layar, dan pelanggan bisa tidak pernah tahu ada frame lain yang bisa
// dipilih.
//
// Komponen ini mengembalikan tanda itu tanpa memunculkan scrollbar: gradien
// pudar di tepi yang masih ada isinya, plus tombol panah berukuran sentuh
// yang muncul hanya jika arah itu memang bisa digeser.
// =========================================================================

// Sekali ketuk menggeser 80% layar, bukan 100% — menyisakan satu kartu yang
// masih terlihat sebagai jangkar supaya orang tidak kehilangan konteks.
const LANGKAH = 0.8;

// Pembulatan sub-piksel membuat perbandingan persis (pos + tampak === total)
// kadang meleset satu piksel, dan tombol panah berkedip di ujung.
const AMBANG = 2;

export default function AreaGeser({ arah = 'horizontal', className = '', wrapperClassName = '', children }) {
  const ref = useRef(null);
  const [bisa, setBisa] = useState({ awal: false, akhir: false });
  const horizontal = arah === 'horizontal';

  const hitung = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const pos = horizontal ? el.scrollLeft : el.scrollTop;
    const total = horizontal ? el.scrollWidth : el.scrollHeight;
    const tampak = horizontal ? el.clientWidth : el.clientHeight;
    setBisa({ awal: pos > AMBANG, akhir: pos + tampak < total - AMBANG });
  }, [horizontal]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    hitung();
    el.addEventListener('scroll', hitung, { passive: true });

    // Isi area bisa berubah ukuran setelah gambar frame selesai dimuat —
    // menghitung sekali saat mount akan menyimpulkan "tidak ada yang bisa
    // digeser" padahal kartunya belum punya tinggi.
    const ro = new ResizeObserver(hitung);
    ro.observe(el);
    for (const anak of el.children) ro.observe(anak);

    return () => { el.removeEventListener('scroll', hitung); ro.disconnect(); };
  }, [hitung, children]);

  const geser = (ke) => {
    const el = ref.current;
    if (!el) return;
    const jarak = (horizontal ? el.clientWidth : el.clientHeight) * LANGKAH * ke;
    el.scrollBy({ [horizontal ? 'left' : 'top']: jarak, behavior: 'smooth' });
  };

  const kelasTombol = 'absolute z-20 w-16 h-16 flex items-center justify-center border-4 border-black font-pixel text-lg text-black shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none transition-all';

  const posisiAwal = horizontal ? 'left-0 top-1/2 -translate-y-1/2' : 'top-0 left-1/2 -translate-x-1/2';
  const posisiAkhir = horizontal ? 'right-0 top-1/2 -translate-y-1/2' : 'bottom-0 left-1/2 -translate-x-1/2';

  const kelasPudar = 'absolute z-10 pointer-events-none';
  const ukuranPudarAwal = horizontal ? 'left-0 top-0 bottom-0 w-24' : 'top-0 left-0 right-0 h-20';
  const ukuranPudarAkhir = horizontal ? 'right-0 top-0 bottom-0 w-24' : 'bottom-0 left-0 right-0 h-20';

  return (
    <div className={`relative min-h-0 min-w-0 ${wrapperClassName}`}>
      <div ref={ref} className={`hide-scroll ${className}`}>
        {children}
      </div>

      {bisa.awal && (
        <>
          <div className={`${kelasPudar} ${ukuranPudarAwal}`} style={{ background: `linear-gradient(to ${horizontal ? 'right' : 'bottom'}, var(--color-bg), transparent)` }} />
          <button
            onClick={() => geser(-1)}
            aria-label="Geser ke awal"
            className={`${kelasTombol} ${posisiAwal}`}
            style={{ backgroundColor: 'var(--color-secondary)' }}
          >{horizontal ? '◀' : '▲'}</button>
        </>
      )}

      {bisa.akhir && (
        <>
          <div className={`${kelasPudar} ${ukuranPudarAkhir}`} style={{ background: `linear-gradient(to ${horizontal ? 'left' : 'top'}, var(--color-bg), transparent)` }} />
          <button
            onClick={() => geser(1)}
            aria-label="Geser ke akhir"
            className={`${kelasTombol} ${posisiAkhir}`}
            style={{ backgroundColor: 'var(--color-secondary)' }}
          >{horizontal ? '▶' : '▼'}</button>
        </>
      )}
    </div>
  );
}
