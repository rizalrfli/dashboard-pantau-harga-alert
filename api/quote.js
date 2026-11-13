// api/quote.js — Vercel Serverless Function
// Proxy harga saham IDX dari Yahoo Finance (publik, tanpa API key).
// GET /api/quote?symbols=BBCA.JK,BBRI.JK,^JKSE
// atau GET /api/quote?symbol=BBCA.JK
// Balasan: { results: [{symbol, price, previousClose, change, changePercent,
//   dayHigh, dayLow, volume, currency, longName, marketTime}], errors: [...] }

const YAHOO_HOSTS = [
  'https://query1.finance.yahoo.com',
  'https://query2.finance.yahoo.com',
];

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Harga saham berubah tiap menit; cache 60 detik di CDN + browser.
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
}

function normaliseSymbol(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return null;
  if (s === '^JKSE' || s === 'IHSG') return '^JKSE';
  // Terima BBCA, BBCA.JK, bbca.jk -> BBCA.JK
  const code = s.replace(/\.JK$/, '');
  if (!/^[A-Z0-9]{2,6}$/.test(code)) return null;
  return `${code}.JK`;
}

async function fetchQuote(symbol) {
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  let lastErr = null;
  for (const host of YAHOO_HOSTS) {
    try {
      const r = await fetch(host + path, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; IDX-Dashboard/1.0)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) { lastErr = new Error(`Yahoo ${r.status}`); continue; }
      const j = await r.json();
      const result = j?.chart?.result?.[0];
      if (!result) { lastErr = new Error('Yahoo: no result'); continue; }
      const meta = result.meta || {};
      const price = meta.regularMarketPrice ?? meta.fulldayPrice ?? null;
      // previousClose dari meta bisa tidak akurat untuk beberapa simbol;
      // pakai chartPreviousClose bila ada, fallback ke previousClose.
      const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
      if (price == null) { lastErr = new Error('Yahoo: no price'); continue; }
      const change = previousClose != null ? price - previousClose : null;
      const changePercent =
        previousClose != null && previousClose !== 0
          ? (change / previousClose) * 100
          : (meta.regularMarketChangePercent ?? null);
      return {
        symbol: meta.symbol || symbol,
        price,
        previousClose,
        change,
        changePercent,
        dayHigh: meta.regularMarketDayHigh ?? null,
        dayLow: meta.regularMarketDayLow ?? null,
        volume: meta.regularMarketVolume ?? null,
        currency: meta.currency || 'IDR',
        longName: meta.longName || meta.shortName || symbol,
        marketTime: meta.regularMarketTime
          ? new Date(meta.regularMarketTime * 1000).toISOString()
          : null,
      };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Yahoo fetch failed');
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const raw =
    req.query.symbols || req.query.symbol || req.query.s || '';
  const symbols = String(raw)
    .split(',')
    .map(normaliseSymbol)
    .filter(Boolean)
    .slice(0, 30);
  if (!symbols.length) {
    return res.status(400).json({ error: 'Parameter symbols wajib diisi, contoh: ?symbols=BBCA.JK,BBRI.JK' });
  }

  const results = [];
  const errors = [];
  await Promise.all(
    symbols.map(async (sym) => {
      try {
        results.push(await fetchQuote(sym));
      } catch (e) {
        errors.push({ symbol: sym, error: String(e?.message || e) });
      }
    })
  );
  // Urutan hasil mengikuti urutan permintaan.
  results.sort((a, b) => symbols.indexOf(a.symbol) - symbols.indexOf(b.symbol));
  return res.status(200).json({ results, errors });
};
