/*
 * bot/validate.js — 문제 기계 검증기
 *
 * 사용:
 *   node bot/validate.js                 # DB의 active 문제 전수 검증
 *   node bot/validate.js file.json      # JSON 파일(배열 또는 단일 객체) 검증
 *
 * 검증 규칙 (SCHEMA.md 기준):
 *   - id: 유형 접두어(d/y/s/r) + 3~4자리 숫자, 유형과 접두어 일치
 *   - type/difficulty/prompt/choices(4개)/answer(0~3)/explanation 필수·범위
 *   - hand 표기 문법 (m/p/s: 0~9, z: 1~7만)
 *   - 같은 패 5장 이상 금지 (hand + melds 합산, 적도라 0=5 동일 취급)
 *   - discard: hand 14장(melds 1세트당 -3), draw는 hand에 존재, choices 전부 패 표기,
 *              choices[answer]가 hand에 존재
 *   - draw는 discard 외 유형에 금지
 * 종료 코드: 0 = 전부 통과, 1 = 실패 있음
 */
'use strict';

const TYPE_PREFIX = { discard: 'd', yaku: 'y', score: 's', rule: 'r' };

// "123m06p789s11z" → [{suit,num,red}] / 문법 오류 시 throw
function parseNotation(str) {
  if (typeof str !== 'string') throw new Error('notation must be string');
  if (str === '') return [];
  const tiles = [];
  const re = /(\d+)([mpsz])/g;
  let m, consumed = 0;
  while ((m = re.exec(str)) !== null) {
    consumed += m[0].length;
    for (const ch of m[1]) {
      const n = Number(ch);
      if (m[2] === 'z') {
        if (n < 1 || n > 7) throw new Error(`invalid honor ${ch}z in "${str}"`);
        tiles.push({ suit: 'z', num: n, red: false });
      } else {
        tiles.push({ suit: m[2], num: n === 0 ? 5 : n, red: n === 0 });
      }
    }
  }
  if (consumed !== str.length) throw new Error(`bad notation "${str}"`);
  return tiles;
}

function tileKey(t) { return t.num + t.suit; }

function isTileNotation(str) {
  try {
    const ts = parseNotation(str);
    return ts.length > 0;
  } catch (e) { return false; }
}

function validateQuestion(q) {
  const errs = [];
  const err = (s) => errs.push(s);

  if (!q || typeof q !== 'object') return ['not an object'];
  if (!TYPE_PREFIX[q.type]) err(`bad type "${q.type}"`);
  if (typeof q.id !== 'string' || !/^[a-z]\d{3,4}$/.test(q.id)) err(`bad id "${q.id}"`);
  else if (TYPE_PREFIX[q.type] && q.id[0] !== TYPE_PREFIX[q.type]) {
    err(`id prefix "${q.id[0]}" != type prefix "${TYPE_PREFIX[q.type]}"`);
  }
  if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 5) err(`bad difficulty ${q.difficulty}`);
  if (typeof q.prompt !== 'string' || q.prompt.trim().length < 5) err('prompt too short');
  if (typeof q.explanation !== 'string' || q.explanation.trim().length < 10) err('explanation too short');
  if (!Array.isArray(q.choices) || q.choices.length !== 4 || !q.choices.every((c) => typeof c === 'string' && c.trim())) {
    err('choices must be 4 non-empty strings');
  }
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) err(`bad answer ${q.answer}`);

  // hand / melds 파싱
  let hand = [];
  try { hand = parseNotation(q.hand || ''); } catch (e) { err('hand: ' + e.message); }
  let meldTiles = [];
  if (q.melds != null) {
    if (!Array.isArray(q.melds)) err('melds must be array');
    else for (const meld of q.melds) {
      if (typeof meld !== 'string' || !/^[pck]/.test(meld)) { err(`bad meld "${meld}"`); continue; }
      try { meldTiles = meldTiles.concat(parseNotation(meld.slice(1))); }
      catch (e) { err('meld: ' + e.message); }
    }
  }

  // 같은 패 5장 금지
  const counts = {};
  for (const t of hand.concat(meldTiles)) {
    counts[tileKey(t)] = (counts[tileKey(t)] || 0) + 1;
    if (counts[tileKey(t)] > 4) err(`more than 4 of ${tileKey(t)}`);
  }

  if (q.type === 'discard') {
    const meldSets = Array.isArray(q.melds) ? q.melds.length : 0;
    const expect = 14 - meldSets * 3;
    if (hand.length !== expect) err(`discard hand must be ${expect} tiles (got ${hand.length})`);
    if (!q.draw) err('discard needs draw');
    if (Array.isArray(q.choices)) {
      for (const c of q.choices) if (!isTileNotation(c)) err(`discard choice "${c}" is not tile notation`);
    }
    const inHand = (notation) => {
      try {
        const t = parseNotation(notation)[0];
        return hand.some((h) => tileKey(h) === tileKey(t));
      } catch (e) { return false; }
    };
    if (q.draw && !inHand(q.draw)) err(`draw "${q.draw}" not in hand`);
    if (Array.isArray(q.choices) && Number.isInteger(q.answer) && q.choices[q.answer] && !inHand(q.choices[q.answer])) {
      err(`answer tile "${q.choices[q.answer]}" not in hand`);
    }
  } else if (q.draw) {
    err('draw is only for discard type');
  }

  return errs;
}

function validateAll(list) {
  let failed = 0;
  const ids = new Set();
  for (const q of list) {
    const errs = validateQuestion(q);
    if (q && q.id) {
      if (ids.has(q.id)) errs.push('duplicate id');
      ids.add(q.id);
    }
    if (errs.length) {
      failed++;
      console.log(`FAIL ${q && q.id}: ${errs.join(' | ')}`);
    }
  }
  console.log(`${list.length - failed}/${list.length} passed`);
  return failed === 0;
}

module.exports = { parseNotation, validateQuestion, validateAll, isTileNotation };

if (require.main === module) {
  (async () => {
    let list;
    if (process.argv[2]) {
      const data = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf-8'));
      list = Array.isArray(data) ? data : [data];
    } else {
      require('./env');
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
      const r = await pool.query("SELECT id,type,difficulty,prompt,hand,draw,dora,melds,discards,choices,answer,explanation FROM questions WHERE status='active' ORDER BY id");
      list = r.rows.map((row) => ({ ...row, hand: row.hand || '', melds: row.melds || undefined, draw: row.draw || undefined }));
      await pool.end();
    }
    process.exit(validateAll(list) ? 0 : 1);
  })().catch((e) => { console.error(e); process.exit(1); });
}
