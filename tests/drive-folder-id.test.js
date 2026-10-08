import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { extractFolderId } = require('../electron/drive.js');

// Meminta "ID folder" lalu berharap orang tidak menempel URL adalah harapan
// yang keliru — menyalin link dari Drive justru yang paling wajar dilakukan.
describe('extractFolderId', () => {
  const ID = '1Chy-Gx9mXrtCtlTlM3DZLTym0rX46o-0';

  it('menerima URL folder lengkap dengan parameter share', () => {
    // Bentuk persis yang muncul saat menyalin link dari Google Drive.
    expect(extractFolderId(`https://drive.google.com/drive/folders/${ID}?usp=drive_link`)).toBe(ID);
  });

  it.each([
    ['URL folder tanpa parameter', `https://drive.google.com/drive/folders/${ID}`],
    ['URL dengan /u/0/', `https://drive.google.com/drive/u/0/folders/${ID}`],
    ['URL open?id=', `https://drive.google.com/open?id=${ID}`],
    ['URL dengan parameter tambahan', `https://drive.google.com/open?authuser=0&id=${ID}&hl=id`],
    ['ID mentah', ID],
    ['ID dengan spasi di tepi', `  ${ID}  `],
  ])('%s', (_label, masukan) => {
    expect(extractFolderId(masukan)).toBe(ID);
  });

  it.each([
    ['kosong', ''],
    ['null', null],
    ['undefined', undefined],
    ['hanya spasi', '   '],
    ['URL tanpa id sama sekali', 'https://drive.google.com/drive/my-drive'],
  ])('mengembalikan kosong untuk %s', (_label, masukan) => {
    expect(extractFolderId(masukan)).toBe('');
  });

  it('menerima ID yang mengandung tanda hubung dan garis bawah', () => {
    // ID Drive memang memakai kedua karakter itu.
    expect(extractFolderId('a-b_c123')).toBe('a-b_c123');
  });

  it('idempoten — hasilnya bisa diproses ulang', () => {
    expect(extractFolderId(extractFolderId(`https://drive.google.com/drive/folders/${ID}`))).toBe(ID);
  });
});
