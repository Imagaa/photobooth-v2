// =========================================================================
// SCENE BACKDROP — parallax pixel-art di belakang menu awal
//
// Semua aset pixel dibuat lewat PixelLab, tetapi GERAKNYA seluruhnya CSS.
// Tidak ada satu pun generasi AI yang dipakai untuk animasi: awan melintas,
// semak bergoyang, matahari berdenyut, dan karakter berjalan memakai
// keyframes. Ini penting untuk anggaran — 40 generasi tidak cukup kalau
// setiap gerakan dibuat lewat AI.
//
// Lapisan dari belakang ke depan:
//   langit -> bukit -> matahari -> awan -> burung -> blok -> semak
//   -> karakter monkey -> kabut
//
// SEMUA gambar dimuat lewat background-image di index.css, bukan <img src>.
// Alasannya teknis, bukan selera: halaman produksi dimuat lewat file://, dan
// Vite hanya menulis ulang path aset yang dirujuk dari CSS atau import JS.
// String src="scene/..." di JSX dibiarkan apa adanya sehingga akan mencari
// relatif dari document base — dan gagal saat dipaket. Dimuat lewat CSS
// menjamin path-nya sudah mengandung hash dan tetap relatif.
//
// Aset yang belum ada sengaja tidak dirender error: elemennya kosong, scene
// tetap tampil benar walau sebagian gambar belum terunduh.
// =========================================================================

// Kecepatan parallax per lapisan. Makin dekat ke kamera, makin cepat —
// inilah yang membuat kedalaman terasa saat layar idle berjam-jam.
//
// Hanya durasi yang diatur dari sini. Tinggi strip sengaja TIDAK diatur dari
// JS: ukurannya sudah dikunci di CSS bersama --ground, supaya posisi semua
// obyek tetap sinkron di tinggi layar berapa pun.
const PARALLAX = {
  bukit: { durasi: 110 },
  semak: { durasi: 34 },
};

export default function SceneBackdrop() {
  return (
    <div className="scene-root" aria-hidden="true">

      {/* Langit. Diam — gerakan awan sudah memberi kesan hidup. */}
      <div className="scene-layer scene-sky" />

      {/* Bukit + tanah: menempel dasar layar, seperti lantai permainan.
          Tidak ada elemen anak: latar menumph pada .scene-strip itu sendiri
          dengan repeat-x, lalu digeser tepat satu lebar tile. */}
      <div
        className="scene-layer scene-strip scene-strip-bukit"
        style={{ '--dur': `${PARALLAX.bukit.durasi}s` }}
      />

      {/* Matahari berdenyut pelan. */}
      <div className="scene-sun" />

      {/* Dua awan dengan kecepatan dan tinggi berbeda supaya tidak terlihat
          berpasangan. */}
      <div className="scene-cloud scene-cloud-a" />
      <div className="scene-cloud scene-cloud-b" />

      {/* Burung latar berayun mengikuti jalurnya masing-masing. */}
      <div className="scene-bird scene-bird-a" />
      <div className="scene-bird scene-bird-b" />

      {/* Blok tanya: melayang di atas kepala monyet, bob naik-turun ringan. */}
      <div className="scene-blocks">
        <div className="scene-block" style={{ left: '12%', animationDelay: '0s' }} />
        <div className="scene-block" style={{ left: '17%', animationDelay: '0.6s' }} />
        <div className="scene-block" style={{ left: '81%', animationDelay: '0.3s' }} />
      </div>

      {/* Karakter monkey SayGumi. Sheet "lari" (8 frame) jadi lapisan dasar
          yang selalu tampil; sheet "lompat" (9 frame) dan "diam" (4 frame)
          disuperimpose dan hanya terlihat sebentar dalam satu siklus 7 detik.
          Hasilnya
          empat perilaku bergantian — lari, berhenti bernapas, lari, lompat —
          tanpa satu pun generasi AI tambahan untuk gerakan. */}
      <div className="scene-monkey-wrap">
        <div className="scene-monkey" />
        <div className="scene-monkey scene-monkey-jump" />
        <div className="scene-monkey scene-monkey-idle" />
      </div>

      {/* Kepiting menyeberang dari kanan ke kiri, berlawanan arah dengan
          monkey. Sheet 6 frame "jalan"; scaleX(-1) ada di CSS. */}
      <div className="scene-crab-wrap" />

      {/* Semak: PENGECAPAN. Berada di urutan terakhir sehingga menutupi semua
          aset lain — bukit, blok tanya, monkey, dan kepiting. Karakter lalu
          terlihat berjalan di belakang pagar, bukan di atasnya.

          PENTING: selama semak bukan anak terakhir, ia hanya satu lapis di
          depan bukit dan karakter tetap tampak berjalan di atas semak. */}
      <div
        className="scene-layer scene-strip scene-strip-semak"
        style={{ '--dur': `${PARALLAX.semak.durasi}s` }}
      />

      {/* Kabut tipis di paling depan supaya transisi menuju tombol MULAI
          tidak terasa tajam. */}
      <div className="scene-haze" />
    </div>
  );
}
