/*
 * tiles.js — 마작패 표기 파서 + 타일/레이아웃 렌더링 컴포넌트
 *
 * 표기법(요약, 상세는 SCHEMA.md):
 *   - 수트: m(만수) p(통수) s(삭수) z(자패)
 *   - 숫자를 먼저 쓰고 수트 문자를 뒤에 붙인다: "123m456p789s11z"
 *   - 적도라: 0m / 0p / 0s = 빨간 5 (num=5, red=true)
 *   - 자패: 1z=동 2z=남 3z=서 4z=북 5z=백 6z=발 7z=중 (1~7만 유효)
 *
 * 파서 방어 동작:
 *   - parseHand("")        → [] (빈 배열, 예외 아님)
 *   - 유효하지 않은 입력    → Error throw (잘못된 타일을 만들지 않음)
 *
 * 전역 노출: window.MahjongTiles = { parseHand, parseTile, tileCodePoint,
 *   tileGlyph, renderTile, renderRow, renderHand, renderMeld, renderDiscards }
 */
(function (global) {
  'use strict';

  /* ---- 표기 상수 ---- */
  var SUITS = { m: true, p: true, s: true, z: true };

  // 자패 → 유니코드 코드포인트 (z표기와 유니코드 순서가 다르므로 명시적 매핑)
  //   z1 동 U+1F000, z2 남 U+1F001, z3 서 U+1F002, z4 북 U+1F003,
  //   z5 백 U+1F006, z6 발 U+1F005, z7 중 U+1F004
  var HONOR_CP = {
    1: 0x1f000, 2: 0x1f001, 3: 0x1f002, 4: 0x1f003,
    5: 0x1f006, 6: 0x1f005, 7: 0x1f004
  };

  var HONOR_CHAR = { 1: '東', 2: '南', 3: '西', 4: '北', 5: '白', 6: '發', 7: '中' };
  // 만수: 한자 숫자 + 萬 (통수/삭수는 유니코드 글리프 사용, 백은 빈 타일)
  var MAN_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

  /* ---- 파서 ---- */

  // 하나의 (숫자, 수트) 쌍을 타일 객체로. 유효하지 않으면 throw.
  function makeTile(suit, num) {
    if (suit === 'z') {
      if (num < 1 || num > 7) {
        throw new Error('자패 범위 오류(1~7만 유효): ' + num + 'z');
      }
      return { suit: 'z', num: num, red: false };
    }
    // m / p / s
    if (num === 0) {
      return { suit: suit, num: 5, red: true }; // 적도라
    }
    if (num < 1 || num > 9) {
      throw new Error('수패 범위 오류(1~9): ' + num + suit);
    }
    return { suit: suit, num: num, red: false };
  }

  // 단일 토큰 "1m" / "0p" / "5z" 파싱 (편의용). 정확히 타일 1개가 아니면 throw.
  function parseTile(token) {
    var arr = parseHand(token);
    if (arr.length !== 1) {
      throw new Error('단일 타일 토큰이 아닙니다: ' + token);
    }
    return arr[0];
  }

  // 손패 문자열 → 타일 배열. 입력 순서 보존.
  function parseHand(str) {
    if (str === null || str === undefined) {
      throw new Error('입력이 없습니다.');
    }
    if (str === '') return [];

    var tiles = [];
    var digits = [];
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if (ch >= '0' && ch <= '9') {
        digits.push(ch);
      } else if (SUITS[ch]) {
        if (digits.length === 0) {
          throw new Error('수트 문자 앞에 숫자가 없습니다: "' + ch + '"');
        }
        for (var d = 0; d < digits.length; d++) {
          tiles.push(makeTile(ch, Number(digits[d])));
        }
        digits = [];
      } else {
        throw new Error('알 수 없는 문자: "' + ch + '"');
      }
    }
    if (digits.length > 0) {
      throw new Error('수트 접미어 없는 숫자: "' + digits.join('') + '"');
    }
    return tiles;
  }

  /* ---- 유니코드 글리프 ---- */

  function tileCodePoint(tile) {
    switch (tile.suit) {
      case 'm': return 0x1f007 + (tile.num - 1); // 만수 1~9
      case 's': return 0x1f010 + (tile.num - 1); // 삭수 1~9
      case 'p': return 0x1f019 + (tile.num - 1); // 통수 1~9
      case 'z': return HONOR_CP[tile.num];
      default: throw new Error('알 수 없는 수트: ' + tile.suit);
    }
  }

  // 글리프 + U+FE0E(텍스트 표현 강제) — 이모지 렌더/색상 편차 완화
  function tileGlyph(tile) {
    return String.fromCodePoint(tileCodePoint(tile)) + VS_TEXT;
  }
  var VS_TEXT = String.fromCharCode(0xfe0e); // U+FE0E 텍스트 표현 셀렉터

  /* ---- 렌더링 ---- */

  // 스프라이트 시트 그리드: 9열 × 5행 (SCHEMA.md 참고)
  //   행0: 1m~9m, 행1: 1p~9p, 행2: 1s~9s,
  //   행3: 1z~7z(백=5z는 col4=빈몸체), 행4: 0m,0p,0s(적),빈타일,뒷면
  var SPRITE_COLS = 9;
  var SPRITE_ROWS = 5;

  // 타일 → 스프라이트 셀 좌표 {col,row}. 적도라(red)는 행4로 분기.
  function spriteIndex(tile) {
    if (tile.red) {
      return { col: { m: 0, p: 1, s: 2 }[tile.suit], row: 4 };
    }
    switch (tile.suit) {
      case 'm': return { col: tile.num - 1, row: 0 };
      case 'p': return { col: tile.num - 1, row: 1 };
      case 's': return { col: tile.num - 1, row: 2 };
      case 'z': return { col: tile.num - 1, row: 3 };
      default: throw new Error('알 수 없는 수트: ' + tile.suit);
    }
  }

  // 단일 타일 요소 생성.
  //   opts.mode: 'unicode' | 'css' | 'sprite' (기본 'css')
  //   opts.rotated: true 이면 90도 회전 래퍼로 감싸 반환
  function renderTile(tile, opts) {
    opts = opts || {};
    var mode = opts.mode || 'css';

    var el = document.createElement('span');
    el.className = 'tile tile--' + tile.suit + ' tile--' + mode +
      (tile.red ? ' is-aka' : '');
    el.dataset.suit = tile.suit;
    el.dataset.num = String(tile.num);
    if (tile.red) el.dataset.red = 'true';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', ariaLabel(tile));

    if (mode === 'unicode') {
      el.textContent = tileGlyph(tile);
    } else if (mode === 'sprite') {
      var idx = spriteIndex(tile);
      // 퍼센트 좌표: col/(cols-1), row/(rows-1). 셀 종횡비 = 타일 종횡비이므로
      // background-size: (cols*100%) (rows*100%) 로 정확히 셀 1칸만 보인다.
      el.style.backgroundPosition =
        (idx.col / (SPRITE_COLS - 1) * 100) + '% ' +
        (idx.row / (SPRITE_ROWS - 1) * 100) + '%';
    } else {
      buildCssContent(el, tile);
    }

    if (opts.rotated) {
      var wrap = document.createElement('span');
      wrap.className = 'tile-rot';
      wrap.appendChild(el);
      return wrap;
    }
    return el;
  }

  // CSS 커스텀 타일 내부 콘텐츠 구성:
  //   - 만수: 한자 숫자 + 萬 (세로 배치)
  //   - 통수/삭수: 유니코드 마작 글리프를 크게
  //   - 자패: 한자. 단 백(5z)은 실물처럼 빈 아이보리 몸체
  function buildCssContent(el, tile) {
    if (tile.suit === 'm') {
      var num = document.createElement('span');
      num.className = 'tile-num';
      num.textContent = MAN_NUM[tile.num]; // 적도라 0m은 num=5 → 五
      var suit = document.createElement('span');
      suit.className = 'tile-suit';
      suit.textContent = '萬';
      el.appendChild(num);
      el.appendChild(suit);
    } else if (tile.suit === 'p' || tile.suit === 's') {
      var g = document.createElement('span');
      g.className = 'tile-glyph';
      g.textContent = tileGlyph(tile);
      el.appendChild(g);
    } else { // z (자패)
      if (tile.num === 5) {
        el.classList.add('tile--empty'); // 백(白): 빈 타일
      } else {
        var h = document.createElement('span');
        h.className = 'tile-honor tile-honor--' + tile.num;
        h.textContent = HONOR_CHAR[tile.num];
        el.appendChild(h);
      }
    }
  }

  function ariaLabel(tile) {
    if (tile.suit === 'z') return HONOR_CHAR[tile.num];
    var suitName = { m: '만', p: '통', s: '삭' }[tile.suit];
    return (tile.red ? '적' : '') + tile.num + suitName;
  }

  // 타일 배열을 가로 줄 컨테이너로.
  function renderRow(tiles, opts) {
    opts = opts || {};
    var row = document.createElement('div');
    row.className = 'tile-row' + (opts.className ? ' ' + opts.className : '');
    tiles.forEach(function (t) {
      row.appendChild(renderTile(t, opts));
    });
    return row;
  }

  // 손패: 13장 + 쯔모 1장(간격 분리). handStr 파싱, opts.tsumo(문자열)이 있으면 분리 배치.
  function renderHand(handStr, opts) {
    opts = opts || {};
    var hand = document.createElement('div');
    hand.className = 'hand';
    parseHand(handStr).forEach(function (t) {
      hand.appendChild(renderTile(t, opts));
    });
    if (opts.tsumo) {
      parseHand(opts.tsumo).forEach(function (t) {
        var el = renderTile(t, opts);
        el.classList.add('tsumo');
        hand.appendChild(el);
      });
    }
    return hand;
  }

  // 부른 패 세트: rotatedIndex 위치의 1장을 90도 회전.
  function renderMeld(handStr, opts) {
    opts = opts || {};
    var rotIdx = typeof opts.rotatedIndex === 'number' ? opts.rotatedIndex : 0;
    var meld = document.createElement('div');
    meld.className = 'meld';
    parseHand(handStr).forEach(function (t, i) {
      var o = { mode: opts.mode, rotated: i === rotIdx };
      meld.appendChild(renderTile(t, o));
    });
    return meld;
  }

  // 버림패 강: 6장씩 줄바꿈(그리드).
  function renderDiscards(handStr, opts) {
    opts = opts || {};
    var pond = document.createElement('div');
    pond.className = 'pond';
    parseHand(handStr).forEach(function (t) {
      pond.appendChild(renderTile(t, opts));
    });
    return pond;
  }

  var api = {
    parseHand: parseHand,
    parseTile: parseTile,
    makeTile: makeTile,
    tileCodePoint: tileCodePoint,
    tileGlyph: tileGlyph,
    renderTile: renderTile,
    renderRow: renderRow,
    renderHand: renderHand,
    renderMeld: renderMeld,
    renderDiscards: renderDiscards,
    spriteIndex: spriteIndex,
    SPRITE_COLS: SPRITE_COLS,
    SPRITE_ROWS: SPRITE_ROWS,
    HONOR_CP: HONOR_CP,
    HONOR_CHAR: HONOR_CHAR,
    MAN_NUM: MAN_NUM
  };

  global.MahjongTiles = api;
  global.parseHand = parseHand; // 테스트 편의용 alias
})(window);
