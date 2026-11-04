/* ============================================================
   JengaNasi admin action endpoint
   POST /api/admin

   Verifies the caller's Supabase access token, confirms the
   administrator role, then applies the moderation change with the
   service role. This keeps admin controls working even before the
   database RLS policies have been updated.
   ============================================================ */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wpspoxilxzdjbjdzzici.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indwc3BveGlseHpkamJqZHp6aWNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NzkxNTEsImV4cCI6MjEwNTA1NTE1MX0.2GMLPDw_tTEZIob_LjZ040FHcgJMr9r0HmVWwztrBis';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_STATUSES = new Set(['pending', 'confirmed', 'processing', 'delivered', 'cancelled']);

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
    if (raw.length > 256 * 1024) throw new Error('Request body is too large.');
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

function serviceHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

async function isAdmin(user) {
  if (user && user.app_metadata && user.app_metadata.role === 'admin') return true;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/admins?id=eq.${encodeURIComponent(user.id)}&select=id`, {
    headers: serviceHeaders()
  });
  if (!response.ok) return false;
  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function patchRow(table, id, payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*`, {
    method: 'PATCH',
    headers: serviceHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    console.error('Admin patch failed:', table, response.status, text.slice(0, 300));
    return { error: 'The change could not be saved.' };
  }
  if (!Array.isArray(data) || !data.length) {
    return { error: 'That record no longer exists.' };
  }
  return { data: data[0] };
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
    return send(res, 503, { error: 'Admin actions are not configured on the server yet.' });
  }

  try {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const user = await currentUser(token);
    if (!user || !user.id) return send(res, 401, { error: 'Sign in to continue.' });
    if (!(await isAdmin(user))) return send(res, 403, { error: 'Administrator access is required.' });

    const body = await readBody(req);
    const action = String(body.action || '');
    const id = String(body.id || '');
    if (!UUID.test(id)) return send(res, 400, { error: 'Invalid record id.' });

    if (action === 'vendor.verify') {
      const result = await patchRow('vendors', id, { verified: Boolean(body.verified) });
      return result.error ? send(res, 404, { error: result.error }) : send(res, 200, { ok: true, data: result.data });
    }

    if (action === 'vendor.suspend') {
      const result = await patchRow('vendors', id, { suspended: Boolean(body.suspended) });
      return result.error ? send(res, 404, { error: result.error }) : send(res, 200, { ok: true, data: result.data });
    }

    if (action === 'customer.suspend') {
      const result = await patchRow('customers', id, { suspended: Boolean(body.suspended) });
      return result.error ? send(res, 404, { error: result.error }) : send(res, 200, { ok: true, data: result.data });
    }

    if (action === 'product.archive') {
      const archived = Boolean(body.archived);
      const status = archived ? 'inactive' : (body.status === 'draft' ? 'draft' : 'active');
      const result = await patchRow('products', id, { deleted: archived, status });
      return result.error ? send(res, 404, { error: result.error }) : send(res, 200, { ok: true, data: result.data });
    }

    if (action === 'order.status') {
      const status = String(body.status || '').toLowerCase();
      if (!ORDER_STATUSES.has(status)) return send(res, 400, { error: 'Invalid order status.' });
      const result = await patchRow('orders', id, { status });
      return result.error ? send(res, 404, { error: result.error }) : send(res, 200, { ok: true, data: result.data });
    }

    return send(res, 400, { error: 'Unknown admin action.' });
  } catch (error) {
    console.error('Admin endpoint error:', error && error.message ? error.message : error);
    return send(res, 500, { error: 'The admin action could not be completed.' });
  }
};
