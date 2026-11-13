(() => {
  const SW = { black: '#17171a', white: '#f4f3f0', beige: '#decbac', brown: '#5e3b26', 'navy blue': '#1e2846', 'royal blue': '#2248a8', lavender: '#baaad6', red: '#b22228', green: '#34563c', sand: '#c8b296', grey: '#8a8a8a', gray: '#8a8a8a' };
  const isLight = (hex) => { const h = (hex || '').replace('#', ''); if (h.length < 6) return false; const n = parseInt(h.slice(0, 6), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 165; };
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');

  /* ---- background removal ----------------------------------------------------------
     Runs in a Web Worker (no jank on the main thread) and keeps results in the Cache API,
     so each photo is processed once per device. Transparent PNGs pass straight through. */
  const cache = new Map(); const photos = new Set(); const tops = new Map();
  const CACHE = 'zeyov-rack-v2';
  const PROC = `
    const proc = (d, w, h) => {
      const topRow = () => { for (let y = 0; y < h; y++) { let n = 0; for (let x = 0; x < w; x += 2) if (d[(y * w + x) * 4 + 3] > 60) n++; if (n > 3) return y; } return 0; };
      let clear = 0, edge = 0;
      for (let x = 0; x < w; x += 3) { edge += 2; if (d[x * 4 + 3] < 20) clear++; if (d[((h - 1) * w + x) * 4 + 3] < 20) clear++; }
      for (let y = 0; y < h; y += 3) { edge += 2; if (d[(y * w) * 4 + 3] < 20) clear++; if (d[(y * w + w - 1) * 4 + 3] < 20) clear++; }
      if (clear > edge * .4) return { kind: 'clear', top: topRow() / w };
      const bg = (i) => d[i] > 244 && d[i + 1] > 244 && d[i + 2] > 244 && Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) < 10;
      const seen = new Uint8Array(w * h), st = [];
      const push = (x, y) => { const p = y * w + x; if (!seen[p] && bg(p * 4)) { seen[p] = 1; st.push(p); } };
      for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
      for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
      if (st.length < w + h) return { kind: 'photo' };
      while (st.length) { const p = st.pop(), x = p % w, y = (p - x) / w; d[p * 4 + 3] = 0; if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1); }
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const p = y * w + x; if (seen[p]) continue; if (seen[p - 1] || seen[p + 1] || seen[p - w] || seen[p + w]) { const i = p * 4, l = (d[i] + d[i + 1] + d[i + 2]) / 3; if (l > 205) d[i + 3] = Math.max(40, 255 - (l - 205) * 4.2); } }
      return { kind: 'cut', top: topRow() / w };
    };`;
  let worker = null, wid = 0; const waiting = new Map();
  try {
    if (window.Worker && window.OffscreenCanvas && window.createImageBitmap) {
      const src = PROC + `
        self.onmessage = async (e) => {
          const { id, url, maxW } = e.data;
          try {
            const r = await fetch(url, { mode: 'cors', credentials: 'omit' }); const bmp = await createImageBitmap(await r.blob());
            const sc = Math.min(1, maxW / bmp.width), w = Math.round(bmp.width * sc), h = Math.round(bmp.height * sc);
            const c = new OffscreenCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0, w, h);
            const id2 = g.getImageData(0, 0, w, h), res = proc(id2.data, w, h);
            if (res.kind === 'cut') { g.putImageData(id2, 0, 0); res.blob = await c.convertToBlob({ type: 'image/webp', quality: .92 }); }
            self.postMessage({ id, ...res });
          } catch (err) { self.postMessage({ id, kind: 'error' }); }
        };`;
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      worker.onmessage = (e) => { const f = waiting.get(e.data.id); if (f) { waiting.delete(e.data.id); f(e.data); } };
      worker.onerror = () => { worker = null; waiting.forEach((f) => f({ kind: 'error' })); waiting.clear(); };
    }
  } catch (e) { worker = null; }
  const mainThread = (url, maxW) => new Promise((resolve) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { try {
      const sc = Math.min(1, maxW / img.naturalWidth), w = Math.round(img.naturalWidth * sc), h = Math.round(img.naturalHeight * sc);
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
      const id = g.getImageData(0, 0, w, h), res = (new Function(PROC + 'return proc;'))()(id.data, w, h);
      if (res.kind !== 'cut') return resolve(res);
      g.putImageData(id, 0, 0); c.toBlob((b) => resolve({ ...res, blob: b }), 'image/webp', .92);
    } catch (e) { resolve({ kind: 'error' }); } };
    img.onerror = () => resolve({ kind: 'error' }); img.src = url;
  });
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 600 }) : setTimeout(fn, 1));
  function cutout(url, maxW = 1000) {
    if (!url) return Promise.resolve('');
    const key = url + '|' + maxW; if (cache.has(key)) return cache.get(key);
    const job = (async () => {
      let store = null;
      try { store = window.caches ? await caches.open(CACHE) : null; } catch (e) { store = null; }
      const ck = `/__rack/${encodeURIComponent(key)}`;
      if (store) { // processed before on this device?
        const hit = await store.match(ck).catch(() => null);
        if (hit) { const kind = hit.headers.get('x-kind'), top = parseFloat(hit.headers.get('x-top')); if (!isNaN(top)) tops.set(url, top);
          if (kind === 'photo') { photos.add(url); return url; } if (kind === 'clear') return url; return URL.createObjectURL(await hit.blob()); }
      }
      const res = await new Promise((resolve) => {
        if (worker) { const id = ++wid; waiting.set(id, resolve); worker.postMessage({ id, url: new URL(url, location.href).href, maxW }); }
        else idle(() => mainThread(url, maxW).then(resolve));
      });
      if (res.top != null) tops.set(url, res.top);
      if (res.kind === 'photo') photos.add(url);
      if (store && res.kind !== 'error') {
        const h = { 'x-kind': res.kind, 'x-top': String(res.top != null ? res.top : '') };
        store.put(ck, new Response(res.blob || '', { headers: h })).catch(() => {});
      }
      return res.kind === 'cut' && res.blob ? URL.createObjectURL(res.blob) : url;
    })();
    cache.set(key, job); return job;
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(.2,.85,.2,1)';

  function init(root) {
    if (root.dataset.ready) return; root.dataset.ready = '1';
    const slots = [...root.querySelectorAll('.rack__slot')];
    const items = slots.map((s) => s.querySelector('[data-item]'));
    if (!items.length) return;
    const $ = (s) => root.querySelector(s);
    const box = $('[data-items]'), nameOut = $('[data-name-out]'), meta = $('[data-meta]'), pill = $('[data-pill]'), count = $('[data-count]');
    const detail = $('[data-detail]'), big = $('[data-big]'), title = $('[data-title]'), link = $('[data-link]');
    const tags = $('[data-tags]'), chips = $('[data-chips]'), dSub = $('[data-d-sub]'), dPrice = $('[data-d-price]');
    const views = [...root.querySelectorAll('[data-view]')];
    const portal = () => { if (mobile() && detail.parentNode !== document.body) { detail.style.cssText = root.style.cssText; detail.classList.add('rack__detail--portal'); document.body.appendChild(detail); } };
    const total = root.querySelector('[data-total]'); if (total) total.textContent = pad(items.length);
    const mobile = () => matchMedia('(max-width: 899px)').matches;
    const hint = nameOut.textContent;
    let active = -1, open = -1, view = 'front', lastActive = 0;
    const d = (i) => items[i].dataset;

    // cut-out every thumbnail (lazy-ish: visible first)
    const thumbs = items.map((it) => it.querySelector('img.rack__img'));
    const cutThumb = (k) => { const im = thumbs[k]; if (!im || im.dataset.cut) return; im.dataset.cut = '1'; const src = items[k].dataset.thumb || im.src; cutout(src, 440).then((u) => { if (u) im.src = u; if (photos.has(src)) slots[k].classList.add('is-photo'); if (tops.has(src)) im.style.setProperty('--t', tops.get(src).toFixed(3)); im.classList.add('is-cut'); }); };
    const mid0 = Math.floor(items.length / 2); [mid0, mid0 - 1, mid0 + 1].filter((k) => k >= 0 && k < items.length).forEach(cutThumb);
    if ('IntersectionObserver' in window) { const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { cutThumb(slots.indexOf(e.target)); io.unobserve(e.target); } }), { root: null, rootMargin: '200px' }); slots.forEach((s) => io.observe(s)); }
    else items.forEach((_, k) => cutThumb(k));

    function setActive(i) {
      if (i === active) return; active = i; if (i >= 0) lastActive = i;
      slots.forEach((s, k) => { s.classList.toggle('is-active', k === i); s.classList.toggle('is-near', i >= 0 && Math.abs(k - i) === 1); s.classList.toggle('is-left', i >= 0 && k < i); s.classList.toggle('is-right', i >= 0 && k > i); });
      if (i < 0) { nameOut.textContent = hint; meta.innerHTML = '&nbsp;'; return; }
      const x = d(i); const put = () => { nameOut.textContent = x.name; meta.innerHTML = [esc(x.sub), x.price ? `<em>${esc(x.price)}</em>` : ''].filter(Boolean).join(' · ') || '&nbsp;'; root.classList.remove('is-switching'); };
      if (reduce || nameOut.textContent === hint) put(); else { root.classList.add('is-switching'); clearTimeout(root._sw); root._sw = setTimeout(put, 170); }
      pill.href = x.url; count.textContent = pad(i + 1);
    }
    function goTo(i, smooth = true) {
      i = (i + items.length) % items.length;
      if (mobile()) { const s = slots[i]; box.scrollTo({ left: s.offsetLeft + s.offsetWidth / 2 - box.clientWidth / 2, behavior: smooth ? 'smooth' : 'auto' }); }
      setActive(i);
    }

    // detail view
    let vsel = -1; // chosen colour of a collection product
    const buy = $('[data-buy]'), sizes = $('[data-sizes]'), sizeRow = $('[data-size-row]'), msg = $('[data-msg]'), heart = root.querySelector('[data-detail] [data-wish]');
    const money = (c) => '₹' + (c / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    const prod = (x) => { try { return x.product ? JSON.parse(x.product) : null; } catch (e) { return null; } };
    const optIdx = (P, names) => P.o.findIndex((o) => names.includes(String(o).toLowerCase()));
    let pick = { c: null, s: null };
    function current(P) {
      const ci = optIdx(P, ['color', 'colour']), si = optIdx(P, ['size']);
      return P.v.find((v) => (ci < 0 || v.o[ci] === pick.c) && (si < 0 || v.o[si] === pick.s)) || null;
    }
    function renderBuy(x) {
      const P = prod(x); msg.textContent = '';
      buy.hidden = !P; sizes.hidden = true;
      if (!P) return;
      const ci = optIdx(P, ['color', 'colour']), si = optIdx(P, ['size']);
      if (ci >= 0 && !pick.c) pick.c = (P.v.find((v) => v.a) || P.v[0]).o[ci];
      if (si >= 0) {
        const vals = [...new Set(P.v.map((v) => v.o[si]))];
        sizes.hidden = false;
        sizeRow.innerHTML = vals.map((val) => { const ok = P.v.some((v) => v.o[si] === val && v.a && (ci < 0 || v.o[ci] === pick.c)); return `<button type="button" class="rack__size ${pick.s === val ? 'is-on' : ''}" data-size="${esc(val)}" ${ok ? '' : 'disabled'} aria-pressed="${pick.s === val}">${esc(val)}</button>`; }).join('');
      }
      const v = current(P);
      if (v) dPrice.textContent = money(v.p);
      heart.dataset.wish = P.h;
      let w = []; try { w = JSON.parse(localStorage.getItem('zeyov:wishlist') || '[]'); } catch (e) { w = []; }
      heart.classList.toggle('is-active', w.includes(P.h)); heart.setAttribute('aria-pressed', w.includes(P.h));
    }
    async function addSelected(now) {
      const x = d(open), P = prod(x); if (!P) return;
      const si = optIdx(P, ['size']);
      if (si >= 0 && !pick.s) { msg.textContent = 'Please choose a size'; sizes.classList.remove('shake'); void sizes.offsetWidth; sizes.classList.add('shake'); return; }
      const v = current(P) || (P.v.length === 1 ? P.v[0] : null);
      if (!v || !v.a) { msg.textContent = 'This option is sold out'; return; }
      const btn = detail.querySelector(now ? '[data-now]' : '[data-add]');
      // Buy now: straight to checkout with only this product (Shopify cart permalink)
      if (now) { btn.classList.add('is-loading'); location.href = `${(window.Shopify && Shopify.routes && Shopify.routes.root) || '/'}cart/${v.id}:1`; return; }
      btn.classList.add('is-loading'); btn.disabled = true;
      try {
        const r = await fetch('/cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items: [{ id: v.id, quantity: 1 }] }) });
        const j = await r.json(); if (!r.ok) { msg.textContent = j.description || 'Could not add to cart'; return; }
        msg.textContent = 'Added to your cart ✓';
        if (window.ZeyovTheme && ZeyovTheme.refreshCart) ZeyovTheme.refreshCart();
        setTimeout(() => { closeDetail(); const o = document.querySelector('[data-open-cart]'); if (o) o.click(); }, 650);
      } catch (e) { msg.textContent = 'Network error, please try again'; }
      finally { btn.classList.remove('is-loading'); btn.disabled = false; }
    }
    const vars = (x) => { try { return x.variants ? JSON.parse(x.variants) : []; } catch (e) { return []; } };
    function show(i, keepVar, opening) {
      if (open !== i || !keepVar) { vsel = -1; pick = { c: null, s: null }; }
      open = i; const x = d(i), vl = vars(x);
      const front = vsel >= 0 && vl[vsel] ? vl[vsel].i : x.front;
      const src = view === 'back' && x.back ? x.back : front;
      if (!opening) big.classList.add('is-swap');
      cutout(src).then((u) => { big.src = u || src || ''; big.classList.toggle('is-photo', photos.has(src)); if (tops.has(src)) big.style.setProperty('--t', tops.get(src).toFixed(3)); else big.style.removeProperty('--t'); big.alt = `${x.name} ${x.sub || ''} — ${view}`; requestAnimationFrame(() => big.classList.remove('is-swap')); });
      title.textContent = x.name; dSub.textContent = vsel >= 0 && vl[vsel] ? vl[vsel].n : x.sub || ''; dPrice.textContent = x.price || ''; dPrice.hidden = !x.price; link.href = x.url;
      views.forEach((b) => { const on = b.dataset.view === view; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); b.disabled = b.dataset.view === 'back' && !x.back; });
      const col = (it) => { const t = it.dataset.tag; return t && t.toLowerCase() !== '#1b1510' ? t : SW[(it.dataset.sub || '').toLowerCase()] || t || '#1b1510'; };
      if (vl.length > 1) { // a product's own colours
        tags.innerHTML = '';
        chips.innerHTML = vl.map((v, j) => `<button type="button" class="rack__chip ${j === Math.max(0, vsel) ? 'is-on' : ''}" style="--tc:${SW[(v.n || '').toLowerCase()] || '#cbbfae'}" data-var="${j}" aria-label="${esc(v.n)}" title="${esc(v.n)}"></button>`).join('');
      } else {
        const grp = x.group ? items.map((it, k) => [it, k]).filter(([it]) => it.dataset.group === x.group) : [[items[i], i]];
        const useTags = grp.length > 1 && grp.length <= 5 && !mobile();
        tags.innerHTML = useTags ? grp.map(([it, k], n) => { const c = col(it); return `<button type="button" class="rack__tag ${k === i ? 'is-on' : ''} ${isLight(c) ? 'is-light' : ''}" style="--tc:${c};--drop:${26 + (n % 3) * 16}px" data-goto="${k}" aria-label="${esc(it.dataset.sub)}"><span>${esc(it.dataset.sub)}</span></button>`; }).join('') : '';
        chips.innerHTML = grp.length > 1 && !useTags ? grp.map(([it, k]) => `<button type="button" class="rack__chip ${k === i ? 'is-on' : ''}" style="--tc:${col(it)}" data-goto="${k}" aria-label="${esc(it.dataset.sub)}" title="${esc(it.dataset.sub)}"></button>`).join('') : '';
      }
      renderBuy(x);
      if (x.back) cutout(x.back); // warm up the back view
    }
    const panelBits = () => [...detail.querySelectorAll('.rack__panel > *:not([hidden]), .rack__tags')];
    function fly(fromEl, toEl, back) {
      if (reduce || !fromEl || !toEl) return null;
      const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
      if (!a.width || !b.width) return null;
      const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top - b.top, s = a.width / b.width;
      const from = { transform: `translate(${dx}px, ${dy}px) scale(${s})`, filter: 'drop-shadow(0 8px 10px rgba(40,28,15,.12))' };
      const to = { transform: 'translate(0,0) scale(1)', filter: 'drop-shadow(0 30px 30px rgba(40,28,15,.22))' };
      return toEl.animate(back ? [to, from] : [from, to], { duration: back ? 460 : 720, easing: EASE, fill: 'both' });
    }
    function openDetail(i) {
      portal(); view = 'front';
      const thumb = thumbs[i];
      if (thumb && thumb.classList.contains('is-cut')) { big.src = thumb.src; big.classList.toggle('is-photo', slots[i].classList.contains('is-photo')); big.style.setProperty('--t', thumb.style.getPropertyValue('--t') || '.11'); }
      show(i, false, true);
      detail.hidden = false; root.classList.add('is-open'); if (mobile()) document.documentElement.style.overflow = 'hidden';
      detail.classList.remove('is-leaving'); detail.classList.add('is-entering');
      if (!reduce) {
        detail.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: 'ease-out' });
        if (thumb) thumb.style.visibility = 'hidden';
        const f = fly(thumb, big.closest('.rack__big'));
        const done = () => { if (thumb) thumb.style.visibility = ''; detail.classList.remove('is-entering'); };
        f ? f.finished.then(() => { f.cancel(); done(); }) : done();
        panelBits().forEach((el, k) => el.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: 180 + k * 55, easing: EASE, fill: 'backwards' }));
      } else detail.classList.remove('is-entering');
      detail.querySelector('[data-close]').focus({ preventScroll: true });
    }
    function closeDetail() {
      const k = open; open = -1;
      const finish = () => { detail.hidden = true; detail.classList.remove('is-leaving'); root.classList.remove('is-open'); document.documentElement.style.overflow = ''; if (k >= 0) { thumbs[k] && (thumbs[k].style.visibility = ''); items[k].focus({ preventScroll: true }); } };
      if (reduce || k < 0) return finish();
      detail.classList.add('is-leaving');
      if (k >= 0) goTo(k, false);
      const thumb = thumbs[k], f = fly(thumb, big.closest('.rack__big'), true);
      if (thumb) thumb.style.visibility = 'hidden';
      panelBits().forEach((el) => el.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(8px)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' }).finished.then((a) => a.cancel && a.cancel()).catch(() => {}));
      const fade = detail.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 460, easing: 'ease-in', fill: 'forwards' });
      fade.finished.then(() => { fade.cancel(); f && f.cancel(); panelBits().forEach((el) => el.getAnimations().forEach((a) => a.cancel())); finish(); });
    }

    // desktop: hover brings a garment forward
    slots.forEach((s, i) => {
      s.addEventListener('mouseenter', () => { if (!mobile()) setActive(i); });
      items[i].addEventListener('focus', () => { if (!mobile()) setActive(i); });
      items[i].addEventListener('click', () => { if (mobile() && active !== i) { goTo(i); return; } openDetail(i); });
    });
    box.addEventListener('mouseleave', () => { if (!mobile()) setActive(lastActive); });
    root.querySelector('[data-prev]').addEventListener('click', () => goTo((active < 0 ? lastActive : active) - 1));
    root.querySelector('[data-next]').addEventListener('click', () => goTo((active < 0 ? lastActive : active) + 1));
    root.querySelector('[data-view-open]').addEventListener('click', () => openDetail(active < 0 ? lastActive : active));
    box.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault(); const n = Math.max(0, Math.min(items.length - 1, (active < 0 ? 0 : active) + (e.key === 'ArrowRight' ? 1 : -1))); goTo(n); items[n].focus({ preventScroll: true });
    });

    // phones: the garment nearest the centre is the active one
    let raf = 0;
    box.addEventListener('scroll', () => {
      if (!mobile() || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0; const mid = box.scrollLeft + box.clientWidth / 2; let best = 0, bd = Infinity;
        slots.forEach((s, k) => { const c = s.offsetLeft + s.offsetWidth / 2, dd = Math.abs(c - mid); if (dd < bd) { bd = dd; best = k; } });
        setActive(best);
      });
    }, { passive: true });

    detail.addEventListener('click', (e) => {
      const t = e.target.closest('[data-goto]'); if (t) { show(+t.dataset.goto); setActive(+t.dataset.goto); return; }
      const vr = e.target.closest('[data-var]'); if (vr) { vsel = +vr.dataset.var; const vv = vars(d(open))[vsel]; if (vv) { pick.c = vv.n; pick.s = null; } view = 'front'; show(open, true); return; }
      const sz = e.target.closest('[data-size]'); if (sz && !sz.disabled) { pick.s = sz.dataset.size; msg.textContent = ''; renderBuy(d(open)); return; }
      if (e.target.closest('[data-add]')) { addSelected(false); return; }
      if (e.target.closest('[data-now]')) { addSelected(true); return; }
      if (e.target.closest('[data-wish]')) { setTimeout(() => renderBuy(d(open)), 30); return; }
      const v = e.target.closest('[data-view]'); if (v && !v.disabled) { view = v.dataset.view; show(open, true); return; }
      if (e.target.closest('[data-close]') || e.target === detail) closeDetail();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open >= 0) closeDetail(); });
    // swipe left/right on the large view to change colour
    let sx = null;
    detail.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    detail.addEventListener('touchend', (e) => {
      if (sx === null || open < 0) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) < 50) return;
      const grp = items.map((it, k) => k).filter((k) => !d(open).group || d(k).group === d(open).group); const at = grp.indexOf(open);
      const nx = grp[(at + (dx < 0 ? 1 : -1) + grp.length) % grp.length]; if (nx !== open) { show(nx); setActive(nx); }
    });

    // fit every garment on the rail: idle width shrinks as more garments are added
    const fit = () => { if (mobile()) { root.style.removeProperty('--idle'); return; } const cs = getComputedStyle(box); const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); const big = Math.min(380, Math.max(300, innerWidth * .26)); const n = items.length; const idle = Math.max(30, Math.min(96, (avail - big) / Math.max(1, n - 3 + 3.4))); root.style.setProperty('--idle', idle.toFixed(1) + 'px'); };
    fit(); addEventListener('resize', fit);
    const start = Math.min(items.length - 1, Math.floor(items.length / 2));
    requestAnimationFrame(() => goTo(start, false));
  }
  const boot = () => document.querySelectorAll('[data-rack]').forEach(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  document.addEventListener('shopify:section:load', boot);
})();
