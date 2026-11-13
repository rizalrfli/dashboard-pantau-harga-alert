// ai.js — logika analisa AI (rule-based, transparan) + helper format angka.
// Dipakai bersama oleh index.html dan analisa.html. Tidak ada duplikasi.
// Dihitung di browser dari data Yahoo Finance, tanpa API key / LLM.
const fmtRp = n => n==null ? "—" : "Rp" + Math.round(n).toLocaleString("id-ID");
const fmtPct = n => n==null ? "—" : (n>=0?"+":"") + n.toFixed(2) + "%";
const fmtNum = n => n==null ? "—" : Math.round(n).toLocaleString("id-ID");
function sma(arr, n){ const out=[]; for(let i=0;i<arr.length;i++){ if(i<n-1){out.push(null);continue;} let s=0,ok=true; for(let j=i-n+1;j<=i;j++){ if(arr[j]==null){ok=false;break;} s+=arr[j]; } out.push(ok?s/n:null); } return out; }
function rsi(closes, period=14){
  if(closes.length<=period) return null;
  let gains=0, losses=0;
  for(let i=1;i<=period;i++){ const d=closes[i]-closes[i-1]; if(d>=0) gains+=d; else losses-=d; }
  let avgG=gains/period, avgL=losses/period;
  for(let i=period+1;i<closes.length;i++){ const d=closes[i]-closes[i-1]; const g=Math.max(d,0), l=Math.max(-d,0); avgG=(avgG*(period-1)+g)/period; avgL=(avgL*(period-1)+l)/period; }
  if(avgL===0) return 100;
  return 100 - (100/(1+avgG/avgL));
}
// ---- Analisa AI (rule-based, transparan — dihitung di browser, tanpa API key) ----
// SKOR 0-100, total dari 4 komponen:
//   Tren +40      : harga vs MA20 (+12), harga vs MA50 (+12), MA20 vs MA50 (+16 golden cross).
//                   Bila MA50 belum ada (data < 50 hari), harga vs MA20 saja (+28) + tren naik (+12).
//   Momentum +30  : RSI di zona 45-65 (+12), MACD histogram positif (+10) dan naik (+8).
//   Posisi harga +15: ruang ke resistance — makin jauh dari resistance makin besar
//                   (+15 bila ruang >50% dari rentang support-resistance, +10 bila 25-50%,
//                   +5 bila <25%, +12 bila sudah tembus resistance, +2 bila di bawah support).
//   Perubahan harian +15: +15 bila naik ≥1%, +11 bila 0-1%, +7 bila -1-0%, +4 bila -2--1%, 0 bila <-2%.
// Verdict: skor >=65 BULLISH, <=35 BEARISH, sisanya NETRAL.
// Saran (4 kategori):
//   Masuk            : BULLISH dan RSI < 70 — tren + momentum searah, harga belum overbought.
//   Tunggu           : BULLISH tapi RSI >= 70 — sinyal bagus tapi harga ketinggian (overbought),
//                      tunggu koreksi ke MA20. Bukan WNS: arahnya sudah jelas bullish.
//   Wait and See (WNS): NETRAL / sinyal bertentangan / skor 40-60 — jangan masuk dulu,
//                      pantau konfirmasi: tunggu harga tembus resistance / bertahan di atas MA20
//                      atau RSI menguat, baru pertimbangkan masuk.
//   Hindari          : BEARISH — tren dan momentum melemah, jangan masuk dulu.
function ema(arr, n){
  const out=[]; const k=2/(n+1); let prev=null;
  for(let i=0;i<arr.length;i++){
    if(arr[i]==null){ out.push(null); continue; }
    if(prev==null){ prev=arr[i]; out.push(prev); continue; }
    prev = arr[i]*k + prev*(1-k); out.push(prev);
  }
  return out;
}
function macd(closes){
  const valid=closes.filter(v=>v!=null);
  if(valid.length<35) return {macdLine:null, signal:null, histogram:null, prevHistogram:null};
  const e12=ema(valid,12), e26=ema(valid,26);
  const line=e12.map((v,i)=> v==null||e26[i]==null ? null : v-e26[i]);
  const lineValid=line.filter(v=>v!=null);
  const sigFull=ema(lineValid,9); // signal[j] sejajar lineValid[j]
  const last=lineValid[lineValid.length-1];
  const lastSig=sigFull[sigFull.length-1];
  const prevHist = lineValid.length>=2 && sigFull.length>=2
    ? lineValid[lineValid.length-2]-sigFull[sigFull.length-2] : null;
  return {macdLine:last, signal:lastSig, histogram:(last!=null&&lastSig!=null)?last-lastSig:null, prevHistogram:prevHist};
}
function supportResistance(closes, n=20){
  const valid=closes.filter(v=>v!=null).slice(-n);
  if(!valid.length) return {support:null, resistance:null};
  return {support:Math.min(...valid), resistance:Math.max(...valid)};
}
function analyzeStock(code, closes, quote){
  const valid=(closes||[]).filter(v=>v!=null);
  const price = quote?.price ?? valid[valid.length-1] ?? null;
  const changePercent = quote?.changePercent ?? (quote?.previousClose && price!=null ? (price-quote.previousClose)/quote.previousClose*100 : null);
  const reasons=[];
  if(!valid.length || price==null) return {score:50, verdict:"NETRAL", trend:"Tidak diketahui", momentum:"Tidak diketahui", reasons:["Data harga belum cukup untuk dianalisa."], suggestion:"Wait and See (WNS)", entry:"Pantau dulu — data belum cukup", stopLoss:null, target1:null, target2:null, riskNote:"Wait and See (WNS): jangan masuk dulu, pantau konfirmasi: tunggu harga tembus resistance / bertahan di atas MA20 atau RSI menguat, baru pertimbangkan masuk.", rsi:null, ma20:null, ma50:null, macdHist:null, support:null, resistance:null, price, changePercent};
  // Data kurang dari 20 hari bursa: MA20 belum terbentuk, RSI/MACD belum bisa
  // diandalkan — jangan dipaksa jadi BULLISH/BEARISH, hasilnya WNS.
  if(valid.length<20) return {score:50, verdict:"NETRAL", trend:"Tidak diketahui", momentum:"Tidak diketahui", reasons:[`Data hanya ${valid.length} hari bursa (butuh minimal 20 hari) — MA20/RSI/MACD belum bisa diandalkan.`], suggestion:"Wait and See (WNS)", entry:"Pantau dulu — data belum cukup", stopLoss:null, target1:null, target2:null, riskNote:"Wait and See (WNS): jangan masuk dulu, pantau konfirmasi: tunggu harga tembus resistance / bertahan di atas MA20 atau RSI menguat, baru pertimbangkan masuk.", rsi:null, ma20:null, ma50:null, macdHist:null, support:null, resistance:null, price, changePercent};
  const ma20Arr=sma(closes,20), ma50Arr=sma(closes,50);
  const ma20=ma20Arr.filter(v=>v!=null).pop() ?? null;
  const ma50=ma50Arr.filter(v=>v!=null).pop() ?? null;
  const rsiVal=rsi(valid);
  const m=macd(closes);
  const {support, resistance}=supportResistance(closes,20);

  // --- Skor: tren (max 40) ---
  // Selisih harus bermakna (>1%) baru dapat poin penuh — harga yang cuma
  // 0,2% di atas MA datar tidak boleh dihitung sebagai uptrend.
  let trendScore=0;
  const gap=(p,m)=> m ? (p-m)/m : 0;
  if(ma50!=null){
    const g20=gap(price,ma20), g50=gap(price,ma50), gCross=gap(ma20,ma50);
    trendScore += g20>0.01 ? 12 : g20>0 ? 6 : 0;
    trendScore += g50>0.01 ? 12 : g50>0 ? 6 : 0;
    trendScore += gCross>0.01 ? 16 : gCross>0 ? 8 : 0;
  } else if(ma20!=null){
    trendScore += gap(price,ma20)>0.01 ? 28 : gap(price,ma20)>0 ? 14 : 10;
    const last=valid[valid.length-1], prev=valid[valid.length-2];
    if(last!=null && prev!=null && last>prev) trendScore+=12;
  }
  // --- Skor: momentum (max 30) ---
  let momScore=0;
  if(rsiVal!=null){
    if(rsiVal>=45 && rsiVal<=65) momScore+=12;
    else if((rsiVal>=30 && rsiVal<45) || (rsiVal>65 && rsiVal<70)) momScore+=7;
    else if(rsiVal<30) momScore+=4;
    else momScore+=2; // >=70 overbought
  }
  if(m.histogram!=null){
    if(m.histogram>0) momScore+=10;
    if(m.prevHistogram!=null && m.histogram>m.prevHistogram) momScore+=8;
    else if(m.prevHistogram!=null) momScore+=2;
    else momScore+=4;
  }
  // --- Skor: posisi harga (max 15) ---
  let posScore=7;
  if(support!=null && resistance!=null && resistance>support){
    if(price>=resistance) posScore=12;
    else if(price<support) posScore=2;
    else {
      const room=(resistance-price)/(resistance-support);
      posScore = room>0.5 ? 15 : room>=0.25 ? 10 : 5;
    }
  }
  // --- Skor: perubahan harian (max 15) ---
  let chgScore=7;
  if(changePercent!=null){
    chgScore = changePercent>=1 ? 15 : changePercent>=0 ? 11 : changePercent>=-1 ? 7 : changePercent>=-2 ? 4 : 0;
  }
  const score=Math.max(0, Math.min(100, Math.round(trendScore+momScore+posScore+chgScore)));
  const verdict = score>=65 ? "BULLISH" : score<=35 ? "BEARISH" : "NETRAL";
  const trend = (ma20!=null && ma50!=null)
    ? (price>ma20 && ma20>ma50 ? "Naik (uptrend)" : price<ma20 && ma20<ma50 ? "Turun (downtrend)" : "Mendatar / campuran")
    : (ma20!=null && price>ma20 ? "Naik (di atas MA20)" : ma20!=null ? "Turun (di bawah MA20)" : "Tidak diketahui");
  const momentum = (m.histogram!=null && m.prevHistogram!=null)
    ? (m.histogram>0 && m.histogram>m.prevHistogram ? "Menguat" : m.histogram<0 && m.histogram<m.prevHistogram ? "Melemah" : "Campuran")
    : "Tidak diketahui";

  // --- Alasan (Bahasa Indonesia, menyebut angka sebenarnya) ---
  if(ma20!=null && ma50!=null){
    reasons.push(`Harga ${fmtRp(price)} ${price>ma20?"di atas":"di bawah"} MA20 ${fmtRp(ma20)} dan ${price>ma50?"di atas":"di bawah"} MA50 ${fmtRp(ma50)} — MA20 ${ma20>ma50?"di atas MA50 (golden cross, tren naik)":"di bawah MA50 (death cross, tren turun)"}.`);
  } else if(ma20!=null){
    reasons.push(`Harga ${fmtRp(price)} ${price>ma20?"di atas":"di bawah"} MA20 ${fmtRp(ma20)} (MA50 belum tersedia, data kurang dari 50 hari).`);
  }
  if(rsiVal!=null){
    reasons.push(`RSI (14) ${rsiVal.toFixed(1)} — ${rsiVal>=70?"overbought, harga sudah terlalu tinggi":rsiVal<=30?"oversold, harga sudah terlalu murah":rsiVal>=45&&rsiVal<=65?"di zona netral-sehat, momentum terjaga":"di zona lemah"}.`);
  }
  if(m.histogram!=null){
    reasons.push(`MACD histogram ${m.histogram>=0?"+":""}${Math.round(m.histogram)} (${m.histogram>0?"positif":"negatif"})${m.prevHistogram!=null?(m.histogram>m.prevHistogram?" dan naik dari "+Math.round(m.prevHistogram):" dan turun dari "+Math.round(m.prevHistogram)):""} — garis MACD ${fmtRp(m.macdLine)} vs sinyal ${fmtRp(m.signal)}.`);
  }
  if(support!=null && resistance!=null){
    if(price>=resistance){
      reasons.push(`Harga ${fmtRp(price)} sudah di resistance tertinggi 20 hari (${fmtRp(resistance)}) — tembus ke atas berarti sinyal lanjut naik, gagal tembus berarti rawan koreksi. Support terdekat ${fmtRp(support)}.`);
    } else {
      const roomPct = resistance>support ? ((resistance-price)/(resistance-support)*100) : 0;
      reasons.push(`Harga ${fmtRp(price)}, support terdekat ${fmtRp(support)}, resistance terdekat ${fmtRp(resistance)} — ruang naik ke resistance ${roomPct.toFixed(0)}%.`);
    }
  }
  if(changePercent!=null){
    reasons.push(`Perubahan hari ini ${fmtPct(changePercent)} vs prev close ${fmtRp(quote?.previousClose)}.`);
  }

  // --- Saran + rencana entry ---
  const range = (support!=null && resistance!=null && resistance>support) ? resistance-support : null;
  // Stop loss = support terdekat, tapi hanya bila support itu benar-benar di
  // bawah harga (minimal 1%) dan tidak terlalu jauh (maks 7%); bila tidak,
  // pakai -3% dari harga. Stop loss tidak boleh sama dengan harga masuk.
  const stopFallback = price!=null ? Math.round(price*0.97) : null; // -3% bila support jauh
  let stopLoss = (support!=null && price!=null && support < price*0.99 && (price-support)/price<=0.07)
    ? support : stopFallback;
  let suggestion, entry, riskNote, target1, target2;
  if(verdict==="BULLISH" && rsiVal!=null && rsiVal>=70){
    suggestion="Tunggu";
    entry=`Tunggu koreksi ke MA20 ${fmtRp(ma20)}`;
    target1 = resistance;
    target2 = (resistance!=null && range!=null) ? Math.round(resistance + range*0.5) : null;
    riskNote="Tunggu: sinyalnya sudah bagus (bullish) tapi RSI ≥70, harga ketinggian — jangan kejar harga, tunggu koreksi ke MA20. Ini beda dengan Wait and See (WNS): 'Tunggu' dipakai saat arah sudah jelas bullish tapi harga terlalu tinggi, sedangkan WNS dipakai saat sinyal masih bertentangan/netral dan belum ada konfirmasi arah.";
  } else if(verdict==="BULLISH"){
    suggestion="Masuk";
    entry=(resistance!=null && resistance>price) ? `${fmtRp(price)} – ${fmtRp(resistance)}` : `${fmtRp(price)} (sudah di resistance, masuk saat tembus ke atas)`;
    target1 = resistance;
    target2 = (resistance!=null && range!=null) ? Math.round(resistance + range*0.5) : null;
    riskNote="Masuk: tren dan momentum searah ke atas, harga belum overbought. Tetap pasang stop loss dan jangan pakai seluruh modal dalam satu saham.";
  } else if(verdict==="BEARISH"){
    suggestion="Hindari";
    entry="— (jangan masuk dulu)";
    // Bearish: stop loss = resistance (tembus ke atas = tesis bearish batal),
    // target = support dan kelanjutannya ke bawah.
    stopLoss = resistance ?? stopFallback;
    target1 = support;
    target2 = (support!=null && range!=null) ? Math.round(support - range*0.5) : null;
    riskNote="Hindari: tren dan momentum melemah, harga di bawah MA20/MA50. Masuk hanya bila ada pembalikan terkonfirmasi (tembus resistance / MA20 dengan volume).";
  } else {
    suggestion="Wait and See (WNS)";
    entry=`Pantau dulu — masuk bila tembus ${fmtRp(resistance)} atau bertahan di atas MA20 ${fmtRp(ma20)}`;
    target1 = resistance;
    target2 = (resistance!=null && range!=null) ? Math.round(resistance + range*0.5) : null;
    riskNote="Wait and See (WNS): jangan masuk dulu, pantau konfirmasi: tunggu harga tembus resistance / bertahan di atas MA20 atau RSI menguat, baru pertimbangkan masuk. Ini beda dengan 'Tunggu': WNS dipakai saat sinyal masih bertentangan/netral (skor 40-60), sedangkan 'Tunggu' dipakai saat sudah bullish tapi RSI ≥70 (overbought) dan menunggu koreksi ke MA20.";
  }
  return {score, verdict, trend, momentum, reasons, suggestion, entry, stopLoss, target1, target2, riskNote,
    rsi:rsiVal, ma20, ma50, macdHist:m.histogram, macdLine:m.macdLine, signal:m.signal, support, resistance, price, changePercent};
}
// ---- Skor scalping (terpisah dari skor analisa utama, 0-100) ----
//   Range harian +30 : (high-low)/prevClose >=3% +30, 2-3% +25, 1,5-2% +18, <1,5% tidak lolos.
//   Likuiditas +25   : volume >=20 jt & turnover >=Rp20 M +25, >=5 jt & >=Rp5 M +18, di bawah itu +5.
//   RSI +20          : 45-65 +20, 40-45/65-70 +10, di luar itu 0.
//   MACD +15         : histogram >0 +15, <=0 0.
//   Di atas MA20 +10 : harga > MA20 +10, <= MA20 0.
// Lolos scalping HANYA bila SEMUA syarat terpenuhi: range >=1,5%, RSI 45-65,
// MACD positif, harga di atas MA20, volume >=5 jt dan turnover >=Rp5 M.
// Volume rata-rata dihitung dari volumes chart 20 hari terakhir; bila volumes
// tidak tersedia, fallback ke volume hari ini dari quote.
function analyzeScalping(code, volumes, quote, ai){
  const price = ai?.price ?? quote?.price ?? null;
  const prevClose = quote?.previousClose ?? null;
  const volume = quote?.volume ?? null;
  const turnover = (price!=null && volume!=null) ? price*volume : null;
  const rangePct = (quote?.dayHigh!=null && quote?.dayLow!=null && prevClose)
    ? (quote.dayHigh-quote.dayLow)/prevClose*100 : null;
  const vols=(volumes||[]).filter(v=>v!=null).slice(-20);
  const avgVolume = vols.length ? Math.round(vols.reduce((s,v)=>s+v,0)/vols.length) : null;
  let score=0;
  if(rangePct!=null) score += rangePct>=3 ? 30 : rangePct>=2 ? 25 : rangePct>=1.5 ? 18 : 0;
  if(volume!=null && turnover!=null) score += (volume>=20000000 && turnover>=20000000000) ? 25 : (volume>=5000000 && turnover>=5000000000) ? 18 : 5;
  if(ai?.rsi!=null) score += (ai.rsi>=45 && ai.rsi<=65) ? 20 : ((ai.rsi>=40 && ai.rsi<45)||(ai.rsi>65 && ai.rsi<=70)) ? 10 : 0;
  if(ai?.macdHist!=null && ai.macdHist>0) score+=15;
  if(ai?.ma20!=null && price!=null && price>ai.ma20) score+=10;
  const eligible = rangePct!=null && rangePct>=1.5
    && ai?.rsi!=null && ai.rsi>=45 && ai.rsi<=65
    && ai?.macdHist!=null && ai.macdHist>0
    && ai?.ma20!=null && price!=null && price>ai.ma20
    && volume!=null && volume>=5000000 && turnover!=null && turnover>=5000000000;
  const parts=[];
  if(rangePct!=null){
    parts.push(rangePct>=3
      ? `Range ${rangePct.toFixed(1)}% — gerak besar, cepat naik-turun: hati-hati, jangan kejar harga, pakai stop loss ketat.`
      : rangePct>=1.5
      ? `Range ${rangePct.toFixed(1)}% — cukup gerak untuk scalping, pakai stop loss ketat.`
      : `Range ${rangePct.toFixed(1)}% — terlalu kecil untuk scalping (butuh minimal 1,5%).`);
  }
  if(volume!=null){
    const volJt=(volume/1000000).toFixed(1);
    parts.push(avgVolume!=null
      ? `Volume ${volJt} jt, ${volume>=avgVolume?"di atas":"di bawah"} rata-rata ${(avgVolume/1000000).toFixed(1)} jt — likuiditas ${volume>=avgVolume?"bagus":"biasa saja"}.`
      : `Volume ${volJt} jt hari ini.`);
  }
  if(!eligible){
    const why=[];
    if(rangePct==null) why.push("range harian tidak tersedia");
    else if(rangePct<1.5) why.push(`range harian cuma ${rangePct.toFixed(1)}% (<1,5%)`);
    if(ai?.rsi==null) why.push("RSI tidak tersedia");
    else if(ai.rsi<45||ai.rsi>65) why.push(`RSI ${ai.rsi.toFixed(1)} di luar 45-65`);
    if(ai?.macdHist==null || ai.macdHist<=0) why.push("MACD tidak positif");
    if(!(ai?.ma20!=null && price!=null && price>ai.ma20)) why.push("harga tidak di atas MA20");
    if(volume==null || volume<5000000 || turnover==null || turnover<5000000000) why.push("likuiditas kurang (volume/turnover kecil)");
    parts.push("Tidak lolos: "+why.join("; ")+".");
  }
  return {eligible, score, rangePct, volume, avgVolume, turnover, note:parts.join(" ")};
}
const fmtVol = n => n==null ? "—" : (n>=1000000 ? (n/1000000).toFixed(1)+" jt" : Math.round(n).toLocaleString("id-ID"));
const fmtTurn = n => n==null ? "—" : "Rp" + (n>=1000000000 ? (n/1000000000).toFixed(1)+" M" : Math.round(n).toLocaleString("id-ID"));
function verdictBadge(a){
  if(!a) return "";
  const cls = a.verdict==="BULLISH" ? "badge-bull" : a.verdict==="BEARISH" ? "badge-bear" : "badge-neutral";
  return `<span class="badge ${cls}">${a.verdict} ${a.score}</span>`;
}
function suggestionBadge(s){
  const cls = s==="Masuk" ? "badge-bull" : s==="Hindari" ? "badge-bear" : s==="Wait and See (WNS)" ? "badge-wns" : "badge-neutral";
  return `<span class="badge ${cls}">${s}</span>`;
}
