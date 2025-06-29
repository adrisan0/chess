const boardElement = document.getElementById('board');
const settingsMenu = document.getElementById('settingsMenu');
const settingsToggle = document.getElementById('settingsToggle');
const pieceSizeInput = document.getElementById('pieceSize');
const neonInput = document.getElementById('neonBrightness');
const glowInput = document.getElementById('glowIntensity');
const saturationInput = document.getElementById('neonSaturation');

// Board state and view configuration

let board = [];
let selected = null;
const activeViews = new Set([1]);
let enPassant = null; // square available for en passant capture
let lastMove = null; // store last move for highlighting
let capturedWhite = [];
let capturedBlack = [];
let whiteTime = 0;
let blackTime = 0;
let timerId = null;

const PIECES = {
    'p': '♟',
    'r': '♜',
    'n': '♞',
    'b': '♝',
    'q': '♛',
    'k': '♚',
    'P': '♙',
    'R': '♖',
    'N': '♘',
    'B': '♗',
    'Q': '♕',
    'K': '♔'
};

// Icon and color definition for each view mode
const VIEW_ICONS = {
    1: '🔍', // Mostrar movimientos posibles
    2: '⚔️', // Casillas atacadas
    3: '⚠️', // Piezas en peligro
    4: '♚'  // Casillas de jaque
};

const VIEW_COLORS = {
    1: 'var(--neon-color)',
    2: '#ff00ff',
    3: '#ff073a',
    4: '#00ffff'
};

function initBoard() {
    const initial = [
        ['r','n','b','q','k','b','n','r'],
        ['p','p','p','p','p','p','p','p'],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ['P','P','P','P','P','P','P','P'],
        ['R','N','B','Q','K','B','N','R']
    ];
    board = initial;
}

function createBoard() {
    boardElement.innerHTML = '';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.classList.add('square');
            if ((row + col) % 2 === 0) square.classList.add('light');
            else square.classList.add('dark');
            square.dataset.row = row;
            square.dataset.col = col;
            square.addEventListener('click', onSquareClick);
            square.addEventListener('dragover', e => e.preventDefault());
            square.addEventListener('drop', onDrop);
            square.addEventListener('mouseenter', onSquareHover);
            square.addEventListener('mouseleave', onSquareLeave);
            const pieceEl = document.createElement('span');
            pieceEl.classList.add('piece');
            pieceEl.addEventListener('dragstart', onDragStart);
            square.appendChild(pieceEl);
            boardElement.appendChild(square);
        }
    }
    renderBoard();
}

function renderBoard() {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = getSquareElement(row, col);
            const pieceEl = square.querySelector('.piece');
            pieceEl.textContent = '';
            square.classList.remove('highlight','attack','danger','check','last-move');
            const piece = board[row][col];
            if (piece) pieceEl.textContent = PIECES[piece];
            pieceEl.draggable = !!piece && isWhite(piece) === isWhiteTurn();
        }
    }
    if (lastMove) {
        getSquareElement(lastMove.from[0], lastMove.from[1]).classList.add('last-move');
        getSquareElement(lastMove.to[0], lastMove.to[1]).classList.add('last-move');
    }
    if (activeViews.has(3)) highlightDanger();
    if (activeViews.has(4)) highlightChecks();
}

function getSquareElement(row, col) {
    return boardElement.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
}

function onSquareHover(e) {
    if (!activeViews.has(1) || selected) return;
    const row = parseInt(e.currentTarget.dataset.row);
    const col = parseInt(e.currentTarget.dataset.col);
    const piece = board[row][col];
    if (piece && isWhite(piece) === isWhiteTurn()) {
        highlightMoves(row, col);
    }
}

function onSquareLeave() {
    if (!selected) {
        renderBoard();
    } else {
        highlightMoves(selected.row, selected.col);
    }
}

function onSquareClick(e) {
    const row = parseInt(e.currentTarget.dataset.row);
    const col = parseInt(e.currentTarget.dataset.col);
    const piece = board[row][col];
    if (selected) {
        if (movePiece(selected.row, selected.col, row, col)) {
            selected = null;
        } else if (
            piece &&
            isSameColor(piece, board[selected.row][selected.col]) &&
            isWhite(piece) === isWhiteTurn()
        ) {
            selected = { row, col };
            highlightMoves(row, col);
        } else {
            selected = null;
            renderBoard();
        }
    } else if (piece && isWhite(piece) === isWhiteTurn()) {
        selected = { row, col };
        highlightMoves(row, col);
    }
}

function onDragStart(e) {
    const square = e.currentTarget.parentElement;
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);
    const piece = board[row][col];
    if (!piece || isWhite(piece) !== isWhiteTurn()) {
        e.preventDefault();
        return;
    }
    selected = { row, col };
    highlightMoves(row, col);
    e.dataTransfer.setData('text/plain', `${row},${col}`);
}

function onDrop(e) {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    const [sr, sc] = data.split(',').map(n => parseInt(n, 10));
    const dr = parseInt(e.currentTarget.dataset.row);
    const dc = parseInt(e.currentTarget.dataset.col);
    if (movePiece(sr, sc, dr, dc)) {
        selected = null;
    } else {
        renderBoard();
    }
}

function isWhite(piece) {
    return piece === piece.toUpperCase();
}

function isSameColor(a, b) {
    return isWhite(a) === isWhite(b);
}

function highlightMoves(row, col) {
    renderBoard();
    const moves = legalMoves(row, col);
    if (activeViews.has(1)) {
        for (const [r, c] of moves) {
            getSquareElement(r, c).classList.add('highlight');
        }
    }
    if (activeViews.has(2)) highlightAttacks(row, col);
}

function highlightAttacks(row, col) {
    const attacks = generateAttacks(row, col);
    for (const [r, c] of attacks) {
        getSquareElement(r, c).classList.add('attack');
    }
}

function highlightDanger() {
    const enemyMoves = allAttackedSquares(!isWhiteTurn());
    for (const [r, c] of enemyMoves) {
        const piece = board[r][c];
        if (piece && isWhite(piece) === isWhiteTurn()) {
            getSquareElement(r, c).classList.add('danger');
        }
    }
}

function highlightChecks() {
    const checks = possibleChecks(isWhiteTurn());
    for (const [r, c] of checks) {
        getSquareElement(r, c).classList.add('check');
    }
}

function generateMoves(row, col) {
    const piece = board[row][col];
    if (!piece) return [];
    const moves = [];
    const isWhitePiece = isWhite(piece);
    const directions = {
        'P': [[-1,0], [-2,0], [-1,-1], [-1,1]],
        'p': [[1,0], [2,0], [1,-1], [1,1]],
        'N': [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]],
        'n': [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]],
        'B': [[-1,-1],[-1,1],[1,-1],[1,1]],
        'b': [[-1,-1],[-1,1],[1,-1],[1,1]],
        'R': [[-1,0],[1,0],[0,-1],[0,1]],
        'r': [[-1,0],[1,0],[0,-1],[0,1]],
        'Q': [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]],
        'q': [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]],
        'K': [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]],
        'k': [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]
    };

    const vecs = directions[piece];
    for (const [dr, dc] of vecs) {
        let r = row + dr;
        let c = col + dc;
        if (!inside(r,c)) continue;
        if (piece.toLowerCase() === 'n' || piece.toLowerCase() === 'k') {
            if (!board[r][c] || !isSameColor(board[r][c], piece)) {
                moves.push([r,c]);
            }
        } else if (piece.toLowerCase() === 'p') {
            if (dc === 0) {
                if (!board[r][c]) {
                    if (dr === -2 || dr === 2) {
                        const startRow = isWhitePiece ? 6 : 1;
                        if (row === startRow && !board[row + dr/2][c]) moves.push([r, c]);
                    } else {
                        moves.push([r, c]);
                    }
                }
            } else {
                if (board[r][c] && !isSameColor(board[r][c], piece)) {
                    moves.push([r, c]);
                } else if (
                    !board[r][c] &&
                    enPassant &&
                    enPassant[0] === r &&
                    enPassant[1] === c
                ) {
                    moves.push([r, c]);
                }
            }
        } else {
            while (inside(r,c)) {
                if (!board[r][c]) {
                    moves.push([r,c]);
                } else {
                    if (!isSameColor(board[r][c], piece)) moves.push([r,c]);
                    break;
                }
                r += dr; c += dc;
            }
        }
    }
    return moves;
}

function legalMoves(row, col) {
    const piece = board[row][col];
    const moves = generateMoves(row, col);
    const legal = [];
    for (const [r, c] of moves) {
        const capture = board[r][c];
        const prevEnPassant = enPassant;
        let epCapture = null;
        board[row][col] = null;
        board[r][c] = piece;
        if (
            piece.toLowerCase() === 'p' &&
            prevEnPassant &&
            prevEnPassant[0] === r &&
            prevEnPassant[1] === c &&
            c !== col &&
            !capture
        ) {
            const capRow = isWhite(piece) ? r + 1 : r - 1;
            epCapture = board[capRow][c];
            board[capRow][c] = null;
        }
        if (!isKingInCheck(isWhite(piece))) {
            legal.push([r, c]);
        }
        board[row][col] = piece;
        board[r][c] = capture;
        if (epCapture !== null) {
            const capRow = isWhite(piece) ? r + 1 : r - 1;
            board[capRow][c] = epCapture;
        }
        enPassant = prevEnPassant;
    }
    return legal;
}

function generateAttacks(row, col) {
    const moves = generateMoves(row, col);
    return moves.filter(([r,c]) => board[r][c] && !isSameColor(board[r][c], board[row][col]));
}

function inside(r,c) {
    return r >=0 && r<8 && c>=0 && c<8;
}

/**
 * Update board state for a move without re-rendering the board.
 * Returns true if the move is legal and executed.
 */
function executeMove(sr, sc, dr, dc) {
    const piece = board[sr][sc];
    if (isWhite(piece) !== isWhiteTurn()) return false;

    const moves = legalMoves(sr, sc);
    if (!moves.some(m => m[0] === dr && m[1] === dc)) return false;

    let captured = board[dr][dc];

    if (
        piece.toLowerCase() === 'p' &&
        enPassant &&
        enPassant[0] === dr &&
        enPassant[1] === dc &&
        dc !== sc &&
        !board[dr][dc]
    ) {
        const capRow = isWhite(piece) ? dr + 1 : dr - 1;
        captured = board[capRow][dc];
        board[capRow][dc] = null;
    }

    board[dr][dc] = piece;
    board[sr][sc] = null;

    enPassant = null;
    if (piece.toLowerCase() === 'p' && Math.abs(dr - sr) === 2) {
        enPassant = [(sr + dr) / 2, sc];
    }

    if (captured) {
        if (isWhite(captured)) capturedWhite.push(captured);
        else capturedBlack.push(captured);
    }

    turn = !turn;
    updateCapturedDisplay();
    updateTimer();
    return true;
}

/**
 * Animate a piece move from source to destination.
 */
function animateMove(sr, sc, dr, dc, piece) {
    const fromSquare = getSquareElement(sr, sc);
    const toSquare = getSquareElement(dr, dc);
    const boardRect = boardElement.getBoundingClientRect();
    const fromRect = fromSquare.getBoundingClientRect();
    const toRect = toSquare.getBoundingClientRect();

    const anim = document.createElement('div');
    anim.classList.add('anim-piece');
    anim.textContent = PIECES[piece];
    anim.style.left = (fromRect.left - boardRect.left) + 'px';
    anim.style.top = (fromRect.top - boardRect.top) + 'px';
    anim.style.width = fromRect.width + 'px';
    anim.style.height = fromRect.height + 'px';
    boardElement.appendChild(anim);

    fromSquare.querySelector('.piece').textContent = '';
    toSquare.querySelector('.piece').textContent = '';

    requestAnimationFrame(() => {
        anim.style.left = (toRect.left - boardRect.left) + 'px';
        anim.style.top = (toRect.top - boardRect.top) + 'px';
    });

    anim.addEventListener('transitionend', () => {
        anim.remove();
        renderBoard();
    });
}

/**
 * Perform a move with animation and update the board.
 */
function movePiece(sr, sc, dr, dc) {
    const piece = board[sr][sc];
    if (!executeMove(sr, sc, dr, dc)) return false;
    lastMove = { from: [sr, sc], to: [dr, dc] };
    animateMove(sr, sc, dr, dc, piece);
    return true;
}

let turn = true; // true = white
function isWhiteTurn() { return turn; }

function allAttackedSquares(forWhite) {
    const squares = [];
    for (let r=0;r<8;r++){
        for (let c=0;c<8;c++){
            const piece = board[r][c];
            if (piece && isWhite(piece)===forWhite){
                squares.push(...generateMoves(r,c));
            }
        }
    }
    return squares;
}

function possibleChecks(forWhite) {
    const moves = [];
    for (let r=0;r<8;r++){
        for (let c=0;c<8;c++){
            const piece = board[r][c];
            if (piece && isWhite(piece)===forWhite){
                for (const [dr,dc] of generateMoves(r,c)){
                    const target = board[dr][dc];
                    const capture = board[dr][dc];
                    board[dr][dc] = piece;
                    board[r][c] = null;
                    if (isKingInCheck(!forWhite)) moves.push([dr,dc]);
                    board[r][c] = piece;
                    board[dr][dc] = target;
                }
            }
        }
    }
    return moves;
}

function findKing(forWhite){
    const king = forWhite ? 'K' : 'k';
    for (let r=0;r<8;r++){
        for (let c=0;c<8;c++){
            if (board[r][c] === king) return [r,c];
        }
    }
    return null;
}

function isKingInCheck(forWhite){
    const kingPos = findKing(forWhite);
    if (!kingPos) return false;
    const enemyMoves = allAttackedSquares(!forWhite);
    return enemyMoves.some(([r,c]) => r===kingPos[0] && c===kingPos[1]);
}

function updateCapturedDisplay() {
    document.getElementById('capturedWhite').textContent = capturedWhite.map(p => PIECES[p]).join(' ');
    document.getElementById('capturedBlack').textContent = capturedBlack.map(p => PIECES[p]).join(' ');
}

function formatTime(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function updateTimer() {
    clearInterval(timerId);
    let start = Date.now();
    timerId = setInterval(() => {
        const now = Date.now();
        const diff = Math.floor((now - start) / 1000);
        if (turn) whiteTime += diff; else blackTime += diff;
        document.getElementById('timeWhite').textContent = formatTime(whiteTime);
        document.getElementById('timeBlack').textContent = formatTime(blackTime);
        start = now;
    }, 1000);
}

/**
 * Display the currently active view modes on screen.
 */
function updateViewIndicator() {
    const indicator = document.getElementById('activeViews');
    if (!indicator) return;
    indicator.innerHTML = '';
    if (activeViews.size === 0) {
        indicator.textContent = 'Sin vistas activas';
        return;
    }
    const frag = document.createDocumentFragment();
    [...activeViews].sort().forEach(view => {
        const span = document.createElement('span');
        span.classList.add('view-icon');
        span.textContent = VIEW_ICONS[view] || view;
        span.style.color = VIEW_COLORS[view] || 'inherit';
        frag.appendChild(span);
    });
    indicator.appendChild(frag);
}

// Allow quick view mode switch using number keys or numpad
window.addEventListener('keydown', e => {
    let num = NaN;
    if (/^Digit\d$/.test(e.code)) {
        num = parseInt(e.code.slice(5), 10);
    } else if (/^Numpad\d$/.test(e.code)) {
        num = parseInt(e.code.slice(6), 10);
    } else {
        num = parseInt(e.key);
    }
    if (!isNaN(num) && num >= 1 && num <= 4) {
        if (activeViews.has(num)) activeViews.delete(num);
        else activeViews.add(num);
        renderBoard();
        updateViewIndicator();
        e.preventDefault();
    }
});

// Settings menu handlers
settingsToggle.addEventListener('click', () => {
    settingsMenu.classList.toggle('hidden');
});

pieceSizeInput.addEventListener('input', () => {
    document.documentElement.style.setProperty('--piece-size', `${pieceSizeInput.value}px`);
});

neonInput.addEventListener('input', () => {
    document.documentElement.style.setProperty('--neon-l', `${neonInput.value}%`);
});

glowInput.addEventListener('input', () => {
    document.documentElement.style.setProperty('--glow-intensity', `${glowInput.value}px`);
});

saturationInput.addEventListener('input', () => {
    document.documentElement.style.setProperty('--neon-s', `${saturationInput.value}%`);
});

initBoard();
createBoard();
updateCapturedDisplay();
updateTimer();
updateViewIndicator();
