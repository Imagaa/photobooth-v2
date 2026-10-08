// Keyboard on-screen untuk kiosk touchscreen tanpa keyboard fisik.
export default function VirtualKeyboard({ value, onChange, onEnter }) {
  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE']
  ];
  const handleKeyPress = (key) => {
    if (key === 'BACKSPACE') { onChange(value.slice(0, -1)); } 
    else if (key === 'SPACE') { onChange(value + ' '); } 
    else { onChange(value + key); }
  };
  return (
    <div className="p-6 md:p-8 border-8 border-black mt-8 w-full max-w-5xl mx-auto select-none" style={{ backgroundColor: 'var(--color-primary)', boxShadow: '12px 12px 0 0 var(--color-secondary)' }}>
      {rows.map((row, i) => (
        <div key={i} className="flex justify-center gap-2 md:gap-4 mb-4">
          {row.map(key => (
            <button key={key} onClick={() => handleKeyPress(key)} className={`border-b-4 border-black active:border-b-0 active:translate-y-1 font-pixel text-lg md:text-2xl p-4 md:p-6 transition-all ${key === 'BACKSPACE' ? 'px-8 md:px-12 text-white' : 'bg-white hover:bg-gray-200 text-black w-16 h-16 md:w-24 md:h-24 flex items-center justify-center'}`} style={key === 'BACKSPACE' ? { backgroundColor: 'var(--color-accent)' } : {}}>
              {key === 'BACKSPACE' ? 'DEL' : key}
            </button>
          ))}
        </div>
      ))}
      <div className="flex justify-center gap-6 mt-4">
        <button onClick={() => handleKeyPress('SPACE')} className="bg-white hover:bg-gray-200 border-b-4 border-black active:border-b-0 active:translate-y-1 font-pixel text-xl md:text-2xl px-24 md:px-32 py-5 text-black">SPACE</button>
        <button onClick={onEnter} className="border-b-4 border-black active:border-b-0 active:translate-y-1 font-pixel text-xl md:text-2xl px-12 md:px-16 py-5 text-black whitespace-nowrap" style={{ backgroundColor: 'var(--color-secondary)' }}>[ LANJUT ]</button>
      </div>
    </div>
  );
}
