import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  // Proses utama Electron & preload berjalan di Node/CommonJS, bukan browser.
  {
    files: ['electron/**/*.js', '*.config.js'],
    // Dua berkas di electron/admin/ justru berjalan di browser HP kasir.
    // Dikecualikan di sini supaya `require` tidak ikut dianggap tersedia
    // di sana — itu jebakan yang baru ketahuan saat halamannya dibuka.
    ignores: ['electron/admin/client.js', 'electron/admin/format.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', caughtErrors: 'none' }],
      // Menangkap TDZ seperti `videoFiles` yang sempat dipakai sebelum
      // dideklarasikan. Fungsi dikecualikan karena hoisting-nya memang aman.
      'no-use-before-define': ['error', { functions: false, variables: true, classes: true }],
    },
  },
  // Halaman kasir berjalan di browser HP. format.js dimuat dua kali —
  // sebagai <script> di browser dan lewat require() dari Vitest — sehingga
  // ia butuh `module` selain global browser.
  {
    files: ['electron/admin/client.js', 'electron/admin/format.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...globals.browser, module: 'readonly' },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', caughtErrors: 'none' }],
      'no-use-before-define': ['error', { functions: false, variables: true, classes: true }],
    },
  },
  // Uji Vitest memakai ESM dan berjalan di Node.
  {
    files: ['tests/**/*.test.js', 'vitest.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  // Runner uji database berjalan di runtime Electron dengan CommonJS.
  {
    files: ['tests/db/**/*.js', 'tests/manual/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])
