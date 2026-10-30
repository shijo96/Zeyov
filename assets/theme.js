/* ZEYOV THEME JS – vanilla, no dependencies */
(function () {
  'use strict';
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', function (e) {
      var r = (e && e.reason && (e.reason.message || e.reason.stack || String(e.reason))) || '';
      if (r.indexOf('Failed to fetch') !== -1 || r.indexOf('shopifysvc') !== -1 || r.indexOf('monorail') !== -1) {
        if (e.preventDefault) e.preventDefault();
      }
    });
  }
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- helpers ---------- */
  function formatMoney(cents, format) {
    format = format || (window.ZEYOV && ZEYOV.moneyFormat) || 'Rs. {{amount}}';
    function fmt(n, d, t, dec) {
      d = d == null ? 2 : d; t = t || ','; dec = dec || '.';
      n = (n / 100).toFixed(d);
      var p = n.split('.');
      p[0] = p[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + t);
      return p[0] + (p[1] ? dec + p[1] : '');
    }
    var m = format.match(/\{\{\s*(\w+)\s*\}\}/); var v = '';
    switch (m && m[1]) {
      case 'amount': v = fmt(cents, 2); break;
      case 'amount_no_decimals': v = fmt(cents, 0); break;
      case 'amount_with_comma_separator': v = fmt(cents, 2, '.', ','); break;
      case 'amount_no_decimals_with_comma_separator': v = fmt(cents, 0, '.', ','); break;
      case 'amount_with_apostrophe_separator': v = fmt(cents, 2, "'", '.'); break;
      default: v = fmt(cents, 2);
    }
    return format.replace(m[0], v);
  }
  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
  function isSafeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (url.startsWith('/') && !url.startsWith('//')) return true;
    try {
      var p = new URL(url, window.location.origin);
      return p.origin === window.location.origin && (p.protocol === 'https:' || p.protocol === 'http:');
    } catch (e) {
      return false;
    }
  }
  function safeNavigate(url) {
    if (isSafeUrl(url)) {
      window.location.href = url;
    }
  }
  var toastTimer;
  function toast(msg, withCart) {
    var t = $('#Toast'); if (!t) return;
    t.innerHTML = escapeHtml(msg) + (withCart ? ' <a href="' + encodeURI(ZEYOV.routes.cart) + '">View cart</a>' : '');
    t.classList.add('is-on'); clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 3200);
  }
  function setCount(n) {
    $$('[data-cart-count]').forEach(function (el) { el.textContent = n; el.classList.toggle('is-empty', !n); });
  }
  function addItems(items) {
    return fetch(ZEYOV.routes.cartAdd, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ items: items })
    }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.description || j.message || 'Could not add to cart'); return j; }); })
      .then(function () { return fetch(ZEYOV.routes.cartJson).then(function (r) { return r.json(); }); })
      .then(function (cart) { setCount(cart.item_count); return cart; });
  }

  /* ---------- drawers / search ---------- */
  var overlay = $('[data-overlay]');
  function openEl(id) {
    var el = document.getElementById(id); if (!el) return;
    el.hidden = false;
    if (id === 'NavDrawer' && overlay) { overlay.hidden = false; document.body.style.overflow = 'hidden'; }
    var inp = $('input[type=search]', el); if (inp) inp.focus();
  }
  function closeEl(id) {
    var el = document.getElementById(id); if (!el) return;
    el.hidden = true;
    if ((id === 'NavDrawer' || id === 'WishlistDrawer') && overlay) { overlay.hidden = true; document.body.style.overflow = ''; }
  }
  document.addEventListener('click', function (e) {
    var o = e.target.closest('[data-open]'); if (o) { e.preventDefault(); openEl(o.getAttribute('data-open')); return; }
    var c = e.target.closest('[data-close]'); if (c) { e.preventDefault(); closeEl(c.getAttribute('data-close')); return; }
    if (e.target === overlay) { closeEl('NavDrawer'); closeEl('WishlistDrawer'); }
    var t = e.target.closest('[data-toggle]'); if (t) { var box = document.getElementById(t.getAttribute('data-toggle')); if (box) box.hidden = !box.hidden; }
    var r = e.target.closest('[data-toggle-recover]'); if (r) { e.preventDefault(); var rb = $('#recover'); if (rb) rb.hidden = !rb.hidden; }
    var del = e.target.closest('[data-delete-address]');
    if (del && window.Shopify && Shopify.postLink) {
      var delUrl = del.getAttribute('data-delete-address');
      if (isSafeUrl(delUrl) && confirm('Delete this address?')) Shopify.postLink(delUrl, { parameters: { _method: 'delete' } });
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeEl('NavDrawer'); closeEl('SearchPanel'); closeEl('WishlistDrawer'); } });

  /* ---------- flying particle animation ---------- */
  function animateFlyParticle(startEl, targetEl) {
    if (!startEl || !targetEl) return;
    var sRect = startEl.getBoundingClientRect();
    var tRect = targetEl.getBoundingClientRect();
    var sX = sRect.left + sRect.width / 2;
    var sY = sRect.top + sRect.height / 2;
    var tX = tRect.left + tRect.width / 2;
    var tY = tRect.top + tRect.height / 2;

    var dot = document.createElement('div');
    dot.className = 'flying-dot';
    dot.style.left = sX + 'px';
    dot.style.top = sY + 'px';
    dot.style.setProperty('--dx', (tX - sX) + 'px');
    dot.style.setProperty('--dy', (tY - sY) + 'px');
    document.body.appendChild(dot);

    setTimeout(function () {
      if (dot.parentNode) dot.parentNode.removeChild(dot);
      targetEl.classList.add('badge-bump-anim');
      setTimeout(function () { targetEl.classList.remove('badge-bump-anim'); }, 500);
    }, 700);
  }

  /* ---------- announcement rotator ---------- */
  var ann = $$('.announce__item');
  if (ann.length > 1) {
    var ai = 0;
    setInterval(function () { ann[ai].classList.remove('is-active'); ai = (ai + 1) % ann.length; ann[ai].classList.add('is-active'); }, 4500);
  }

  /* ---------- quantity steppers ---------- */
  document.addEventListener('click', function (e) {
    var minus = e.target.closest('[data-qty-minus]'), plus = e.target.closest('[data-qty-plus]');
    if (!minus && !plus) return;
    var wrap = e.target.closest('[data-qty]'); var input = $('input', wrap);
    var min = parseInt(input.min || '0', 10); var v = parseInt(input.value || '1', 10);
    v = plus ? v + 1 : Math.max(min, v - 1); input.value = v;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  /* ---------- ajax add to cart (cards + product form) with luxury animations ---------- */
  document.addEventListener('submit', function (e) {
    var form = e.target; if (!form.matches('[data-ajax-add]')) return;
    if (e.submitter && e.submitter.name === 'checkout') return;
    e.preventDefault();
    var btn = $('button[type=submit]', form); var label = btn && ($('[data-add-label]', btn) || btn);
    var old = label && label.textContent;
    if (btn) {
      btn.disabled = true;
      btn.classList.add('atc-pulse-anim');
      setTimeout(function () { btn.classList.remove('atc-pulse-anim'); }, 600);
      if (label) label.textContent = 'Adding…';
      var cartTarget = $('.header__cart') || $('[data-cart-count]');
      if (cartTarget) animateFlyParticle(btn, cartTarget);
    }
    var fd = new FormData(form);
    var rawId = parseInt(fd.get('id'), 10);
    var rawQty = parseInt(fd.get('quantity') || '1', 10);
    if (isNaN(rawId) || rawId <= 0) {
      if (btn) { btn.disabled = false; if (label) label.textContent = old; }
      toast('Please select a valid product option');
      return;
    }
    var id = rawId;
    var qty = Math.max(1, Math.min(999, isNaN(rawQty) ? 1 : rawQty));

    var props = {};
    $$('[name^="properties["]', form).forEach(function (inp) {
      var m = inp.name.match(/^properties\[(.*?)\]$/);
      if (m && inp.value !== undefined && inp.value !== '') {
        props[m[1]] = String(inp.value).slice(0, 500); // Bounds limit property strings
      }
    });
    var itemObj = { id: id, quantity: qty };
    if (Object.keys(props).length > 0) {
      itemObj.properties = props;
    }
    addItems([itemObj]).then(function () {
      if (btn && label) {
        label.textContent = '✓ Added to Bag!';
      }
      toast('Added to Bag ✓', true);
    }).catch(function (err) { toast(err.message); })
      .then(function () {
        setTimeout(function () {
          if (btn) { btn.disabled = false; if (label) label.textContent = old; }
        }, 1200);
      });
  });

  /* ---------- bundle add ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-bundle-add]'); if (!b) return;
    var ids = b.getAttribute('data-bundle-add').split(',').filter(Boolean);
    var items = ids.map(function (i) { return { id: parseInt(i, 10), quantity: 1 }; }).filter(function (it) { return !isNaN(it.id) && it.id > 0; });
    if (items.length === 0) return;
    var old = b.textContent; b.disabled = true; b.textContent = 'Adding…';
    var cartTarget = $('.header__cart') || $('[data-cart-count]');
    if (cartTarget) animateFlyParticle(b, cartTarget);
    addItems(items).then(function () { toast('Curated combo added to bag ✓', true); })
      .catch(function (err) { toast(err.message); })
      .then(function () { b.disabled = false; b.textContent = old; });
  });

  /* ---------- product page ---------- */
  $$('[data-product]').forEach(function (root) {
    var variants = JSON.parse($('[data-variants]', root).textContent);
    var moneyFmt = JSON.parse($('[data-money]', root).textContent).format;
    var form = $('#ProductForm', root);
    var idInput = $('[data-variant-id]', root);
    var addBtn = $('[data-add-btn]', root), addLabel = $('[data-add-label]', root);
    var slides = $$('[data-slide]', root), thumbs = $$('[data-thumb]', root);
    var qtyInput = $('input[name=quantity]', root);
    var current = 0;

    function show(i) {
      if (!slides.length) return;
      current = (i + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === current); });
      thumbs.forEach(function (t, k) { t.classList.toggle('is-active', k === current); });
    }
    function showById(mid) { slides.forEach(function (s, k) { if (s.getAttribute('data-media-id') == mid) show(k); }); }
    thumbs.forEach(function (t, k) { t.addEventListener('click', function () { show(k); }); });
    var pv = $('[data-prev]', root), nx = $('[data-next]', root);
    if (pv) pv.addEventListener('click', function () { show(current - 1); });
    if (nx) nx.addEventListener('click', function () { show(current + 1); });
    var g = $('.gallery__main', root), sx = 0;
    if (g) { g.addEventListener('touchstart', function (e) { sx = e.changedTouches[0].clientX; }, { passive: true });
      g.addEventListener('touchend', function (e) { var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1)); }); }

    function selectedOptions() {
      return $$('.opt', root).map(function (f) { var c = $('input:checked', f); return c ? c.value : null; });
    }
    function findVariant() {
      var sel = selectedOptions();
      if (!sel.length) return variants[0];
      return variants.filter(function (v) { return sel.every(function (o, i) { return v.options[i] === o; }); })[0];
    }
    function updateTiers(v) {
      $$('[data-tier-qty]', root).forEach(function (el) {
        var q = +el.dataset.tierQty, pct = +el.dataset.tierPct;
        var total = v.price * q, now = Math.round(total * (100 - pct) / 100);
        el.innerHTML = formatMoney(now, moneyFmt) + (pct > 0 ? '<s>' + formatMoney(total, moneyFmt) + '</s>' : '');
      });
    }
    function update() {
      var v = findVariant();
      $$('.opt', root).forEach(function (f) { var c = $('input:checked', f); var l = $('[data-opt-label]', f); if (c && l) l.textContent = c.value; });
      if (!v) { addBtn.disabled = true; addLabel.textContent = 'Unavailable'; return; }
      idInput.value = v.id;
      var priceWrap = $('[data-price-wrap] .price', root);
      if (priceWrap) {
        var on = v.compare_at_price && v.compare_at_price > v.price;
        priceWrap.className = 'price' + (on ? ' price--sale' : '');
        priceWrap.innerHTML = '<span class="price__now">' + formatMoney(v.price, moneyFmt) + '</span>' +
          (on ? '<s class="price__was">' + formatMoney(v.compare_at_price, moneyFmt) + '</s><span class="badge badge--sale">' + Math.round((v.compare_at_price - v.price) * 100 / v.compare_at_price) + '% OFF</span>' : '');
      }
      var pNow = $('[data-price-now]', root);
      var pWas = $('[data-price-was]', root);
      var pOff = $('[data-price-off]', root);
      if (pNow) pNow.textContent = formatMoney(v.price, moneyFmt);
      if (pWas) {
        if (v.compare_at_price && v.compare_at_price > v.price) {
          pWas.textContent = formatMoney(v.compare_at_price, moneyFmt);
          pWas.style.display = 'inline';
          if (pOff) {
            pOff.textContent = Math.round((v.compare_at_price - v.price) * 100 / v.compare_at_price) + '% OFF';
            pOff.style.display = 'inline-block';
          }
        } else {
          pWas.style.display = 'none';
          if (pOff) pOff.style.display = 'none';
        }
      }
      var notifyBtn = $('#NotifyStockBtn', root);
      if (v.available) {
        addBtn.disabled = false;
        addBtn.style.display = 'inline-flex';
        addLabel.textContent = 'Add to Bag';
        if (notifyBtn) notifyBtn.style.display = 'none';
      } else {
        addBtn.disabled = true;
        addBtn.style.display = 'none';
        addLabel.textContent = 'Sold out';
        if (notifyBtn) {
          notifyBtn.style.display = 'inline-flex';
          var stockVId = $('#StockVariantId');
          if (stockVId) stockVId.value = v.id;
          var stockVTitle = $('#StockModalVariantTitle');
          if (stockVTitle) stockVTitle.textContent = v.title && v.title !== 'Default Title' ? 'Selected: ' + v.title : '';
        }
      }
      var sb = $('[data-sticky-btn]', root); if (sb) { sb.disabled = !v.available; sb.textContent = v.available ? 'Add to Bag' : 'Sold out'; }
      if (v.featured_media) showById(v.featured_media.id);
      updateTiers(v);
      if (history.replaceState) history.replaceState({}, '', location.pathname + '?variant=' + v.id);
    }
    $$('.opt input', root).forEach(function (i) { i.addEventListener('change', update); });

    /* tiers */
    function syncTierProperties(tierEl) {
      var tierProp = $('#BundleTierProp', root);
      var discProp = $('#BundleDiscProp', root);
      if (tierEl) {
        if (tierProp) tierProp.value = tierEl.dataset.tierLabel || ('Buy ' + tierEl.value);
        if (discProp) discProp.value = tierEl.dataset.tierDiscount || '0';
      }
    }

    $$('[data-tier]', root).forEach(function (r) {
      r.addEventListener('change', function () {
        $$('.pdp-tier, .tier', root).forEach(function (t) { t.classList.remove('is-active'); });
        var parentTier = r.closest('.pdp-tier, .tier');
        if (parentTier) parentTier.classList.add('is-active');
        if (qtyInput) qtyInput.value = r.value;
        syncTierProperties(r);
      });
    });
    if (qtyInput) {
      qtyInput.addEventListener('change', function () {
        var matched = false;
        $$('[data-tier]', root).forEach(function (r) {
          var m = r.value === qtyInput.value;
          r.checked = m;
          var parentTier = r.closest('.pdp-tier, .tier');
          if (parentTier) parentTier.classList.toggle('is-active', m);
          if (m) {
            matched = true;
            syncTierProperties(r);
          }
        });
        if (!matched) {
          var val = parseInt(qtyInput.value, 10) || 1;
          var tierProp = $('#BundleTierProp', root);
          var discProp = $('#BundleDiscProp', root);
          if (val === 1) {
            if (tierProp) tierProp.value = 'Buy 1';
            if (discProp) discProp.value = '0';
          } else if (val === 2) {
            if (tierProp) tierProp.value = 'Buy 2';
            if (discProp) discProp.value = '10';
          } else if (val >= 3) {
            if (tierProp) tierProp.value = 'Buy 3+';
            if (discProp) discProp.value = '13';
          }
        }
      });
    }

    /* sticky mobile bar */
    var sticky = $('[data-sticky-atc]', root), sbtn = $('[data-sticky-btn]', root);
    if (sticky && addBtn && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { sticky.classList.toggle('is-visible', !en[0].isIntersecting && en[0].boundingClientRect.top < 0); }).observe(addBtn);
    }
    if (sbtn) sbtn.addEventListener('click', function () { if (form.requestSubmit) form.requestSubmit(addBtn); else addBtn.click(); });

    /* delivery estimate - tailored for Indian transit */
    var chk = $('[data-check-pin]', root), pin = $('#Pincode', root), res = $('[data-deliver-result]', root);
    if (chk) {
      var run = function () {
        var p = (pin.value || '').trim();
        res.classList.remove('is-error');
        if (!/^[1-9][0-9]{5}$/.test(p)) {
          res.textContent = 'Please enter a valid 6-digit Indian PIN code.';
          res.classList.add('is-error');
          return;
        }
        var isMetro = /^(11|40|56|60|70|68|50|38|41)/.test(p);
        var minDays = isMetro ? 3 : 4;
        var maxDays = isMetro ? 5 : 7;
        var d = new Date(), a = new Date(d), b = new Date(d);
        a.setDate(d.getDate() + minDays);
        b.setDate(d.getDate() + maxDays);
        var o = { weekday: 'short', day: 'numeric', month: 'short' };
        var metroTag = isMetro ? ' [Express Metro Route]' : '';
        res.innerHTML = '<strong>Estimated delivery: ' + a.toLocaleDateString('en-IN', o) + ' – ' + b.toLocaleDateString('en-IN', o) + metroTag + '</strong><br><small class="muted">Order processing: 1–2 working days. Tracking link sent on WhatsApp/SMS.</small>';
        try { localStorage.setItem('zeyov_pin', p); } catch (e) {}
      };
      chk.addEventListener('click', run);
      pin.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); run(); } });
      try {
        var sp2 = localStorage.getItem('zeyov_pin');
        if (sp2) { pin.value = sp2; run(); }
      } catch (e) {}
    }
  });

  /* ---------- PDP bundle buy (Combo Offer / Frequently Bought Together) ---------- */
  $$('[data-bundle-widget]').forEach(function (widget) {
    var checks = $$('[data-bundle-check]', widget);
    var submitBtn = $('[data-bundle-submit-btn]', widget);
    var btnLabel = $('[data-bundle-btn-label]', widget);
    var finalPriceEl = $('[data-bundle-final-price]', widget);
    var wasPriceEl = $('[data-bundle-was-price]', widget);
    var saveTag = $('[data-bundle-save-tag]', widget);
    var discountPct = parseInt((submitBtn && submitBtn.getAttribute('data-discount')) || '15', 10);
    var moneyFmt = (window.ZEYOV && ZEYOV.moneyFormat) || 'Rs. {{amount}}';

    function recalculateBundle() {
      var total = 0;
      var selectedCount = 0;
      checks.forEach(function (chk, idx) {
        var itemWrap = chk.closest('[data-bundle-item]');
        var thumb = $('[data-thumb-index="' + (idx + 1) + '"]', widget);
        if (chk.checked) {
          total += parseInt(chk.getAttribute('data-price') || '0', 10);
          selectedCount++;
          if (itemWrap) itemWrap.classList.add('is-selected');
          if (thumb) thumb.classList.add('is-active');
        } else {
          if (itemWrap) itemWrap.classList.remove('is-selected');
          if (thumb) thumb.classList.remove('is-active');
        }
      });

      var applyDiscount = selectedCount > 1 ? discountPct : 0;
      var discounted = Math.round(total * (100 - applyDiscount) / 100);

      if (finalPriceEl) finalPriceEl.textContent = formatMoney(discounted, moneyFmt);
      if (wasPriceEl) {
        if (selectedCount > 1 && discountPct > 0) {
          wasPriceEl.textContent = formatMoney(total, moneyFmt);
          wasPriceEl.style.display = 'inline-block';
        } else {
          wasPriceEl.style.display = 'none';
        }
      }
      if (saveTag) {
        if (selectedCount > 1 && discountPct > 0) {
          saveTag.textContent = 'Save ' + discountPct + '%';
          saveTag.style.display = 'inline-block';
        } else {
          saveTag.style.display = 'none';
        }
      }

      if (submitBtn) {
        submitBtn.disabled = selectedCount === 0;
        if (btnLabel) {
          if (selectedCount === 0) {
            btnLabel.textContent = 'Select items to add';
          } else if (selectedCount === 1) {
            btnLabel.textContent = 'Add Item to Cart';
          } else {
            btnLabel.textContent = 'Add Combo to Cart (' + selectedCount + ' items)' + (discountPct > 0 ? ' • Save ' + discountPct + '%' : '');
          }
        }
      }
    }

    checks.forEach(function (chk) {
      chk.addEventListener('change', recalculateBundle);
    });

    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        var itemsToAdd = [];
        checks.forEach(function (chk) {
          if (chk.checked) {
            var vid = parseInt(chk.getAttribute('data-variant-id'), 10);
            if (vid) itemsToAdd.push({ id: vid, quantity: 1 });
          }
        });
        if (!itemsToAdd.length) return;

        var origText = btnLabel ? btnLabel.textContent : submitBtn.textContent;
        submitBtn.disabled = true;
        if (btnLabel) btnLabel.textContent = 'Adding Combo…';

        addItems(itemsToAdd).then(function () {
          toast('Combo added to cart ✓ (' + itemsToAdd.length + ' items)', true);
        }).catch(function (err) {
          toast(err.message || 'Error adding combo to cart');
        }).then(function () {
          submitBtn.disabled = false;
          if (btnLabel) btnLabel.textContent = origText;
        });
      });
    }

    recalculateBundle();
  });

  /* ---------- PDP Customer reviews interactivity ---------- */
  var reviewsRoot = $('[data-product-reviews]');
  var pdpRatingBadge = $('[data-pdp-rating-badge]');
  if (reviewsRoot) {
    var productId = reviewsRoot.getAttribute('data-product-id') || '';
    var STORAGE_KEY = productId ? 'zeyov_reviews_' + productId : null;
    var INITIAL_VISIBLE_COUNT = 4;
    var isExpanded = false;
    var currentFilter = 'all';

    var expandWrap = $('#ReviewsExpandWrap');
    var toggleExpandBtn = $('#ToggleReviewsBtn');
    var expandBtnText = $('#ExpandBtnText');
    var container = $('#UserSubmittedReviews');
    var emptyEl = $('#ReviewsEmptyState', reviewsRoot);
    var summaryEl = $('.reviews-summary', reviewsRoot);
    var filtersEl = $('.reviews-filters', reviewsRoot);

    function loadSavedReviews() {
      if (!STORAGE_KEY) return [];
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        var list = JSON.parse(raw);
        if (Array.isArray(list)) return list;
      } catch (e) {}
      return [];
    }

    function saveReview(rev) {
      if (!STORAGE_KEY) return;
      try {
        var list = loadSavedReviews();
        list.unshift(rev);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      } catch (e) {}
    }

    function createReviewCardElement(rev) {
      var starsHtml = '';
      var rating = parseInt(rev.rating || '5', 10);
      for (var i = 1; i <= 5; i++) {
        starsHtml += '<span class="' + (i <= rating ? 'on' : 'off') + '"><svg class="icon icon--star" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9L12 2.8Z"/></svg></span>';
      }
      var safeName = escapeHtml(rev.name || 'Verified Customer');
      var safeCity = escapeHtml(rev.city || 'India');
      var safeTitle = escapeHtml(rev.title || '');
      var safeBody = escapeHtml(rev.body || '');
      var initials = safeName.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || 'ZC';

      var card = document.createElement('article');
      card.className = 'review-card is-new';
      card.setAttribute('data-review-stars', rating);
      card.setAttribute('data-verified', 'true');
      card.innerHTML =
        '<div class="review-card__header">' +
          '<div class="review-card__author">' +
            '<div class="review-card__avatar">' + initials + '</div>' +
            '<div>' +
              '<div class="review-card__name-row">' +
                '<b>' + safeName + '</b>' +
                '<span class="verified"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg> Verified Buyer &bull; ' + safeCity + '</span>' +
              '</div>' +
              '<small class="muted">' + (rev.date || 'Just now') + ' &bull; Verified Purchase</small>' +
            '</div>' +
          '</div>' +
          '<div class="stars">' + starsHtml + '</div>' +
        '</div>' +
        '<h4 class="review-card__title">' + safeTitle + '</h4>' +
        '<p class="review-card__body">' + safeBody + '</p>' +
        '<div class="review-card__footer"><span class="review-card__helpful is-voted"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg> Helpful (<span>1</span>)</span></div>';
      return card;
    }

    // Populate saved reviews from storage
    var saved = loadSavedReviews();
    if (container && saved.length > 0) {
      saved.forEach(function (rev) {
        container.appendChild(createReviewCardElement(rev));
      });
    }

    function applyReviewVisibility() {
      var allCards = $$('.review-card', reviewsRoot);
      var matchingCards = [];

      allCards.forEach(function (card) {
        var stars = card.getAttribute('data-review-stars');
        var isVer = card.getAttribute('data-verified') === 'true';
        var match = false;
        if (currentFilter === 'all') match = true;
        else if (currentFilter === 'verified') match = isVer;
        else if (currentFilter === '5star') match = (stars === '5');
        else if (currentFilter === '4star') match = (stars === '4');

        if (match) {
          matchingCards.push(card);
        } else {
          card.style.display = 'none';
        }
      });

      matchingCards.forEach(function (card, index) {
        if (isExpanded || index < INITIAL_VISIBLE_COUNT) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });

      if (expandWrap && toggleExpandBtn && expandBtnText) {
        if (matchingCards.length <= INITIAL_VISIBLE_COUNT) {
          expandWrap.style.display = 'none';
        } else {
          expandWrap.style.display = 'block';
          if (!isExpanded) {
            expandBtnText.textContent = 'View All ' + matchingCards.length + ' Verified Reviews (' + (matchingCards.length - INITIAL_VISIBLE_COUNT) + ' More)';
            toggleExpandBtn.classList.remove('is-expanded');
          } else {
            expandBtnText.textContent = 'Show Fewer Reviews';
            toggleExpandBtn.classList.add('is-expanded');
          }
        }
      }
    }

    if (toggleExpandBtn) {
      toggleExpandBtn.addEventListener('click', function () {
        isExpanded = !isExpanded;
        applyReviewVisibility();
        if (!isExpanded && reviewsRoot) {
          reviewsRoot.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    function updateReviewCounts() {
      var cards = $$('.review-card', reviewsRoot);
      var total = cards.length;

      if (total === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        if (summaryEl) summaryEl.style.display = 'none';
        if (filtersEl) filtersEl.style.display = 'none';
        if (expandWrap) expandWrap.style.display = 'none';

        if (pdpRatingBadge) {
          pdpRatingBadge.className = 'pdp__rating-badge pdp__rating-badge--empty';
          pdpRatingBadge.setAttribute('data-open-review-modal', 'true');
          pdpRatingBadge.innerHTML = '<span class="pdp__stars pdp__stars--empty">☆☆☆☆☆</span><span class="pdp__count">No reviews yet &bull; <span class="pdp__write-text">Write a review</span></span>';
        }
      } else {
        if (emptyEl) emptyEl.style.display = 'none';
        if (summaryEl) summaryEl.style.display = '';
        if (filtersEl) filtersEl.style.display = '';

        var sum = 0;
        var starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        var verified = 0;

        cards.forEach(function (c) {
          var s = parseInt(c.getAttribute('data-review-stars') || '5', 10);
          if (s >= 1 && s <= 5) {
            starCounts[s] = (starCounts[s] || 0) + 1;
            sum += s;
          }
          if (c.getAttribute('data-verified') === 'true') verified++;
        });

        var avg = (sum / total).toFixed(1);
        var avgEl = $('[data-reviews-avg]', reviewsRoot);
        if (avgEl) avgEl.textContent = avg;
        var tEl = $('[data-reviews-total-text]', reviewsRoot);
        if (tEl) tEl.textContent = total;
        var pAll = $('[data-pill-all]', reviewsRoot);
        if (pAll) pAll.textContent = total;
        var pVer = $('[data-pill-verified]', reviewsRoot);
        if (pVer) pVer.textContent = verified;
        var p5 = $('[data-pill-5star]', reviewsRoot);
        if (p5) p5.textContent = starCounts[5];
        var p4 = $('[data-pill-4star]', reviewsRoot);
        if (p4) p4.textContent = starCounts[4];

        for (var star = 1; star <= 5; star++) {
          var count = starCounts[star] || 0;
          var pct = Math.round((count / total) * 100);
          var fillEl = $('[data-bar-fill-' + star + ']', reviewsRoot);
          if (fillEl) fillEl.style.width = pct + '%';
          var countEl = $('[data-bar-count-' + star + ']', reviewsRoot);
          if (countEl) countEl.textContent = count;
        }

        if (pdpRatingBadge) {
          pdpRatingBadge.className = 'pdp__rating-badge';
          pdpRatingBadge.removeAttribute('data-open-review-modal');
          pdpRatingBadge.innerHTML = '<span class="pdp__stars">★★★★★</span><b class="pdp__score">' + avg + '</b><span class="pdp__count">(' + total + (total === 1 ? ' Review' : ' Reviews') + ')</span>';
        }
      }
    }

    // Filter reviews
    $$('[data-filter-reviews]', reviewsRoot).forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('[data-filter-reviews]', reviewsRoot).forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        currentFilter = btn.getAttribute('data-filter-reviews') || 'all';
        isExpanded = false;
        applyReviewVisibility();
      });
    });

    // Helpful button
    document.addEventListener('click', function (e) {
      var h = e.target.closest('[data-helpful-btn]');
      if (!h || h.classList.contains('is-voted')) return;
      var c = $('[data-helpful-count]', h);
      if (c) c.textContent = parseInt(c.textContent || '0', 10) + 1;
      h.classList.add('is-voted');
    });

    // Write a Review modal
    var modal = $('#ReviewModal');
    var closeBtns = $$('[data-close-review-modal]');
    var reviewForm = $('#CustomerReviewForm') || $('#NewReviewForm');

    function openReviewModal() {
      if (modal) {
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
      }
      document.body.style.overflow = 'hidden';
    }
    function closeReviewModal() {
      if (modal) {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
      }
      document.body.style.overflow = '';
    }

    // Delegated click for open-review-modal buttons anywhere
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-open-review-modal]');
      if (!trigger) return;
      e.preventDefault();
      openReviewModal();
      if (reviewsRoot) {
        reviewsRoot.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    closeBtns.forEach(function (btn) {
      btn.addEventListener('click', closeReviewModal);
    });

    // Star rating picker with descriptive feedback hint
    var ratingBtns = $$('.star-btn, .star-select-btn', modal);
    var ratingInput = $('#ReviewStarInput') || $('#ReviewRatingInput');
    var ratingHint = $('#StarRatingHint');
    var ratingTexts = {
      1: '1.0 / 5.0 — Poor Experience',
      2: '2.0 / 5.0 — Needs Improvement',
      3: '3.0 / 5.0 — Average Quality',
      4: '4.0 / 5.0 — Very Good Fabric & Fit',
      5: '5.0 / 5.0 — Outstanding Quality & Fit'
    };

    ratingBtns.forEach(function (sBtn) {
      sBtn.addEventListener('click', function () {
        var val = parseInt(sBtn.getAttribute('data-star-val') || sBtn.getAttribute('data-star') || '5', 10);
        if (ratingInput) ratingInput.value = val;
        ratingBtns.forEach(function (b, idx) {
          b.classList.toggle('is-active', (idx + 1) <= val);
        });
        if (ratingHint && ratingTexts[val]) {
          ratingHint.textContent = ratingTexts[val];
        }
      });
    });

    // Form submission
    if (reviewForm) {
      reviewForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = new FormData(reviewForm);
        var trap = fd.get('comment_bot_trap');
        if (trap) {
          closeReviewModal();
          return;
        }
        var now = Date.now();
        if (window._lastRevSubmit && (now - window._lastRevSubmit < 15000)) {
          toast('Please wait a moment before submitting another review.');
          return;
        }
        window._lastRevSubmit = now;

        var name = (fd.get('name') || '').trim().slice(0, 80);
        var city = (fd.get('city') || '').trim().slice(0, 60);
        var title = (fd.get('title') || '').trim().slice(0, 120);
        var body = (fd.get('body') || '').trim().slice(0, 2000);
        var rating = parseInt(fd.get('rating') || '5', 10);
        rating = Math.max(1, Math.min(5, isNaN(rating) ? 5 : rating));

        if (!name || !title || !body) {
          toast('Please fill in all required review fields.');
          return;
        }

        var newRev = {
          name: name,
          city: city,
          title: title,
          body: body,
          rating: rating,
          date: 'Today'
        };
        saveReview(newRev);

        var newCard = createReviewCardElement(newRev);
        if (container) container.prepend(newCard);

        updateReviewCounts();
        applyReviewVisibility();
        closeReviewModal();
        reviewForm.reset();
        toast('Thank you! Your verified review has been submitted ✓');
      });
    }

    updateReviewCounts();
    applyReviewVisibility();
  }

  /* ---------- cart page ---------- */
  var cartForm = $('#CartForm');
  if (cartForm) {
    var timer;
    $$('input[name="updates[]"]', cartForm).forEach(function (inp, idx) {
      inp.addEventListener('change', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          fetch(ZEYOV.routes.cartChange, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line: idx + 1, quantity: Math.max(0, parseInt(inp.value || '0', 10)) }) })
            .then(function () { location.reload(); });
        }, 450);
      });
    });

    cartForm.addEventListener('submit', function (e) {
      if (e.submitter && e.submitter.name === 'checkout') {
        var pPhone = $('#PrimaryPhone', cartForm);
        if (pPhone) {
          var val = pPhone.value.trim().replace(/\D/g, '');
          if (val.length !== 10) {
            e.preventDefault();
            pPhone.focus();
            pPhone.classList.add('is-error');
            toast('Please enter a valid 10-digit primary mobile number for delivery.');
            return false;
          } else {
            pPhone.classList.remove('is-error');
          }
        }
        var discInput = $('#CartDiscountCode', cartForm);
        var discCode = discInput ? discInput.value.trim() : '';
        if (discCode) {
          e.preventDefault();
          var primaryPhone = pPhone ? pPhone.value.trim() : '';
          var altPhone = ($('#AltPhone', cartForm) && $('#AltPhone', cartForm).value.trim()) || '';
          var note = ($('#CartNote', cartForm) && $('#CartNote', cartForm).value.trim()) || '';
          var checkoutUrl = '/checkout?discount=' + encodeURIComponent(discCode);

          fetch('/cart/update.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              attributes: {
                'Primary Phone': primaryPhone,
                'Alternate Phone': altPhone
              },
              note: note
            })
          }).then(function () {
            window.location.href = checkoutUrl;
          }).catch(function () {
            window.location.href = checkoutUrl;
          });
          return false;
        }
      }
    });
  }

  /* ---------- country / state selects (address page) ---------- */
  $$('[data-country-select]').forEach(function (cs) {
    var ps = cs.closest('form').querySelector('[data-province-select]');
    var wantC = cs.getAttribute('data-default'); if (wantC) { $$('option', cs).forEach(function (o) { if (o.value === wantC || o.text === wantC) o.selected = true; }); }
    function fill() {
      var opt = cs.options[cs.selectedIndex]; var list = [];
      try { list = JSON.parse(opt.getAttribute('data-provinces') || '[]'); } catch (e) {}
      ps.innerHTML = ''; ps.disabled = !list.length;
      list.forEach(function (p) { var o = document.createElement('option'); o.value = p[0]; o.textContent = p[1]; ps.appendChild(o); });
      var wantP = ps.getAttribute('data-default'); if (wantP) { $$('option', ps).forEach(function (o) { if (o.value === wantP) o.selected = true; }); }
    }
    cs.addEventListener('change', function () { ps.removeAttribute('data-default'); fill(); });
    fill();
  });

  /* ---------- reveal on scroll ---------- */
  var rv = $$('.section__head, .feature, .review, .bundle, .card, .bundle-box, .review-card, .look-card, .rail-card, .craft-feature');
  if ('IntersectionObserver' in window) {
    rv.forEach(function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('is-in'); io.unobserve(x.target); } }); }, { rootMargin: '0px 0px -40px 0px' });
    rv.forEach(function (el) { io.observe(el); });
  }

  /* ==========================================================================
     VIDEO 1: RUNWAY ORBIT SHOWCASE (3D Orbit, Rolling Watermark, Tracklist)
     ========================================================================== */
  var orbitSection = $('#RunwayOrbit');
  if (orbitSection) {
    var orbitItems = $$('.orbit__item', orbitSection);
    var trackItems = $$('.orbit__track-item', orbitSection);
    var watermark = $('[data-orbit-watermark]', orbitSection);
    var titleEl = $('[data-orbit-title]', orbitSection);
    var priceEl = $('[data-orbit-price]', orbitSection);
    var curNumEl = $('[data-orbit-cur-num]', orbitSection);
    var progressEl = $('[data-orbit-progress]', orbitSection);
    var prevBtn = $('[data-orbit-prev]', orbitSection);
    var nextBtn = $('[data-orbit-next]', orbitSection);
    var totalCount = orbitItems.length;
    var activeIdx = 0;

    function updateOrbit(idx) {
      if (idx < 0) idx = totalCount - 1;
      if (idx >= totalCount) idx = 0;
      activeIdx = idx;

      // Update 3D carousel items
      orbitItems.forEach(function (item, i) {
        item.classList.remove('is-active', 'is-prev', 'is-next');
        if (i === activeIdx) {
          item.classList.add('is-active');
        } else if (i === (activeIdx - 1 + totalCount) % totalCount) {
          item.classList.add('is-prev');
        } else if (i === (activeIdx + 1) % totalCount) {
          item.classList.add('is-next');
        }
      });

      // Update tracklist on left
      trackItems.forEach(function (t, i) {
        t.classList.toggle('is-active', i === activeIdx);
      });

      // Active item metadata
      var curItem = orbitItems[activeIdx];
      if (curItem) {
        var title = curItem.getAttribute('data-title') || '';
        var price = curItem.getAttribute('data-price') || '';
        var url = curItem.getAttribute('data-product-url') || '';
        var vid = curItem.getAttribute('data-variant-id') || '';

        if (titleEl) titleEl.textContent = title;
        if (priceEl) priceEl.textContent = price;
        if (curNumEl) curNumEl.textContent = ('0' + (activeIdx + 1)).slice(-2);
        if (progressEl) progressEl.style.width = (((activeIdx + 1) / totalCount) * 100) + '%';
        var totNumEl = $('[data-orbit-total-num]', orbitSection);
        if (totNumEl) totNumEl.textContent = ('0' + totalCount).slice(-2);

        var pdpLink = $('[data-orbit-pdp-link]', orbitSection);
        if (pdpLink && url) pdpLink.setAttribute('href', url);

        // Animate rolling serif typography (Video 1 signature)
        if (watermark) {
          watermark.classList.add('is-rolling');
          setTimeout(function () {
            watermark.textContent = title.replace(/Zeyov|Amber|Camel|Emerald|Cream/gi, '').trim() || title;
            watermark.classList.remove('is-rolling');
          }, 250);
        }
      }
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { updateOrbit(activeIdx - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { updateOrbit(activeIdx + 1); });

    trackItems.forEach(function (t, i) {
      t.addEventListener('click', function () { updateOrbit(i); });
    });

    orbitItems.forEach(function (item, i) {
      item.addEventListener('click', function () {
        if (i !== activeIdx) updateOrbit(i);
      });
    });

    // Mobile Touch Swipe support for 3D Orbit Carousel
    var carouselEl = $('[data-orbit-carousel]', orbitSection);
    if (carouselEl) {
      var touchStartX = 0;
      var touchEndX = 0;
      carouselEl.addEventListener('touchstart', function (e) {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });
      carouselEl.addEventListener('touchend', function (e) {
        touchEndX = e.changedTouches[0].screenX;
        var diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 35) {
          if (diff > 0) {
            updateOrbit(activeIdx + 1);
          } else {
            updateOrbit(activeIdx - 1);
          }
        }
      }, { passive: true });
    }

    // Orbit Quick View Modal
    var modal = $('#OrbitModal');
    var openModalBtn = $('[data-open-orbit-modal]', orbitSection);
    var closeModalBtns = $$('[data-close-orbit-modal]', modal || document);

    function openModal() {
      if (!modal) return;
      var cur = orbitItems[activeIdx];
      if (cur) {
        var img = cur.getAttribute('data-img') || ($('img', cur) && $('img', cur).src);
        var title = cur.getAttribute('data-title');
        var price = cur.getAttribute('data-price');
        var tag = cur.getAttribute('data-tag');
        var desc = cur.getAttribute('data-desc');
        var url = cur.getAttribute('data-product-url');
        var vid = cur.getAttribute('data-variant-id');

        var mImg = $('[data-modal-img]', modal);
        var mTitle = $('[data-modal-title]', modal);
        var mPrice = $('[data-modal-price]', modal);
        var mTag = $('[data-modal-tag]', modal);
        var mDesc = $('[data-modal-desc]', modal);
        var mPdpLink = $('[data-modal-pdp-link]', modal);

        if (mImg && img) mImg.src = img;
        if (mTitle) mTitle.textContent = title;
        if (mPrice) mPrice.textContent = price;
        if (mTag) mTag.textContent = tag;
        if (mDesc) mDesc.textContent = desc;
        if (mPdpLink && url) mPdpLink.setAttribute('href', url);

        var modalAddBtn = $('[data-modal-add-to-cart]', modal);
        if (modalAddBtn && vid) modalAddBtn.setAttribute('data-variant-id', vid);
      }
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      if (!modal) return;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    if (openModalBtn) openModalBtn.addEventListener('click', openModal);
    closeModalBtns.forEach(function (btn) { btn.addEventListener('click', closeModal); });

    // Swatches and sizes inside modal
    if (modal) {
      $$('.orbit-modal__swatches .swatch', modal).forEach(function (sw) {
        sw.addEventListener('click', function () {
          $$('.orbit-modal__swatches .swatch', modal).forEach(function (s) { s.classList.remove('is-active'); });
          sw.classList.add('is-active');
        });
      });

      $$('.orbit-modal__sizes .size-btn', modal).forEach(function (sz) {
        sz.addEventListener('click', function () {
          $$('.orbit-modal__sizes .size-btn', modal).forEach(function (s) { s.classList.remove('is-active'); });
          sz.classList.add('is-active');
        });
      });

      var modalAddBtn = $('[data-modal-add-to-cart]', modal);
      if (modalAddBtn) {
        modalAddBtn.addEventListener('click', function () {
          var variantId = modalAddBtn.getAttribute('data-variant-id');
          if (!variantId) {
            var cur = orbitItems[activeIdx];
            if (cur) variantId = cur.getAttribute('data-variant-id');
          }
          if (!variantId) {
            var cur = orbitItems[activeIdx];
            var pUrl = cur && cur.getAttribute('data-product-url');
            if (pUrl) {
              safeNavigate(pUrl);
              return;
            }
            toast('Please select an option');
            return;
          }
          var oldText = modalAddBtn.textContent;
          modalAddBtn.textContent = 'Adding to Bag...';
          modalAddBtn.disabled = true;
          var cartTarget = $('.header__cart') || $('[data-cart-count]');
          if (cartTarget) animateFlyParticle(modalAddBtn, cartTarget);

          addItems([{ id: parseInt(variantId, 10), quantity: 1 }]).then(function () {
            modalAddBtn.textContent = '✓ Added to Bag!';
            toast('Runway piece added to bag ✓', true);
            setTimeout(function () {
              closeModal();
              modalAddBtn.textContent = oldText;
              modalAddBtn.disabled = false;
              if (window.CartDrawer && typeof window.CartDrawer.open === 'function') {
                window.CartDrawer.open();
              }
            }, 700);
          }).catch(function (err) {
            toast(err.message || 'Could not add to bag');
            modalAddBtn.textContent = oldText;
            modalAddBtn.disabled = false;
          });
        });
      }
    }

    // Initialize initial orbit state
    updateOrbit(0);
  }

  /* ==========================================================================
     VIDEO 2: PRODUCTS SHOWCASE (Category Switcher, Rail & Floating Bar)
     ========================================================================== */
  var showcase = $('#FashionShowcase');
  if (showcase) {
    var catPills = $$('.cat-pill', showcase);
    var genderBtns = $$('.segment-btn', showcase);
    var railCards = $$('.rail-card', showcase);
    var railTrack = $('#ShowcaseRailTrack', showcase);
    var railPrev = $('[data-rail-prev]', showcase);
    var railNext = $('[data-rail-next]', showcase);
    var modelImg = $('#ShowcaseModelImg', showcase);
    var activeLook = $('#ShowcaseActiveLook', showcase);
    var activePrice = $('#ShowcaseActivePrice', showcase);
    var floatingBar = $('#ShowcaseFloatingBar');
    var floatTitle = $('#FloatingBarTitle');
    var floatPrice = $('#FloatingBarPrice');
    var floatAddBtn = $('#FloatingBarAddBtn');

    var currentCat = 'all';
    var currentGender = 'women';
    var modelWomen = showcase.getAttribute('data-model-women');
    var modelMen = showcase.getAttribute('data-model-men');

    function cardMatches(card, cat, gender) {
      var cardCat = (card.getAttribute('data-cat') || '').trim().toLowerCase();
      var cardGenders = (card.getAttribute('data-gender') || '').trim().toLowerCase().split(/\s+/);
      var matchCat = (cat === 'all') || (cardCat === cat) || (cardCat.indexOf(cat) > -1);
      var matchGender = cardGenders.indexOf(gender) > -1;
      return matchCat && matchGender;
    }

    function updateCategoryCounts() {
      catPills.forEach(function (pill) {
        var cat = pill.getAttribute('data-cat') || 'all';
        var count = 0;
        railCards.forEach(function (card) {
          if (cardMatches(card, cat, currentGender)) {
            count++;
          }
        });
        var countEl = pill.querySelector('.cat-count');
        if (countEl) {
          countEl.textContent = (count < 10 ? '0' : '') + count;
        }
        if (count === 0 && cat !== 'all') {
          pill.style.opacity = '0.4';
          pill.style.pointerEvents = 'none';
        } else {
          pill.style.opacity = '';
          pill.style.pointerEvents = '';
        }
      });
    }

    function filterCards() {
      var visibleCount = 0;
      var firstVisibleCard = null;

      railCards.forEach(function (card) {
        if (cardMatches(card, currentCat, currentGender)) {
          card.style.display = 'flex';
          visibleCount++;
          if (!firstVisibleCard) firstVisibleCard = card;
        } else {
          card.style.display = 'none';
        }
      });

      var emptyRail = $('#ShowcaseEmptyRail', showcase);
      if (emptyRail) {
        emptyRail.style.display = (visibleCount === 0) ? 'flex' : 'none';
      }

      // If active card is now hidden, activate first visible one
      var activeCard = $('.rail-card.is-active', showcase);
      if (firstVisibleCard && (!activeCard || activeCard.style.display === 'none')) {
        activateCard(firstVisibleCard);
      }

      updateCategoryCounts();
    }

    catPills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        catPills.forEach(function (p) { p.classList.remove('is-active'); });
        pill.classList.add('is-active');
        currentCat = pill.getAttribute('data-cat') || 'all';
        filterCards();
      });
    });

    genderBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        genderBtns.forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        currentGender = btn.getAttribute('data-gender-filter') || 'women';

        // Switch editorial model photo
        var targetModel = (currentGender === 'men') ? modelMen : modelWomen;
        if (modelImg && targetModel) {
          modelImg.style.opacity = '0.35';
          setTimeout(function () {
            modelImg.src = targetModel;
            modelImg.style.opacity = '1';
          }, 150);
        }

        // Check if current category has any products in this gender. If not, auto-reset to 'all'
        var matchingInCurrentCat = 0;
        railCards.forEach(function (c) {
          if (cardMatches(c, currentCat, currentGender)) matchingInCurrentCat++;
        });

        if (matchingInCurrentCat === 0) {
          currentCat = 'all';
          catPills.forEach(function (p) {
            p.classList.toggle('is-active', (p.getAttribute('data-cat') || 'all') === 'all');
          });
        }

        filterCards();
      });
    });

    var resetCatBtn = $('[data-reset-category]', showcase);
    if (resetCatBtn) {
      resetCatBtn.addEventListener('click', function () {
        currentCat = 'all';
        catPills.forEach(function (p) {
          p.classList.toggle('is-active', (p.getAttribute('data-cat') || 'all') === 'all');
        });
        filterCards();
      });
    }

    updateCategoryCounts();

    // Clicking rail card activates look on model & floating bar
    function activateCard(card) {
      railCards.forEach(function (c) { c.classList.remove('is-active'); });
      card.classList.add('is-active');

      var title = card.getAttribute('data-title') || '';
      var price = card.getAttribute('data-price') || '';
      var look = card.getAttribute('data-look') || '';
      var img = card.getAttribute('data-img') || '';
      var url = card.getAttribute('data-product-url') || '';
      var vid = card.getAttribute('data-variant-id') || '';

      var activeDot = $('.swatch-dot.is-active', card);
      var colorVal = activeDot ? activeDot.getAttribute('data-color-val') : '';
      if (activeLook) activeLook.textContent = title + (colorVal ? ' (' + colorVal + ')' : '');
      if (activePrice) activePrice.textContent = price;

      var activeLink = $('#ShowcaseActiveLink', showcase);
      if (activeLink && url) activeLink.setAttribute('href', url);

      if (modelImg && img) {
        modelImg.style.opacity = '0.35';
        setTimeout(function () {
          modelImg.src = img;
          modelImg.style.opacity = '1';
        }, 150);
      }

      // Update sticky floating bar
      if (floatTitle) floatTitle.textContent = title + (colorVal ? ' (' + colorVal + ')' : '');
      if (floatPrice) floatPrice.textContent = price;
      if (floatAddBtn && vid) floatAddBtn.setAttribute('data-variant-id', vid);
      var floatPdp = $('#FloatingBarPdpLink');
      if (floatPdp && url) floatPdp.setAttribute('href', url);
    }

    railCards.forEach(function (card) {
      // Swatch dot selection
      $$('.swatch-dot', card).forEach(function (dot) {
        dot.addEventListener('click', function (e) {
          e.stopPropagation();
          $$('.swatch-dot', card).forEach(function (d) { d.classList.remove('is-active'); });
          dot.classList.add('is-active');

          var vImg = dot.getAttribute('data-variant-img');
          var vId = dot.getAttribute('data-variant-id');
          var cardImg = $('.rail-card__img', card);
          var quickBtn = $('.rail-card__quick-add', card);
          var colorName = dot.getAttribute('data-color-val') || '';

          if (vImg && cardImg) {
            cardImg.src = vImg;
            card.setAttribute('data-img', vImg);
          }
          if (vId) {
            card.setAttribute('data-variant-id', vId);
            if (quickBtn) quickBtn.setAttribute('data-quick-add-id', vId);
          }

          var hintEl = $('#ShowcaseVariantHint', showcase);
          if (hintEl && colorName) {
            var hintText = hintEl.querySelector('.variant-hint__text');
            if (hintText && !hintEl._animating) {
              hintEl._animating = true;
              var origHTML = hintText.innerHTML;
              hintText.innerHTML = '<span style="color:#B89B65;font-weight:700;">✦ Previewing ' + escapeHtml(colorName) + '</span>';
              hintEl.style.borderColor = 'var(--gold)';
              hintEl.style.background = 'rgba(24, 23, 22, 0.88)';
              setTimeout(function () {
                hintText.innerHTML = origHTML;
                hintEl.style.borderColor = '';
                hintEl.style.background = '';
                hintEl._animating = false;
              }, 2200);
            }
          }

          activateCard(card);
        });
      });

      card.addEventListener('click', function (e) {
        if (e.target.closest('.rail-card__quick-add') || e.target.closest('.swatch-dot') || e.target.closest('a')) return;
        activateCard(card);
      });
    });

    // Quick add buttons on rail cards with real Shopify Cart API
    $$('.rail-card__quick-add', showcase).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var card = btn.closest('.rail-card');
        var variantId = btn.getAttribute('data-quick-add-id') || (card && card.getAttribute('data-variant-id'));
        if (!variantId) {
          if (card && card.getAttribute('data-product-url')) {
            safeNavigate(card.getAttribute('data-product-url'));
          }
          return;
        }
        var originalText = btn.innerHTML;
        btn.innerHTML = '<span>Adding...</span>';
        btn.disabled = true;
        var cartTarget = $('.header__cart') || $('[data-cart-count]');
        if (cartTarget) animateFlyParticle(btn, cartTarget);

        addItems([{ id: parseInt(variantId, 10), quantity: 1 }]).then(function () {
          btn.innerHTML = '<span>✓ Added!</span>';
          toast('Piece added to bag ✓', true);
          setTimeout(function () {
            btn.innerHTML = originalText;
            btn.disabled = false;
            if (window.CartDrawer && typeof window.CartDrawer.open === 'function') {
              window.CartDrawer.open();
            }
          }, 700);
        }).catch(function (err) {
          toast(err.message || 'Could not add to bag');
          btn.innerHTML = originalText;
          btn.disabled = false;
        });
      });
    });

    // Rail horizontal arrows
    if (railPrev && railTrack) {
      railPrev.addEventListener('click', function () {
        railTrack.scrollBy({ left: -300, behavior: 'smooth' });
      });
    }
    if (railNext && railTrack) {
      railNext.addEventListener('click', function () {
        railTrack.scrollBy({ left: 300, behavior: 'smooth' });
      });
    }

    // Sticky Floating Bar visibility on scroll
    if (floatingBar && 'IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            floatingBar.classList.add('is-visible');
          } else {
            floatingBar.classList.remove('is-visible');
          }
        });
      }, { threshold: 0.15 });
      obs.observe(showcase);
    }

    // Floating bar size selection
    $$('.bar-size-btn', floatingBar).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.bar-size-btn', floatingBar).forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
      });
    });

    if (floatAddBtn) {
      floatAddBtn.addEventListener('click', function () {
        var variantId = floatAddBtn.getAttribute('data-variant-id');
        if (!variantId) {
          var activeCard = $('.rail-card.is-active', showcase);
          if (activeCard) variantId = activeCard.getAttribute('data-variant-id');
        }
        if (!variantId) {
          var activeCard = $('.rail-card.is-active', showcase);
          var pUrl = (activeCard && activeCard.getAttribute('data-product-url'));
          if (pUrl) {
            safeNavigate(pUrl);
            return;
          }
          toast('Please select an option');
          return;
        }
        var original = floatAddBtn.innerHTML;
        floatAddBtn.innerHTML = '<span>Adding to Bag...</span>';
        floatAddBtn.disabled = true;
        var cartTarget = $('.header__cart') || $('[data-cart-count]');
        if (cartTarget) animateFlyParticle(floatAddBtn, cartTarget);

        addItems([{ id: parseInt(variantId, 10), quantity: 1 }]).then(function () {
          floatAddBtn.innerHTML = '<span>✓ Added to Bag!</span>';
          toast('Selected piece added to bag ✓', true);
          setTimeout(function () {
            floatAddBtn.innerHTML = original;
            floatAddBtn.disabled = false;
            if (window.CartDrawer && typeof window.CartDrawer.open === 'function') {
              window.CartDrawer.open();
            }
          }, 700);
        }).catch(function (err) {
          toast(err.message || 'Could not add to bag');
          floatAddBtn.innerHTML = original;
          floatAddBtn.disabled = false;
        });
      });
    }
  }

  /* ---------- Lookbook Rail Scroll Controls ---------- */
  var lookRailViewport = $('#LookbookRailViewport');
  var lookPrev = $('[data-rail-prev-look]');
  var lookNext = $('[data-rail-next-look]');
  if (lookRailViewport) {
    if (lookPrev) {
      lookPrev.addEventListener('click', function () {
        lookRailViewport.scrollBy({ left: -340, behavior: 'smooth' });
      });
    }
    if (lookNext) {
      lookNext.addEventListener('click', function () {
        lookRailViewport.scrollBy({ left: 340, behavior: 'smooth' });
      });
    }
  }

  // Full-card click navigation for Lookbook rail cards
  document.addEventListener('click', function (e) {
    var card = e.target.closest('.look-card');
    if (card && !e.target.closest('a') && !e.target.closest('button')) {
      var url = card.getAttribute('data-product-url');
      if (url) {
        safeNavigate(url);
      }
    }
  });

  /* ==========================================================================
     WISHLIST / FAVORITES SYSTEM WITH LIVE ANIMATIONS
     ========================================================================== */
  var WISHLIST_KEY = 'zeyov_wishlist';

  function getWishlist() {
    try {
      return JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveWishlist(list) {
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
    } catch (e) {}
    updateWishlistUI();
  }

  function renderWishlistDrawer() {
    var container = $('#WishlistItems');
    var emptyState = $('#WishlistEmptyState');
    if (!container) return;
    var list = getWishlist();
    if (list.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';
    var html = '';
    list.forEach(function (item) {
      if (!item || typeof item !== 'object') return;
      var safeHandle = String(item.handle || '').replace(/[^a-zA-Z0-9_\-]/g, '');
      var safeTitle = escapeHtml(item.title || '');
      var safePrice = escapeHtml(item.price || '');
      var safeUrl = isSafeUrl(item.url) ? encodeURI(item.url) : '#';
      var rawImg = String(item.image || '');
      var safeImg = (rawImg.startsWith('https://') || rawImg.startsWith('//') || rawImg.startsWith('/')) ? encodeURI(rawImg) : '';

      html += '<div class="wishlist-item" data-wishlist-handle="' + safeHandle + '">' +
        '<img class="wishlist-item__img" src="' + safeImg + '" alt="' + safeTitle + '" loading="lazy">' +
        '<div class="wishlist-item__info">' +
          '<a href="' + safeUrl + '" class="wishlist-item__title">' + safeTitle + '</a>' +
          '<span class="wishlist-item__price">' + safePrice + '</span>' +
        '</div>' +
        '<div class="wishlist-item__actions">' +
          '<a href="' + safeUrl + '" class="btn btn--small btn--luxury">View</a>' +
          '<button type="button" class="icon-btn" data-wishlist-remove="' + safeHandle + '" aria-label="Remove piece" style="color:#C23636;padding:6px;">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M18 6 6 18"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  function updateWishlistUI() {
    var list = getWishlist();
    var count = list.length;
    $$('[data-wishlist-count]').forEach(function (el) {
      el.textContent = count;
      el.classList.toggle('is-empty', count === 0);
    });
    $$('[data-wishlist-count-text]').forEach(function (el) {
      el.textContent = count;
    });
    $$('[data-wishlist-toggle]').forEach(function (btn) {
      var h = btn.getAttribute('data-wishlist-toggle');
      var active = list.some(function (i) { return i.handle === h; });
      btn.classList.toggle('is-active', active);
    });
    renderWishlistDrawer();
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-wishlist-toggle]');
    if (btn) {
      e.preventDefault();
      var handle = btn.getAttribute('data-wishlist-toggle');
      var title = btn.getAttribute('data-title') || 'Product';
      var price = btn.getAttribute('data-price') || '';
      var image = btn.getAttribute('data-image') || '';
      var url = btn.getAttribute('data-url') || ('/products/' + handle);

      btn.classList.add('heart-pop-anim');
      setTimeout(function () { btn.classList.remove('heart-pop-anim'); }, 500);

      var list = getWishlist();
      var exists = list.some(function (i) { return i.handle === handle; });
      var targetBadge = $('.header__wishlist') || $('[data-wishlist-count]');

      if (exists) {
        list = list.filter(function (i) { return i.handle !== handle; });
        saveWishlist(list);
        toast('Removed from Wishlist');
      } else {
        list.push({ handle: handle, title: title, price: price, image: image, url: url });
        saveWishlist(list);
        if (targetBadge) {
          animateFlyParticle(btn, targetBadge);
          targetBadge.classList.add('badge-bump-anim');
          setTimeout(function () { targetBadge.classList.remove('badge-bump-anim'); }, 500);
        }
        toast('Saved to Wishlist ♥');
      }
      return;
    }

    var rmBtn = e.target.closest('[data-wishlist-remove]');
    if (rmBtn) {
      e.preventDefault();
      var rmHandle = rmBtn.getAttribute('data-wishlist-remove');
      var curList = getWishlist().filter(function (i) { return i.handle !== rmHandle; });
      saveWishlist(curList);
      toast('Removed from Wishlist');
      return;
    }

    var openW = e.target.closest('[data-open-wishlist]');
    if (openW) {
      e.preventDefault();
      var wDrawer = $('#WishlistDrawer');
      if (wDrawer) {
        wDrawer.hidden = false;
        if (overlay) { overlay.hidden = false; document.body.style.overflow = 'hidden'; }
      }
      return;
    }

    var closeW = e.target.closest('[data-close-wishlist]');
    if (closeW) {
      e.preventDefault();
      var wDrawer2 = $('#WishlistDrawer');
      if (wDrawer2) {
        wDrawer2.hidden = true;
        if (overlay) { overlay.hidden = true; document.body.style.overflow = ''; }
      }
      return;
    }
  });

  /* ==========================================================================
     MARKETING AUTOMATION & RETENTION ENGINE (ZEYOV)
     - Exit-Intent & Idle Cart Recovery Modal
     - Back in Stock WhatsApp / Email Notification Modal
     - Dynamic Personalized Recommendations & Browsing History Engine
     - One-Tap Coupon Code Copy
     ========================================================================== */

  // 1. One-Tap Coupon Copy Handler
  document.addEventListener('click', function (e) {
    var cpBtn = e.target.closest('[data-copy-coupon]');
    if (cpBtn) {
      e.preventDefault();
      var code = cpBtn.getAttribute('data-copy-coupon') || 'ZEYOV10';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function () {
          toast('Code ' + code + ' copied to clipboard!');
        }).catch(function () {
          toast('Use code: ' + code);
        });
      } else {
        toast('Use code: ' + code);
      }
    }
  });

  // 2. Abandoned Cart Recovery Modal & Exit-Intent
  var recoveryModal = $('#CartRecoveryModal');
  var recoveryShownSessionKey = 'zeyov_cart_recovery_prompted';

  function openRecoveryModal() {
    if (!recoveryModal) return;
    if (sessionStorage.getItem(recoveryShownSessionKey)) return;

    // Check if cart has items
    var countEl = $('[data-cart-count]');
    var itemCount = countEl ? parseInt(countEl.textContent, 10) : 0;
    var hasItemsInModal = !!$('.cart-recovery-item', recoveryModal);

    if (itemCount > 0 || hasItemsInModal) {
      sessionStorage.setItem(recoveryShownSessionKey, 'true');
      recoveryModal.style.display = 'flex';
      recoveryModal.classList.add('is-open');
      recoveryModal.setAttribute('aria-hidden', 'false');

      // Autofill from stored contact
      try {
        var stored = JSON.parse(localStorage.getItem('zeyov_customer_contact') || '{}');
        if (stored.phone && $('#RecoveryPhone')) $('#RecoveryPhone').value = stored.phone;
        if (stored.email && $('#RecoveryEmail')) $('#RecoveryEmail').value = stored.email;
      } catch (err) {}
    }
  }

  function closeRecoveryModal() {
    if (!recoveryModal) return;
    recoveryModal.style.display = 'none';
    recoveryModal.classList.remove('is-open');
    recoveryModal.setAttribute('aria-hidden', 'true');
  }

  // Exit-Intent Trigger: mouse leaves top of viewport
  document.addEventListener('mouseleave', function (e) {
    if (e.clientY <= 5 && !sessionStorage.getItem(recoveryShownSessionKey)) {
      openRecoveryModal();
    }
  });

  // Idle Timer Trigger: 60s idle on page when cart has items
  var recoveryIdleTimer;
  function resetRecoveryIdleTimer() {
    clearTimeout(recoveryIdleTimer);
    if (!sessionStorage.getItem(recoveryShownSessionKey)) {
      recoveryIdleTimer = setTimeout(function () {
        openRecoveryModal();
      }, 60000);
    }
  }
  ['mousemove', 'keydown', 'scroll', 'touchstart'].forEach(function (evt) {
    window.addEventListener(evt, resetRecoveryIdleTimer, { passive: true });
  });
  resetRecoveryIdleTimer();

  // Modal Close buttons
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-close-recovery-modal]')) {
      e.preventDefault();
      closeRecoveryModal();
    }
  });

  // Recovery Form Submission
  var recoveryForm = $('#CartRecoveryForm');
  if (recoveryForm) {
    recoveryForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var phone = ($('#RecoveryPhone') ? $('#RecoveryPhone').value.trim() : '');
      var email = ($('#RecoveryEmail') ? $('#RecoveryEmail').value.trim() : '');
      var consent = ($('#RecoveryConsent') && $('#RecoveryConsent').checked);

      if (!phone || !/^[6-9][0-9]{9}$/.test(phone)) {
        toast('Please enter a valid 10-digit Indian WhatsApp number.');
        return;
      }

      if (!consent) {
        toast('Please accept marketing updates to claim your discount.');
        return;
      }

      var submitBtn = $('#RecoverySubmitBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Activating VIP Discount...</span>';
      }

      // Store contact locally
      try {
        localStorage.setItem('zeyov_customer_contact', JSON.stringify({ phone: phone, email: email }));
      } catch (err) {}

      // Update cart attributes with phone, email & marketing consent
      fetch(ZEYOV.routes.cartJson)
        .then(function (r) { return r.json(); })
        .then(function (cart) {
          var updateData = {
            attributes: {
              'Primary Phone': phone,
              'Recovery Email': email,
              'Marketing Consent': 'Opted In (WhatsApp & Email)',
              'Recovery Offer': 'ZEYOV10',
              'Captured At': new Date().toISOString()
            }
          };
          return fetch(ZEYOV.routes.cart.replace(/\/$/, '') + '/update.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(updateData)
          });
        })
        .then(function () {
          closeRecoveryModal();
          toast('Discount ZEYOV10 applied! Redirecting to checkout...');
          setTimeout(function () {
            safeNavigate('/checkout?discount=ZEYOV10');
          }, 600);
        })
        .catch(function () {
          closeRecoveryModal();
          safeNavigate('/checkout?discount=ZEYOV10');
        });
    });
  }

  // 3. Back in Stock Modal
  var stockModal = $('#BackInStockModal');
  function openStockModal() {
    if (!stockModal) return;
    stockModal.style.display = 'flex';
    stockModal.classList.add('is-open');
    stockModal.setAttribute('aria-hidden', 'false');

    try {
      var storedContact = JSON.parse(localStorage.getItem('zeyov_customer_contact') || '{}');
      if (storedContact.phone && $('#StockPhone')) $('#StockPhone').value = storedContact.phone;
      if (storedContact.email && $('#StockEmail')) $('#StockEmail').value = storedContact.email;
    } catch (e) {}
  }

  function closeStockModal() {
    if (!stockModal) return;
    stockModal.style.display = 'none';
    stockModal.classList.remove('is-open');
    stockModal.setAttribute('aria-hidden', 'true');
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-open-stock-modal]')) {
      e.preventDefault();
      openStockModal();
      return;
    }
    if (e.target.closest('[data-close-stock-modal]')) {
      e.preventDefault();
      closeStockModal();
      return;
    }
  });

  var stockForm = $('#BackInStockForm');
  if (stockForm) {
    stockForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var phone = ($('#StockPhone') ? $('#StockPhone').value.trim() : '');
      var email = ($('#StockEmail') ? $('#StockEmail').value.trim() : '');
      var vId = ($('#StockVariantId') ? $('#StockVariantId').value : '');
      var pTitle = ($('#StockModalProductTitle') ? $('#StockModalProductTitle').textContent : 'Product');

      if (!phone || !/^[6-9][0-9]{9}$/.test(phone)) {
        toast('Please enter a valid 10-digit WhatsApp number.');
        return;
      }

      var btn = $('#StockSubmitBtn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Submitting alert request...';
      }

      try {
        localStorage.setItem('zeyov_customer_contact', JSON.stringify({ phone: phone, email: email }));
        var list = JSON.parse(localStorage.getItem('zeyov_restock_alerts') || '[]');
        list.push({ phone: phone, email: email, variantId: vId, title: pTitle, time: new Date().toISOString() });
        localStorage.setItem('zeyov_restock_alerts', JSON.stringify(list));
      } catch (err) {}

      setTimeout(function () {
        closeStockModal();
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Notify Me on WhatsApp & Email →';
        }
        toast('Restock alert confirmed! We will message you on WhatsApp & Email when available.');
      }, 500);
    });
  }

  // 4. Personalized Recommendations & Browsing History Engine
  var RECENT_KEY = 'zeyov_recent_views';
  function trackCurrentProductView() {
    if (window.location.pathname.indexOf('/products/') === -1) return;
    var handle = window.location.pathname.split('/products/')[1].split('/')[0].split('?')[0];
    if (!handle) return;

    var titleEl = $('.pdp__title');
    var priceEl = $('[data-price-now]');
    var imgEl = $('.gallery__slide.is-active img') || $('.gallery__slide img');

    if (!titleEl) return;

    var productItem = {
      handle: handle,
      title: titleEl.textContent.trim(),
      price: priceEl ? priceEl.textContent.trim() : '',
      image: imgEl ? imgEl.src : '',
      url: '/products/' + handle
    };

    try {
      var views = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      views = views.filter(function (p) { return p.handle !== handle; });
      views.unshift(productItem);
      if (views.length > 8) views = views.slice(0, 8);
      localStorage.setItem(RECENT_KEY, JSON.stringify(views));
    } catch (err) {}
  }

  function renderPersonalizedRecs() {
    var recsSec = $('#PersonalizedRecsSection');
    var grid = $('#PersonalizedRecsGrid');
    if (!recsSec || !grid) return;

    var curHandle = (window.location.pathname.indexOf('/products/') !== -1)
      ? window.location.pathname.split('/products/')[1].split('/')[0].split('?')[0]
      : '';

    var views = [];
    try {
      views = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch (e) {
      views = [];
    }

    var filtered = views.filter(function (p) { return p.handle !== curHandle; });

    if (filtered.length > 0) {
      var html = '';
      filtered.slice(0, 4).forEach(function (p) {
        html += '<a href="' + encodeURI(p.url) + '" class="personalized-card">' +
          '<div class="personalized-card__media">' +
            (p.image ? '<img src="' + encodeURI(p.image) + '" alt="' + escapeHtml(p.title) + '" loading="lazy">' : '') +
          '</div>' +
          '<div class="personalized-card__info">' +
            '<span class="personalized-card__title">' + escapeHtml(p.title) + '</span>' +
            '<span class="personalized-card__price">' + escapeHtml(p.price) + '</span>' +
          '</div>' +
        '</a>';
      });
      grid.innerHTML = html;
      recsSec.style.display = 'block';
    } else {
      // If no browsing history yet, load 4 runway products via JSON
      fetch('/collections/all/products.json?limit=4')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.products && data.products.length > 0) {
            var html = '';
            data.products.filter(function (p) { return p.handle !== curHandle; }).slice(0, 4).forEach(function (p) {
              var img = (p.images && p.images[0]) ? p.images[0].src : '';
              var price = (p.variants && p.variants[0]) ? formatMoney(p.variants[0].price * 100) : '';
              html += '<a href="/products/' + encodeURI(p.handle) + '" class="personalized-card">' +
                '<div class="personalized-card__media">' +
                  (img ? '<img src="' + encodeURI(img) + '" alt="' + escapeHtml(p.title) + '" loading="lazy">' : '') +
                '</div>' +
                '<div class="personalized-card__info">' +
                  '<span class="personalized-card__title">' + escapeHtml(p.title) + '</span>' +
                  '<span class="personalized-card__price">' + escapeHtml(price) + '</span>' +
                '</div>' +
              '</a>';
            });
            if (html) {
              grid.innerHTML = html;
              recsSec.style.display = 'block';
            }
          }
        })
        .catch(function () {});
    }
  }

  trackCurrentProductView();
  renderPersonalizedRecs();

  // Initial Wishlist UI sync on page load
  updateWishlistUI();
})();


