/* ============================================================
   JengaNasi Customer Dashboard page logic
   ============================================================ */

(function () {
  'use strict';

  const JN = window.JN;
  const state = {
    profile: null,
    orders: [],
    vendorNames: {},
    bound: false
  };

  JN.boot({ role: 'customer', onReady: init });

  async function init(profile) {
    state.profile = profile;
    bindEvents();
    applyProfile(profile);
    await loadData();
  }

  function lower(value) {
    return String(value || '').trim().toLowerCase();
  }

  function applyProfile(profile) {
    const nameField = document.getElementById('customerName');
    const phoneField = document.getElementById('customerPhone');
    const emailField = document.getElementById('customerEmail');
    if (nameField) nameField.value = profile.name || '';
    if (phoneField) phoneField.value = profile.phone || '';
    if (emailField) emailField.value = profile.email || '';
  }

  function bindEvents() {
    if (state.bound) return;
    state.bound = true;

    document.addEventListener('click', event => {
      const element = event.target.closest('[data-action]');
      if (!element) return;
      const action = element.dataset.action;

      if (action === 'refresh-customer') {
        loadData({ silent: false });
      }
    });

    const search = document.getElementById('customerOrderSearch');
    const status = document.getElementById('customerOrderStatusFilter');
    const form = document.getElementById('customerProfileForm');
    const reset = document.getElementById('resetCustomerBtn');

    if (search) search.addEventListener('input', JN.debounce(renderOrders));
    if (status) status.addEventListener('change', renderOrders);
    if (form) form.addEventListener('submit', saveProfile);
    if (reset) reset.addEventListener('click', () => applyProfile(state.profile || {}));
  }

  async function loadData(options) {
    const silent = Boolean(options && options.silent);
    if (!state.profile) return;
    const email = state.profile.email || '';
    if (!silent) JN.showLoading('Loading your orders…');

    try {
      const orderSelect = 'id,group_id,vendor_count,customer,items,total,status,delivery,payment,date,vendor_email,customer_email';
      const requests = [
        JN.client.from('orders').select(orderSelect)
          .eq('customer_id', state.profile.id)
          .order('date', { ascending: false })
          .limit(200)
      ];
      if (email) {
        requests.push(JN.client.from('orders').select(orderSelect)
          .eq('customer_email', email)
          .order('date', { ascending: false })
          .limit(200));
      }
      requests.push(JN.client.from('products')
        .select('vendor_email,vendor')
        .eq('status', 'active')
        .eq('deleted', false)
        .limit(1000));

      const results = await JN.withTimeout(Promise.all(requests), 30000, 'Loading your orders took too long. Please try again.');

      const orderResults = email ? results.slice(0, 2) : results.slice(0, 1);
      const productsResult = results[results.length - 1];

      if (orderResults.every(result => result.error)) {
        throw new Error(orderResults[0].error.message || 'Your orders could not be loaded.');
      }
      if (orderResults.some(result => result.error)) {
        JN.toast('Some order history could not be loaded. Showing what is available.', 'warning');
      }

      const merged = new Map();
      orderResults.forEach(result => {
        (result.data || []).forEach(order => {
          merged.set(String(order.id), order);
        });
      });
      state.orders = Array.from(merged.values())
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      state.vendorNames = {};
      if (!productsResult.error) {
        (productsResult.data || []).forEach(product => {
          const key = lower(product.vendor_email);
          if (key && product.vendor) state.vendorNames[key] = product.vendor;
        });
      }

      renderAll();
    } catch (error) {
      console.error('Customer dashboard load failed:', error);
      renderLoadError(error.message || 'Your orders could not be loaded.');
      JN.toast('Could not load your account. Please try again.', 'danger');
    } finally {
      if (!silent) JN.hideLoading();
    }
  }

  function vendorLabel(email) {
    return state.vendorNames[lower(email)] || prettifyEmail(email);
  }

  function prettifyEmail(email) {
    const raw = String(email || '').split('@')[0];
    if (!raw) return 'Verified vendor';
    return raw.replace(/[._-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
  }

  function groupOrders(orders) {
    const groups = new Map();

    orders.forEach(order => {
      const key = order.group_id || String(order.id);
      if (!groups.has(key)) {
        groups.set(key, { key, orders: [] });
      }
      groups.get(key).orders.push(order);
    });

    return Array.from(groups.values()).map(group => {
      const shipments = group.orders.slice().sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
      const statuses = shipments.map(order => lower(order.status));
      const delivered = statuses.filter(status => status === 'delivered').length;
      const cancelled = statuses.filter(status => status === 'cancelled').length;
      const open = statuses.some(status => !['delivered', 'cancelled'].includes(status));
      const itemCount = shipments.reduce((sum, order) => sum + JN.orderItemCount(order), 0);
      const total = shipments.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
      const latest = shipments.reduce((value, order) => {
        const time = new Date(order.date || 0).getTime();
        return time > value ? time : value;
      }, 0);

      let status = 'pending';
      let label = '';
      if (cancelled === shipments.length) {
        status = 'cancelled';
        label = 'Cancelled';
      } else if (delivered === shipments.length) {
        status = 'delivered';
        label = 'Delivered';
      } else if (delivered > 0) {
        status = 'delivered';
        label = `${delivered} of ${shipments.length} delivered`;
      } else if (statuses.includes('processing')) {
        status = 'processing';
        label = 'Processing';
      } else if (statuses.includes('confirmed')) {
        status = 'confirmed';
        label = 'Confirmed';
      } else {
        status = 'pending';
        label = 'Pending';
      }

      return {
        key: group.key,
        orders: shipments,
        total,
        date: latest ? new Date(latest).toISOString() : null,
        itemCount,
        vendorCount: shipments.length,
        status,
        label,
        open
      };
    }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }

  function groupedOrders() {
    return groupOrders(state.orders);
  }

  function openGroups() {
    return groupedOrders().filter(group => group.open);
  }

  function totalSpent() {
    return state.orders
      .filter(order => lower(order.status) !== 'cancelled')
      .reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  }

  function renderAll() {
    renderStats();
    renderRecentOrders();
    renderLastDelivery();
    renderOrders();
    updateNavCounts();
  }

  function updateNavCounts() {
    const open = openGroups().length;
    document.querySelectorAll('[data-count="open-customer-orders"]').forEach(element => {
      element.textContent = String(open);
      element.hidden = open === 0;
    });

    const heroCount = document.getElementById('heroOrderCount');
    const heroLabel = document.getElementById('heroOrderCountLabel');
    const groups = groupedOrders();
    if (heroCount) heroCount.textContent = String(groups.length);
    if (heroLabel) {
      heroLabel.textContent = !groups.length
        ? 'no orders yet'
        : open
          ? `${JN.plural(open, 'order is', 'orders are')} in progress`
          : 'all orders complete';
    }
  }

  function renderStats() {
    const target = document.getElementById('customerStats');
    if (!target) return;

    const groups = groupedOrders();
    const open = groups.filter(group => group.open).length;
    const deliveredShipments = state.orders.filter(order => lower(order.status) === 'delivered').length;
    const vendors = new Set(state.orders.map(order => lower(order.vendor_email)).filter(Boolean));

    target.innerHTML = [
      JN.statCard({
        icon: 'orders',
        label: 'Orders placed',
        value: groups.length,
        note: groups.length ? `${state.orders.length} vendor shipments` : 'Your first order starts here',
        tone: 'primary'
      }),
      JN.statCard({
        icon: 'truck',
        label: 'In progress',
        value: open,
        note: open ? 'Confirmed, processing, or awaiting confirmation' : 'Nothing waiting on delivery',
        tone: open ? 'warning' : 'success'
      }),
      JN.statCard({
        icon: 'check',
        label: 'Delivered',
        value: deliveredShipments,
        note: deliveredShipments === state.orders.length && state.orders.length
          ? 'Every shipment delivered'
          : `${state.orders.length - deliveredShipments} shipments not delivered`,
        tone: 'info'
      }),
      JN.statCard({
        icon: 'money',
        label: 'Total spent',
        value: JN.compactMoney(totalSpent()),
        note: `${vendors.size} ${JN.plural(vendors.size, 'vendor')} shopped from`,
        tone: 'success'
      })
    ].join('');
  }

  function orderCardHtml(group) {
    const first = group.orders[0] || {};
    const delivery = first.delivery && typeof first.delivery === 'object' ? first.delivery : {};
    const payment = first.payment && typeof first.payment === 'object' ? first.payment : {};
    const tone = JN.statusTone(group.status);

    return `<details class="order-card" data-group="${JN.esc(group.key)}">
      <summary>
        <div class="order-summary-main">
          <span class="order-number">#${JN.esc(group.key)}</span>
          <span class="order-date">${JN.esc(JN.formatDate(group.date))}</span>
        </div>
        <div class="order-summary-mid">
          <strong>${group.vendorCount} ${JN.plural(group.vendorCount, 'shipment')} · ${group.itemCount} ${JN.plural(group.itemCount, 'item')}</strong>
          <span>${JN.esc(group.orders.map(order => vendorLabel(order.vendor_email)).join(' · '))}</span>
        </div>
        <div class="order-summary-side">
          <span class="status-pill is-${tone}">${JN.esc(group.label)}</span>
          <span class="order-total">${JN.formatPrice(group.total)}</span>
          <span class="order-chevron" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </span>
        </div>
      </summary>
      <div class="order-card-body">
        ${group.orders.map(order => {
          const items = JN.asArray(order.items);
          return `<section class="shipment">
            <div class="shipment-head">
              <strong>${JN.esc(vendorLabel(order.vendor_email))}</strong>
              ${JN.statusPill(order.status)}
            </div>
            <div class="shipment-items">
              ${items.length ? items.map(item => {
                const quantity = Number(item.quantity) || 0;
                const lineTotal = Number(item.line_total) || (Number(item.price) || 0) * quantity;
                return `<div class="shipment-item">
                  <span>${JN.esc(item.name || 'Product')} · ${quantity} × ${JN.formatPrice(item.price)} / ${JN.esc(item.unit || 'unit')}</span>
                  <span>${JN.formatPrice(lineTotal)}</span>
                </div>`;
              }).join('') : '<div class="shipment-item"><span>No line items recorded.</span></div>'}
            </div>
            <div class="shipment-total"><span>Shipment total</span><strong>${JN.formatPrice(order.total)}</strong></div>
          </section>`;
        }).join('')}

        <div class="order-delivery">
          <h4>Delivery</h4>
          <p>${JN.esc(delivery.address || 'Delivery address not recorded')}${delivery.region ? `, ${JN.esc(delivery.region)}` : ''}</p>
          <p>${JN.esc(delivery.phone || 'Phone not recorded')} · ${JN.esc(JN.paymentLabel(payment.method))} (${JN.esc(payment.status || 'pending')})</p>
        </div>

        <div class="order-actions">
          <a class="btn btn-outline btn-sm" href="mailto:info@jenganasi.co.tz?subject=${encodeURIComponent('Order ' + group.key)}">Ask about this order</a>
        </div>
      </div>
    </details>`;
  }

  function renderRecentOrders() {
    const target = document.getElementById('recentCustomerOrders');
    if (!target) return;

    const groups = groupedOrders().slice(0, 2);
    if (!groups.length) {
      target.innerHTML = JN.emptyState(
        'orders',
        'No orders yet',
        'When you check out, every vendor shipment shows up here with its delivery details.',
        '<a class="btn btn-primary btn-sm" href="/">Browse materials</a>'
      );
      return;
    }

    target.innerHTML = `<div class="order-list">${groups.map(orderCardHtml).join('')}</div>
      <div class="form-actions mt-md"><a class="text-link" href="#orders">View full order history</a></div>`;
  }

  function renderLastDelivery() {
    const target = document.getElementById('lastDelivery');
    if (!target) return;

    const groups = groupedOrders();
    const latest = groups[0];
    const order = latest && latest.orders[0];
    const delivery = order && order.delivery && typeof order.delivery === 'object' ? order.delivery : null;

    if (!delivery || (!delivery.address && !delivery.region && !delivery.phone)) {
      target.innerHTML = JN.emptyState('truck', 'No delivery yet', 'Your most recent delivery address will appear here after checkout.');
      return;
    }

    target.innerHTML = `<div class="profile-rows">
      <div class="profile-row"><span>Order</span><strong>#${JN.esc(latest.key)}</strong></div>
      <div class="profile-row"><span>Address</span><span>${JN.esc(delivery.address || '—')}</span></div>
      <div class="profile-row"><span>Region</span><span>${JN.esc(delivery.region || '—')}</span></div>
      <div class="profile-row"><span>Phone</span><span>${JN.esc(delivery.phone || '—')}</span></div>
    </div>
    <div class="form-actions mt-md"><a class="text-link" href="#orders">Open order details</a></div>`;
  }

  function filteredGroups() {
    const term = lower(document.getElementById('customerOrderSearch') && document.getElementById('customerOrderSearch').value);
    const status = (document.getElementById('customerOrderStatusFilter') && document.getElementById('customerOrderStatusFilter').value) || 'all';

    return groupedOrders().filter(group => {
      if (status === 'open' && !group.open) return false;
      if (status !== 'all' && status !== 'open') {
        if (!group.orders.some(order => lower(order.status) === status)) return false;
      }
      if (!term) return true;

      const haystack = [
        group.key,
        group.label,
        ...group.orders.map(order => vendorLabel(order.vendor_email)),
        ...group.orders.map(order => order.customer_email || ''),
        ...group.orders.flatMap(order => JN.asArray(order.items).map(item => item.name || ''))
      ].map(lower).join(' ');
      return haystack.includes(term);
    });
  }

  function renderOrders() {
    const target = document.getElementById('customerOrdersList');
    if (!target) return;

    const groups = filteredGroups();
    const count = document.getElementById('customerOrderCount');
    if (count) count.textContent = `${groups.length} of ${groupedOrders().length} orders`;

    if (!groups.length) {
      target.innerHTML = JN.emptyState(
        'orders',
        state.orders.length ? 'No orders match' : 'No orders yet',
        state.orders.length
          ? 'Try a different search term or status filter.'
          : 'Once you check out, your order history and delivery details appear here.',
        state.orders.length ? '' : '<a class="btn btn-primary btn-sm" href="/">Browse materials</a>'
      );
      return;
    }

    target.innerHTML = `<div class="order-list">${groups.map(orderCardHtml).join('')}</div>`;
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!state.profile) return;

    const form = event.target;
    const name = String(form.elements.namedItem('customerName').value || '').trim();
    const phone = String(form.elements.namedItem('customerPhone').value || '').trim();

    if (!name) {
      JN.toast('Enter your full name.', 'warning');
      return;
    }
    if (phone && !/^(?:\+?255|0)\d{9}$/.test(phone.replace(/[^\d+]/g, ''))) {
      JN.toast('Enter a valid Tanzanian phone number, for example +255 754 123 456.', 'warning');
      return;
    }

    const submit = document.getElementById('saveCustomerBtn');
    if (submit) submit.disabled = true;
    JN.showLoading('Saving your details…');

    try {
      const { data, error } = await JN.client.from('customers')
        .update({ name, phone })
        .eq('id', state.profile.id)
        .select('id,name,phone')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Your customer profile could not be updated.');

      state.profile = Object.assign({}, state.profile, {
        name: data.name || name,
        phone: data.phone || ''
      });
      JN.updateCachedUser(state.profile);
      JN.refreshIdentity(state.profile);
      applyProfile(state.profile);
      JN.toast('Contact details saved.', 'success');
    } catch (error) {
      console.error('Customer profile update failed:', error);
      JN.toast('Could not save your details: ' + (error.message || 'Unknown error'), 'danger');
    } finally {
      if (submit) submit.disabled = false;
      JN.hideLoading();
    }
  }

  function renderLoadError(message) {
    const stats = document.getElementById('customerStats');
    if (stats) {
      stats.innerHTML = JN.emptyState('alert', 'Account data unavailable', message || 'Use refresh to try again.');
    }
    ['recentCustomerOrders', 'lastDelivery', 'customerOrdersList'].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.innerHTML = JN.emptyState('alert', 'Could not load this section', 'Use refresh to try again.');
    });
  }
})();
