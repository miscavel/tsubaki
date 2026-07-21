// Exodia-style jigsaw star. One source image is cut into `slices` horizontal
// bands; each band is an independent click-to-swap mini puzzle sitting at a
// point of a 5-point star. Per-slice progress (current arrangement + solved
// flag) persists in localStorage. When all slices are solved the centre
// lights up as a placeholder for whatever reward gets wired in later.
//
// Tap a piece to select it, tap another to swap them (no drag — flaky on touch).
(function () {
  // Star vertices in field %-coords (pentagon, point-up). Order matters:
  // index 0 = top, then clockwise. Puzzles are assigned to slices in this order.
  const STAR_VERTICES = [
    [50, 5],     // top
    [92.8, 36.1],// upper right
    [76.5, 86.4],// lower right
    [23.5, 86.4],// lower left
    [7.2, 36.1], // upper left
  ];

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Where in the *full* image a given local piece of a given slice lives.
  function piecePos(pieceLocal, sliceIndex, cfg) {
    const { cols, rowsPerSlice, slices } = cfg;
    const col = pieceLocal % cols;
    const globalRow = sliceIndex * rowsPerSlice + Math.floor(pieceLocal / cols);
    const totalRows = slices * rowsPerSlice;
    return {
      size: `${cols * 100}% ${totalRows * 100}%`,
      pos: `${cols === 1 ? 0 : (col / (cols - 1)) * 100}% ` +
           `${totalRows === 1 ? 0 : (globalRow / (totalRows - 1)) * 100}%`,
    };
  }

  function paint(el, pieceLocal, sliceIndex, cfg) {
    const { size, pos } = piecePos(pieceLocal, sliceIndex, cfg);
    el.style.backgroundImage = `url(${cfg.image})`;
    el.style.backgroundSize = size;
    el.style.backgroundPosition = pos;
  }

  function createExodia(cfg) {
    const n = cfg.cols * cfg.rowsPerSlice;
    const key = cfg.storageKey || 'archive_exodia';

    function load() {
      try {
        const s = JSON.parse(localStorage.getItem(key));
        // Reject stored state whose shape no longer matches the config.
        if (!s || !Array.isArray(s.order) || s.order.length !== cfg.slices) return null;
        if (!s.order.every(o => Array.isArray(o) && o.length === n)) return null;
        if (!Array.isArray(s.solved) || s.solved.length !== cfg.slices) return null;
        return s;
      } catch (e) { return null; }
    }
    function save() {
      try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) {}
    }

    let state = load();
    if (!state) {
      state = { order: [], solved: [] };
      for (let i = 0; i < cfg.slices; i++) {
        let ord = shuffle([...Array(n).keys()]);
        if (ord.every((v, k) => v === k)) [ord[0], ord[1]] = [ord[1], ord[0]];
        state.order.push(ord);
        state.solved.push(false);
      }
      save();
    }

    document.documentElement.style.setProperty(
      '--slice-aspect', `${cfg.imageW} / ${cfg.imageH / cfg.slices}`);

    const { field, focus, focusGrid, backBtn } = cfg;

    // ── build the star (points + centre) ──────────────────────────────────
    field.querySelectorAll('.exodia-point, .exodia-center').forEach(e => e.remove());
    const points = [];
    for (let i = 0; i < cfg.slices; i++) {
      const [x, y] = STAR_VERTICES[i] || [50, 50];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'exodia-point';
      btn.style.left = x + '%';
      btn.style.top = y + '%';
      btn.setAttribute('aria-label', 'puzzle fragment ' + (i + 1));

      const prev = document.createElement('div');
      prev.className = 'exodia-preview';
      prev.style.gridTemplateColumns = `repeat(${cfg.cols}, 1fr)`;
      prev.style.gridTemplateRows = `repeat(${cfg.rowsPerSlice}, 1fr)`;
      btn.appendChild(prev);

      const check = document.createElement('span');
      check.className = 'exodia-check';
      check.textContent = '✓';
      btn.appendChild(check);

      btn.addEventListener('click', () => openFocus(i));
      field.appendChild(btn);
      points.push({ btn, prev, check });
    }

    const center = document.createElement('button');
    center.type = 'button';
    center.className = 'exodia-center';
    center.setAttribute('aria-label', 'the sealed centre');
    center.addEventListener('click', onCenter);
    field.appendChild(center);

    function renderPoint(i) {
      const { prev, btn, check } = points[i];
      prev.innerHTML = '';
      state.order[i].forEach(piece => {
        const d = document.createElement('div');
        paint(d, piece, i, cfg);
        prev.appendChild(d);
      });
      btn.classList.toggle('solved', state.solved[i]);
      check.style.display = state.solved[i] ? '' : 'none';
    }
    function renderCenter() {
      const done = state.solved.filter(Boolean).length;
      const all = done === cfg.slices;
      center.classList.toggle('unlocked', all);
      center.innerHTML = all
        ? '<span>✦</span><small>unlocked</small>'
        : `<span>?</span><small>${done}/${cfg.slices}</small>`;
    }
    function renderAll() {
      for (let i = 0; i < cfg.slices; i++) renderPoint(i);
      renderCenter();
    }

    // ── focused solving ───────────────────────────────────────────────────
    let activeSlice = null, selected = null;

    function openFocus(i) {
      activeSlice = i;
      selected = null;
      focusGrid.style.gridTemplateColumns = `repeat(${cfg.cols}, 1fr)`;
      focusGrid.style.gridTemplateRows = `repeat(${cfg.rowsPerSlice}, 1fr)`;
      focusGrid.classList.toggle('solved', state.solved[i]);
      focusGrid.innerHTML = '';
      state.order[i].forEach((piece, cell) => {
        const t = document.createElement('button');
        t.type = 'button';
        t.className = 'puzzle-tile';
        t.setAttribute('aria-label', 'piece');
        paint(t, piece, i, cfg);
        t.addEventListener('click', () => onTile(cell));
        focusGrid.appendChild(t);
      });
      focus.classList.add('open');
      focus.setAttribute('aria-hidden', 'false');
    }
    function closeFocus() {
      focus.classList.remove('open');
      focus.setAttribute('aria-hidden', 'true');
      activeSlice = null;
      selected = null;
    }
    function onTile(cell) {
      const i = activeSlice;
      if (i === null || state.solved[i]) return;
      const tiles = focusGrid.children;
      if (selected === null) {
        selected = cell;
        tiles[cell].classList.add('selected');
        return;
      }
      if (selected === cell) {
        tiles[cell].classList.remove('selected');
        selected = null;
        return;
      }
      const ord = state.order[i];
      [ord[selected], ord[cell]] = [ord[cell], ord[selected]];
      paint(tiles[selected], ord[selected], i, cfg);
      paint(tiles[cell], ord[cell], i, cfg);
      tiles[selected].classList.remove('selected');
      selected = null;
      save();
      if (ord.every((v, k) => v === k)) {
        state.solved[i] = true;
        save();
        focusGrid.classList.add('solved');
        renderPoint(i);
        renderCenter();
        if (typeof cfg.onSolved === 'function') cfg.onSolved(i);
        if (state.solved.every(Boolean) && typeof cfg.onAllSolved === 'function') {
          cfg.onAllSolved();
        }
      }
    }
    function onCenter() {
      if (state.solved.every(Boolean) && typeof cfg.onUnlock === 'function') {
        cfg.onUnlock();
      }
    }

    backBtn.addEventListener('click', closeFocus);
    focus.addEventListener('click', e => { if (e.target === focus) closeFocus(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && focus.classList.contains('open')) closeFocus();
    });

    renderAll();

    return {
      reset() {
        try { localStorage.removeItem(key); } catch (e) {}
      },
    };
  }

  window.Jigsaw = { createExodia };
})();
