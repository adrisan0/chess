const boardElement = document.getElementById('board');
const settingsMenu = document.getElementById('settingsMenu');
const settingsToggle = document.getElementById('settingsToggle');
const pieceSizeInput = document.getElementById('pieceSize');
const neonInput = document.getElementById('neonBrightness');
const glowInput = document.getElementById('glowIntensity');
const saturationInput = document.getElementById('neonSaturation');
const themeSelect = document.getElementById('themeSelect');

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
let playerIsWhite = true; // true if human plays white
let moveHistory = [];
let halfmoveClock = 0; // for FEN; simple tracking
let userMoveStats = null; // loaded from Chess.com
let showPenalty = true;

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

const { pieceValue, evaluateMove: coreEvaluateMove } = AICore;

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
            pieceEl.classList.remove('white-piece','black-piece');
            square.classList.remove('highlight','attack','danger','check','last-move');
            // remove previous penalty badges
            const oldBadge = square.querySelector('.penalty-badge');
            if (oldBadge) oldBadge.remove();
            const piece = board[row][col];
            if (piece) {
                pieceEl.textContent = PIECES[piece];
                pieceEl.classList.add(isWhite(piece) ? 'white-piece' : 'black-piece');
            }
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
            scheduleAiMove();
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
        scheduleAiMove();
    } else {
        renderBoard();
    }
}

function isWhite(piece) {
    if (!piece) return false;
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
            const sq = getSquareElement(r, c);
            sq.classList.add('highlight');
            if (showPenalty && userMoveStats) {
                const san = sanForHypotheticalMove(row, col, r, c);
                const ply = moveHistory.length + 1; // current ply index (1-based)
                const norm = (window.ChessCom && window.ChessCom.normalizeSAN) ? window.ChessCom.normalizeSAN(san) : san;
                const entry = userMoveStats?.byPly?.[ply]?.[norm] || null;
                if (entry) {
                    const wr = Math.round((entry.winRate||0)*100);
                    const n = entry.count||0;
                    const badge = document.createElement('span');
                    badge.className = 'penalty-badge';
                    badge.textContent = `${wr}% • n=${n}`;
                    sq.appendChild(badge);
                    // heat: greener for higher wr, red for lower
                    const hue = Math.round(wr*1.2); // 0..120
                    sq.style.boxShadow = `inset 0 0 0 2px hsla(${hue},80%,60%,0.6)`;
                }
            }
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
 * Returns an object with the result of the move.
 */
function executeMove(sr, sc, dr, dc) {
    const piece = board[sr][sc];
    if (!piece) return { valid: false };
    if (isWhite(piece) !== isWhiteTurn()) return { valid: false };

    const moves = legalMoves(sr, sc);
    if (!moves.some(m => m[0] === dr && m[1] === dc)) return { valid: false };

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

    // naive halfmove clock: reset on pawn move or capture, else increment
    if (piece.toLowerCase() === 'p' || captured) halfmoveClock = 0;
    else halfmoveClock++;

    turn = !turn;
    updateCapturedDisplay();
    updateTimer();
    const check = isKingInCheck(turn);
    setTimeout(checkGameEnd, 0);
    return { valid: true, captured, check };
}

/**
 * Animate a piece move from source to destination.
 * If `captured` is provided, a celebration effect is shown
 * on the destination square when the animation ends.
 */
function animateMove(sr, sc, dr, dc, piece, captured) {
    const fromSquare = getSquareElement(sr, sc);
    const toSquare = getSquareElement(dr, dc);
    const boardRect = boardElement.getBoundingClientRect();
    const fromRect = fromSquare.getBoundingClientRect();
    const toRect = toSquare.getBoundingClientRect();

    const anim = document.createElement('div');
    anim.classList.add('anim-piece');
    anim.classList.add(isWhite(piece) ? 'white-piece' : 'black-piece');
    anim.textContent = PIECES[piece];
    anim.style.left = (fromRect.left - boardRect.left) + 'px';
    anim.style.top = (fromRect.top - boardRect.top) + 'px';
    anim.style.width = fromRect.width + 'px';
    anim.style.height = fromRect.height + 'px';
    boardElement.appendChild(anim);

    fromSquare.querySelector('.piece').textContent = '';
    toSquare.querySelector('.piece').textContent = '';

    requestAnimationFrame(() => {
        anim.classList.add('epic');
        anim.style.left = (toRect.left - boardRect.left) + 'px';
        anim.style.top = (toRect.top - boardRect.top) + 'px';
    });

    anim.addEventListener('transitionend', () => {
        anim.remove();
        if (captured) showCaptureCelebration(toSquare);
        renderBoard();
    });
}

/**
 * Show a short celebration animation when a capture occurs.
 * Uses a canvas-based fire effect when available.
 */
function showCaptureCelebration(square) {
    // Prefer the new magic effect, fallback to fire, then emoji
    if (typeof window.showMagicCaptureEffect === 'function') {
        const ok = window.showMagicCaptureEffect(square, {});
        if (ok) return;
    }
    if (typeof showFireEffect === 'function') { showFireEffect(square); return; }
    const boardRect = boardElement.getBoundingClientRect();
    const rect = square.getBoundingClientRect();
    const effect = document.createElement('div');
    effect.classList.add('capture-celebration');
    effect.textContent = '🎉';
    effect.style.left = (rect.left - boardRect.left + rect.width / 2) + 'px';
    effect.style.top = (rect.top - boardRect.top + rect.height / 2) + 'px';
    boardElement.appendChild(effect);
    effect.addEventListener('animationend', () => effect.remove());
}

/**
 * Perform a move with animation and update the board.
 */
function movePiece(sr, sc, dr, dc) {
    const piece = board[sr][sc];
    const result = executeMove(sr, sc, dr, dc);
    if (!result.valid) return false;
    lastMove = { from: [sr, sc], to: [dr, dc] };
    recordMove(sr, sc, dr, dc, piece, result.captured, result.check);
    animateMove(sr, sc, dr, dc, piece, result.captured);
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
    const whiteEl = document.getElementById('capturedWhite');
    const blackEl = document.getElementById('capturedBlack');
    whiteEl.innerHTML = capturedWhite
        .map(p => `<span class="${isWhite(p) ? 'white-piece' : 'black-piece'}">${PIECES[p]}</span>`)
        .join(' ');
    blackEl.innerHTML = capturedBlack
        .map(p => `<span class="${isWhite(p) ? 'white-piece' : 'black-piece'}">${PIECES[p]}</span>`)
        .join(' ');
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

const FILES = ['a','b','c','d','e','f','g','h'];

function squareName(row, col) {
    return FILES[col] + (8 - row);
}

function toAlgebraic(sr, sc, dr, dc, piece, captured, check) {
    const dest = squareName(dr, dc);
    let notation;
    if (piece.toLowerCase() === 'p') {
        const file = FILES[sc];
        notation = captured ? `${file}x${dest}` : dest;
    } else {
        notation = piece.toUpperCase() + (captured ? 'x' : '') + dest;
    }
    if (check) notation += '+';
    return notation;
}

function recordMove(sr, sc, dr, dc, piece, captured, check) {
    const san = toAlgebraic(sr, sc, dr, dc, piece, captured, check);
    moveHistory.push(san);
    updateMoveList();
    // If stats loaded and this move was by human, show penalty info summary
    try {
        const humanColorIsWhite = playerIsWhite;
        const thisPly = moveHistory.length; // 1-based index of SAN list
        const moveSideIsWhite = (thisPly % 2) === 1;
        if (userMoveStats && humanColorIsWhite === moveSideIsWhite) {
            const norm = (window.ChessCom && window.ChessCom.normalizeSAN) ? window.ChessCom.normalizeSAN(san) : san;
            const loss = window.ChessCom ? window.ChessCom.getPenaltyFor(userMoveStats, thisPly, norm) : null;
            const infoEl = document.getElementById('penaltyInfo');
            if (infoEl) {
                if (loss == null) {
                    infoEl.textContent = 'Sin datos históricos para esta jugada.';
                } else {
                    infoEl.textContent = `Penalización histórica: ${Math.round(loss*100)}% (basado en tu historial)`;
                }
            }
        }
        // Coach: siempre mostramos comentario basado en historial para tus jugadas
        if (humanColorIsWhite === moveSideIsWhite) {
            coachCommentAsync(san).catch(()=>{});
        }
    } catch {}
    // After any move, if it's now the human's turn and auto is on, preview recommendation
    tryAutoShowRecommendation();
}

function updateMoveList() {
    const list = document.getElementById('moveList');
    if (!list) return;
    list.innerHTML = '';
    for (let i = 0; i < moveHistory.length; i += 2) {
        const li = document.createElement('li');
        const white = moveHistory[i] || '';
        const black = moveHistory[i + 1] || '';
        li.textContent = `${Math.floor(i / 2) + 1}. ${white} ${black}`.trim();
        list.appendChild(li);
    }
    list.scrollTop = list.scrollHeight;
}

function exportPGN() {
    let pgn = '';
    for (let i = 0; i < moveHistory.length; i += 2) {
        const w = moveHistory[i] || '';
        const b = moveHistory[i + 1] || '';
        pgn += `${Math.floor(i / 2) + 1}. ${w} ${b} `;
    }
    const blob = new Blob([pgn.trim()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'partida.pgn';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
function showSettings() {
    settingsMenu.classList.remove('hidden');
}
function hideSettings() {
    settingsMenu.classList.add('hidden');
}
settingsToggle.addEventListener('click', showSettings);
// Close controls (button, backdrop click, ESC)
const settingsCloseBtn = document.getElementById('settingsClose');
if (settingsCloseBtn) settingsCloseBtn.addEventListener('click', hideSettings);
if (settingsMenu) settingsMenu.addEventListener('click', (e) => { if (e.target === settingsMenu) hideSettings(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !settingsMenu.classList.contains('hidden')) hideSettings(); });

pieceSizeInput.addEventListener('input', () => {
    document.documentElement.style.setProperty('--piece-size', `${pieceSizeInput.value}px`);
});

neonInput.addEventListener('input', () => {
    document.documentElement.style.setProperty('--neon-l', `${neonInput.value}%`);
});

/**
 * Score a potential move using simple heuristics.
 * Rewards captures, checks and new threats while
 * penalising moves that leave the piece en prise.
 */
function evaluateMove(sr, sc, dr, dc) {
    return coreEvaluateMove(
        board,
        { isWhite, isKingInCheck, generateAttacks, allAttackedSquares },
        sr,
        sc,
        dr,
        dc,
        enPassant
    );
}

/**
 * Perform a move for the computer side.
 * Priority: Persona (your style) > Stockfish > Random.
 */
async function aiMove() {
    const moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (
                piece &&
                isWhite(piece) === isWhiteTurn() &&
                ((isWhiteTurn() && !playerIsWhite) || (!isWhiteTurn() && playerIsWhite))
            ) {
                const legal = legalMoves(r, c);
                for (const [dr, dc] of legal) {
                    moves.push({ sr: r, sc: c, dr, dc });
                }
            }
        }
    }
    if (moves.length === 0) return;

    // 0) LLM may choose a move (fast), but never block engine too long
    if (useLLMPick) {
        try {
            const timeoutMs = 800;
            const picked = await Promise.race([
                llmPickMove(moves),
                new Promise(resolve => setTimeout(()=> resolve(null), timeoutMs))
            ]);
            if (picked) {
                movePiece(picked.sr, picked.sc, picked.dr, picked.dc);
                selected = null;
                scheduleAiMove();
                return;
            }
        } catch (e) { console.warn('LLM pick failed', e); }
    }

    // 1) Try persona-based move if enabled and stats available
    if (usePersona && userMoveStats) {
        const picked = pickPersonaMove(moves);
        if (picked) {
            movePiece(picked.sr, picked.sc, picked.dr, picked.dc);
            selected = null;
            scheduleAiMove();
            return;
        }
    }

    // 2) Try engine
    if (useEngine && await ensureEngine()) {
        try {
            await engineMove();
            selected = null;
            scheduleAiMove();
            return;
        } catch (e) {
            console.warn('Fallo motor, usando aleatorio:', e);
        }
    }

    // 3) Fallback random
    const m = moves[Math.floor(Math.random() * moves.length)];
    movePiece(m.sr, m.sc, m.dr, m.dc);
    selected = null;
    scheduleAiMove();
}

function pickPersonaMove(moves) {
    try {
        const ply = moveHistory.length + 1; // next ply
        const hasNormalizer = !!(window.ChessCom && window.ChessCom.normalizeSAN);
        if (!hasNormalizer || !userMoveStats) return null;

        // 1) Contextual n-gram weights (Markov backoff)
        const ngrams = userMoveStats.ngrams || null;
        let weightsCtx = null;
        if (ngrams && ngrams.map) {
            const N = ngrams.N || 2;
            const hist = moveHistory.map(s => window.ChessCom.normalizeSAN(s));
            const ctxArr = hist.slice(Math.max(0, hist.length - N), hist.length);
            const sideTag = isWhiteTurn() ? 'W' : 'B';
            const ctxKey = sideTag + '|' + ctxArr.join('|');
            weightsCtx = ngrams.map[ctxKey] || null;
        }

        // 2) Per-ply weights
        const byPly = userMoveStats?.byPly?.[ply] || null;

        // Combine weights: w = a*ctx + b*ply (+ small epsilon)
        const alpha = 6, beta = 1, eps = 0.000001;
        const items = [];
        for (const m of moves) {
            const san = sanForHypotheticalMove(m.sr, m.sc, m.dr, m.dc);
            const norm = window.ChessCom.normalizeSAN(san);
            const wCtx = weightsCtx ? (weightsCtx[norm] || 0) : 0;
            const wPly = byPly ? (byPly[norm]?.count || 0) : 0;
            const w = alpha * wCtx + beta * wPly + eps;
            items.push({ m, w, norm });
        }
        const sum = items.reduce((s, it) => s + it.w, 0);
        if (sum <= eps * items.length) return null; // nothing learned
        let x = Math.random() * sum;
        for (const it of items) {
            x -= it.w;
            if (x <= 0) return it.m;
        }
        return items[items.length - 1]?.m || null;
    } catch (e) {
        console.warn('pickPersonaMove error', e);
        return null;
    }
}

/**
 * Schedule an AI move if it is the computer's turn.
 */
function scheduleAiMove() {
    if ((turn && !playerIsWhite) || (!turn && playerIsWhite)) {
        setTimeout(aiMove, 300);
    }
}
glowInput.addEventListener('input', () => {
    document.documentElement.style.setProperty('--glow-intensity', `${glowInput.value}px`);
});

saturationInput.addEventListener('input', () => {
    document.documentElement.style.setProperty('--neon-s', `${saturationInput.value}%`);
});

function applyTheme(theme) {
    document.body.classList.remove('theme-neon', 'theme-classic', 'theme-contrast');
    document.body.classList.add(`theme-${theme}`);
}

if (themeSelect) {
    themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));
    applyTheme(themeSelect.value);
}

const exportBtn = document.getElementById('exportPGN');
if (exportBtn) exportBtn.addEventListener('click', exportPGN);

// ====== Game over handling ======
const gameOverEl = document.getElementById('gameOver');
const gameOverTitleEl = document.getElementById('gameOverTitle');
const gameOverDescEl = document.getElementById('gameOverDesc');
const btnNewGame = document.getElementById('btnNewGame');
const btnCloseOver = document.getElementById('btnCloseOver');

function anyLegalMoves(forWhite){
    for (let r=0;r<8;r++){
        for (let c=0;c<8;c++){
            const p = board[r][c];
            if (!p) continue;
            if (isWhite(p)!==forWhite) continue;
            if (legalMoves(r,c).length>0) return true;
        }
    }
    return false;
}

function checkGameEnd(){
    try{
        const sideWhite = isWhiteTurn();
        const hasMoves = anyLegalMoves(sideWhite);
        const inCheck = isKingInCheck(sideWhite);
        if (!hasMoves) {
            const mate = inCheck;
            if (gameOverEl && gameOverTitleEl && gameOverDescEl) {
                const winnerWhite = !sideWhite; // previous mover
                if (mate) {
                    gameOverTitleEl.textContent = 'Jaque mate';
                    gameOverDescEl.textContent = `Ganan ${winnerWhite? 'blancas':'negras'}.`;
                } else {
                    gameOverTitleEl.textContent = 'Tablas';
                    gameOverDescEl.textContent = 'Rey ahogado.';
                }
                gameOverEl.classList.remove('hidden');
            }
        }
    }catch{}
}

function resetState(){
    capturedWhite = [];
    capturedBlack = [];
    enPassant = null;
    lastMove = null;
    halfmoveClock = 0;
    moveHistory = [];
    whiteTime = 0;
    blackTime = 0;
    turn = true;
}

function newGame(){
    resetState();
    initBoard();
    renderBoard();
    if (gameOverEl) gameOverEl.classList.add('hidden');
    startGame(playerIsWhite);
}

if (btnNewGame) btnNewGame.addEventListener('click', newGame);
if (btnCloseOver) btnCloseOver.addEventListener('click', ()=>{ if (gameOverEl) gameOverEl.classList.add('hidden'); });

// Learning UI: username + load stats + toggle
const ccInput = document.getElementById('ccUsername');
const loadStatsBtn = document.getElementById('loadStatsBtn');
const showPenaltyChk = document.getElementById('showPenalty');

if (ccInput) {
    const savedU = localStorage.getItem('cc_username');
    if (savedU) ccInput.value = savedU;
}

// Coach UI: show recommendation + auto toggle
const btnShowRec = document.getElementById('btnShowRec');
const autoRecChk = document.getElementById('autoRec');
if (btnShowRec) btnShowRec.addEventListener('click', () => { showRecommendationAnimation(); });
if (autoRecChk) {
    const saved = localStorage.getItem('auto_rec_anim');
    if (saved != null) autoRecChk.checked = (saved === 'true');
    autoRecChk.addEventListener('change', () => {
        localStorage.setItem('auto_rec_anim', String(!!autoRecChk.checked));
        // If enabling and it's human turn, show now
        if (autoRecChk.checked) tryAutoShowRecommendation();
    });
}
if (showPenaltyChk) {
    showPenalty = !!showPenaltyChk.checked;
    showPenaltyChk.addEventListener('change', () => {
        showPenalty = !!showPenaltyChk.checked;
        renderBoard();
        if (selected) highlightMoves(selected.row, selected.col);
    });
}
if (loadStatsBtn) {
    loadStatsBtn.addEventListener('click', async () => {
        const u = (ccInput?.value||'').trim();
        if (!u) { alert('Introduce tu usuario de Chess.com'); return; }
        localStorage.setItem('cc_username', u);
        const infoEl = document.getElementById('penaltyInfo');
        const modelEl = document.getElementById('modelStatus');
        if (infoEl) infoEl.textContent = 'Cargando historial…';
        try {
            userMoveStats = await window.ChessCom.loadUserMoveStats(u, { months: 'all' });
            if (infoEl) infoEl.textContent = `Historial cargado (${userMoveStats.months} meses). Resalta casillas para ver %.`;
            if (modelEl) {
                const bm = userMoveStats.benchmark || {};
                if (bm.samples) {
                    const q = bm.quality || 'unknown';
                    const ctx = Math.round((bm.ctxCoverage||0)*100);
                    const ply = Math.round((bm.plyCoverage||0)*100);
                    modelEl.textContent = `Modelo: ${q} • muestras ${bm.samples} • contexto ${ctx}% • ply ${ply}%`;
                } else {
                    modelEl.textContent = 'Modelo: sin benchmark disponible.';
                }
            }
            renderBoard();
            if (selected) highlightMoves(selected.row, selected.col);
        } catch (e) {
            console.error(e);
            if (infoEl) infoEl.textContent = 'No se pudo cargar el historial.';
            const modelEl2 = document.getElementById('modelStatus');
            if (modelEl2) modelEl2.textContent = '';
            alert('No se pudo cargar el historial de Chess.com. Verifica el usuario.');
        }
    });
}

initBoard();
createBoard();

function startGame(asWhite) {
    playerIsWhite = !!asWhite;
    try { if (boardElement) boardElement.classList.toggle('flipped', !playerIsWhite); } catch {}
    updateCapturedDisplay();
    updateTimer();
    updateViewIndicator();
    updateMoveList();
    scheduleAiMove();
}

// Nueva pantalla de inicio si existe overlay; si no, fallback al confirm
const startOverlay = document.getElementById('startOverlay');
const btnPlayWhite = document.getElementById('btnPlayWhite');
const btnPlayBlack = document.getElementById('btnPlayBlack');
if (startOverlay && btnPlayWhite && btnPlayBlack) {
    btnPlayWhite.addEventListener('click', () => {
        startOverlay.style.display = 'none';
        startGame(true);
    });
    btnPlayBlack.addEventListener('click', () => {
        startOverlay.style.display = 'none';
        startGame(false);
    });
} else {
    const playWhite = window.confirm('¿Quieres jugar con blancas?\nAceptar: blancas, Cancelar: negras');
    startGame(!!playWhite);
}

// Utility: Build SAN for hypothetical move (without check mark)
function sanForHypotheticalMove(sr, sc, dr, dc){
    const piece = board[sr][sc];
    let captured = board[dr][dc];
    // handle en passant capture case
    if (
        piece && piece.toLowerCase() === 'p' &&
        !captured && sc !== dc && enPassant && enPassant[0] === dr && enPassant[1] === dc
    ) {
        captured = isWhite(piece) ? 'p' : 'P';
    }
    const san = toAlgebraic(sr, sc, dr, dc, piece, captured, false);
    return san;
}

// ============ Motor Stockfish (opcional) ============
let engine = null;
let engineReady = false;
let useEngine = true; // default Stockfish
let engineDepth = 10;
let engineMoveTimeMs = 1200; // time-per-move for responsiveness
let engineElo = 1600; // default strength target
let usePersona = false;
let useLLMCoach = false;
let useLLMPick = false;
let dsApiBase = '/api/deepseek';
let dsModel = 'deepseek-chat';

const useEngineChk = document.getElementById('useEngine');
const usePersonaChk = document.getElementById('usePersona');
const useLLMCoachChk = document.getElementById('useLLMCoach');
// Side controls
const useEngineSide = document.getElementById('useEngineSide');
const engineEloInput = document.getElementById('engineElo');
const useLLMCoachSide = document.getElementById('useLLMCoachSide');
const useLLMPickSide = document.getElementById('useLLMPickSide');
const engineDepthInput = document.getElementById('engineDepth');

// restore settings
try {
    const savedUse = localStorage.getItem('use_engine');
    const savedDepth = localStorage.getItem('engine_depth');
    const savedPersona = localStorage.getItem('use_persona');
    const savedCoach = localStorage.getItem('use_llm_coach');
    const savedDSBase = localStorage.getItem('ds_api_base');
    const savedDSModel = localStorage.getItem('ds_model');
    const savedElo = localStorage.getItem('engine_elo');
    const savedLlmpick = localStorage.getItem('use_llm_pick');
    if (savedUse != null) useEngine = savedUse === 'true';
    if (savedDepth != null) engineDepth = Math.max(4, Math.min(20, parseInt(savedDepth)||10));
    if (savedPersona != null) usePersona = savedPersona === 'true';
    if (savedCoach != null) useLLMCoach = savedCoach === 'true';
    if (savedDSBase) dsApiBase = savedDSBase;
    if (savedDSModel) dsModel = savedDSModel;
    if (savedElo != null) engineElo = Math.max(800, Math.min(2800, parseInt(savedElo)||1600));
    if (useEngineChk) useEngineChk.checked = useEngine;
    if (usePersonaChk) usePersonaChk.checked = usePersona;
    if (useLLMCoachChk) useLLMCoachChk.checked = useLLMCoach;
    if (engineDepthInput) engineDepthInput.value = String(engineDepth);
    if (useEngineSide) useEngineSide.checked = useEngine;
    if (engineEloInput) engineEloInput.value = String(engineElo);
    if (useLLMCoachSide) useLLMCoachSide.checked = useLLMCoach;
    if (savedLlmpick != null) useLLMPick = savedLlmpick === 'true';
    if (useLLMPickSide) useLLMPickSide.checked = useLLMPick;
} catch {}

if (useEngineChk) {
    useEngineChk.addEventListener('change', async () => {
        useEngine = !!useEngineChk.checked;
        localStorage.setItem('use_engine', String(useEngine));
        if (useEngine) await ensureEngine();
        scheduleAiMove();
    });
}
if (usePersonaChk) {
    usePersonaChk.addEventListener('change', () => {
        usePersona = !!usePersonaChk.checked;
        localStorage.setItem('use_persona', String(usePersona));
        scheduleAiMove();
    });
}
if (useLLMCoachChk) {
    useLLMCoachChk.addEventListener('change', () => {
        useLLMCoach = !!useLLMCoachChk.checked;
        localStorage.setItem('use_llm_coach', String(useLLMCoach));
    });
}
// Side controls wiring
if (useEngineSide) {
    useEngineSide.addEventListener('change', async () => {
        useEngine = !!useEngineSide.checked;
        localStorage.setItem('use_engine', String(useEngine));
        if (useEngine) { await ensureEngine(); await applyEngineStrength(); }
        scheduleAiMove();
        if (useEngineChk) useEngineChk.checked = useEngine;
    });
}
if (engineEloInput) {
    engineEloInput.addEventListener('input', async () => {
        engineElo = Math.max(800, Math.min(2800, parseInt(engineEloInput.value)||1600));
        localStorage.setItem('engine_elo', String(engineElo));
        await applyEngineStrength();
    });
}
if (useLLMCoachSide) {
    useLLMCoachSide.addEventListener('change', () => {
        useLLMCoach = !!useLLMCoachSide.checked;
        localStorage.setItem('use_llm_coach', String(useLLMCoach));
        if (useLLMCoachChk) useLLMCoachChk.checked = useLLMCoach;
    });
}
if (useLLMPickSide) {
    useLLMPickSide.addEventListener('change', () => {
        useLLMPick = !!useLLMPickSide.checked;
        localStorage.setItem('use_llm_pick', String(useLLMPick));
    });
}
if (engineDepthInput) {
    engineDepthInput.addEventListener('input', () => {
        engineDepth = Math.max(4, Math.min(20, parseInt(engineDepthInput.value)||10));
        localStorage.setItem('engine_depth', String(engineDepth));
    });
}

function tryCreateEngine() {
    // 1) STOCKFISH() build (main-thread shim)
    if (typeof window.STOCKFISH === 'function') {
        try {
            return window.STOCKFISH();
        } catch {}
    }
    // 1.5) Server-exposed worker (stable path)
    try {
        return new Worker('/vendor/stockfish/stockfish.js');
    } catch {}
    // 2) Worker build at src/stockfish.js
    try {
        return new Worker('src/stockfish.js');
    } catch {}
    // 3) NPM package path when served statically (server serves project root)
    try {
        return new Worker('node_modules/stockfish/src/stockfish.js');
    } catch {}
    try {
        return new Worker('node_modules/stockfish/stockfish.js');
    } catch {}
    // 4) CDN fallback (cross-origin). Note: requires CORS on CDN
    try {
        return new Worker('https://cdn.jsdelivr.net/npm/stockfish@17.1.0/src/stockfish.js');
    } catch {}
    return null;
}

async function ensureEngine() {
    if (engine && engineReady) return true;
    if (!engine) engine = tryCreateEngine();
    if (!engine) return false;
    const ok = await initEngine();
    if (!ok) return false;
    // ping the engine once to ensure it's responsive
    try { await new Promise(res => setTimeout(res, 50)); } catch {}
    return true;
}

function enginePost(cmd) {
    if (!engine) return;
    if (typeof engine.postMessage === 'function') engine.postMessage(cmd);
    else if (typeof engine === 'function') engine(cmd); // unlikely
}

function attachBaseEngineHandler() {
    if (!engine) return;
    const prev = engine.onmessage;
    engine.onmessage = (e) => {
        const line = (e && e.data) ? String(e.data) : '';
        if (line.startsWith('uciok') || line.startsWith('readyok')) engineReady = true;
        // pass-through
        if (typeof prev === 'function') try { prev(e); } catch {}
        // console.log('[ENGINE]', line);
    };
}

function waitForBestmove() {
    return new Promise((resolve, reject) => {
        if (!engine) return reject(new Error('engine not available'));
        const prev = engine.onmessage;
        let timeout = setTimeout(() => {
            // restore and reject
            if (engine) engine.onmessage = prev;
            reject(new Error('engine timeout'));
        }, 6000);
        engine.onmessage = (e) => {
            const line = (e && e.data) ? String(e.data) : '';
            if (line.startsWith('bestmove ')) {
                clearTimeout(timeout);
                if (engine) engine.onmessage = prev;
                const parts = line.split(/\s+/);
                resolve(parts[1]);
                return;
            }
            // keep passing through
            if (typeof prev === 'function') try { prev(e); } catch {}
        };
    });
}

async function initEngine() {
    try {
        attachBaseEngineHandler();
        enginePost('uci');
        // wait a bit for uciok; also send isready to speed up
        enginePost('isready');
        // poll readiness up to 1s
        const start = Date.now();
        while (!engineReady && Date.now() - start < 1000) {
            await new Promise(r => setTimeout(r, 50));
        }
        await applyEngineStrength();
        return true;
    } catch (e) {
        console.warn('initEngine error', e);
        return false;
    }
}

async function applyEngineStrength(){
    if (!engine) return;
    try{
        // Prefer UCI_Elo if supported
        enginePost('setoption name UCI_LimitStrength value true');
        enginePost(`setoption name UCI_Elo value ${engineElo|0}`);
        // Fallback Skill Level 0-20
        const level = Math.max(0, Math.min(20, Math.round((engineElo - 800) / (2800-800) * 20)));
        enginePost(`setoption name Skill Level value ${level}`);
        enginePost('isready');
    }catch{}
}

function currentFEN() {
    // piece placement
    const rows = [];
    for (let r = 0; r < 8; r++) {
        let row = '';
        let empty = 0;
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (!p) empty++;
            else {
                if (empty) { row += String(empty); empty = 0; }
                row += p;
            }
        }
        if (empty) row += String(empty);
        rows.push(row);
    }
    const placement = rows.join('/');
    const active = turn ? 'w' : 'b';
    const castling = '-'; // no castling support in move gen yet
    const ep = enPassant ? squareName(enPassant[0], enPassant[1]) : '-';
    const half = Math.max(0, halfmoveClock|0);
    const full = Math.floor(moveHistory.length / 2) + 1;
    return `${placement} ${active} ${castling} ${ep} ${half} ${full}`;
}

function uciCoordToRC(coord) {
    // e2 -> [row, col]; row 8->1 maps to 0->7
    const file = coord[0].charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = parseInt(coord[1], 10);
    const row = 8 - rank;
    const col = file;
    return [row, col];
}

async function engineMove() {
    const fen = currentFEN();
    const ready = await ensureEngine();
    if (!ready) throw new Error('engine not available');
    enginePost('ucinewgame');
    enginePost(`position fen ${fen}`);
    // Prefer fixed movetime for snappy responses
    if (engineMoveTimeMs && engineMoveTimeMs > 0) enginePost(`go movetime ${engineMoveTimeMs|0}`);
    else enginePost(`go depth ${engineDepth}`);
    const best = await waitForBestmove(); // e2e4 or e7e8q
    if (!best || best.length < 4) throw new Error('bestmove vacío');
    const from = best.slice(0, 2);
    const to = best.slice(2, 4);
    const [sr, sc] = uciCoordToRC(from);
    const [dr, dc] = uciCoordToRC(to);
    // Nota: promociones (e7e8q) no están implementadas; se ignoran sufijos.
    movePiece(sr, sc, dr, dc);
}

// ====== LLM helpers for coach and move picking ======
function coachFeedAppend(role, text){
    const feed = document.getElementById('coachFeed'); if(!feed) return;
    const wrap = document.createElement('div');
    wrap.className = 'msg '+(role||'bot')+' entering';
    const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.textContent = text;
    wrap.appendChild(bubble); feed.appendChild(wrap);
    feed.scrollTop = feed.scrollHeight; requestAnimationFrame(()=> wrap.classList.remove('entering'));
}

async function coachCommentAsync(lastSan){
    // 1) Siempre prioriza comentario basado en tu propio historial para la jugada realizada
    try {
        const ply = moveHistory.length; // ya cambió el turno dentro de executeMove
        const msg = buildHistoryCoachMessage(ply, lastSan);
        if (msg) { coachFeedAppend('bot', msg); showCoachOverlay(msg); }
    } catch {}
    // 2) Opcional: si el usuario activa LLM, añadimos un matiz extra
    try {
        if (!useLLMCoach) return;
        const fen = currentFEN();
        const system = 'Eres un coach de ajedrez y SOLO complementas el análisis con 1 frase. No inventes. Si no hay datos, di "sin datos".';
        const ply = moveHistory.length;
        const snap = buildCoachSnapshot(ply) || {};
        const prompt = `Datos (ply ${ply}): ${JSON.stringify(snap)}\nFEN: ${fen}\nJugada reciente: ${lastSan}\nCompleta con un matiz breve y práctico (1 frase).`;
        const txt = await askDeepseek({ prompt, system });
        if (txt) { coachFeedAppend('bot', txt); }
    } catch {}
}

function buildUserPlyContext(ply){
    try{
        if (!userMoveStats || !userMoveStats.byPly) return null;
        const slot = userMoveStats.byPly[ply]; if (!slot) return null;
        const arr = Object.keys(slot).map(k=>({san:k, c:slot[k].count||0, wr: slot[k].winRate||0, dr: slot[k].drawRate||0, lr: slot[k].lossRate||0})).sort((a,b)=> b.c-a.c).slice(0,5);
        const total = arr.reduce((s,a)=> s+a.c, 0);
        return { ply, top: arr, total };
    }catch{return null}
}

function getLegalMovesSANList(){
    const res = new Set();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece) continue;
            if (isWhite(piece) !== isWhiteTurn()) continue;
            const legal = legalMoves(r, c);
            for (const [dr, dc] of legal) {
                const san = sanForHypotheticalMove(r, c, dr, dc);
                res.add((window.ChessCom && window.ChessCom.normalizeSAN) ? window.ChessCom.normalizeSAN(san) : san);
            }
        }
    }
    return [...res];
}

function buildCoachSnapshot(ply){
    try{
        const ctx = buildUserPlyContext(ply) || { top: [], total: 0 };
        const slot = userMoveStats?.byPly?.[ply] || null;
        // Frequent: top by count
        const frequent = (ctx.top||[]).map(x=> ({ m:x.san, n:x.c, wr: Math.round((x.wr||0)*100) }));
        // Avoid: highest lossRate with support
        let avoid = [];
        if (slot) {
            avoid = Object.keys(slot)
              .map(k=> ({ m:k, n:slot[k].count||0, lr: slot[k].lossRate||0 }))
              .filter(x=> x.n>=5)
              .sort((a,b)=> b.lr - a.lr)
              .slice(0,5)
              .map(x=> ({ m:x.m, n:x.n, lr: Math.round(x.lr*100) }));
        }
        // Legal options annotated with user's wr if known
        const legalMoves = getLegalMovesSANList();
        const legal = legalMoves.map(m => {
            const st = slot?.[m] || null;
            return { m, n: st?.count||0, wr: st? Math.round((st.winRate||0)*100) : null };
        });
        return { frequent, avoid, legal };
    }catch{ return null }
}

function showCoachOverlay(text){
    try{
        if (!lastMove) return;
        const from = lastMove.from, to = lastMove.to;
        const fromEl = getSquareElement(from[0], from[1]);
        const toEl = getSquareElement(to[0], to[1]);
        const bRect = boardElement.getBoundingClientRect();
        const fr = fromEl.getBoundingClientRect();
        const tr = toEl.getBoundingClientRect();
        const fx = fr.left - bRect.left + fr.width/2;
        const fy = fr.top - bRect.top + fr.height/2;
        const tx = tr.left - bRect.left + tr.width/2;
        const ty = tr.top - bRect.top + tr.height/2;
        const dx = tx - fx, dy = ty - fy;
        const len = Math.sqrt(dx*dx + dy*dy);
        const ang = Math.atan2(dy, dx) * 180/Math.PI;
        // clear previous
        boardElement.querySelectorAll('.coach-annot').forEach(n=>n.remove());
        // arrow
        const arr = document.createElement('div');
        arr.className = 'coach-annot coach-arrow';
        arr.style.left = fx + 'px';
        arr.style.top = (fy - 1.5) + 'px';
        arr.style.width = (len - 20) + 'px';
        arr.style.transformOrigin = 'left center';
        arr.style.transform = `rotate(${ang}deg)`;
        boardElement.appendChild(arr);
        // bubble
        const bub = document.createElement('div');
        bub.className = 'coach-annot coach-bubble';
        const offsetX = 12, offsetY = -36;
        bub.style.left = (tx + offsetX) + 'px';
        bub.style.top = (ty + offsetY) + 'px';
        bub.textContent = text;
        boardElement.appendChild(bub);
        setTimeout(()=>{ try{arr.remove(); bub.remove();}catch{} }, 4500);
    }catch{}
}

// Genera un comentario conciso basado en tu historial para la jugada concreta (ply,san)
function buildHistoryCoachMessage(ply, san){
    try{
        if (!userMoveStats || !userMoveStats.byPly) return null;
        const norm = (window.ChessCom && window.ChessCom.normalizeSAN) ? window.ChessCom.normalizeSAN(san) : san;
        const slot = userMoveStats.byPly?.[ply] || null; if (!slot) return null;
        const me = slot[norm] || null; if (!me) return `Sin datos previos para ${norm} en jugada ${Math.ceil(ply/2)}.`;
        const entries = Object.entries(slot).map(([m,st])=>({m, c:st.count||0, wr: st.winRate||0}));
        const sumC = entries.reduce((s,e)=> s+e.c, 0) || 1;
        const avgWR = entries.reduce((s,e)=> s + (e.wr*e.c), 0) / sumC;
        const bestAlt = entries
          .filter(e=> e.m !== norm && e.c>=4)
          .sort((a,b)=> b.wr - a.wr || b.c - a.c)[0] || null;
        const worstAlt = entries
          .filter(e=> e.m !== norm && e.c>=4)
          .sort((a,b)=> a.wr - b.wr || b.c - a.c)[0] || null;
        const wr = Math.round((me.winRate||0)*100);
        const n = me.count||0;
        const base = Math.round(avgWR*100);
        const delta = wr - base;
        const sign = delta>=0? '+':'-';
        let why = '';
        if (bestAlt && worstAlt){
            const ba = `${bestAlt.m} (${Math.round(bestAlt.wr*100)}%` + (bestAlt.c?`, n=${bestAlt.c}`:'') + ')';
            const wa = `${worstAlt.m} (${Math.round(worstAlt.wr*100)}%` + (worstAlt.c?`, n=${worstAlt.c}`:'') + ')';
            why = ` Frente a tus alternativas, mejor te suele ir ${ba}; peor ${wa}.`;
        } else if (bestAlt){
            const ba = `${bestAlt.m} (${Math.round(bestAlt.wr*100)}%` + (bestAlt.c?`, n=${bestAlt.c}`:'') + ')';
            why = ` Alternativa destacada: ${ba}.`;
        }
        // Opponent replies effect if available
        try{
            const after = userMoveStats.after?.[ply]?.[norm] || null;
            if (after) {
                const replies = Object.entries(after).map(([m,st])=> ({m, c:st.count||0, wr: (st.w||0)/Math.max(1,st.count||0)})).filter(x=> x.c>=3);
                if (replies.length>=1){
                    const goodR = replies.slice().sort((a,b)=> b.wr - a.wr || b.c - a.c)[0];
                    const badR = replies.slice().sort((a,b)=> a.wr - b.wr || b.c - a.c)[0];
                    const goodTxt = `${goodR.m} (tú ${Math.round(goodR.wr*100)}% en n=${goodR.c})`;
                    const badTxt = `${badR.m} (tú ${Math.round(badR.wr*100)}% en n=${badR.c})`;
                    why += ` Respondiendo el rival: te sienta bien ${goodTxt}; te complica ${badTxt}.`;
                }
            }
        }catch{}
        const verdict = delta>=2 ? 'te suele beneficiar' : (delta<=-2 ? 'te suele perjudicar' : 'rinde como tu media');
        return `Cuando juegas ${norm} en jugada ${Math.ceil(ply/2)}: ${wr}% vict. (n=${n}), media de ese turno ${base}% (${sign}${Math.abs(delta)}pp): ${verdict}.${why}`;
    }catch{ return null }
}

async function llmPickMove(moves){
    const cand = moves.map(m => ({...m, san: sanForHypotheticalMove(m.sr, m.sc, m.dr, m.dc)}));
    const fen = currentFEN();
    const opts = cand.map(c => c.san).join(', ');
    const system = 'Devuelve solo una jugada en SAN, exactamente como aparece en la lista.';
    const prompt = `Posición FEN: ${fen}\nOpciones legales (SAN): ${opts}\nElige una (estilo humano, segura).`;
    try{
        const ans = await askDeepseek({ prompt, system });
        const pick = (ans||'').split(/\s|\n/)[0].trim();
        return cand.find(c => c.san === pick) || null;
    }catch{ return null; }
}

async function askDeepseek({prompt, system}){
    const base = dsApiBase || '/api/deepseek';
    const url = base.replace(/\/$/,'') + '/chat/completions';
    const body = { model: dsModel || 'deepseek-chat', messages: [ {role:'system', content: system||''}, {role:'user', content: prompt} ], temperature: 0.3 };
    const headers = { 'Content-Type':'application/json' };
    const res = await fetch(url, { method:'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('LLM HTTP '+res.status);
    const data = await res.json();
    return (data?.choices?.[0]?.message?.content||'').trim();
}

// ====== Visual recommendation (animated preview) ======
function collectLegalMovesForCurrent(){
    const list = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece) continue;
            if (isWhite(piece) !== isWhiteTurn()) continue;
            const legal = legalMoves(r, c);
            for (const [dr, dc] of legal) {
                const san = sanForHypotheticalMove(r, c, dr, dc);
                list.push({ sr:r, sc:c, dr, dc, san, piece });
            }
        }
    }
    return list;
}

async function engineBestMoveQuick(){
    try{
        if (!useEngine) return null;
        const ready = await ensureEngine();
        if (!ready) return null;
        const fen = currentFEN();
        enginePost('ucinewgame');
        enginePost(`position fen ${fen}`);
        enginePost('go movetime 300');
        const best = await waitForBestmove();
        if (!best || best.length < 4) return null;
        const from = best.slice(0,2), to = best.slice(2,4);
        const [sr, sc] = uciCoordToRC(from);
        const [dr, dc] = uciCoordToRC(to);
        return { sr, sc, dr, dc };
    }catch{return null}
}

function recommendMoveForHuman(){
    // Only when it's the human's turn
    const humanToMove = (turn && playerIsWhite) || (!turn && !playerIsWhite);
    if (!humanToMove) return null;
    const cand = collectLegalMovesForCurrent();
    if (cand.length === 0) return null;
    // 1) Use user stats if available: pick highest win rate
    try{
        const ply = moveHistory.length + 1;
        const slot = userMoveStats?.byPly?.[ply] || null;
        if (slot) {
            let best = null, bestWr = -1, bestN = 0;
            for (const m of cand) {
                const norm = (window.ChessCom && window.ChessCom.normalizeSAN) ? window.ChessCom.normalizeSAN(m.san) : m.san;
                const st = slot[norm] || null;
                if (st && typeof st.winRate === 'number') {
                    const wr = st.winRate; // 0..1
                    if (wr > bestWr || (wr === bestWr && (st.count||0) > bestN)) {
                        best = m; bestWr = wr; bestN = st.count||0;
                    }
                }
            }
            if (best) return { move: best, meta: { source: 'historial', wr: Math.round(bestWr*100), n: bestN } };
        }
    }catch{}
    // 2) Else fallback to engine suggestion (quick)
    // Note: this path is async, handled by showRecommendationAnimation()
    if (useEngine) return { move: null, meta: { source: 'motor' } };
    // 3) Heuristic: advance toward center / captures first
    const centerR = 3.5, centerC = 3.5;
    let best = null, bestScore = -1;
    for (const m of cand) {
        const dr = m.dr, dc = m.dc;
        const toCenter = -Math.hypot(dr - centerR, dc - centerC); // closer to center is better
        const capture = board[dr][dc] ? 0.5 : 0; // prefer captures slightly
        const score = toCenter + capture;
        if (score > bestScore) { bestScore = score; best = m; }
    }
    return best ? { move: best, meta: { source: 'heurística' } } : null;
}

async function showRecommendationAnimation(){
    // compute or fetch move
    let rec = recommendMoveForHuman();
    if (!rec) return;
    let move = rec.move;
    let meta = rec.meta || {};
    if (!move && meta.source === 'motor') {
        const best = await engineBestMoveQuick();
        if (best) {
            const piece = board[best.sr][best.sc];
            move = { ...best, piece, san: sanForHypotheticalMove(best.sr, best.sc, best.dr, best.dc) };
        } else {
            // fallback heuristic
            const cand = collectLegalMovesForCurrent();
            if (!cand.length) return;
            const centerR = 3.5, centerC = 3.5;
            cand.sort((a,b)=>{
                const ac = -Math.hypot(a.dr-centerR, a.dc-centerC) + (board[a.dr][a.dc]?0.5:0);
                const bc = -Math.hypot(b.dr-centerR, b.dc-centerC) + (board[b.dr][b.dc]?0.5:0);
                return bc - ac;
            });
            const pick = cand[0];
            const piece = board[pick.sr][pick.sc];
            move = { ...pick, piece };
            meta = { source: 'heurística' };
        }
    }
    if (!move) return;

    // Visuals
    try{
        const fromEl = getSquareElement(move.sr, move.sc);
        const toEl = getSquareElement(move.dr, move.dc);
        const bRect = boardElement.getBoundingClientRect();
        const fr = fromEl.getBoundingClientRect();
        const tr = toEl.getBoundingClientRect();
        const fx = fr.left - bRect.left + fr.width/2;
        const fy = fr.top - bRect.top + fr.height/2;
        const tx = tr.left - bRect.left + tr.width/2;
        const ty = tr.top - bRect.top + tr.height/2;
        const dx = tx - fx, dy = ty - fy;
        const len = Math.sqrt(dx*dx + dy*dy);
        const ang = Math.atan2(dy, dx) * 180/Math.PI;
        // clear any previous recommendation overlays
        boardElement.querySelectorAll('.rec-arrow, .rec-label').forEach(n=>n.remove());
        // arrow
        const arr = document.createElement('div');
        arr.className = 'coach-annot rec-arrow';
        arr.style.left = fx + 'px';
        arr.style.top = (fy - 2) + 'px';
        arr.style.width = Math.max(0, len - 18) + 'px';
        arr.style.transformOrigin = 'left center';
        arr.style.transform = `rotate(${ang}deg)`;
        boardElement.appendChild(arr);
        // pulse on destination
        toEl.classList.add('rec-pulse');
        setTimeout(()=>{ try{ toEl.classList.remove('rec-pulse'); }catch{} }, 1800);
        // label
        const label = document.createElement('div');
        label.className = 'rec-label';
        const offsetX = 10, offsetY = -40;
        label.style.left = (tx + offsetX) + 'px';
        label.style.top = (ty + offsetY) + 'px';
        const tag = meta.source === 'historial' ? (meta.wr!=null?`WR ${meta.wr}%`:'Historial') : (meta.source==='motor' ? 'Motor' : 'Sugerencia');
        label.textContent = `Sugerencia ${tag}`;
        boardElement.appendChild(label);
        setTimeout(()=>{ try{arr.remove(); label.remove();}catch{} }, 3500);
        // ghost move
        const ghost = document.createElement('div');
        ghost.className = 'anim-piece';
        ghost.classList.add(isWhite(move.piece) ? 'white-piece' : 'black-piece');
        ghost.style.opacity = '0.8';
        ghost.textContent = PIECES[move.piece];
        ghost.style.left = (fr.left - bRect.left) + 'px';
        ghost.style.top = (fr.top - bRect.top) + 'px';
        ghost.style.width = fr.width + 'px';
        ghost.style.height = fr.height + 'px';
        boardElement.appendChild(ghost);
        requestAnimationFrame(()=>{
            ghost.style.left = (tr.left - bRect.left) + 'px';
            ghost.style.top = (tr.top - bRect.top) + 'px';
        });
        ghost.addEventListener('transitionend', ()=>{ try{ ghost.remove(); }catch{} });
    }catch{}
}

function tryAutoShowRecommendation(){
    try{
        const auto = localStorage.getItem('auto_rec_anim') === 'true' || false;
        if (!auto) return;
        const humanToMove = (turn && playerIsWhite) || (!turn && !playerIsWhite);
        if (!humanToMove) return;
        // fire and forget
        showRecommendationAnimation();
    }catch{}
}
