// Efek CRT scanline. Disuntikkan sekali di root — sebelumnya komponen ini
// dirender dua kali sehingga tag <style> yang sama masuk DOM dobel.
export default function ArcadeEffects() {
  return (
    <style>{`
      .crt-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03));
        background-size: 100% 4px, 6px 100%;
        pointer-events: none; z-index: 9999;
        box-shadow: inset 0 0 100px rgba(0,0,0,0.8);
        animation: flicker 0.15s infinite;
        /* Dipromosikan ke layer compositing sendiri. Tanpa ini, flicker 0.15s
           memaksa repaint seluruh viewport terus-menerus — mahal untuk kiosk
           yang berjam-jam diam di layar landing. */
        will-change: opacity;
        transform: translateZ(0);
      }
      @keyframes flicker {
        0% { opacity: 0.95; }
        50% { opacity: 1; }
        100% { opacity: 0.95; }
      }
    `}</style>
  );
}
