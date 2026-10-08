// =========================================================================
// RUNNER UJI DATABASE
//
// better-sqlite3 dikompilasi untuk ABI Electron, bukan Node biasa, sehingga
// berkas ini TIDAK bisa dijalankan Vitest. Ia dijalankan lewat runtime Electron
// dalam mode Node:
//
//     npm run test:db
//
// Runner-nya sengaja minimalis (tanpa framework) supaya tidak menambah
// dependency hanya demi beberapa berkas uji.
// =========================================================================
const Database = require('better-sqlite3');

let lulus = 0;
let gagal = 0;
const kegagalan = [];

function test(nama, fn) {
    try {
        fn();
        lulus++;
        console.log(`  ✓ ${nama}`);
    } catch (err) {
        gagal++;
        kegagalan.push({ nama, err });
        console.log(`  ✗ ${nama}`);
        console.log(`      ${err.message}`);
    }
}

function group(nama, fn) {
    console.log(`\n${nama}`);
    fn();
}

function expect(aktual) {
    return {
        toBe(harap) {
            if (aktual !== harap) throw new Error(`harap ${JSON.stringify(harap)}, dapat ${JSON.stringify(aktual)}`);
        },
        toEqual(harap) {
            const a = JSON.stringify(aktual), b = JSON.stringify(harap);
            if (a !== b) throw new Error(`harap ${b}, dapat ${a}`);
        },
        toContain(bagian) {
            if (!aktual.includes(bagian)) throw new Error(`harap memuat ${JSON.stringify(bagian)}`);
        },
        notToContain(bagian) {
            if (aktual.includes(bagian)) throw new Error(`harap TIDAK memuat ${JSON.stringify(bagian)}`);
        },
        toThrow() {
            let melempar = false;
            try { aktual(); } catch { melempar = true; }
            if (!melempar) throw new Error('harap melempar, tetapi tidak');
        },
        notToThrow() {
            try { aktual(); } catch (e) { throw new Error(`harap tidak melempar, tetapi: ${e.message}`); }
        },
    };
}

module.exports = { Database, test, group, expect };

// Menjalankan seluruh berkas uji lalu melaporkan ringkasannya.
if (require.main === module) {
    const berkas = ['./migration.test.js', './retention.test.js'];
    berkas.forEach(f => require(f));

    console.log(`\n${'='.repeat(48)}`);
    console.log(`  ${lulus} lulus, ${gagal} gagal`);
    if (gagal > 0) {
        console.log(`\nKegagalan:`);
        kegagalan.forEach(k => console.log(`  - ${k.nama}: ${k.err.message}`));
        process.exit(1);
    }
}
