// =========================================================================
// PENYIMPANAN RAHASIA
// Midtrans server key setara kunci brankas: bisa dipakai menagih dan refund
// atas nama merchant. Ia tidak boleh tersimpan plaintext di SQLite, dan tidak
// boleh dikirim ke renderer sama sekali.
// =========================================================================
const { safeStorage } = require('electron');
const crypto = require('crypto');

const ENC_PREFIX = 'enc:v1:';

function encryptionAvailable() {
    try { return safeStorage.isEncryptionAvailable(); } catch { return false; }
}

// Mengembalikan nilai siap simpan. Bila OS tidak menyediakan keychain, nilai
// disimpan apa adanya — pemanggil wajib memberi tahu operator lewat
// encryptionAvailable().
function encryptSecret(plain) {
    if (!plain) return '';
    if (!encryptionAvailable()) return plain;
    return ENC_PREFIX + safeStorage.encryptString(plain).toString('base64');
}

function decryptSecret(stored) {
    if (!stored) return '';
    if (!stored.startsWith(ENC_PREFIX)) return stored; // nilai lama, belum terenkripsi
    if (!encryptionAvailable()) return '';
    try {
        return safeStorage.decryptString(Buffer.from(stored.slice(ENC_PREFIX.length), 'base64'));
    } catch {
        return '';
    }
}

function isEncrypted(stored) {
    return typeof stored === 'string' && stored.startsWith(ENC_PREFIX);
}

// Hanya empat karakter terakhir yang boleh sampai ke layar, supaya operator
// bisa memastikan key mana yang terpasang tanpa membocorkannya.
function maskSecret(plain) {
    if (!plain) return '';
    if (plain.length <= 4) return '****';
    return '••••••••' + plain.slice(-4);
}

// =========================================================================
// PIN ADMIN
// Disimpan sebagai scrypt hash bersalt, bukan angka polos.
// =========================================================================
function hashPin(pin) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(String(pin), salt, 32);
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPin(pin, stored) {
    if (!stored || !stored.includes(':')) return false;
    const [saltHex, hashHex] = stored.split(':');
    try {
        const expected = Buffer.from(hashHex, 'hex');
        const actual = crypto.scryptSync(String(pin), Buffer.from(saltHex, 'hex'), 32);
        return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    } catch {
        return false;
    }
}

module.exports = { encryptSecret, decryptSecret, isEncrypted, maskSecret, encryptionAvailable, hashPin, verifyPin };
