(function(global){
  function stripCommentsAndTags(pgn){
    if(!pgn) return '';
    const body = pgn.split('\n\n').slice(1).join('\n');
    const noBraces = body.replace(/\{[\s\S]*?\}/g, ' ');
    const noSemis = noBraces.replace(/;.*$/gm, ' ');
    const noNAG = noSemis.replace(/\$\d+/g, ' ');
    return noNAG.trim();
  }

  function extractMovesSAN(pgn){
    const txt = stripCommentsAndTags(pgn);
    if(!txt) return [];
    const tokens = txt.split(/\s+/);
    const moves = [];
    for(const tok of tokens){
      if(/^\d+\.\.\.$/.test(tok)) continue;
      if(/^\d+\.$/.test(tok)) continue;
      if(/^(1-0|0-1|1\/2-1\/2)$/.test(tok)) continue;
      moves.push(tok);
    }
    return moves;
  }

  function normalizeSAN(san){
    if(!san) return san;
    let s = san.trim();
    if(s === 'O-O' || s === 'O-O-O' || s === '0-0' || s === '0-0-0'){
      return s.replace(/0/g,'O');
    }
    s = s.replace(/[#+!?]+/g,'');
    s = s.replace(/\s*e\.p\./i,'');
    s = s.replace(/=(Q|R|B|N)$/,'=$1');
    return s;
  }

  function initialBoard(){
    const r1 = ['r','n','b','q','k','b','n','r'];
    const r2 = Array(8).fill('p');
    const r7 = Array(8).fill('P');
    const r8 = ['R','N','B','Q','K','B','N','R'];
    const empty = Array(8).fill(null);
    return [r1.slice(), r2.slice(), empty.slice(), empty.slice(), empty.slice(), empty.slice(), r7.slice(), r8.slice()];
  }
  function isWhite(p){ return p && p === p.toUpperCase(); }
  function inside(r,c){ return r>=0 && r<8 && c>=0 && c<8; }
  function algebraicToRC(sq){ const file = sq.charCodeAt(0)-97; const rank = 8-parseInt(sq[1],10); return {r:rank, c:file}; }
  function rcToAlgebraic(r,c){ return String.fromCharCode(97+c)+(8-r); }

  function canReach(src, dst, p, b, isCapture, ep){
    const dr = dst.r - src.r, dc = dst.c - src.c; const adx=Math.abs(dr), ady=Math.abs(dc);
    const up = isWhite(p);
    const lower = p.toLowerCase();
    if(lower==='p'){
      if(dc===0 && !isCapture){
        if(dr=== (up? -1:1) && !b[dst.r][dst.c]) return true;
        if(dr=== (up? -2:2) && ((up && src.r===6) || (!up && src.r===1)) && !b[src.r + (up?-1:1)][src.c] && !b[dst.r][dst.c]) return true;
      } else if(Math.abs(dc)===1 && dr===(up?-1:1)){
        if(b[dst.r][dst.c] && isWhite(b[dst.r][dst.c])!==up) return true;
        if(ep && dst.r===ep.r && dst.c===ep.c) return true;
      }
      return false;
    } else if(lower==='n'){
      if(!((adx===2 && ady===1) || (adx===1 && ady===2))) return false;
      return !b[dst.r][dst.c] || isWhite(b[dst.r][dst.c])!==up;
    } else if(lower==='k'){
      if(Math.max(adx,ady)!==1) return false;
      return !b[dst.r][dst.c] || isWhite(b[dst.r][dst.c])!==up;
    } else if(lower==='b' || lower==='r' || lower==='q'){
      const dirs=[]; if(lower!=='b'){ dirs.push([1,0],[-1,0],[0,1],[0,-1]); } if(lower!=='r'){ dirs.push([1,1],[1,-1],[-1,1],[-1,-1]); }
      for(const [vx,vy] of dirs){ let r=src.r+vx, c=src.c+vy; while(r>=0&&r<8&&c>=0&&c<8){ if(r===dst.r&&c===dst.c){ return !b[r][c] || isWhite(b[r][c])!==up; } if(b[r][c]) break; r+=vx; c+=vy; }
      } return false;
    }
    return false;
  }

  function sanToUciSequence(moves){
    const b = initialBoard();
    let white = true; let ep=null; const uci=[];
    for(const raw of moves){
      const san = normalizeSAN(raw);
      if(!san) continue;
      if(san==='O-O' || san==='0-0'){
        const r = white?7:0; const from=rcToAlgebraic(r,4); const to=rcToAlgebraic(r,6);
        uci.push(from+to);
        b[r][6] = white?'K':'k'; b[r][4]=null; b[r][5]=white?'R':'r'; b[r][7]=null; white=!white; ep=null; continue;
      }
      if(san==='O-O-O' || san==='0-0-0'){
        const r = white?7:0; const from=rcToAlgebraic(r,4); const to=rcToAlgebraic(r,2);
        uci.push(from+to);
        b[r][2] = white?'K':'k'; b[r][4]=null; b[r][3]=white?'R':'r'; b[r][0]=null; white=!white; ep=null; continue;
      }
      const isCapture = san.includes('x');
      const promo = (san.match(/=([QRBN])/)||[])[1]||null;
      const target = san.slice(-2);
      const dest = algebraicToRC(target);
      let piece = 'P';
      if(/^[KQRBN]/.test(san)) piece = san[0];
      const movers = [];
      for(let r=0;r<8;r++){
        for(let c=0;c<8;c++){
          const p = b[r][c]; if(!p) continue; if(isWhite(p)!==white) continue;
          const up = p.toUpperCase(); if((piece==='P' && up!=='P') || (piece!=='P' && up!==piece)) continue;
          if(canReach({r,c}, dest, p, b, isCapture, ep)) movers.push({r,c});
        }
      }
      let from = null;
      const dis = san.replace(/[x=].*$/,'').replace(/[KQRBN]*/,'').slice(0, san.length-2 - (promo?2:0));
      if(dis){
        const file = dis.match(/[a-h]/)?.[0]||null;
        const rank = dis.match(/[1-8]/)?.[0]||null;
        from = movers.find(sq => (!file || 'abcdefgh'[sq.c]===file) && (!rank || (8-sq.r)==rank));
      }
      if(!from) from = movers[0];
      if(!from){ white=!white; continue; }
      const pieceChar = b[from.r][from.c];
      if(piece==='P' && isCapture && b[dest.r][dest.c]==null && ep && dest.r===ep.r && dest.c===ep.c){
        const capR = white? dest.r+1 : dest.r-1; b[capR][dest.c]=null;
      }
      b[dest.r][dest.c] = promo ? (white?promo:promo.toLowerCase()) : pieceChar;
      b[from.r][from.c] = null;
      ep = null;
      if(piece==='P' && Math.abs(from.r - dest.r)===2){ ep = {r:(from.r+dest.r)/2, c:from.c}; }
      const moveStr = rcToAlgebraic(from.r,from.c)+rcToAlgebraic(dest.r,dest.c)+(promo?promo.toLowerCase():'');
      uci.push(moveStr);
      white = !white;
    }
    return uci;
  }

  async function initEngine(engine){
    return new Promise(resolve => {
      const prev = engine.onmessage;
      engine.onmessage = e => {
        const line = String(e.data||e);
        if(line.startsWith('uciok') || line.startsWith('readyok')){
          engine.onmessage = prev; resolve();
        }
      };
      engine.postMessage('uci');
      engine.postMessage('isready');
    });
  }

  async function evalPosition(engine, moves, depth){
    return new Promise(resolve => {
      let score = 0;
      const prev = engine.onmessage;
      engine.onmessage = e => {
        const line = String(e.data||e);
        const m = line.match(/score cp (-?\d+)/);
        if(m) score = parseInt(m[1],10);
        if(line.startsWith('bestmove')){
          engine.onmessage = prev;
          resolve(score);
        }
      };
      const cmd = moves.length ? `position startpos moves ${moves.join(' ')}` : 'position startpos';
      engine.postMessage(cmd);
      engine.postMessage(`go depth ${depth}`);
    });
  }

  function tryCreateEngine(){
    if(typeof window !== 'undefined'){
      if(typeof window.STOCKFISH === 'function'){ try { return window.STOCKFISH(); } catch {}
      }
      try { return new Worker('/vendor/stockfish/stockfish.js'); } catch {}
      try { return new Worker('src/stockfish.js'); } catch {}
    }
    return null;
  }

  async function analyzeGamePrecision(pgn, {depth=12, engineFactory}={}){
    const movesSan = extractMovesSAN(pgn).map(normalizeSAN);
    const movesUci = sanToUciSequence(movesSan);
    const factory = engineFactory || tryCreateEngine;
    const engine = factory ? factory() : null;
    if(!engine) throw new Error('Stockfish engine not available');
    await initEngine(engine);
    let lossSum = 0; let count = 0;
    for(let i=0;i<movesUci.length;i++){
      const prefix = movesUci.slice(0,i);
      const best = await evalPosition(engine, prefix, depth);
      const actualOpp = await evalPosition(engine, prefix.concat(movesUci[i]), depth);
      const actual = (i%2===0) ? actualOpp : -actualOpp;
      const loss = Math.max(0, best - actual);
      lossSum += loss; count++;
    }
    if(engine.terminate) try{engine.terminate();}catch{}
    return { averageCentipawnLoss: count? lossSum/count : null };
  }

  const api = { analyzeGamePrecision, sanToUciSequence };
  if(typeof module !== 'undefined' && module.exports){ module.exports = api; }
  else { global.GamePrecision = api; }
})(typeof window!=='undefined'?window:globalThis);
