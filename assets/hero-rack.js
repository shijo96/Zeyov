(() => {
  const SW = { black: '#17171a', white: '#f4f3f0', beige: '#decbac', brown: '#5e3b26', 'navy blue': '#1e2846', 'royal blue': '#2248a8', lavender: '#baaad6', red: '#b22228', green: '#34563c', sand: '#c8b296', grey: '#8a8a8a', gray: '#8a8a8a' };
  const isLight = (hex) => { const h = (hex || '').replace('#', ''); if (h.length < 6) return false; const n = parseInt(h.slice(0, 6), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 165; };
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');

  /* ---- remove plain white photo backgrounds so garments look like real cut-outs ---- */
  const cache = new Map();
  function cutout(url, maxW = 1000) {
    if (!url) return Promise.resolve('');
    const key = url + '|' + maxW; if (cache.has(key)) return cache.get(key);
    const job = new Promise((resolve) => {
      const img = new Image(); img.crossOrigin = 'anonymous'; img.decoding = 'async';
      img.onload = () => {
        try {
          const sc = Math.min(1, maxW / img.naturalWidth), w = Math.round(img.naturalWidth * sc), h = Math.round(img.naturalHeight * sc);
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
          const id = g.getImageData(0, 0, w, h), d = id.data;
          const bgLike = (i) => d[i] > 244 && d[i + 1] > 244 && d[i + 2] > 244 && Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) < 10;
          const seen = new Uint8Array(w * h), stack = [];
          const push = (x, y) => { const p = y * w + x; if (!seen[p] && bgLike(p * 4)) { seen[p] = 1; stack.push(p); } };
          for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
          for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
          if (stack.length < (w + h)) { resolve(url); return; } // not a white-background photo
          while (stack.length) { const p = stack.pop(), x = p % w, y = (p - x) / w; d[p * 4 + 3] = 0; if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1); }
          // soften the edge: partially fade very light pixels that touch the removed background
          for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
            const p = y * w + x; if (seen[p]) continue;
            if (seen[p - 1] || seen[p + 1] || seen[p - w] || seen[p + w]) { const i = p * 4, l = (d[i] + d[i + 1] + d[i + 2]) / 3; if (l > 205) d[i + 3] = Math.max(40, 255 - (l - 205) * 4.2); }
          }
          g.putImageData(id, 0, 0);
          c.toBlob((b) => resolve(b ? URL.createObjectURL(b) : url), 'image/png');
        } catch (e) { resolve(url); }
      };
      img.onerror = () => resolve(url);
      img.src = url;
    });
    cache.set(key, job); return job;
  }

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
    const mobile = () => matchMedia('(max-width: 899px)').matches;
    const hint = nameOut.textContent;
    let active = -1, open = -1, view = 'front', lastActive = 0;
    const d = (i) => items[i].dataset;

    // cut-out every thumbnail (lazy-ish: visible first)
    const thumbs = items.map((it) => it.querySelector('img.rack__img'));
    const cutThumb = (k) => { const im = thumbs[k]; if (!im || im.dataset.cut) return; im.dataset.cut = '1'; cutout(items[k].dataset.thumb || im.src, 440).then((u) => { if (u) im.src = u; im.classList.add('is-cut'); }); };
    const mid0 = Math.floor(items.length / 2); [mid0, mid0 - 1, mid0 + 1].filter((k) => k >= 0 && k < items.length).forEach(cutThumb);
    if ('IntersectionObserver' in window) { const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { cutThumb(slots.indexOf(e.target)); io.unobserve(e.target); } }), { root: null, rootMargin: '200px' }); slots.forEach((s) => io.observe(s)); }
    else items.forEach((_, k) => cutThumb(k));

    function setActive(i) {
      if (i === active) return; active = i; if (i >= 0) lastActive = i;
      slots.forEach((s, k) => { s.classList.toggle('is-active', k === i); s.classList.toggle('is-near', i >= 0 && Math.abs(k - i) === 1); });
      if (i < 0) { nameOut.textContent = hint; meta.innerHTML = '&nbsp;'; return; }
      const x = d(i); nameOut.textContent = x.name; meta.innerHTML = [esc(x.sub), x.price ? `<em>${esc(x.price)}</em>` : ''].filter(Boolean).join(' · ') || '&nbsp;';
      pill.href = x.url; count.textContent = pad(i + 1);
    }
    function goTo(i, smooth = true) {
      i = (i + items.length) % items.length;
      if (mobile()) { const s = slots[i]; box.scrollTo({ left: s.offsetLeft + s.offsetWidth / 2 - box.clientWidth / 2, behavior: smooth ? 'smooth' : 'auto' }); }
      setActive(i);
    }

    // detail view
    function show(i) {
      open = i; const x = d(i);
      const src = view === 'back' && x.back ? x.back : x.front;
      big.classList.add('is-swap');
      cutout(src).then((u) => { big.src = u || src || ''; big.alt = `${x.name} ${x.sub || ''} — ${view}`; requestAnimationFrame(() => big.classList.remove('is-swap')); });
      title.textContent = x.name; dSub.textContent = x.sub || ''; dPrice.textContent = x.price || ''; dPrice.hidden = !x.price; link.href = x.url;
      views.forEach((b) => { const on = b.dataset.view === view; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); b.disabled = b.dataset.view === 'back' && !x.back; });
      const grp = x.group ? items.map((it, k) => [it, k]).filter(([it]) => it.dataset.group === x.group) : [[items[i], i]];
      const col = (it) => { const t = it.dataset.tag; return t && t.toLowerCase() !== '#1b1510' ? t : SW[(it.dataset.sub || '').toLowerCase()] || t || '#1b1510'; };
      const useTags = grp.length > 1 && grp.length <= 5 && !mobile();
      tags.innerHTML = useTags ? grp.map(([it, k], n) => { const c = col(it); return `<button type="button" class="rack__tag ${k === i ? 'is-on' : ''} ${isLight(c) ? 'is-light' : ''}" style="--tc:${c};--drop:${26 + (n % 3) * 16}px" data-goto="${k}" aria-label="${esc(it.dataset.sub)}"><span>${esc(it.dataset.sub)}</span></button>`; }).join('') : '';
      chips.innerHTML = grp.length > 1 && !useTags ? grp.map(([it, k]) => `<button type="button" class="rack__chip ${k === i ? 'is-on' : ''}" style="--tc:${col(it)}" data-goto="${k}" aria-label="${esc(it.dataset.sub)}" title="${esc(it.dataset.sub)}"></button>`).join('') : '';
      if (x.back) cutout(x.back); // warm up the back view
    }
    function openDetail(i) { view = 'front'; show(i); detail.hidden = false; root.classList.add('is-open'); $('[data-close]').focus({ preventScroll: true }); }
    function closeDetail() { detail.hidden = true; root.classList.remove('is-open'); const k = open; open = -1; if (k >= 0) { goTo(k, false); items[k].focus({ preventScroll: true }); } }

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
      const v = e.target.closest('[data-view]'); if (v && !v.disabled) { view = v.dataset.view; show(open); return; }
      if (e.target.closest('[data-close]') || e.target === detail) closeDetail();
    });
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open >= 0) closeDetail(); });
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
