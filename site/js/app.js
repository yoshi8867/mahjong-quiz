/*
 * app.js — 페이지별 초기화/이벤트 바인딩 (홈·퀴즈)
 *   body[data-page]="home" → 홈 필터 UI
 *   body[data-page]="quiz" → 퀴즈 출제/판정/해설
 */
(function (global) {
  'use strict';

  var Tiles = global.MahjongTiles;
  var Engine = global.MahjongEngine;
  var Storage = global.MahjongStorage;

  var TYPE_LABEL = {
    discard: '타패 (何切る)',
    yaku: '역 판정',
    score: '점수 계산',
    rule: '룰 판단'
  };

  function el(id) { return document.getElementById(id); }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  /* ==================== 타패(discard) 손패 클릭 공용 ==================== */
  // 정답 비교용 키: num+suit (적도라 0s는 5s와 동등 취급 — red 무시)
  function tileKey(t) { return String(t.num) + t.suit; }
  // 저장/표시용 표기: 적도라는 '0', 그 외 숫자
  function tileNotation(t) { return (t.red ? '0' : String(t.num)) + t.suit; }

  // 정답 패 표기(choices[answer])를 파싱해 정답 키 집합 반환
  function correctKeysOf(q) {
    var keys = {};
    try {
      (global.MahjongTiles.parseHand(String(q.choices[q.answer])) || [])
        .forEach(function (t) { keys[tileKey(t)] = true; });
    } catch (e) { /* 무시 */ }
    return keys;
  }

  // draw(쯔모패) 표기와 일치하는 손패 tile의 index. 정확 표기 우선, 없으면 num+suit 키.
  function findDrawIndex(tiles, drawStr) {
    if (!drawStr) return -1;
    var target;
    try { target = global.MahjongTiles.parseHand(String(drawStr))[0]; }
    catch (e) { return -1; }
    if (!target) return -1;
    var i;
    for (i = 0; i < tiles.length; i++) {
      if (tileNotation(tiles[i]) === tileNotation(target)) return i;
    }
    for (i = 0; i < tiles.length; i++) {
      if (tileKey(tiles[i]) === tileKey(target)) return i;
    }
    return -1;
  }

  // 손패 요소 생성. drawStr이 있으면 그 1장을 우측 쯔모 자리(간격 분리)로 뺀다.
  //   onPick(tile, node, allNodes) 콜백이 있으면 각 패를 클릭 가능한 button으로,
  //   없으면 정적 span으로 렌더. draw가 없거나 hand에 없으면 통짜 렌더(방어).
  // 반환: { el, buttons } 또는 파싱 실패 시 null
  function makeHandElement(handStr, drawStr, onPick) {
    var tiles;
    try { tiles = global.MahjongTiles.parseHand(handStr); }
    catch (e) { return null; }
    if (!tiles.length) return null;

    var drawIdx = findDrawIndex(tiles, drawStr);

    var hand = document.createElement('div');
    hand.className = 'hand' + (onPick ? ' hand--selectable' : '');
    var buttons = [];

    function add(t, isTsumo) {
      var node;
      if (onPick) {
        node = document.createElement('button');
        node.type = 'button';
        node.className = 'tile-btn';
        node.dataset.key = tileKey(t);
        node.dataset.notation = tileNotation(t);
        node.setAttribute('aria-label', tileNotation(t) + ' 버리기');
        try { node.appendChild(Tiles.renderTile(t, { mode: 'sprite' })); }
        catch (e) { /* 무시 */ }
        (function (n) {
          n.addEventListener('click', function () { onPick(t, n, buttons); });
        })(node);
        buttons.push(node);
      } else {
        try { node = Tiles.renderTile(t, { mode: 'sprite' }); }
        catch (e) { node = document.createElement('span'); }
      }
      if (isTsumo) node.classList.add('tsumo');
      hand.appendChild(node);
    }

    tiles.forEach(function (t, idx) { if (idx !== drawIdx) add(t, false); });
    if (drawIdx >= 0) add(tiles[drawIdx], true);

    return { el: hand, buttons: buttons };
  }

  // 판정 후 손패 하이라이트: 정답 패(들)=초록, 클릭한 오답 패=빨강, 전체 비활성
  function markSelectableHand(buttons, correctKeys, clickedBtn, correct) {
    buttons.forEach(function (b) {
      if (correctKeys[b.dataset.key]) b.classList.add('is-correct');
      b.disabled = true;
    });
    if (!correct && clickedBtn) clickedBtn.classList.add('is-wrong');
  }

  /* ==================== 홈 ==================== */
  function initHome() {
    var startBtn = el('start-btn');
    var warn = el('start-warning');
    var allBox = el('type-all');
    var typeBoxes = [].slice.call(document.querySelectorAll('input[name="qtype"]'));
    var minSel = el('diff-min');
    var maxSel = el('diff-max');
    var countEl = el('pool-count');

    function selectedTypes() {
      return typeBoxes.filter(function (b) { return b.checked; })
        .map(function (b) { return b.value; });
    }
    function currentOpts() {
      var min = parseInt(minSel.value, 10);
      var max = parseInt(maxSel.value, 10);
      if (min > max) { var t = min; min = max; max = t; }
      return { types: selectedTypes(), minDifficulty: min, maxDifficulty: max };
    }
    function poolSize() {
      var opts = currentOpts();
      if (!opts.types.length) return 0;
      return Engine.filter(opts).length;
    }
    function update() {
      var n = poolSize();
      if (countEl) countEl.textContent = String(n);
      var empty = (n === 0);
      warn.hidden = !empty;
      startBtn.disabled = empty;
    }

    allBox.addEventListener('change', function () {
      typeBoxes.forEach(function (b) { b.checked = allBox.checked; });
      update();
    });
    typeBoxes.forEach(function (b) {
      b.addEventListener('change', function () {
        allBox.checked = typeBoxes.every(function (x) { return x.checked; });
        update();
      });
    });
    minSel.addEventListener('change', update);
    maxSel.addEventListener('change', update);

    startBtn.addEventListener('click', function () {
      var opts = currentOpts();
      if (!opts.types.length || Engine.filter(opts).length === 0) { update(); return; }
      var qs = 'types=' + encodeURIComponent(opts.types.join(',')) +
        '&min=' + opts.minDifficulty + '&max=' + opts.maxDifficulty;
      global.location.href = 'quiz.html?' + qs;
    });

    update();
  }

  /* ==================== 퀴즈 ==================== */
  function initQuiz() {
    var params = new URLSearchParams(global.location.search);
    var types = (params.get('types') || '').split(',').filter(Boolean);
    var min = parseInt(params.get('min'), 10) || 1;
    var max = parseInt(params.get('max'), 10) || 5;
    var opts = {
      types: types.length ? types : Engine.TYPES.slice(),
      minDifficulty: min,
      maxDifficulty: max
    };

    var pool = Engine.filter(opts);
    var emptyState = el('empty-state');
    var quizMain = el('quiz-main');

    if (!pool.length) {
      emptyState.hidden = false;
      quizMain.hidden = true;
      return;
    }
    emptyState.hidden = true;
    quizMain.hidden = false;

    var current = null;
    var answered = false;

    function renderTileNotation(container, notation) {
      // 손패 렌더(스프라이트). 실패해도 페이지가 죽지 않게 try/catch.
      try {
        container.appendChild(Tiles.renderHand(notation, { mode: 'sprite' }));
        return true;
      } catch (e) { return false; }
    }

    function render(q) {
      current = q;
      answered = false;
      var isDiscard = (q.type === 'discard');

      el('q-type').textContent = TYPE_LABEL[q.type] || q.type;
      el('q-diff').textContent = '난이도 ' + q.difficulty;
      var promptEl = el('q-prompt');
      promptEl.textContent = q.prompt;
      quizMain.dataset.qid = q.id;
      quizMain.dataset.qtype = q.type;
      quizMain.dataset.qdiff = String(q.difficulty);

      // 손패 — discard는 각 패를 클릭 가능하게(쯔모기리 포함), 그 외는 정적 렌더
      var handWrap = el('q-hand');
      clear(handWrap);
      if (isDiscard && q.hand) {
        var hint = document.createElement('span');
        hint.className = 'field-label';
        hint.textContent = '버릴 패를 손패에서 직접 선택하세요.';
        var built = makeHandElement(q.hand, q.draw, onPickTile);
        if (built) {
          handWrap.appendChild(hint);
          handWrap.appendChild(built.el);
          handWrap.hidden = false;
        } else {
          handWrap.hidden = !renderTileNotation(handWrap, q.hand);
        }
      } else if (q.hand) {
        handWrap.hidden = !renderTileNotation(handWrap, q.hand);
      } else {
        handWrap.hidden = true;
      }

      // 도라 표시패
      var doraWrap = el('q-dora');
      clear(doraWrap);
      if (q.dora) {
        try {
          var lbl = document.createElement('span');
          lbl.className = 'field-label';
          lbl.textContent = '도라 표시';
          var box = document.createElement('div');
          box.className = 'dora-indicator';
          Tiles.parseHand(q.dora).forEach(function (t) {
            box.appendChild(Tiles.renderTile(t, { mode: 'sprite' }));
          });
          doraWrap.appendChild(lbl);
          doraWrap.appendChild(box);
          doraWrap.hidden = false;
        } catch (e) { doraWrap.hidden = true; }
      } else {
        doraWrap.hidden = true;
      }

      // 부른 패
      var meldWrap = el('q-melds');
      clear(meldWrap);
      if (q.melds && q.melds.length) {
        q.melds.forEach(function (m) {
          try {
            var notation = /^[pck]/i.test(m) ? m.slice(1) : m;
            meldWrap.appendChild(Tiles.renderMeld(notation, { mode: 'sprite', rotatedIndex: 0 }));
          } catch (e) { /* 무시 */ }
        });
        meldWrap.hidden = false;
      } else {
        meldWrap.hidden = true;
      }

      // 버림패
      var discWrap = el('q-discards');
      clear(discWrap);
      if (q.discards) {
        try {
          var lbl2 = document.createElement('span');
          lbl2.className = 'field-label';
          lbl2.textContent = '버림패';
          discWrap.appendChild(lbl2);
          discWrap.appendChild(Tiles.renderDiscards(q.discards, { mode: 'sprite' }));
          discWrap.hidden = false;
        } catch (e) { discWrap.hidden = true; }
      } else {
        discWrap.hidden = true;
      }

      // 보기 — discard는 손패 클릭으로 답하므로 보기 버튼을 숨긴다
      var choicesWrap = el('choices');
      clear(choicesWrap);
      if (isDiscard) {
        choicesWrap.hidden = true;
      } else {
        choicesWrap.hidden = false;
        q.choices.forEach(function (c, i) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'choice-btn';
          btn.dataset.index = String(i);
          var tiles = Engine.parseChoiceTiles(c);
          if (tiles) {
            btn.classList.add('choice-btn--tiles');
            btn.setAttribute('aria-label', c);
            tiles.forEach(function (t) {
              btn.appendChild(Tiles.renderTile(t, { mode: 'sprite' }));
            });
          } else {
            btn.textContent = c;
          }
          btn.addEventListener('click', function () { onChoose(i); });
          choicesWrap.appendChild(btn);
        });
      }

      // 해설 숨김
      var exp = el('explanation');
      exp.hidden = true;
      clear(exp);
    }

    function showExplanation(correct) {
      var exp = el('explanation');
      clear(exp);
      var verdict = document.createElement('p');
      verdict.className = 'verdict ' + (correct ? 'is-correct' : 'is-wrong');
      verdict.textContent = correct ? '정답입니다' : '오답입니다';
      var body = document.createElement('p');
      body.className = 'exp-body';
      body.textContent = current.explanation;
      exp.appendChild(verdict);
      exp.appendChild(body);
      exp.hidden = false;
    }

    // 4지선다(yaku/score/rule) 판정
    function onChoose(i) {
      if (answered) return;            // 중복 제출 방지
      answered = true;
      var correct = (i === current.answer);

      var buttons = [].slice.call(document.querySelectorAll('#choices .choice-btn'));
      buttons.forEach(function (b) {
        var bi = parseInt(b.dataset.index, 10);
        if (bi === current.answer) b.classList.add('is-correct');
        if (bi === i && !correct) b.classList.add('is-wrong');
        b.disabled = true;
      });

      Storage.recordResult(current, correct);
      if (!correct) Storage.addWrong(current, i);
      showExplanation(correct);
    }

    // discard 손패 클릭 판정 — chosen에는 클릭한 패 표기 문자열 저장
    function onPickTile(tile, node, nodes) {
      if (answered) return;
      answered = true;
      var keys = correctKeysOf(current);
      var correct = !!keys[tileKey(tile)];
      markSelectableHand(nodes, keys, node, correct);
      Storage.recordResult(current, correct);
      if (!correct) Storage.addWrong(current, tileNotation(tile));
      showExplanation(correct);
    }

    function next() {
      var q = Engine.pickWeighted(pool, {
        excludeId: current ? current.id : null,
        stats: Storage.getStats()
      });
      render(q);
    }

    el('next-btn').addEventListener('click', next);
    next();
  }

  /* ==================== 공용 렌더 헬퍼 ==================== */
  // 보기 문자열을 타일 또는 텍스트로 target에 렌더
  function renderChoice(target, str) {
    var tiles = Engine.parseChoiceTiles(str);
    if (tiles) {
      target.classList.add('answer--tiles');
      target.setAttribute('aria-label', str);
      tiles.forEach(function (t) {
        try { target.appendChild(Tiles.renderTile(t, { mode: 'sprite' })); }
        catch (e) { /* 무시 */ }
      });
    } else {
      target.textContent = str;
    }
  }

  function renderHandInto(container, notation) {
    if (!notation) return false;
    try {
      container.appendChild(Tiles.renderHand(notation, { mode: 'sprite' }));
      return true;
    } catch (e) { return false; }
  }

  function questionById(id) {
    var list = global.MahjongQuestions || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }

  function pct(correct, total) {
    if (!total) return null;
    return Math.round((correct / total) * 100);
  }

  /* ==================== 홈 통계 요약 ==================== */
  function renderHomeSummary() {
    var box = el('home-summary');
    if (!box) return;
    var ov = Storage.overall();
    var wrongCount = Storage.getWrong().length;
    var weak = Storage.weakestType();

    var accEl = el('summary-accuracy');
    if (accEl) {
      accEl.textContent = (ov.accuracy === null)
        ? '기록 없음'
        : Math.round(ov.accuracy * 100) + '% (' + ov.correct + '/' + ov.total + ')';
    }
    var wrongEl = el('summary-wrong');
    if (wrongEl) wrongEl.textContent = wrongCount + '건';
    var weakEl = el('summary-weak');
    if (weakEl) weakEl.textContent = weak ? (TYPE_LABEL[weak] || weak) : '-';
  }

  /* ==================== 오답 노트 ==================== */
  function initReview() {
    var listEl = el('wrong-list');
    var emptyEl = el('review-empty');
    if (!listEl) return;

    function refresh() {
      clear(listEl);
      var entries = Storage.getWrong().filter(function (e) {
        return e && typeof e === 'object' && e.id;
      });
      if (!entries.length) {
        listEl.hidden = true;
        if (emptyEl) emptyEl.hidden = false;
        return;
      }
      listEl.hidden = false;
      if (emptyEl) emptyEl.hidden = true;
      entries.forEach(function (entry) {
        var q = questionById(entry.id);
        listEl.appendChild(buildCard(entry, q));
      });
    }

    function buildCard(entry, q) {
      var card = document.createElement('article');
      card.className = 'card review-card';
      card.dataset.qid = entry.id;

      // 메타
      var meta = document.createElement('div');
      meta.className = 'q-meta';
      var bt = document.createElement('span');
      bt.className = 'badge';
      bt.textContent = TYPE_LABEL[entry.type] || entry.type || '유형';
      var bd = document.createElement('span');
      bd.className = 'badge';
      bd.textContent = '난이도 ' + (entry.difficulty != null ? entry.difficulty : '?');
      meta.appendChild(bt);
      meta.appendChild(bd);
      card.appendChild(meta);

      // 지문
      var prompt = document.createElement('p');
      prompt.className = 'q-prompt';
      prompt.textContent = (q && q.prompt) || entry.prompt || '(문제 정보 없음)';
      card.appendChild(prompt);

      // 손패 (discard는 draw 분리 렌더)
      if (q && q.hand) {
        var handWrap = document.createElement('div');
        handWrap.className = 'q-field';
        var built = (q.type === 'discard') ? makeHandElement(q.hand, q.draw, null) : null;
        if (built) {
          handWrap.appendChild(built.el);
          card.appendChild(handWrap);
        } else if (renderHandInto(handWrap, q.hand)) {
          card.appendChild(handWrap);
        }
      }

      if (q) {
        // 내가 고른 답
        var mineRow = document.createElement('div');
        mineRow.className = 'review-line';
        var mineLbl = document.createElement('span');
        mineLbl.className = 'field-label';
        mineLbl.textContent = '내가 고른 답';
        var mineVal = document.createElement('span');
        mineVal.className = 'answer-val is-wrong-text';
        if (typeof entry.chosen === 'string' && entry.chosen) {
          // discard: 클릭한 패 표기 → 타일로 렌더
          renderChoice(mineVal, entry.chosen);
        } else if (typeof entry.chosen === 'number' && q.choices && q.choices[entry.chosen] != null) {
          // 4지선다: 보기 index → 보기 텍스트/타일
          renderChoice(mineVal, String(q.choices[entry.chosen]));
        } else {
          mineVal.textContent = '기록 없음';
        }
        mineRow.appendChild(mineLbl);
        mineRow.appendChild(mineVal);
        card.appendChild(mineRow);

        // 정답
        var ansRow = document.createElement('div');
        ansRow.className = 'review-line';
        var ansLbl = document.createElement('span');
        ansLbl.className = 'field-label';
        ansLbl.textContent = '정답';
        var ansVal = document.createElement('span');
        ansVal.className = 'answer-val is-correct-text';
        if (q.choices && q.choices[q.answer] != null) {
          renderChoice(ansVal, String(q.choices[q.answer]));
        } else {
          ansVal.textContent = '-';
        }
        ansRow.appendChild(ansLbl);
        ansRow.appendChild(ansVal);
        card.appendChild(ansRow);

        // 해설
        var exp = document.createElement('div');
        exp.className = 'explanation';
        var expBody = document.createElement('p');
        expBody.className = 'exp-body';
        expBody.textContent = q.explanation || '';
        exp.appendChild(expBody);
        card.appendChild(exp);
      }

      // 재풀이 영역
      var actions = document.createElement('div');
      actions.className = 'review-actions';
      var retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'primary-btn';
      retryBtn.textContent = '재풀이';
      actions.appendChild(retryBtn);
      card.appendChild(actions);

      var solveWrap = document.createElement('div');
      solveWrap.className = 'review-solve';
      solveWrap.hidden = true;
      card.appendChild(solveWrap);

      retryBtn.addEventListener('click', function () {
        if (!q) return;
        retryBtn.disabled = true;
        startResolve(card, solveWrap, q, refresh);
      });

      return card;
    }

    function startResolve(card, solveWrap, q, onDone) {
      clear(solveWrap);
      solveWrap.hidden = false;
      var answered = false;

      function finish(correct, chosenValue) {
        Storage.recordResult(q, correct);
        var msg = document.createElement('p');
        msg.className = 'verdict ' + (correct ? 'is-correct' : 'is-wrong');
        if (correct) {
          Storage.removeWrong(q.id);
          msg.textContent = '정답입니다. 오답 목록에서 해소되었습니다.';
        } else {
          Storage.addWrong(q, chosenValue); // 최신 선택으로 갱신, 목록 유지
          msg.textContent = '오답입니다. 오답 목록에 유지됩니다.';
        }
        solveWrap.appendChild(msg);
        global.setTimeout(onDone, 600); // 목록 갱신(정답 시 카드 제거)
      }

      // discard: 손패 클릭(쯔모기리 포함) 방식
      if (q.type === 'discard') {
        var keys = correctKeysOf(q);
        var built = makeHandElement(q.hand, q.draw, function (tile, node, nodes) {
          if (answered) return;
          answered = true;
          var correct = !!keys[tileKey(tile)];
          markSelectableHand(nodes, keys, node, correct);
          finish(correct, tileNotation(tile));
        });
        if (built) solveWrap.appendChild(built.el);
        else finish(false, ''); // 방어: 손패 렌더 실패 시 그대로 유지
        return;
      }

      // 그 외: 4지선다
      var choices = document.createElement('div');
      choices.className = 'choices';
      q.choices.forEach(function (c, i) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'choice-btn';
        btn.dataset.index = String(i);
        var tiles = Engine.parseChoiceTiles(String(c));
        if (tiles) {
          btn.classList.add('choice-btn--tiles');
          btn.setAttribute('aria-label', String(c));
          tiles.forEach(function (t) {
            try { btn.appendChild(Tiles.renderTile(t, { mode: 'sprite' })); }
            catch (e) { /* 무시 */ }
          });
        } else {
          btn.textContent = String(c);
        }
        btn.addEventListener('click', function () {
          if (answered) return;
          answered = true;
          var correct = (i === q.answer);
          [].slice.call(choices.querySelectorAll('.choice-btn')).forEach(function (b) {
            var bi = parseInt(b.dataset.index, 10);
            if (bi === q.answer) b.classList.add('is-correct');
            if (bi === i && !correct) b.classList.add('is-wrong');
            b.disabled = true;
          });
          finish(correct, i);
        });
        choices.appendChild(btn);
      });
      solveWrap.appendChild(choices);
    }

    refresh();
  }

  /* ==================== 통계 ==================== */
  function initStats() {
    var typeBody = el('stats-type-body');
    var diffBody = el('stats-diff-body');
    if (!typeBody && !diffBody) return;

    var stats = Storage.getStats();

    function cell(text) {
      var td = document.createElement('td');
      td.textContent = text;
      return td;
    }
    function row(label, o) {
      var tr = document.createElement('tr');
      var th = document.createElement('th');
      th.scope = 'row';
      th.textContent = label;
      tr.appendChild(th);
      var total = (o && typeof o.total === 'number') ? o.total : 0;
      var correct = (o && typeof o.correct === 'number') ? o.correct : 0;
      if (!total) {
        tr.appendChild(cell('-'));
        tr.appendChild(cell('-'));
      } else {
        tr.appendChild(cell(correct + ' / ' + total));
        tr.appendChild(cell(pct(correct, total) + '%'));
      }
      return tr;
    }

    if (typeBody) {
      clear(typeBody);
      Engine.TYPES.forEach(function (t) {
        typeBody.appendChild(row(TYPE_LABEL[t] || t, stats.type[t]));
      });
    }
    if (diffBody) {
      clear(diffBody);
      for (var d = 1; d <= 5; d++) {
        diffBody.appendChild(row('난이도 ' + d, stats.diff[String(d)] || stats.diff[d]));
      }
    }

    var ov = Storage.overall();
    var ovEl = el('stats-overall');
    if (ovEl) {
      ovEl.textContent = (ov.accuracy === null)
        ? '아직 기록이 없습니다.'
        : '전체 정답률 ' + Math.round(ov.accuracy * 100) + '% (' + ov.correct + ' / ' + ov.total + ')';
    }
  }

  /* ==================== 디스패치 ==================== */
  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.getAttribute('data-page');
    if (page === 'home') { initHome(); renderHomeSummary(); }
    else if (page === 'quiz') initQuiz();
    else if (page === 'review') initReview();
    else if (page === 'stats') initStats();
  });
})(window);
