(function(global){
    const PIECE_SCORES = {
        p: 1,
        n: 3,
        b: 3,
        r: 5,
        q: 9,
        k: 0
    };

    function pieceValue(piece){
        return PIECE_SCORES[piece.toLowerCase()] || 0;
    }

    /**
     * Evaluate a move on the given board using basic heuristics.
     * `helpers` must provide isWhite, isKingInCheck,
     * generateAttacks and allAttackedSquares functions.
     */
    function evaluateMove(board, helpers, sr, sc, dr, dc, enPassant){
        const piece = board[sr][sc];
        let score = Math.random() * 0.01;
        let capture = board[dr][dc];
        if (
            piece.toLowerCase() === 'p' &&
            enPassant &&
            enPassant[0] === dr &&
            enPassant[1] === dc &&
            dc !== sc &&
            !board[dr][dc]
        ){
            const capRow = helpers.isWhite(piece) ? dr + 1 : dr - 1;
            capture = board[capRow][dc];
        }
        if (capture) score += pieceValue(capture) * 10;

        const original = board[dr][dc];
        const prevEp = enPassant;

        board[dr][dc] = piece;
        board[sr][sc] = null;
        enPassant = null;
        if (piece.toLowerCase() === 'p' && Math.abs(dr - sr) === 2){
            enPassant = [(sr + dr) / 2, sc];
        }

        if (helpers.isKingInCheck && helpers.isKingInCheck(!helpers.isWhite(piece))) score += 5;

        if (helpers.generateAttacks){
            for (const [ar, ac] of helpers.generateAttacks(dr, dc)){
                const target = board[ar][ac];
                if (target && !helpers.isWhite(target) === helpers.isWhite(piece)){
                    score += pieceValue(target);
                }
            }
        }

        if (helpers.allAttackedSquares){
            const enemy = helpers.allAttackedSquares(!helpers.isWhite(piece)) || [];
            if (enemy.some(([er, ec]) => er === dr && ec === dc)){
                score -= pieceValue(piece) * 5;
            }
        }

        board[sr][sc] = piece;
        board[dr][dc] = original;
        enPassant = prevEp;

        return score;
    }

    const api = { pieceValue, evaluateMove };
    if (typeof module !== 'undefined' && module.exports){
        module.exports = api;
    } else {
        global.AICore = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
