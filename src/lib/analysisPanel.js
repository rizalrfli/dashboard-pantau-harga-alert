// src/lib/analysisPanel.js — panel "Analisa AI" per saham.
//
// renderAiPanel() sebelumnya diduplikasi identik di index.html dan
// analisa.html; sekarang satu sumber di sini, dipakai kedua halaman.
// Logika/markup tidak diubah.
import { fmtRp, suggestionBadge } from "./ai.js";

const $ = (s) => document.querySelector(s);

export function renderAiPanel(code, a){
  const el=$("#aiPanel");
  if(!a){ el.classList.add("hidden"); el.innerHTML=""; return; }
  const cls = a.verdict==="BULLISH" ? "badge-bull" : a.verdict==="BEARISH" ? "badge-bear" : "badge-neutral";
  const barColor = a.verdict==="BULLISH" ? "#16a34a" : a.verdict==="BEARISH" ? "#dc2626" : "#94a3b8";
  el.classList.remove("hidden");
  el.innerHTML = `
    <h3>Analisa AI — ${code}</h3>
    <div class="row"><span class="badge ${cls}" style="font-size:14px">${a.verdict}</span><b>Skor ${a.score}/100</b><span>${suggestionBadge(a.suggestion)}</span></div>
    <div class="scorebar"><i style="width:${a.score}%;background:${barColor}"></i></div>
    <div class="mini">Tren: ${a.trend} • Momentum: ${a.momentum}</div>
    <ul>${a.reasons.map(r=>`<li>${r}</li>`).join("")}</ul>
    <table class="ai-plan">
      <tr><td>Saran</td><td><b>${a.suggestion}</b></td></tr>
      <tr><td>Entry</td><td>${a.entry}</td></tr>
      <tr><td>Stop loss</td><td>${fmtRp(a.stopLoss)}</td></tr>
      <tr><td>Target 1</td><td>${fmtRp(a.target1)}</td></tr>
      <tr><td>Target 2</td><td>${fmtRp(a.target2)}</td></tr>
    </table>
    <p class="mini" style="margin-top:8px">${a.riskNote}</p>
    <p class="mini">Analisa rule-based (MA20/MA50, RSI, MACD, support/resistance) dari data Yahoo Finance — bukan rekomendasi investasi dan bukan prediksi pasti.</p>`;
}
