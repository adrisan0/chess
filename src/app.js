const boardElement = document.getElementById('board');
let board = [];
let selected = null;
let viewMode = 1; // default view mode

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
            boardElement.appendChild(square);
        }
    }
    renderBoard();
}

function renderBoard() {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = getSquareElement(row, col);
            square.textContent = '';
            square.classList.remove('highlight','attack','danger','check');
            const piece = board[row][col];
            if (piece) square.textContent = PIECES[piece];
        }
    }
    if (viewMode === 3) highlightDanger();
    if (viewMode === 4) highlightChecks();
}

function getSquareElement(row, col) {
    return boardElement.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
}

function onSquareClick(e) {
    const row = parseInt(e.currentTarget.dataset.row);
    const col = parseInt(e.currentTarget.dataset.col);
    const piece = board[row][col];
    if (selected) {
        if (movePiece(selected.row, selected.col, row, col)) {
            selected = null;
            renderBoard();
        } else if (piece && isSameColor(piece, board[selected.row][selected.col])) {
            selected = { row, col };
            highlightMoves(row, col);
        } else {
            selected = null;
            renderBoard();
        }
    } else if (piece) {
        selected = { row, col };
        highlightMoves(row, col);
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
    const moves = generateMoves(row, col);
    for (const [r, c] of moves) {
        getSquareElement(r, c).classList.add('highlight');
    }
    if (viewMode === 2) highlightAttacks(row, col);
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
                        if (row === startRow && !board[row + dr/2][c]) moves.push([r,c]);
                    } else {
                        moves.push([r,c]);
                    }
                }
            } else {
                if (board[r][c] && !isSameColor(board[r][c], piece)) moves.push([r,c]);
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

function generateAttacks(row, col) {
    const moves = generateMoves(row, col);
    return moves.filter(([r,c]) => board[r][c] && !isSameColor(board[r][c], board[row][col]));
}

function inside(r,c) {
    return r >=0 && r<8 && c>=0 && c<8;
}

function movePiece(sr, sc, dr, dc) {
    const piece = board[sr][sc];
    const moves = generateMoves(sr, sc);
    if (!moves.some(m => m[0]===dr && m[1]===dc)) return false;
    board[dr][dc] = piece;
    board[sr][sc] = null;
    turn = !turn;
    renderBoard();
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

window.addEventListener('keydown', e => {
    const num = parseInt(e.key);
    if (!isNaN(num)) {
        viewMode = num;
        renderBoard();
    }
});

initBoard();
createBoard();
