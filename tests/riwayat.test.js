import { describe, it, expect } from 'vitest';
import {
  buatRiwayat, rekamLangkah, langkahUndo, langkahRedo,
  bisaUndo, bisaRedo, snapshotAktif, BATAS_RIWAYAT,
} from '../src/utils/riwayat.js';

// Snapshot editor template: daftar slot + orientasi.
const snap = (n, orientation = 'portrait') => ({
  slots: [{ top: n, left: n, width: 100, height: 100 }],
  orientation,
});

describe('riwayat: kondisi awal', () => {
  it('mulai dengan satu langkah dan tidak bisa undo maupun redo', () => {
    const r = buatRiwayat(snap(0));
    expect(r.tumpuk).toHaveLength(1);
    expect(r.idx).toBe(0);
    expect(bisaUndo(r)).toBe(false);
    expect(bisaRedo(r)).toBe(false);
  });

  it('snapshotAktif menunjuk kondisi yang sedang berlaku, bukan puncak tumpukan', () => {
    let r = buatRiwayat(snap(0));
    r = rekamLangkah(r, snap(10));
    r = rekamLangkah(r, snap(20));
    r = langkahUndo(r);
    expect(snapshotAktif(r)).toEqual(snap(10));
  });
});

describe('riwayat: rekam & telusuri', () => {
  it('bergerak maju-mundur melewati beberapa langkah', () => {
    let r = buatRiwayat(snap(0));
    r = rekamLangkah(r, snap(10));
    r = rekamLangkah(r, snap(20));
    expect(r.idx).toBe(2);

    r = langkahUndo(r);
    expect(snapshotAktif(r)).toEqual(snap(10));
    r = langkahUndo(r);
    expect(snapshotAktif(r)).toEqual(snap(0));
    expect(bisaUndo(r)).toBe(false);

    r = langkahRedo(r);
    expect(snapshotAktif(r)).toEqual(snap(10));
    r = langkahRedo(r);
    expect(snapshotAktif(r)).toEqual(snap(20));
    expect(bisaRedo(r)).toBe(false);
  });

  it('undo di ujung awal mengembalikan objek yang sama persis', () => {
    // Komponen memakai kesamaan identitas ini untuk tahu bahwa tidak ada
    // yang perlu dipulihkan.
    const r = buatRiwayat(snap(0));
    expect(langkahUndo(r)).toBe(r);
  });

  it('redo di ujung akhir mengembalikan objek yang sama persis', () => {
    const r = rekamLangkah(buatRiwayat(snap(0)), snap(10));
    expect(langkahRedo(r)).toBe(r);
  });
});

describe('riwayat: langkah kosong', () => {
  it('aksi yang tidak mengubah apa pun tidak dicatat', () => {
    // Menekan slot untuk memilihnya, tanpa menggeser, tidak boleh membuat
    // undo berikutnya terasa "tidak melakukan apa-apa".
    const r = buatRiwayat(snap(0));
    const sesudah = rekamLangkah(r, snap(0));
    expect(sesudah).toBe(r);
  });

  it('perbedaan hanya pada orientasi tetap dianggap perubahan', () => {
    const r = buatRiwayat(snap(0, 'portrait'));
    const sesudah = rekamLangkah(r, snap(0, 'landscape'));
    expect(sesudah.tumpuk).toHaveLength(2);
    expect(snapshotAktif(sesudah).orientation).toBe('landscape');
  });
});

describe('riwayat: cabang redo', () => {
  it('mencatat langkah baru setelah undo membuang cabang redo', () => {
    let r = buatRiwayat(snap(0));
    r = rekamLangkah(r, snap(10));
    r = rekamLangkah(r, snap(20));
    r = langkahUndo(r);           // kembali ke snap(10)
    r = rekamLangkah(r, snap(99)); // cabang baru

    expect(r.tumpuk).toHaveLength(3);
    expect(r.idx).toBe(2);
    expect(snapshotAktif(r)).toEqual(snap(99));
    expect(bisaRedo(r)).toBe(false);
    // snap(20) sudah tidak terjangkau.
    expect(r.tumpuk).not.toContainEqual(snap(20));
  });
});

describe('riwayat: penggabungan langkah', () => {
  it('menimpa langkah teratas alih-alih menumpuk', () => {
    // Mengetik "120" di kolom lebar menghasilkan tiga perubahan beruntun;
    // ketiganya harus jadi satu langkah undo.
    let r = buatRiwayat(snap(0));
    r = rekamLangkah(r, snap(1), { gabung: false });
    r = rekamLangkah(r, snap(12), { gabung: true });
    r = rekamLangkah(r, snap(120), { gabung: true });

    expect(r.tumpuk).toHaveLength(2);
    expect(snapshotAktif(r)).toEqual(snap(120));

    r = langkahUndo(r);
    expect(snapshotAktif(r)).toEqual(snap(0));
  });

  it('tidak pernah menimpa snapshot awal', () => {
    // Bila gabung dihormati saat tumpukan masih satu, kondisi tersimpan
    // hilang dan operator tidak punya jalan kembali.
    let r = buatRiwayat(snap(0));
    r = rekamLangkah(r, snap(5), { gabung: true });

    expect(r.tumpuk).toHaveLength(2);
    expect(r.tumpuk[0]).toEqual(snap(0));
    expect(bisaUndo(r)).toBe(true);
  });

  it('penggabungan tetap membuang cabang redo', () => {
    let r = buatRiwayat(snap(0));
    r = rekamLangkah(r, snap(10));
    r = rekamLangkah(r, snap(20));
    r = langkahUndo(r);
    r = rekamLangkah(r, snap(11), { gabung: true });

    expect(r.tumpuk).toHaveLength(2);
    expect(snapshotAktif(r)).toEqual(snap(11));
    expect(bisaRedo(r)).toBe(false);
  });
});

describe('riwayat: batas tumpukan', () => {
  it('memangkas langkah tertua dan menjaga idx tetap menunjuk yang terbaru', () => {
    let r = buatRiwayat(snap(0));
    for (let i = 1; i <= 10; i++) r = rekamLangkah(r, snap(i), { batas: 5 });

    expect(r.tumpuk).toHaveLength(5);
    expect(r.idx).toBe(4);
    expect(snapshotAktif(r)).toEqual(snap(10));
    // Yang tersisa adalah lima langkah terakhir.
    expect(r.tumpuk[0]).toEqual(snap(6));
  });

  it('memakai batas bawaan bila tidak disebutkan', () => {
    let r = buatRiwayat(snap(0));
    for (let i = 1; i <= BATAS_RIWAYAT + 20; i++) r = rekamLangkah(r, snap(i));
    expect(r.tumpuk).toHaveLength(BATAS_RIWAYAT);
    expect(snapshotAktif(r)).toEqual(snap(BATAS_RIWAYAT + 20));
  });
});

describe('riwayat: tidak merusak masukan', () => {
  it('rekamLangkah tidak mengubah riwayat lama', () => {
    // Komponen menyimpan riwayat sebagai state React; mutasi di tempat akan
    // membuat render tidak konsisten.
    const awal = buatRiwayat(snap(0));
    const salinan = JSON.parse(JSON.stringify(awal));
    rekamLangkah(awal, snap(10));
    expect(awal).toEqual(salinan);
  });

  it('langkahUndo tidak mengubah riwayat lama', () => {
    const r = rekamLangkah(buatRiwayat(snap(0)), snap(10));
    const salinan = JSON.parse(JSON.stringify(r));
    langkahUndo(r);
    expect(r).toEqual(salinan);
  });
});
