// Chess.com integration (client-side, cached via localStorage)
// - Fetches monthly archives and builds per-ply move outcome stats for a user
// - Normalizes SAN to a simplified format to match in-game notation

(function(){
  const API = {
    archives: u => `https://api.chess.com/pub/player/${encodeURIComponent(u)}/games/archives`,
  };

  async function getJSON(url){
    const key = 'cc_cache_'+url;
    try{
      const v = localStorage.getItem(key);
      if(v){
        const o = JSON.parse(v);
        const ttl = url.includes('/games/') ? 1000*60*60*12 : 1000*60*60; // 12h for month, 1h otherwise
        if(Date.now() - o.t < ttl) return o.d;
      }
    }catch{}
    const res = await fetch(url, {headers:{'Accept':'application/json'}});
    if(!res.ok) throw new Error('HTTP '+res.status+' '+url);
    const data = await res.json();
    try{ localStorage.setItem(key, JSON.stringify({t:Date.now(), d:data})); }catch{}
    return data;
  }

  function stripCommentsAndTags(pgn){
    if(!pgn) return '';
    // Remove header tags
    const body = pgn.split('\n\n').slice(1).join('\n');
    // Remove comments {...} and ; line comments
    const noBraces = body.replace(/\{[\s\S]*?\}/g, ' ');
    const noSemis = noBraces.replace(/;.*$/gm, ' ');
    // Remove NAGs like $1
    const noNAG = noSemis.replace(/\$\d+/g, ' ');
    return noNAG.trim();
  }

  function extractMovesSAN(pgn){
    const txt = stripCommentsAndTags(pgn);
    if(!txt) return [];
    const tokens = txt.split(/\s+/);
    const moves = [];
    for(const tok of tokens){
      if(/^\d+\.\.\.$/.test(tok)) continue; // move number for black
      if(/^\d+\.$/.test(tok)) continue; // move number for white
      if(/^(1-0|0-1|1\/2-1\/2)$/.test(tok)) continue; // result
      moves.push(tok);
    }
    return moves;
  }

  function normalizeSAN(san){
    if(!san) return san;
    let s = san.trim();
    // Castling
    if(s === 'O-O' || s === 'O-O-O' || s === '0-0' || s === '0-0-0'){
      return s.replace(/0/g,'O');
    }
    // Strip annotations, check, mate, e.p., promotions
    s = s.replace(/[#\+!?]+/g,'');
    s = s.replace(/\s*e\.p\./i,'');
    s = s.replace(/=(Q|R|B|N)$/,'');
    // Pawn captures exd5 or quiet d4
    let m;
    if((m = s.match(/^([a-h])x([a-h][1-8])$/))){
      return m[1]+'x'+m[2];
    }
    if((m = s.match(/^[a-h][1-8]$/))){
      return s;
    }
    // Piece moves with optional disambiguation and capture
    if((m = s.match(/^([KQRBN])([a-h1-8]{0,2})(x?)([a-h][1-8])$/))){
      const piece = m[1];
      const cap = m[3];
      const dest = m[4];
      return piece + (cap==='x'?'x':'') + dest;
    }
    // Fallback: return cleaned
    return s;
  }

  function normalizeResult(result, meColor){
    if(!result) return 'd';
    const r = (''+result).toLowerCase();
    if(r==='win') return 'w';
    if(r==='agreed' || r==='repetition' || r==='stalemate' || r==='timevsinsufficient' || r==='insufficient' || r==='50move') return 'd';
    if(r==='checkmated' || r==='timeout' || r==='resigned' || r==='abandoned' || r==='lose') return 'l';
    if(r==='1-0' || r==='0-1' || r==='1/2-1/2'){
      if(r==='1/2-1/2') return 'd';
      return (r==='1-0' && meColor==='white') || (r==='0-1' && meColor==='black') ? 'w':'l';
    }
    return 'd';
  }

  /**
   * Load per-move statistics for a Chess.com user.
   * Results are persisted in localStorage for up to five hours to
   * limit API usage. Pass `force: true` to bypass the cache.
   */
  async function loadUserMoveStats(username, {months='all', ngramN=2, force=false}={}){
    const u = username.trim();
    if(!u) throw new Error('Usuario vacío');
    const cacheKey = `cc_move_stats_${u.toLowerCase()}_${months}`;
    try{
      const cached = localStorage.getItem(cacheKey);
      if(cached){
        const obj = JSON.parse(cached);
        const ttl = 1000*60*60*5; // 5h
        if(!force && obj && (Date.now() - obj.t < ttl)) return obj.d;
      }
    }catch{}

    const archList = await getJSON(API.archives(u));
    const all = (archList.archives||[]);
    const archives = (months === 'all' || months === 0 || months == null)
      ? all
      : all.slice(-Number(months));
    const byPly = {}; // { ply: { san: {count,w,d,l} } }
    const after = {}; // { ply: { san: { oppSan: {count,w} } } }
    const ngrams = { N: Math.max(1, Math.min(3, ngramN|0 || 2)), map: {} }; // context -> {san:count}

    const samples = []; // for simple benchmark
    for(const url of archives){
      let month;
      try{ month = await getJSON(url); }catch{ continue; }
      for(const g of (month.games||[])){
        const white = g.white?.username?.toLowerCase?.();
        const black = g.black?.username?.toLowerCase?.();
        const want = u.toLowerCase();
        const meColor = white===want? 'white' : black===want? 'black' : null;
        if(!meColor) continue;
        const result = normalizeResult(g[meColor]?.result || g.result, meColor);
        const moves = extractMovesSAN(g.pgn||'');
        const norms = moves.map(normalizeSAN);
        if(globalThis.GamePrecision && typeof globalThis.GamePrecision.analyzeGamePrecision === 'function'){
          try{
            const res = await globalThis.GamePrecision.analyzeGamePrecision(g.pgn||'');
            g.precision = meColor==='white' ? res.white : res.black;
            g.oppPrecision = meColor==='white' ? res.black : res.white;
          }catch{}
        }
        for(let i=0;i<moves.length;i++){
          const ply = i+1; // 1-based
          const side = (ply % 2 === 1) ? 'white' : 'black';
          if(side !== meColor) continue;
          const san = norms[i];
          if(!byPly[ply]) byPly[ply] = {};
          if(!byPly[ply][san]) byPly[ply][san] = {count:0,w:0,d:0,l:0};
          const entry = byPly[ply][san];
          entry.count++;
          entry[result]++;

          // Track opponent immediate reply performance for this move
          try{
            const reply = norms[i+1]; // opponent's move after ours
            if(reply){
              if(!after[ply]) after[ply] = {};
              if(!after[ply][san]) after[ply][san] = {};
              if(!after[ply][san][reply]) after[ply][san][reply] = {count:0,w:0};
              const a = after[ply][san][reply]; a.count++; if(result==='w') a.w++;
            }
          }catch{}

          // n-gram context across full move stream, side-aware key
          const N = ngrams.N;
          const start = Math.max(0, i - N);
          const ctxArr = norms.slice(start, i);
          const sideTag = (meColor==='white') ? 'W' : 'B';
          const ctxKey = sideTag + '|' + ctxArr.join('|');
          if(!ngrams.map[ctxKey]) ngrams.map[ctxKey] = {};
          ngrams.map[ctxKey][san] = (ngrams.map[ctxKey][san]||0) + 1;

          // record sample for benchmark
          samples.push({san, ply, ctxKey});
        }
      }
    }

    // Compute rates
    const stats = { byPly: {}, ngrams, username: u, months: archives.length };
    for(const k of Object.keys(byPly)){
      const ply = parseInt(k,10);
      stats.byPly[ply] = {};
      for(const san of Object.keys(byPly[k])){
        const e = byPly[k][san];
        const c = Math.max(1, e.count);
        stats.byPly[ply][san] = {
          count: e.count,
          winRate: e.w / c,
          drawRate: e.d / c,
          lossRate: e.l / c,
        };
      }
    }
    // Simple benchmark: perplexity vs uniform on same supports
    try {
      let total = 0, nll = 0, nllUni = 0, ctxHit = 0, plyHit = 0;
      const take = samples.length > 2000 ? 2000 : samples.length;
      for(let i=0;i<take;i++){
        const s = samples[i];
        const ctx = ngrams.map[s.ctxKey];
        let p = 0, k = 0;
        if(ctx){
          const sum = Object.values(ctx).reduce((a,b)=>a+b,0);
          p = (ctx[s.san]||0) / (sum||1);
          k = Object.keys(ctx).length || 1;
          ctxHit++;
        }
        if(p<=0){
          const by = byPly[s.ply] || null;
          if(by){
            const sum = Object.values(by).reduce((acc,v)=>acc+(v?.count||0),0);
            p = (by[s.san]?.count||0) / (sum||1);
            k = Object.keys(by).length || 1;
            plyHit++;
          }
        }
        if(p<=0){ p = 1e-6; k = k||30; }
        nll += -Math.log(p);
        nllUni += -Math.log(1/Math.max(1,k));
        total++;
      }
      const ppl = total? Math.exp(nll/total) : null;
      const baselinePpl = total? Math.exp(nllUni/total) : null;
      const quality = (!ppl||!baselinePpl) ? 'unknown'
        : (total>=300 && ppl < 0.8*baselinePpl) ? 'good'
        : (total>=150 && ppl < baselinePpl) ? 'ok' : 'poor';
      stats.benchmark = {
        samples: total,
        ppl,
        baselinePpl,
        ctxCoverage: total? ctxHit/total: 0,
        plyCoverage: total? plyHit/total: 0,
        quality
      };
    } catch {}

    // attach after map at the end to keep payload compact
    try{ stats.after = after; }catch{}
    try{ localStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), d: stats })); }catch{}
    return stats;
  }

  function getPenaltyFor(stats, ply, san){
    if(!stats || !stats.byPly) return null;
    const entry = stats.byPly[ply]?.[san];
    if(!entry) return null;
    return entry.lossRate; // percentage of times that move led to loss
  }

  window.ChessCom = {
    normalizeSAN,
    loadUserMoveStats,
    getPenaltyFor,
  };
})();
