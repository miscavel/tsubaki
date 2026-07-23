// Exodia relic hunt: five independent images (head / left arm / right arm /
// left leg / right leg), each cut into a 3x3 grid. Clicking a relic opens a
// modal where its 9 pieces get revealed one at a time, in a shuffled order,
// into their true grid position. At any point the player can guess what the
// image shows; a correct guess (checked against a stored SHA-256 hash, never
// the plaintext) solves that relic. Progress persists in localStorage.
// Solving all five reveals a reward code at the star's centre.
(function () {
  const N = 9; // 3x3 pieces per relic

  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function isPermutation(arr, n) {
    return Array.isArray(arr) && arr.length === n &&
      new Set(arr).size === n &&
      arr.every(v => Number.isInteger(v) && v >= 0 && v < n);
  }

  function freshPartState() {
    const order = shuffle([...Array(N).keys()]);
    if (order.every((v, i) => v === i)) [order[0], order[1]] = [order[1], order[0]];
    return { order, revealedCount: 0, solved: false, guessText: '' };
  }

  function paintCell(el, cellIndex, image) {
    const col = cellIndex % 3;
    const row = Math.floor(cellIndex / 3);
    el.style.backgroundImage = `url(${image})`;
    el.style.backgroundSize = '300% 300%';
    el.style.backgroundPosition = `${(col / 2) * 100}% ${(row / 2) * 100}%`;
  }

  function createRelicHunt(cfg) {
    const { field, el, howto, parts } = cfg;
    const key = cfg.storageKey || 'archive_relic_hunt';

    function load() {
      try {
        const s = JSON.parse(localStorage.getItem(key));
        if (!s || typeof s !== 'object' || typeof s.parts !== 'object') return { parts: {} };
        return s;
      } catch (e) { return { parts: {} }; }
    }
    function save() {
      try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) {}
    }

    const state = load();
    parts.forEach(p => {
      const s = state.parts[p.key];
      const valid = s && isPermutation(s.order, N) &&
        Number.isInteger(s.revealedCount) && s.revealedCount >= 0 && s.revealedCount <= N &&
        typeof s.solved === 'boolean';
      if (!valid) state.parts[p.key] = freshPartState();
    });
    save();

    function revealedSet(st) {
      return st.solved ? new Set([...Array(N).keys()]) : new Set(st.order.slice(0, st.revealedCount));
    }

    // ── build relic buttons + centre ────────────────────────────────────
    field.innerHTML = '';
    const relics = [];
    parts.forEach((p, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'relic';
      btn.dataset.part = p.key;

      const frame = document.createElement('div');
      frame.className = 'relic-frame';
      const preview = document.createElement('div');
      preview.className = 'relic-preview';
      for (let c = 0; c < N; c++) preview.appendChild(document.createElement('div'));
      const check = document.createElement('span');
      check.className = 'relic-check';
      check.textContent = '✓';
      frame.appendChild(preview);
      frame.appendChild(check);

      const label = document.createElement('span');
      label.className = 'relic-label';
      label.textContent = p.label;

      btn.appendChild(frame);
      btn.appendChild(label);
      btn.addEventListener('click', () => openReveal(i));
      field.appendChild(btn);
      relics.push({ btn, preview, check });
    });

    const center = document.createElement('div');
    center.className = 'relic-center';
    field.appendChild(center);

    function renderRelic(i) {
      const p = parts[i];
      const st = state.parts[p.key];
      const shown = revealedSet(st);
      const { preview, btn, check } = relics[i];
      [...preview.children].forEach((cell, idx) => {
        if (shown.has(idx)) paintCell(cell, idx, p.image);
        else { cell.style.backgroundImage = ''; }
      });
      btn.classList.toggle('solved', st.solved);
      check.style.display = st.solved ? '' : 'none';
    }
    function renderCenter() {
      const solvedCount = parts.filter(p => state.parts[p.key].solved).length;
      const all = solvedCount === parts.length;
      center.classList.toggle('unlocked', all);
      center.innerHTML = all
        ? `<span>${cfg.rewardCode}</span><small>your code</small>`
        : `<span>?</span><small>${solvedCount}/${parts.length}</small>`;
    }
    function renderAll() {
      parts.forEach((_, i) => renderRelic(i));
      renderCenter();
    }

    // ── focused reveal modal ─────────────────────────────────────────────
    let activePart = null;
    let cellEls = [];

    function openReveal(i) {
      activePart = i;
      const p = parts[i];
      el.title.textContent = p.label;
      el.grid.innerHTML = '';
      cellEls = [];
      for (let c = 0; c < N; c++) {
        const cell = document.createElement('div');
        cell.className = 'reveal-cell';
        el.grid.appendChild(cell);
        cellEls.push(cell);
      }
      el.hint.textContent = `${p.answerLength} character${p.answerLength === 1 ? '' : 's'}`;
      el.guessInput.value = '';
      el.guessInput.classList.remove('error');
      renderModal();
      el.modal.classList.add('open');
      el.modal.setAttribute('aria-hidden', 'false');
    }
    function closeReveal() {
      el.modal.classList.remove('open');
      el.modal.setAttribute('aria-hidden', 'true');
      activePart = null;
    }
    function renderModal() {
      if (activePart === null) return;
      const p = parts[activePart];
      const st = state.parts[p.key];
      const shown = revealedSet(st);
      cellEls.forEach((cell, idx) => {
        if (shown.has(idx)) paintCell(cell, idx, p.image);
        else { cell.style.backgroundImage = ''; cell.style.backgroundColor = ''; }
      });
      el.grid.classList.toggle('solved', st.solved);

      el.progress.textContent = st.revealedCount === 0
        ? `0 / ${N} pieces revealed`
        : `Piece #${st.revealedCount} — ${st.revealedCount} / ${N} revealed`;

      el.nextBtn.style.display = (st.solved || st.revealedCount >= N) ? 'none' : '';
      el.restartBtn.style.display = (!st.solved && st.revealedCount >= N) ? '' : 'none';

      if (st.solved) {
        el.guessWrap.style.display = 'none';
        el.solvedNote.style.display = '';
        el.solvedNote.textContent = `Solved — "${st.guessText}"`;
      } else {
        el.guessWrap.style.display = '';
        el.solvedNote.style.display = 'none';
      }
    }

    el.nextBtn.addEventListener('click', () => {
      if (activePart === null) return;
      const st = state.parts[parts[activePart].key];
      if (st.solved || st.revealedCount >= N) return;
      st.revealedCount++;
      save();
      renderModal();
      renderRelic(activePart);
    });

    el.restartBtn.addEventListener('click', () => {
      if (activePart === null) return;
      const st = state.parts[parts[activePart].key];
      if (st.solved) return;
      const order = shuffle([...Array(N).keys()]);
      if (order.every((v, i) => v === i)) [order[0], order[1]] = [order[1], order[0]];
      st.order = order;
      st.revealedCount = 0;
      save();
      renderModal();
      renderRelic(activePart);
    });

    async function submitGuess() {
      if (activePart === null) return;
      const p = parts[activePart];
      const st = state.parts[p.key];
      if (st.solved) return;
      const raw = el.guessInput.value.trim();
      if (!raw) return;
      const hash = await sha256(raw);
      if (hash === p.answerHash) {
        st.solved = true;
        st.guessText = raw;
        st.revealedCount = N;
        save();
        renderModal();
        renderRelic(activePart);
        renderCenter();
      } else {
        el.guessInput.classList.add('error');
        setTimeout(() => el.guessInput.classList.remove('error'), 400);
      }
    }
    el.guessBtn.addEventListener('click', submitGuess);
    el.guessInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitGuess(); });

    el.back.addEventListener('click', closeReveal);
    el.modal.addEventListener('click', e => { if (e.target === el.modal) closeReveal(); });

    // ── how-to-play modal ─────────────────────────────────────────────────
    if (howto) {
      const openHowto = () => {
        howto.modal.classList.add('open');
        howto.modal.setAttribute('aria-hidden', 'false');
      };
      const closeHowto = () => {
        howto.modal.classList.remove('open');
        howto.modal.setAttribute('aria-hidden', 'true');
      };
      howto.openBtn.addEventListener('click', openHowto);
      howto.closeBtn.addEventListener('click', closeHowto);
      howto.modal.addEventListener('click', e => { if (e.target === howto.modal) closeHowto(); });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && howto.modal.classList.contains('open')) closeHowto();
      });
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && el.modal.classList.contains('open')) closeReveal();
    });

    renderAll();

    return {
      resetProgress() {
        try { localStorage.removeItem(key); } catch (e) {}
      },
    };
  }

  window.Jigsaw = { createRelicHunt };
})();
