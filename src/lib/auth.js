// src/lib/auth.js — pengunci sederhana (password saja) untuk dashboard.
// Versi ESM untuk Astro (logika tidak diubah dari auth.js asli).
// HANYA hash SHA-256 password yang disimpan di sini, bukan passwordnya.
// Sesi login disimpan di sessionStorage (hilang saat tab/browser ditutup).
// Logout = hapus sesi + kembali ke login.html.
//
// JUJUR: ini BUKAN keamanan sungguhan. Repo ini publik di GitHub, jadi
// siapa pun bisa membaca hash di bawah, memaksa semua password pendek,
// atau menghapus guard ini. Fungsinya hanya menahan pengunjung biasa.
// Password yang kuat (panjang, acak) jauh lebih aman daripada yang pendek.
// Ganti password: buka login.html -> "Ganti password", masukkan password
// lama + baru, lalu tempel hash baru yang tampil ke PASSWORD_HASH di bawah
// dan push ulang ke GitHub (Vercel redeploy otomatis).

// Hash SHA-256 dari password yang dipilih Rizal (13 Nov 2026).
export var PASSWORD_HASH = "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
export var SESSION_KEY = "cibung_auth";

export function sha256Hex(str) {
  // SHA-256 sinkron (implementasi standar, domain publik) — tanpa crypto.subtle,
  // supaya login tetap jalan di semua konteks (https maupun http lokal).
  var ascii = unescape(encodeURIComponent(str)); // UTF-8 -> byte string
  function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
  var maxWord = Math.pow(2, 32), result = "";
  var words = [], asciiBitLength = ascii.length * 8;
  var hash = sha256Hex.h = sha256Hex.h || [], k = sha256Hex.k = sha256Hex.k || [];
  var primeCounter = k.length, isComposite = {};
  for (var candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (var i = 0; i < 313; i += candidate) { isComposite[i] = candidate; }
      hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += "\x80";
  while (ascii.length % 64 - 56) ascii += "\x00";
  for (var i = 0; i < ascii.length; i++) {
    var j = ascii.charCodeAt(i);
    if (j >> 8) return ""; // ASCII saja setelah encode UTF-8
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (var j = 0; j < words.length;) {
    var w = words.slice(j, j += 16), oldHash = hash;
    hash = hash.slice(0, 8);
    for (var i = 0; i < 64; i++) {
      var w15 = w[i - 15], w2 = w[i - 2];
      var a = hash[0], e = hash[4];
      var temp1 = hash[7]
        + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25))
        + ((e & hash[5]) ^ (~e & hash[6]))
        + k[i]
        + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
      var temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (var i = 0; i < 8; i++) { hash[i] = (hash[i] + oldHash[i]) | 0; }
  }
  for (var i = 0; i < 8; i++) {
    for (var j = 3; j + 1; j--) {
      var b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? "0" : "") + b.toString(16);
    }
  }
  return result;
}

export function isLoggedIn() {
  try { return sessionStorage.getItem(SESSION_KEY) === "1"; }
  catch (e) { return false; }
}

export function logout() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  location.replace("login.html");
}

// Catat percobaan login ke Supabase lewat /api/log-login (serverless).
// Fire-and-forget: tidak di-await, tidak menunda redirect, dan tidak
// pernah melempar error — bila Supabase belum diatur / sedang down,
// server membalas { logged: false } dan login tetap jalan seperti biasa.
export function logLoginAttempt(success) {
  try {
    fetch("/api/log-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: !!success }),
      keepalive: true,
    }).catch(function () { /* abaikan: pencatatan tidak boleh mengganggu login */ });
  } catch (e) { /* fetch tidak tersedia: abaikan */ }
}

// Guard halaman ber-shell: panggil dari <head> (BaseLayout) sebelum konten
// tampil, supaya halaman tidak sempat berkedip saat belum login.
// Halaman login sendiri tidak dijaga — kalau tidak, login tidak bisa dibuka.
export function guardAuth() {
  try {
    var path = location.pathname || "";
    var onLogin = path.endsWith("login.html") || path.endsWith("login");
    if (!onLogin && !isLoggedIn()) {
      var next = location.pathname + location.search + location.hash;
      location.replace("login.html?next=" + encodeURIComponent(next));
    }
  } catch (e) { /* sessionStorage tidak tersedia: biarkan halaman tampil */ }
}
