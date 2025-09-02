// Shim worker that loads Stockfish from local npm paths.
// Served statically by the Node proxy. We try a few common paths.
(function(){
  function loadWithBase(base, file){
    try{
      // Hint Emscripten where to load .wasm parts from
      self.Module = self.Module || {};
      self.Module.locateFile = function(path){ return base + '/' + path; };
      importScripts(base + '/' + file);
      return true;
    }catch(e){ return false; }
  }
  // Try server-local installs first (prefer the proxy-exposed vendor path)
  var tried =
    // 1) asm.js (sin WASM) por compatibilidad amplia
    loadWithBase('/vendor/stockfish', 'stockfish-17.1-asm-341ff22.js') ||
    // 2) Ligero y single-file (rápido si WASM sirve bien)
    loadWithBase('/vendor/stockfish', 'stockfish-17.1-lite-single-03e3232.js') ||
    // 3) Single estándar
    loadWithBase('/vendor/stockfish', 'stockfish-17.1-single-a496a04.js') ||
    // 4) Lite no-single
    loadWithBase('/vendor/stockfish', 'stockfish-17.1-lite-51f59da.js') ||
    // 5) Build multiparte
    loadWithBase('/vendor/stockfish', 'stockfish-17.1-8e4d048.js') ||
    // 6) Paths de desarrollo locales
    loadWithBase('/server/node_modules/stockfish/src', 'stockfish-17.1-asm-341ff22.js') ||
    loadWithBase('/server/node_modules/stockfish/src', 'stockfish-17.1-lite-single-03e3232.js') ||
    loadWithBase('/server/node_modules/stockfish/src', 'stockfish-17.1-single-a496a04.js') ||
    loadWithBase('/server/node_modules/stockfish/src', 'stockfish-17.1-lite-51f59da.js') ||
    loadWithBase('/server/node_modules/stockfish/src', 'stockfish-17.1-8e4d048.js') ||
    // 7) genérico
    loadWithBase('/node_modules/stockfish/src', 'stockfish.js');
  if (!tried){
    // Prefer ASM build on CDN to avoid WASM issues/CORS
    try{ importScripts('https://cdn.jsdelivr.net/npm/stockfish@17.1.0/src/stockfish-17.1-asm-341ff22.js'); }
    catch(e){ try{ importScripts('https://cdn.jsdelivr.net/npm/stockfish@latest/src/stockfish.js'); }catch(_){} }
  }
})();
