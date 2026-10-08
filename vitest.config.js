import { defineConfig } from 'vitest/config'

// =========================================================================
// KONFIGURASI TEST
//
// Sebagian besar uji menyasar logika murni sehingga cukup lingkungan `node`.
// Berkas uji yang butuh DOM menyatakannya sendiri lewat komentar
// `// @vitest-environment jsdom` di baris pertama.
//
// Catatan penting: uji yang menyentuh better-sqlite3 TIDAK dijalankan di sini.
// Modul itu dikompilasi untuk ABI Electron, bukan Node biasa, jadi ia punya
// runner terpisah (`npm run test:db`) yang berjalan lewat runtime Electron.
// =========================================================================
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    exclude: ['tests/db/**'],
    reporters: 'verbose',
  },
})
