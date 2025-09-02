// Minimal proxy server for DeepSeek API
// Loads API base and key from .env to keep secrets off the client
// Usage:
//  1) cp server/.env.example server/.env && edit values
//  2) cd server && npm install && npm start
//  3) In the web app, set API base to /api/deepseek and leave API key blank

const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

const API_BASE = (process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com').replace(/\/$/, '');
const API_KEY = process.env.DEEPSEEK_API_KEY || '';

if (!API_KEY) {
  console.warn('[WARN] DEEPSEEK_API_KEY is empty. Set it in server/.env');
}

async function forward(path, reqBody, res) {
  try {
    const url = `${API_BASE}${path}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(reqBody),
    });
    const data = await r.text();
    res.status(r.status).type('application/json').send(data);
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'upstream_error', detail: String(e?.message || e) });
  }
}

// Proxy endpoints
app.post('/api/deepseek/chat/completions', async (req, res) => {
  const body = req.body || {};
  await forward('/chat/completions', body, res);
});

// In-memory log sessions (reset on server restart)
const logSessions = new Map();

function getOrCreateSession(id) {
  const now = Date.now();
  let s = logSessions.get(id);
  if (!s) {
    s = {
      id,
      createdAt: now,
      updatedAt: now,
      logs: [], // {t, level, msg}
      progress: 0,
      done: false,
      lastSummaryAt: 0,
      lastSummary: null,
      lastLevel: 'info',
      lastThreshold: 0,
    };
    logSessions.set(id, s);
  }
  return s;
}

function progressBar(pct) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const total = 20;
  const filled = Math.round((p / 100) * total);
  return `[${'#'.repeat(filled)}${'-'.repeat(total - filled)}] ${p}%`;
}

function shouldSummarize(s, incomingLevel) {
  const now = Date.now();
  const throttled = now - s.lastSummaryAt < 30000; // 30s min entre resúmenes

  // Nunca resumir aún si está muy temprano salvo error
  if (s.progress < 5 && incomingLevel !== 'error') return false;

  // Dispara en errores inmediatamente si no está throttled
  if (incomingLevel === 'error' && !throttled) return true;

  // Dispara cuando cruza umbrales 25/50/75/100
  const thresholds = [25, 50, 75, 100];
  const crossed = thresholds.find(t => s.progress >= t && s.lastThreshold < t);
  if (crossed && !throttled) {
    s.lastThreshold = crossed;
    return true;
  }
  // Dispara cuando done
  if (s.done && !throttled) return true;
  return false;
}

async function summarizeSession(s, level) {
  const recent = s.logs.slice(-100); // limitar contexto
  const ctxText = recent.map(x => `${new Date(x.t).toISOString()} [${x.level.toUpperCase()}] ${x.msg}`).join('\n');

  const status = s.done ? 'finalizado' : 'en progreso';
  const pbar = progressBar(s.progress);
  const system = level === 'error'
    ? 'Eres un analista DevOps. Resume en 2-3 frases QUÉ falló y por qué, con acción inmediata.'
    : level === 'warning'
      ? 'Eres un analista. Resume en 2-3 frases riesgos/posibles problemas y acciones preventivas.'
      : 'Eres un analista. Resume en 1-2 frases el estado y próximos pasos.';

  const user = `Estado: ${status} | Progreso: ${s.progress}% ${pbar}\n`+
    `Nivel: ${level}\n`+
    `Contexto (reciente):\n${ctxText}\n`+
    `${s.done ? 'Si terminó, indica si fue exitoso y siguientes pasos.' : 'Si sigue, indica indicador de salud y foco.'}`;

  try {
    const r = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.2,
        stream: false
      })
    });
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content || '';
    s.lastSummaryAt = Date.now();
    s.lastSummary = { text, level, at: s.lastSummaryAt };
    s.lastLevel = level;
    return s.lastSummary;
  } catch (e) {
    return { text: '', level, at: Date.now(), error: String(e?.message || e) };
  }
}

// Receive logs and optionally summarize
app.post('/api/logs', async (req, res) => {
  try {
    const { sessionId, level = 'info', message = '', progress, done, phase } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'missing_sessionId' });
    const s = getOrCreateSession(sessionId);
    s.updatedAt = Date.now();
    if (typeof progress === 'number' && !Number.isNaN(progress)) s.progress = Math.max(0, Math.min(100, progress));
    if (typeof done === 'boolean') s.done = done;
    if (message) s.logs.push({ t: Date.now(), level, msg: phase ? `[${phase}] ${message}` : message });

    let summary = null;
    if (shouldSummarize(s, level)) {
      summary = await summarizeSession(s, level);
    }
    res.json({ ok: true, summarized: !!summary, summary });
  } catch (e) {
    res.status(500).json({ error: 'log_intake_failed', detail: String(e?.message || e) });
  }
});

// Fetch last summary for a session
app.get('/api/logs/:sessionId/summary', (req, res) => {
  const s = logSessions.get(req.params.sessionId);
  if (!s) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true, summary: s.lastSummary, progress: s.progress, done: s.done });
});

// Expose Stockfish (WASM) at a stable path for the frontend
// We map /vendor/stockfish/* to the installed package files and
// also provide /vendor/stockfish/stockfish.js as a stable entry.
const fs = require('fs');
const STOCKFISH_DIR = path.resolve(__dirname, 'node_modules', 'stockfish', 'src');

// Static serve for all stockfish assets (js/wasm)
if (fs.existsSync(STOCKFISH_DIR)) {
  app.use('/vendor/stockfish', express.static(STOCKFISH_DIR, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm');
      }
    }
  }));

  // Stable entry: choose a JS build to serve as stockfish.js
  app.get('/vendor/stockfish/stockfish.js', (req, res) => {
    try {
      // Prefer single-file wasm builds for simpler loading
      const files = fs.readdirSync(STOCKFISH_DIR);
      const pick =
        files.find(f => /stockfish-.*-lite-single-.*\.js$/.test(f)) ||
        files.find(f => /stockfish-.*-single-.*\.js$/.test(f)) ||
        files.find(f => /stockfish-.*\.js$/.test(f));
      if (!pick) return res.status(404).send('stockfish build not found');
      return res.sendFile(path.join(STOCKFISH_DIR, pick));
    } catch (e) {
      return res.status(500).send('stockfish route error');
    }
  });
}

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Serve static files for the frontend (project root) with proper WASM mime
app.use(express.static(path.resolve(__dirname, '..'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    }
  }
}));

// Fallback: send index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.resolve(__dirname, '..', 'index.html'));
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
