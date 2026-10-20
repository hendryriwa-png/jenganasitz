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
let demoMode = false;
let supabaseAvailable = true;
let regDocData = {};
let vendorUploadedImage = null;

// ============ UTILITY FUNCTIONS ============
function formatPrice(amount) {
  return new Intl.NumberFormat('sw-TZ', {style: 'currency', currency: 'TZS', minimumFractionDigits: 0}).format(amount);
}

function formatTZS(amount) {
  return formatPrice(amount);
}

function esc(str) {
  return String(str).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, '&#039;');
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
  sessionStorage.setItem('jenganasi_user', JSON.stringify(user));
  currentUser = user;
}

function loadSession() {
  const stored = sessionStorage.getItem('jenganasi_user');
  if (stored) {
    try {
      currentUser = JSON.parse(stored);
      updateAuthUI();
    } catch { }
  }
}

function clearSession() {
  sessionStorage.removeItem('jenganasi_user');
  currentUser = null;
  updateAuthUI();
}

async function getUserProfile(userId) {
  try {
    const { data, error } = await _supabase.from('users').select('*').eq('id', userId).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (e) {
    console.warn('getUserProfile failed:', e);
    return null;
  }
}

function updateAuthUI() {
  const authBtn = document.getElementById('authBtn');
  const vendorBtn = document.getElementById('vendorBtn');
  const userMenu = document.getElementById('userMenu');
  const userNameEl = document.getElementById('userName');

  if (currentUser) {
    if (authBtn) authBtn.style.display = 'none';
    if (vendorBtn) vendorBtn.style.display = 'none';
    if (userMenu) userMenu.style.display = 'flex';
    if (userNameEl) userNameEl.textContent = currentUser.name.split(' ')[0];
  } else {
    if (authBtn) authBtn.style.display = 'flex';
    if (vendorBtn) vendorBtn.style.display = 'flex';
    if (userMenu) userMenu.style.display = 'none';
  }
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
  document.querySelectorAll('.auth-step').forEach(s => s.style.display = 'none');
  document.getElementById('authStep1').style.display = 'block';
  document.getElementById('authStep2').style.display = 'none';
  document.getElementById('authStep2Vendor').style.display = 'none';
  document.getElementById('authStep3').style.display = 'none';
  document.getElementById('signinForm').style.display = 'none';
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

function closeCart() {
  document.getElementById('cartDropdown').classList.remove('open');
}

function toggleCart() {
  const dropdown = document.getElementById('cartDropdown');
  dropdown.classList.toggle('open');
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
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({...product, quantity});
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
  const item = cart.find(item => item.id === productId);
  if (item) {
    item.quantity = Math.max(1, quantity);
    updateCartUI();
  }
}

function updateCartUI() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  document.getElementById('cartCount').textContent = count;
  document.getElementById('cartTotalAmount').textContent = formatPrice(total);

  const empty = document.getElementById('cartEmpty');
  const items = document.getElementById('cartItems');
  const footer = document.getElementById('cartFooter');

  if (cart.length === 0) {
    empty.style.display = 'block';
    items.style.display = 'none';
    footer.style.display = 'none';
  } else {
    empty.style.display = 'none';
    items.style.display = 'block';
    footer.style.display = 'block';
    items.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img src="${item.image}" alt="${esc(item.name)}">
        <div class="cart-item-info">
          <h4>${esc(item.name)}</h4>
          <p class="cart-item-vendor">${esc(item.vendor)}</p>
          <p class="cart-item-price">${formatPrice(item.price)} × ${item.quantity}</p>
        </div>
        <div class="cart-item-qty">
          <button onclick="updateCartQuantity('${item.id}', ${item.quantity - 1})">-</button>
          <span>${item.quantity}</span>
          <button onclick="updateCartQuantity('${item.id}', ${item.quantity + 1})">+</button>
        </div>
        <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">&times;</button>
      </div>
    `).join('');
  }
}

function openCart() {
  document.getElementById('cartDropdown').classList.add('open');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#cartDropdown')) {
    document.getElementById('cartDropdown').classList.remove('open');
  }
});

// ============ CHECKOUT ============
function openCheckout() {
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

function renderCheckout() {
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const content = document.getElementById('checkoutContent');
  if (!content) return;
  content.innerHTML = `
    <div class="auth-head"><h3>Checkout</h3><p>Review your order</p></div>
    <div style="max-height:300px;overflow-y:auto;margin-bottom:20px">
      ${cart.map(item => `
        <div class="cart-item">
          <img src="${item.image}" alt="${esc(item.name)}">
          <div class="cart-item-info">
            <h4>${esc(item.name)}</h4>
            <p class="cart-item-vendor">${esc(item.vendor)}</p>
            <p class="cart-item-price">${formatPrice(item.price)} × ${item.quantity}</p>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="cart-total" style="margin-bottom:20px"><span>Total</span><span class="cart-total-amount">${formatPrice(total)}</span></div>
    <div class="input-group"><label>Delivery Address</label><textarea placeholder="Enter delivery address" rows="3" required></textarea></div>
    <div class="input-group"><label>Phone for Delivery</label><input type="tel" placeholder="+255 7XX XXX XXX" required autocomplete="tel"></div>
    <button class="btn btn-primary btn-lg btn-block" onclick="placeOrder()">Place Order</button>
  `;
}

async function placeOrder() {
  showToast('Order placement coming soon', 'info');
  closeModal('checkoutModal');
}

// ============ PRODUCTS & VENDORS ============
async function loadProducts() {
  try {
    const {data, error} = await _supabase.from('products').select('*').eq('status', 'active').order('created_at', {ascending: false}).limit(20);
    if (error) {
      console.warn('Products query failed:', error.message);
      loadMockProducts();
      return;
    }
    allProducts = data || [];
    renderProducts();
    renderCategories();
  } catch (e) {
    console.error('Load products error:', e);
    loadMockProducts();
  }
}

function loadMockProducts() {
  allProducts = [
    {id: '1', name: 'Portland Cement 50kg', category: 'cement', price: 18500, unit: 'bag', stock: 500, vendor: 'Simba Cement', vendorRegion: 'Dar es Salaam', rating: 4.8, reviews: 234, image: 'https://images.unsplash.com/photo-1581093458791-9d7e8c8c7b3f?w=400&q=80'},
    {id: '2', name: 'TMT Steel Rebar 12mm', category: 'steel', price: 45000, unit: 'piece', stock: 200, vendor: 'Africa Steel', vendorRegion: 'Dar es Salaam', rating: 4.9, reviews: 189, image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=80'},
    {id: '3', name: 'Ceramic Floor Tiles 60x60', category: 'tiles', price: 28000, unit: 'm²', stock: 1000, vendor: 'Tile Master', vendorRegion: 'Arusha', rating: 4.7, reviews: 156, image: 'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=400&q=80'},
    {id: '4', name: 'Corrugated Iron Sheets 3m', category: 'roofing', price: 35000, unit: 'sheet', stock: 300, vendor: 'RoofTech', vendorRegion: 'Mwanza', rating: 4.6, reviews: 98, image: 'https://images.unsplash.com/photo-1581093458791-9d7e8c8c7b3f?w=400&q=80'},
    {id: '5', name: 'Weather Guard Paint 20L', category: 'paint', price: 85000, unit: 'bucket', stock: 150, vendor: 'ColorWorld', vendorRegion: 'Dar es Salaam', rating: 4.8, reviews: 201, image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400&q=80'},
    {id: '6', name: 'PVC Pipes 4 inch', category: 'plumbing', price: 12000, unit: 'piece', stock: 400, vendor: 'PipeLine', vendorRegion: 'Mbeya', rating: 4.5, reviews: 87, image: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&q=80'}
  ];
  renderProducts();
  renderCategories();
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  let filtered = [...allProducts];
  if (currentSort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
  else if (currentSort === 'price-desc') filtered.sort((a, b) => b.price - a.price);
  else if (currentSort === 'rating') filtered.sort((a, b) => b.rating - a.rating);
  else if (currentSort === 'newest') filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  grid.innerHTML = filtered.map(p => `
    <article class="card product-card" role="listitem" onclick="viewProduct('${p.id}')">
      <div class="product-image"><img src="${p.image}" alt="${esc(p.name)}" loading="lazy" width="400" height="300"></div>
      <div class="product-body">
        <div class="product-category"><span class="badge badge-info">${p.category}</span></div>
        <h3 class="product-name">${esc(p.name)}</h3>
        <div class="product-meta">
          <span class="product-vendor">🏪 ${esc(p.vendor)}</span>
          <span class="product-location">📍 ${esc(p.vendorRegion)}</span>
        </div>
        <div class="product-rating">
          <span class="rating">★ ${p.rating}</span>
          <span class="reviews">(${p.reviews} reviews)</span>
        </div>
        <div class="product-footer">
          <span class="product-price">${formatPrice(p.price)} <span class="unit">/${p.unit}</span></span>
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();addToCart(allProducts.find(p => p.id === '${p.id}'))">Add to Cart</button>
        </div>
      </div>
    </article>
  `).join('');
}

function renderCategories() {
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;
  grid.innerHTML = CATEGORIES.map(c => `
    <article class="card category-card" role="listitem" onclick="filterByCategory('${c.id}')">
      <div class="category-icon">${c.icon}</div>
      <h3>${c.name}</h3>
      <span class="badge badge-info">${c.count} products</span>
    </article>
  `).join('');
}

function renderVendors() {
  const carousel = document.getElementById('vendorsCarousel');
  if (!carousel) return;

  const vendors = [
    {id: '1', name: 'Simba Cement', region: 'Dar es Salaam', rating: 4.9, products: 45, verified: true, avatar: '🏭'},
    {id: '2', name: 'Africa Steel', region: 'Dar es Salaam', rating: 4.8, products: 32, verified: true, avatar: '⚙️'},
    {id: '3', name: 'Tile Master', region: 'Arusha', rating: 4.7, products: 28, verified: true, avatar: '🟦'},
    {id: '4', name: 'RoofTech', region: 'Mwanza', rating: 4.6, products: 19, verified: true, avatar: '🏠'},
    {id: '5', name: 'ColorWorld', region: 'Dar es Salaam', rating: 4.8, products: 23, verified: true, avatar: '🎨'},
    {id: '6', name: 'PipeLine', region: 'Mbeya', rating: 4.5, products: 15, verified: true, avatar: '🔧'}
  ];

  carousel.innerHTML = vendors.map(v => `
    <article class="card vendor-card" role="listitem">
      <div class="vendor-header">
        <div class="vendor-avatar">${v.avatar}</div>
        <div>
          <h4>${v.name}</h4>
          <div class="vendor-meta">
            <span class="vendor-location">📍 ${v.region}</span>
            <span class="badge badge-success">${v.products} products</span>
          </div>
        </div>
      </div>
      <div class="vendor-stats">
        <div class="stat"><span class="stat-value">★ ${v.rating}</span><span class="stat-label">Rating</span></div>
        <div class="stat"><span class="stat-value">${v.products}</span><span class="stat-label">Products</span></div>
        <div class="stat"><span class="stat-value">${v.verified ? '✓' : '○'}</span><span class="stat-label">Verified</span></div>
      </div>
      <button class="btn btn-primary btn-sm btn-block" onclick="viewVendor('${v.id}')">View Products</button>
    </article>
  `).join('');
}

function filterByCategory(categoryId) {
  window.location.href = `#products?category=${categoryId}`;
}

function viewProduct(productId) {
  showToast('Product detail view coming soon', 'info');
}

function viewVendor(vendorId) {
  showToast('Vendor profile coming soon', 'info');
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
    if (error) {
      // Check if it's a "user not found" or "invalid credentials" - expected for new users
      if (error.message.includes('Invalid login credentials') || error.message.includes('User not found')) {
        showToast('Invalid email or password. Or create an account first.', 'danger');
      } else {
        throw error;
      }
      return;
    }
    const session = data.session;
    const user = data.user;
    if (session) sessionStorage.setItem('sb_session', JSON.stringify(session));
    const profile = await getUserProfile(user.id);
    if (profile) {
      currentUser = { name: profile.name, email: user.email, role: profile.role, vendorEmail: profile.role === 'vendor' ? user.email : null };
    } else {
      currentUser = { name: user.user_metadata?.name || user.email.split('@')[0], email: user.email, role: user.app_metadata?.role || 'customer', vendorEmail: user.app_metadata?.role === 'vendor' ? user.email : null };
    }
    closeModal('authModal');
    saveSession(currentUser);
    updateAuthUI();
    form.reset();
    showToast('Welcome back, ' + currentUser.name.split(' ')[0] + '!');
    if (currentUser.role === 'vendor') openVendorDashboard();
    else if (currentUser.role === 'customer') openCustomerDashboard();
    else { const last = getLastSection(); if (last !== 'home') navigateToSection(last); }
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
            nationalId: form.nationalId?.value?.trim(),
            tin: form.tin?.value?.trim(),
            paymentAccount: form.paymentAccount?.value?.trim()
          }
        }
      });
      if (authError) throw new Error(authError.message);
      if (authData.session) sessionStorage.setItem('sb_session', JSON.stringify(authData.session));
      const userId = authData.user.id;
      const customerData = { id: userId, email, name, role: 'customer', phone, nationalId: form.nationalId?.value?.trim(), tin: form.tin?.value?.trim(), paymentAccount: form.paymentAccount?.value?.trim() };
      const { error: profileError } = await _supabase.from('customers').insert(customerData);
      if (profileError) console.warn('Profile creation failed:', profileError.message);
      currentUser = { name, email, role: 'customer' };
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
  const name = form.name.value.trim();
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
            brela: form.brela?.value?.trim() || null,
            licence: form.licence?.value?.trim() || null,
            nationalId: form.vendorNationalId?.value?.trim() || null,
            tin: form.vendorTin?.value?.trim() || null,
            bankAccount: form.vendorBank?.value?.trim() || null,
            photo: vendorUploadedImage || null,
            region: form.vendorRegion?.value?.trim() || null,
            lat: form.vendorLat?.value ? parseFloat(form.vendorLat.value) || null : null,
            lng: form.vendorLng?.value ? parseFloat(form.vendorLng.value) || null : null
          }
        }
      });
      if (authError) throw new Error(authError.message);
      if (authData.session) sessionStorage.setItem('sb_session', JSON.stringify(authData.session));
      const userId = authData.user.id;
      const vendorData = { id: userId, email, name, role: 'vendor', storeName, phone, brela: form.brela?.value?.trim() || null, licence: form.licence?.value?.trim() || null, nationalId: form.vendorNationalId?.value?.trim() || null, tin: form.vendorTin?.value?.trim() || null, bankAccount: form.vendorBank?.value?.trim() || null, photo: vendorUploadedImage || null, region: form.vendorRegion?.value?.trim() || null, lat: form.vendorLat?.value ? parseFloat(form.vendorLat.value) || null : null, lng: form.vendorLng?.value ? parseFloat(form.vendorLng.value) || null : null };
      const { error: profileError } = await _supabase.from('vendors').insert(vendorData);
      if (profileError) { await _supabase.auth.admin.deleteUser(authData.user.id); throw new Error(profileError.message); }
      currentUser = { name: storeName, email, role: 'vendor', vendorEmail: email };
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
  if (password.length < 6) { showToast('Password must be at least 6 characters', 'danger'); return; }
  showLoading('Updating password...');
  try {
    const { error } = await _supabase.auth.updateUser({ password: password });
    if (error) throw error;
    const email = form.dataset.email;
    if (email) {
      const hashed = await hashPasswordV2(password);
      if (customerAccounts?.some(c => c.email === email)) {
        await sbUpdate('customers', { email }, { password: hashed });
      } else if (vendorAccounts?.some(v => v.email === email)) {
        await sbUpdate('vendors', { email }, { password: hashed });
      }
    }
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

// ============ DASHBOARDS ============
function openVendorDashboard() {
  showToast('Vendor dashboard coming soon', 'info');
}

function openCustomerDashboard() {
  showToast('Customer dashboard coming soon', 'info');
}

// ============ SEARCH & SORT ============
document.getElementById('heroSearchBtn')?.addEventListener('click', () => {
  const query = document.getElementById('heroSearch').value.trim();
  if (query) {
    window.location.href = `#products?search=${encodeURIComponent(query)}`;
  }
});

document.getElementById('heroSearch')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') document.getElementById('heroSearchBtn').click();
});

document.getElementById('sortSelect')?.addEventListener('change', (e) => {
  currentSort = e.target.value;
  renderProducts();
});

// ============ MOBILE MENU ============
document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
  const navLinks = document.getElementById('navLinks');
  const btn = document.getElementById('mobileMenuBtn');
  navLinks.classList.toggle('open');
  btn.setAttribute('aria-expanded', navLinks.classList.contains('open'));
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
    const targetId = this.getAttribute('href');
    if (targetId === '#') return;
    e.preventDefault();
    const target = document.querySelector(targetId);
    if (target) {
      target.scrollIntoView({behavior: 'smooth', block: 'start'});
      history.pushState(null, '', targetId);
    }
  });
});

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  loadSession();
  loadProducts();
  renderVendors();
  populateRegionSelects();

  document.getElementById('heroSearch')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('heroSearchBtn')?.click();
  });

  document.getElementById('locationBtn')?.addEventListener('click', () => openModal('locationModal'));
  document.getElementById('mobileLocationBar')?.addEventListener('click', () => openModal('locationModal'));

  document.getElementById('cartBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCart();
  });

  document.getElementById('authBtn')?.addEventListener('click', () => openAuthModal());
  document.getElementById('vendorBtn')?.addEventListener('click', () => openVendorRegistration());

  document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
      const category = card.querySelector('h3').textContent.toLowerCase().replace(/\s+/g, '-');
      filterByCategory(category);
    });
  });
});