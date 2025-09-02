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
require('dotenv').config();

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
