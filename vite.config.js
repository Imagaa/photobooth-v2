import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import ports from './electron/ports.js'

// Halaman produksi dimuat lewat file://, yang tidak punya response header —
// sehingga onHeadersReceived di main process tidak pernah berlaku di sana.
// Policy karena itu ditanam sebagai <meta> saat build.
// Harus dijaga sinkron dengan buildCSP() di electron/main.js.
// `file:` disertakan bersama 'self' karena halaman produksi berorigin file://,
// dan pencocokan 'self' untuk origin file berbeda antar versi Chromium. Tanpa
// ini risikonya kiosk menampilkan layar putih di produksi. Secara praktis ini
// setara 'self' — penyerang yang sudah bisa menulis file ke disk tidak lagi
// terhalang CSP, sementara skrip remote tetap diblokir.
const PRODUCTION_CSP = [
  `default-src 'none'`,
  `script-src 'self' file:`,
  `style-src 'self' file: 'unsafe-inline'`,
  // Port server lokal ditulis wildcard, bukan 3000. Port itu bisa mundur ke
  // port bebas bila 3000 sedang dipakai proses lain (lihat electron/ports.js),
  // dan policy yang mengunci 3000 akan membuat template serta preview video
  // gagal dimuat tanpa pesan apa pun.
  `img-src 'self' file: data: blob: https: http://localhost:* http://127.0.0.1:*`,
  // Loopback juga diperlukan untuk preview video sesi di layar hasil.
  `media-src 'self' file: blob: mediastream: http://localhost:* http://127.0.0.1:*`,
  `font-src 'self' file: data:`,
  `connect-src 'self' http://localhost:* http://127.0.0.1:*`,
  `object-src 'none'`,
  `frame-src 'none'`,
  `base-uri 'none'`,
  `form-action 'none'`,
].join('; ')

function injectCsp() {
  return {
    name: 'inject-csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${PRODUCTION_CSP}">`
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), injectCsp()],
  base: './', // Wajib './' agar Electron bisa baca relative path saat build
  server: {
    // strictPort membuat bentrok port jadi error yang jelas, bukan lompatan
    // diam-diam ke port berikutnya. Tanpa ini Vite pindah ke 5174 sementara
    // Electron tetap membuka 5173, sehingga kiosk menampilkan halaman
    // milik proyek lain tanpa satu pun error (bug B24).
    //
    // `npm run dev` (scripts/dev.mjs) sudah membeli port bebas lebih dulu dan
    // meneruskannya lewat --port, jadi jalur resmi tidak pernah kena.
    strictPort: true,
    port: ports.parsePort(process.env.PB_DEV_PORT, ports.DEFAULT_DEV_PORT),
  },
})
