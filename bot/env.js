/*
 * bot/env.js — .env 로더 (의존성 없이). DATABASE_URL이 이미 env에 있으면 그대로 둔다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set (.env or env var)');
  process.exit(1);
}
