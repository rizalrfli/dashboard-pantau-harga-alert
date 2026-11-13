// whale.js — Whale Detector / Big Money (rule-based, transparan).
// Mendeteksi jejak volume besar (akumulasi / distribusi) dari data publik
// Yahoo Finance saja (closes + volumes harian). Dihitung di browser,
// tanpa API key / LLM / order book.
//
// JUJUR: ini BUKAN data aliran dana asing atau order book yang sebenarnya.
// Yang dideteksi hanyalah pola volume + harga yang tidak wajar: volume hari
// ini jauh di atas rata-rata, searah dengan pergerakan harga. Whale sungguhan
// bisa menyamar (beli pelan-pelan tanpa menaikkan volume harian), dan volume
// besar juga bisa berasal dari aksi korporasi / rebalancing indeks, bukan
// akumulasi. Selalu cek lagi berita emiten sebelum bertindak.
//
// ---- Skor Whale 0-100 (dua sisi, dihitung dari data yang sama) ----
//   Volume ratio +40 : volume hari ini / rata-rata volume 20 hari sebelumnya.
//                      >=3x -> 40, >=2x -> 32, >=1,5x -> 24, >=1,2x -> 14, >=1x -> 6.
//   Arah harga  +25  : akumulasi: naik >=2% -> 25, >=1% -> 20, >=0% -> 12,
//                      -1..0% -> 5. Distribusi: turun <=-2% -> 25, <=-1% -> 18,
//                      <=-0,5% -> 10, <0% -> 5.
//   Beruntun    +20  : hari naik (akumulasi) / hari turun (distribusi)
//                      berturut-turut, maks 5 hari x 4 poin.
//   Turnover    +15  : harga x volume hari ini. >=Rp50 M -> 15, >=Rp20 M -> 12,
//                      >=Rp5 M -> 8, >=Rp1 M -> 4.
// Sinyal:
//   AKUMULASI  : skor akumulasi >=65 DAN volume ratio >=1,5 DAN % harian > 0.
//   DISTRIBUSI : skor distribusi >=60 DAN volume ratio >=1,5 DAN % harian <= -0,5.
//   NETRAL     : selain itu (termasuk data kurang dari 10 hari bursa).
// Setiap verdict menampilkan angka di baliknya (volume ratio, % harian, skor)
// — tidak pernah label kosong tanpa angka.

function whaleVolumeRatio(volumes) {
  const vols = (volumes || []).filter(v => v != null);
  if (vols.length < 2) return { ratio: null, lastVol: null, avgVol: null };
  const lastVol = vols[vols.length - 1];
  const prev = vols.slice(-21, -1); // rata-rata 20 hari SEBELUM hari ini
  if (!prev.length || lastVol == null) return { ratio: null, lastVol, avgVol: null };
  const avgVol = prev.reduce((s, v) => s + v, 0) / prev.length;
  if (!avgVol) return { ratio: null, lastVol, avgVol: null };
  return { ratio: lastVol / avgVol, lastVol, avgVol: Math.round(avgVol) };
}

function whaleStreaks(closes) {
  const valid = (closes || []).filter(v => v != null);
  let up = 0, down = 0;
  for (let i = valid.length - 1; i > 0; i--) {
    if (valid[i] > valid[i - 1]) { if (down === 0) up++; else break; }
    else if (valid[i] < valid[i - 1]) { if (up === 0) down++; else break; }
    else break;
  }
  return { upStreak: up, downStreak: down };
}

function whaleRatioPoints(ratio) {
  if (ratio == null) return 0;
  if (ratio >= 3) return 40;
  if (ratio >= 2) return 32;
  if (ratio >= 1.5) return 24;
  if (ratio >= 1.2) return 14;
  if (ratio >= 1) return 6;
  return 0;
}

function whaleTurnoverPoints(turnover) {
  if (turnover == null) return 0;
  if (turnover >= 50000000000) return 15;
  if (turnover >= 20000000000) return 12;
  if (turnover >= 5000000000) return 8;
  if (turnover >= 1000000000) return 4;
  return 0;
}

function analyzeWhale(code, closes, volumes, previousClose) {
  const valid = (closes || []).filter(v => v != null);
  const price = valid.length ? valid[valid.length - 1] : null;
  const prevClose = previousClose != null ? previousClose
    : (valid.length >= 2 ? valid[valid.length - 2] : null);
  const changePercent = (price != null && prevClose) ? (price - prevClose) / prevClose * 100 : null;
  const { ratio, lastVol, avgVol } = whaleVolumeRatio(volumes);
  const turnover = (price != null && lastVol != null) ? price * lastVol : null;
  const { upStreak, downStreak } = whaleStreaks(closes);
  const reasons = [];

  if (valid.length < 10 || price == null) {
    return { code, signal: "NETRAL", score: 0, accumScore: 0, distScore: 0,
      price, changePercent, volumeRatio: ratio, volume: lastVol, avgVolume: avgVol, turnover,
      upStreak, downStreak, insufficient: true,
      reasons: [`Data hanya ${valid.length} hari bursa — butuh minimal 10 hari untuk membaca jejak volume.`] };
  }

  const volPts = whaleRatioPoints(ratio);
  const turnPts = whaleTurnoverPoints(turnover);

  // --- Skor akumulasi ---
  let accumMove = 0;
  if (changePercent != null) {
    accumMove = changePercent >= 2 ? 25 : changePercent >= 1 ? 20
      : changePercent >= 0 ? 12 : changePercent >= -1 ? 5 : 0;
  }
  const accumScore = volPts + accumMove + Math.min(upStreak, 5) * 4 + turnPts;

  // --- Skor distribusi ---
  let distMove = 0;
  if (changePercent != null) {
    distMove = changePercent <= -2 ? 25 : changePercent <= -1 ? 18
      : changePercent <= -0.5 ? 10 : changePercent < 0 ? 5 : 0;
  }
  const distScore = volPts + distMove + Math.min(downStreak, 5) * 4 + turnPts;

  let signal, score;
  if (accumScore >= 65 && ratio != null && ratio >= 1.5 && changePercent != null && changePercent > 0) {
    signal = "AKUMULASI"; score = accumScore;
  } else if (distScore >= 60 && ratio != null && ratio >= 1.5 && changePercent != null && changePercent <= -0.5) {
    signal = "DISTRIBUSI"; score = distScore;
  } else {
    signal = "NETRAL"; score = Math.max(accumScore, distScore);
  }

  // --- Alasan (Bahasa Indonesia, menyebut angka sebenarnya) ---
  if (ratio != null) {
    reasons.push(`Volume hari ini ${whaleFmtVol(lastVol)} — ${ratio.toFixed(1)}x rata-rata 20 hari (${whaleFmtVol(avgVol)})${ratio >= 2 ? ", volume tidak wajar" : ratio >= 1.5 ? ", volume di atas normal" : ", volume masih normal"}.`);
  } else {
    reasons.push("Volume hari ini tidak tersedia — jejak volume tidak bisa dibaca.");
  }
  if (changePercent != null) {
    reasons.push(`Harga ${changePercent >= 0 ? "naik" : "turun"} ${Math.abs(changePercent).toFixed(2)}% hari ini (Rp${Math.round(price).toLocaleString("id-ID")} vs prev close Rp${Math.round(prevClose).toLocaleString("id-ID")})${changePercent > 0 ? " searah dengan volume besar — ciri akumulasi" : changePercent < 0 ? " searah dengan volume besar — ciri distribusi" : ""}.`);
  }
  if (upStreak >= 2) reasons.push(`Naik ${upStreak} hari bursa berturut-turut.`);
  if (downStreak >= 2) reasons.push(`Turun ${downStreak} hari bursa berturut-turut.`);
  if (turnover != null) {
    reasons.push(`Turnover hari ini ${whaleFmtTurn(turnover)}${turnover >= 20000000000 ? " — nilai transaksi besar, saham likuid" : turnover >= 5000000000 ? " — nilai transaksi cukup besar" : " — nilai transaksi kecil, waspadai saham tidak likuid"}.`);
  }
  if (signal === "NETRAL") {
    reasons.push("Tidak ada jejak volume besar yang searah hari ini — pantau lagi besok, jangan paksa menyimpulkan.");
  }

  return { code, signal, score, accumScore, distScore,
    price, changePercent, volumeRatio: ratio, volume: lastVol, avgVolume: avgVol, turnover,
    upStreak, downStreak, insufficient: false, reasons };
}

function whaleFmtVol(n) {
  if (n == null) return "—";
  return n >= 1000000 ? (n / 1000000).toFixed(1) + " jt" : Math.round(n).toLocaleString("id-ID");
}
function whaleFmtTurn(n) {
  if (n == null) return "—";
  return "Rp" + (n >= 1000000000 ? (n / 1000000000).toFixed(1) + " M" : Math.round(n).toLocaleString("id-ID"));
}
function whaleSignalBadge(signal) {
  const cls = signal === "AKUMULASI" ? "badge-bull" : signal === "DISTRIBUSI" ? "badge-bear" : "badge-neutral";
  return `<span class="badge ${cls}">${signal}</span>`;
}

// Node (untuk harness verifikasi): module.exports — di browser tidak terpakai.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { analyzeWhale, whaleVolumeRatio, whaleStreaks, whaleFmtVol, whaleFmtTurn };
}
