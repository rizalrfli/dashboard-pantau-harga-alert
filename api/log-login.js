// api/log-login.js — Vercel Serverless Function
// Mencatat satu percobaan login ke tabel Supabase public.login_history.
// POST /api/log-login  body JSON: { success?: boolean } (default true)
// Balasan: { logged: true, id } bila tercatat, atau { logged: false, ... }
// bila Supabase belum diatur / sedang down.
//
// PENTING: gagal mencatat TIDAK PERNAH menggagalkan login — fungsi ini
// selalu membalas HTTP 200 dan tidak melempar error ke client. Login
// adalah urusan auth.js; pencatatan ini hanya fire-and-forget.
// Kunci Supabase dibaca dari env saja (SUPABASE_URL dan
// SUPABASE_SERVICE_ROLE_KEY) — tidak ada URL/kunci yang di-hardcode.

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

function readBody(req) {
  // Vercel mem-parse JSON body ke req.body bila Content-Type: application/json.
  // Bila body datang sebagai string (mis. dari fetch tanpa header yang tepat),
  // parse manual; bila tidak ada body, anggap { success: true }.
  if (req.body == null) return { success: true };
  if (typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(String(req.body));
  } catch (e) {
    return { success: true };
  }
}

function clientIp(req) {
  // Di Vercel, IP asli ada di header x-forwarded-for (bisa berisi rantai).
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim().slice(0, 64);
  if (req.socket && req.socket.remoteAddress) {
    return String(req.socket.remoteAddress).slice(0, 64);
  }
  return null;
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // Env belum diatur di Vercel — login tetap jalan, pencatatan dilewati.
    return res.status(200).json({ logged: false, reason: 'supabase_not_configured' });
  }

  const body = readBody(req);
  const success = body.success !== false; // default true; false hanya bila eksplisit
  const row = {
    user_agent: String((req.headers && req.headers['user-agent']) || '').slice(0, 512) || null,
    ip: clientIp(req),
    success,
  };

  try {
    const r = await fetch(`${String(url).replace(/\/$/, '')}/rest/v1/login_history`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error('log-login: Supabase', r.status, text.slice(0, 200));
      return res.status(200).json({ logged: false, reason: 'supabase_error' });
    }
    const inserted = await r.json().catch(() => []);
    const id = Array.isArray(inserted) && inserted[0] ? inserted[0].id : null;
    return res.status(200).json({ logged: true, id });
  } catch (e) {
    // Supabase down / timeout / DNS — jangan pernah jatuhkan login.
    console.error('log-login: fetch failed', String((e && e.message) || e));
    return res.status(200).json({ logged: false, reason: 'supabase_unreachable' });
  }
};
