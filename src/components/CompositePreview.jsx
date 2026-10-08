import { useEffect, useRef, useState, memo } from 'react';
import { localUrl } from '../localUrl';

// Preview komposit: foto ditempel pada koordinat slot, lalu overlay frame di
// atasnya. Dipakai layar kamera dan review. Di-memo karena isinya berat dan
// dulu ikut dirender ulang setiap detik oleh countdown.
function CompositePreview({ template, photos, showPlaceholder = false }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

  const width = Number(template?.width) || 1;
  const height = Number(template?.height) || 1;

  useEffect(() => {
    const update = () => {
      const el = containerRef.current;
      if (!el || !template) return;
      const sX = (el.clientWidth - 16) / width;
      const sY = (el.clientHeight - 16) / height;
      setScale(Math.min(sX, sY, 1));
    };
    const timer = setTimeout(update, 100);
    window.addEventListener('resize', update);
    return () => { clearTimeout(timer); window.removeEventListener('resize', update); };
  }, [template, width, height]);

  const slots = typeof template?.slots === 'string'
    ? JSON.parse(template.slots)
    : (template?.slots || []);

  return (
    <div ref={containerRef} className="flex-1 min-h-0 min-w-0 border-4 border-dashed border-gray-400 bg-gray-100 relative overflow-hidden flex justify-center items-center p-2">
      {template && (
        <div className="shrink-0" style={{ width, height, minWidth: width, minHeight: height, transform: `scale(${scale})`, transformOrigin: 'center center', position: 'relative' }}>
          {slots.map((slot, i) => (
            <div key={i} style={{ position: 'absolute', top: slot.top, left: slot.left, width: slot.width, height: slot.height, backgroundColor: '#ddd', overflow: 'hidden' }}>
              {photos[i]
                ? <img src={photos[i].previewUrl} className="w-full h-full object-cover scale-x-[-1]" />
                : (showPlaceholder
                    ? <div className="w-full h-full border-4 border-dashed border-gray-400 flex items-center justify-center"><span className="font-sys text-gray-400 font-bold text-5xl">{i + 1}</span></div>
                    : null)}
            </div>
          ))}
          <img src={localUrl(`/templates/${template.filename}`)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }} />
        </div>
      )}
    </div>
  );
}

export default memo(CompositePreview);
