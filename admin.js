/* ============================================================
   JengaNasi Admin Console page logic
   ============================================================ */

(function () {
  'use strict';

  const JN = window.JN;
  const state = {
    customers: [],
    vendors: [],
    products: [],
    orders: [],
    bound: false,
    loaded: false
  };

  JN.boot({ role: 'admin', onReady: init });

  async function init() {
    fillCategoryFilter();
    bindEvents();
    await loadData();
  }

  function $(selector) {
    return document.querySelector(selector);
  }

  function lower(value) {
    return String(value || '').trim().toLowerCase();
  }

  function fillCategoryFilter() {
    const select = document.getElementById('productCategoryFilter');
    if (!select || select.options.length > 1) return;
    select.insertAdjacentHTML('beforeend', JN.categories
      .map(category => `<option value="${JN.esc(category.id)}">${JN.esc(category.name)}</option>`)
      .join(''));
  }

  function bindEvents() {
    if (state.bound) return;
    state.bound = true;

    document.addEventListener('click', event => {
      const element = event.target.closest('[data-action]');
      if (!element) return;
      const action = element.dataset.action;

      if (action === 'refresh-admin') {
        loadData();
      } else if (action === 'verify-vendor') {
        setVendorVerified(element.dataset.id, element.dataset.verified !== 'true');
      } else if (action === 'view-order') {
        showOrderDetail(element.dataset.id);
      } else if (action === 'filter-vendor-products') {
        const search = document.getElementById('productSearch');
        if (search) search.value = element.dataset.email || '';
        renderProducts();
        if (location.hash !== '#products') location.hash = 'products';
      }
    });

    const vendorSearch = document.getElementById('vendorSearch');
    const vendorStatus = document.getElementById('vendorStatusFilter');
    const customerSearch = document.getElementById('customerSearch');
    const productSearch = document.getElementById('productSearch');
    const productCategory = document.getElementById('productCategoryFilter');
    const productStatus = document.getElementById('productStatusFilter');
    const orderSearch = document.getElementById('orderSearch');
    const orderStatus = document.getElementById('orderStatusFilter');

    if (vendorSearch) vendorSearch.addEventListener('input', JN.debounce(renderVendors));
    if (vendorStatus) vendorStatus.addEventListener('change', renderVendors);
    if (customerSearch) customerSearch.addEventListener('input', JN.debounce(renderCustomers));
    if (productSearch) productSearch.addEventListener('input', JN.debounce(renderProducts));
    if (productCategory) productCategory.addEventListener('change', renderProducts);
    if (productStatus) productStatus.addEventListener('change', renderProducts);
    if (orderSearch) orderSearch.addEventListener('input', JN.debounce(renderOrders));
    if (orderStatus) orderStatus.addEventListener('change', renderOrders);
  }

  async function loadData(options) {
    const silent = Boolean(options && options.silent);
    if (!silent) JN.showLoading('Loading marketplace data…');

    try {
      const results = await JN.withTimeout(Promise.all([
        JN.client.from('customers')
          .select('id,name,email,phone,verified,suspended,joined_at')
          .order('joined_at', { ascending: false })
          .limit(300),
        JN.client.from('vendors')
          .select('id,name,store_name,email,phone,region,photo,vendor_type,verified,suspended,joined_at,commission_rate')
          .order('joined_at', { ascending: false })
          .limit(300),
        JN.client.from('products')
          .select('id,name,category,price,unit,stock,max_stock,status,deleted,image,vendor,vendor_email,rating,reviews,created_at')
          .order('created_at', { ascending: false })
          .limit(500),
        JN.client.from('orders')
          .select('id,group_id,vendor_count,customer,items,total,status,delivery,payment,date,vendor_email,customer_id,customer_email')
          .order('date', { ascending: false })
          .limit(300)
      ]), 30000, 'Loading the admin console took too long. Please try again.');

      const failures = results.filter(result => result.error);
      if (failures.length === results.length) {
        throw new Error(failures[0].error.message || 'The marketplace data could not be loaded.');
      }
      if (failures.length) {
        JN.toast('Some marketplace data could not be loaded. Showing what is available.', 'warning');
      }

      state.customers = results[0].error ? [] : (results[0].data || []);
      state.vendors = results[1].error ? [] : (results[1].data || []);
      state.products = results[2].error ? [] : (results[2].data || []);
      state.orders = results[3].error ? [] : (results[3].data || []);
      state.loaded = true;

      renderAll();
    } catch (error) {
      console.error('Admin dashboard load failed:', error);
      renderLoadError(error.message || 'The marketplace data could not be loaded.');
      JN.toast('Could not load the admin console. Please try again.', 'danger');
    } finally {
      if (!silent) JN.hideLoading();
    }
  }

  function activeProducts() {
    return state.products.filter(product => product.status === 'active' && !product.deleted);
  }

  function openOrders() {
    return state.orders.filter(order => ['pending', 'confirmed', 'processing'].includes(lower(order.status)));
  }

  function vendorNameFor(email) {
    const vendor = state.vendors.find(item => lower(item.email) === lower(email));
    if (vendor) return vendor.store_name || vendor.name || vendor.email;
    return prettifyEmail(email);
  }

  function prettifyEmail(email) {
    const raw = String(email || '').split('@')[0];
    if (!raw) return 'Verified vendor';
    return raw.replace(/[._-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
  }

  function renderAll() {
    renderStats();
    renderVerificationQueue();
    renderStatusBreakdown();
    renderRecentOrders();
    renderTopVendors();
    renderCategoryMix();
    renderVendors();
    renderCustomers();
    renderProducts();
    renderOrders();
    updateNavCounts();
  }

  function updateNavCounts() {
    const pending = state.vendors.filter(vendor => !vendor.verified && !vendor.suspended).length;
    const open = openOrders().length;

    document.querySelectorAll('[data-count="pending-vendors"]').forEach(element => {
      element.textContent = String(pending);
      element.hidden = pending === 0;
    });
    document.querySelectorAll('[data-count="open-orders"]').forEach(element => {
      element.textContent = String(open);
      element.hidden = open === 0;
    });

    const heroCount = document.getElementById('heroPendingCount');
    const heroLabel = document.getElementById('heroPendingLabel');
    if (heroCount) heroCount.textContent = String(pending);
    if (heroLabel) {
      heroLabel.textContent = pending === 0
        ? 'all vendor stores reviewed'
        : `${JN.plural(pending, 'vendor needs', 'vendors need')} review`;
    }
  }

  function renderStats() {
    const target = document.getElementById('adminStats');
    if (!target) return;

    const verifiedVendors = state.vendors.filter(vendor => vendor.verified && !vendor.suspended);
    const pendingVendors = state.vendors.filter(vendor => !vendor.verified && !vendor.suspended);
    const suspendedVendors = state.vendors.filter(vendor => vendor.suspended);
    const active = activeProducts();
    const draft = state.products.filter(product => product.status === 'draft' && !product.deleted);
    const categories = new Set(active.map(product => product.category).filter(Boolean));
    const pendingOrderRows = openOrders();
    const customerSuspended = state.customers.filter(customer => customer.suspended).length;
    const nonCancelled = state.orders.filter(order => lower(order.status) !== 'cancelled');
    const gmv = nonCancelled.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const average = nonCancelled.length ? gmv / nonCancelled.length : 0;

    target.innerHTML = [
      JN.statCard({
        icon: 'users',
        label: 'Customers',
        value: state.customers.length,
        note: customerSuspended
          ? `${state.customers.length - customerSuspended} active · ${customerSuspended} suspended`
          : 'Registered buyer accounts',
        tone: 'primary'
      }),
      JN.statCard({
        icon: 'vendors',
        label: 'Vendors',
        value: state.vendors.length,
        note: `${verifiedVendors.length} verified · ${pendingVendors.length} pending${suspendedVendors.length ? ` · ${suspendedVendors.length} suspended` : ''}`,
        tone: 'success'
      }),
      JN.statCard({
        icon: 'products',
        label: 'Active products',
        value: active.length,
        note: `${draft.length} drafts · ${categories.size} categories live`,
        tone: 'info'
      }),
      JN.statCard({
        icon: 'orders',
        label: 'Orders',
        value: state.orders.length,
        note: `${pendingOrderRows.length} open · ${state.orders.length - pendingOrderRows.length} closed`,
        tone: 'warning'
      }),
      JN.statCard({
        icon: 'revenue',
        label: 'Order value',
        value: JN.compactMoney(gmv),
        note: `Average ${JN.formatPrice(average)} per vendor order`,
        tone: 'success'
      })
    ].join('');
  }

  function renderVerificationQueue() {
    const target = document.getElementById('verificationQueue');
    if (!target) return;

    const pending = state.vendors
      .filter(vendor => !vendor.verified && !vendor.suspended)
      .sort((a, b) => new Date(a.joined_at || 0) - new Date(b.joined_at || 0))
      .slice(0, 6);

    if (!pending.length) {
      target.innerHTML = JN.emptyState('check', 'All caught up', 'Every vendor store in the queue has been reviewed.');
      return;
    }

    target.innerHTML = `<div class="queue-list">${pending.map(vendor => {
      const name = vendor.store_name || vendor.name || 'Vendor store';
      return `<div class="queue-item">
        <span class="queue-avatar" aria-hidden="true">${JN.esc(JN.initials(name))}</span>
        <div class="queue-copy">
          <strong>${JN.esc(name)}</strong>
          <span>${JN.esc(vendor.region || 'Region not set')} · joined ${JN.esc(JN.formatDate(vendor.joined_at))}</span>
          <span>${JN.esc(vendor.email || '')}</span>
        </div>
        <div class="queue-actions">
          <button type="button" class="btn btn-primary btn-sm" data-action="verify-vendor" data-id="${JN.esc(vendor.id)}" data-verified="false">Verify</button>
        </div>
      </div>`;
    }).join('')}</div>`;
  }

  function renderStatusBreakdown() {
    const target = document.getElementById('statusBreakdown');
    if (!target) return;

    if (!state.orders.length) {
      target.innerHTML = JN.emptyState('orders', 'No orders yet', 'Order status will appear here after the first checkout.');
      return;
    }

    const statuses = ['pending', 'confirmed', 'processing', 'delivered', 'cancelled'];
    const labels = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      processing: 'Processing',
      delivered: 'Delivered',
      cancelled: 'Cancelled'
    };
    const total = state.orders.length;
    target.innerHTML = `<div class="meter-list">${statuses.map(status => {
      const count = state.orders.filter(order => lower(order.status) === status).length;
      const percent = total ? Math.round((count / total) * 100) : 0;
      const tone = JN.statusTone(status);
      return `<div class="meter-row">
        <div class="meter-top"><span>${labels[status]}</span><strong>${count}</strong></div>
        <div class="meter-track"><span class="meter-fill is-${tone}" style="width:${count ? Math.max(percent, 3) : 0}%"></span></div>
      </div>`;
    }).join('')}</div>
    <p class="field-hint mt-sm">${total} order ${total === 1 ? 'row' : 'rows'} in the last 300 records.</p>`;
  }

  function ordersTableHtml(orders, options) {
    const settings = options || {};
    if (!orders.length) {
      return JN.emptyState('orders', settings.emptyTitle || 'No orders found', settings.emptyText || 'Orders will appear here as customers check out.');
    }

    return `<table class="data-table">
      <caption class="sr-only">Marketplace orders</caption>
      <thead><tr>
        <th scope="col">Order</th>
        <th scope="col">Customer</th>
        <th scope="col">Vendor</th>
        <th scope="col">Total</th>
        <th scope="col">Status</th>
        <th scope="col">Date</th>
        <th scope="col" class="is-right">Action</th>
      </tr></thead>
      <tbody>${orders.map(order => `<tr>
        <td><span class="mono">#${JN.esc(order.group_id || String(order.id || '').slice(0, 8))}</span></td>
        <td>
          <strong>${JN.esc(JN.orderCustomerName(order.customer) || 'Customer')}</strong>
          <span class="table-sub">${JN.esc(order.customer_email || '')}</span>
        </td>
        <td>${JN.esc(vendorNameFor(order.vendor_email))}</td>
        <td class="table-money">${JN.formatPrice(order.total)}</td>
        <td>${JN.statusPill(order.status)}</td>
        <td>${JN.esc(JN.formatDate(order.date))}</td>
        <td class="is-right"><button type="button" class="btn btn-outline btn-sm" data-action="view-order" data-id="${JN.esc(order.id)}">View</button></td>
      </tr>`).join('')}</tbody>
    </table>`;
  }

  function renderRecentOrders() {
    const target = document.getElementById('recentOrders');
    if (!target) return;
    target.innerHTML = ordersTableHtml(state.orders.slice(0, 6), {
      emptyTitle: 'No orders yet',
      emptyText: 'The latest customer orders will appear here.'
    });
  }

  function renderTopVendors() {
    const target = document.getElementById('topVendors');
    if (!target) return;

    const totals = new Map();
    state.orders.forEach(order => {
      if (lower(order.status) === 'cancelled') return;
      const key = lower(order.vendor_email);
      if (!key) return;
      const current = totals.get(key) || { email: order.vendor_email, total: 0, orders: 0 };
      current.total += Number(order.total) || 0;
      current.orders += 1;
      totals.set(key, current);
    });

    const ranked = Array.from(totals.values()).sort((a, b) => b.total - a.total).slice(0, 5);
    if (!ranked.length) {
      target.innerHTML = JN.emptyState('vendors', 'No sales yet', 'Vendor rankings appear after the first order.');
      return;
    }

    target.innerHTML = `<div class="rank-list">${ranked.map((vendor, index) => `<div class="rank-item">
      <span class="rank-number">${index + 1}</span>
      <div class="rank-copy">
        <strong>${JN.esc(vendorNameFor(vendor.email))}</strong>
        <span>${vendor.orders} ${vendor.orders === 1 ? 'order' : 'orders'}</span>
      </div>
      <span class="rank-value">${JN.compactMoney(vendor.total)}</span>
    </div>`).join('')}</div>`;
  }

  function renderCategoryMix() {
    const target = document.getElementById('categoryMix');
    if (!target) return;

    const active = activeProducts();
    if (!active.length) {
      target.innerHTML = JN.emptyState('products', 'No live products', 'Active listings will be grouped by category here.');
      return;
    }

    const counts = new Map();
    active.forEach(product => {
      const key = product.category || 'other';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const total = active.length;

    target.innerHTML = `<div class="meter-list">${ranked.map(([category, count]) => {
      const percent = Math.round((count / total) * 100);
      return `<div class="meter-row">
        <div class="meter-top"><span>${JN.esc(JN.categoryLabel(category))}</span><strong>${count}</strong></div>
        <div class="meter-track"><span class="meter-fill" style="width:${Math.max(percent, 3)}%"></span></div>
      </div>`;
    }).join('')}</div>`;
  }

  function filteredVendors() {
    const term = lower(document.getElementById('vendorSearch') && document.getElementById('vendorSearch').value);
    const status = (document.getElementById('vendorStatusFilter') && document.getElementById('vendorStatusFilter').value) || 'all';

    return state.vendors
      .filter(vendor => {
        const haystack = [vendor.store_name, vendor.name, vendor.email, vendor.region, vendor.phone]
          .map(lower)
          .join(' ');
        if (term && !haystack.includes(term)) return false;
        if (status === 'pending') return !vendor.verified && !vendor.suspended;
        if (status === 'verified') return Boolean(vendor.verified) && !vendor.suspended;
        if (status === 'suspended') return Boolean(vendor.suspended);
        return true;
      })
      .sort((a, b) => {
        const aOpen = !a.verified && !a.suspended ? 0 : 1;
        const bOpen = !b.verified && !b.suspended ? 0 : 1;
        return aOpen - bOpen || new Date(b.joined_at || 0) - new Date(a.joined_at || 0);
      });
  }

  function productCountFor(email) {
    return state.products.filter(product => lower(product.vendor_email) === lower(email) && !product.deleted).length;
  }

  function renderVendors() {
    const target = document.getElementById('vendorsTable');
    if (!target) return;

    const vendors = filteredVendors();
    const count = document.getElementById('vendorCount');
    if (count) count.textContent = `${vendors.length} of ${state.vendors.length} vendors`;

    if (!vendors.length) {
      target.innerHTML = JN.emptyState('vendors', 'No vendors match', 'Try a different search term or status filter.');
      return;
    }

    target.innerHTML = `<table class="data-table">
      <caption class="sr-only">Vendor directory</caption>
      <thead><tr>
        <th scope="col">Store</th>
        <th scope="col">Contact</th>
        <th scope="col">Region</th>
        <th scope="col">Products</th>
        <th scope="col">Status</th>
        <th scope="col">Joined</th>
        <th scope="col" class="is-right">Actions</th>
      </tr></thead>
      <tbody>${vendors.map(vendor => {
        const name = vendor.store_name || vendor.name || 'Vendor store';
        const photo = JN.safeUrl(vendor.photo);
        const status = vendor.suspended
          ? JN.statusPill('suspended', 'Suspended')
          : vendor.verified
            ? JN.statusPill('verified', 'Verified')
            : JN.statusPill('pending', 'Pending');
        const mainAction = vendor.suspended
          ? '<span class="field-hint">Review required</span>'
          : `<button type="button" class="btn ${vendor.verified ? 'btn-outline' : 'btn-primary'} btn-sm" data-action="verify-vendor" data-id="${JN.esc(vendor.id)}" data-verified="${vendor.verified ? 'true' : 'false'}">${vendor.verified ? 'Unverify' : 'Verify'}</button>`;

        return `<tr>
          <td>
            <div class="table-primary">
              ${photo
                ? `<img src="${JN.esc(photo)}" alt="" loading="lazy" width="42" height="42">`
                : `<span class="avatar avatar-sm" aria-hidden="true">${JN.esc(JN.initials(name))}</span>`}
              <div class="table-copy">
                <strong>${JN.esc(name)}</strong>
                <span>${JN.esc(JN.vendorTypeLabel(vendor.vendor_type))}</span>
              </div>
            </div>
          </td>
          <td>
            <strong>${JN.esc(vendor.email || '—')}</strong>
            <span class="table-sub">${JN.esc(vendor.phone || 'No phone')}</span>
          </td>
          <td>${JN.esc(vendor.region || '—')}</td>
          <td>${productCountFor(vendor.email)}</td>
          <td>${status}</td>
          <td>${JN.esc(JN.formatDate(vendor.joined_at))}</td>
          <td>
            <div class="table-actions">
              <button type="button" class="btn btn-ghost btn-sm" data-action="filter-vendor-products" data-email="${JN.esc(vendor.email || '')}">Products</button>
              ${mainAction}
            </div>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  }

  function customerOrderCount(customer) {
    return state.orders.filter(order =>
      (order.customer_id && customer.id && order.customer_id === customer.id) ||
      (order.customer_email && customer.email && lower(order.customer_email) === lower(customer.email))
    ).length;
  }

  function renderCustomers() {
    const target = document.getElementById('customersTable');
    if (!target) return;

    const term = lower(document.getElementById('customerSearch') && document.getElementById('customerSearch').value);
    const customers = state.customers.filter(customer => {
      if (!term) return true;
      return [customer.name, customer.email, customer.phone]
        .map(lower)
        .join(' ')
        .includes(term);
    });

    const count = document.getElementById('customerCount');
    if (count) count.textContent = `${customers.length} of ${state.customers.length} customers`;

    if (!customers.length) {
      target.innerHTML = JN.emptyState('users', 'No customers found', state.customers.length ? 'Try a different search term.' : 'Customer accounts will appear here after registration.');
      return;
    }

    target.innerHTML = `<table class="data-table">
      <caption class="sr-only">Customer directory</caption>
      <thead><tr>
        <th scope="col">Customer</th>
        <th scope="col">Email</th>
        <th scope="col">Phone</th>
        <th scope="col">Orders</th>
        <th scope="col">Joined</th>
        <th scope="col">Standing</th>
      </tr></thead>
      <tbody>${customers.map(customer => `<tr>
        <td>
          <div class="table-primary">
            <span class="avatar avatar-sm" aria-hidden="true">${JN.esc(JN.initials(customer.name || customer.email || 'Customer'))}</span>
            <div class="table-copy"><strong>${JN.esc(customer.name || 'Customer')}</strong><span>Buyer account</span></div>
          </div>
        </td>
        <td>${JN.esc(customer.email || '—')}</td>
        <td>${JN.esc(customer.phone || '—')}</td>
        <td>${customerOrderCount(customer)}</td>
        <td>${JN.esc(JN.formatDate(customer.joined_at))}</td>
        <td>${customer.suspended ? JN.statusPill('suspended', 'Suspended') : JN.statusPill('active', 'Active')}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  }

  function filteredProducts() {
    const term = lower(document.getElementById('productSearch') && document.getElementById('productSearch').value);
    const category = (document.getElementById('productCategoryFilter') && document.getElementById('productCategoryFilter').value) || 'all';
    const status = (document.getElementById('productStatusFilter') && document.getElementById('productStatusFilter').value) || 'all';

    return state.products.filter(product => {
      if (term) {
        const haystack = [product.name, product.vendor, product.vendor_email, product.category, JN.categoryLabel(product.category)]
          .map(lower)
          .join(' ');
        if (!haystack.includes(term)) return false;
      }
      if (category !== 'all' && lower(product.category) !== category) return false;
      if (status === 'archived') return Boolean(product.deleted);
      if (status === 'active') return !product.deleted && lower(product.status) === 'active';
      if (status === 'draft') return !product.deleted && lower(product.status) === 'draft';
      if (status === 'inactive') return !product.deleted && lower(product.status) === 'inactive';
      return true;
    });
  }

  function renderProducts() {
    const target = document.getElementById('productsTable');
    if (!target) return;

    const products = filteredProducts();
    const count = document.getElementById('productCount');
    if (count) count.textContent = `${products.length} of ${state.products.length} products`;

    if (!products.length) {
      target.innerHTML = JN.emptyState('products', 'No products found', state.products.length ? 'Try a different search or filter.' : 'Products will appear here as vendors add them.');
      return;
    }

    target.innerHTML = `<table class="data-table">
      <caption class="sr-only">Marketplace product catalogue</caption>
      <thead><tr>
        <th scope="col">Product</th>
        <th scope="col">Vendor</th>
        <th scope="col">Price</th>
        <th scope="col">Stock</th>
        <th scope="col">Status</th>
        <th scope="col">Listed</th>
      </tr></thead>
      <tbody>${products.map(product => {
        const image = JN.safeUrl(product.image) || 'assets/product-placeholder.svg';
        const status = product.deleted ? JN.statusPill('archived', 'Archived') : JN.statusPill(product.status || 'active');
        const stock = Number(product.stock) || 0;
        return `<tr>
          <td>
            <div class="table-primary">
              <img src="${JN.esc(image)}" alt="" loading="lazy" width="42" height="42" onerror="this.onerror=null;this.src='assets/product-placeholder.svg'">
              <div class="table-copy">
                <strong>${JN.esc(product.name || 'Untitled product')}</strong>
                <span>${JN.esc(JN.categoryLabel(product.category))} · per ${JN.esc(product.unit || 'unit')}</span>
              </div>
            </div>
          </td>
          <td>${JN.esc(product.vendor || vendorNameFor(product.vendor_email))}</td>
          <td class="table-money">${JN.formatPrice(product.price)}</td>
          <td>${stock <= 0 ? '<span class="low-stock">Out of stock</span>' : stock <= 10 ? `<span class="low-stock">${stock} left</span>` : stock}</td>
          <td>${status}</td>
          <td>${JN.esc(JN.formatDate(product.created_at))}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  }

  function filteredOrders() {
    const term = lower(document.getElementById('orderSearch') && document.getElementById('orderSearch').value);
    const status = (document.getElementById('orderStatusFilter') && document.getElementById('orderStatusFilter').value) || 'all';

    return state.orders.filter(order => {
      if (status !== 'all' && lower(order.status) !== status) return false;
      if (!term) return true;
      return [
        order.group_id,
        order.id,
        order.customer_email,
        JN.orderCustomerName(order.customer),
        order.vendor_email,
        vendorNameFor(order.vendor_email)
      ].map(lower).join(' ').includes(term);
    });
  }

  function renderOrders() {
    const target = document.getElementById('ordersTable');
    if (!target) return;

    const orders = filteredOrders();
    const count = document.getElementById('orderCount');
    if (count) count.textContent = `${orders.length} of ${state.orders.length} orders`;

    target.innerHTML = ordersTableHtml(orders, {
      emptyTitle: 'No orders found',
      emptyText: state.orders.length ? 'Try a different search or status filter.' : 'Orders will appear here after checkout.'
    });
  }

  function showOrderDetail(orderId) {
    const order = state.orders.find(item => String(item.id) === String(orderId));
    if (!order) {
      JN.toast('This order is no longer available.', 'warning');
      return;
    }

    const customer = order.customer && typeof order.customer === 'object' ? order.customer : {};
    const delivery = order.delivery && typeof order.delivery === 'object' ? order.delivery : {};
    const payment = order.payment && typeof order.payment === 'object' ? order.payment : {};
    const items = JN.asArray(order.items);
    const title = document.getElementById('orderDetailTitle');
    const body = document.getElementById('orderDetailBody');
    if (!body) return;

    if (title) title.textContent = `#${order.group_id || String(order.id).slice(0, 8)}`;

    body.innerHTML = `
      <div class="detail-head">
        <div>
          <h3>${JN.esc(JN.orderCustomerName(order.customer) || 'Customer order')}</h3>
          <p>Placed ${JN.esc(JN.formatDateTime(order.date))} · ${items.length} ${items.length === 1 ? 'line item' : 'line items'}</p>
        </div>
        ${JN.statusPill(order.status)}
      </div>
      <div class="detail-grid">
        <div class="detail-block">
          <h4>Customer</h4>
          <strong>${JN.esc(JN.orderCustomerName(order.customer) || 'Customer')}</strong>
          <span>${JN.esc(customer.email || order.customer_email || '—')}</span>
          <span>${JN.esc(customer.phone || delivery.phone || '—')}</span>
        </div>
        <div class="detail-block">
          <h4>Delivery</h4>
          <strong>${JN.esc(delivery.address || 'Address not provided')}</strong>
          <span>${JN.esc(delivery.region || 'Region not set')}</span>
          <span>${JN.esc(delivery.phone || '—')}</span>
        </div>
        <div class="detail-block">
          <h4>Payment</h4>
          <strong>${JN.esc(JN.paymentLabel(payment.method))}</strong>
          <span>Status: ${JN.esc(payment.status || 'pending')}</span>
          <span>Vendor: ${JN.esc(vendorNameFor(order.vendor_email))}</span>
        </div>
      </div>
      <h4 class="detail-section-title">Items</h4>
      <div class="detail-items">
        ${items.length ? items.map(item => {
          const quantity = Number(item.quantity) || 0;
          const lineTotal = Number(item.line_total) || (Number(item.price) || 0) * quantity;
          return `<div class="detail-item">
            <span>${JN.esc(item.name || 'Product')} · ${quantity} × ${JN.formatPrice(item.price)} / ${JN.esc(item.unit || 'unit')}</span>
            <span>${JN.formatPrice(lineTotal)}</span>
          </div>`;
        }).join('') : '<div class="detail-item"><span>No line items recorded.</span></div>'}
      </div>
      <div class="detail-total"><span>Order total</span><strong>${JN.formatPrice(order.total)}</strong></div>
    `;

    JN.openModal('orderDetailModal');
  }

  async function setVendorVerified(vendorId, verified) {
    if (!vendorId) return;
    if (!verified && !window.confirm('Remove verification from this vendor? Their store will leave the public vendor directory.')) {
      return;
    }

    JN.showLoading(verified ? 'Verifying vendor…' : 'Updating vendor…');
    try {
      const { data, error } = await JN.client.from('vendors')
        .update({ verified })
        .eq('id', vendorId)
        .select('id,verified')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Vendor not found or you do not have permission to update it.');
      JN.toast(verified ? 'Vendor verified.' : 'Vendor verification removed.', 'success');
      await loadData({ silent: true });
    } catch (error) {
      console.error('Vendor verification update failed:', error);
      JN.toast('Could not update the vendor: ' + (error.message || 'Unknown error'), 'danger');
    } finally {
      JN.hideLoading();
    }
  }

  function renderLoadError(message) {
    const stats = document.getElementById('adminStats');
    if (stats) {
      stats.innerHTML = JN.emptyState('alert', 'Console data unavailable', message || 'Refresh the page to try again.');
    }
    ['verificationQueue', 'statusBreakdown', 'recentOrders', 'topVendors', 'categoryMix', 'vendorsTable', 'customersTable', 'productsTable', 'ordersTable']
      .forEach(id => {
        const element = document.getElementById(id);
        if (element) element.innerHTML = JN.emptyState('alert', 'Could not load this section', 'Use refresh to try again.');
      });
  }
})();
