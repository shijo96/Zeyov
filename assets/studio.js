/* ZEYOV Studio — design editor for print-on-demand tees.
   Customer designs front/back, picks tee, print type and size quantities; everything is added to the
   Shopify cart with full print details (files, sizes in inches, placement) on each order line. */
(() => {
  'use strict';
  const root = document.querySelector('[data-zs]');
  if (!root) return;
  const CFG = JSON.parse(root.querySelector('[data-zs-config]').textContent);
  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (c) => (window.ZeyovTheme && window.ZeyovTheme.money) ? window.ZeyovTheme.money(c) : '₹' + Math.round(c / 100).toLocaleString('en-IN');
  const toast = (m) => { const t = document.getElementById('Toast'); if (!t) return; t.textContent = m; t.classList.add('is-on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('is-on'), 2600); };
  const uid = () => Math.random().toString(36).slice(2, 9);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt = (n) => (Math.round(n * 10) / 10).toFixed(1);
  const slug = (s) => s.toLowerCase().replace(/\s+/g, '-');

  /* ---------- constants ---------- */
  const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const SWATCH = CFG.swatches;
  const PALETTE = ['#111111', '#FFFFFF', '#C0392B', '#E67E22', '#F1C40F', '#27AE60', '#1F4FBF', '#7D3CBF', '#8E8E8E', '#C9973F'];
  const FONTS = ['Archivo Black', 'Anton', 'Bebas Neue', 'Oswald', 'Poppins', 'Montserrat', 'Playfair Display', 'Pacifico', 'Permanent Marker', 'Graduate', 'Shrikhand', 'Black Ops One', 'UnifrakturMaguntia', 'Bungee', 'Lobster', 'Caveat'];
  const STYLES = {
    Classic: { font: 'Archivo Black', fill: '#111111', outline: null, outlineOnly: false, curve: 0, spacing: 0 },
    Varsity: { font: 'Graduate', fill: '#C0392B', outline: '#FFFFFF', outlineOnly: false, curve: 35, spacing: 2 },
    Retro: { font: 'Shrikhand', fill: '#E67E22', outline: '#111111', outlineOnly: false, curve: 20, spacing: 0 },
    Street: { font: 'Permanent Marker', fill: '#111111', outline: null, outlineOnly: false, curve: 0, spacing: 1 },
    Gothic: { font: 'UnifrakturMaguntia', fill: '#111111', outline: null, outlineOnly: false, curve: 0, spacing: 0 },
    Badge: { font: 'Black Ops One', fill: '#C9973F', outline: '#111111', outlineOnly: false, curve: 0, spacing: 3 },
    Hollow: { font: 'Anton', fill: '#111111', outline: '#111111', outlineOnly: true, curve: 0, spacing: 2 }
  };
  // Print areas on the 800 x 1000 mockup (px) and their size in inches (size M).
  const PX_PER_IN = 20.3;
  // print area sized like the reference: ~88% of the torso width, from below the collar to near the hem
  const AREA = {
    oversized: { front: { x: 190, y: 225, w: 420, h: 630 }, back: { x: 190, y: 185, w: 420, h: 670 } },
    regular: { front: { x: 194, y: 220, w: 412, h: 630 }, back: { x: 194, y: 180, w: 412, h: 670 } }
  };
  const PRESETS = [
    ['Left chest', { w: 3.5, x: 0.68, y: 0.12 }], ['Centre chest', { w: 4, x: 0.5, y: 0.12 }],
    ['A6', { w: 4.1 }], ['A5', { w: 5.8 }], ['A4', { w: 8.3 }], ['Full front · A3', { w: 11.7 }], ['Max · A2', { w: 99 }]
  ];
  const PAPER = [['Logo', 3.5, 3.5], ['A6', 4.1, 5.8], ['A5', 5.8, 8.3], ['A4', 8.3, 11.7], ['A3', 11.7, 16.5], ['A2', 16.5, 23.4]];

  /* ---------- state ---------- */
  const st = {
    base: CFG.bases[0].key, color: CFG.bases[0].colors[0], side: 'front',
    layers: [], sel: null, assets: {},
    print: { front: 'DTF', back: 'DTF' }, files: {}, qty: { XS: 0, S: 0, M: 1, L: 0, XL: 0, XXL: 0 }, label: false, showArea: true
  };
  const hist = { past: [], future: [] };
  const snap = () => JSON.stringify({ layers: st.layers, print: st.print });
  function commit() { hist.past.push(snap()); if (hist.past.length > 60) hist.past.shift(); hist.future = []; syncUndo(); }
  function restore(s) { const o = JSON.parse(s); st.layers = o.layers; st.print = o.print; if (!st.layers.find((l) => l.id === st.sel)) st.sel = null; renderAll(); }
  function undo() { if (!hist.past.length) return; hist.future.push(snap()); restore(hist.past.pop()); syncUndo(); }
  function redo() { if (!hist.future.length) return; hist.past.push(snap()); restore(hist.future.pop()); syncUndo(); }
  function syncUndo() { $('[data-undo]').disabled = !hist.past.length; $('[data-redo]').disabled = !hist.future.length; }

  const base = () => CFG.bases.find((b) => b.key === st.base);
  const area = (side = st.side) => AREA[base().fit][side];
  const areaIn = (side = st.side) => ({ w: area(side).w / PX_PER_IN, h: area(side).h / PX_PER_IN });
  const sel = () => st.layers.find((l) => l.id === st.sel);
  const sideLayers = (side = st.side) => st.layers.filter((l) => l.side === side);
  const PHOTOS = CFG.photos || {};
  const teePhoto = (handle, color, side) => { const o = PHOTOS[`${handle}|${color}`]; return (o && o[side]) || `${CFG.assetBase}st-${handle}-${slug(color)}-${side}.webp`; };
  const mockSrc = (side = st.side) => teePhoto(base().handle, st.color, side);
  // admin fine-tuning for uploaded photos: zoom % and move x/y % so the tee lines up with the print area
  const photoFit = (handle, color) => { const o = PHOTOS[`${handle}|${color}`]; return o ? { z: (o.z || 100) / 100, x: o.x || 0, y: o.y || 0 } : { z: 1, x: 0, y: 0 }; };
  const fitCSS = (handle, color) => { const f = photoFit(handle, color); return f.z === 1 && !f.x && !f.y ? '' : `translate(${f.x}%, ${f.y}%) scale(${f.z})`; };

  /* ---------- text rendering (canvas) ---------- */
  const fontReady = {};
  async function ensureFont(f, bold, italic) {
    const key = f + bold + italic; if (fontReady[key]) return;
    try { await document.fonts.load(`${italic ? 'italic ' : ''}${bold ? '700 ' : '400 '}64px "${f}"`); } catch (e) { /* fallback font */ }
    fontReady[key] = true;
  }
  function caseText(l) {
    const t = l.text || ' ';
    if (l.textCase === 'upper') return t.toUpperCase();
    if (l.textCase === 'lower') return t.toLowerCase();
    if (l.textCase === 'title') return t.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
    return t;
  }
  // Renders a text layer at `ppi` pixels per inch, returns {canvas, aspect}
  function renderText(l, ppi) {
    const size = 1.2 * ppi; // base font size: 1.2 in cap height approx
    const font = `${l.italic ? 'italic ' : ''}${l.bold ? '700 ' : '400 '}${size}px "${l.font}", sans-serif`;
    const lines = caseText(l).split('\n');
    const m = document.createElement('canvas').getContext('2d');
    m.font = font; if ('letterSpacing' in m) m.letterSpacing = `${l.spacing * size / 20}px`;
    const lw = lines.map((s) => m.measureText(s).width + Math.max(0, s.length - 1) * ('letterSpacing' in m ? 0 : l.spacing * size / 20));
    const lineH = size * 1.15;
    const pad = size * 0.25 + (l.outline ? size * 0.08 : 0);
    let W = Math.max(...lw) + pad * 2; let H = lineH * lines.length + pad * 2;
    const curve = l.curve || 0; // -100..100
    let R = 0;
    if (curve && lines.length === 1) { R = (W * 100) / (Math.abs(curve) * Math.PI / 1.2); H += Math.min(W, W * W / (8 * R)) + size * 0.2; }
    const c = document.createElement('canvas'); c.width = Math.ceil(W); c.height = Math.ceil(H);
    const g = c.getContext('2d'); g.font = font; g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = `${l.spacing * size / 20}px`;
    let fill = l.fill;
    if (l.gradient) { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, l.fill); gr.addColorStop(1, l.fill2 || '#C9973F'); fill = gr; }
    g.fillStyle = fill; g.lineJoin = 'round'; g.strokeStyle = l.outline || l.fill; g.lineWidth = size * (l.outlineOnly ? 0.06 : 0.12);
    const drawRun = (s, x, y) => { if (l.outline || l.outlineOnly) g.strokeText(s, x, y); if (!l.outlineOnly) g.fillText(s, x, y); };
    if (R) {
      const s = lines[0]; const chars = [...s];
      const widths = chars.map((ch) => g.measureText(ch).width + ('letterSpacing' in g ? 0 : l.spacing * size / 20));
      const total = widths.reduce((a, b) => a + b, 0);
      const dir = curve > 0 ? 1 : -1;
      const cx = W / 2; const cy = dir > 0 ? R + pad + size * 0.6 : H - R - pad - size * 0.6;
      let ang = -total / 2 / R;
      g.textAlign = 'center';
      chars.forEach((ch, i) => {
        const a = ang + widths[i] / 2 / R;
        g.save(); g.translate(cx + Math.sin(a) * R, cy - dir * Math.cos(a) * R); g.rotate(dir * a); drawRun(ch, 0, 0); g.restore();
        ang += widths[i] / R;
      });
    } else {
      g.textAlign = l.align || 'center';
      const x = l.align === 'left' ? pad : l.align === 'right' ? W - pad : W / 2;
      lines.forEach((s, i) => drawRun(s, x, pad + lineH * (i + 0.5)));
    }
    return { canvas: trim(c), aspect: 0 };
  }
  function trim(c) {
    const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width; let y0 = c.height; let x1 = 0; let y1 = 0;
    for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) if (d[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0) return c;
    const p = 4; x0 = Math.max(0, x0 - p); y0 = Math.max(0, y0 - p); x1 = Math.min(c.width, x1 + p); y1 = Math.min(c.height, y1 + p);
    const o = document.createElement('canvas'); o.width = x1 - x0; o.height = y1 - y0; o.getContext('2d').drawImage(c, -x0, -y0); return o;
  }
  async function refreshText(l) {
    await ensureFont(l.font, l.bold, l.italic);
    const { canvas } = renderText(l, 60);
    l.aspect = canvas.height / canvas.width;
    st.assets[l.id] = canvas.toDataURL('image/png');
  }

  /* ---------- canvas view ---------- */
  const stage = $('[data-stage]'); const mock = $('[data-mock]'); const areaEl = $('[data-area]'); const layersEl = $('[data-layers]');
  function scale() { return stage.clientWidth / 800; }
  function placeArea() {
    const a = area(); const s = scale();
    Object.assign(areaEl.style, { left: a.x * s + 'px', top: a.y * s + 'px', width: a.w * s + 'px', height: a.h * s + 'px' });
    areaEl.hidden = !st.showArea;
  }
  function layerBox(l) {
    const a = area(l.side); const s = scale();
    const w = l.w * PX_PER_IN * s; const h = w * (l.aspect || 1);
    return { cx: (a.x + l.x * PX_PER_IN) * s, cy: (a.y + l.y * PX_PER_IN) * s, w, h };
  }
  function renderStage() {
    mock.src = mockSrc(); mock.style.transform = fitCSS(base().handle, st.color);
    placeArea();
    layersEl.innerHTML = sideLayers().map((l) => {
      const b = layerBox(l);
      const src = l.type === 'image' ? st.assets[l.src] : st.assets[l.id];
      return `<div class="zs-layer ${l.id === st.sel ? 'is-sel' : ''}" data-layer="${l.id}" style="left:${b.cx}px;top:${b.cy}px;width:${b.w}px;height:${b.h}px;transform:translate(-50%,-50%) rotate(${l.rot}deg)">
        <img src="${src || ''}" alt="" draggable="false" style="transform:scaleX(${l.flip ? -1 : 1})">
        ${l.id === st.sel ? '<i class="zs-h nw" data-h="nw"></i><i class="zs-h ne" data-h="ne"></i><i class="zs-h sw" data-h="sw"></i><i class="zs-h se" data-h="se"></i><i class="zs-rot" data-h="rot"></i><button type="button" class="zs-del" data-del>✕ Delete</button>' : ''}
      </div>`;
    }).join('');
    $$('[data-side]').forEach((b) => {
      const n = sideLayers(b.dataset.side).length;
      b.classList.toggle('is-active', b.dataset.side === st.side); b.setAttribute('aria-selected', b.dataset.side === st.side);
      b.querySelector('i').textContent = n || ''; b.querySelector('i').hidden = !n;
    });
    renderThumbs();
  }
  function renderThumbs() {
    $$('[data-thumb-side]').forEach((t) => {
      const side = t.dataset.thumbSide;
      t.classList.toggle('is-active', side === st.side);
      t.querySelector('img').src = mockSrc(side); t.querySelector('img').style.transform = fitCSS(base().handle, st.color);
      t.querySelector('.zs-thumb__layers').innerHTML = sideLayers(side).map((l) => {
        const a = AREA[base().fit][side];
        const w = (l.w * PX_PER_IN) / 8; const h = w * (l.aspect || 1);
        return `<img src="${(l.type === 'image' ? st.assets[l.src] : st.assets[l.id]) || ''}" alt="" style="left:${(a.x + l.x * PX_PER_IN) / 8}%;top:${(a.y + l.y * PX_PER_IN) / 10}%;width:${w}%;transform:translate(-50%,-50%) rotate(${l.rot}deg) scaleX(${l.flip ? -1 : 1})">`;
      }).join('');
      void 0;
    });
  }

  /* ---------- pointer: move / resize / rotate ---------- */
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    const del = e.target.closest('[data-del]'); if (del) { removeLayer(st.sel); return; }
    const el = e.target.closest('[data-layer]');
    if (!el) { if (st.sel) { st.sel = null; renderAll(); } return; }
    const l = st.layers.find((x) => x.id === el.dataset.layer); if (!l) return;
    if (st.sel !== l.id) { st.sel = l.id; renderAll(); }
    const h = e.target.dataset.h || 'move';
    const r = stage.getBoundingClientRect(); const b = layerBox(l);
    drag = { l, h, sx: e.clientX, sy: e.clientY, x: l.x, y: l.y, w: l.w, rot: l.rot, cx: r.left + b.cx, cy: r.top + b.cy, d0: Math.hypot(e.clientX - (r.left + b.cx), e.clientY - (r.top + b.cy)), moved: false };
    stage.setPointerCapture(e.pointerId); e.preventDefault();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const { l } = drag; const s = scale(); const ai = areaIn(l.side);
    if (!drag.moved) { commit(); drag.moved = true; }
    if (drag.h === 'move') {
      l.x = clamp(drag.x + (e.clientX - drag.sx) / s / PX_PER_IN, 0, ai.w);
      l.y = clamp(drag.y + (e.clientY - drag.sy) / s / PX_PER_IN, 0, ai.h);
      // snap to centre line
      if (Math.abs(l.x - ai.w / 2) < 0.25) l.x = ai.w / 2;
    } else if (drag.h === 'rot') {
      let a = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx) * 180 / Math.PI + 90;
      a = Math.round(a); if (Math.abs(a % 90) < 4) a = Math.round(a / 90) * 90; l.rot = ((a % 360) + 360) % 360; if (l.rot > 180) l.rot -= 360;
    } else {
      const d = Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy);
      l.w = clampW(l, drag.w * d / Math.max(10, drag.d0));
    }
    renderStage(); syncAdjust(true);
  });
  const endDrag = () => { if (drag) { drag = null; renderQuote(); } };
  stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', () => renderStage());
  function clampW(l, w) { const ai = areaIn(l.side); const maxW = Math.min(ai.w, ai.h / (l.aspect || 1)); return clamp(w, 0.8, maxW); }

  /* ---------- layers ---------- */
  async function addText() {
    commit();
    const ai = areaIn();
    const l = { id: uid(), type: 'text', side: st.side, text: 'YOUR TEXT', font: 'Archivo Black', bold: false, italic: false, align: 'center', textCase: 'as', fill: '#111111', fill2: '#C9973F', gradient: false, outline: null, outlineOnly: false, curve: 0, spacing: 0, x: ai.w / 2, y: Math.min(3, ai.h / 4), w: Math.min(10, ai.w * 0.7), rot: 0, flip: false };
    if (/black|navy|royal|green|red/i.test(st.color)) l.fill = '#FFFFFF';
    await refreshText(l); st.layers.push(l); st.sel = l.id; renderAll();
    if (window.matchMedia('(min-width: 990px)').matches) { const ta = $('[data-adj-text]'); if (ta) { ta.focus({ preventScroll: true }); ta.select(); } }
    else stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function addImage(file) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast('File is over 25 MB. Please use a smaller file.'); return; }
    if (!/image\/(png|jpe?g|webp|svg\+xml)/.test(file.type)) { toast('Please upload PNG, JPG, WEBP or SVG.'); return; }
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        commit();
        const key = 'a' + uid(); st.assets[key] = rd.result; st.files[key] = file;
        const ai = areaIn(); const aspect = (img.naturalHeight || 1) / (img.naturalWidth || 1);
        const l = { id: uid(), type: 'image', side: st.side, src: key, name: file.name, svg: /svg/.test(file.type), natW: img.naturalWidth, natH: img.naturalHeight, aspect, x: ai.w / 2, y: 0, w: 8.3, rot: 0, flip: false };
        l.w = clampW(l, 8.3); l.y = Math.min(ai.h / 2, l.w * aspect / 2 + 1);
        st.layers.push(l); st.sel = l.id; renderAll();
        if (!window.matchMedia('(min-width: 990px)').matches) stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const dpi = img.naturalWidth / l.w;
        if (img.naturalWidth && dpi < 150 && file.type !== 'image/svg+xml') toast(`Low resolution for this size (${Math.round(dpi)} DPI). Use a bigger image for a sharp print.`);
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }
  function removeLayer(id) { commit(); st.layers = st.layers.filter((l) => l.id !== id); if (st.sel === id) st.sel = null; renderAll(); }
  function moveLayer(id, dir) {
    commit(); const i = st.layers.findIndex((l) => l.id === id); const j = i + dir;
    if (j < 0 || j >= st.layers.length) return; [st.layers[i], st.layers[j]] = [st.layers[j], st.layers[i]]; renderAll();
  }
  function renderLayerList() {
    const list = sideLayers();
    $('[data-layer-list]').innerHTML = list.length ? list.slice().reverse().map((l) => {
      const src = l.type === 'image' ? st.assets[l.src] : st.assets[l.id];
      const label = l.type === 'image' ? esc(l.name || 'Image') : '“' + esc((l.text || '').slice(0, 24)) + '”';
      return `<div class="zs-li ${l.id === st.sel ? 'is-sel' : ''}" data-pick="${l.id}"><span class="zs-li__img"><img src="${src || ''}" alt=""></span><span class="zs-li__t"><b>${label}</b><small>${fmt(l.w)} × ${fmt(l.w * (l.aspect || 1))} in</small></span>
        <button type="button" data-up="${l.id}" aria-label="Bring forward">▲</button><button type="button" data-down="${l.id}" aria-label="Send back">▼</button><button type="button" data-rm="${l.id}" aria-label="Delete">✕</button></div>`;
    }).join('') : '';
    $('[data-side-label]').textContent = st.side === 'front' ? 'Front' : 'Back';
  }

  /* ---------- adjust panel ---------- */
  const adj = $('[data-adjust]');
  function swatches(name, cur, extra = '') {
    return `<div class="zs-sw">${extra}${PALETTE.map((c) => `<button type="button" class="${(cur || '').toLowerCase() === c.toLowerCase() ? 'is-on' : ''}" data-${name}="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}<label class="zs-sw__pick" title="Custom colour"><input type="color" data-${name}-pick value="${/^#/.test(cur || '') ? cur : '#111111'}"></label></div>`;
  }
  function renderAdjust() {
    const l = sel();
    adj.hidden = !l;
    if (!l) return;
    const ai = areaIn(l.side);
    const maxW = Math.min(ai.w, ai.h / (l.aspect || 1));
    let html = `<div class="zs-card__head"><span class="zs-num">3</span><h2>Adjust <em>${l.type === 'text' ? '“' + esc((l.text || '').slice(0, 18)) + '”' : esc(l.name || 'image')}</em></h2></div>`;
    if (l.type === 'text') {
      html += `<label class="zs-lbl" for="ZsText">Text</label><textarea id="ZsText" class="input zs-ta" data-adj-text rows="2">${esc(l.text)}</textarea>
      <div class="zs-row"><details class="zs-fontpick"><summary aria-label="Font: ${esc(l.font)}"><small>Font</small><span style="font-family:'${l.font}'">${esc(l.font)}</span></summary>
          <div class="zs-fonts" role="listbox" aria-label="Choose font">${FONTS.map((f) => `<button type="button" role="option" aria-selected="${f === l.font}" data-font-pick="${f}" class="${f === l.font ? 'is-on' : ''}"><span style="font-family:'${f}'">${esc((l.text || 'Zeyov').split('\n')[0].slice(0, 14) || 'Zeyov')}</span><small>${f}</small></button>`).join('')}</div></details>
        <div class="zs-seg"><button type="button" data-tog="bold" class="${l.bold ? 'is-on' : ''}" aria-label="Bold"><b>B</b></button><button type="button" data-tog="italic" class="${l.italic ? 'is-on' : ''}" aria-label="Italic"><i>I</i></button>
        ${['left', 'center', 'right'].map((a) => `<button type="button" data-align="${a}" class="${l.align === a ? 'is-on' : ''}" aria-label="Align ${a}"><span class="zs-al zs-al--${a}"></span></button>`).join('')}</div></div>
      <div class="zs-chips">${[['as', 'As typed'], ['upper', 'UPPERCASE'], ['lower', 'lowercase'], ['title', 'Title Case']].map(([k, t]) => `<button type="button" data-case="${k}" class="${l.textCase === k ? 'is-on' : ''}">${t}</button>`).join('')}</div>
      <p class="zs-lbl">Quick styles</p><div class="zs-styles">${Object.keys(STYLES).map((k) => `<button type="button" data-style="${k}" style="font-family:'${STYLES[k].font}'">${k}</button>`).join('')}</div>
      <p class="zs-lbl">Text colour</p>${swatches('fill', l.fill)}
      <label class="zs-check"><input type="checkbox" data-grad ${l.gradient ? 'checked' : ''}> Gradient <small>(top colour → bottom colour)</small></label>
      ${l.gradient ? `<p class="zs-lbl">Bottom colour</p>${swatches('fill2', l.fill2)}` : ''}
      <p class="zs-lbl">Outline</p>${swatches('outline', l.outline, `<button type="button" class="zs-none ${!l.outline ? 'is-on' : ''}" data-outline="" aria-label="No outline"></button>`)}
      <label class="zs-check"><input type="checkbox" data-hollow ${l.outlineOnly ? 'checked' : ''}> Outline only <small>(hollow letters)</small></label>
      <div class="zs-range"><span>Curve</span><small>${l.curve ? (l.curve > 0 ? 'Arch ' : 'Smile ') + Math.abs(l.curve) : 'Straight'}</small><input type="range" min="-100" max="100" value="${l.curve}" data-curve aria-label="Curve"></div>
      <div class="zs-range"><span>Letter spacing</span><small>${l.spacing}</small><input type="range" min="-2" max="20" value="${l.spacing}" data-spacing aria-label="Letter spacing"></div>`;
    }
    html += `<div class="zs-chips">${PRESETS.map(([n]) => `<button type="button" data-preset="${n}">${n}</button>`).join('')}</div>
      <div class="zs-range"><span>Size</span><small data-size-out>${fmt(l.w)} × ${fmt(l.w * (l.aspect || 1))} in</small><input type="range" min="0.8" max="${fmt(maxW)}" step="0.1" value="${l.w}" data-w aria-label="Size"></div>
      <div class="zs-range"><span>Rotate</span><small data-rot-out>${Math.round(l.rot)}°</small><input type="range" min="-180" max="180" value="${l.rot}" data-rot aria-label="Rotate"></div>
      <div class="zs-chips"><button type="button" data-act="centre">Centre</button><button type="button" data-act="flip">Flip</button><button type="button" data-act="fit">Fit area</button><button type="button" data-act="dup">Duplicate</button><button type="button" data-act="copy">Copy to ${l.side === 'front' ? 'back' : 'front'}</button><button type="button" data-act="del" class="zs-danger">✕ Delete</button></div>
      ${l.type === 'text' ? '<p class="zs-note ok">Text prints crisp at any size.</p>' : dpiNote(l)}`;
    adj.innerHTML = html;
  }
  function dpiNote(l) {
    if (!l.natW || l.svg) return '<p class="zs-note ok">Vector artwork prints sharp at any size.</p>';
    const dpi = Math.round(l.natW / l.w);
    return dpi >= 200 ? `<p class="zs-note ok">Great quality at this size (${dpi} DPI).</p>` : dpi >= 120 ? `<p class="zs-note warn">OK quality (${dpi} DPI). A larger image prints sharper.</p>` : `<p class="zs-note bad">Low quality (${dpi} DPI). Reduce the size or upload a bigger image.</p>`;
  }
  function syncAdjust(soft) {
    const l = sel(); if (!l) return;
    if (!soft) { renderAdjust(); return; }
    const so = $('[data-size-out]', adj); if (so) so.textContent = `${fmt(l.w)} × ${fmt(l.w * (l.aspect || 1))} in`;
    const w = $('[data-w]', adj); if (w && document.activeElement !== w) w.value = l.w;
    const r = $('[data-rot]', adj); if (r && document.activeElement !== r) r.value = l.rot;
    const ro = $('[data-rot-out]', adj); if (ro) ro.textContent = Math.round(l.rot) + '°';
  }
  let textTimer;
  async function updText(patch, rebuild = true) {
    const l = sel(); if (!l) return;
    commit(); Object.assign(l, patch);
    await refreshText(l); l.w = clampW(l, l.w);
    renderStage(); renderLayerList(); renderQuote(); if (rebuild) renderAdjust(); else syncAdjust(true);
  }
  adj.addEventListener('input', (e) => {
    const l = sel(); if (!l) return; const t = e.target;
    if (t.matches('[data-adj-text]')) { clearTimeout(textTimer); textTimer = setTimeout(() => updText({ text: t.value }, false), 150); }
    else if (t.matches('[data-w]')) { l.w = clampW(l, parseFloat(t.value)); renderStage(); syncAdjust(true); renderLayerList(); }
    else if (t.matches('[data-rot]')) { l.rot = parseFloat(t.value); renderStage(); syncAdjust(true); }
    else if (t.matches('[data-curve]')) { t.previousElementSibling.textContent = t.value == 0 ? 'Straight' : (t.value > 0 ? 'Arch ' : 'Smile ') + Math.abs(t.value); clearTimeout(textTimer); textTimer = setTimeout(() => updText({ curve: parseInt(t.value, 10) }, false), 80); }
    else if (t.matches('[data-spacing]')) { t.previousElementSibling.textContent = t.value; clearTimeout(textTimer); textTimer = setTimeout(() => updText({ spacing: parseInt(t.value, 10) }, false), 80); }
    else if (t.matches('[data-fill-pick]')) updText({ fill: t.value }, false);
    else if (t.matches('[data-fill2-pick]')) updText({ fill2: t.value }, false);
    else if (t.matches('[data-outline-pick]')) updText({ outline: t.value }, false);
  });
  adj.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-font]')) updText({ font: t.value });
    else if (t.matches('[data-grad]')) updText({ gradient: t.checked });
    else if (t.matches('[data-hollow]')) updText({ outlineOnly: t.checked, outline: t.checked ? (sel().outline || sel().fill) : sel().outline });
    else if (t.matches('[data-w],[data-rot]')) { commit(); renderQuote(); }
  });
  adj.addEventListener('click', (e) => {
    const l = sel(); if (!l) return; const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.fontPick) updText({ font: d.fontPick });
    else if (d.tog) updText({ [d.tog]: !l[d.tog] });
    else if (d.align) updText({ align: d.align });
    else if (d.case) updText({ textCase: d.case });
    else if (d.style) updText(Object.assign({}, STYLES[d.style], /black|navy|royal|green|red/i.test(st.color) && d.style !== 'Badge' ? { fill: '#FFFFFF', outline: STYLES[d.style].outline === '#FFFFFF' ? '#111111' : STYLES[d.style].outline } : {}));
    else if (d.fill !== undefined) updText({ fill: d.fill });
    else if (d.fill2 !== undefined) updText({ fill2: d.fill2 });
    else if (d.outline !== undefined) updText({ outline: d.outline || null, outlineOnly: d.outline ? l.outlineOnly : false });
    else if (d.preset) applyPreset(l, d.preset);
    else if (d.act) action(l, d.act);
  });
  function applyPreset(l, name) {
    commit(); const p = PRESETS.find((x) => x[0] === name)[1]; const ai = areaIn(l.side);
    l.w = clampW(l, p.w); const h = l.w * (l.aspect || 1);
    l.x = p.x != null ? ai.w * p.x : ai.w / 2;
    l.y = p.y != null ? Math.max(h / 2, ai.h * p.y) : Math.max(h / 2 + 0.5, Math.min(ai.h / 2, h / 2 + 1.5));
    renderAll();
  }
  function action(l, a) {
    const ai = areaIn(l.side);
    if (a === 'del') return removeLayer(l.id);
    commit();
    if (a === 'centre') { l.x = ai.w / 2; }
    if (a === 'flip') { l.flip = !l.flip; }
    if (a === 'fit') { l.rot = 0; l.w = Math.min(ai.w, ai.h / (l.aspect || 1)); l.x = ai.w / 2; l.y = l.w * (l.aspect || 1) / 2; }
    if (a === 'dup' || a === 'copy') {
      const n = Object.assign({}, l, { id: uid() });
      if (a === 'dup') { n.x = clamp(l.x + 0.6, 0, ai.w); n.y = clamp(l.y + 0.6, 0, ai.h); } else { n.side = l.side === 'front' ? 'back' : 'front'; }
      if (n.type === 'text') st.assets[n.id] = st.assets[l.id];
      st.layers.push(n); st.sel = n.id; if (a === 'copy') { st.side = n.side; toast('Copied to ' + n.side); }
    }
    renderAll();
  }

  /* ---------- step 1: tee & colour ---------- */
  // each t-shirt remembers its own colour; only the selected tee changes when a colour is picked
  const colorBy = {};
  const tileColor = (b) => (b.key === st.base ? st.color : colorBy[b.key] && b.colors.includes(colorBy[b.key]) ? colorBy[b.key] : b.colors[0]);
  function renderTees() {
    $('[data-tees]').innerHTML = CFG.bases.map((b) => `<button type="button" class="zs-tee ${b.key === st.base ? 'is-on' : ''}" data-base="${b.key}" aria-pressed="${b.key === st.base}">
      <span class="zs-tee__img"><img src="${teePhoto(b.handle, tileColor(b), 'front')}" alt="${esc(b.name)}" loading="lazy"></span>
      <b>${esc(b.name)}</b><small>${esc(b.spec)}</small><strong>from ${money(priceOf(b))}</strong></button>`).join('');
    $('[data-colors]').innerHTML = base().colors.map((c) => `<button type="button" class="zs-color ${c === st.color ? 'is-on' : ''}" data-color="${esc(c)}"><i style="background:${SWATCH[c] || '#ccc'}"></i>${esc(c)}</button>`).join('');
    $('[data-color-name]').textContent = st.color;
  }
  // Single product "zeyov-studio-tee": Style × Front print × Back print. Size is a line-item property.
  const SO = (CFG.studio && CFG.studio.opts) || null;
  const BASE0 = SO ? Object.values(SO.Style)[0].p : 0;
  function priceOf(b) { const v = SO && SO.Style[b.style]; return v && v.p != null ? v.p : 0; }
  function printPrice(side, name) { const o = SO && SO[side === 'front' ? 'Front' : 'Back'][name]; return o && o.p != null ? Math.max(0, o.p - BASE0) : 0; }
  function optName(side) { const pc = printClass(side); return pc ? pc.name : 'None'; }
  async function resolveVariant() {
    const ids = [SO.Style[base().style], SO.Front[optName('front')], SO.Back[optName('back')]];
    if (ids.some((x) => !x)) throw new Error('This print option is not available yet. Please contact us.');
    const r = await fetch(`${CFG.studio.url}?view=studio-variant&option_values=${ids.map((x) => x.id).join(',')}`, { headers: { Accept: 'text/html' } });
    const t = await r.text(); let v = null;
    try { v = JSON.parse(t.trim()); } catch (e) { v = null; }
    if (!r.ok || !v || !v.id) throw new Error('Could not load this design option. Please refresh and try again.');
    return v;
  }

  /* ---------- print classification & quote ---------- */
  function sideBox(side) {
    const ls = sideLayers(side); if (!ls.length) return null;
    let x0 = 1e9; let y0 = 1e9; let x1 = -1e9; let y1 = -1e9;
    ls.forEach((l) => {
      const w = l.w; const h = l.w * (l.aspect || 1); const r = (l.rot || 0) * Math.PI / 180;
      const bw = Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r)); const bh = Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r));
      x0 = Math.min(x0, l.x - bw / 2); x1 = Math.max(x1, l.x + bw / 2); y0 = Math.min(y0, l.y - bh / 2); y1 = Math.max(y1, l.y + bh / 2);
    });
    const ai = areaIn(side);
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(ai.w, x1); y1 = Math.min(ai.h, y1);
    return { x0, y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2 - ai.w / 2 };
  }
  function printClass(side) {
    const b = sideBox(side); if (!b) return null;
    if (st.print[side] === 'Embroidery') {
      const m = Math.max(b.w, b.h);
      const name = m <= 4 ? 'Embroidery up to 4 in' : m <= 7 ? 'Embroidery up to 7 in' : 'Embroidery up to 10 in';
      return { name, label: name.replace('Embroidery ', 'Embroidery · '), box: b, over: m > 10 };
    }
    const lo = Math.min(b.w, b.h); const hi = Math.max(b.w, b.h);
    const p = PAPER.find(([, a, c]) => lo <= a + 0.05 && hi <= c + 0.05) || PAPER[PAPER.length - 1];
    const name = `${p[0]} DTF`;
    return { name, label: `${p[0]} DTF`, box: b };
  }
  const totalQty = () => SIZES.reduce((a, s) => a + (st.qty[s] || 0), 0);
  function renderQuote() {
    const q = totalQty();
    const basePrice = priceOf(base());
    const rows = []; let per = basePrice;
    rows.push([`${esc(base().name)} ${esc(base().spec.split(' · ')[0])} · ${esc(st.color)}`, money(basePrice)]);
    ['front', 'back'].forEach((side) => {
      const pc = printClass(side); if (!pc) return;
      const pp = printPrice(side, pc.name); per += pp;
      rows.push([`${side === 'front' ? 'Front' : 'Back'} · ${esc(pc.label)}<small>${fmt(pc.box.w)} × ${fmt(pc.box.h)} in</small>`, '+' + money(pp)]);
    });
    $('[data-quote-rows]').innerHTML = rows.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
    $('[data-per]').textContent = money(per);
    $('[data-qty-out]').textContent = `${q} pc${q === 1 ? '' : 's'}`;
    $('[data-total]').textContent = money(per * q);
    const t1 = CFG.offers.tier1Qty; const t2 = CFG.offers.tier2Qty;
    const tip = q < t1 ? `Add ${t1 - q} more piece${t1 - q > 1 ? 's' : ''} for extra ${CFG.offers.tier1Pct}% off your cart.` : q < t2 ? `Extra ${CFG.offers.tier1Pct}% off applies. Add ${t2 - q} more for extra ${CFG.offers.tier2Pct}% off.` : `Extra ${CFG.offers.tier2Pct}% off applies at checkout.`;
    $$('[data-tip]').forEach((t) => { t.textContent = tip; });
    $$('[data-tip-btn]').forEach((b) => { const add = q < t1 ? t1 - q : q < t2 ? t2 - q : 0; b.hidden = !add; b.dataset.tipAdd = add; b.textContent = `+${add} pcs`; });
    // print type rows
    $('[data-print-rows]').innerHTML = ['front', 'back'].map((side) => {
      const pc = printClass(side); if (!pc) return '';
      return `<div class="zs-pt"><div class="zs-pt__h"><b>${side === 'front' ? 'Front' : 'Back'}</b><small>${fmt(pc.box.w)} × ${fmt(pc.box.h)} in · ${esc(pc.label)}</small></div>
        <div class="zs-seg2"><button type="button" data-ptype="${side}|DTF" class="${st.print[side] === 'DTF' ? 'is-on' : ''}">DTF print</button><button type="button" data-ptype="${side}|Embroidery" class="${st.print[side] === 'Embroidery' ? 'is-on' : ''}">Embroidery</button></div>
        ${pc.over ? '<p class="zs-note bad">Embroidery is max 10 × 10 in. Make the design smaller or choose DTF.</p>' : '<p class="zs-note">Embroidery: max 10 × 10 in per design.</p>'}</div>`;
    }).join('') || '<p class="muted zs-empty">Add a design to choose DTF print or embroidery.</p>';
    const ok = q > 0 && st.layers.length > 0 && !['front', 'back'].some((s) => (printClass(s) || {}).over);
    $('[data-add]').disabled = !ok;
    $('[data-add-hint]').textContent = !st.layers.length ? 'Add an image or text to your tee first.' : !q ? 'Choose at least 1 piece.' : '';
    $$('[data-qty-size]').forEach((i) => { if (document.activeElement !== i) i.value = st.qty[i.dataset.qtySize]; i.closest('.zs-size').classList.toggle('is-on', st.qty[i.dataset.qtySize] > 0); });
  }

  function renderAll() { renderTees(); renderStage(); renderLayerList(); renderAdjust(); renderQuote(); }

  /* ---------- events ---------- */
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button, [data-pick]'); if (!t) return;
    const d = t.dataset;
    if (d.side) { st.side = d.side; st.sel = null; renderAll(); }
    else if (d.thumbSide) { st.side = d.thumbSide; st.sel = null; renderAll(); }
    else if (d.base) { colorBy[st.base] = st.color; const nb = CFG.bases.find((x) => x.key === d.base); st.color = colorBy[d.base] && nb.colors.includes(colorBy[d.base]) ? colorBy[d.base] : nb.colors[0]; st.base = d.base; st.layers.forEach((l) => { l.w = clampW(l, l.w); const ai = areaIn(l.side); l.x = clamp(l.x, 0, ai.w); l.y = clamp(l.y, 0, ai.h); }); renderAll(); }
    else if (d.color) { st.color = d.color; colorBy[st.base] = d.color; renderAll(); }
    else if (t.hasAttribute('data-add-text')) addText();
    else if (t.hasAttribute('data-upload')) $('[data-file]').click();
    else if (d.pick) { st.sel = d.pick; renderAll(); }
    else if (d.up) moveLayer(d.up, 1);
    else if (d.down) moveLayer(d.down, -1);
    else if (d.rm) removeLayer(d.rm);
    else if (t.hasAttribute('data-undo')) undo();
    else if (t.hasAttribute('data-redo')) redo();
    else if (t.hasAttribute('data-download')) downloadMockup();
    else if (d.ptype) { const [s, v] = d.ptype.split('|'); commit(); st.print[s] = v; renderQuote(); }
    else if (d.step) { const s = d.step.split('|'); st.qty[s[0]] = Math.max(0, (st.qty[s[0]] || 0) + Number(s[1])); renderQuote(); }
    else if (t.hasAttribute('data-tip-btn')) { st.qty.M += Number(d.tipAdd || 0); renderQuote(); }
    else if (t.hasAttribute('data-add')) addToCart(t);
    else if (t.hasAttribute('data-reset')) resetDesign(true);
    else if (t.hasAttribute('data-keep')) { $('[data-done]').hidden = true; window.scrollTo({ top: root.offsetTop, behavior: 'smooth' }); }
  });
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-file]')) { addImage(t.files[0]); t.value = ''; }
    else if (t.matches('[data-area-toggle]')) { st.showArea = t.checked; placeArea(); }
    else if (t.matches('[data-qty-size]')) { st.qty[t.dataset.qtySize] = Math.max(0, parseInt(t.value, 10) || 0); renderQuote(); }
  });
  // drag & drop upload
  const drop = $('[data-dropzone]');
  ['dragenter', 'dragover'].forEach((ev) => stage.addEventListener(ev, (e) => { e.preventDefault(); stage.classList.add('is-drop'); }));
  ['dragleave', 'drop'].forEach((ev) => stage.addEventListener(ev, (e) => { e.preventDefault(); stage.classList.remove('is-drop'); if (ev === 'drop' && e.dataTransfer.files[0]) addImage(e.dataTransfer.files[0]); }));
  drop && ['dragover', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'drop' && e.dataTransfer.files[0]) addImage(e.dataTransfer.files[0]); }));
  document.addEventListener('keydown', (e) => {
    if (/input|textarea|select/i.test(document.activeElement.tagName)) return;
    const l = sel();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (!l) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeLayer(l.id); }
    const step = e.shiftKey ? 0.5 : 0.1; const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (mv) { e.preventDefault(); const ai = areaIn(l.side); l.x = clamp(l.x + mv[0], 0, ai.w); l.y = clamp(l.y + mv[1], 0, ai.h); renderStage(); renderQuote(); }
  });

  /* ---------- export: mockups & print files ---------- */
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
  async function layerBitmap(l, ppi) {
    if (l.type === 'text') { await ensureFont(l.font, l.bold, l.italic); return renderText(l, ppi).canvas; }
    return loadImg(st.assets[l.src]);
  }
  async function drawLayers(g, side, ppi, ox, oy) {
    for (const l of sideLayers(side)) {
      const bmp = await layerBitmap(l, ppi);
      const w = l.w * ppi; const h = w * (l.aspect || 1);
      g.save(); g.translate(ox + l.x * ppi, oy + l.y * ppi); g.rotate((l.rot || 0) * Math.PI / 180); if (l.flip) g.scale(-1, 1);
      g.drawImage(bmp, -w / 2, -h / 2, w, h); g.restore();
    }
  }
  async function mockupCanvas(side) {
    const c = document.createElement('canvas'); c.width = 800; c.height = 1000; const g = c.getContext('2d');
    { g.fillStyle = '#F1E8DB'; g.fillRect(0, 0, 800, 1000); const im = await loadImg(mockSrc(side)); const f = photoFit(base().handle, st.color); const sc = Math.max(800 / im.naturalWidth, 1000 / im.naturalHeight) * f.z; const w = im.naturalWidth * sc; const h = im.naturalHeight * sc; g.drawImage(im, (800 - w) / 2 + f.x * 8, (1000 - h) / 2 + f.y * 10, w, h); }
    const a = AREA[base().fit][side];
    g.save(); g.beginPath(); g.rect(a.x, a.y, a.w, a.h); g.clip();
    await drawLayers(g, side, PX_PER_IN, a.x, a.y); g.restore();
    return c;
  }
  async function printCanvas(side) {
    const b = sideBox(side); if (!b) return null;
    let ppi = 300; const maxPx = 4800; if (Math.max(b.w, b.h) * ppi > maxPx) ppi = Math.floor(maxPx / Math.max(b.w, b.h));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(b.w * ppi)); c.height = Math.max(1, Math.round(b.h * ppi));
    const g = c.getContext('2d'); await drawLayers(g, side, ppi, -b.x0 * ppi, -b.y0 * ppi);
    return { c, ppi };
  }
  const toBlob = (c, type = 'image/png', q) => new Promise((r) => c.toBlob(r, type, q));
  async function downloadMockup() {
    try {
      const c = await mockupCanvas(st.side); const blob = await toBlob(c, 'image/jpeg', 0.92);
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `zeyov-design-${st.side}.jpg`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) { toast('Could not create the mockup image.'); }
  }

  /* ---------- add to cart (full print details on every line) ---------- */
  function sideSummary(side) {
    const pc = printClass(side); if (!pc) return null;
    const b = pc.box; const pos = Math.abs(b.cx) < 0.15 ? 'centred' : `${fmt(Math.abs(b.cx))} in to the ${b.cx < 0 ? 'left' : 'right'} of centre (as you look at the ${side})`;
    const items = sideLayers(side).map((l) => l.type === 'text'
      ? `Text “${l.text.replace(/\n/g, ' / ')}” (${l.font}${l.bold ? ' bold' : ''}${l.italic ? ' italic' : ''}, colour ${l.fill}${l.gradient ? '→' + l.fill2 : ''}${l.outline ? ', outline ' + l.outline : ''}${l.outlineOnly ? ' hollow' : ''}${l.curve ? ', curve ' + l.curve : ''}, ${fmt(l.w)}×${fmt(l.w * l.aspect)} in, rotate ${Math.round(l.rot)}°)`
      : `Image ${l.name} (${fmt(l.w)}×${fmt(l.w * l.aspect)} in, rotate ${Math.round(l.rot)}°${l.flip ? ', flipped' : ''})`).join(' | ');
    return { pc, text: `${pc.label} · ${fmt(b.w)} × ${fmt(b.h)} in · top edge ${fmt(b.y0)} in below print-area top (≈${fmt(b.y0 + (side === 'front' ? 3 : 3))} in below collar) · ${pos}`, items };
  }
  async function addToCart(btn) {
    if (btn.disabled) return;
    const sizes = SIZES.filter((s) => st.qty[s] > 0);
    if (window.ZeyovTheme && ZeyovTheme.restoreCart) await ZeyovTheme.restoreCart();
    if (!SO) { toast('Zeyov Studio is not set up yet. Please contact us.'); return; }
    btn.classList.add('is-loading'); btn.disabled = true;
    try {
      const v = await resolveVariant();
      const id = 'ZS-' + Date.now().toString(36).toUpperCase().slice(-6);
      const props = { Size: sizes[0], Colour: st.color, 'Design ID': id, 'Sizes in this design': sizes.map((s) => `${s}×${st.qty[s]}`).join(', ') };
      const files = {};
      for (const side of ['front', 'back']) {
        const sum = sideSummary(side); const S = side === 'front' ? 'Front' : 'Back';
        if (!sum) continue;
        props[`${S} print`] = sum.text;
        props[`${S} elements`] = sum.items;
        const pf = await printCanvas(side); files[`${S} print file (${pf.ppi} DPI PNG)`] = new File([await toBlob(pf.c)], `${id}-${side}-print.png`, { type: 'image/png' });
        files[`${S} mockup`] = new File([await toBlob(await mockupCanvas(side), 'image/jpeg', 0.9)], `${id}-${side}-mockup.jpg`, { type: 'image/jpeg' });
        sideLayers(side).filter((l) => l.type === 'image' && st.files[l.src]).forEach((l, i) => { files[`${S} original artwork ${i + 1}`] = st.files[l.src]; });
      }
      // 1) first size line uploads every file
      const fd = new FormData();
      fd.append('id', v.id); fd.append('quantity', st.qty[sizes[0]]);
      Object.entries(props).forEach(([k, val]) => fd.append(`properties[${k}]`, val));
      Object.entries(files).forEach(([k, f]) => fd.append(`properties[${k}]`, f, f.name));
      const r1 = await fetch(CFG.routes.cartAdd + '.js', { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
      const d1 = await r1.json();
      if (!r1.ok) throw new Error(d1.description || d1.message || 'Could not add to cart');
      const first = (d1.items && d1.items[0]) || d1;
      const shared = Object.assign({}, first.properties || props); // file properties now hold the uploaded file URLs
      // 2) other sizes: same variant (print included), only the Size property changes
      const items = sizes.slice(1).map((s) => ({ id: v.id, quantity: st.qty[s], properties: Object.assign({}, shared, { Size: s }) }));
      if (items.length) {
        const r2 = await fetch(CFG.routes.cartAdd + '.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items }) });
        if (!r2.ok) { const d2 = await r2.json(); throw new Error(d2.description || 'Could not add all sizes'); }
      }
      $('[data-done-id]').textContent = id;
      $('[data-done]').hidden = false;
      if (window.ZeyovTheme) { await window.ZeyovTheme.refreshCart(); }
      const drawer = document.getElementById('CartDrawer');
      document.querySelector('[data-open-cart]') && document.querySelector('[data-open-cart]').click();
      void drawer;
      toast(`Design ${id} added to cart`);
    } catch (err) {
      toast(err.message || 'Something went wrong. Please try again.');
    } finally { btn.classList.remove('is-loading'); btn.disabled = false; renderQuote(); }
  }
  function resetDesign(confirmFirst) {
    if (confirmFirst && st.layers.length && !resetDesign.armed) { resetDesign.armed = true; toast('Tap “Start a new design” again to clear everything.'); setTimeout(() => { resetDesign.armed = false; }, 3000); return; }
    resetDesign.armed = false; st.layers = []; st.files = {}; st.sel = null; st.qty = { XS: 0, S: 0, M: 1, L: 0, XL: 0, XXL: 0 }; hist.past = []; hist.future = []; $('[data-done]').hidden = true; syncUndo(); renderAll();
  }

  // Preload fonts used by quick styles lazily, then first render
  syncUndo(); renderAll();
  window.ZeyovStudio = { st, addText, addImage, printClass, sideSummary };
})();
