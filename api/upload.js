/* ============================================================
   JengaNasi media upload endpoint
   POST /api/upload
   Body: { image: "data:image/jpeg;base64,...", folder: "products" }

   The caller must send their Supabase access token. The function
   verifies that token, then uploads with the service role so the
   public site keeps working even while Storage RLS policies are
   being applied. The service key never reaches the browser.
   ============================================================ */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wpspoxilxzdjbjdzzici.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indwc3BveGlseHpkamJqZHp6aWNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NzkxNTEsImV4cCI6MjEwNTA1NTE1MX0.2GMLPDw_tTEZIob_LjZ040FHcgJMr9r0HmVWwztrBis';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = 'site-media';
const MAX_BYTES = 2.5 * 1024 * 1024;
const FOLDERS = new Set(['products', 'stores', 'avatars', 'site']);
const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 4 * 1024 * 1024) throw new Error('Request body is too large.');
  }
  if (!raw) return {};
  return JSON.parse(raw);
}

async function currentUser(token) {
  if (!token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) return null;
  return response.json();
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', 'POST, OPTIONS');
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return send(res, 405, { error: 'Method not allowed.' });
  }
  if (!SERVICE_KEY) {
    return send(res, 503, { error: 'Media storage is not configured on the server yet.' });
  }

  try {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const user = await currentUser(token);
    if (!user || !user.id) return send(res, 401, { error: 'Sign in to upload images.' });

    const body = await readBody(req);
    const image = String(body.image || '').trim();
    const folder = String(body.folder || 'products').toLowerCase();
    if (!FOLDERS.has(folder)) return send(res, 400, { error: 'Unknown upload folder.' });

    const match = image.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([a-z0-9+/=\s]+)$/i);
    if (!match) return send(res, 400, { error: 'Choose a JPG, PNG, WebP, or GIF image.' });

    const mime = match[1].toLowerCase();
    const base64 = match[2].replace(/\s+/g, '');
    const bytes = Buffer.from(base64, 'base64');
    if (!bytes.length) return send(res, 400, { error: 'The image is empty.' });
    if (bytes.length > MAX_BYTES) return send(res, 413, { error: 'That image is too large. Keep it under 2.5 MB.' });

    const extension = TYPES[mime] || 'jpg';
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const path = `${user.id}/${folder}/${unique}.${extension}`;

    const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'x-upsert': 'false'
      },
      body: bytes
    });

    const text = await upload.text();
    if (!upload.ok) {
      console.error('Storage upload failed:', upload.status, text.slice(0, 300));
      return send(res, 502, { error: 'The image could not be stored. Please try again.' });
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
    return send(res, 200, { ok: true, url: publicUrl, path, bytes: bytes.length, mime });
  } catch (error) {
    console.error('Upload endpoint error:', error && error.message ? error.message : error);
    return send(res, 500, { error: 'The image could not be uploaded.' });
  }
};
