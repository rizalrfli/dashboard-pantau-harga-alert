// api/chart.js — Vercel Serverless Function
// Proxy data historis saham IDX dari Yahoo Finance (publik, tanpa API key).
// GET /api/chart?symbol=BBCA.JK&range=1mo|3mo|6mo  (default 3mo)
// Balasan: { symbol, range, currency, previousClose, timestamps, closes }
// timestamps: epoch detik, closes: harga penutupan (null bila data kosong).

const YAHOO_HOSTS = [
  'https://query1.finance.yahoo.com',
  'https://query2.finance.yahoo.com',
];

const ALLOWED_RANGES = new Set(['1mo', '3mo', '6mo', '1y']);

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
}

function normaliseSymbol(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return null;
  if (s === '^JKSE' || s === 'IHSG') return '^JKSE';
  const code = s.replace(/\.JK$/, '');
  if (!/^[A-Z0-9]{2,6}$/.test(code)) return null;
  return `${code}.JK`;
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const symbol = normaliseSymbol(req.query.symbol || req.query.s || '');
  if (!symbol) {
    return res.status(400).json({ error: 'Parameter symbol wajib diisi, contoh: ?symbol=BBCA.JK' });
  }
  const range = ALLOWED_RANGES.has(String(req.query.range || '')) ? req.query.range : '3mo';
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;

  let lastErr = null;
  for (const host of YAHOO_HOSTS) {
    try {
      const r = await fetch(host + path, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; IDX-Dashboard/1.0)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) { lastErr = new Error(`Yahoo ${r.status}`); continue; }
      const j = await r.json();
      const result = j?.chart?.result?.[0];
      if (!result) { lastErr = new Error('Yahoo: no result'); continue; }
      const meta = result.meta || {};
      const timestamps = result.timestamp || [];
      const closes = (result.indicators?.quote?.[0]?.close || []).map((v) =>
        v == null ? null : v
      );
      // chartPreviousClose Yahoo untuk range >1d adalah harga awal rentang,
      // bukan penutupan kemarin — jadi hitung dari bar harian terakhir.
      const valid = closes.filter((v) => v != null);
      const previousClose =
        valid.length >= 2
          ? valid[valid.length - 2]
          : (meta.chartPreviousClose ?? meta.previousClose ?? null);
      return res.status(200).json({
        symbol: meta.symbol || symbol,
        range,
        currency: meta.currency || 'IDR',
        previousClose,
        timestamps,
        closes,
      });
    } catch (e) {
      lastErr = e;
    }
  }
  return res.status(502).json({ error: 'Gagal mengambil data dari Yahoo Finance', detail: String(lastErr?.message || lastErr) });
};
