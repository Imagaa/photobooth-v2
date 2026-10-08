import { useStore } from '../store/useStore';
import { useSession } from '../session/context';
import VirtualKeyboard from '../components/VirtualKeyboard';

export default function InputNameScreen() {
  const customerName = useStore(s => s.customerName);
  const setCustomerName = useStore(s => s.setCustomerName);
  const { submitNameAndPay } = useSession();

  return (
    <div className="flex flex-col items-center justify-center h-screen p-8 z-10" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="bg-white border-8 border-black w-full max-w-5xl p-10 text-center" style={{ boxShadow: '16px 16px 0 0 var(--color-secondary)' }}>
        <h2 className="font-pixel text-2xl mb-6 whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>Siapa Nama Kamu?</h2>
        <input type="text" readOnly className="w-full border-8 border-black p-6 text-center font-sys text-4xl outline-none bg-gray-100 text-black font-bold" placeholder="Ketik dari keyboard di bawah..." value={customerName} />
        <VirtualKeyboard value={customerName} onChange={setCustomerName} onEnter={submitNameAndPay} />
      </div>
    </div>
  );
}
