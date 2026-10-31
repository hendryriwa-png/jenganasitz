// ============ CONFIGURATION ============
const SUPABASE_URL = 'https://wpspoxilxzdjbjdzzici.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indwc3BveGlseHpkamJqZHp6aWNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NzkxNTEsImV4cCI6MjEwNTA1NTE1MX0.2GMLPDw_tTEZIob_LjZ040FHcgJMr9r0HmVWwztrBis';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const REGIONS = [
  'Arusha', 'Dar es Salaam', 'Dodoma', 'Geita', 'Iringa', 'Kagera', 'Katavi',
  'Kigoma', 'Kilimanjaro', 'Lindi', 'Manyara', 'Mara', 'Mbeya', 'Morogoro',
  'Mtwara', 'Mwanza', 'Njombe', 'Pemba North', 'Pemba South', 'Pwani',
  'Rukwa', 'Ruvuma', 'Shinyanga', 'Simiyu', 'Singida', 'Songwe', 'Tabora',
  'Tanga', 'Zanzibar Central/South', 'Zanzibar North', 'Zanzibar Urban/West'
];

const CATEGORIES = [
  {id: 'cement', name: 'Cement & Concrete', icon: '🏗️', count: 156},
  {id: 'steel', name: 'Steel & Rebar', icon: '⚙️', count: 203},
  {id: 'roofing', name: 'Roofing Sheets', icon: '🏠', count: 189},
  {id: 'tiles', name: 'Tiles & Flooring', icon: '🟦', count: 234},
  {id: 'paint', name: 'Paint & Finishes', icon: '🎨', count: 167},
  {id: 'plumbing', name: 'Plumbing & Pipes', icon: '🔧', count: 198},
  {id: 'electrical', name: 'Electrical', icon: '⚡', count: 145},
  {id: 'tools', name: 'Tools & Equipment', icon: '🛠️', count: 212},
  {id: 'timber', name: 'Timber & Lumber', icon: '🌲', count: 87},
  {id: 'aggregates', name: 'Sand & Aggregates', icon: '🏖️', count: 134},
  {id: 'sanitary', name: 'Sanitary Ware', icon: '🚿', count: 156},
  {id: 'hardware', name: 'Hardware & Fasteners', icon: '🔩', count: 289}
];

function categoryLabel(categoryId) {
  const category = CATEGORIES.find(item => item.id === String(categoryId || '').toLowerCase());
  return category ? category.name : (categoryId || 'Materials');
}

const VENDOR_TYPES = [
  {key: 'retail', label: 'Retail Seller', icon: '🏪', desc: 'Sell directly to consumers at your store', features: ['Direct sales', 'Walk-in customers', 'Local delivery']},
  {key: 'wholesale', label: 'Wholesaler', icon: '🏭', desc: 'Bulk sales to other businesses', features: ['Bulk pricing', 'B2B focus', 'Volume discounts']},
  {key: 'company', label: 'Company/Enterprise', icon: '🏢', desc: 'Registered company with multiple branches', features: ['Multi-location', 'Corporate clients', 'Contract supply']},
  {key: 'agent', label: 'Agent/Supplier', icon: '🤝', desc: 'Supply products on behalf of manufacturers', features: ['Commission-based', 'Regional coverage', 'Logistics support']},
  {key: 'manufacturing', label: 'Manufacturing', icon: '⚙️', desc: 'Produce your own construction materials', features: ['Custom production', 'Quality control', 'Direct pricing']}
];

// ============ STATE ============
let currentUser = null;
let authStep = 1;
let selectedAuthRole = null;
let selectedVendorType = null;
let currentLocation = 'Dar es Salaam';
let cart = [];
let allProducts = [];
let allVendors = [];
let currentSort = 'featured';
let activeFilters = {search: '', category: '', vendor: ''};
let demoMode = false;
let supabaseAvailable = true;
let regDocData = {};
let vendorUploadedImage = null;
let vendorsExpanded = false;

// ============ UTILITY FUNCTIONS ============
function formatPrice(amount) {
  return new Intl.NumberFormat('sw-TZ', {style: 'currency', currency: 'TZS', minimumFractionDigits: 0}).format(amount);
}

function formatTZS(amount) {
  return formatPrice(amount);
}

const ESC_MAP = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};

function esc(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ESC_MAP[c]);
}

function safeUrl(str) {
  if (!str) return '';
  try {
    const url = new URL(str, location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch (e) {
    return '';
  }
}

function escUrl(str) {
  return encodeURIComponent(str);
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPasswordV2(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array([...salt, ...data]));
  const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return 'v2$' + Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('') + '$' + hash;
}

async function checkPwMatch(stored, raw) {
  if (stored.startsWith('v2$')) {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const salt = new Uint8Array(parts[1].match(/.{2}/g).map(b => parseInt(b, 16)));
    const encoder = new TextEncoder();
    const data = encoder.encode(raw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array([...salt, ...data]));
    const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hash === parts[2];
  }
  const legacy = await hashPassword(raw);
  return stored === legacy || stored === raw;
}

const DEMO_USERS_KEY = 'jenganasi_demo_users';
function getDemoUsers() {
  try { return JSON.parse(localStorage.getItem(DEMO_USERS_KEY) || '[]'); } catch { return []; }
}

function findDemoUser(email) {
  return getDemoUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
}

function addDemoUser(user) {
  const users = getDemoUsers();
  users.push(user);
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
  return user;
}

function sbUpdate(table, filter, data) {
  return _supabase.from(table).update(data).match(filter);
}

function sbInsert(table, data) {
  return _supabase.from(table).insert(data);
}

function ccKeys(obj) {
  const result = {};
  for (const key in obj) {
    result[key.toLowerCase().replace(/_/g, '')] = obj[key];
  }
  return result;
}

async function signInWithOAuth(provider) {
  if (!['google'].includes(provider)) { showToast('Invalid provider', 'danger'); return; }
  if (demoMode) { showToast('OAuth not available in demo mode. Use email/password.', 'danger'); return; }
  showLoading('Redirecting to ' + provider + '...');
  try {
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await _supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: false } });
    if (error) throw error;
  } catch (err) {
    showToast('Failed to start ' + provider + ' sign-in: ' + err.message, 'danger');
    hideLoading();
  }
}

function openInfoModal(page) {
  const content = {
    terms: '<h3>Terms & Conditions</h3><p>By using JengaNasi, you agree to our terms of service. All transactions are governed by Tanzanian law. Vendors must provide accurate product information and fulfill orders promptly. Customers must provide accurate delivery information.</p>',
    privacy: '<h3>Privacy Policy</h3><p>We respect your privacy. Personal information is used only for order processing and service improvement. We never sell your data to third parties. You can request data deletion at any time.</p>',
    fees: '<h3>Site Fee Structure</h3><p>JengaNasi charges a 10% commission on all vendor sales. This covers platform maintenance, payment processing, and customer support. No hidden fees - you only pay when you sell.</p>'
  };
  document.getElementById('infoTitle').textContent = page.charAt(0).toUpperCase() + page.slice(1);
  document.getElementById('infoContent').innerHTML = content[page] || '<p>Content not available</p>';
  openModal('infoModal');
}

function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${esc(message)}</span><button onclick="this.parentElement.remove()" style="margin-left:auto;background:none;border:none;color:inherit;font-size:1.25rem;line-height:1">&times;</button>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideIn 300ms var(--ease) reverse';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (id === 'authModal') resetAuthFlow();
    if (id === 'locationModal') populateRegionSelects();
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m.id));
  }
});

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    closeModal(e.target.id);
  }
});

function showLoading(message = 'Loading...') {
  let overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="loading-spinner"></div><p id="loadingText"></p>';
    document.body.appendChild(overlay);
  }
  document.getElementById('loadingText').textContent = message;
  overlay.classList.add('active');
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.remove('active');
}

// ============ SESSION MANAGEMENT ============
function saveSession(user) {
  currentUser = user;
  try { sessionStorage.setItem('jenganasi_user', JSON.stringify(user)); } catch { }
}

function loadSession() {
  try {
    const stored = sessionStorage.getItem('jenganasi_user');
    if (stored) {
      currentUser = JSON.parse(stored);
      updateAuthUI();
    }
  } catch { }
}

function clearSession() {
  sessionStorage.removeItem('jenganasi_user');
  currentUser = null;
  updateAuthUI();
}

async function fetchProfileRow(table, userId) {
  const { data, error } = await _supabase.from(table).select('*').eq('id', userId).maybeSingle();
  if (error) {
    if (error.code !== 'PGRST116') console.warn(`Profile lookup failed (${table}):`, error.message);
    return null;
  }
  return data;
}

function profileFromRow(role, row, user) {
  const meta = user?.user_metadata || {};
  const profile = {
    id: user?.id || row.id,
    email: row.email || user?.email || '',
    name: row.name || meta.name || (user?.email ? user.email.split('@')[0] : 'Account'),
    role,
    verified: row.verified !== false,
    suspended: Boolean(row.suspended),
    joinedAt: row.joined_at || null,
    persisted: Boolean(row.id)
  };
  if (role === 'vendor') {
    profile.vendorEmail = row.email || user?.email || '';
    profile.storeName = row.store_name || meta.storeName || profile.name;
    profile.phone = row.phone || meta.phone || '';
    profile.region = row.region || meta.region || '';
    profile.vendorType = row.vendor_type || meta.vendorType || '';
  } else if (role === 'customer') {
    profile.phone = row.phone || meta.phone || '';
  }
  return profile;
}

function profilePayloadFor(user, role) {
  const meta = user.user_metadata || {};
  const email = user.email || '';
  const name = (meta.name || email.split('@')[0] || 'Account').trim();
  if (role === 'vendor') {
    const lat = Number(meta.lat);
    const lng = Number(meta.lng);
    return {
      id: user.id,
      email,
      name,
      phone: meta.phone || null,
      store_name: meta.storeName || name,
      brela: meta.brela || null,
      licence: meta.licence || null,
      national_id: meta.nationalId || null,
      tin: meta.tin || null,
      bank_account: meta.bankAccount || null,
      photo: meta.photo || null,
      region: meta.region || null,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      vendor_type: meta.vendorType || null,
      role: 'vendor'
    };
  }
  return {
    id: user.id,
    email,
    name,
    phone: meta.phone || '',
    national_id: meta.nationalId || null,
    tin: meta.tin || null,
    payment_account: meta.paymentAccount || null,
    role: 'customer'
  };
}

async function createProfileIfMissing(user, role) {
  const table = role === 'vendor' ? 'vendors' : 'customers';
  const { error } = await _supabase.from(table).insert(profilePayloadFor(user, role));
  if (error && error.code !== '23505') {
    console.warn(`Could not create ${table} profile:`, error.message);
    return null;
  }
  return fetchProfileRow(table, user.id);
}

async function resolveUserProfile(user, { createIfMissing = true } = {}) {
  if (!user) return null;

  const admin = await fetchProfileRow('admins', user.id);
  if (admin || user.app_metadata?.role === 'admin') {
    return profileFromRow('admin', admin || { email: user.email, name: user.user_metadata?.name }, user);
  }

  const vendor = await fetchProfileRow('vendors', user.id);
  if (vendor) return profileFromRow('vendor', vendor, user);

  const customer = await fetchProfileRow('customers', user.id);
  if (customer) return profileFromRow('customer', customer, user);

  if (!createIfMissing) return null;
  const role = user.user_metadata?.role === 'vendor' ? 'vendor' : 'customer';
  const created = await createProfileIfMissing(user, role);
  return profileFromRow(role, created || { email: user.email }, user);
}

async function restoreSession() {
  try {
    const { data, error } = await _supabase.auth.getSession();
    if (error) throw error;
    if (!data?.session) { clearSession(); return; }
    // Do not create profile rows while restoring an old session: the account
    // may have been deleted, and a cached JWT would otherwise resurrect an
    // orphaned profile. Missing profiles are created on the next sign-in.
    const profile = await resolveUserProfile(data.session.user, { createIfMissing: false });
    if (profile) {
      saveSession(profile);
      updateAuthUI();
    } else {
      await _supabase.auth.signOut();
      clearSession();
    }
  } catch (e) {
    console.warn('Session restore failed:', e.message);
  }
}

function friendlyAuthError(error) {
  const message = error?.message || '';
  if (/Invalid login credentials/i.test(message)) return 'Invalid email or password. Please try again.';
  if (/Email not confirmed/i.test(message)) return 'Please confirm your email address before signing in.';
  if (/User already registered/i.test(message)) return 'An account with this email already exists. Sign in instead.';
  if (/Password should be at least/i.test(message)) return 'Password must be at least 8 characters.';
  if (/rate limit|too many requests/i.test(message)) return 'Too many attempts. Please wait a minute and try again.';
  return message || 'Something went wrong. Please try again.';
}

function updateAuthUI() {
  const authBtn = document.getElementById('authBtn');
  const vendorBtn = document.getElementById('vendorBtn');
  const userMenu = document.getElementById('userMenu');
  const userNameEl = document.getElementById('userName');
  const mobileAuthBtn = document.getElementById('mobileAuthBtn');
  const mobileVendorBtn = document.getElementById('mobileVendorBtn');
  const mobileSignOutBtn = document.getElementById('mobileSignOutBtn');

  if (currentUser) {
    if (authBtn) authBtn.style.display = 'none';
    if (vendorBtn) vendorBtn.style.display = 'none';
    if (userMenu) userMenu.style.display = 'flex';
    if (userNameEl) userNameEl.textContent = (currentUser.name || 'Account').split(' ')[0];
    const dashBtn = document.getElementById('userDashboardBtn');
    if (dashBtn) {
      dashBtn.textContent = currentUser.role === 'admin'
        ? 'Admin Console'
        : currentUser.role === 'vendor'
          ? 'Vendor Dashboard'
          : 'My Account';
    }
    if (mobileAuthBtn) {
      mobileAuthBtn.textContent = 'My Account';
      mobileAuthBtn.onclick = openAccountDashboard;
      mobileAuthBtn.style.display = 'flex';
    }
    if (mobileVendorBtn) mobileVendorBtn.style.display = 'none';
    if (mobileSignOutBtn) mobileSignOutBtn.style.display = 'flex';
  } else {
    if (authBtn) authBtn.style.display = 'flex';
    if (vendorBtn) vendorBtn.style.display = 'flex';
    if (userMenu) userMenu.style.display = 'none';
    if (mobileAuthBtn) {
      mobileAuthBtn.textContent = 'Sign In';
      mobileAuthBtn.onclick = () => openAuthModal();
      mobileAuthBtn.style.display = 'flex';
    }
    if (mobileVendorBtn) mobileVendorBtn.style.display = 'flex';
    if (mobileSignOutBtn) mobileSignOutBtn.style.display = 'none';
  }
}

function openAccountDashboard() {
  if (!currentUser) { openAuthModal('signin'); return; }
  if (currentUser.suspended) { showToast('This account is suspended. Please contact support.', 'danger'); return; }
  const destination = currentUser.role === 'admin'
    ? '/admin'
    : currentUser.role === 'vendor'
      ? '/vendor'
      : '/customer';
  window.location.href = destination;
}

async function signOutUser() {
  try {
    if (typeof _supabase !== 'undefined') await _supabase.auth.signOut();
  } catch (err) {
    console.warn('Sign out failed:', err);
  }
  sessionStorage.removeItem('sb_session');
  clearSession();
  closeMobileMenu();
  showToast('Signed out', 'info');
}

function getLastSection() {
  return sessionStorage.getItem('lastSection') || 'home';
}

function navigateToSection(section) {
  const el = document.getElementById(section);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.pushState(null, '', '#' + section);
  }
}

// ============ AUTH FLOW ============
function resetAuthFlow() {
  authStep = 1;
  selectedAuthRole = null;
  selectedVendorType = null;
  regDocData = {};
  vendorUploadedImage = null;
  updateAuthStepsUI();
  // Only reset the step containers. The customer/vendor/sign-in forms are
  // nested inside these containers and share the .auth-step class, so hiding
  // every .auth-step would also hide the form that is about to be shown.
  ['authStep1', 'authStep2', 'authStep2Vendor', 'authStep3', 'signinForm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.getElementById('customerForm').style.display = 'block';
  document.getElementById('vendorForm').style.display = 'block';
  document.getElementById('authStep1').style.display = 'block';
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('roleCustomer').classList.add('selected');
  selectedAuthRole = 'customer';
  document.getElementById('roleNextBtn').disabled = false;
}

function updateAuthStepsUI() {
  document.querySelectorAll('.step').forEach((step, i) => {
    step.classList.toggle('active', i + 1 === authStep);
    step.classList.toggle('completed', i + 1 < authStep);
  });
  document.querySelectorAll('.step-line').forEach((line, i) => {
    line.classList.toggle('completed', i + 1 < authStep);
  });
}

function selectAuthRole(role) {
  selectedAuthRole = role;
  document.getElementById('roleCustomer').classList.toggle('selected', role === 'customer');
  document.getElementById('roleVendor').classList.toggle('selected', role === 'vendor');
  document.getElementById('roleNextBtn').disabled = false;
}

function nextAuthStep() {
  if (authStep === 1) {
    if (!selectedAuthRole) return;
    authStep = 2;
    document.getElementById('authStep1').style.display = 'none';
    if (selectedAuthRole === 'customer') {
      document.getElementById('authStep2').style.display = 'block';
    } else {
      document.getElementById('authStep2Vendor').style.display = 'block';
      renderVendorCategories();
    }
  } else if (authStep === 2) {
    if (selectedAuthRole === 'vendor') {
      if (!selectedVendorType) return;
      authStep = 3;
      document.getElementById('authStep2Vendor').style.display = 'none';
      document.getElementById('authStep3').style.display = 'block';
    } else {
      // Customer form submits directly
      document.getElementById('customerForm').requestSubmit();
    }
  }
  updateAuthStepsUI();
}

function prevAuthStep() {
  if (authStep === 2) {
    authStep = 1;
    document.getElementById('authStep2').style.display = 'none';
    document.getElementById('authStep2Vendor').style.display = 'none';
    document.getElementById('authStep1').style.display = 'block';
  } else if (authStep === 3) {
    authStep = 2;
    document.getElementById('authStep3').style.display = 'none';
    document.getElementById('authStep2Vendor').style.display = 'block';
  }
  updateAuthStepsUI();
}

function renderVendorCategories() {
  const grid = document.getElementById('vendorCategoryGrid');
  if (!grid) return;
  grid.innerHTML = VENDOR_TYPES.map(vt => `
    <button type="button" class="vtype-card${selectedVendorType === vt.key ? ' selected' : ''}" onclick="selectVendorType('${vt.key}')" data-type="${vt.key}">
      <div class="vtype-icon">${vt.icon}</div>
      <h4>${vt.label}</h4>
      <p>${vt.desc}</p>
      <ul class="vtype-features">${vt.features.map(f => `<li><span class="vr-ok">✓</span>${f}</li>`).join('')}</ul>
    </button>
  `).join('');
}

function selectVendorType(key) {
  selectedVendorType = key;
  document.querySelectorAll('.vtype-card').forEach(c => c.classList.toggle('selected', c.dataset.type === key));
  document.getElementById('vendorCategoryNextBtn').disabled = false;
}

// ============ AUTH TABS ============
function switchAuthTab(tab) {
  const signinForm = document.getElementById('signinForm');
  const authStep1 = document.getElementById('authStep1');
  const authStep2 = document.getElementById('authStep2');
  const authStep2Vendor = document.getElementById('authStep2Vendor');
  const authStep3 = document.getElementById('authStep3');

  if (tab === 'signin') {
    if (signinForm) signinForm.style.display = 'block';
    if (authStep1) authStep1.style.display = 'none';
    if (authStep2) authStep2.style.display = 'none';
    if (authStep2Vendor) authStep2Vendor.style.display = 'none';
    if (authStep3) authStep3.style.display = 'none';
  } else {
    if (signinForm) signinForm.style.display = 'none';
    if (authStep1) authStep1.style.display = 'block';
    if (authStep2) authStep2.style.display = 'none';
    if (authStep2Vendor) authStep2Vendor.style.display = 'none';
    if (authStep3) authStep3.style.display = 'none';
    resetAuthFlow();
  }
}

// ============ MODAL HELPERS ============
function openAuthModal(tab = 'signin') {
  openModal('authModal');
  switchAuthTab(tab);
}

function openVendorRegistration() {
  openAuthModal('register');
  selectAuthRole('vendor');
  nextAuthStep();
}

function openLocationModal() {
  openModal('locationModal');
}

// ============ PASSWORD STRENGTH ============
function updatePasswordStrength(input, fillId, textId) {
  const val = input.value;
  const fill = document.getElementById(fillId);
  const text = document.getElementById(textId);
  if (!fill || !text) return;

  let strength = 0;
  if (val.length >= 8) strength++;
  if (/[A-Z]/.test(val)) strength++;
  if (/[a-z]/.test(val)) strength++;
  if (/[0-9]/.test(val)) strength++;
  if (/[^A-Za-z0-9]/.test(val)) strength++;

  const pct = (strength / 5) * 100;
  fill.style.width = pct + '%';

  const colors = ['var(--danger)', 'var(--danger)', 'var(--amber)', 'var(--success)', 'var(--success-dark)'];
  const texts = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
  fill.style.background = colors[strength] || 'var(--danger)';
  text.textContent = texts[strength] || 'Very weak';
}

document.addEventListener('input', (e) => {
  if (e.target.id === 'custPw') updatePasswordStrength(e.target, 'custPwFill', 'custPwText');
  if (e.target.id === 'vendPw') updatePasswordStrength(e.target, 'vendPwFill', 'vendPwText');
  if (e.target.id === 'resetPassword') updatePasswordStrength(e.target, 'resetPwFill', 'resetPwText');
});

// ============ FILE PREVIEW ============
function handleFilePreview(input, previewId) {
  const preview = document.getElementById(previewId);
  if (!preview) return;
  preview.innerHTML = '';
  Array.from(input.files).forEach(file => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      showToast('Only images and PDFs allowed', 'danger');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('File must be under 5MB', 'danger');
      return;
    }
    const item = document.createElement('div');
    item.className = 'file-preview-item';
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      item.innerHTML = `<img src="${url}" alt="${esc(file.name)}"><button onclick="this.parentElement.remove();">&times;</button>`;
    } else {
      item.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--slate-500)"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div><small>${esc(file.name)}</small><button onclick="this.parentElement.remove();">&times;</button>`;
    }
    preview.appendChild(item);
  });
}

// ============ REGION SELECTS ============
function populateRegionSelects() {
  const selects = document.querySelectorAll('#locationRegionSelect, #vendRegion');
  selects.forEach(select => {
    const current = select.value;
    select.innerHTML = '<option value="">Select region</option>' + REGIONS.map(r => `<option value="${r}"${r === current ? ' selected' : ''}>${r}</option>`).join('');
  });
}

// ============ LOCATION ============
function useMyLocation() {
  if (!navigator.geolocation) {
    showToast('Geolocation not supported', 'danger');
    return;
  }
  showToast('Getting your location...', 'info');
  navigator.geolocation.getCurrentPosition(
    pos => {
      const {latitude, longitude} = pos.coords;
      showToast('Location found! Finding nearest region...', 'success');
      setTimeout(() => {
        document.getElementById('locationRegionSelect').value = currentLocation;
        showToast('Location set to ' + currentLocation, 'success');
      }, 1000);
    },
    err => {
      showToast('Could not get location. Please select manually.', 'warning');
    }
  );
}

function saveLocation() {
  const region = document.getElementById('locationRegionSelect').value;
  if (!region) {
    showToast('Please select a region', 'warning');
    return;
  }
  currentLocation = region;
  document.getElementById('location-text').textContent = region;
  document.getElementById('mobileLocationName').textContent = region;
  closeModal('locationModal');
  showToast('Location set to ' + region, 'success');
  loadProducts();
}

// ============ CART ============
function addToCart(product, quantity = 1) {
  const stock = Number(product.stock);
  const maxQuantity = Number.isFinite(stock) && stock > 0 ? stock : 9999;
  const existing = cart.find(item => String(item.id) === String(product.id));
  const current = existing ? existing.quantity : 0;
  const next = Math.min(maxQuantity, current + Math.max(1, Number(quantity) || 1));

  if (existing) {
    if (next === existing.quantity) {
      showToast(`Only ${stock} of ${product.name} available.`, 'warning');
      return;
    }
    existing.quantity = next;
  } else {
    if (next <= 0) {
      showToast('This product is out of stock.', 'warning');
      return;
    }
    cart.push({...product, quantity: next});
  }
  updateCartUI();
  showToast(`${product.name} added to cart`, 'success');
  openCart();
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  updateCartUI();
}

function updateCartQuantity(productId, quantity) {
  const item = cart.find(item => String(item.id) === String(productId));
  if (item) {
    const stock = Number(item.stock);
    const maxQuantity = Number.isFinite(stock) && stock > 0 ? stock : 9999;
    item.quantity = Math.min(maxQuantity, Math.max(1, Number(quantity) || 1));
    updateCartUI();
  }
}

function updateCartUI() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const countEl = document.getElementById('cartCount');
  countEl.textContent = count;
  const cartBtn = document.getElementById('cartBtn');
  if (cartBtn) cartBtn.setAttribute('aria-label', `Shopping cart, ${count} item${count === 1 ? '' : 's'}`);
  document.getElementById('cartTotalAmount').textContent = formatPrice(total);

  const empty = document.getElementById('cartEmpty');
  const items = document.getElementById('cartItems');
  const footer = document.getElementById('cartFooter');

  if (cart.length === 0) {
    empty.style.display = 'block';
    items.style.display = 'none';
    items.innerHTML = '';
    footer.style.display = 'none';
  } else {
    empty.style.display = 'none';
    items.style.display = 'block';
    footer.style.display = 'block';
    items.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img src="${safeUrl(item.image) || 'assets/product-placeholder.svg'}" alt="${esc(item.name)}" width="60" height="60">
        <div class="cart-item-info">
          <h4>${esc(item.name)}</h4>
          <p class="cart-item-vendor">${esc(item.vendor)}</p>
          <p class="cart-item-price">${formatPrice(item.price)} × ${item.quantity}</p>
        </div>
        <div class="cart-item-qty">
          <button type="button" data-cart-decrease="${esc(item.id)}" aria-label="Decrease quantity of ${esc(item.name)}">&minus;</button>
          <span>${esc(item.quantity)}</span>
          <button type="button" data-cart-increase="${esc(item.id)}" aria-label="Increase quantity of ${esc(item.name)}">+</button>
        </div>
        <button type="button" class="cart-item-remove" data-cart-remove="${esc(item.id)}" aria-label="Remove ${esc(item.name)} from cart">&times;</button>
      </div>
    `).join('');
  }
}

function openCart() {
  const dropdown = document.getElementById('cartDropdown');
  const trigger = document.getElementById('cartBtn');
  dropdown.classList.add('open');
  if (trigger) trigger.setAttribute('aria-expanded', 'true');
}

function closeCart() {
  const dropdown = document.getElementById('cartDropdown');
  const trigger = document.getElementById('cartBtn');
  dropdown.classList.remove('open');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

function toggleCart() {
  const dropdown = document.getElementById('cartDropdown');
  const trigger = document.getElementById('cartBtn');
  const isOpen = dropdown.classList.toggle('open');
  if (trigger) trigger.setAttribute('aria-expanded', String(isOpen));
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#cartDropdown')) {
    closeCart();
  }
  if (!e.target.closest('#userMenu')) {
    document.getElementById('userMenu')?.classList.remove('open');
    document.getElementById('userMenuBtn')?.setAttribute('aria-expanded', 'false');
  }

  const cartAction = e.target.closest('[data-cart-increase], [data-cart-decrease], [data-cart-remove]');
  if (cartAction) {
    const id = cartAction.dataset.cartIncrease ?? cartAction.dataset.cartDecrease ?? cartAction.dataset.cartRemove;
    const item = cart.find(entry => String(entry.id) === String(id));
    if (item) {
      if (cartAction.dataset.cartIncrease != null) updateCartQuantity(item.id, item.quantity + 1);
      else if (cartAction.dataset.cartDecrease != null) updateCartQuantity(item.id, item.quantity - 1);
      else removeFromCart(item.id);
    }
    return;
  }

  const addButton = e.target.closest('[data-add-to-cart]');
  if (addButton) {
    e.stopPropagation();
    addToCartById(addButton.dataset.addToCart);
  }
});

// ============ CHECKOUT ============
function openCheckout() {
  if (USE_DEMO_PRODUCTS) {
    showToast('This is a demo catalogue. Checkout is disabled — browse the live catalogue to place an order.', 'info', 6000);
    return;
  }
  if (cart.length === 0) {
    showToast('Your cart is empty', 'warning');
    return;
  }
  if (!currentUser) {
    closeCart();
    openAuthModal('signin');
    showToast('Please sign in to checkout', 'info');
    return;
  }
  closeCart();
  openModal('checkoutModal');
  renderCheckout();
}

function cartVendorGroups() {
  const groups = new Map();
  cart.forEach(item => {
    const key = item.vendorEmail || item.vendor || 'verified-vendor';
    if (!groups.has(key)) {
      groups.set(key, {vendor: item.vendor || 'Verified vendor', items: []});
    }
    groups.get(key).items.push(item);
  });
  return [...groups.values()];
}

function renderCheckout() {
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const groups = cartVendorGroups();
  const content = document.getElementById('checkoutContent');
  if (!content) return;

  if (cart.length === 0) {
    content.innerHTML = `
      <div class="checkout-success">
        <div class="checkout-success-icon">🛒</div>
        <h3>Your cart is empty</h3>
        <p>Add materials from the catalogue to start an order.</p>
        <button class="btn btn-primary" onclick="closeModal('checkoutModal');scrollToProducts()">Browse products</button>
      </div>`;
    return;
  }

  const regionOptions = REGIONS.map(region => `<option value="${esc(region)}"${region === currentLocation ? ' selected' : ''}>${esc(region)}</option>`).join('');
  const phone = currentUser?.phone || '';

  content.innerHTML = `
    <form id="checkoutForm" onsubmit="placeOrder(event)" novalidate>
      <div class="auth-head">
        <h3>Review your order</h3>
        <p>${itemCount} item${itemCount === 1 ? '' : 's'} from ${groups.length} vendor${groups.length === 1 ? '' : 's'}</p>
      </div>
      <div class="checkout-vendors">
        ${groups.map(group => `
          <div class="checkout-vendor-group">
            <div class="checkout-vendor-name">🏪 ${esc(group.vendor)}</div>
            ${group.items.map(item => `
              <div class="cart-item">
                <img src="${safeUrl(item.image) || 'assets/product-placeholder.svg'}" alt="${esc(item.name)}" width="48" height="48">
                <div class="cart-item-info">
                  <h4>${esc(item.name)}</h4>
                  <p class="cart-item-price">${formatPrice(item.price)} × ${esc(item.quantity)} ${esc(item.unit || '')}</p>
                </div>
              </div>`).join('')}
          </div>`).join('')}
      </div>
      <div class="cart-total"><span>Order subtotal</span><span class="cart-total-amount">${formatPrice(total)}</span></div>
      <p class="checkout-note">Delivery is arranged directly with each vendor after you order. Pay cash or M-Pesa on delivery.</p>

      <div class="input-group">
        <label for="checkoutAddress">Delivery address</label>
        <textarea id="checkoutAddress" name="address" rows="3" required maxlength="500"
          placeholder="Street, plot number, landmark, and area">${esc(currentUser?.address || '')}</textarea>
      </div>
      <div class="input-row">
        <div class="input-group">
          <label for="checkoutRegion">Region</label>
          <select id="checkoutRegion" name="region" required>${regionOptions}</select>
        </div>
        <div class="input-group">
          <label for="checkoutPhone">Phone for delivery</label>
          <input id="checkoutPhone" name="phone" type="tel" value="${esc(phone)}"
            placeholder="+255 7XX XXX XXX" required autocomplete="tel" maxlength="20">
        </div>
      </div>
      <div class="input-group">
        <label>Payment on delivery</label>
        <div class="payment-options">
          <label class="payment-option"><input type="radio" name="payment" value="cash_on_delivery" checked><span>Cash on delivery</span></label>
          <label class="payment-option"><input type="radio" name="payment" value="mpesa_on_delivery"><span>M-Pesa on delivery</span></label>
        </div>
      </div>
      <button type="submit" class="btn btn-primary btn-lg btn-block">Place order · ${formatPrice(total)}</button>
      <p class="checkout-fineprint">By placing this order you agree to the <a href="legal.html#terms" target="_blank" rel="noopener">terms of sale</a>.</p>
    </form>`;
}

function friendlyOrderError(error) {
  const message = String(error?.message || error || '');
  const cleaned = message.replace(/^place_marketplace_order:\s*/i, '');
  return cleaned || 'We could not place your order. Please try again.';
}

async function placeOrder(event) {
  if (event) event.preventDefault();
  if (!currentUser) {
    closeModal('checkoutModal');
    openAuthModal('signin');
    showToast('Please sign in to place your order', 'info');
    return;
  }
  if (USE_DEMO_PRODUCTS) {
    showToast('Checkout is disabled in demo mode. Browse the live catalogue to place an order.', 'info', 6000);
    return;
  }

  const form = document.getElementById('checkoutForm');
  if (!form) return;

  const fieldValue = name => {
    const field = form.elements.namedItem(name);
    return field ? String(field.value || '') : '';
  };
  const address = fieldValue('address').trim();
  const phone = fieldValue('phone').trim();
  const region = fieldValue('region').trim();
  const payment = fieldValue('payment') || 'cash_on_delivery';
  const digits = phone.replace(/[^\d+]/g, '');

  if (address.length < 8) {
    showToast('Please enter a full delivery address.', 'warning');
    form.elements.namedItem('address')?.focus();
    return;
  }
  if (!/^(?:\+?255|0)\d{9}$/.test(digits)) {
    showToast('Enter a valid Tanzanian phone number, for example +255 754 123 456.', 'warning');
    form.elements.namedItem('phone')?.focus();
    return;
  }
  if (cart.length === 0) {
    showToast('Your cart is empty.', 'warning');
    return;
  }

  const items = cart.map(item => ({product_id: String(item.id), quantity: Number(item.quantity)}));
  const itemCount = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  showLoading('Placing your order...');
  try {
    const {data, error} = await _supabase.rpc('place_marketplace_order', {
      p_items: items,
      p_address: address,
      p_phone: phone,
      p_region: region,
      p_payment_method: payment
    });
    if (error) throw error;
    if (!data || !data.group_id) throw new Error('No order confirmation was received.');

    cart = [];
    updateCartUI();
    closeCart();
    renderCheckoutConfirmation(data, phone, itemCount);
    await loadProducts();
  } catch (error) {
    showToast(friendlyOrderError(error), 'danger', 7000);
  } finally {
    hideLoading();
  }
}

function renderCheckoutConfirmation(data, phone, itemCount = 0) {
  const content = document.getElementById('checkoutContent');
  if (!content) return;
  const vendorCount = Number(data.vendor_count) || 1;
  const total = Number(data.total) || 0;
  content.innerHTML = `
    <div class="checkout-success">
      <div class="checkout-success-icon">✓</div>
      <h3>Order placed</h3>
      <p class="checkout-order-number">Order #${esc(data.group_id)}</p>
      <div class="checkout-success-summary">
        <div><span>Vendors</span><strong>${vendorCount}</strong></div>
        <div><span>Items</span><strong>${itemCount || '—'}</strong></div>
        <div><span>Total</span><strong>${formatPrice(total)}</strong></div>
      </div>
      <p>Your order has been sent to ${vendorCount === 1 ? 'the vendor' : 'the vendors'}. They will call <strong>${esc(phone)}</strong> to confirm delivery and payment.</p>
      <div class="checkout-success-actions">
        <button class="btn btn-primary" onclick="closeModal('checkoutModal');openCustomerDashboard()">View my orders</button>
        <button class="btn btn-outline" onclick="closeModal('checkoutModal');scrollToProducts()">Continue shopping</button>
      </div>
    </div>`;
}

// ============ PRODUCTS & VENDORS ============
const USE_DEMO_PRODUCTS = new URLSearchParams(location.search).get('demo') === '1';

async function loadProducts() {
  if (USE_DEMO_PRODUCTS) {
    loadMockProducts();
    return;
  }
  try {
    const [productsResult, vendorsResult] = await Promise.all([
      _supabase.from('products').select('*').eq('status', 'active').eq('deleted', false).limit(100),
      _supabase.from('public_vendors').select('*').order('joined_at', {ascending: true}).limit(50)
    ]);

    if (productsResult.error) console.warn('Products query failed:', productsResult.error.message);
    if (vendorsResult.error) console.warn('Vendors query failed:', vendorsResult.error.message);

    allProducts = productsResult.error ? [] : (productsResult.data || []);
    allVendors = vendorsResult.error ? [] : (vendorsResult.data || []);

    if (allProducts.length === 0 && USE_DEMO_PRODUCTS) {
      loadMockProducts();
      return;
    }

    hydrateVendors();
    renderStorefront();
  } catch (error) {
    console.error('Load storefront error:', error);
    allProducts = [];
    allVendors = [];
    renderStorefront();
  }
}

function hydrateVendors() {
  const byName = new Map();
  allVendors.forEach(vendor => {
    byName.set(String(vendor.store_name || '').toLowerCase(), vendor);
  });

  allProducts.forEach(product => {
    const vendor = byName.get(String(product.vendor || '').toLowerCase());
    product.vendorRegion = vendor?.region || product.vendorRegion || 'Tanzania';
  });

  allVendors = allVendors.map(vendor => {
    const vendorProducts = allProducts.filter(product =>
      String(product.vendor || '').toLowerCase() === String(vendor.store_name || '').toLowerCase()
    );
    const average = vendorProducts.length
      ? vendorProducts.reduce((sum, product) => sum + Number(product.rating || 0), 0) / vendorProducts.length
      : Number(vendor.rating || 0);
    return {
      ...vendor,
      product_count: vendorProducts.length || Number(vendor.product_count || 0),
      rating: average ? Number(average.toFixed(2)) : null
    };
  });
}

function renderStorefront() {
  renderProducts();
  renderCategories();
  renderVendors();
  updateHeroStats();
  updateTrustLogos();
}

function setStatValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value === null || value === undefined || value === '' ? '—' : String(value);
}

function updateHeroStats() {
  const vendorCount = allVendors.length;
  const productCount = allProducts.length;
  const categories = new Set(allProducts.map(product => product.category).filter(Boolean));
  const regions = new Set(allVendors.map(vendor => vendor.region).filter(Boolean));

  setStatValue('statVendors', vendorCount || null);
  setStatValue('statProducts', productCount || null);
  setStatValue('statCategories', categories.size || CATEGORIES.length);
  setStatValue('statRegions', regions.size || null);

  const badge = document.getElementById('heroBadgeText');
  if (badge) {
    badge.textContent = vendorCount
      ? `${vendorCount} verified vendor${vendorCount === 1 ? '' : 's'} · ${productCount} material${productCount === 1 ? '' : 's'} listed`
      : 'Verified suppliers across Tanzania';
  }
}

function updateTrustLogos() {
  const block = document.getElementById('heroTrust');
  const logos = document.getElementById('heroTrustLogos');
  if (!block || !logos) return;

  const featured = allVendors.slice(0, 5);
  if (featured.length < 3) {
    block.style.display = 'none';
    logos.innerHTML = '';
    return;
  }

  block.style.display = '';
  logos.innerHTML = featured.map(vendor => `<span class="trust-logo">${esc(vendor.store_name)}</span>`).join('');
}

function loadMockProducts() {
  allProducts = [
    {id: 'demo-1', name: 'Portland Cement 50kg', category: 'cement', price: 18500, unit: 'bag', stock: 500, vendor: 'Simba Cement', vendorEmail: 'demo@simba.co.tz', vendorRegion: 'Dar es Salaam', rating: 4.8, reviews: 234, image: 'assets/cement.svg'},
    {id: 'demo-2', name: 'TMT Steel Rebar 12mm', category: 'steel', price: 32000, unit: 'piece', stock: 200, vendor: 'Africa Steel', vendorEmail: 'demo@africasteel.co.tz', vendorRegion: 'Dar es Salaam', rating: 4.9, reviews: 189, image: 'https://images.unsplash.com/photo-1530863506128-dc9eb5c3e0fc?w=400&q=80'},
    {id: 'demo-3', name: 'Ceramic Floor Tiles 60x60', category: 'tiles', price: 28000, unit: 'm²', stock: 1000, vendor: 'Tile Master', vendorEmail: 'demo@tilemaster.co.tz', vendorRegion: 'Arusha', rating: 4.7, reviews: 156, image: 'https://images.unsplash.com/photo-1523350165414-082d792c4bcc?w=400&q=80'},
    {id: 'demo-4', name: 'Corrugated Iron Sheets 3m', category: 'roofing', price: 38000, unit: 'sheet', stock: 300, vendor: 'RoofTech', vendorEmail: 'demo@rooftech.co.tz', vendorRegion: 'Mwanza', rating: 4.6, reviews: 98, image: 'https://images.unsplash.com/photo-1673645652350-6a4c31c1c78f?w=400&q=80'},
    {id: 'demo-5', name: 'Weather Guard Paint 20L', category: 'paint', price: 245000, unit: 'bucket', stock: 150, vendor: 'ColorWorld', vendorEmail: 'demo@colorworld.co.tz', vendorRegion: 'Dar es Salaam', rating: 4.8, reviews: 201, image: 'https://images.unsplash.com/photo-1542238060-646c7ed65622?w=400&q=80'},
    {id: 'demo-6', name: 'PVC Pipes 4 inch', category: 'plumbing', price: 28000, unit: 'piece', stock: 400, vendor: 'PipeLine', vendorEmail: 'demo@pipeline.co.tz', vendorRegion: 'Mbeya', rating: 4.5, reviews: 87, image: 'assets/pipes.svg'},
    {id: 'demo-7', name: 'Concrete Blocks 6 inch', category: 'cement', price: 3200, unit: 'piece', stock: 2000, vendor: 'Simba Cement', vendorEmail: 'demo@simba.co.tz', vendorRegion: 'Dar es Salaam', rating: 4.7, reviews: 145, image: 'assets/cement.svg'},
    {id: 'demo-8', name: 'Stainless Steel Pipes 2 inch', category: 'steel', price: 28000, unit: 'meter', stock: 500, vendor: 'Africa Steel', vendorEmail: 'demo@africasteel.co.tz', vendorRegion: 'Dar es Salaam', rating: 4.8, reviews: 92, image: 'assets/pipes.svg'},
    {id: 'demo-9', name: 'Porcelain Wall Tiles 30x60', category: 'tiles', price: 24000, unit: 'm²', stock: 800, vendor: 'Tile Master', vendorEmail: 'demo@tilemaster.co.tz', vendorRegion: 'Arusha', rating: 4.6, reviews: 78, image: 'https://images.unsplash.com/photo-1551893478-d726eaf0442c?w=400&q=80'},
    {id: 'demo-10', name: 'Clay Roof Tiles Red', category: 'roofing', price: 2200, unit: 'piece', stock: 1500, vendor: 'RoofTech', vendorEmail: 'demo@rooftech.co.tz', vendorRegion: 'Mwanza', rating: 4.5, reviews: 67, image: 'https://images.unsplash.com/photo-1518736346281-76873166a64a?w=400&q=80'},
    {id: 'demo-11', name: 'Acrylic Emulsion Paint 10L', category: 'paint', price: 68000, unit: 'bucket', stock: 300, vendor: 'ColorWorld', vendorEmail: 'demo@colorworld.co.tz', vendorRegion: 'Dar es Salaam', rating: 4.7, reviews: 112, image: 'https://images.unsplash.com/photo-1525909002-1b05e0c869d8?w=400&q=80'},
    {id: 'demo-12', name: 'HDPE Pipes 63mm', category: 'plumbing', price: 9500, unit: 'meter', stock: 1000, vendor: 'PipeLine', vendorEmail: 'demo@pipeline.co.tz', vendorRegion: 'Mbeya', rating: 4.6, reviews: 54, image: 'https://images.unsplash.com/photo-1729169927271-7826d8aae360?w=400&q=80'}
  ];
  allVendors = [
    {id: 'demo-v1', store_name: 'Simba Cement', region: 'Dar es Salaam', rating: 4.8, product_count: 2, photo: 'assets/cement.svg'},
    {id: 'demo-v2', store_name: 'Africa Steel', region: 'Dar es Salaam', rating: 4.9, product_count: 2, photo: 'https://images.unsplash.com/photo-1530863506128-dc9eb5c3e0fc?w=200&q=70'},
    {id: 'demo-v3', store_name: 'Tile Master', region: 'Arusha', rating: 4.7, product_count: 2, photo: 'https://images.unsplash.com/photo-1523350165414-082d792c4bcc?w=200&q=70'},
    {id: 'demo-v4', store_name: 'RoofTech', region: 'Mwanza', rating: 4.6, product_count: 2, photo: 'https://images.unsplash.com/photo-1673645652350-6a4c31c1c78f?w=200&q=70'},
    {id: 'demo-v5', store_name: 'ColorWorld', region: 'Dar es Salaam', rating: 4.8, product_count: 2, photo: 'https://images.unsplash.com/photo-1542238060-646c7ed65622?w=200&q=70'},
    {id: 'demo-v6', store_name: 'PipeLine', region: 'Mbeya', rating: 4.5, product_count: 2, photo: 'assets/pipes.svg'}
  ];
  hydrateVendors();
  renderStorefront();
}

function productImage(product) {
  return safeUrl(product && product.image) || 'assets/product-placeholder.svg';
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  let filtered = [...allProducts];
  const query = activeFilters.search.toLowerCase();

  if (activeFilters.category) {
    filtered = filtered.filter(p => String(p.category || '').toLowerCase() === activeFilters.category);
  }
  if (activeFilters.vendor) {
    filtered = filtered.filter(p => String(p.vendor || '').toLowerCase() === activeFilters.vendor.toLowerCase());
  }
  if (query) {
    filtered = filtered.filter(p => [p.name, p.vendor, categoryLabel(p.category), p.category, p.vendorRegion, p.description]
      .some(value => String(value || '').toLowerCase().includes(query)));
  }

  switch (currentSort) {
    case 'price-asc': filtered.sort((a, b) => Number(a.price) - Number(b.price)); break;
    case 'price-desc': filtered.sort((a, b) => Number(b.price) - Number(a.price)); break;
    case 'rating': filtered.sort((a, b) => Number(b.rating) - Number(a.rating)); break;
    case 'newest': filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)); break;
    default:
      filtered.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0) || Number(b.reviews || 0) - Number(a.reviews || 0));
  }

  updateProductsHeader(filtered.length);

  if (filtered.length === 0) {
    const filtersActive = Boolean(activeFilters.search || activeFilters.category || activeFilters.vendor);
    const label = activeFilters.search
      ? `“${esc(activeFilters.search)}”`
      : activeFilters.vendor
        ? esc(activeFilters.vendor)
        : 'this category';
    grid.innerHTML = `
      <div class="empty-state" role="listitem">
        <div class="empty-state-icon">${filtersActive ? '🔍' : '🏗️'}</div>
        <h3>${filtersActive ? 'No products match your search' : 'No products listed yet'}</h3>
        <p>${filtersActive
          ? `We couldn't find anything for ${label}. Try another term or browse everything.`
          : 'Verified vendors are onboarding. Check back soon, or register your business and be the first.'}</p>
        ${filtersActive
          ? '<button class="btn btn-primary" onclick="clearProductFilters(event)">Clear filters</button>'
          : '<button class="btn btn-primary" onclick="openVendorRegistration()">Become a Vendor</button>'}
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const rating = Number(p.rating || 0);
    const reviews = Number(p.reviews || 0);
    const stock = Number(p.stock || 0);
    return `
    <article class="card product-card" role="listitem" data-product-id="${esc(p.id)}" onclick="viewProduct(this.dataset.productId)">
      <div class="product-image">
        <img src="${productImage(p)}" alt="${esc(p.name)}" loading="lazy" width="400" height="300"
             onerror="this.onerror=null;this.src='assets/product-placeholder.svg'">
        ${p.badge ? `<span class="product-badge">${esc(p.badge)}</span>` : ''}
      </div>
      <div class="product-body">
        <div class="product-category"><span class="badge badge-info">${esc(categoryLabel(p.category))}</span></div>
        <h3 class="product-name">${esc(p.name)}</h3>
        <div class="product-meta">
          <button type="button" class="product-vendor" data-vendor-name="${esc(p.vendor)}"
            onclick="event.stopPropagation();viewVendorByName(this.dataset.vendorName)">🏪 ${esc(p.vendor)}</button>
          <span class="product-location">📍 ${esc(p.vendorRegion || 'Tanzania')}</span>
        </div>
        <div class="product-rating">
          <span class="rating">${rating > 0 ? `★ ${rating.toFixed(1)}` : 'New'}</span>
          <span class="reviews">(${reviews} review${reviews === 1 ? '' : 's'})</span>
        </div>
        <div class="product-footer">
          <span class="product-price">${formatPrice(p.price)} <span class="unit">/${esc(p.unit || 'unit')}</span></span>
          <button class="btn btn-primary btn-sm" data-add-to-cart="${esc(p.id)}" ${stock <= 0 ? 'disabled' : ''}>${stock <= 0 ? 'Out of stock' : 'Add to Cart'}</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

function renderCategories() {
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;

  const counts = new Map();
  allProducts.forEach(p => {
    const key = String(p.category || '').toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  grid.innerHTML = CATEGORIES.map(c => {
    const count = counts.get(c.id) || 0;
    const selected = activeFilters.category === c.id;
    return `
      <button type="button" class="card category-card${selected ? ' selected' : ''}" aria-pressed="${selected}" onclick="filterByCategory('${c.id}')">
        <div class="category-icon">${c.icon}</div>
        <h3>${esc(c.name)}</h3>
        ${allProducts.length ? `<span class="badge badge-info">${count} product${count === 1 ? '' : 's'}</span>` : ''}
      </button>`;
  }).join('');
}

function renderVendors() {
  const carousel = document.getElementById('vendorsCarousel');
  if (!carousel) return;

  const toggle = document.getElementById('vendorsToggle');
  const vendors = [...allVendors].sort((a, b) =>
    Number(b.rating || 0) - Number(a.rating || 0) ||
    Number(b.product_count || 0) - Number(a.product_count || 0) ||
    String(a.store_name || '').localeCompare(String(b.store_name || ''))
  );

  if (vendors.length === 0) {
    carousel.innerHTML = `
      <div class="empty-state" role="listitem">
        <div class="empty-state-icon">🏪</div>
        <h3>Verified vendors are onboarding</h3>
        <p>New stores are being reviewed before they go live. Register your business to join the marketplace.</p>
        <button class="btn btn-primary" onclick="openVendorRegistration()">Become a Vendor</button>
      </div>`;
    if (toggle) toggle.style.display = 'none';
    return;
  }

  const visible = vendorsExpanded ? vendors : vendors.slice(0, 6);
  carousel.innerHTML = visible.map(v => {
    const rating = Number(v.rating || 0);
    const products = Number(v.product_count || 0);
    const photo = safeUrl(v.photo);
    return `
      <article class="card vendor-card" role="listitem">
        <div class="vendor-header">
          <div class="vendor-avatar">
            ${photo
              ? `<img src="${photo}" alt="${esc(v.store_name)}" loading="lazy" width="56" height="56">`
              : `<span aria-hidden="true">${esc(initialsFor(v.store_name))}</span>`}
          </div>
          <div>
            <h3>${esc(v.store_name)}</h3>
            <div class="vendor-meta">
              <span class="vendor-location">📍 ${esc(v.region || 'Tanzania')}</span>
              <span class="badge badge-success">${products} product${products === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>
        <div class="vendor-stats">
          <div class="stat"><span class="stat-value">${rating > 0 ? `★ ${rating.toFixed(1)}` : 'New'}</span><span class="stat-label">Rating</span></div>
          <div class="stat"><span class="stat-value">${products}</span><span class="stat-label">Products</span></div>
          <div class="stat"><span class="stat-value">✓</span><span class="stat-label">Verified</span></div>
        </div>
        <button class="btn btn-primary btn-sm btn-block" ${products === 0 ? 'disabled' : ''}
          onclick="viewVendor('${esc(v.id)}')">${products === 0 ? 'No products yet' : 'View Products'}</button>
      </article>`;
  }).join('');

  if (toggle) {
    if (vendors.length > 6) {
      toggle.style.display = '';
      toggle.textContent = vendorsExpanded ? 'Show fewer vendors' : `View all ${vendors.length} vendors`;
    } else {
      toggle.style.display = 'none';
    }
  }
}

function toggleVendorList() {
  vendorsExpanded = !vendorsExpanded;
  renderVendors();
}

function parseProductFilters() {
  const hash = location.hash.replace(/^#/, '');
  if (!hash.startsWith('products')) return {search: '', category: '', vendor: ''};
  const params = new URLSearchParams(hash.split('?')[1] || '');
  return {
    search: (params.get('search') || '').trim(),
    category: (params.get('category') || '').trim(),
    vendor: (params.get('vendor') || '').trim()
  };
}

function applyProductFilters() {
  activeFilters = parseProductFilters();
  renderProducts();
  renderCategories();
}

function setProductFilters(filters) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.category) params.set('category', filters.category);
  if (filters.vendor) params.set('vendor', filters.vendor);
  const hash = '#products' + (params.toString() ? '?' + params.toString() : '');

  history.pushState(null, '', hash);
  applyProductFilters();

  const section = document.getElementById('products');
  if (section) section.scrollIntoView({behavior: 'smooth', block: 'start'});
}

function filterByCategory(categoryId) {
  setProductFilters({category: categoryId});
}

function clearProductFilters(event) {
  if (event) event.preventDefault();
  history.pushState(null, '', '#products');
  applyProductFilters();
  const section = document.getElementById('products');
  if (section) section.scrollIntoView({behavior: 'smooth', block: 'start'});
}

function updateProductsHeader(count) {
  const subtitle = document.getElementById('productsSubtitle');
  if (!subtitle) return;

  let text = `${count} product${count === 1 ? '' : 's'}`;
  if (activeFilters.vendor) text += ` from ${activeFilters.vendor}`;
  if (activeFilters.category) text += ` in ${categoryLabel(activeFilters.category)}`;
  if (activeFilters.search) text += ` matching “${activeFilters.search}”`;

  subtitle.textContent = (activeFilters.vendor || activeFilters.category || activeFilters.search)
    ? text
    : 'Top-rated materials from verified vendors';
}

function addToCartById(productId) {
  const product = allProducts.find(p => String(p.id) === String(productId));
  if (!product) return;
  if (Number(product.stock) <= 0) {
    showToast('This product is out of stock.', 'warning');
    return;
  }
  addToCart(product);
}

function viewProduct(productId) {
  const product = allProducts.find(p => String(p.id) === String(productId));
  if (!product) {
    showToast('This product is no longer available.', 'warning');
    return;
  }

  const content = document.getElementById('productContent');
  if (!content) return;

  const rating = Number(product.rating || 0);
  const reviews = Number(product.reviews || 0);
  const stock = Number(product.stock || 0);
  const maxQuantity = Math.max(1, Math.min(stock, 999));
  const description = product.description || `Quality ${categoryLabel(product.category).toLowerCase()} supplied by a verified JengaNasi vendor.`;

  content.innerHTML = `
    <div class="product-detail">
      <div class="product-detail-image">
        <img src="${productImage(product)}" alt="${esc(product.name)}"
          onerror="this.onerror=null;this.src='assets/product-placeholder.svg'">
        ${product.badge ? `<span class="product-badge">${esc(product.badge)}</span>` : ''}
      </div>
      <div class="product-detail-info">
        <span class="badge badge-info">${esc(categoryLabel(product.category))}</span>
        <h3>${esc(product.name)}</h3>
        <div class="product-rating">
          <span class="rating">${rating > 0 ? `★ ${rating.toFixed(1)}` : 'New'}</span>
          <span class="reviews">${reviews} review${reviews === 1 ? '' : 's'}</span>
        </div>
        <div class="product-detail-price">${formatPrice(product.price)} <span>/ ${esc(product.unit || 'unit')}</span></div>
        <p class="product-detail-stock ${stock <= 10 ? 'low' : ''}">${stock > 0 ? `${stock} in stock${stock <= 10 ? ' — low stock' : ''}` : 'Currently out of stock'}</p>
        <p class="product-detail-description">${esc(description)}</p>
        <button type="button" class="product-detail-vendor" onclick="viewVendorByName(this.dataset.vendorName)" data-vendor-name="${esc(product.vendor)}">
          <span class="product-detail-vendor-label">Sold by</span>
          <strong>${esc(product.vendor)}</strong>
          <span>📍 ${esc(product.vendorRegion || 'Tanzania')}</span>
        </button>
        <div class="product-detail-buy">
          <div class="quantity-control">
            <label for="detailQty">Qty</label>
            <input id="detailQty" type="number" min="1" max="${maxQuantity}" value="1" ${stock <= 0 ? 'disabled' : ''}>
          </div>
          <button class="btn btn-primary btn-lg" ${stock <= 0 ? 'disabled' : ''} onclick="addProductFromDetail('${esc(product.id)}')">
            ${stock <= 0 ? 'Out of stock' : 'Add to Cart'}
          </button>
        </div>
        <p class="product-detail-note">Delivery is arranged with the vendor after checkout.</p>
      </div>
    </div>`;

  openModal('productModal');
}

function addProductFromDetail(productId) {
  const product = allProducts.find(p => String(p.id) === String(productId));
  if (!product) return;
  const quantityInput = document.getElementById('detailQty');
  const requested = Math.max(1, parseInt(quantityInput?.value, 10) || 1);
  const stock = Number(product.stock || 0);
  if (stock <= 0) {
    showToast('This product is out of stock.', 'warning');
    return;
  }
  addToCart(product, Math.min(requested, stock));
  closeModal('productModal');
}

function viewVendor(vendorId) {
  const vendor = allVendors.find(v => String(v.id) === String(vendorId));
  if (!vendor) {
    showToast('This vendor is not available.', 'warning');
    return;
  }
  viewVendorByName(vendor.store_name);
}

function viewVendorByName(vendorName) {
  if (!vendorName) return;
  closeModal('productModal');
  setProductFilters({vendor: vendorName});
}

function scrollToProducts() {
  closeCart();
  navigateToSection('products');
}

// ============ AUTH HANDLERS ============
async function handleSignIn(e) {
  e.preventDefault();
  const form = e.target;
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;
  if (!email || !password) { showToast('Please fill in all fields', 'danger'); return; }
  showLoading('Signing in...');
  try {
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(friendlyAuthError(error));

    const user = data.user;
    if (!user) throw new Error('Sign in failed. Please try again.');

    const profile = await resolveUserProfile(user, { createIfMissing: true });
    if (!profile) throw new Error('We could not load your account profile. Please contact support.');

    currentUser = profile;
    closeModal('authModal');
    saveSession(currentUser);
    updateAuthUI();
    form.reset();
    showToast('Welcome back, ' + (currentUser.name || 'there').split(' ')[0] + '!');
    openAccountDashboard();
    renderProducts();
    renderCategoryChips();
    initPush();
  } catch (e) { showToast(e.message || 'An error occurred', 'danger'); } finally { hideLoading(); }
}

async function handleCustomerRegister(e) {
  e.preventDefault();
  const form = e.target;
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;
  const name = form.name.value.trim();
  const phone = form.phone.value.trim();
  if (!email || !password || !name || !phone) { showToast('Please fill in all fields', 'danger'); return; }
  if (!form.agreeTerms?.checked) { showToast('You must agree to the Terms & Conditions', 'danger'); return; }
  showLoading('Creating account...');
  try {
    if (demoMode) {
      if (findDemoUser(email)) { showToast('Email already registered', 'danger'); return; }
      const hashedPw = await hashPasswordV2(password);
      const user = { email, password: hashedPw, name, role: 'customer', phone, createdAt: new Date().toISOString() };
      addDemoUser(user);
      currentUser = { name, email, role: 'customer' };
    } else {
      const { data: authData, error: authError } = await _supabase.auth.signUp({
        email, password,
        options: {
          data: {
            name, role: 'customer', phone,
            nationalId: form.nationalId?.value?.trim() || null,
            tin: form.tin?.value?.trim() || null,
            paymentAccount: form.paymentAccount?.value?.trim() || null
          }
        }
      });
      if (authError) throw new Error(friendlyAuthError(authError));
      if (!authData.session) {
        closeModal('authModal');
        openModal('authModal');
        switchAuthTab('signin');
        showToast('Account created. Check your email to confirm, then sign in.', 'success', 8000);
        return;
      }
      const profile = await resolveUserProfile(authData.user, { createIfMissing: true });
      if (!profile || !profile.persisted) {
        throw new Error('Your account was created, but your profile could not be saved. Please contact support.');
      }
      currentUser = profile;
    }
    closeModal('authModal');
    saveSession(currentUser);
    updateAuthUI();
    form.reset();
    regDocData = {};
    vendorUploadedImage = null;
    resetVendorTypePicker();
    resetCustomerTypePicker();
    document.querySelectorAll('[id^=reg][id$=Preview]').forEach(img => img.style.display = 'none');
    showToast('Welcome, ' + currentUser.name.split(' ')[0] + '!');
    openCustomerDashboard();
    renderProducts();
    renderCategoryChips();
    initPush();
  } catch (e) { showToast(e.message || 'An error occurred', 'danger'); } finally { hideLoading(); }
}

async function handleVendorRegister(e) {
  e.preventDefault();
  const form = e.target;
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;
  const name = form.fullName.value.trim();
  const phone = form.phone.value.trim();
  if (!email || !password || !name || !phone) { showToast('Please fill in all fields', 'danger'); return; }
  const agreeEl = form.agreeTerms;
  if (!agreeEl || !agreeEl.checked) { showToast('You must agree to the Terms & Conditions', 'danger'); return; }
  const storeName = form.storeName.value.trim() || name;
  showLoading('Creating account...');
  try {
    if (demoMode) {
      if (findDemoUser(email)) { showToast('Email already registered', 'danger'); return; }
      const hashedPw = await hashPasswordV2(password);
      const user = { email, password: await hashPasswordV2(password), name, role: 'vendor', storeName, phone, createdAt: new Date().toISOString() };
      addDemoUser(user);
      currentUser = { name: storeName, email, role: 'vendor', vendorEmail: email };
    } else {
      const { data: authData, error: authError } = await _supabase.auth.signUp({
        email, password,
        options: {
          data: {
            name, role: 'vendor', storeName, phone,
            vendorType: selectedVendorType || null,
            brela: form.brela?.value?.trim() || null,
            licence: form.licence?.value?.trim() || null,
            nationalId: form.vendorNationalId?.value?.trim() || null,
            tin: form.vendorTin?.value?.trim() || null,
            bankAccount: form.vendorBank?.value?.trim() || null,
            photo: vendorUploadedImage || null,
            region: form.region?.value?.trim() || null,
            lat: form.vendorLat?.value ? parseFloat(form.vendorLat.value) || null : null,
            lng: form.vendorLng?.value ? parseFloat(form.vendorLng.value) || null : null
          }
        }
      });
      if (authError) throw new Error(friendlyAuthError(authError));
      if (!authData.session) {
        closeModal('authModal');
        openModal('authModal');
        switchAuthTab('signin');
        showToast('Vendor account created. Check your email to confirm, then sign in.', 'success', 8000);
        return;
      }
      const profile = await resolveUserProfile(authData.user, { createIfMissing: true });
      if (!profile || !profile.persisted) {
        throw new Error('Your account was created, but your vendor profile could not be saved. Please contact support.');
      }
      currentUser = profile;
    }
    closeModal('authModal');
    saveSession(currentUser);
    updateAuthUI();
    form.reset();
    regDocData = {};
    vendorUploadedImage = null;
    resetVendorTypePicker();
    resetCustomerTypePicker();
    document.querySelectorAll('[id^=reg][id$=Preview]').forEach(img => img.style.display = 'none');
    showToast('Welcome, ' + currentUser.name.split(' ')[0] + '!');
    openVendorDashboard();
    renderProducts();
    renderCategoryChips();
    initPush();
  } catch (e) { showToast(e.message || 'An error occurred', 'danger'); } finally { hideLoading(); }
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const form = e.target;
  const email = form.email.value.trim().toLowerCase();
  if (!email) { showToast('Please enter your email', 'danger'); return; }
  showLoading('Sending reset link...');
  try {
    const { error } = await _supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname + '#reset-password' });
    if (error) throw error;
    showToast('If this email exists, a password reset link has been sent.', 'success');
    closeModal('forgotPasswordModal');
  } catch (err) {
    showToast('Failed to send reset link: ' + err.message, 'danger');
  } finally { hideLoading(); }
}

async function handleResetPassword(e) {
  e.preventDefault();
  const form = e.target;
  const password = form.password.value;
  const confirm = form.confirm.value;
  if (!password || !confirm) { showToast('Please fill in all fields', 'danger'); return; }
  if (password !== confirm) { showToast('Passwords do not match', 'danger'); return; }
  if (password.length < 8) { showToast('Password must be at least 8 characters', 'danger'); return; }
  showLoading('Updating password...');
  try {
    const { error } = await _supabase.auth.updateUser({ password: password });
    if (error) throw error;
    showToast('Password updated successfully! Please sign in with your new password.', 'success');
    closeModal('resetPasswordModal');
    openModal('authModal');
    switchAuthTab('signin');
  } catch (err) {
    showToast('Failed to update password: ' + err.message, 'danger');
  } finally { hideLoading(); }
}

function resetVendorTypePicker() {
  selectedVendorType = null;
  document.querySelectorAll('.vtype-card').forEach(c => c.classList.remove('selected'));
  const btn = document.getElementById('vendorCategoryNextBtn');
  if (btn) btn.disabled = true;
}

function resetCustomerTypePicker() {
  // placeholder for symmetry
}

function renderCategoryChips() {
  // placeholder
}

function initPush() {
  // placeholder
}

// ============ DASHBOARD NAVIGATION ============
// The admin, vendor, and customer dashboards are dedicated pages. The main
// storefront only links to them; access is re-verified on each page.
function initialsFor(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2)
    .map(part => part.charAt(0)).join('').toUpperCase() || '?';
}

function openCustomerDashboard() {
  window.location.href = '/customer';
}

function openVendorDashboard() {
  window.location.href = '/vendor';
}

function openAdminDashboard() {
  window.location.href = '/admin';
}

// ============ SEARCH & SORT ============
document.getElementById('heroSearchBtn')?.addEventListener('click', () => {
  const query = document.getElementById('heroSearch').value.trim();
  setProductFilters({search: query});
});

document.getElementById('heroSearch')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') document.getElementById('heroSearchBtn').click();
});

document.getElementById('sortSelect')?.addEventListener('change', (e) => {
  currentSort = e.target.value;
  renderProducts();
});

// ============ MOBILE MENU ============
function closeMobileMenu() {
  const navLinks = document.getElementById('navLinks');
  const btn = document.getElementById('mobileMenuBtn');
  if (!navLinks) return;
  navLinks.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}

document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
  const navLinks = document.getElementById('navLinks');
  const btn = document.getElementById('mobileMenuBtn');
  const isOpen = navLinks.classList.toggle('open');
  btn.setAttribute('aria-expanded', String(isOpen));
  document.body.classList.toggle('menu-open', isOpen);
});

document.querySelectorAll('#navLinks a, #navLinks button').forEach(el => {
  el.addEventListener('click', closeMobileMenu);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMobileMenu();
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 900) closeMobileMenu();
});

// ============ ACCOUNT MENU ============
document.getElementById('userMenuBtn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  const menu = document.getElementById('userMenu');
  const btn = document.getElementById('userMenuBtn');
  const isOpen = menu.classList.toggle('open');
  btn.setAttribute('aria-expanded', String(isOpen));
});

// ============ HEADER SCROLL ============
window.addEventListener('scroll', () => {
  const header = document.getElementById('header');
  if (window.scrollY > 20) header.classList.add('scrolled');
  else header.classList.remove('scrolled');
});

// ============ SMOOTH SCROLL ============
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    if (e.defaultPrevented) return;
    const href = this.getAttribute('href');
    if (!href || href === '#') return;

    // Strip ?search= / ?category= before using the hash as a selector.
    const selector = href.split('?')[0];
    let target = null;
    try { target = document.querySelector(selector); } catch (err) { target = null; }

    if (target) {
      e.preventDefault();
      target.scrollIntoView({behavior: 'smooth', block: 'start'});
      history.pushState(null, '', href);
    }
  });
});

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  activeFilters = parseProductFilters();
  loadSession();
  updateAuthUI();
  restoreSession();

  _supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' && currentUser) {
      clearSession();
    }
  });

  loadProducts();
  populateRegionSelects();

  window.addEventListener('hashchange', applyProductFilters);

  document.getElementById('locationBtn')?.addEventListener('click', () => openModal('locationModal'));

  document.getElementById('cartBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCart();
  });
});