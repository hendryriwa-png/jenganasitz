/* ============================================================
   JengaNasi Vendor Dashboard page logic
   ============================================================ */

(function () {
  'use strict';

  const JN = window.JN;
  const state = {
    profile: null,
    products: [],
    orders: [],
    bound: false
  };

  JN.boot({ role: 'vendor', onReady: init });

  async function init(profile) {
    state.profile = profile;
    fillRegions();
    fillCategories();
    bindEvents();
    applyProfile(profile);
    await loadData();
  }

  function lower(value) {
    return String(value || '').trim().toLowerCase();
  }

  function fillRegions() {
    const select = document.getElementById('storeRegion');
    if (!select || select.options.length > 1) return;
    select.insertAdjacentHTML('beforeend', JN.regions
      .map(region => `<option value="${JN.esc(region)}">${JN.esc(region)}</option>`)
      .join(''));
  }

  function fillCategories() {
    const select = document.getElementById('productCategory');
    if (!select || select.options.length > 1) return;
    select.insertAdjacentHTML('beforeend', JN.categories
      .map(category => `<option value="${JN.esc(category.id)}">${JN.esc(category.name)}</option>`)
      .join(''));
  }

  function applyProfile(profile) {
    const vendorName = profile.storeName || profile.name || 'Vendor store';

    const note = document.getElementById('vendorVerificationNote');
    if (note) note.hidden = Boolean(profile.verified);
    const publishNote = document.getElementById('productPublishNote');
    if (publishNote) publishNote.hidden = Boolean(profile.verified);

    const storeName = document.getElementById('storeName');
    const storePhone = document.getElementById('storePhone');
    const storeRegion = document.getElementById('storeRegion');
    const storePhoto = document.getElementById('storePhoto');
    if (storeName) storeName.value = vendorName;
    if (storePhone) storePhone.value = profile.phone || '';
    if (storeRegion) storeRegion.value = profile.region || '';
    if (storePhoto) storePhoto.value = profile.photo || '';
    if (storeRegion) {
      const fallback = document.querySelector('[data-user-region]');
      if (fallback) fallback.textContent = profile.region || 'Not set';
    }
    const vendorType = document.getElementById('storeVendorType');
    if (vendorType) vendorType.textContent = JN.vendorTypeLabel(profile.vendorType);
  }

  function bindEvents() {
    if (state.bound) return;
    state.bound = true;

    document.addEventListener('click', event => {
      const element = event.target.closest('[data-action]');
      if (!element) return;
      const action = element.dataset.action;

      if (action === 'refresh-vendor') {
        loadData({ silent: false });
      } else if (action === 'open-product') {
        openProductForm();
      } else if (action === 'edit-product') {
        openProductForm(element.dataset.id);
      } else if (action === 'delete-product') {
        deleteProduct(element.dataset.id);
      } else if (action === 'view-vendor-order') {
        showOrderDetail(element.dataset.id);
      } else if (action === 'set-order-status') {
        updateOrderStatus(element.dataset.id, element.dataset.status);
      }
    });

    const productSearch = document.getElementById('vendorProductSearch');
    const productStatus = document.getElementById('vendorProductStatusFilter');
    const orderSearch = document.getElementById('vendorOrderSearch');
    const orderStatus = document.getElementById('vendorOrderStatusFilter');
    const profileForm = document.getElementById('vendorProfileForm');
    const productForm = document.getElementById('productForm');
    const resetProfile = document.getElementById('resetVendorProfileBtn');

    if (productSearch) productSearch.addEventListener('input', JN.debounce(renderProducts));
    if (productStatus) productStatus.addEventListener('change', renderProducts);
    if (orderSearch) orderSearch.addEventListener('input', JN.debounce(renderOrders));
    if (orderStatus) orderStatus.addEventListener('change', renderOrders);
    if (profileForm) profileForm.addEventListener('submit', saveProfile);
    if (productForm) productForm.addEventListener('submit', saveProduct);
    if (resetProfile) resetProfile.addEventListener('click', () => applyProfile(state.profile || {}));
  }

  async function loadData(options) {
    const silent = Boolean(options && options.silent);
    if (!state.profile) return;
    const email = state.profile.vendorEmail || state.profile.email;
    if (!silent) JN.showLoading('Loading your store…');

    try {
      const results = await JN.withTimeout(Promise.all([
        JN.client.from('vendors')
          .select('id,name,store_name,email,phone,region,photo,vendor_type,verified,suspended,joined_at,commission_rate')
          .eq('id', state.profile.id)
          .maybeSingle(),
        JN.client.from('products')
          .select('id,name,category,price,unit,stock,max_stock,status,deleted,image,description,badge,variants,vendor,vendor_email,rating,reviews,created_at')
          .eq('vendor_email', email)
          .eq('deleted', false)
          .order('created_at', { ascending: false })
          .limit(300),
        JN.client.from('orders')
          .select('id,group_id,vendor_count,customer,items,total,status,delivery,payment,tracking,date,vendor_email,customer_email')
          .eq('vendor_email', email)
          .order('date', { ascending: false })
          .limit(200)
      ]), 30000, 'Loading your store took too long. Please try again.');

      const [vendorResult, productsResult, ordersResult] = results;
      const failures = results.filter(result => result.error);

      if (failures.length === results.length) {
        throw new Error(failures[0].error.message || 'Your store data could not be loaded.');
      }
      if (failures.length) {
        JN.toast('Some store data could not be loaded. Showing what is available.', 'warning');
      }

      if (vendorResult.data) {
        const row = vendorResult.data;
        state.profile = Object.assign({}, state.profile, {
          name: row.name || state.profile.name,
          storeName: row.store_name || row.name || state.profile.storeName,
          phone: row.phone || '',
          region: row.region || '',
          photo: row.photo || '',
          verified: row.verified !== false,
          suspended: Boolean(row.suspended),
          joinedAt: row.joined_at || state.profile.joinedAt,
          vendorEmail: row.email || state.profile.vendorEmail,
          vendorType: row.vendor_type || state.profile.vendorType
        });
        JN.updateCachedUser(state.profile);
        JN.refreshIdentity(state.profile);
        applyProfile(state.profile);
      }

      state.products = productsResult.error ? [] : (productsResult.data || []);
      state.orders = ordersResult.error ? [] : (ordersResult.data || []);

      renderAll();
    } catch (error) {
      console.error('Vendor dashboard load failed:', error);
      renderLoadError(error.message || 'Your store data could not be loaded.');
      JN.toast('Could not load your store. Please try again.', 'danger');
    } finally {
      if (!silent) JN.hideLoading();
    }
  }

  function activeProducts() {
    return state.products.filter(product => lower(product.status) === 'active' && !product.deleted);
  }

  function openOrders() {
    return state.orders.filter(order => ['pending', 'confirmed', 'processing'].includes(lower(order.status)));
  }

  function pendingOrders() {
    return state.orders.filter(order => lower(order.status) === 'pending');
  }

  function completedOrders() {
    return state.orders.filter(order => lower(order.status) === 'delivered');
  }

  function lowStockProducts() {
    return state.products
      .filter(product => !product.deleted && lower(product.status) === 'active')
      .map(product => Object.assign({}, product, { stock: Number(product.stock) || 0 }))
      .filter(product => product.stock <= 10)
      .sort((a, b) => a.stock - b.stock);
  }

  function revenueTotal() {
    return state.orders
      .filter(order => lower(order.status) !== 'cancelled')
      .reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  }

  function renderAll() {
    renderStats();
    renderLowStock();
    renderRecentOrders();
    renderProducts();
    renderOrders();
    updateNavCounts();
  }

  function updateNavCounts() {
    const lowStock = lowStockProducts().length;
    const open = openOrders().length;

    document.querySelectorAll('[data-count="low-stock"]').forEach(element => {
      element.textContent = String(lowStock);
      element.hidden = lowStock === 0;
    });
    document.querySelectorAll('[data-count="open-vendor-orders"]').forEach(element => {
      element.textContent = String(open);
      element.hidden = open === 0;
    });

    const heroCount = document.getElementById('heroOpenOrders');
    const heroLabel = document.getElementById('heroOpenOrdersLabel');
    if (heroCount) heroCount.textContent = String(open);
    if (heroLabel) {
      heroLabel.textContent = open === 0
        ? 'all caught up'
        : `${JN.plural(open, 'order needs', 'orders need')} your attention`;
    }
  }

  function renderStats() {
    const target = document.getElementById('vendorStats');
    if (!target) return;

    const active = activeProducts();
    const lowStock = lowStockProducts();
    const outOfStock = active.filter(product => Number(product.stock) <= 0).length;
    const pending = pendingOrders();
    const revenue = revenueTotal();
    const delivered = completedOrders().length;
    const average = delivered ? revenue / state.orders.filter(order => lower(order.status) !== 'cancelled').length : 0;

    target.innerHTML = [
      JN.statCard({
        icon: 'products',
        label: 'Live products',
        value: active.length,
        note: `${state.products.length - active.length} draft or inactive`,
        tone: 'primary'
      }),
      JN.statCard({
        icon: 'alert',
        label: 'Low stock',
        value: lowStock.length,
        note: outOfStock ? `${outOfStock} out of stock` : 'At 10 units or fewer',
        tone: lowStock.length ? 'warning' : 'success'
      }),
      JN.statCard({
        icon: 'orders',
        label: 'Pending orders',
        value: pending.length,
        note: `${openOrders().length} open in total`,
        tone: pending.length ? 'warning' : 'success'
      }),
      JN.statCard({
        icon: 'truck',
        label: 'Delivered',
        value: delivered,
        note: `${state.orders.length} orders received`,
        tone: 'info'
      }),
      JN.statCard({
        icon: 'revenue',
        label: 'Order value',
        value: JN.compactMoney(revenue),
        note: delivered ? `Average ${JN.formatPrice(average)} per order` : 'Excludes cancelled orders',
        tone: 'success'
      })
    ].join('');
  }

  function renderLowStock() {
    const target = document.getElementById('lowStockList');
    if (!target) return;

    const lowStock = lowStockProducts().slice(0, 6);
    if (!lowStock.length) {
      target.innerHTML = state.products.length
        ? JN.emptyState('check', 'Stock looks healthy', 'No live products are at 10 units or fewer.')
        : JN.emptyState('products', 'No products yet', 'Add your first product to start selling on the marketplace.', '<button type="button" class="btn btn-primary btn-sm" data-action="open-product">Add product</button>');
      return;
    }

    target.innerHTML = `<div class="low-stock-list">${lowStock.map(product => {
      const stock = Number(product.stock) || 0;
      return `<div class="low-stock-item">
        <div class="low-stock-copy">
          <strong>${JN.esc(product.name || 'Untitled product')}</strong>
          <span>${JN.esc(JN.categoryLabel(product.category))} · ${JN.formatPrice(product.price)} / ${JN.esc(product.unit || 'unit')}</span>
        </div>
        <span class="stock-pill${stock <= 0 ? ' is-out' : ''}">${stock <= 0 ? 'Out of stock' : `${stock} left`}</span>
        <button type="button" class="btn btn-outline btn-sm" data-action="edit-product" data-id="${JN.esc(product.id)}">Update</button>
      </div>`;
    }).join('')}</div>`;
  }

  function ordersTableHtml(orders, options) {
    const settings = options || {};
    if (!orders.length) {
      return JN.emptyState('orders', settings.emptyTitle || 'No orders yet', settings.emptyText || 'Orders from customers will appear here.');
    }

    return `<table class="data-table">
      <caption class="sr-only">Your store orders</caption>
      <thead><tr>
        <th scope="col">Order</th>
        <th scope="col">Customer</th>
        <th scope="col">Items</th>
        <th scope="col">Total</th>
        <th scope="col">Status</th>
        <th scope="col">Placed</th>
        <th scope="col" class="is-right">Action</th>
      </tr></thead>
      <tbody>${orders.map(order => {
        const items = JN.asArray(order.items);
        return `<tr>
          <td><span class="mono">#${JN.esc(order.group_id || String(order.id || '').slice(0, 8))}</span></td>
          <td>
            <strong>${JN.esc(JN.orderCustomerName(order.customer) || 'Customer')}</strong>
            <span class="table-sub">${JN.esc(order.customer_email || '')}</span>
          </td>
          <td>${items.length} ${items.length === 1 ? 'line' : 'lines'} · ${JN.orderItemCount(order)} units</td>
          <td class="table-money">${JN.formatPrice(order.total)}</td>
          <td>${JN.statusPill(order.status)}</td>
          <td>${JN.esc(JN.formatDate(order.date))}</td>
          <td>
            <div class="table-actions">
              <button type="button" class="btn btn-outline btn-sm" data-action="view-vendor-order" data-id="${JN.esc(order.id)}">View</button>
            </div>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  }

  function renderRecentOrders() {
    const target = document.getElementById('recentVendorOrders');
    if (!target) return;

    if (!state.orders.length) {
      target.innerHTML = JN.emptyState('orders', 'No orders yet', 'New customer orders will show up here as soon as they are placed.');
      return;
    }

    target.innerHTML = `<div class="order-list">${state.orders.slice(0, 4).map(order => {
      const items = JN.asArray(order.items);
      const firstItem = items[0];
      return `<div class="queue-item">
        <span class="queue-avatar" aria-hidden="true">${JN.esc(JN.initials(JN.orderCustomerName(order.customer) || 'Customer'))}</span>
        <div class="queue-copy">
          <strong>#${JN.esc(order.group_id || String(order.id || '').slice(0, 8))} · ${JN.formatPrice(order.total)}</strong>
          <span>${JN.esc(JN.orderCustomerName(order.customer) || 'Customer')} · ${JN.esc(JN.formatDate(order.date))}</span>
          <span>${firstItem ? `${JN.esc(firstItem.name || 'Product')}${items.length > 1 ? ` +${items.length - 1} more` : ''}` : 'Order items'}</span>
        </div>
        <div class="queue-actions">
          ${JN.statusPill(order.status)}
        </div>
      </div>`;
    }).join('')}</div>
    <div class="panel-foot mt-md">
      <a class="text-link" href="#orders">Manage all orders</a>
    </div>`;
  }

  function filteredProducts() {
    const term = lower(document.getElementById('vendorProductSearch') && document.getElementById('vendorProductSearch').value);
    const status = (document.getElementById('vendorProductStatusFilter') && document.getElementById('vendorProductStatusFilter').value) || 'all';

    return state.products.filter(product => {
      if (term) {
        const haystack = [product.name, JN.categoryLabel(product.category), product.category, product.unit, product.description]
          .map(lower)
          .join(' ');
        if (!haystack.includes(term)) return false;
      }
      if (status === 'all') return true;
      return lower(product.status) === status;
    });
  }

  function renderProducts() {
    const target = document.getElementById('vendorProductsTable');
    if (!target) return;

    const products = filteredProducts();
    const count = document.getElementById('vendorProductCount');
    if (count) count.textContent = `${products.length} of ${state.products.length} products`;

    if (!products.length) {
      target.innerHTML = JN.emptyState(
        'products',
        state.products.length ? 'No products match' : 'Your catalogue is empty',
        state.products.length
          ? 'Try a different search term or status filter.'
          : 'Add your first product so buyers can find your store.',
        state.products.length ? '' : '<button type="button" class="btn btn-primary btn-sm" data-action="open-product">Add product</button>'
      );
      return;
    }

    target.innerHTML = `<table class="data-table">
      <caption class="sr-only">Your product catalogue</caption>
      <thead><tr>
        <th scope="col">Product</th>
        <th scope="col">Price</th>
        <th scope="col">Stock</th>
        <th scope="col">Status</th>
        <th scope="col">Listed</th>
        <th scope="col" class="is-right">Actions</th>
      </tr></thead>
      <tbody>${products.map(product => {
        const image = JN.safeUrl(product.image) || 'assets/product-placeholder.svg';
        const stock = Number(product.stock) || 0;
        const status = lower(product.status) === 'active'
          ? JN.statusPill('active')
          : JN.statusPill(product.status || 'draft');
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
          <td class="table-money">${JN.formatPrice(product.price)}</td>
          <td>${stock <= 0 ? '<span class="low-stock">Out of stock</span>' : stock <= 10 ? `<span class="low-stock">${stock} left</span>` : stock}</td>
          <td>${status}</td>
          <td>${JN.esc(JN.formatDate(product.created_at))}</td>
          <td>
            <div class="table-actions">
              <button type="button" class="btn btn-ghost btn-sm" data-action="edit-product" data-id="${JN.esc(product.id)}">Edit</button>
              <button type="button" class="btn btn-danger btn-sm" data-action="delete-product" data-id="${JN.esc(product.id)}">Remove</button>
            </div>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  }

  function filteredOrders() {
    const term = lower(document.getElementById('vendorOrderSearch') && document.getElementById('vendorOrderSearch').value);
    const status = (document.getElementById('vendorOrderStatusFilter') && document.getElementById('vendorOrderStatusFilter').value) || 'all';

    return state.orders.filter(order => {
      if (status !== 'all' && lower(order.status) !== status) return false;
      if (!term) return true;
      const items = JN.asArray(order.items).map(item => item.name).join(' ');
      return [order.group_id, order.id, order.customer_email, JN.orderCustomerName(order.customer), items]
        .map(lower)
        .join(' ')
        .includes(term);
    });
  }

  function renderOrders() {
    const target = document.getElementById('vendorOrdersTable');
    if (!target) return;

    const orders = filteredOrders();
    const count = document.getElementById('vendorOrderCount');
    if (count) count.textContent = `${orders.length} of ${state.orders.length} orders`;

    target.innerHTML = ordersTableHtml(orders, {
      emptyTitle: state.orders.length ? 'No orders match' : 'No orders yet',
      emptyText: state.orders.length
        ? 'Try a different search term or status filter.'
        : 'Orders from customers will appear here after checkout.'
    });
  }

  function productById(productId) {
    return state.products.find(product => String(product.id) === String(productId)) || null;
  }

  function openProductForm(productId) {
    const form = document.getElementById('productForm');
    const title = document.getElementById('productModalTitle');
    if (!form) return;

    form.reset();
    const idField = form.elements.namedItem('productId');
    if (idField) idField.value = '';

    const product = productId ? productById(productId) : null;
    if (product) {
      if (idField) idField.value = product.id;
      setField(form, 'productName', product.name || '');
      setField(form, 'productCategory', product.category || '');
      setField(form, 'productUnit', product.unit || '');
      setField(form, 'productPrice', product.price || '');
      setField(form, 'productStock', product.stock == null ? '' : product.stock);
      setField(form, 'productDescription', product.description || '');
      setField(form, 'productImage', product.image || '');
    }

    if (title) title.textContent = product ? 'Edit product' : 'Add product';
    const publishNote = document.getElementById('productPublishNote');
    if (publishNote) publishNote.hidden = Boolean(state.profile && state.profile.verified);

    JN.openModal('productModal');
    const focusField = form.elements.namedItem('productName');
    if (focusField) setTimeout(() => focusField.focus(), 80);
  }

  function setField(form, name, value) {
    const field = form.elements.namedItem(name);
    if (field) field.value = value;
  }

  function readField(form, name) {
    const field = form.elements.namedItem(name);
    return field ? String(field.value || '').trim() : '';
  }

  async function saveProduct(event) {
    event.preventDefault();
    if (!state.profile) return;

    const form = event.target;
    const productId = readField(form, 'productId');
    const name = readField(form, 'productName');
    const category = readField(form, 'productCategory');
    const unit = readField(form, 'productUnit');
    const description = readField(form, 'productDescription');
    const price = Number(readField(form, 'productPrice'));
    const stock = Number.parseInt(readField(form, 'productStock'), 10);
    const image = JN.safeUrl(readField(form, 'productImage')) || 'assets/product-placeholder.svg';
    const email = state.profile.vendorEmail || state.profile.email;

    if (!name || !category || !unit || !description) {
      JN.toast('Complete the product name, category, unit, and description.', 'warning');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      JN.toast('Enter a valid product price.', 'warning');
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      JN.toast('Enter a valid stock quantity.', 'warning');
      return;
    }

    const existing = productId ? productById(productId) : null;
    const payload = {
      name,
      category,
      unit,
      price,
      stock,
      max_stock: Math.max(stock, Number(existing && existing.max_stock) || 0, 1),
      description,
      image,
      badge: (existing && existing.badge) || '',
      variants: (existing && existing.variants) || []
    };

    const submit = document.getElementById('saveProductBtn');
    if (submit) submit.disabled = true;
    JN.showLoading(existing ? 'Saving changes…' : 'Adding product…');

    try {
      if (existing) {
        const { data, error } = await JN.client.from('products')
          .update(Object.assign({}, payload, { vendor: state.profile.storeName || state.profile.name }))
          .eq('id', existing.id)
          .eq('vendor_email', email)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('This product could not be found in your store.');
        JN.toast('Product updated.', 'success');
      } else {
        const { error } = await JN.client.from('products').insert(Object.assign({}, payload, {
          vendor_email: email,
          vendor: state.profile.storeName || state.profile.name || 'Verified vendor',
          status: state.profile.verified ? 'active' : 'draft',
          rating: 0,
          reviews: 0,
          deleted: false
        }));
        if (error) throw error;
        JN.toast(state.profile.verified ? 'Product published.' : 'Product saved as a draft until your store is verified.', 'success');
      }

      JN.closeModal('productModal');
      await loadData({ silent: true });
    } catch (error) {
      console.error('Product save failed:', error);
      JN.toast('Could not save the product: ' + (error.message || 'Unknown error'), 'danger');
    } finally {
      if (submit) submit.disabled = false;
      JN.hideLoading();
    }
  }

  async function deleteProduct(productId) {
    const product = productById(productId);
    if (!product || !state.profile) return;
    if (!window.confirm(`Remove “${product.name}” from your store? Buyers will no longer see it.`)) return;

    JN.showLoading('Removing product…');
    try {
      const { data, error } = await JN.client.from('products')
        .update({ deleted: true, status: 'inactive' })
        .eq('id', product.id)
        .eq('vendor_email', state.profile.vendorEmail || state.profile.email)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('This product could not be found in your store.');
      JN.toast('Product removed from your store.', 'success');
      await loadData({ silent: true });
    } catch (error) {
      console.error('Product removal failed:', error);
      JN.toast('Could not remove the product: ' + (error.message || 'Unknown error'), 'danger');
    } finally {
      JN.hideLoading();
    }
  }

  const NEXT_STATUS = {
    pending: [
      { status: 'confirmed', label: 'Confirm order', tone: 'primary' },
      { status: 'cancelled', label: 'Cancel', tone: 'danger' }
    ],
    confirmed: [
      { status: 'processing', label: 'Mark processing', tone: 'primary' },
      { status: 'cancelled', label: 'Cancel', tone: 'danger' }
    ],
    processing: [
      { status: 'delivered', label: 'Mark delivered', tone: 'primary' }
    ]
  };

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
    const title = document.getElementById('vendorOrderDetailTitle');
    const body = document.getElementById('vendorOrderDetailBody');
    if (!body) return;

    if (title) title.textContent = `#${order.group_id || String(order.id).slice(0, 8)}`;

    const status = lower(order.status);
    const actions = (NEXT_STATUS[status] || []).map(action =>
      `<button type="button" class="btn ${action.tone === 'danger' ? 'btn-danger' : 'btn-primary'}" data-action="set-order-status" data-id="${JN.esc(order.id)}" data-status="${JN.esc(action.status)}">${JN.esc(action.label)}</button>`
    ).join('');

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
          <span>Order group: ${JN.esc(order.group_id || '—')}</span>
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
      <div class="detail-total"><span>Your order total</span><strong>${JN.formatPrice(order.total)}</strong></div>
      ${actions ? `<div class="detail-actions">${actions}</div>` : ''}
    `;

    JN.openModal('vendorOrderDetailModal');
  }

  async function updateOrderStatus(orderId, status) {
    if (!orderId || !state.profile) return;
    if (!['confirmed', 'processing', 'delivered', 'cancelled'].includes(status)) return;
    if (status === 'cancelled' && !window.confirm('Cancel this order? The customer will see it as cancelled.')) return;

    JN.showLoading('Updating order…');
    try {
      const { data, error } = await JN.client.from('orders')
        .update({ status })
        .eq('id', orderId)
        .eq('vendor_email', state.profile.vendorEmail || state.profile.email)
        .select('id,status')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('This order could not be found in your store.');

      const order = state.orders.find(item => String(item.id) === String(orderId));
      if (order) order.status = status;

      JN.closeModal('vendorOrderDetailModal');
      JN.toast(`Order marked ${status}.`, 'success');
      renderAll();
    } catch (error) {
      console.error('Order status update failed:', error);
      JN.toast('Could not update the order: ' + (error.message || 'Unknown error'), 'danger');
    } finally {
      JN.hideLoading();
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!state.profile) return;

    const form = event.target;
    const storeName = readField(form, 'storeName');
    const phone = readField(form, 'storePhone');
    const region = readField(form, 'storeRegion');
    const photo = JN.safeUrl(readField(form, 'storePhoto'));

    if (!storeName) {
      JN.toast('Enter your store name.', 'warning');
      return;
    }
    if (phone && !/^(?:\+?255|0)\d{9}$/.test(phone.replace(/[^\d+]/g, ''))) {
      JN.toast('Enter a valid Tanzanian phone number, for example +255 754 123 456.', 'warning');
      return;
    }

    const previousName = String(state.profile.storeName || state.profile.name || '').trim();
    const submit = document.getElementById('saveVendorProfileBtn');
    if (submit) submit.disabled = true;
    JN.showLoading('Saving store details…');

    try {
      const { data, error } = await JN.client.from('vendors')
        .update({ store_name: storeName, phone, region, photo })
        .eq('id', state.profile.id)
        .select('id,store_name,phone,region,photo')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Your vendor profile could not be updated.');

      const savedName = data.store_name || storeName;
      state.profile = Object.assign({}, state.profile, {
        storeName: savedName,
        phone: data.phone || '',
        region: data.region || '',
        photo: data.photo || ''
      });
      JN.updateCachedUser(state.profile);
      JN.refreshIdentity(state.profile);
      applyProfile(state.profile);

      // Products carry a denormalised vendor label for the storefront. Keep it
      // in sync after a rename, but never fail the profile save that already
      // succeeded if this secondary update is rejected.
      let labelWarning = false;
      if (savedName !== previousName) {
        const email = state.profile.vendorEmail || state.profile.email;
        const { error: labelError } = await JN.client.from('products')
          .update({ vendor: savedName })
          .eq('vendor_email', email);
        if (labelError) {
          labelWarning = true;
          console.error('Product vendor label update failed:', labelError);
        } else {
          state.products = state.products.map(product =>
            Object.assign({}, product, { vendor: savedName }));
        }
      }

      JN.toast(
        labelWarning
          ? 'Store details saved. Some product labels could not be updated yet.'
          : 'Store details saved.',
        labelWarning ? 'warning' : 'success'
      );
    } catch (error) {
      console.error('Store profile update failed:', error);
      JN.toast('Could not save your store details: ' + (error.message || 'Unknown error'), 'danger');
    } finally {
      if (submit) submit.disabled = false;
      JN.hideLoading();
    }
  }

  function renderLoadError(message) {
    const stats = document.getElementById('vendorStats');
    if (stats) {
      stats.innerHTML = JN.emptyState('alert', 'Store data unavailable', message || 'Use refresh to try again.');
    }
    ['lowStockList', 'recentVendorOrders', 'vendorProductsTable', 'vendorOrdersTable'].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.innerHTML = JN.emptyState('alert', 'Could not load this section', 'Use refresh to try again.');
    });
  }
})();
