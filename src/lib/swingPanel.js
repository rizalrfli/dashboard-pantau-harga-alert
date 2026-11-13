// src/lib/swingPanel.js — renderer HTML daftar swing & hold.
// Dipakai halaman Swing & Hold (src/pages/swing.astro) DAN halaman Analisa AI
// (src/pages/analisa.astro), supaya tampilannya selalu sama di kedua tempat.
// scope: label sumbernya, mis. "watchlist" atau "dari 911 saham".
// showPageLink: true bila dipanggil dari halaman Analisa (tautan ke halaman
// Swing & Hold sendiri); false di halaman Swing & Hold (sudah di sana).
import { fmtRp } from "./ai.js";
import { stockLogoHTML } from "./logos.js";

export function swingSectionHTML(swingList, holdList, scope, showPageLink = false){
  const row = ({code, swing}) => `<tr>
    <td data-label="Kode"><span style="display:flex;gap:8px;align-items:center">${stockLogoHTML(code, 28)}<b>${code}</b></span></td>
    <td data-label="Skor swing"><b>${swing.swingScore}</b></td>
    <td data-label="Harga">${fmtRp(swing.price)}</td>
    <td data-label="Entry" style="min-width:220px">${swing.entry}</td>
    <td data-label="Stop loss">${swing.stopLoss == null ? "—" : fmtRp(swing.stopLoss)}</td>
    <td data-label="Target"><span class="cell-val">${swing.target == null ? "—" : fmtRp(swing.target)}${swing.target2 != null ? `<br><span class="muted">target 2: ${fmtRp(swing.target2)}</span>` : ""}</span></td>
    <td data-label="Alasan" style="min-width:260px">${swing.reasons.join(" ")}</td>
  </tr>`;
  const table = (list) => `<div class="tablewrap"><table>
    <thead><tr><th>Kode</th><th>Skor swing</th><th>Harga</th><th>Entry</th><th>Stop loss</th><th>Target</th><th>Alasan</th></tr></thead>
    <tbody>${list.map(row).join("")}</tbody>
  </table></div>`;
  return `
    <h3 style="margin-top:16px">Rekomendasi Swing &amp; Hold (1-3 Bulan) — ${scope}</h3>
    ${showPageLink ? `<p class="mini"><a href="swing.html">Lihat di halaman Swing &amp; Hold →</a></p>` : ""}
    <p class="mini">Sinyal berbasis harga &amp; tren (rule-based), bukan saran keuangan — cek fundamental emiten sebelum beli, dan sesuaikan dengan profil risikomu. Klasifikasi: <b>SWING</b> (skor ≥65: uptrend + entry bagus, layak dibeli untuk dipegang 1-3 bulan), <b>HOLD</b> (skor 55-64 atau uptrend kuat tapi harga sudah jauh di atas MA50: yang sudah punya = pegang 1-3 bulan, yang belum punya = tunggu pullback ke MA20), <b>TUNGGU</b> (skor 40-54: tren belum terkonfirmasi), <b>HINDARI</b> (skor &lt;40: downtrend). Stop loss ~5-8% di bawah harga, target swing +10-15%, target hold +8-12%.</p>
    <h4 style="margin-top:12px">Swing — beli sekarang / di pullback (${swingList.length})</h4>
    ${swingList.length ? table(swingList) : `<p><b>Tidak ada saham yang lolos kriteria swing.</b> Tunggu sampai ada saham dengan uptrend terkonfirmasi + entry bagus (pullback ke MA20 atau breakout resistance).</p>`}
    <h4 style="margin-top:12px">Hold — pegang 1-3 bulan (${holdList.length})</h4>
    ${holdList.length ? table(holdList) : `<p><b>Tidak ada saham yang masuk kategori hold.</b> Saham yang sudah naik jauh tapi trennya masih kuat akan muncul di sini.</p>`}`;
}
