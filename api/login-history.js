// api/login-history.js — Vercel Serverless Function
// Membaca riwayat login dari tabel Supabase public.login_history.
// GET /api/login-history
// Balasan: { configured: true, rows: [{ id, logged_in_at, user_agent, ip, success }] }
// (50 baris terbaru, urut waktu terbaru dulu). Bila env Supabase belum
// diatur, balas { configured: false, rows: [] } supaya halaman login
// menampilkan pesan "belum diatur" dan bukan error.
// Tidak ada rahasia apa pun yang dikembalikan di balasan ini.
//
// Kunci Supabase dibaca dari env saja (SUPABASE_URL dan
// SUPABASE_SERVICE_ROLE_KEY) — tidak ada URL/kunci yang di-hardcode.

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Riwayat berubah tiap ada login; cache singkat saja.
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=30');
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.status(200).json({ configured: false, rows: [] });
  }

  try {
    const endpoint =
      `${String(url).replace(/\/$/, '')}/rest/v1/login_history` +
      '?select=id,logged_in_at,user_agent,ip,success' +
      '&order=logged_in_at.desc&limit=50';
    const r = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error('login-history: Supabase', r.status, text.slice(0, 200));
      return res.status(200).json({ configured: true, rows: [], error: 'supabase_error' });
    }
    const rows = await r.json().catch(() => []);
    return res.status(200).json({ configured: true, rows: Array.isArray(rows) ? rows : [] });
  } catch (e) {
    console.error('login-history: fetch failed', String((e && e.message) || e));
    return res.status(200).json({ configured: true, rows: [], error: 'supabase_unreachable' });
  }
};
