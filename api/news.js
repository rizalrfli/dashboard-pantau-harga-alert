// api/news.js — Vercel Serverless Function
// Berita pasar saham terbaru dari Google News RSS (publik, tanpa API key).
// GET /api/news — berita umum IHSG & pasar Indonesia
// GET /api/news?symbols=BBCA,BBRI — ditambah berita per saham (maks 4 kode)
// Balasan: { updatedAt, count, items: [{title, link, source, publishedAt,
//   snippet, sentiment, topics}] }
// Hanya judul + cuplikan dari RSS; artikel lengkap dibaca di situs sumber
// (tautan dibuka di tab baru). Semua berita ditampilkan apa adanya —
// positif maupun negatif — tanpa disaring berdasarkan sentimen.

const FEED_BASE = 'https://news.google.com/rss/search';
const FETCH_TIMEOUT_MS = 7000; // per feed; semua feed diambil paralel
const CACHE_TTL_MS = 10 * 60 * 1000; // cache 10 menit di memori function
const MAX_ITEMS = 30;
const MAX_TICKER_FEEDS = 4;

// Artikel yang diminta dihapus user — tidak pernah ditampilkan lagi.
// Tambah link lengkap artikel lain di sini bila perlu disembunyikan juga.
const BLOCKED_LINKS = [
  'https://news.google.com/rss/articles/CBMirgFBVV95cUxNTnAwTTFpN1Q1UUtjemZPSTJ3Q3gwdFJiYndhZjFKMkFORTJuNTFEb0lDQnNVeENrbHFoZkdHTlgwWVFOX2FXNkoxeHJEMDdTR1IyQ01peHBiVW5YdjZrSk1fRDd4eFRFZGF0SXBRTmRDR2o4Q1daV1NwQVNZdmFuOGprNVI0amN0OVFOUXY4WmZ1UHZUVUhaNnZ3WmtqcVRrOHhOb3BDZlk1eTRrdWfSAaYBQVVfeXFMUDBGOWY0cEk0ejZJZEVFdmZuZk1DUElRNjRMOGNMM0NXUXJvTTVsMENtQ3FTWXBVdm1rQk9oT3REaDBBUm03cmpxejJZVDZGYzFhUldHY01sWmIwQTdGMEdNU1FxMXRuNjdpTzNGZHBLTUhMNFVXbzIxUVhPTmNNVWpSMXVoZDJYN2dscXJ5X3dLTUNrTk1vSTRoWEZITW80d2lFbDB6dw?oc=5', // "Ini 10 Saham dengan Bobot Terbesar di IHSG Usai 300 Saham HSC Dikeluarkan" — kontan.co.id
];

// Kueri umum — pasar Indonesia, bukan satu saham.
const BASE_QUERIES = [
  { q: 'IHSG', topic: 'IHSG & Pasar' },
  { q: 'saham Indonesia', topic: 'IHSG & Pasar' },
  { q: 'bursa efek Indonesia', topic: 'IHSG & Pasar' },
];

// Tag sentimen perkiraan dari kata kunci saja — bukan analisis.
// Tidak pernah dipakai untuk menyembunyikan atau menurunkan berita apa pun.
const POS_WORDS = ['naik', 'menguat', 'untung', 'laba', 'rekor', 'positif', 'melonjak', 'rally', 'cuan', 'dividen', 'buyback', 'ekspansi', 'tumbuh', 'kinerja positif', 'tertinggi'];
const NEG_WORDS = ['turun', 'melemah', 'rugi', 'anjlok', 'negatif', 'jatuh', 'koreksi', 'lesu', 'tertekan', 'gagal', 'sanksi', 'denda', 'terendah', 'ambruk', 'merosot'];

let cache = null; // { key, at, data }

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Berita berubah tiap beberapa menit; cache CDN 5 menit.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
}

function normaliseCode(raw) {
  const c = String(raw || '').trim().toUpperCase().replace(/\.JK$/, '');
  return /^[A-Z0-9]{2,6}$/.test(c) ? c : null;
}

// Hapus tag HTML + CDATA, dan decode entity umum dari RSS.
function cleanText(s) {
  if (!s) return '';
  let t = String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  t = t.replace(/<[^>]*>/g, ' ');
  t = t
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  return t.replace(/\s+/g, ' ').trim();
}

function extract(block, tag) {
  // Ambil isi <tag>…</tag> pertama di dalam satu <item>.
  const m = block.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i'));
  return m ? cleanText(m[1]) : '';
}

function extractSource(block) {
  const m = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
  return m ? cleanText(m[1]) : '';
}

// Cuplikan Google News sering berisi judul + nama media di awal
// ("Judul berita - Nama Media"). Potong ekor " - Media" bila sama
// dengan sumber, supaya cuplikan tidak mengulang judul.
function tidySnippet(snippet, title, source) {
  let s = snippet || '';
  if (source && s.endsWith(' - ' + source)) s = s.slice(0, -(' - ' + source).length).trim();
  if (s === title) return '';
  if (s.length > 220) s = s.slice(0, 220).trim() + '…';
  return s;
}

function sentimentOf(text) {
  const t = ' ' + text.toLowerCase() + ' ';
  let pos = 0, neg = 0;
  for (const w of POS_WORDS) if (t.includes(w)) pos++;
  for (const w of NEG_WORDS) if (t.includes(w)) neg++;
  if (pos > neg) return 'Positif';
  if (neg > pos) return 'Negatif';
  return 'Netral';
}

function parseRss(xml, topic) {
  const items = [];
  const blocks = String(xml || '').match(/<item>([\s\S]*?)<\/item>/gi) || [];
  for (const block of blocks) {
    const link = extract(block, 'link');
    let title = extract(block, 'title');
    if (!link || !title) continue;
    const pubRaw = extract(block, 'pubDate');
    const pub = pubRaw ? new Date(pubRaw) : null;
    const source = extractSource(block) || 'Google News';
    // Judul RSS Google News sering berakhir " - Nama Media"; potong ekor
    // itu karena sumber sudah ditampilkan terpisah di kartu berita.
    if (source && title.endsWith(' - ' + source)) {
      title = title.slice(0, -(' - ' + source).length).trim();
    }
    const snippet = tidySnippet(extract(block, 'description'), title, source);
    items.push({
      title,
      link,
      source,
      publishedAt: pub && !isNaN(pub) ? pub.toISOString() : null,
      snippet,
      sentiment: sentimentOf(title + ' ' + snippet),
      topics: [topic],
    });
  }
  return items;
}

async function fetchFeed(query, topic) {
  const url = `${FEED_BASE}?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ScreenerAI-News/1.0)',
      Accept: 'application/rss+xml, application/xml, text/xml',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`Google News ${r.status}`);
  const xml = await r.text();
  return parseRss(xml, topic);
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const codes = String(req.query.symbols || '')
    .split(',')
    .map(normaliseCode)
    .filter(Boolean)
    .slice(0, MAX_TICKER_FEEDS);

  const cacheKey = codes.join(',');
  if (cache && cache.key === cacheKey && Date.now() - cache.at < CACHE_TTL_MS) {
    return res.status(200).json(cache.data);
  }

  const feeds = BASE_QUERIES.map((f) => ({ q: f.q, topic: f.topic }));
  for (const code of codes) feeds.push({ q: `${code} saham`, topic: code });

  const settled = await Promise.allSettled(
    feeds.map((f) => fetchFeed(f.q, f.topic))
  );

  // Gabung + dedupe berdasarkan link; satu artikel yang muncul di
  // beberapa feed menyimpan semua topiknya (dipakai filter di halaman).
  const byLink = new Map();
  const errors = [];
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status !== 'fulfilled') {
      errors.push({ query: feeds[i].q, error: String(s.reason?.message || s.reason) });
      continue;
    }
    for (const it of s.value) {
      // Lewati artikel yang diblokir sebelum dedupe/cap, supaya feed
      // tetap berisi sampai 30 berita.
      if (BLOCKED_LINKS.includes(it.link)) continue;
      const prev = byLink.get(it.link);
      if (prev) {
        for (const t of it.topics) if (!prev.topics.includes(t)) prev.topics.push(t);
      } else {
        byLink.set(it.link, it);
      }
    }
  }

  const items = [...byLink.values()]
    .sort((a, b) => (b.publishedAt || '') < (a.publishedAt || '') ? -1 : 1)
    .slice(0, MAX_ITEMS);

  const data = {
    updatedAt: new Date().toISOString(),
    count: items.length,
    items,
    errors: errors.length ? errors : undefined,
  };
  cache = { key: cacheKey, at: Date.now(), data };
  // Selalu 200 — halaman berita tidak boleh rusak hanya karena feed gagal.
  return res.status(200).json(data);
};
