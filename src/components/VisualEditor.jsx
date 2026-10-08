import { useEffect, useState, useRef, useCallback } from 'react';
import {
  buatRiwayat, rekamLangkah, langkahUndo, langkahRedo,
  bisaUndo as cekUndo, bisaRedo as cekRedo,
} from '../utils/riwayat';
import { localUrl } from '../localUrl';

// =========================================================================
// EDITOR SLOT FOTO
//
// Tugas layar ini bukan sekadar menggeser kotak, tapi menjawab satu
// pertanyaan: "apakah foto nanti menutup jendela frame dengan rapi?"
//
// Karena itu kanvas disusun mengikuti urutan tumpuk yang SAMA dengan proses
// render di main process (sharp): foto ditempel dulu, frame PNG menimpanya.
//
//   lapisan 0 : latar pemeriksa  → warna mencolok yang bocor lewat jendela
//                                  frame kalau slot kurang besar
//   lapisan 1 : isi slot         → mewakili foto pelanggan
//   lapisan 2 : gambar frame     → menimpa, sama seperti hasil akhir
//   lapisan 3 : kerangka & pegangan (selalu di atas supaya tetap bisa digeser)
//
// Semua interaksi memakai Pointer Events + pointer capture: satu jalur kode
// untuk mouse, stylus, dan jari, dan drag tidak lepas saat jari melewati
// tepi elemen. Pegangan dilawan-skalakan agar ukurannya di layar tetap
// nyaman disentuh berapa pun zoom kanvasnya.
// =========================================================================

const UKURAN_MIN = 40;

// Ukuran sentuh minimum yang nyaman di layar kiosk (± 11 mm).
const PX_PEGANGAN = 56;

// Perubahan sejenis yang beruntun dalam jeda sesingkat ini digabung menjadi
// satu langkah — kalau tidak, mengetik "1200" di kolom lebar akan memakan
// empat langkah undo dan terasa seperti editor yang rusak.
const JEDA_GABUNG_MS = 800;

const PILIHAN_LATAR = [
  { id: 'kotak', label: 'KOTAK', hint: 'Transparan (papan catur)' },
  { id: 'magenta', label: 'MAGENTA', hint: 'Paling galak untuk cari bocor' },
  { id: 'putih', label: 'PUTIH', hint: 'Meniru kertas cetak' },
  { id: 'hitam', label: 'HITAM', hint: 'Meniru layar gelap' },
];

const GAYA_LATAR = {
  kotak: {
    backgroundColor: '#ffffff',
    backgroundImage:
      'linear-gradient(45deg,#c9c9c9 25%,transparent 25%,transparent 75%,#c9c9c9 75%),' +
      'linear-gradient(45deg,#c9c9c9 25%,transparent 25%,transparent 75%,#c9c9c9 75%)',
    backgroundSize: '24px 24px',
    backgroundPosition: '0 0, 12px 12px',
  },
  magenta: { backgroundColor: '#ff00ff' },
  putih: { backgroundColor: '#ffffff' },
  hitam: { backgroundColor: '#111111' },
};

// Frame bisa disamarkan agar posisi slot di baliknya terlihat.
const TINGKAT_FRAME = [
  { id: 'penuh', label: 'FRAME: TAMPIL', opacity: 1 },
  { id: 'samar', label: 'FRAME: SAMAR', opacity: 0.35 },
  { id: 'sembunyi', label: 'FRAME: SEMBUNYI', opacity: 0 },
];

const PILIHAN_SNAP = [0, 5, 10, 25];

export default function VisualEditor({ template, onSave, onCancel }) {
  // Dihitung sekali saja lewat inisialisasi malas — JSON.parse di badan
  // komponen akan berjalan ulang di setiap render.
  const [slots, setSlots] = useState(() => (
    typeof template.slots === 'string' ? JSON.parse(template.slots) : (template.slots || [])
  ));
  const [orientation, setOrientation] = useState(template.orientation || 'portrait');

  const [terpilih, setTerpilih] = useState(null);
  const [latar, setLatar] = useState('kotak');
  const [frameIdx, setFrameIdx] = useState(0);
  const [snap, setSnap] = useState(10);
  const [skalaPas, setSkalaPas] = useState(1);
  const [zoom, setZoom] = useState(1);

  // ---------------------------------------------------------------------
  // Riwayat undo/redo
  //
  // Disimpan terpisah dari state hidup: saat drag berlangsung slot berubah
  // puluhan kali per detik, dan itu TIDAK boleh menjadi langkah undo.
  // Langkah baru hanya dicatat pada titik commit (drag lepas, tombol ditekan,
  // angka diketik) lewat `rekam`.
  // ---------------------------------------------------------------------
  const [riwayat, setRiwayat] = useState(() => buatRiwayat({
    slots: typeof template.slots === 'string' ? JSON.parse(template.slots) : (template.slots || []),
    orientation: template.orientation || 'portrait',
  }));
  const gabungRef = useRef({ kunci: null, waktu: 0 });

  const containerRef = useRef(null);
  const dragRef = useRef(null);

  // Cermin sinkron dari `slots`. Dibutuhkan karena pointerup harus mencatat
  // nilai terakhir hasil drag, sementara `slots` dari closure render belum
  // tentu yang paling baru.
  const slotsRef = useRef(slots);

  const lebar = Number(template.width);
  const tinggi = Number(template.height);
  const skala = skalaPas * zoom;

  const tulisSlots = useCallback((next) => {
    const nilai = typeof next === 'function' ? next(slotsRef.current) : next;
    slotsRef.current = nilai;
    setSlots(nilai);
    return nilai;
  }, []);

  const rekam = useCallback((snapshot, kunciGabung = null) => {
    const sekarang = Date.now();
    const bolehGabung = kunciGabung
      && gabungRef.current.kunci === kunciGabung
      && sekarang - gabungRef.current.waktu < JEDA_GABUNG_MS;
    gabungRef.current = { kunci: kunciGabung, waktu: sekarang };
    setRiwayat(r => rekamLangkah(r, snapshot, { gabung: bolehGabung }));
  }, []);

  const pulihkan = useCallback((snapshot) => {
    tulisSlots(snapshot.slots);
    setOrientation(snapshot.orientation);
    // Slot yang sedang dipilih bisa saja sudah tidak ada di snapshot tujuan.
    setTerpilih(t => (t !== null && t < snapshot.slots.length ? t : null));
    gabungRef.current = { kunci: null, waktu: 0 };
  }, [tulisSlots]);

  const bisaUndo = cekUndo(riwayat);
  const bisaRedo = cekRedo(riwayat);

  // Snapshot diterapkan langsung di sini, bukan lewat efek yang mengawasi
  // `riwayat.idx`: efek semacam itu juga akan ikut menyala setiap kali langkah
  // BARU dicatat, dan penerapan ulang itu menghapus penanda penggabungan
  // sehingga tiap ketikan angka kembali menjadi satu langkah undo sendiri.
  const undo = useCallback(() => {
    const berikut = langkahUndo(riwayat);
    if (berikut === riwayat) return;
    pulihkan(berikut.tumpuk[berikut.idx]);
    setRiwayat(berikut);
  }, [riwayat, pulihkan]);

  const redo = useCallback(() => {
    const berikut = langkahRedo(riwayat);
    if (berikut === riwayat) return;
    pulihkan(berikut.tumpuk[berikut.idx]);
    setRiwayat(berikut);
  }, [riwayat, pulihkan]);

  // Skala "pas layar" dihitung ulang saat panel kanan atau jendela berubah
  // ukuran — dulu hanya dihitung sekali sehingga kanvas bisa meluber.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const hitung = () => {
      const sx = (el.clientWidth - 48) / lebar;
      const sy = (el.clientHeight - 48) / tinggi;
      setSkalaPas(Math.min(sx, sy, 1));
    };
    hitung();
    const ro = new ResizeObserver(hitung);
    ro.observe(el);
    return () => ro.disconnect();
  }, [lebar, tinggi]);

  const bulatkan = useCallback((v) => (snap ? Math.round(v / snap) * snap : Math.round(v)), [snap]);

  const ubahSlot = useCallback((index, patch) => {
    return tulisSlots(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }, [tulisSlots]);

  // ---------------------------------------------------------------------
  // Geser & ubah ukuran
  // ---------------------------------------------------------------------
  const mulaiDrag = (e, index, aksi) => {
    e.preventDefault();
    e.stopPropagation();
    setTerpilih(index);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { index, aksi, x: e.clientX, y: e.clientY, awal: { ...slotsRef.current[index] } };
  };

  const jalanDrag = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / skala;
    const dy = (e.clientY - d.y) / skala;
    if (d.aksi === 'geser') {
      ubahSlot(d.index, { left: bulatkan(d.awal.left + dx), top: bulatkan(d.awal.top + dy) });
    } else {
      ubahSlot(d.index, {
        width: Math.max(UKURAN_MIN, bulatkan(d.awal.width + dx)),
        height: Math.max(UKURAN_MIN, bulatkan(d.awal.height + dy)),
      });
    }
  };

  const selesaiDrag = (e) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    // Seluruh drag masuk sebagai SATU langkah undo.
    rekam({ slots: slotsRef.current, orientation });
  };

  // ---------------------------------------------------------------------
  // Dorong halus — satu-satunya cara presisi di layar sentuh, dan pintasan
  // yang wajar untuk pengguna keyboard.
  // ---------------------------------------------------------------------
  const dorong = useCallback((dx, dy) => {
    if (terpilih === null) return;
    const next = tulisSlots(prev => prev.map((s, i) => (
      i === terpilih ? { ...s, left: Math.round(s.left + dx), top: Math.round(s.top + dy) } : s
    )));
    rekam({ slots: next, orientation }, `dorong-${terpilih}`);
  }, [terpilih, orientation, tulisSlots, rekam]);

  const gantiOrientasi = (o) => {
    setOrientation(o);
    rekam({ slots: slotsRef.current, orientation: o });
  };

  useEffect(() => {
    const langkah = snap || 1;
    const onKey = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (terpilih === null) return;
      const peta = { ArrowLeft: [-langkah, 0], ArrowRight: [langkah, 0], ArrowUp: [0, -langkah], ArrowDown: [0, langkah] };
      const gerak = peta[e.key];
      if (!gerak) return;
      e.preventDefault();
      dorong(gerak[0], gerak[1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [terpilih, snap, dorong, undo, redo]);

  const tambahSlot = () => {
    const baru = { top: bulatkan(tinggi * 0.1), left: bulatkan(lebar * 0.1), width: bulatkan(lebar * 0.4), height: bulatkan(tinggi * 0.25) };
    const next = tulisSlots(prev => [...prev, baru]);
    setTerpilih(next.length - 1);
    rekam({ slots: next, orientation });
  };

  const duplikatSlot = (i) => {
    const s = slotsRef.current[i];
    const next = tulisSlots(prev => [...prev, { ...s, top: s.top + 20, left: s.left + 20 }]);
    setTerpilih(next.length - 1);
    rekam({ slots: next, orientation });
  };

  const hapusSlot = (i) => {
    const next = tulisSlots(prev => prev.filter((_, idx) => idx !== i));
    setTerpilih(null);
    rekam({ slots: next, orientation });
  };

  const slotAktif = terpilih !== null ? slots[terpilih] : null;
  const opacityFrame = TINGKAT_FRAME[frameIdx].opacity;
  // Pegangan & label dilawan-skalakan supaya ukurannya di layar tetap sama.
  const lawanSkala = 1 / (skala || 1);

  const kolomAngka = (label, kunci, min) => (
    <label className="flex flex-col gap-1">
      <span className="font-sys text-xs font-bold text-gray-500">{label}</span>
      <input
        type="number"
        value={Math.round(slotAktif[kunci])}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          const next = ubahSlot(terpilih, { [kunci]: Math.max(min, Math.round(n)) });
          // Ketikan beruntun di kolom yang sama digabung jadi satu langkah.
          rekam({ slots: next, orientation }, `angka-${terpilih}-${kunci}`);
        }}
        className="border-4 border-black p-2 font-sys text-lg font-bold outline-none w-full"
      />
    </label>
  );

  const tombolDorong = (label, dx, dy, kelas = '') => (
    <button
      onClick={() => dorong(dx, dy)}
      className={`border-4 border-black bg-white font-pixel text-[11px] h-12 active:translate-y-0.5 ${kelas}`}
    >{label}</button>
  );

  return (
    // z di atas 9999 supaya overlay CRT layar landing tidak menutupi kanvas —
    // efek scanline-nya membuat kotak slot nyaris tak terlihat saat digeser.
    <div className="fixed inset-0 bg-black/95 z-[10000] flex p-5 gap-5">

      {/* ============================ KANVAS ============================ */}
      <div ref={containerRef} className="flex-1 editor-canvas-container flex items-center justify-center relative overflow-hidden">

        <div
          className="relative shrink-0 shadow-[0_0_30px_rgba(0,0,0,0.6)]"
          style={{ width: lebar, height: tinggi, transform: `scale(${skala})`, transformOrigin: 'center center' }}
        >
          {/* lapisan 0 — latar pemeriksa */}
          <div className="absolute inset-0" style={GAYA_LATAR[latar]} />

          {/* lapisan 1 — isi slot, mewakili foto pelanggan */}
          {slots.map((slot, i) => (
            <div
              key={`isi-${i}`}
              className="absolute"
              style={{
                top: slot.top, left: slot.left, width: slot.width, height: slot.height,
                background: 'repeating-linear-gradient(45deg,#38bdf8 0 28px,#0ea5e9 28px 56px)',
              }}
            />
          ))}

          {/* lapisan 2 — frame, menimpa persis seperti hasil cetak */}
          <img
            src={localUrl(`/templates/${template.filename}`)}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full pointer-events-none select-none"
            style={{ objectFit: 'contain', opacity: opacityFrame }}
          />

          {/* lapisan 3 — kerangka & pegangan */}
          {slots.map((slot, i) => {
            const aktif = i === terpilih;
            return (
              <div
                key={`box-${i}`}
                onPointerDown={(e) => mulaiDrag(e, i, 'geser')}
                onPointerMove={jalanDrag}
                onPointerUp={selesaiDrag}
                onPointerCancel={selesaiDrag}
                className="absolute cursor-move select-none"
                style={{
                  top: slot.top, left: slot.left, width: slot.width, height: slot.height,
                  touchAction: 'none',
                  outline: `${Math.max(2, 3 * lawanSkala)}px ${aktif ? 'solid' : 'dashed'} ${aktif ? 'var(--color-accent)' : 'rgba(255,255,255,0.85)'}`,
                  outlineOffset: 0,
                  boxShadow: aktif ? `0 0 0 ${Math.max(2, 3 * lawanSkala)}px rgba(0,0,0,0.6)` : 'none',
                }}
              >
                <span
                  className="absolute top-0 left-0 font-pixel text-black flex items-center justify-center border-4 border-black"
                  style={{
                    width: 34, height: 34, fontSize: 13,
                    transform: `scale(${lawanSkala})`, transformOrigin: 'top left',
                    backgroundColor: aktif ? 'var(--color-accent)' : 'var(--color-secondary)',
                    color: aktif ? '#fff' : '#111',
                  }}
                >{i + 1}</span>

                <div
                  onPointerDown={(e) => mulaiDrag(e, i, 'ukur')}
                  onPointerMove={jalanDrag}
                  onPointerUp={selesaiDrag}
                  onPointerCancel={selesaiDrag}
                  className="absolute bottom-0 right-0 cursor-se-resize flex items-center justify-center"
                  style={{
                    width: PX_PEGANGAN, height: PX_PEGANGAN, touchAction: 'none',
                    transform: `scale(${lawanSkala}) translate(50%, 50%)`, transformOrigin: 'bottom right',
                  }}
                >
                  <div className="w-7 h-7 border-4 border-black" style={{ backgroundColor: 'var(--color-secondary)' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Undo/redo mengambang — panel kanan bisa discroll, jadi tombol
            sepenting ini tidak boleh ikut hilang dari pandangan. */}
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-white border-4 border-black p-2 shadow-[4px_4px_0_0_#000]">
          <button
            onClick={undo}
            disabled={!bisaUndo}
            title="Urungkan (Ctrl+Z)"
            className="font-pixel text-[10px] px-4 h-12 border-4 border-black active:translate-y-0.5 disabled:opacity-30 disabled:active:translate-y-0 whitespace-nowrap"
            style={{ backgroundColor: bisaUndo ? 'var(--color-secondary)' : '#e5e7eb' }}
          >↶ URUNG</button>
          <button
            onClick={redo}
            disabled={!bisaRedo}
            title="Ulangi (Ctrl+Shift+Z / Ctrl+Y)"
            className="font-pixel text-[10px] px-4 h-12 border-4 border-black active:translate-y-0.5 disabled:opacity-30 disabled:active:translate-y-0 whitespace-nowrap"
            style={{ backgroundColor: bisaRedo ? 'var(--color-secondary)' : '#e5e7eb' }}
          >↷ ULANG</button>
          <span className="font-pixel text-[9px] text-gray-500 w-14 text-center whitespace-nowrap">
            {riwayat.idx}/{riwayat.tumpuk.length - 1}
          </span>
        </div>

        {/* Zoom mengambang — tidak ikut menggeser tata letak kanvas. */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-white border-4 border-black p-2 shadow-[4px_4px_0_0_#000]">
          <button onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))} className="font-pixel text-sm w-12 h-12 border-4 border-black bg-white active:translate-y-0.5">-</button>
          <span className="font-pixel text-[10px] w-16 text-center whitespace-nowrap">{Math.round(skala * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))} className="font-pixel text-sm w-12 h-12 border-4 border-black bg-white active:translate-y-0.5">+</button>
          <button onClick={() => setZoom(1)} className="font-pixel text-[10px] px-3 h-12 border-4 border-black active:translate-y-0.5 whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>PAS</button>
        </div>

        <div className="absolute top-4 left-4 bg-black/70 border-2 border-white/30 px-3 py-2">
          <p className="font-sys text-sm font-bold text-white leading-tight">
            {lebar} × {tinggi} px · {slots.length} slot
          </p>
        </div>
      </div>

      {/* ============================ PANEL ============================ */}
      <div className="w-[440px] bg-white flex flex-col shrink-0 border-8 border-black" style={{ boxShadow: '12px 12px 0 0 var(--color-secondary)' }}>
        <div className="text-white font-pixel p-4 text-sm border-b-8 border-black whitespace-nowrap shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>[ SETTING TEMPLATE ]</div>

        <div className="p-4 flex flex-col gap-5 flex-1 min-h-0 overflow-y-auto">

          {/* --- orientasi --- */}
          <div className="flex flex-col gap-2">
            <span className="font-sys font-bold text-base">Orientasi Frame</span>
            <div className="flex gap-2">
              {['portrait', 'landscape'].map(o => (
                <button
                  key={o}
                  onClick={() => gantiOrientasi(o)}
                  className={`font-pixel text-[10px] flex-1 py-4 border-4 border-black transition-all whitespace-nowrap ${orientation === o ? 'text-white translate-y-1 shadow-none' : 'bg-white text-gray-500 shadow-[4px_4px_0_0_#000]'}`}
                  style={orientation === o ? { backgroundColor: 'var(--color-primary)' } : {}}
                >{o.toUpperCase()}</button>
              ))}
            </div>
          </div>

          {/* --- pemeriksa bocor --- */}
          <div className="flex flex-col gap-2 border-t-4 border-dashed border-gray-400 pt-4">
            <span className="font-sys font-bold text-base">Cek Bocor</span>
            <p className="font-sys text-sm text-gray-500 font-bold leading-snug">
              Slot digambar di <b>bawah</b> frame, sama seperti hasil cetak. Kalau warna latar terlihat menembus jendela frame, berarti slot masih kurang besar.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PILIHAN_LATAR.map(p => (
                <button
                  key={p.id}
                  onClick={() => setLatar(p.id)}
                  title={p.hint}
                  className={`font-pixel text-[10px] py-4 border-4 border-black whitespace-nowrap ${latar === p.id ? 'text-white translate-y-1 shadow-none' : 'bg-white text-gray-500 shadow-[4px_4px_0_0_#000]'}`}
                  style={latar === p.id ? { backgroundColor: 'var(--color-primary)' } : {}}
                >{p.label}</button>
              ))}
            </div>
            <button
              onClick={() => setFrameIdx(i => (i + 1) % TINGKAT_FRAME.length)}
              className="font-pixel text-[10px] py-4 border-4 border-black bg-white shadow-[4px_4px_0_0_#000] active:translate-y-1 whitespace-nowrap"
            >{TINGKAT_FRAME[frameIdx].label}</button>
          </div>

          {/* --- snap --- */}
          <div className="flex flex-col gap-2 border-t-4 border-dashed border-gray-400 pt-4">
            <span className="font-sys font-bold text-base">Kunci ke Kisi (Snap)</span>
            <div className="grid grid-cols-4 gap-2">
              {PILIHAN_SNAP.map(n => (
                <button
                  key={n}
                  onClick={() => setSnap(n)}
                  className={`font-pixel text-[10px] py-4 border-4 border-black whitespace-nowrap ${snap === n ? 'text-white translate-y-1 shadow-none' : 'bg-white text-gray-500 shadow-[4px_4px_0_0_#000]'}`}
                  style={snap === n ? { backgroundColor: 'var(--color-primary)' } : {}}
                >{n === 0 ? 'OFF' : n}</button>
              ))}
            </div>
          </div>

          {/* --- daftar slot --- */}
          <div className="flex flex-col gap-2 border-t-4 border-dashed border-gray-400 pt-4">
            <div className="flex items-center justify-between">
              <span className="font-sys font-bold text-base">Daftar Slot</span>
              <button onClick={tambahSlot} className="text-black border-4 border-black font-pixel py-3 px-4 text-[10px] shadow-[4px_4px_0_0_#000] active:translate-y-1 whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>[+] TAMBAH</button>
            </div>

            {slots.length === 0 && (
              <p className="font-sys text-base text-gray-500 font-bold italic py-4">Belum ada slot. Tambah minimal satu.</p>
            )}

            {slots.map((slot, i) => (
              <button
                key={i}
                onClick={() => setTerpilih(i)}
                className={`flex items-center justify-between gap-3 p-3 border-4 border-black text-left ${i === terpilih ? 'text-white' : 'bg-gray-100 text-black'}`}
                style={i === terpilih ? { backgroundColor: 'var(--color-primary)' } : {}}
              >
                <span className="font-sys font-bold text-lg whitespace-nowrap">Slot {i + 1}</span>
                <span className="font-sys text-sm font-bold opacity-80 whitespace-nowrap">
                  {Math.round(slot.width)}×{Math.round(slot.height)}
                </span>
              </button>
            ))}
          </div>

          {/* --- pengaturan slot terpilih --- */}
          {slotAktif && (
            <div className="flex flex-col gap-3 border-t-4 border-dashed border-gray-400 pt-4">
              <span className="font-sys font-bold text-base">Atur Slot {terpilih + 1}</span>

              <div className="grid grid-cols-2 gap-3">
                {kolomAngka('Kiri (X)', 'left', -9999)}
                {kolomAngka('Atas (Y)', 'top', -9999)}
                {kolomAngka('Lebar', 'width', UKURAN_MIN)}
                {kolomAngka('Tinggi', 'height', UKURAN_MIN)}
              </div>

              {/* Dorong halus: di layar sentuh, presisi 1 px mustahil dicapai
                  dengan jari — tombol ini yang dipakai untuk merapikan. */}
              <div className="grid grid-cols-3 gap-2 w-[168px] self-center">
                <span />
                {tombolDorong('▲', 0, -(snap || 1))}
                <span />
                {tombolDorong('◀', -(snap || 1), 0)}
                <span className="font-pixel text-[9px] flex items-center justify-center text-gray-400 whitespace-nowrap">{snap || 1}px</span>
                {tombolDorong('▶', snap || 1, 0)}
                <span />
                {tombolDorong('▼', 0, snap || 1)}
                <span />
              </div>

              <div className="flex gap-2">
                <button onClick={() => duplikatSlot(terpilih)} className="flex-1 border-4 border-black bg-white font-pixel py-4 text-[10px] shadow-[4px_4px_0_0_#000] active:translate-y-1 whitespace-nowrap">[ DUPLIKAT ]</button>
                <button onClick={() => hapusSlot(terpilih)} className="flex-1 border-4 border-black text-white font-pixel py-4 text-[10px] shadow-[4px_4px_0_0_#000] active:translate-y-1 whitespace-nowrap" style={{ backgroundColor: 'var(--color-accent)' }}>[ HAPUS ]</button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t-8 border-black flex gap-2 shrink-0">
          <button onClick={onCancel} className="text-white border-4 border-black font-pixel flex-1 py-5 text-sm shadow-[4px_4px_0_0_#000] active:translate-y-1 whitespace-nowrap" style={{ backgroundColor: 'var(--color-accent)' }}>[ BATAL ]</button>
          <button onClick={() => onSave(slots, orientation)} className="text-white border-4 border-black font-pixel flex-1 py-5 text-sm shadow-[4px_4px_0_0_#000] active:translate-y-1 whitespace-nowrap" style={{ backgroundColor: 'var(--color-primary)' }}>[ SIMPAN ]</button>
        </div>
      </div>
    </div>
  );
}
