/* ============================================================
   JengaNasi Dashboard Core
   Shared Supabase session handling, role guard, shell controls,
   and rendering helpers for the admin, vendor, and customer
   dashboard pages.
   ============================================================ */

(function (global) {
  'use strict';

  const SUPABASE_URL = 'https://wpspoxilxzdjbjdzzici.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indwc3BveGlseHpkamJqZHp6aWNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NzkxNTEsImV4cCI6MjEwNTA1NTE1MX0.2GMLPDw_tTEZIob_LjZ040FHcgJMr9r0HmVWwztrBis';
  const CACHE_KEY = 'jenganasi_user';

  const ROLE_META = {
    admin: {
      label: 'Administrator',
      roleLabel: 'Admin',
      workspace: 'Admin workspace',
      title: 'Admin Console',
      url: '/admin',
      switchLabel: 'Admin console',
      audience: 'administrator',
      destination: 'the admin console',
      gateTitle: 'Run the marketplace with confidence.',
      gateText: 'Verify vendors, monitor orders, and keep Tanzania\'s construction marketplace moving.',
      points: ['Verify new vendor stores', 'Monitor orders across every vendor', 'Keep the catalogue accurate']
    },
    vendor: {
      label: 'Vendor',
      roleLabel: 'Vendor',
      workspace: 'Vendor workspace',
      title: 'Vendor Dashboard',
      url: '/vendor',
      switchLabel: 'Vendor dashboard',
      audience: 'vendor',
      destination: 'your vendor dashboard',
      gateTitle: 'Grow your store, one order at a time.',
      gateText: 'Manage your catalogue, confirm incoming orders, and keep your storefront details current.',
      points: ['Manage your product catalogue', 'Confirm and fulfil customer orders', 'Update your public store profile']
    },
    customer: {
      label: 'Customer',
      roleLabel: 'Customer',
      workspace: 'Customer account',
      title: 'My Account',
      url: '/customer',
      switchLabel: 'Customer account',
      audience: 'customer',
      destination: 'your account',
      gateTitle: 'Everything you ordered, in one place.',
      gateText: 'Track your orders, review delivery details, and keep your contact information up to date.',
      points: ['Track every order and shipment', 'Review delivery and payment details', 'Keep your contact details current']
    }
  };

  const REGIONS = [
    'Arusha', 'Dar es Salaam', 'Dodoma', 'Geita', 'Iringa', 'Kagera', 'Katavi',
    'Kigoma', 'Kilimanjaro', 'Lindi', 'Manyara', 'Mara', 'Mbeya', 'Morogoro',
    'Mtwara', 'Mwanza', 'Njombe', 'Pemba North', 'Pemba South', 'Pwani',
    'Rukwa', 'Ruvuma', 'Shinyanga', 'Simiyu', 'Singida', 'Songwe', 'Tabora',
    'Tanga', 'Zanzibar Central/South', 'Zanzibar North', 'Zanzibar Urban/West'
  ];

  const CATEGORIES = [
    { id: 'cement', name: 'Cement & Concrete' },
    { id: 'steel', name: 'Steel & Rebar' },
    { id: 'roofing', name: 'Roofing Sheets' },
    { id: 'tiles', name: 'Tiles & Flooring' },
    { id: 'paint', name: 'Paint & Finishes' },
    { id: 'plumbing', name: 'Plumbing & Pipes' },
    { id: 'electrical', name: 'Electrical' },
    { id: 'tools', name: 'Tools & Equipment' },
    { id: 'timber', name: 'Timber & Lumber' },
    { id: 'aggregates', name: 'Sand & Aggregates' },
    { id: 'sanitary', name: 'Sanitary Ware' },
    { id: 'hardware', name: 'Hardware & Fasteners' }
  ];

  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  const ICONS = {
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    vendors: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l1.5-4.5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/><path d="M3 9h18"/></svg>',
    products: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/></svg>',
    orders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    revenue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>',
    money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l1.5-4.5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/><path d="M3 9h18"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>'
  };

  const client = global.supabase
    ? global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  const state = {
    role: null,
    user: null,
    ready: false,
    booted: false,
    onReady: null,
    lastFocused: null
  };

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ESC_MAP[character]);
  }

  function safeUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(String(value), location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (error) {
      return '';
    }
  }

  function formatPrice(amount) {
    return new Intl.NumberFormat('sw-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Number(amount) || 0);
  }

  function compactMoney(amount) {
    const value = Number(amount) || 0;
    if (Math.abs(value) >= 1000000000) return 'TZS ' + (value / 1000000000).toFixed(1) + 'B';
    if (Math.abs(value) >= 1000000) return 'TZS ' + (value / 1000000).toFixed(1) + 'M';
    if (Math.abs(value) >= 1000) return 'TZS ' + (value / 1000).toFixed(1) + 'K';
    return formatPrice(value);
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '—'
      : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '—'
      : date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
  }

  function initials(value) {
    const parts = String(value || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map(part => part.charAt(0)).join('').toUpperCase() || '?';
  }

  function plural(count, singular, pluralForm) {
    return Number(count) === 1 ? singular : (pluralForm || singular + 's');
  }

  function categoryLabel(categoryId) {
    const category = CATEGORIES.find(item => item.id === String(categoryId || '').toLowerCase());
    return category ? category.name : (categoryId || 'Materials');
  }

  function vendorTypeLabel(value) {
    const labels = {
      retail: 'Retail seller',
      wholesale: 'Wholesaler',
      company: 'Company / enterprise',
      agent: 'Agent / supplier',
      manufacturing: 'Manufacturing'
    };
    return labels[String(value || '').toLowerCase()] || 'Verified vendor';
  }

  function statusTone(status) {
    const raw = String(status || '').toLowerCase();
    if (['delivered', 'completed', 'paid', 'approved', 'active', 'verified'].includes(raw)) return 'success';
    if (['cancelled', 'canceled', 'rejected', 'failed', 'suspended'].includes(raw)) return 'danger';
    if (['processing', 'confirmed', 'shipped', 'in_progress', 'info'].includes(raw)) return 'info';
    if (['pending', 'draft', 'warning'].includes(raw)) return 'warning';
    return 'neutral';
  }

  function statusPill(status, label) {
    const raw = String(status || 'pending').toLowerCase();
    const text = label || raw.replace(/_/g, ' ');
    return `<span class="status-pill is-${statusTone(raw)}">${esc(text)}</span>`;
  }

  function icon(name) {
    return ICONS[name] || ICONS.box;
  }

  function statCard(options) {
    const tone = options.tone ? ` tone-${options.tone}` : '';
    return `<article class="stat-card${tone}">
      <div class="stat-icon" aria-hidden="true">${icon(options.icon || 'box')}</div>
      <div class="stat-copy">
        <span class="stat-label">${esc(options.label || '')}</span>
        <strong class="stat-value">${esc(options.value == null ? '—' : String(options.value))}</strong>
        ${options.note ? `<span class="stat-note">${esc(options.note)}</span>` : ''}
      </div>
    </article>`;
  }

  function emptyState(iconName, title, text, actionHtml) {
    return `<div class="empty-state">
      <div class="empty-state-icon" aria-hidden="true">${icon(iconName || 'box')}</div>
      <h3>${esc(title || 'Nothing here yet')}</h3>
      ${text ? `<p>${esc(text)}</p>` : ''}
      ${actionHtml || ''}
    </div>`;
  }

  function panelLoading(text) {
    return `<div class="panel-loading"><span class="spinner" aria-hidden="true"></span><span>${esc(text || 'Loading…')}</span></div>`;
  }

  function orderCustomerName(customer) {
    if (!customer) return '';
    if (typeof customer === 'string') return customer;
    return customer.name || customer.email || '';
  }

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    }
    return [];
  }

  function orderItemCount(order) {
    return asArray(order && order.items).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }

  function paymentLabel(method) {
    const labels = {
      cash_on_delivery: 'Cash on delivery',
      mpesa_on_delivery: 'M-Pesa on delivery',
      bank_transfer: 'Bank transfer'
    };
    return labels[String(method || '').toLowerCase()] || 'Cash on delivery';
  }

  function debounce(fn, delay) {
    let timer;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay == null ? 160 : delay);
    };
  }

  function withTimeout(promise, milliseconds, message) {
    let timer;
    const timeout = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(message || 'The request timed out. Please try again.')), milliseconds || 20000);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  function friendlyAuthError(error) {
    const message = error && error.message ? error.message : '';
    if (/Invalid login credentials/i.test(message)) return 'Invalid email or password. Please try again.';
    if (/Email not confirmed/i.test(message)) return 'Please confirm your email address before signing in.';
    if (/Password should be at least/i.test(message)) return 'Password must be at least 8 characters.';
    if (/rate limit|too many requests/i.test(message)) return 'Too many attempts. Please wait a minute and try again.';
    if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return 'We could not reach the server. Check your connection and try again.';
    return message || 'Something went wrong. Please try again.';
  }

  /* ---------- Cached session (display only; access is always re-verified) ---------- */

  function saveCachedUser(profile) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(profile));
    } catch (error) {
      /* sessionStorage can be unavailable in strict privacy modes */
    }
  }

  function clearCachedUser() {
    try {
      sessionStorage.removeItem(CACHE_KEY);
    } catch (error) {
      /* ignore */
    }
  }

  /* ---------- Supabase profile resolution ---------- */

  async function fetchProfileRow(table, userId) {
    const { data, error } = await client.from(table).select('*').eq('id', userId).maybeSingle();
    if (error) {
      if (error.code !== 'PGRST116') {
        console.warn(`Profile lookup failed (${table}):`, error.message);
        throw error;
      }
      return null;
    }
    return data || null;
  }

  function profileFromRow(role, row, user) {
    const record = row || {};
    const metadata = (user && user.user_metadata) || {};
    const profile = {
      id: (user && user.id) || record.id,
      email: record.email || (user && user.email) || '',
      name: record.name || metadata.name || ((user && user.email) ? user.email.split('@')[0] : 'Account'),
      role,
      verified: record.verified !== false,
      suspended: Boolean(record.suspended),
      joinedAt: record.joined_at || record.created_at || null,
      persisted: Boolean(record.id)
    };
    if (role === 'vendor') {
      profile.vendorEmail = record.email || (user && user.email) || '';
      profile.storeName = record.store_name || metadata.storeName || profile.name;
      profile.phone = record.phone || metadata.phone || '';
      profile.region = record.region || metadata.region || '';
      profile.vendorType = record.vendor_type || metadata.vendorType || '';
      profile.photo = record.photo || metadata.photo || '';
      profile.commissionRate = Number(record.commission_rate) || 0;
    } else if (role === 'customer') {
      profile.phone = record.phone || metadata.phone || '';
    }
    return profile;
  }

  async function resolveProfile(user) {
    if (!user) return null;
    const [admin, vendor, customer] = await Promise.all([
      fetchProfileRow('admins', user.id),
      fetchProfileRow('vendors', user.id),
      fetchProfileRow('customers', user.id)
    ]);

    if (admin || (user.app_metadata && user.app_metadata.role === 'admin')) {
      return profileFromRow('admin', admin || { email: user.email, name: user.user_metadata && user.user_metadata.name }, user);
    }
    if (vendor) return profileFromRow('vendor', vendor, user);
    if (customer) return profileFromRow('customer', customer, user);
    return null;
  }

  /* ---------- UI feedback ---------- */

  function toast(message, type) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(container);
    }
    const tone = ['success', 'danger', 'warning'].includes(type) ? type : 'info';
    const element = document.createElement('div');
    element.className = `toast is-${tone}`;
    element.setAttribute('role', 'status');
    element.innerHTML = `<span>${esc(message)}</span><button type="button" aria-label="Dismiss notification">&times;</button>`;
    const dismiss = () => {
      element.style.opacity = '0';
      element.style.transform = 'translateY(6px)';
      setTimeout(() => element.remove(), 180);
    };
    element.querySelector('button').addEventListener('click', dismiss);
    container.appendChild(element);
    setTimeout(dismiss, 4800);
  }

  function showLoading(message) {
    let overlay = document.getElementById('dashboardLoading');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'dashboardLoading';
      overlay.className = 'loading-overlay';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      overlay.innerHTML = '<div class="loading-card"><span class="spinner" aria-hidden="true"></span><span id="dashboardLoadingText"></span></div>';
      document.body.appendChild(overlay);
    }
    const text = document.getElementById('dashboardLoadingText');
    if (text) text.textContent = message || 'Loading…';
    overlay.classList.add('open');
  }

  function hideLoading() {
    const overlay = document.getElementById('dashboardLoading');
    if (overlay) overlay.classList.remove('open');
  }

  /* ---------- Modal controls ---------- */

  function getFocusable(container) {
    return $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', container)
      .filter(element => element.offsetParent !== null);
  }

  function openModal(id) {
    const overlay = typeof id === 'string' ? document.getElementById(id) : id;
    if (!overlay) return;
    state.lastFocused = document.activeElement;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const focusable = getFocusable(overlay);
    setTimeout(() => {
      if (focusable[0]) focusable[0].focus();
      else overlay.focus();
    }, 30);
  }

  function closeModal(id) {
    let overlay = null;
    if (id) {
      overlay = typeof id === 'string' ? document.getElementById(id) : id;
    } else {
      const open = $$('.modal-overlay.open');
      overlay = open[open.length - 1] || null;
    }
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    if (!$$('.modal-overlay.open').length) document.body.classList.remove('modal-open');
    if (state.lastFocused && typeof state.lastFocused.focus === 'function') {
      state.lastFocused.focus();
      state.lastFocused = null;
    }
  }

  function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const toggle = $('[data-action="toggle-sidebar"]');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.hidden = true;
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('sidebar-locked');
  }

  function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const toggle = $('[data-action="toggle-sidebar"]');
    if (!sidebar) return;
    sidebar.classList.add('open');
    if (backdrop) backdrop.hidden = false;
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('sidebar-locked');
    const first = getFocusable(sidebar)[0];
    if (first) setTimeout(() => first.focus(), 40);
  }

  /* ---------- Shell / view routing ---------- */

  function initShell() {
    const meta = ROLE_META[state.role];
    $$('[data-workspace-label]').forEach(element => { element.textContent = meta.workspace; });
    $$('[data-role-label]').forEach(element => { element.textContent = meta.title; });
    $$('[data-role-name]').forEach(element => { element.textContent = meta.label; });
    $$('[data-current-year]').forEach(element => { element.textContent = String(new Date().getFullYear()); });

    const today = document.getElementById('todayLabel');
    if (today) {
      today.textContent = new Date().toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short'
      });
    }

    const panels = $$('[data-view-panel]');
    if (!panels.length) return;

    function showView(name, options) {
      const requested = String(name || 'overview').split('?')[0];
      const target = panels.find(panel => panel.dataset.viewPanel === requested) || panels[0];
      const viewName = target.dataset.viewPanel;
      panels.forEach(panel => panel.classList.toggle('active', panel === target));
      $$('.nav-item[data-view]').forEach(link => {
        const active = link.dataset.view === viewName;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
      const nav = $(`.nav-item[data-view="${viewName}"]`);
      const title = (nav && nav.dataset.title) || (viewName.charAt(0).toUpperCase() + viewName.slice(1));
      $$('[data-page-title]').forEach(element => { element.textContent = title; });
      document.title = `${title} · JengaNasi ${meta.title}`;
      if (!options || options.scroll !== false) window.scrollTo(0, 0);
      closeSidebar();
    }

    $$('.nav-item[data-view]').forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        const view = link.dataset.view;
        if (location.hash === `#${view}`) showView(view);
        else location.hash = view;
      });
    });

    const initialHash = location.hash.replace('#', '');
    showView(initialHash || 'overview', { scroll: false });

    window.addEventListener('hashchange', () => {
      showView(location.hash.replace('#', '') || 'overview');
    });

    global.JN.showView = showView;
  }

  function applyIdentity(profile) {
    if (!profile) return;
    const meta = ROLE_META[profile.role] || ROLE_META.customer;
    const displayName = profile.role === 'vendor' ? (profile.storeName || profile.name) : profile.name;
    const firstName = String(displayName || 'there').trim().split(/\s+/)[0] || 'there';
    const avatarText = initials(displayName);

    $$('[data-user-name]').forEach(element => { element.textContent = displayName || 'Account'; });
    $$('[data-user-first-name]').forEach(element => { element.textContent = firstName; });
    $$('[data-user-email]').forEach(element => { element.textContent = profile.email || ''; });
    $$('[data-user-role]').forEach(element => { element.textContent = meta.label; });
    $$('[data-user-initials]').forEach(element => { element.textContent = avatarText; });
    $$('[data-user-phone]').forEach(element => { element.textContent = profile.phone || 'Not added'; });
    $$('[data-user-joined]').forEach(element => { element.textContent = formatDate(profile.joinedAt); });
    $$('[data-user-store]').forEach(element => { element.textContent = profile.storeName || profile.name || ''; });

    if (profile.role === 'vendor') {
      $$('[data-vendor-status]').forEach(element => {
        element.innerHTML = statusPill(profile.verified ? 'verified' : 'pending', profile.verified ? 'Verified store' : 'Pending verification');
      });
    }

    $$('[data-daypart]').forEach(element => {
      const hour = new Date().getHours();
      element.textContent = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    });
  }

  function updateCachedUser(patch) {
    if (!state.user) return state.user;
    state.user = Object.assign({}, state.user, patch);
    saveCachedUser(state.user);
    applyIdentity(state.user);
    return state.user;
  }

  /* ---------- Auth gate ---------- */

  function brandLogo() {
    return `<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h9v5H3zM3 16h9v2H3zM16 6h5v2h-5zM16 13h5v5h-5z"/><rect x="3" y="3" width="18" height="18" rx="3"/></svg>`;
  }

  function gateShell(cardHtml) {
    const meta = ROLE_META[state.role] || ROLE_META.customer;
    const points = meta.points.map(point => `<li>${icon('check')}<span>${esc(point)}</span></li>`).join('');
    return `<div class="gate-wrap">
      <section class="gate-brand">
        <a class="gate-logo" href="/" aria-label="JengaNasi home">
          ${brandLogo()}
          <span>Jenga<span>Nasi</span></span>
        </a>
        <div class="gate-brand-copy">
          <span class="gate-kicker">JengaNasi workspace</span>
          <h1>${esc(meta.gateTitle)}</h1>
          <p>${esc(meta.gateText)}</p>
          <ul class="gate-points">${points}</ul>
        </div>
        <div class="gate-brand-foot">
          <span>Dar es Salaam · Tanzania</span>
          <span>&copy; ${new Date().getFullYear()} JengaNasi</span>
        </div>
      </section>
      <section class="gate-panel">${cardHtml}</section>
    </div>`;
  }

  function gateSwitchLinks() {
    return `<div class="gate-switch">
      <span>Other workspaces</span>
      <div class="gate-switch-links">
        ${Object.entries(ROLE_META)
          .filter(([role]) => role !== state.role)
          .map(([role, meta]) => `<a href="${meta.url}">${esc(meta.switchLabel)}</a>`)
          .join('')}
      </div>
    </div>`;
  }

  function setGateRoot(html) {
    const root = document.getElementById('gateRoot');
    const shell = document.getElementById('appShell');
    if (shell) shell.hidden = true;
    if (!root) return;
    root.hidden = false;
    root.innerHTML = html;
  }

  function renderSplash() {
    setGateRoot(`<div class="boot-splash" role="status" aria-live="polite">
      <span class="boot-mark">${brandLogo()}</span>
      <span class="spinner" aria-hidden="true"></span>
      <p>Opening your workspace…</p>
    </div>`);
  }

  function showSignIn(notice) {
    const meta = ROLE_META[state.role];
    const otherLinks = gateSwitchLinks();
    setGateRoot(gateShell(`<div class="gate-card">
      <div class="gate-card-head">
        <span class="gate-kicker">Secure sign-in</span>
        <h2>Welcome back</h2>
        <p>Sign in with your ${esc(meta.audience)} account to open ${esc(meta.destination)}.</p>
      </div>
      ${notice ? `<div class="gate-notice">${esc(notice)}</div>` : ''}
      <div class="gate-error" id="gateError" role="alert" hidden></div>
      <form class="gate-form" id="gateSignInForm" novalidate>
        <div class="field">
          <label for="gateEmail">Email address</label>
          <input id="gateEmail" name="email" type="email" autocomplete="username" inputmode="email" placeholder="you@example.com" required>
        </div>
        <div class="field">
          <label for="gatePassword">Password</label>
          <div class="password-wrap">
            <input id="gatePassword" name="password" type="password" autocomplete="current-password" placeholder="Your password" required>
            <button type="button" class="pw-toggle" id="gatePwToggle" aria-label="Show password">Show</button>
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-lg btn-block" id="gateSubmit">Sign in</button>
      </form>
      <div class="gate-links">
        <a href="/">Back to marketplace</a>
        <a href="mailto:info@jenganasi.co.tz">Need help?</a>
      </div>
      ${otherLinks}
    </div>`));

    const form = document.getElementById('gateSignInForm');
    if (form) form.addEventListener('submit', handleGateSignIn);
    const password = document.getElementById('gatePassword');
    const toggle = document.getElementById('gatePwToggle');
    if (password && toggle) {
      toggle.addEventListener('click', () => {
        const show = password.type === 'password';
        password.type = show ? 'text' : 'password';
        toggle.textContent = show ? 'Hide' : 'Show';
        toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    }
    const email = document.getElementById('gateEmail');
    if (email) setTimeout(() => email.focus(), 60);
  }

  function gateError(message) {
    const error = document.getElementById('gateError');
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  }

  function setGateBusy(busy) {
    const button = document.getElementById('gateSubmit');
    if (!button) return;
    button.disabled = busy;
    button.innerHTML = busy
      ? '<span class="spinner spinner-sm" aria-hidden="true"></span> Signing in…'
      : 'Sign in';
  }

  async function handleGateSignIn(event) {
    event.preventDefault();
    if (!client) {
      gateError('The secure client could not be loaded. Please refresh the page.');
      return;
    }
    const form = event.currentTarget;
    const email = String(form.elements.email.value || '').trim().toLowerCase();
    const password = String(form.elements.password.value || '');
    const error = document.getElementById('gateError');
    if (error) error.hidden = true;
    if (!email || !password) {
      gateError('Enter your email address and password.');
      return;
    }

    setGateBusy(true);
    try {
      const { data, error: signInError } = await withTimeout(
        client.auth.signInWithPassword({ email, password }),
        25000,
        'Sign-in is taking too long. Please try again.'
      );
      if (signInError) throw signInError;
      const profile = await withTimeout(resolveProfile(data.user), 25000, 'Your profile took too long to load. Please try again.');
      if (!profile) {
        renderNoProfile(data.user);
        return;
      }
      saveCachedUser(profile);
      if (profile.suspended) {
        renderSuspended(profile);
        return;
      }
      if (profile.role !== state.role) {
        renderAccessDenied(profile);
        return;
      }
      enterDashboard(profile);
    } catch (errorObject) {
      gateError(friendlyAuthError(errorObject));
    } finally {
      setGateBusy(false);
    }
  }

  function gateAccount(profile) {
    const displayName = profile.role === 'vendor' ? (profile.storeName || profile.name) : profile.name;
    return `<div class="gate-account">
      <span class="avatar avatar-lg">${esc(initials(displayName))}</span>
      <div class="gate-account-copy">
        <strong>${esc(displayName || 'Account')}</strong>
        <span>${esc(profile.email || '')}</span>
      </div>
      <span class="gate-role">${esc((ROLE_META[profile.role] || ROLE_META.customer).roleLabel)}</span>
    </div>`;
  }

  function renderAccessDenied(profile) {
    const own = ROLE_META[profile.role] || ROLE_META.customer;
    const expected = ROLE_META[state.role];
    setGateRoot(gateShell(`<div class="gate-card">
      <div class="gate-card-head">
        <span class="gate-kicker">Account mismatch</span>
        <h2>This is the ${esc(expected.audience)} workspace</h2>
        <p>You are signed in, but this page is reserved for ${esc(expected.audience)} accounts.</p>
      </div>
      ${gateAccount(profile)}
      <div class="gate-actions">
        <a class="btn btn-primary btn-lg" href="${own.url}">Open ${esc(own.switchLabel)}</a>
        <button type="button" class="btn btn-outline" data-action="switch-account">Sign out &amp; switch account</button>
      </div>
      <a class="gate-back" href="/">Back to marketplace</a>
      ${gateSwitchLinks()}
    </div>`));
  }

  function renderSuspended(profile) {
    setGateRoot(gateShell(`<div class="gate-card">
      <div class="gate-card-head">
        <span class="gate-kicker">Account suspended</span>
        <h2>Access is paused</h2>
        <p>This account cannot open the dashboard right now. Contact JengaNasi support so we can review it.</p>
      </div>
      ${gateAccount(profile)}
      <div class="gate-actions">
        <a class="btn btn-primary" href="mailto:info@jenganasi.co.tz?subject=Account%20review">Contact support</a>
        <button type="button" class="btn btn-outline" data-action="signout">Sign out</button>
      </div>
      <a class="gate-back" href="/">Back to marketplace</a>
    </div>`));
  }

  function renderNoProfile(user) {
    const metadata = (user && user.user_metadata) || {};
    const name = metadata.name || (user && user.email ? user.email.split('@')[0] : 'Account');
    setGateRoot(gateShell(`<div class="gate-card">
      <div class="gate-card-head">
        <span class="gate-kicker">Profile not found</span>
        <h2>Finish setting up your account</h2>
        <p>Your sign-in worked, but no marketplace profile is linked to it yet. Sign in on the main marketplace to finish account setup, then come back.</p>
      </div>
      <div class="gate-account">
        <span class="avatar avatar-lg">${esc(initials(name))}</span>
        <div class="gate-account-copy">
          <strong>${esc(name)}</strong>
          <span>${esc((user && user.email) || '')}</span>
        </div>
      </div>
      <div class="gate-actions">
        <a class="btn btn-primary" href="/">Go to the marketplace</a>
        <button type="button" class="btn btn-outline" data-action="switch-account">Sign out &amp; try another account</button>
      </div>
      <a class="gate-back" href="mailto:info@jenganasi.co.tz">Need help? Contact support</a>
    </div>`));
  }

  function showFatal(message) {
    setGateRoot(gateShell(`<div class="gate-card">
      <div class="gate-card-head">
        <span class="gate-kicker">Connection problem</span>
        <h2>We could not open this page</h2>
        <p>${esc(message || 'Please check your connection and try again.')}</p>
      </div>
      <div class="gate-actions">
        <button type="button" class="btn btn-primary" data-action="reload">Try again</button>
        <a class="btn btn-outline" href="/">Back to marketplace</a>
      </div>
      <a class="gate-back" href="mailto:info@jenganasi.co.tz">Need help? Contact support</a>
    </div>`));
  }

  function enterDashboard(profile) {
    state.user = profile;
    state.ready = true;
    saveCachedUser(profile);
    applyIdentity(profile);
    const root = document.getElementById('gateRoot');
    const shell = document.getElementById('appShell');
    if (root) {
      root.hidden = true;
      root.innerHTML = '';
    }
    if (shell) shell.hidden = false;
    const callback = state.onReady;
    if (typeof callback === 'function') {
      Promise.resolve(callback(profile)).catch(error => {
        console.error('Dashboard initialisation failed:', error);
        toast('Some dashboard data could not be loaded. Refresh to try again.', 'danger');
      });
    }
  }

  async function checkSession() {
    if (!client) {
      showFatal('The secure client could not be loaded. Refresh the page to try again.');
      return;
    }
    try {
      const { data, error } = await withTimeout(
        client.auth.getSession(),
        20000,
        'Session check timed out. Please refresh the page.'
      );
      if (error) throw error;
      const session = data && data.session;
      if (!session) {
        showSignIn();
        return;
      }
      const profile = await withTimeout(
        resolveProfile(session.user),
        25000,
        'Your profile took too long to load. Please refresh the page.'
      );
      if (!profile) {
        renderNoProfile(session.user);
        return;
      }
      saveCachedUser(profile);
      if (profile.suspended) {
        renderSuspended(profile);
        return;
      }
      if (profile.role !== state.role) {
        renderAccessDenied(profile);
        return;
      }
      enterDashboard(profile);
    } catch (error) {
      showFatal(error && error.message ? error.message : 'Please check your connection and try again.');
    }
  }

  async function signOutAndGo(destination) {
    try {
      if (client) await client.auth.signOut();
    } catch (error) {
      console.warn('Sign out failed:', error);
    }
    clearCachedUser();
    state.ready = false;
    state.user = null;
    window.location.href = destination || '/';
  }

  /* ---------- Global event wiring ---------- */

  function bindGlobalEvents() {
    if (state.booted) return;
    state.booted = true;

    document.addEventListener('click', event => {
      const actionElement = event.target.closest('[data-action]');
      if (!actionElement) return;
      const action = actionElement.dataset.action;
      if (action === 'toggle-sidebar') {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('open')) closeSidebar();
        else openSidebar();
      } else if (action === 'close-sidebar') {
        closeSidebar();
      } else if (action === 'signout') {
        signOutAndGo('/');
      } else if (action === 'switch-account') {
        signOutAndGo(window.location.pathname);
      } else if (action === 'reload') {
        window.location.reload();
      } else if (action === 'open-modal') {
        openModal(actionElement.dataset.modalTarget);
      } else if (action === 'close-modal') {
        const overlay = actionElement.closest('.modal-overlay');
        if (overlay) closeModal(overlay);
        else closeModal();
      }
    });

    document.addEventListener('click', event => {
      if (event.target.classList && event.target.classList.contains('modal-overlay')) {
        closeModal(event.target);
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        const openModals = $$('.modal-overlay.open');
        if (openModals.length) {
          closeModal(openModals[openModals.length - 1]);
          return;
        }
        closeSidebar();
      }
      if (event.key === 'Tab') {
        const openModals = $$('.modal-overlay.open');
        if (!openModals.length) return;
        const modal = openModals[openModals.length - 1];
        const focusable = getFocusable(modal);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    global.addEventListener('resize', () => {
      if (global.innerWidth > 1024) closeSidebar();
    });

    if (client) {
      client.auth.onAuthStateChange(event => {
        if (event === 'SIGNED_OUT' && state.ready) {
          state.ready = false;
          state.user = null;
          clearCachedUser();
          showSignIn('You have been signed out.');
        }
      });
    }
  }

  function boot(options) {
    const settings = options || {};
    state.role = settings.role || (document.body && document.body.dataset.dashboardRole);
    state.onReady = settings.onReady || null;
    if (!ROLE_META[state.role]) {
      console.error('Unknown dashboard role:', state.role);
      showFatal('This dashboard is not configured correctly.');
      return;
    }
    renderSplash();
    initShell();
    bindGlobalEvents();
    checkSession();
  }

  global.JN = {
    boot,
    client,
    supabase: client,
    state,
    roleMeta: ROLE_META,
    regions: REGIONS,
    categories: CATEGORIES,
    esc,
    safeUrl,
    formatPrice,
    compactMoney,
    formatDate,
    formatDateTime,
    initials,
    plural,
    categoryLabel,
    vendorTypeLabel,
    statusTone,
    statusPill,
    icon,
    statCard,
    emptyState,
    panelLoading,
    orderCustomerName,
    orderItemCount,
    asArray,
    paymentLabel,
    debounce,
    withTimeout,
    friendlyAuthError,
    toast,
    showLoading,
    hideLoading,
    openModal,
    closeModal,
    closeSidebar,
    signOutAndGo,
    updateCachedUser,
    refreshIdentity: applyIdentity,
    user: () => state.user
  };
})(window);
