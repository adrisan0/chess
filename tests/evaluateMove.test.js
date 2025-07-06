const assert = require('assert');
const { evaluateMove, pieceValue } = require('../src/ai-core.js');

function emptyBoard() {
    return Array.from({ length: 8 }, () => Array(8).fill(null));
}

function basicHelpers(extra) {
    return Object.assign({
        isWhite: p => p === p.toUpperCase(),
        isKingInCheck: () => false,
        generateAttacks: () => [],
        allAttackedSquares: () => []
    }, extra);
}

// disable randomness for reproducible tests
Math.random = () => 0;

(function testPieceValues() {
    assert.strictEqual(pieceValue('p'), 1);
    assert.strictEqual(pieceValue('Q'), 9);
    assert.strictEqual(pieceValue('k'), 0);
})();

(function testCaptureBonus() {
    const board = emptyBoard();
    board[4][4] = 'Q';
    board[4][5] = 'r';
    const scoreCapture = evaluateMove(board, basicHelpers(), 4, 4, 4, 5, null);
    board[4][5] = null;
    const scoreQuiet = evaluateMove(board, basicHelpers(), 4, 4, 4, 5, null);
    assert(scoreCapture > scoreQuiet, 'capture should score higher');
})();

(function testUnsafeSquarePenalty() {
    const board = emptyBoard();
    board[4][4] = 'Q';
    const helpers = basicHelpers({
        allAttackedSquares: () => [[5,4]]
    });
    const score = evaluateMove(board, helpers, 4, 4, 5, 4, null);
    assert(score < 0, 'moving into attack should be penalised');
})();

console.log('All tests passed.');
