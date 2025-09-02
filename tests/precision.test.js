const assert = require('assert');
const { sanToUciSequence, analyzeGamePrecision } = require('../src/precision.js');

(function testSanToUci(){
  const uci = sanToUciSequence(['e4','e5','Nf3','Nc6']);
  assert.deepStrictEqual(uci, ['e2e4','e7e5','g1f3','b8c6']);
})();

function stubEngine(cps){
  let idx = 0;
  return {
    onmessage: null,
    postMessage(cmd){
      if(cmd.startsWith('go')){
        const cp = cps[idx++] || 0;
        if(typeof this.onmessage === 'function'){
          this.onmessage({data:`info score cp ${cp}`});
          this.onmessage({data:'bestmove 0000'});
        }
      }
    }
  };
}

(async function testAnalyzer(){
  const pgn = '[Event "?"]\n\n1. e4 e5 2. Nf3 Nc6';
  const cps = [50,40,30,20,30,25,20,15];
  const engineFactory = () => stubEngine(cps);
  const res = await analyzeGamePrecision(pgn, {depth:1, engineFactory});
  assert(Math.abs(res.averageCentipawnLoss - 25) < 1e-9);
})();

(async function testCaching(){
  const pgn = '[Event "?"]\n\n1. e4 e5 2. Nf3 Nc6';
  let calls = 0;
  const engineFactory = () => { calls++; return stubEngine([0]); };
  global.localStorage = {
    store:{},
    getItem(k){ return this.store[k] || null; },
    setItem(k,v){ this.store[k]=v; }
  };
  await analyzeGamePrecision(pgn, {depth:1, engineFactory});
  await analyzeGamePrecision(pgn, {depth:1, engineFactory});
  assert.strictEqual(calls, 1);
})();

console.log('All precision tests passed.');
