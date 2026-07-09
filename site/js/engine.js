/*
 * engine.js — 출제 엔진 (필터 → 가중 랜덤 출제) + 보기 판별
 *
 *   - filter: 유형 집합 + 난이도 범위로 후보군 산출
 *   - pickWeighted: 후보군에서 가중 랜덤. 유형별 정답률이 낮을수록 가중↑
 *     (통계 없으면 균등). 직전 문제(excludeId)는 후보가 2개 이상이면 회피.
 *
 * 전역 노출: window.MahjongEngine
 */
(function (global) {
  'use strict';

  var TYPES = ['discard', 'yaku', 'score', 'rule'];
  var BOOST = 2; // 약한 유형 최대 가중 배율 = 1 + BOOST

  function all() {
    return (global.MahjongQuestions || []).slice();
  }

  // { types:[...], minDifficulty, maxDifficulty } → 후보 배열
  function filter(opts) {
    opts = opts || {};
    var types = (opts.types && opts.types.length) ? opts.types : TYPES;
    var tset = {};
    types.forEach(function (t) { tset[t] = true; });
    var min = opts.minDifficulty || 1;
    var max = opts.maxDifficulty || 5;
    return all().filter(function (q) {
      return tset[q.type] && q.difficulty >= min && q.difficulty <= max;
    });
  }

  // 유형별 가중치: 정답률 낮을수록 높음. 데이터 없으면 1(균등)
  function typeWeights(stats) {
    var w = {};
    TYPES.forEach(function (t) {
      var s = stats && stats.type && stats.type[t];
      if (s && s.total > 0) {
        var acc = s.correct / s.total;
        w[t] = 1 + (1 - acc) * BOOST;
      } else {
        w[t] = 1;
      }
    });
    return w;
  }

  // 가중 랜덤 1문제. opts: { excludeId, stats }
  function pickWeighted(pool, opts) {
    opts = opts || {};
    if (!pool || !pool.length) return null;

    var candidates = pool;
    if (opts.excludeId && pool.length > 1) {
      var filtered = pool.filter(function (q) { return q.id !== opts.excludeId; });
      if (filtered.length) candidates = filtered; // 직전 문제 연속 회피
    }

    var w = typeWeights(opts.stats);
    var total = 0;
    var weights = candidates.map(function (q) {
      var x = w[q.type] || 1;
      total += x;
      return x;
    });

    var r = Math.random() * total;
    for (var i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  // 보기 문자열이 패 표기면 타일 배열, 아니면 null (텍스트 보기)
  function parseChoiceTiles(str) {
    if (!global.MahjongTiles) return null;
    try {
      var tiles = global.MahjongTiles.parseHand(str);
      return tiles.length ? tiles : null;
    } catch (e) {
      return null;
    }
  }

  global.MahjongEngine = {
    TYPES: TYPES,
    all: all,
    filter: filter,
    typeWeights: typeWeights,
    pickWeighted: pickWeighted,
    parseChoiceTiles: parseChoiceTiles
  };
})(window);
