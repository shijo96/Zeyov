/* ZEYOV theme script — cart drawer, offers, quick add, product form, wishlist, filters, predictive search, reviews */
(() => {
  'use strict';
  const Z = window.Zeyov || {};
  const O = Object.assign({ tier1Qty: 3, tier1Pct: 5, tier2Qty: 5, tier2Pct: 15, bundle2Pct: 5, bundle3Pct: 10 }, Z.offers || {});
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = (Z.routes && Z.routes.root) || '/';
  const url = (p) => (root.endsWith('/') ? root : root + '/') + p.replace(/^\//, '');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- money ---------- */
  function money(cents) {
    const fmt = Z.moneyFormat || '₹{{amount}}';
    const n = Math.round(Number(cents) || 0);
    const group = (v, dec, ts, ds) => {
      const [i, d] = (v / 100).toFixed(dec).split('.');
      return i.replace(/\B(?=(\d{3})+(?!\d))/g, ts) + (d ? ds + d : '');
    };
    return fmt.replace(/Rs\.?\s?/g, '₹').replace(/\{\{\s*(\w+)\s*\}\}/, (_, k) => {
      if (k === 'amount_no_decimals') return group(n, 0, ',', '.');
      if (k === 'amount_with_comma_separator') return group(n, 2, '.', ',');
      if (k === 'amount_no_decimals_with_comma_separator') return group(n, 0, '.', ',');
      return group(n, 2, ',', '.').replace(/\.00$/, '');
    });
  }

  /* ---------- swatches ---------- */
  const swatchMap = {};
  (Z.swatches || []).forEach((line) => {
    const [n, h] = String(line).split(':');
    if (n && h) swatchMap[n.trim().toLowerCase()] = h.trim();
  });
  const hex = (name) => swatchMap[String(name).trim().toLowerCase()] || '#cfc6b8';
  const isColorName = (n) => /colou?r/i.test(n || '');
  const isSizeName = (n) => /size/i.test(n || '');

  /* ---------- storage ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg) {
    const t = $('#Toast'); if (!t) return;
    t.textContent = msg; t.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('is-on'), 2400);
  }

  /* ---------- overlays ---------- */
  const scrim = $('#Scrim');
  let openEl = null; let lastFocus = null;
  function openPanel(el) {
    if (!el) return;
    if (openEl && openEl !== el) closePanel();
    lastFocus = document.activeElement;
    openEl = el;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-open'));
    el.setAttribute('aria-hidden', 'false');
    if (scrim && !el.classList.contains('modal')) scrim.hidden = false;
    document.body.classList.add('lock');
    const f = el.querySelector('input[type=search], [data-close], button, a');
    setTimeout(() => (el.id === 'SearchOverlay' ? $('#SearchInput') : el).focus({ preventScroll: true }), 60);
    void f;
  }
  function closePanel() {
    if (!openEl) return;
    const el = openEl; openEl = null;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    if (el.classList.contains('modal')) el.hidden = true;
    if (scrim) scrim.hidden = true;
    document.body.classList.remove('lock');
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  scrim && scrim.addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePanel(); $$('[data-sort-menu]').forEach((m) => { m.hidden = true; }); } });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-close], [data-close-modal]');
    if (t) { e.preventDefault(); closePanel(); return; }
    if (e.target.closest('[data-open-menu]')) openPanel($('#MenuDrawer'));
    else if (e.target.closest('[data-open-search]')) openPanel($('#SearchOverlay'));
    else if (e.target.closest('[data-open-cart]')) { openPanel($('#CartDrawer')); refreshCart(); }
    else if (e.target.closest('[data-open-filters]')) openPanel($('#FilterDrawer'));
    else if (e.target.closest('[data-open-modal]')) { const m = document.getElementById(e.target.closest('[data-open-modal]').dataset.openModal); openPanel(m); }
  });

  /* ---------- header ---------- */
  const header = $('[data-header]');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  /* ---------- offers maths ---------- */
  // Bundle: same product qty 2 -> bundle2Pct, 3+ -> bundle3Pct. Cart: total items >= tier1Qty -> tier1Pct, >= tier2Qty -> tier2Pct.
  function bundlePct(q) { return q >= 3 ? O.bundle3Pct : q === 2 ? O.bundle2Pct : 0; }
  function tierPct(n) { return n >= O.tier2Qty ? O.tier2Pct : n >= O.tier1Qty ? O.tier1Pct : 0; }
  function calcOffers(items) {
    const groups = {};
    items.forEach((it) => {
      const g = groups[it.product_id] || (groups[it.product_id] = { qty: 0, total: 0 });
      g.qty += it.quantity; g.total += it.original_line_price;
    });
    let subtotal = 0; let bundleSave = 0; let count = 0;
    Object.values(groups).forEach((g) => {
      g.pct = bundlePct(g.qty);
      g.save = Math.round(g.total * g.pct / 100);
      subtotal += g.total; bundleSave += g.save; count += g.qty;
    });
    const tp = tierPct(count);
    const tierSave = Math.round((subtotal - bundleSave) * tp / 100);
    return { groups, subtotal, bundleSave, tierPct: tp, tierSave, count, total: subtotal - bundleSave - tierSave };
  }

  const ICON_CART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 4h2.2l2.3 11h10.8l2-8H6.3"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/></svg>';
  function tierHTML(count, cart) {
    const applied = cart && cart.items_subtotal_price > cart.total_price;
    const tp = tierPct(count);
    if (tp && applied) {
      const next = count < O.tier2Qty ? `<br><span style="font-size:12px">Add ${O.tier2Qty - count} more for extra ${O.tier2Pct}% OFF</span>` : '';
      return `<div class="applied">${ICON_CART}<div><b>Cart Discount Applied ✓</b>${count} items → Extra ${tp}% OFF${next}</div></div>`;
    }
    if (tp) return `<div class="applied is-next">${ICON_CART}<div><b>${count} items in cart</b>Extra ${tp}% OFF applies at checkout</div></div>`;
    const need = O.tier1Qty - count;
    return `<div class="applied is-next">${ICON_CART}<div><b>Add ${need} more item${need > 1 ? 's' : ''}</b>${O.tier1Qty} items → Extra ${O.tier1Pct}% OFF · ${O.tier2Qty} items → Extra ${O.tier2Pct}% OFF</div></div>`;
  }

  /* ---------- cart ---------- */
  let cartCache = null;
  async function getCart() {
    const r = await fetch(url('cart.js'), { headers: { Accept: 'application/json' } });
    cartCache = await r.json();
    return cartCache;
  }
  function setCounts(n) {
    $$('[data-cart-count]').forEach((b) => { b.textContent = n > 0 ? n : ''; b.dataset.count = n; });
    $$('[data-cart-count-text]').forEach((b) => { b.textContent = `(${n})`; });
  }
  function lineHTML(it, offers) {
    const g = offers.groups[it.product_id];
    const props0 = it.properties || {};
    const isStudio = !!props0['Design ID'];
    const pr0 = (k) => props0[k];
    const mock = props0['Front mockup'] || props0['Back mockup'];
    const img = isStudio && mock && /^(https?:)?\/\//.test(mock) ? mock : it.image ? `${it.image}${it.image.includes('?') ? '&' : '?'}width=240` : '';
    if (isStudio) it = Object.assign({}, it, { url: '/pages/studio' });
    let deal = '';
    if (g && g.pct && it.original_line_price > it.final_line_price) deal = `<span class="line__deal">Bundle of ${g.qty}: extra ${g.pct}% off</span>`;
    else if (g && g.qty === 1 && !isStudio) deal = `<span class="line__deal hint">Add 1 more of this product: extra ${O.bundle2Pct}% off</span>`;
    let variant = isStudio && it.options_with_values ? `<span class="line__variant">${[pr0('Size') && 'Size ' + pr0('Size'), pr0('Colour'), it.options_with_values[0] && it.options_with_values[0].value].filter(Boolean).map(esc).join(' · ')}</span>` : it.variant_title && it.variant_title !== 'Default Title' ? `<span class="line__variant">${esc(it.variant_title)}</span>` : '';
    const pr = it.properties || {};
    if (pr['Design ID']) {
      const keep = ['Design ID', 'T-shirt', 'Front print', 'Back print'];
      variant += `<span class="line__props">${keep.filter((k) => pr[k] && pr[k] !== 'None').map((k) => `<span><b>${esc(k)}:</b> ${esc(String(pr[k]).split(' · top edge')[0])}</span>`).join('')}${Object.keys(pr).some((k) => /file|mockup|artwork/i.test(k)) ? '<span class="line__ok">✓ Design files attached</span>' : ''}</span>`;
    }
    const was = it.original_line_price > it.final_line_price ? `<s class="price__was">${money(it.original_line_price)}</s>` : '';
    return `<div class="line" data-key="${esc(it.key)}">
      <a class="line__img" href="${esc(it.url)}">${img ? `<img src="${esc(img)}" alt="${esc(it.product_title)}" loading="lazy" width="240" height="300">` : `<span class="line__ph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 3 3 6l2 5 2-1v11h10V10l2 1 2-5-5-3a4 4 0 0 1-8 0Z"/></svg></span>`}</a>
      <div class="line__body">
        <a class="line__title" href="${esc(it.url)}">${esc(it.product_title)}</a>
        ${variant}
        <div class="line__price"><b>${money(it.final_line_price)}</b>${was}</div>${deal}
        <div class="line__bottom">
          <div class="qty"><button type="button" data-qty-step="-1" aria-label="Decrease">−</button><input type="number" min="0" value="${it.quantity}" aria-label="Quantity" data-line-qty><button type="button" data-qty-step="1" aria-label="Increase">+</button></div>
          <button type="button" class="remove" data-remove>Remove</button>
        </div>
      </div></div>`;
  }
  function renderCart(cart) {
    setCounts(cart.item_count);
    const offers = calcOffers(cart.items);
    const bodies = $$('[data-cart-body]'); const foots = $$('[data-cart-foot]');
    if (!cart.item_count) {
      bodies.forEach((b) => { b.innerHTML = `<div class="cart-empty"><h2 style="font-size:24px">Your cart is empty</h2><p class="muted">Pick any ${O.tier1Qty} tees and save ${O.tier1Pct}%.</p><a class="btn" href="${url('collections/all')}">Shop tees</a></div>`; });
      foots.forEach((f) => { f.hidden = true; });
      return;
    }
    const lines = cart.items.map((it) => lineHTML(it, offers)).join('');
    bodies.forEach((b) => { b.innerHTML = tierHTML(offers.count, cart) + lines + '<div class="cart-upsell" data-upsell></div>'; });
    // Show Shopify's own totals so the cart always matches the payment page.
    const lineSave = cart.original_total_price - cart.items_subtotal_price;
    let rows = `<div><span>Subtotal (${cart.item_count} item${cart.item_count > 1 ? 's' : ''})</span><span>${money(cart.original_total_price)}</span></div>`;
    if (lineSave > 0) rows += `<div class="save"><span>Bundle Discount</span><span>−${money(lineSave)}</span></div>`;
    const orderSave = cart.items_subtotal_price - cart.total_price;
    if (orderSave > 0) rows += `<div class="save"><span>Cart Discount${tierPct(cart.item_count) ? ` (${tierPct(cart.item_count)}%)` : ''}</span><span>−${money(orderSave)}</span></div>`;
    rows += `<div class="grand"><span>Total</span><span>${money(cart.total_price)}</span></div>`;
    const foot = `<div class="totals">${rows}</div>
      <form action="${url('cart')}" method="post"><button class="btn btn--block" name="checkout" type="submit">Checkout · ${money(cart.total_price)} <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:18px;height:18px"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></form>
      <p class="muted" style="font-size:11.5px;text-align:center;margin-top:8px">Free delivery on online payment · COD +₹${O.codFee || 80}</p>`;
    foots.forEach((f) => { f.innerHTML = foot; f.hidden = false; });
    loadUpsell(cart);
  }
  async function refreshCart() { try { renderCart(await getCart()); } catch (e) { /* offline */ } }

  async function changeLine(key, quantity) {
    const lineEl = $$(`[data-key="${CSS.escape(key)}"]`);
    lineEl.forEach((l) => { l.style.opacity = '.5'; });
    const r = await fetch(url('cart/change.js'), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ id: key, quantity }) });
    const cart = await r.json();
    if (!r.ok) { toast(cart.description || 'Could not update the bag'); refreshCart(); return; }
    cartCache = cart; renderCart(cart);
  }
  document.addEventListener('click', (e) => {
    const line = e.target.closest('[data-key]'); if (!line) return;
    const key = line.dataset.key;
    if (e.target.closest('[data-remove]')) changeLine(key, 0);
    const step = e.target.closest('[data-qty-step]');
    if (step) { const inp = line.querySelector('[data-line-qty]'); changeLine(key, Math.max(0, Number(inp.value) + Number(step.dataset.qtyStep))); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-line-qty]')) changeLine(e.target.closest('[data-key]').dataset.key, Math.max(0, parseInt(e.target.value, 10) || 0));
  });

  async function addToCart(id, quantity, btn) {
    btn && btn.classList.add('is-loading');
    try {
      const r = await fetch(url('cart/add.js'), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items: [{ id: Number(id), quantity: Number(quantity) || 1 }] }) });
      const data = await r.json();
      if (!r.ok) { toast(data.description || data.message || 'Could not add to bag'); return false; }
      const cart = await getCart();
      renderCart(cart);
      return true;
    } finally { btn && btn.classList.remove('is-loading'); }
  }

  let upsellFor = null;
  async function loadUpsell(cart) {
    const holders = $$('[data-upsell]'); if (!holders.length || !cart.items.length) return;
    const pid = cart.items[0].product_id;
    try {
      const inCart = new Set(cart.items.map((i) => i.product_id));
      const r = await fetch(url(`recommendations/products.json?product_id=${pid}&limit=4`));
      const data = await r.json();
      const list = (data.products || []).filter((p) => !inCart.has(p.id)).slice(0, 2);
      if (!list.length) return;
      upsellFor = pid;
      const html = `<h3>Complete the bundle</h3>` + list.map((p) => `<div class="mini"><img src="${esc(p.featured_image)}${String(p.featured_image).includes('?') ? '&' : '?'}width=120" alt="" loading="lazy"><div><div style="font-size:13px;font-weight:500">${esc(p.title)}</div><div class="muted tabular" style="font-size:12px">${money(p.price)}</div></div><button type="button" class="btn btn--sm" data-quick-add="${esc(p.handle)}">Add</button></div>`).join('');
      $$('[data-upsell]').forEach((h) => { h.innerHTML = html; });
    } catch (e) { /* ignore */ }
    void upsellFor;
  }

  /* ---------- quick add sheet ---------- */
  const productCache = {};
  async function fetchProduct(handle) {
    if (productCache[handle]) return productCache[handle];
    const r = await fetch(url(`products/${handle}.js`));
    if (!r.ok) throw new Error('not found');
    return (productCache[handle] = await r.json());
  }
  function sizedImg(src, w) { if (!src) return ''; const s = src.startsWith('//') ? 'https:' + src : src; return s + (s.includes('?') ? '&' : '?') + 'width=' + w; }

  let qaEl = null;
  async function openQuickAdd(handle) {
    let p;
    try { p = await fetchProduct(handle); } catch (e) { window.location = url(`products/${handle}`); return; }
    if (!qaEl) {
      qaEl = document.createElement('div');
      qaEl.className = 'modal'; qaEl.id = 'QuickAdd'; qaEl.hidden = true;
      qaEl.setAttribute('role', 'dialog'); qaEl.setAttribute('aria-modal', 'true'); qaEl.setAttribute('aria-label', 'Quick add');
      document.body.appendChild(qaEl);
    }
    const sel = (p.variants.find((v) => v.available) || p.variants[0]).options.slice();
    const render = () => {
      const v = p.variants.find((x) => x.options.every((o, i) => o === sel[i])) || null;
      const img = (v && v.featured_image && v.featured_image.src) || p.featured_image;
      const opts = p.options.map((o, i) => {
        if (o.name === 'Title') return '';
        const btns = o.values.map((val) => {
          const test = sel.slice(); test[i] = val;
          const avail = p.variants.some((x) => x.available && x.options.every((oo, j) => oo === test[j]));
          const active = sel[i] === val;
          return isColorName(o.name)
            ? `<button type="button" class="color-btn ${active ? 'is-active' : ''} ${avail ? '' : 'is-out'}" data-qa-opt="${i}" data-value="${esc(val)}" title="${esc(val)}" aria-label="${esc(val)}" style="background:${hex(val)}"></button>`
            : `<button type="button" class="size-btn ${active ? 'is-active' : ''} ${avail ? '' : 'is-out'}" data-qa-opt="${i}" data-value="${esc(val)}">${esc(val)}</button>`;
        }).join('');
        return `<div class="opt"><div class="opt__label"><span><b>${esc(o.name)}</b> · ${esc(sel[i])}</span></div><div class="${isColorName(o.name) ? 'colors' : 'sizes'}">${btns}</div></div>`;
      }).join('');
      const qty = Number(qaEl.dataset.qty || 1);
      const price = v ? v.price : p.price;
      const bundles = [1, 2, 3].map((q) => { const pct = bundlePct(q); const full = price * q; return `<button type="button" class="pill ${q === qty ? 'is-active' : ''}" data-qa-qty="${q}">${q} pc · ${money(Math.round(full * (100 - pct) / 100))}${pct ? ` <small>(extra ${pct}% off)</small>` : ''}</button>`; }).join('');
      qaEl.innerHTML = `<div class="scrim" data-close-modal></div><div class="modal__panel" style="display:grid;gap:16px">
        <div style="display:grid;grid-template-columns:96px 1fr auto;gap:14px;align-items:start">
          <img src="${esc(sizedImg(img, 240))}" alt="" style="width:96px;aspect-ratio:4/5;object-fit:cover;border-radius:10px">
          <div style="display:grid;gap:4px"><span class="card__meta">${esc(p.type || '')}</span><b style="font:600 18px/1.25 var(--font-display)">${esc(p.title)}</b>
            <div class="price"><span class="price__now">${money(price)}</span>${v && v.compare_at_price > v.price ? `<s class="price__was">${money(v.compare_at_price)}</s>` : ''}</div></div>
          <button class="icon-btn" data-close-modal aria-label="Close"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        </div>
        ${opts}
        <div class="opt"><div class="opt__label"><b>Bundle &amp; save</b></div><div class="pills" style="flex-wrap:wrap">${bundles}</div></div>
        <button type="button" class="btn btn--block" data-qa-add ${v && v.available ? '' : 'disabled'}>${v && v.available ? 'Add to Cart' : 'Sold out'}</button>
        <a href="${esc(p.url)}" class="remove" style="text-align:center">View full details</a></div>`;
      qaEl.dataset.variant = v ? v.id : '';
    };
    qaEl.dataset.qty = 1;
    render();
    qaEl.onclick = async (e) => {
      const o = e.target.closest('[data-qa-opt]');
      if (o) { sel[Number(o.dataset.qaOpt)] = o.dataset.value; render(); return; }
      const q = e.target.closest('[data-qa-qty]');
      if (q) { qaEl.dataset.qty = q.dataset.qaQty; render(); return; }
      const add = e.target.closest('[data-qa-add]');
      if (add && qaEl.dataset.variant) {
        const ok = await addToCart(qaEl.dataset.variant, qaEl.dataset.qty, add);
        if (ok) { closePanel(); openPanel($('#CartDrawer')); }
      }
    };
    openPanel(qaEl);
  }
  document.addEventListener('click', (e) => {
    const q = e.target.closest('[data-quick-add]');
    if (q) { e.preventDefault(); openQuickAdd(q.dataset.quickAdd); }
  });

  /* ---------- wishlist ---------- */
  const WKEY = 'zeyov:wishlist';
  const getWish = () => store.get(WKEY, []);
  function syncHearts() {
    const w = getWish();
    $$('[data-wish]').forEach((b) => { const on = w.includes(b.dataset.wish); b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on); });
    $$('[data-wish-count]').forEach((c) => { c.textContent = w.length || ''; c.dataset.count = w.length; });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-wish]'); if (!b) return;
    e.preventDefault();
    const h = b.dataset.wish; let w = getWish();
    if (w.includes(h)) { w = w.filter((x) => x !== h); toast('Removed from wishlist'); }
    else { w.unshift(h); toast('Saved to wishlist'); b.classList.add('pop'); setTimeout(() => b.classList.remove('pop'), 400); }
    store.set(WKEY, w.slice(0, 60)); syncHearts();
    if ($('[data-wishlist-grid]') && !w.includes(h)) renderWishlist();
  });
  function cardFromJSON(p) {
    const img = p.images[0]; const img2 = p.images[1];
    const off = p.compare_at_price > p.price ? Math.round((p.compare_at_price - p.price) * 100 / p.compare_at_price) : 0;
    const colorOpt = p.options.find((o) => isColorName(o.name));
    const dots = colorOpt && colorOpt.values.length > 1 ? `<div class="swatches">${colorOpt.values.slice(0, 6).map((v) => `<span class="swatch-dot" title="${esc(v)}" style="background:${hex(v)}"></span>`).join('')}</div>` : '';
    return `<article class="card" data-handle="${esc(p.handle)}"><div class="card__media"><a href="${esc(p.url)}" aria-label="${esc(p.title)}">${img ? `<img src="${esc(sizedImg(img, 600))}" alt="${esc(p.title)}" loading="lazy">` : ''}${img2 ? `<img class="alt" src="${esc(sizedImg(img2, 600))}" alt="" loading="lazy">` : ''}</a>
      <div class="card__badges">${off ? `<span class="badge badge--sale">-${off}%</span>` : ''}</div>
      <button type="button" class="heart is-active" data-wish="${esc(p.handle)}" aria-label="Remove from wishlist" aria-pressed="true"><svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.4-7.5-10.1A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.6C19.5 15.6 12 20 12 20z"/></svg></button>
      ${p.available ? `<div class="card__quick"><button type="button" class="btn btn--sm" data-quick-add="${esc(p.handle)}">Quick add</button></div><button type="button" class="card__plus" data-quick-add="${esc(p.handle)}" aria-label="Quick add">+</button>` : ''}</div>
      <div class="card__info">${p.type ? `<span class="card__meta">${esc(p.type)}</span>` : ''}<a class="card__title" href="${esc(p.url)}">${esc(p.title)}</a>
      <div class="price"><span class="price__now">${money(p.price)}</span>${off ? `<s class="price__was">${money(p.compare_at_price)}</s><span class="price__off">${off}% off</span>` : ''}</div>${dots}</div></article>`;
  }
  async function renderWishlist() {
    const grid = $('[data-wishlist-grid]'); if (!grid) return;
    const w = getWish(); const empty = $('[data-wishlist-empty]');
    if (!w.length) { grid.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;
    const res = await Promise.all(w.map((h) => fetchProduct(h).catch(() => null)));
    grid.innerHTML = res.filter(Boolean).map(cardFromJSON).join('');
  }

  /* ---------- product page ---------- */
  function initProduct(rootEl) {
    const json = rootEl.querySelector('[data-product-json]'); if (!json) return;
    const p = JSON.parse(json.textContent);
    const form = rootEl.querySelector('[data-product-form]');
    const idInput = rootEl.querySelector('[data-variant-id]');
    const qtyInput = rootEl.querySelector('[data-qty]');
    const atc = rootEl.querySelector('[data-atc]');
    const buyNow = rootEl.querySelector('[data-buy-now]');
    const track = rootEl.querySelector('[data-track]');
    const dots = $$('[data-dots] i', rootEl);
    const thumbs = $$('[data-thumb]', rootEl);
    const params = new URLSearchParams(location.search);
    let current = p.variants.find((v) => String(v.id) === params.get('variant')) || p.variants.find((v) => v.available) || p.variants[0];
    const sel = current.options.slice();

    function slideTo(i, smooth = true) { if (track) track.scrollTo({ left: track.clientWidth * i, behavior: smooth ? 'smooth' : 'auto' }); }
    if (track) {
      let raf;
      track.addEventListener('scroll', () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const i = Math.round(track.scrollLeft / track.clientWidth);
          dots.forEach((d, j) => d.classList.toggle('is-active', i === j));
          thumbs.forEach((t, j) => t.classList.toggle('is-active', i === j));
        });
      }, { passive: true });
      thumbs.forEach((t) => t.addEventListener('click', () => slideTo(Number(t.dataset.thumb))));
    }

    function update() {
      current = p.variants.find((v) => v.options.every((o, i) => o === sel[i])) || null;
      $$('[data-opt]', rootEl).forEach((b) => {
        const i = Number(b.dataset.opt); const val = b.dataset.value;
        const active = sel[i] === val;
        b.classList.toggle('is-active', active); b.setAttribute('aria-checked', active);
        const test = sel.slice(); test[i] = val;
        b.classList.toggle('is-out', !p.variants.some((x) => x.available && x.options.every((o, j) => o === test[j])));
      });
      $$('[data-opt-label]', rootEl).forEach((l) => { l.textContent = sel[Number(l.dataset.optLabel)]; });
      const price = current ? current.price : 0;
      const pr = rootEl.querySelector('[data-main-price]');
      if (pr && current) {
        const off = current.compare > current.price ? Math.round((current.compare - current.price) * 100 / current.compare) : 0;
        pr.innerHTML = `<span class="price__now">${money(price)}</span>${off ? `<s class="price__was">${money(current.compare)}</s><span class="save-badge">-${off}%</span>` : ''}`;
      }
      $$('[data-bundles] .brow', rootEl).forEach((b) => {
        const q = Number(b.querySelector('input').value); const pct = Number(b.querySelector('input').dataset.pct);
        const one = b.querySelector('[data-bundle-one]'); if (one) one.textContent = money(price);
        if (pct) b.querySelector('[data-bundle-price]').textContent = money(Math.round(price * q * (100 - pct) / 100));
      });
      const ok = current && current.available;
      if (atc) { atc.disabled = !ok; const t = atc.querySelector('[data-atc-text]') || atc; t.textContent = !current ? 'Unavailable' : ok ? 'Add to Cart' : 'Sold out'; }
      if (buyNow) buyNow.disabled = !ok;
      const sb = rootEl.querySelector('[data-sticky-btn]'); if (sb) { sb.disabled = !ok; sb.textContent = ok ? 'Add to Cart' : 'Sold out'; }
      const sp = rootEl.querySelector('[data-sticky-price]'); if (sp && current) sp.textContent = money(price);
      const sv = rootEl.querySelector('[data-sticky-variant]'); if (sv) sv.textContent = sel.filter((s) => s !== 'Default Title').join(' / ');
      if (current) {
        idInput.value = current.id;
        const u = new URL(location.href); u.searchParams.set('variant', current.id); history.replaceState(null, '', u);
      }
    }
    rootEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-opt]'); if (!b) return;
      const i = Number(b.dataset.opt); sel[i] = b.dataset.value;
      update();
      if (current && current.media && track) {
        const slides = $$('.gallery__slide', track);
        const idx = slides.findIndex((s) => s.dataset.mediaId === String(current.media));
        if (idx > -1) slideTo(idx);
      } else if (String(i) === rootEl.dataset.colorIndex && track) {
        // colour without variant image: try matching image alt text
        const slides = $$('.gallery__slide', track);
        const idx = slides.findIndex((s) => (s.querySelector('img') || {}).alt && s.querySelector('img').alt.toLowerCase().includes(b.dataset.value.toLowerCase()));
        if (idx > -1) slideTo(idx);
      }
    });
    $$('input[name="bundle-qty"]', rootEl).forEach((r) => r.addEventListener('change', () => { qtyInput.value = r.value; }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!current) return toast('Pick a size and colour');
      const ok = await addToCart(current.id, qtyInput.value, atc);
      if (ok) { openPanel($('#CartDrawer')); }
    });
    buyNow && buyNow.addEventListener('click', async () => {
      if (!current) return;
      const ok = await addToCart(current.id, qtyInput.value, buyNow);
      if (ok) location.href = url('checkout');
    });
    const sticky = rootEl.querySelector('[data-sticky-atc]');
    const buy = rootEl.querySelector('[data-buy]');
    if (sticky && buy && 'IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => {
        const show = !en.isIntersecting && en.boundingClientRect.top < 0;
        sticky.classList.toggle('is-visible', show); sticky.setAttribute('aria-hidden', !show);
      }).observe(buy);
      sticky.querySelector('[data-sticky-btn]').addEventListener('click', (e) => { if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true })); void e; });
    }
    update();
    if (current && current.media && track) {
      const idx = $$('.gallery__slide', track).findIndex((s) => s.dataset.mediaId === String(current.media));
      if (idx > 0) slideTo(idx, false);
    }
    // recently viewed for search overlay
    const rv = store.get('zeyov:recent', []).filter((h) => h !== p.handle); rv.unshift(p.handle); store.set('zeyov:recent', rv.slice(0, 8));
  }

  /* ---------- facets (filters + sort) ---------- */
  function initFacets(rootEl) {
    const sectionId = rootEl.dataset.sectionId;
    let ctrl;
    async function load(href, push = true) {
      const results = $('[data-facet-results]', rootEl);
      results && results.classList.add('is-loading');
      ctrl && ctrl.abort(); ctrl = new AbortController();
      try {
        const u = new URL(href, location.origin); u.searchParams.set('section_id', sectionId);
        const html = await (await fetch(u, { signal: ctrl.signal })).text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const swap = (sel) => { const a = $(sel, rootEl); const b = doc.querySelector(sel); if (a && b) a.innerHTML = b.innerHTML; };
        swap('[data-facet-results]'); swap('[data-facet-count]'); swap('#FacetForm'); swap('[data-result-count]');
        const nextClear = doc.querySelector('[data-facet-clear]'); if (nextClear) { const c = $('[data-facet-clear]', rootEl); if (c) c.href = nextClear.getAttribute('href'); }
        if (push) history.pushState({ facets: true }, '', href);
        syncHearts();
      } catch (e) { if (e.name !== 'AbortError') location.href = href; }
      finally { results && results.classList.remove('is-loading'); }
    }
    function formHref() {
      const form = $('#FacetForm', rootEl);
      const fd = new FormData(form); const qs = new URLSearchParams();
      for (const [k, v] of fd.entries()) if (String(v).trim() !== '') qs.append(k, v);
      return form.getAttribute('action') + '?' + qs.toString();
    }
    let t;
    rootEl.addEventListener('change', (e) => {
      if (e.target.matches('[data-sort]')) { const m = $('[data-sort-mirror]', rootEl); if (m) m.value = e.target.value; load(formHref()); return; }
      if (e.target.closest('#FacetForm')) { clearTimeout(t); t = setTimeout(() => load(formHref()), e.target.type === 'number' ? 600 : 50); }
    });
    rootEl.addEventListener('submit', (e) => { if (e.target.id === 'FacetForm') { e.preventDefault(); load(formHref()); } });
    const sortMenu = () => $('[data-sort-menu]', rootEl);
    const toggleSort = (open) => { const m = sortMenu(); const b = $('[data-sort-toggle]', rootEl); if (!m) return; m.hidden = !open; b && b.setAttribute('aria-expanded', open); };
    document.addEventListener('click', (e) => { if (!e.target.closest('[data-sortbox]')) toggleSort(false); });
    rootEl.addEventListener('click', (e) => {
      if (e.target.closest('[data-sort-toggle]')) { toggleSort(sortMenu().hidden); return; }
      const so = e.target.closest('[data-sort-value]');
      if (so) {
        const m = $('[data-sort-mirror]', rootEl); if (m) m.value = so.dataset.sortValue;
        $$('[data-sort-value]', rootEl).forEach((x) => { x.classList.toggle('is-active', x === so); x.setAttribute('aria-selected', x === so); });
        const lbl = $('[data-sort-label]', rootEl); if (lbl) lbl.textContent = so.textContent.trim();
        toggleSort(false); load(formHref()); return;
      }
      const a = e.target.closest('[data-facet-link], [data-facet-clear]');
      if (a && a.getAttribute('href')) { e.preventDefault(); load(a.getAttribute('href')); if (a.matches('[data-facet-clear]')) closePanel(); return; }
      const pr = e.target.closest('[data-price-preset]');
      if (pr) {
        const [min, max] = pr.dataset.pricePreset.split(',');
        const f = $('#FacetForm', rootEl);
        const lo = f.querySelector('input[name$="price.gte"]'); const hi = f.querySelector('input[name$="price.lte"]');
        if (lo) lo.value = min || ''; if (hi) hi.value = max || '';
        load(formHref());
      }
    });
    window.addEventListener('popstate', () => load(location.href, false));
  }

  /* ---------- search (predictive + price terms) ---------- */
  function parsePrice(q) {
    const s = q.toLowerCase().replace(/[₹,]|rs\.?|inr/g, ' ');
    let m;
    if ((m = s.match(/(?:under|below|less than|upto|up to|<)\s*(\d+)/))) return { lte: m[1], rest: s.replace(m[0], '') };
    if ((m = s.match(/(?:above|over|more than|>)\s*(\d+)/))) return { gte: m[1], rest: s.replace(m[0], '') };
    if ((m = s.match(/(\d{3,5})\s*(?:-|to)\s*(\d{3,5})/))) return { gte: m[1], lte: m[2], rest: s.replace(m[0], '') };
    return null;
  }
  function priceHref(q) {
    const p = parsePrice(q); if (!p) return null;
    const rest = p.rest.replace(/\s+/g, ' ').trim();
    const qs = new URLSearchParams();
    if (rest) { qs.set('q', rest); qs.set('type', 'product'); }
    if (p.gte) qs.set('filter.v.price.gte', p.gte);
    if (p.lte) qs.set('filter.v.price.lte', p.lte);
    return (rest ? url('search') : url('collections/all')) + '?' + qs.toString();
  }
  function initSearch() {
    const input = $('#SearchInput'); if (!input) return;
    const out = $('[data-search-results]'); const def = $('[data-search-default]');
    let t; let ctrl;
    async function run(q) {
      q = q.trim();
      if (q.length < 2) { out.innerHTML = ''; def.hidden = false; return; }
      def.hidden = true;
      const ph = priceHref(q);
      ctrl && ctrl.abort(); ctrl = new AbortController();
      let items = [];
      try {
        const term = ph ? (parsePrice(q).rest.trim() || '') : q;
        if (term.length > 1) {
          const r = await fetch(url(`search/suggest.json?q=${encodeURIComponent(term)}&resources[type]=product&resources[limit]=6&resources[options][fields]=title,product_type,variants.title,tag`), { signal: ctrl.signal });
          const d = await r.json(); items = (d.resources && d.resources.results && d.resources.results.products) || [];
        }
      } catch (e) { if (e.name === 'AbortError') return; }
      const priceRow = ph ? `<a class="ps-item" href="${esc(ph)}" style="grid-template-columns:1fr auto;background:var(--surface)"><b>Show tees ${esc(q)}</b><span>→</span></a>` : '';
      const rows = items.map((p) => `<a class="ps-item" href="${esc(p.url)}"><img src="${esc(sizedImg(p.image || p.featured_image && p.featured_image.url, 120))}" alt="" loading="lazy"><span><b>${esc(p.title)}</b><br><span class="muted" style="font-size:12px">${esc(p.type || '')}</span></span><span class="tabular">${money(Math.round(parseFloat(p.price) * 100))}</span></a>`).join('');
      const all = `<a class="btn btn--ghost btn--block" href="${esc(ph || url('search') + '?type=product&q=' + encodeURIComponent(q))}">See all results for “${esc(q)}”</a>`;
      out.innerHTML = `<div class="ps-list">${priceRow}${rows || (ph ? '' : '<p class="muted">No exact matches. Try a colour or fit.</p>')}</div><div style="margin-top:12px">${all}</div>`;
    }
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => run(input.value), 220); });
    input.form.addEventListener('submit', (e) => { const ph = priceHref(input.value); if (ph) { e.preventDefault(); location.href = ph; } });
    document.addEventListener('click', (e) => { const b = e.target.closest('[data-search-term]'); if (b) { input.value = b.dataset.searchTerm; run(input.value); input.focus(); } });
    const pageForm = $('[data-search-page-form]');
    pageForm && pageForm.addEventListener('submit', (e) => { const ph = priceHref(pageForm.q.value); if (ph) { e.preventDefault(); location.href = ph; } });
  }

  /* ---------- reviews ---------- */
  function initReviews() {
    const box = $('[data-reviews]'); if (!box) return;
    const handle = box.dataset.handle; const KEY = 'zeyov:pending-reviews';
    const form = $('#ReviewForm');
    const pend = store.get(KEY, {})[handle];
    const holder = $('[data-pending-review]', box);
    if (pend && holder) {
      holder.innerHTML = `<article class="review" style="background:var(--surface);padding:16px;border-radius:14px;border:0"><div class="review__top"><span class="stars"><span class="stars__row" style="--pct:${pend.rating * 20}%"></span></span><span class="muted">Pending approval</span></div><h4>${esc(pend.title)}</h4><p>${esc(pend.body)}</p><b style="font-size:13px">${esc(pend.name)} (you)</b></article>`;
    }
    form && form.addEventListener('submit', () => {
      const all = store.get(KEY, {});
      all[handle] = { rating: Number((form.querySelector('input[name="contact[Rating]"]:checked') || {}).value || 5), title: form.querySelector('#rv-title').value, body: form.querySelector('#rv-body').value, name: form.querySelector('#rv-name').value };
      store.set(KEY, all);
    });
  }

  /* ---------- recommendations ---------- */
  function initRecs() {
    const el = $('[data-recommendations]'); if (!el || el.children.length) return;
    fetch(el.dataset.url).then((r) => r.text()).then((html) => {
      const d = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-recommendations]');
      if (d) { el.innerHTML = d.innerHTML; syncHearts(); }
    }).catch(() => {});
  }

  /* ---------- share ---------- */
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-share]'); if (!b) return;
    const data = { title: b.dataset.shareTitle, url: b.dataset.share };
    try { if (navigator.share) { await navigator.share(data); return; } await navigator.clipboard.writeText(data.url); toast('Link copied'); } catch (err) { /* cancelled */ }
  });

  /* ---------- hero slideshow ---------- */
  function initHero(el) {
    const tr = $('[data-hero-track]', el); const dots = $$('[data-hero-dots] i', el); if (!tr || dots.length < 2) return;
    let i = 0; let timer;
    const go = (n) => { i = (n + dots.length) % dots.length; tr.scrollTo({ left: tr.clientWidth * i, behavior: 'smooth' }); };
    tr.addEventListener('scroll', () => { const k = Math.round(tr.scrollLeft / tr.clientWidth); i = k; dots.forEach((d, j) => d.classList.toggle('is-active', j === k)); }, { passive: true });
    const play = () => { clearInterval(timer); if (!matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => go(i + 1), 5000); };
    tr.addEventListener('pointerdown', () => clearInterval(timer)); play();
  }

  /* ---------- Zeyov Studio ---------- */
  function initStudio(el) {
    const form = $('[data-studio-form]', el); if (!form) return;
    const json = $('[data-studio-json]', el); const data = json ? JSON.parse(json.textContent) : null;
    const img = $('[data-base-img]', el); const assetBase = img.dataset.assetBase;
    const print = $('[data-print]', el); const ptext = $('[data-print-text]', el);
    const colorList = $('[data-color-list]', el); const colorLabel = $('[data-color-label]', el);
    const fileInput = $('#StudioFile', el); let fileURL = null; let size = 'M'; let color = 'Black';
    const POS = { 'Front Center': [33, 30, 34, 30], 'Back Center': [31, 26, 38, 36], 'Left Chest': [56, 31, 13, 10], 'Sleeve': [14, 34, 11, 8] };
    const slug = (x) => x.toLowerCase().replace(/\s+/g, '-');
    const val = (n) => (form.querySelector(`input[name="${n}"]:checked`) || {}).value;
    function variant() {
      if (!data) return null;
      const pi = data.options.findIndex((o) => /print/i.test(o)); const si = data.options.findIndex((o) => /size/i.test(o));
      return data.variants.find((v) => (pi < 0 || v.options[pi] === val('print')) && (si < 0 || v.options[si] === size)) || data.variants[0];
    }
    function render() {
      const base = form.querySelector('input[name="base"]:checked');
      const colors = base.dataset.colors.split(',');
      if (!colors.includes(color)) color = colors[0];
      colorList.innerHTML = colors.map((c) => `<button type="button" class="color-btn ${c === color ? 'is-active' : ''}" data-studio-color="${esc(c)}" aria-label="${esc(c)}" title="${esc(c)}" style="background:${hex(c)}"></button>`).join('');
      colorLabel.textContent = color;
      img.src = `${assetBase}${base.dataset.handle}-${slug(color)}.webp`;
      const p = POS[val('place')] || POS['Front Center'];
      Object.assign(print.style, { left: p[0] + '%', top: p[1] + '%', width: p[2] + '%', height: p[3] + '%' });
      const txt = $('#StudioText', el).value.trim();
      const tc = $('#StudioTextColor', el).value;
      const small = p[2] < 20;
      print.innerHTML = (fileURL ? `<img src="${fileURL}" alt="Your design">` : '') + (txt || !fileURL ? `<span style="color:${tc};font-size:${small ? 9 : 18}px">${esc(txt || (small ? 'LOGO' : 'YOUR DESIGN'))}</span>` : '');
      print.style.borderStyle = val('print') === 'Embroidery' ? 'dotted' : 'dashed';
      $$('[data-studio-size]', el).forEach((b) => b.classList.toggle('is-active', b.dataset.studioSize === size));
      const v = variant(); const price = v ? v.price : 0;
      const q = Number(val('sqty') || 1);
      $$('[data-sq]', el).forEach((b) => { const n = Number(b.dataset.sq); b.textContent = price ? money(Math.round(price * n * (100 - bundlePct(n)) / 100)) : ''; });
      const sp = $('[data-studio-price]', el); if (sp && price) sp.textContent = money(Math.round(price * q * (100 - bundlePct(q)) / 100));
      void ptext;
    }
    form.addEventListener('change', render);
    $('#StudioText', el).addEventListener('input', render);
    el.addEventListener('click', (e) => {
      const c = e.target.closest('[data-studio-color]'); if (c) { color = c.dataset.studioColor; render(); }
      const s = e.target.closest('[data-studio-size]'); if (s) { size = s.dataset.studioSize; render(); }
    });
    fileInput.addEventListener('change', () => {
      const f = fileInput.files[0]; if (!f) return;
      if (f.size > 20 * 1024 * 1024) { toast('File is over 20 MB'); fileInput.value = ''; return; }
      if (fileURL) URL.revokeObjectURL(fileURL); fileURL = URL.createObjectURL(f);
      $('[data-file-name]', el).textContent = f.name; render();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = variant(); if (!v) return;
      const txt = $('#StudioText', el).value.trim();
      if (!fileInput.files[0] && !txt) { toast('Upload a design or add text'); return; }
      const btn = $('[data-studio-add]', el); btn.classList.add('is-loading');
      const fd = new FormData();
      fd.append('id', v.id); fd.append('quantity', val('sqty') || 1);
      fd.append('properties[Base T-Shirt]', val('base')); fd.append('properties[Colour]', color);
      fd.append('properties[Print Type]', val('print')); fd.append('properties[Placement]', val('place'));
      if (txt) { fd.append('properties[Text]', txt); fd.append('properties[Text colour]', $('#StudioTextColor', el).selectedOptions[0].text); }
      if (fileInput.files[0]) fd.append('properties[Design file]', fileInput.files[0]);
      try {
        const r = await fetch(url('cart/add.js'), { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
        const d = await r.json();
        if (!r.ok) { toast(d.description || 'Could not add to cart'); return; }
        renderCart(await getCart()); openPanel($('#CartDrawer'));
      } finally { btn.classList.remove('is-loading'); }
    });
    render();
  }

  /* ---------- verified reviews from My Orders ---------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-review-open]'); if (!b) return;
    const m = $('#ReviewModal'); if (!m) return;
    $('[data-rv-title]', m).textContent = b.dataset.product;
    $('[data-rv-product]', m).value = b.dataset.product;
    $('[data-rv-handle]', m).value = b.dataset.handle;
    $('[data-rv-order]', m).value = b.dataset.order;
    $('[data-rv-variant]', m).value = b.dataset.variant;
    openPanel(m);
  });
  if (/contact_posted=true/.test(location.search) && $('#OrderReviewForm')) setTimeout(() => toast('Thank you! Your review was sent for approval.'), 400);

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    syncHearts();
    $$('[data-product]').forEach(initProduct);
    $$('[data-facet-root]').forEach(initFacets);
    initSearch(); initReviews(); initRecs(); renderWishlist();
    $$('[data-hero]').forEach(initHero); $$('[data-studio]').forEach(initStudio);
    if ($('[data-cart-page]') || $('#CartDrawer')) refreshCart();
  });
  window.ZeyovTheme = { money, calcOffers, refreshCart, openQuickAdd };
})();
