import { createContext, useContext } from 'react';

// =========================================================================
// KANAL KEYBOARD ON-SCREEN PANEL ADMIN
//
// Persoalan yang diselesaikan di sini: seluruh input di panel admin adalah
// controlled component React. Menyetel `.value` elemennya dari luar TIDAK
// memperbarui state — React memasang setter-nya sendiri pada prototype
// HTMLInputElement, sehingga perubahan itu tertimpa pada render berikutnya
// dan nilainya kembali seperti semula.
//
// Karena itu keyboard tidak menyentuh DOM sama sekali. Input yang sedang
// difokuskan mendaftarkan `onChange` MILIKNYA SENDIRI ke kanal ini, dan
// keyboard memanggilnya persis seperti pengetikan sungguhan. Jalur datanya
// tetap satu: input → onChange → state.
//
// Context dipisah ke berkas .js sendiri (bukan .jsx) mengikuti pola
// session/context.js, supaya react-refresh tidak kehilangan jejak komponen.
// =========================================================================

export const OskContext = createContext(null);

// Mengembalikan null bila dipakai di luar provider. Sengaja tidak melempar:
// InputSentuh harus tetap berfungsi sebagai input biasa di layar mana pun
// yang belum memasang keyboard.
export function useOsk() {
  return useContext(OskContext);
}
