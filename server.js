/*
 * server.js — 정적 사이트 서빙 + 이의 제기 API (Render 배포용)
 *
 * 엔드포인트:
 *   GET  /health            → { ok, db } (DB ping 포함; Render 헬스체크용)
 *   POST /api/report        → { questionId, content } 를 reports 테이블에 INSERT
 *   GET  /api/reports       → ?status=pending 목록 (관측용, 최근 100건)
 *   그 외 GET               → site/ 정적 파일
 *
 * 환경변수: DATABASE_URL (Neon), PORT (Render가 주입)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const PORT = process.env.PORT || 8080;
const SITE_DIR = path.join(__dirname, 'site');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

async function handleHealth(res) {
  try {
    await pool.query('SELECT 1');
    sendJson(res, 200, { ok: true, db: 'up' });
  } catch (e) {
    sendJson(res, 503, { ok: false, db: 'down' });
  }
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

async function handleReport(req, res) {
  let data;
  try {
    data = JSON.parse(await readBody(req, 16 * 1024));
  } catch (e) {
    return sendJson(res, 400, { error: 'invalid JSON' });
  }
  const qid = typeof data.questionId === 'string' ? data.questionId.trim() : '';
  const content = typeof data.content === 'string' ? data.content.trim() : '';
  if (!/^[a-z]\d{3,4}$/.test(qid)) return sendJson(res, 400, { error: 'bad questionId' });
  if (content.length < 5 || content.length > 2000) {
    return sendJson(res, 400, { error: 'content must be 5~2000 chars' });
  }
  try {
    const r = await pool.query(
      'INSERT INTO reports (question_id, content) VALUES ($1, $2) RETURNING id',
      [qid, content]
    );
    sendJson(res, 201, { id: r.rows[0].id });
  } catch (e) {
    if (e.code === '23503') return sendJson(res, 400, { error: 'unknown questionId' }); // FK 위반
    console.error('report insert failed:', e.message);
    sendJson(res, 500, { error: 'db error' });
  }
}

async function handleReportList(res, urlObj) {
  const status = urlObj.searchParams.get('status') || 'pending';
  if (!['pending', 'accepted', 'rejected'].includes(status)) {
    return sendJson(res, 400, { error: 'bad status' });
  }
  try {
    const r = await pool.query(
      'SELECT id, question_id, content, status, resolution, created_at, resolved_at FROM reports WHERE status = $1 ORDER BY id DESC LIMIT 100',
      [status]
    );
    sendJson(res, 200, r.rows);
  } catch (e) {
    sendJson(res, 500, { error: 'db error' });
  }
}

function serveStatic(res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.normalize(path.join(SITE_DIR, rel));
  if (!filePath.startsWith(SITE_DIR)) { // 경로 탈출 차단
    res.writeHead(403); res.end('forbidden'); return;
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, 'http://localhost');
  const p = urlObj.pathname;
  try {
    if (p === '/health' || p === '/api/health') return await handleHealth(res);
    if (p === '/api/report' && req.method === 'POST') return await handleReport(req, res);
    if (p === '/api/reports' && req.method === 'GET') return await handleReportList(res, urlObj);
    if (req.method === 'GET') return serveStatic(res, p);
    res.writeHead(405); res.end();
  } catch (e) {
    console.error('unhandled:', e);
    sendJson(res, 500, { error: 'internal' });
  }
});

server.listen(PORT, () => console.log(`mahjong-quiz server on :${PORT}`));
