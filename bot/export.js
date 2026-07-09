/*
 * bot/export.js — DB(원본) → site/js/questions.js(정적 폴백) 생성
 *
 * 배포 사이트는 /api/questions 로 DB에서 직접 읽으므로, 이 파일은
 * file:// 로 열 때의 폴백과 저장소 이력용이다. 루프가 문제를 추가/수정한 뒤
 * 실행해서 커밋해두면 정적 폴백도 최신으로 유지된다.
 *
 * 사용: node bot/export.js
 */
'use strict';
require('./env');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { validateAll } = require('./validate');

const OUT = path.join(__dirname, '..', 'site', 'js', 'questions.js');

function js(v) {
  // JS 소스 리터럴 (작은따옴표 문자열)
  if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  if (Array.isArray(v)) return '[' + v.map(js).join(', ') + ']';
  return JSON.stringify(v);
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const r = await pool.query(
    "SELECT id,type,difficulty,prompt,hand,draw,dora,melds,discards,choices,answer,explanation FROM questions WHERE status='active' ORDER BY id"
  );
  await pool.end();

  const qs = r.rows.map((row) => {
    const q = { id: row.id, type: row.type, difficulty: row.difficulty, prompt: row.prompt, hand: row.hand || '' };
    if (row.draw) q.draw = row.draw;
    if (row.dora) q.dora = row.dora;
    if (row.melds) q.melds = row.melds;
    if (row.discards) q.discards = row.discards;
    q.choices = row.choices; q.answer = row.answer; q.explanation = row.explanation;
    return q;
  });

  if (!validateAll(qs)) {
    console.error('검증 실패 — questions.js 를 생성하지 않음');
    process.exit(1);
  }

  const lines = [];
  lines.push('/*');
  lines.push(' * questions.js — 문제은행 (bot/export.js 가 DB에서 생성한 파일. 직접 수정 금지)');
  lines.push(' *');
  lines.push(' * 원본은 Neon DB의 questions 테이블이다. 배포 사이트는 /api/questions 로');
  lines.push(' * DB에서 직접 읽고, 이 파일은 file:// 폴백용. 스키마 상세는 SCHEMA.md 참조.');
  lines.push(' * 전역 노출: window.MahjongQuestions');
  lines.push(' */');
  lines.push('(function (global) {');
  lines.push("  'use strict';");
  lines.push('');
  lines.push('  var QUESTIONS = [');
  for (const q of qs) {
    lines.push('    {');
    lines.push(`      id: ${js(q.id)}, type: ${js(q.type)}, difficulty: ${q.difficulty},`);
    lines.push(`      prompt: ${js(q.prompt)},`);
    const handParts = [`hand: ${js(q.hand)}`];
    if (q.draw) handParts.push(`draw: ${js(q.draw)}`);
    if (q.dora) handParts.push(`dora: ${js(q.dora)}`);
    lines.push('      ' + handParts.join(', ') + ',');
    if (q.melds) lines.push(`      melds: ${js(q.melds)},`);
    if (q.discards) lines.push(`      discards: ${js(q.discards)},`);
    lines.push(`      choices: ${js(q.choices)}, answer: ${q.answer},`);
    lines.push(`      explanation: ${js(q.explanation)}`);
    lines.push('    },');
  }
  lines.push('  ];');
  lines.push('');
  lines.push('  global.MahjongQuestions = QUESTIONS;');
  lines.push('})(window);');
  lines.push('');

  fs.writeFileSync(OUT, lines.join('\n'), 'utf-8');
  console.log(`exported ${qs.length} questions -> ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
