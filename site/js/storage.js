/*
 * storage.js — localStorage 안전 래퍼 (오답 기록 + 유형별/난이도별 정오 통계)
 *
 * 방어 원칙:
 *   - localStorage 접근 불가/오염(깨진 JSON, 타입 불일치) 시 try/catch로 삼키고
 *     기본값으로 복구한다. 페이지가 예외로 중단되지 않는다.
 *
 * 전역 노출: window.MahjongStorage
 */
(function (global) {
  'use strict';

  var WRONG_KEY = 'mjq.wrong';   // 오답 목록 (배열)
  var STATS_KEY = 'mjq.stats';   // 정오 통계 (객체)

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  // 저장 값의 형태가 기본값과 맞는지(배열/객체) 검증
  function shapeOk(v, fb) {
    if (Array.isArray(fb)) return Array.isArray(v);
    if (fb && typeof fb === 'object') {
      return v && typeof v === 'object' && !Array.isArray(v);
    }
    return true;
  }

  function read(key, fb) {
    try {
      var raw = global.localStorage.getItem(key);
      if (raw === null || raw === undefined) return clone(fb);
      var v = JSON.parse(raw);
      if (!shapeOk(v, fb)) return clone(fb);
      return v;
    } catch (e) {
      return clone(fb);   // 접근 불가/깨진 JSON → 기본값
    }
  }

  function write(key, val) {
    try {
      global.localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      return false;       // 저장 불가(쿼터/차단) 시 조용히 무시
    }
  }

  var STATS_DEFAULT = { type: {}, diff: {} };

  function getStats() {
    var s = read(STATS_KEY, STATS_DEFAULT);
    if (!s.type || typeof s.type !== 'object' || Array.isArray(s.type)) s.type = {};
    if (!s.diff || typeof s.diff !== 'object' || Array.isArray(s.diff)) s.diff = {};
    return s;
  }

  function getWrong() {
    var w = read(WRONG_KEY, []);
    return Array.isArray(w) ? w : [];
  }

  // 정오 결과 기록 (유형별·난이도별 누적)
  function recordResult(q, correct) {
    var s = getStats();
    var t = s.type[q.type] || (s.type[q.type] = { correct: 0, total: 0 });
    t.total++; if (correct) t.correct++;
    var d = s.diff[q.difficulty] || (s.diff[q.difficulty] = { correct: 0, total: 0 });
    d.total++; if (correct) d.correct++;
    write(STATS_KEY, s);
    return s;
  }

  // 오답 기록 (같은 id는 최신으로 갱신)
  //   chosen: 사용자가 고른 보기 index (선택). 구버전 엔트리(chosen 없음)와 호환.
  function addWrong(q, chosen) {
    var w = getWrong();
    var entry = {
      id: q.id, type: q.type, difficulty: q.difficulty,
      prompt: q.prompt, ts: Date.now()
    };
    if (typeof chosen === 'number' && chosen >= 0) entry.chosen = chosen;
    var idx = -1;
    for (var i = 0; i < w.length; i++) {
      if (w[i] && w[i].id === q.id) { idx = i; break; }
    }
    if (idx >= 0) w[idx] = entry; else w.push(entry);
    write(WRONG_KEY, w);
    return w;
  }

  function removeWrong(id) {
    var w = getWrong().filter(function (e) { return e && e.id !== id; });
    write(WRONG_KEY, w);
    return w;
  }

  // 유형별 정답률 map (데이터 없으면 null)
  function typeAccuracy() {
    var s = getStats();
    var out = {};
    Object.keys(s.type).forEach(function (t) {
      var o = s.type[t];
      out[t] = (o && o.total) ? o.correct / o.total : null;
    });
    return out;
  }

  var TYPE_ORDER = ['discard', 'yaku', 'score', 'rule'];

  // 전체 정답/시도 합계 (유형 통계 기준). 시도 0이면 accuracy=null.
  function overall() {
    var s = getStats();
    var correct = 0, total = 0;
    Object.keys(s.type).forEach(function (t) {
      var o = s.type[t];
      if (o && typeof o.total === 'number' && o.total > 0) {
        total += o.total;
        correct += (o.correct || 0);
      }
    });
    return { correct: correct, total: total, accuracy: total ? correct / total : null };
  }

  // 가장 약한(정답률 최저) 유형 키. 시도 기록이 있는 유형만 대상. 없으면 null.
  function weakestType() {
    var s = getStats();
    var worst = null, worstAcc = Infinity;
    TYPE_ORDER.forEach(function (t) {
      var o = s.type[t];
      if (o && typeof o.total === 'number' && o.total > 0) {
        var acc = (o.correct || 0) / o.total;
        if (acc < worstAcc) { worstAcc = acc; worst = t; }
      }
    });
    return worst;
  }

  function clearAll() {
    try {
      global.localStorage.removeItem(WRONG_KEY);
      global.localStorage.removeItem(STATS_KEY);
    } catch (e) { /* 무시 */ }
  }

  global.MahjongStorage = {
    WRONG_KEY: WRONG_KEY,
    STATS_KEY: STATS_KEY,
    getStats: getStats,
    getWrong: getWrong,
    recordResult: recordResult,
    addWrong: addWrong,
    removeWrong: removeWrong,
    typeAccuracy: typeAccuracy,
    overall: overall,
    weakestType: weakestType,
    clear: clearAll
  };
})(window);
