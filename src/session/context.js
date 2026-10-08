import { createContext, useContext } from 'react';

// Dipisah dari komponen provider supaya file provider hanya mengekspor
// komponen — syarat agar Fast Refresh bekerja.
export const SessionContext = createContext(null);

export const useSession = () => {
    const ctx = useContext(SessionContext);
    if (!ctx) throw new Error('useSession dipakai di luar SessionProvider');
    return ctx;
};
