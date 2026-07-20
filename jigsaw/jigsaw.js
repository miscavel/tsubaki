// Minimal click-to-swap jigsaw puzzle. No drag-and-drop (flaky on touch);
// tap a piece to select it, tap another to swap them.
(function () {
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function paintPiece(cell, pieceIndex, cols, rows, image) {
    const col = pieceIndex % cols;
    const row = Math.floor(pieceIndex / cols);
    cell.dataset.piece = pieceIndex;
    cell.style.backgroundImage = `url(${image})`;
    cell.style.backgroundSize = `${cols * 100}% ${rows * 100}%`;
    cell.style.backgroundPosition =
      `${cols === 1 ? 0 : (col / (cols - 1)) * 100}% ${rows === 1 ? 0 : (row / (rows - 1)) * 100}%`;
  }

  function create({ container, image, cols, rows, onSolved }) {
    const total = cols * rows;
    const order = shuffle([...Array(total).keys()]);
    if (order.every((v, i) => v === i)) {
      [order[0], order[1]] = [order[1], order[0]];
    }

    container.innerHTML = '';
    container.classList.remove('solved');
    container.style.setProperty('--cols', cols);
    container.style.setProperty('--rows', rows);

    const cells = [];
    let selected = null;

    function checkSolved() {
      const solved = cells.every((cell, i) => Number(cell.dataset.piece) === i);
      if (solved) {
        container.classList.add('solved');
        if (onSolved) onSolved();
      }
    }

    function handleClick(cellIndex) {
      if (container.classList.contains('solved')) return;
      if (selected === null) {
        selected = cellIndex;
        cells[cellIndex].classList.add('selected');
        return;
      }
      if (selected === cellIndex) {
        cells[cellIndex].classList.remove('selected');
        selected = null;
        return;
      }
      const pieceA = Number(cells[selected].dataset.piece);
      const pieceB = Number(cells[cellIndex].dataset.piece);
      paintPiece(cells[selected], pieceB, cols, rows, image);
      paintPiece(cells[cellIndex], pieceA, cols, rows, image);
      cells[selected].classList.remove('selected');
      selected = null;
      checkSolved();
    }

    order.forEach((pieceIndex, cellIndex) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'jigsaw-piece';
      cell.setAttribute('aria-label', 'puzzle piece');
      paintPiece(cell, pieceIndex, cols, rows, image);
      cell.addEventListener('click', () => handleClick(cellIndex));
      container.appendChild(cell);
      cells.push(cell);
    });

    return {
      reset() { create({ container, image, cols, rows, onSolved }); },
    };
  }

  window.Jigsaw = { create };
})();
