/*
 * bot/db.js — 봇 스크립트용 DB 쿼리 헬퍼
 *
 * 기본은 pg(raw TCP 5432). NEON_HTTP=1 이면 @neondatabase/serverless 의
 * HTTPS(443) 쿼리로 전환한다 — 클라우드 샌드박스처럼 5432 egress 가
 * 막힌 환경에서 사용 (호스트 api.<region>.aws.neon.tech 허용 필요).
 *
 * 사용: const db = require('./db').createDb();
 *       await db.query(text, params) → { rows }
 *       await db.end()
 */
'use strict';
require('./env');

function createDb() {
  if (process.env.NEON_HTTP === '1') {
    const { neon } = require('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    return {
      driver: 'neon-http',
      query: async (text, params) => ({ rows: await sql.query(text, params || []) }),
      end: async () => {},
    };
  }
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  return {
    driver: 'pg',
    query: (text, params) => pool.query(text, params),
    end: () => pool.end(),
  };
}

module.exports = { createDb };
