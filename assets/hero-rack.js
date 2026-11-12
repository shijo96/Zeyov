(() => {
  const SW = { black: '#17171a', white: '#f4f3f0', beige: '#decbac', brown: '#5e3b26', 'navy blue': '#1e2846', 'royal blue': '#2248a8', lavender: '#baaad6', red: '#b22228', green: '#34563c', sand: '#c8b296', grey: '#8a8a8a', gray: '#8a8a8a' };
  const light = (hex) => { const h = (hex || '').replace('#', ''); if (h.length < 6) return false; const n = parseInt(h.slice(0, 6), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 170; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function init(root) {
    if (root.dataset.ready) return; root.dataset.ready = '1';
    const slots = [...root.querySelectorAll('.rack__slot')];
    const items = slots.map((s) => s.querySelector('[data-item]'));
    if (!items.length) return;
    const cap = root.querySelector('[data-caption]'), pill = root.querySelector('[data-pill]');
    const detail = root.querySelector('[data-detail]'), big = root.querySelector('[data-big]');
    const title = root.querySelector('[data-title]'), link = root.querySelector('[data-link]');
    const tags = root.querySelector('[data-tags]'), ghosts = root.querySelector('[data-ghosts]');
    const views = [...root.querySelectorAll('[data-view]')];
    const box = root.querySelector('[data-items]');
    const touch = matchMedia('(hover: none)').matches;
    const hint = cap.textContent;
    let active = -1, open = -1, view = 'front';

    const data = (i) => items[i].dataset;
    function setActive(i) {
      if (i === active) return; active = i;
      slots.forEach((s, k) => { s.classList.toggle('is-active', k === i); s.classList.toggle('is-near', i >= 0 && Math.abs(k - i) === 1); });
      if (i < 0) { cap.textContent = hint; return; }
      const d = data(i); cap.textContent = d.sub ? `${d.name} — ${d.sub}` : d.name; pill.href = d.url;
    }
    function center(i) {
      if (box.scrollWidth <= box.clientWidth) return;
      const s = slots[i]; box.scrollTo({ left: s.offsetLeft - box.clientWidth / 2 + 100, behavior: 'smooth' });
    }

    function show(i) {
      open = i; const d = data(i);
      const img = view === 'back' && d.back ? d.back : d.front;
      big.classList.add('is-swap');
      const pre = new Image(); pre.onload = pre.onerror = () => { big.src = img || ''; big.alt = d.name; big.classList.remove('is-swap'); }; pre.src = img || '';
      title.textContent = d.name; link.href = d.url;
      views.forEach((b) => { const on = b.dataset.view === view; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); b.disabled = b.dataset.view === 'back' && !d.back; });
      // colour tags = garments in the same group (or just this one)
      const grp = d.group ? items.map((it, k) => [it, k]).filter(([it]) => it.dataset.group === d.group) : [[items[i], i]];
      tags.innerHTML = grp.map(([it, k]) => { const c = it.dataset.tag && it.dataset.tag !== '#1c1c1c' ? it.dataset.tag : (SW[(it.dataset.sub || '').toLowerCase()] || it.dataset.tag || '#1c1c1c'); return `<button type="button" class="rack__tag ${k === i ? 'is-on' : ''} ${light(c) ? 'is-light' : ''}" style="--tc:${c}" data-goto="${k}" aria-label="${esc(it.dataset.sub || it.dataset.name)}"><span>${esc(it.dataset.sub || '')}</span></button>`; }).join('');
      ghosts.innerHTML = items.filter((_, k) => k !== i).slice(0, 6).map((it) => (it.dataset.front ? `<img src="${it.dataset.front}" alt="">` : '')).join('');
    }
    function openDetail(i) { view = 'front'; show(i); detail.hidden = false; root.classList.add('is-open'); root.querySelector('[data-close]').focus({ preventScroll: true }); }
    function closeDetail() { detail.hidden = true; root.classList.remove('is-open'); if (open >= 0) items[open].focus({ preventScroll: true }); open = -1; }

    slots.forEach((s, i) => {
      s.addEventListener('mouseenter', () => { if (!touch) setActive(i); });
      items[i].addEventListener('focus', () => setActive(i));
      items[i].addEventListener('click', () => {
        if (touch && active !== i) { setActive(i); center(i); return; }
        openDetail(i);
      });
    });
    box.addEventListener('mouseleave', () => { if (!touch) setActive(-1); });
    box.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault(); const n = Math.max(0, Math.min(items.length - 1, (active < 0 ? 0 : active) + (e.key === 'ArrowRight' ? 1 : -1))); items[n].focus();
    });
    detail.addEventListener('click', (e) => {
      const t = e.target.closest('[data-goto]'); if (t) { show(+t.dataset.goto); setActive(+t.dataset.goto); return; }
      const v = e.target.closest('[data-view]'); if (v && !v.disabled) { view = v.dataset.view; show(open); return; }
      if (e.target.closest('[data-close]') || e.target === detail || e.target.closest('[data-ghosts]')) closeDetail();
    });
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open >= 0) closeDetail(); });
    if (touch) { const mid = Math.floor(items.length / 2); setActive(mid); requestAnimationFrame(() => center(mid)); }
  }
  const boot = () => document.querySelectorAll('[data-rack]').forEach(init);
  boot();
  document.addEventListener('shopify:section:load', boot);
})();
