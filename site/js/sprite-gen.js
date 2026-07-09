/*
 * sprite-gen.js — 쇼케이스 스프라이트 시트 캔버스 드로잉
 *
 * 담당: 9×5 스프라이트 시트 굽기(drawSprite), 마스크 링 스탬프(buildRingStamp),
 *       링 디버그 스트립(drawDebugStrip), PNG 저장(savePng), 재드로잉 스케줄러.
 *
 * 의존: window.MahjongTiles (tiles.js). 컨트롤 패널(showcase-controls.js)과는
 *       window.ShowcaseGen 하나로만 연결한다 — 컨트롤이 state를 바꾼 뒤
 *       scheduleSpriteRedraw()를 호출하면 이 모듈이 CSS 변수 + state를 읽어 다시 굽는다.
 */
(function (global) {
  'use strict';

  var MT = global.MahjongTiles;
  var root = document.documentElement;

  /* ---------- PNG 출력 픽셀 사양 (반응형 브레이크포인트와 무관하게 고정) ----------
     셀에 패 몸체가 여백 없이 꽉 차는 166×248 규격(시트 1494×1240). 간격·그림자는 CSS가 담당.
     창 너비에 따라 굽는 시트 크기가 달라지지 않도록 CSS 토큰 대신 상수 사용. */
  var SPRITE_SCALE = 4;
  var SPRITE_CELL_W = 166;      // 패 몸체가 셀 좌우로 꽉 참(여백 0)
  var SPRITE_CELL_H = 248;
  var SPRITE_RADIUS = 24;       // 6 × 4
  var SPRITE_NUM_SIZE = 104;    // 26 × 4
  var SPRITE_SUIT_SIZE = 60;    // 15 × 4
  var SPRITE_HONOR_SIZE = 112;  // 28 × 4

  /* ---------- 컨트롤이 조정하는 JS-측 상태(캔버스 전용, DOM엔 미적용) ---------- */
  var state = {
    glyphSource: 'font', // 'font'(유니코드 폰트 fillText) | 'svg'(GL-MahjongTile SVG 이미지)
    glyphMode: 'clip',   // 'clip'(확대 클리핑) | 'mask'(테두리 마스크)
    ringThickPct: 2,     // 링 두께(팽창 반경) % (타일 높이 대비)
    ringInsetPct: 8,     // 구멍 크기(도려내기 인셋) %
    cutXPct: 0,          // 도려내기 X 오프셋 %
    cutYPct: 0,          // 도려내기 Y 오프셋 %
    showRing: false,     // 링 디버그 시각화 표시
    // 적도라 * 마커: 수트별 X/Y 오프셋(타일 높이 대비 %) + 공통 크기(%)
    star: { mx: 28, my: -32, px: 28, py: -32, sx: 28, sy: -32, size: 22 }
  };

  var STAR_SANS = 'sans-serif'; // * 마커 폰트: 시스템 산세리프

  /* ---------- GL-MahjongTile SVG 타일 프리로드 (완전한 타일 이미지, 38개) ----------
     m0~m9,p0~p9,s0~s9(각 30: 0=적도라 빨강 재채색), z1~z7(자패, z5=빈 몸체), back(뒷면). */
  var svgImages = {};       // key 'p5'/'m0'/'z3'/'back' → 로드된 Image
  var svgLoadPromise = null;
  function loadGlyphSvgs() {
    if (svgLoadPromise) return svgLoadPromise; // 한 번만 로드 후 캐시
    var keys = [];
    ['m', 'p', 's'].forEach(function (suit) {
      for (var n = 0; n <= 9; n++) keys.push(suit + n); // 0=적도라 포함
    });
    for (var z = 1; z <= 7; z++) keys.push('z' + z);
    keys.push('back');
    svgLoadPromise = Promise.all(keys.map(function (key) {
      return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () { svgImages[key] = img; resolve(); };
        img.onerror = function () { reject(new Error('글리프 SVG 로드 실패: ' + key)); };
        img.src = 'assets/glyphs/' + key + '.svg';
      });
    }));
    return svgLoadPromise;
  }
  var ringCanvas = document.createElement('canvas'); // 링 스탬프용 오프스크린
  var RING_GLYPH = MT.tileGlyph({ suit: 'p', num: 1 }); // 1통: 마스크 공통 테두리
  var MAGENTA = '#e0f'; // 링 시각화 색

  // 캔버스 참조(컨트롤 init에서 주입)
  var spriteCanvas = null, debugCanvas = null, debugWrap = null;

  function cssVar(name) {
    return getComputedStyle(root).getPropertyValue(name).trim();
  }
  function pxVar(name) { return parseFloat(cssVar(name)) || 0; }

  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 1통 글리프의 테두리 링 스탬프를 지정 색으로 오프스크린에 생성.
  function buildRingStamp(cellW, cellH, glyphSize, offX, offY, insetF, thickPx, glyphFont, color, cutOffX, cutOffY) {
    var oc = ringCanvas;
    oc.width = cellW; oc.height = cellH;
    var g = oc.getContext('2d');
    g.clearRect(0, 0, cellW, cellH);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    var gcx = cellW / 2 + offX, gcy = cellH / 2 + offY;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = color;
    g.font = glyphSize + 'px ' + glyphFont;

    // 팽창(dilation): 글리프를 중심 주변 여러 지점에 반복 fillText.
    var t = thickPx || 0;
    g.fillText(RING_GLYPH, gcx, gcy);
    if (t > 0.01) {
      var rStep = 2;
      for (var r = rStep; r <= t + 0.001; r += rStep) {
        var rr = Math.min(r, t);
        var dirs = Math.max(8, Math.ceil((2 * Math.PI * rr) / rStep));
        for (var i = 0; i < dirs; i++) {
          var a = (2 * Math.PI * i) / dirs;
          g.fillText(RING_GLYPH, gcx + Math.cos(a) * rr, gcy + Math.sin(a) * rr);
        }
      }
    }

    // 단색 틴트: COLR 컬러 폰트는 fillStyle이 안 먹으므로, 지금까지 그린 글리프
    // 형태(알파)를 마스크 삼아 지정색 사각형을 source-in으로 덮어 링 색을 강제한다.
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, cellW, cellH);
    g.globalCompositeOperation = 'source-over';

    // 중앙 도려내기(구멍).
    var ccx = gcx + (cutOffX || 0), ccy = gcy + (cutOffY || 0);
    var frameW = glyphSize * 0.60, frameH = glyphSize * 0.78;
    var halfW = (frameW / 2) * (1 - insetF);
    var halfH = (frameH / 2) * (1 - insetF);
    var rad = Math.max(0, Math.min(halfW, halfH) * 0.4);
    g.globalCompositeOperation = 'destination-out';
    roundRectPath(g, ccx - halfW, ccy - halfH, halfW * 2, halfH * 2, rad);
    g.fillStyle = '#000';
    g.fill();
    g.globalCompositeOperation = 'source-over';
    return oc;
  }

  // 캔버스에 9×5 스프라이트 시트를 굽는다. DOM 커스텀 타일과 동일 규칙.
  function drawSprite(canvas) {
    var cols = MT.SPRITE_COLS, rows = MT.SPRITE_ROWS;
    var cellW = SPRITE_CELL_W;   // 고정(반응형 무관)
    var cellH = SPRITE_CELL_H;
    var radius = SPRITE_RADIUS;

    canvas.width = cellW * cols;
    canvas.height = cellH * rows;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var ivory = cssVar('--color-tile');
    var back = cssVar('--color-felt-dark');
    var accent = cssVar('--color-accent');
    var ink = cssVar('--color-ink');
    var colMan = cssVar('--suit-man');
    var colPin = cssVar('--suit-pin');
    var colSou = cssVar('--suit-sou');
    var hanzi = cssVar('--font-hanzi');
    var glyphFont = cssVar('--font-glyph');
    var glyphScale = parseFloat(cssVar('--glyph-scale')) || 0.85;

    var numSize = SPRITE_NUM_SIZE;   // 고정
    var suitSize = SPRITE_SUIT_SIZE;
    var honorSize = SPRITE_HONOR_SIZE;
    var glyphSize = cellH * glyphScale;

    var offX = cellH * (parseFloat(cssVar('--glyph-off-x')) || 0);
    var offY = cellH * (parseFloat(cssVar('--glyph-off-y')) || 0);
    var insetF = state.ringInsetPct / 100;
    var thickPx = cellH * (state.ringThickPct / 100);
    var cutOffX = cellH * (state.cutXPct / 100);
    var cutOffY = cellH * (state.cutYPct / 100);

    var maskStamp = null;
    if (state.glyphMode === 'mask' && state.glyphSource !== 'svg') {
      maskStamp = buildRingStamp(
        cellW, cellH, glyphSize, offX, offY, insetF, thickPx, glyphFont, ivory, cutOffX, cutOffY
      );
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    function cell(col, row, fillColor, contentFn) {
      var x = col * cellW, y = row * cellH;
      var cx = x + cellW / 2, cy = y + cellH / 2;
      ctx.save();
      roundRectPath(ctx, x, y, cellW, cellH, radius);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.clip(); // = overflow:hidden 재현
      if (contentFn) contentFn(x, y, cx, cy);
      ctx.restore();
    }

    // 만수: 숫자(一~九)와 萬을 서로 다른 색으로. (일반: 검정+빨강, 적도라: 빨강+빨강)
    function drawMan(num, numColor, suitColor) {
      return function (x, y, cx) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = numColor;
        ctx.font = 'bold ' + numSize + 'px ' + hanzi;
        ctx.fillText(MT.MAN_NUM[num], cx, y + cellH * 0.34);
        ctx.fillStyle = suitColor;
        ctx.font = 'bold ' + suitSize + 'px ' + hanzi;
        ctx.fillText('萬', cx, y + cellH * 0.72);
      };
    }
    function drawGlyph(tile, color) {
      return function (x, y, cx, cy) {
        ctx.fillStyle = color;
        ctx.font = glyphSize + 'px ' + glyphFont;
        ctx.fillText(MT.tileGlyph(tile), cx + offX, cy + offY);
        if (state.glyphMode === 'mask' && maskStamp) {
          ctx.drawImage(maskStamp, x, y);
        }
      };
    }
    // SVG 모드 셀: 아이보리 몸체를 그리지 않고, 몸체까지 포함된 완전한 타일 SVG를 셀에 채운다.
    // SVG viewBox가 셀 비율(≈166:248)과 일치하므로 셀을 그대로(글리프 크기 슬라이더 배율) 채운다.
    // 100%면 셀에 꽉 참, 폭·높이 모두 셀 기준(왜곡 없음), 중앙 + X/Y 오프셋.
    function svgCell(col, row, key, extraFn) {
      var x = col * cellW, y = row * cellH;
      var cx = x + cellW / 2, cy = y + cellH / 2;
      ctx.save();
      roundRectPath(ctx, x, y, cellW, cellH, radius);
      ctx.clip(); // 타일 라운드 밖 클리핑
      var img = svgImages[key];
      if (img && img.complete && img.naturalWidth) {
        var w = cellW * glyphScale;
        var h = cellH * glyphScale;
        ctx.drawImage(img, cx + offX - w / 2, cy + offY - h / 2, w, h);
      }
      if (extraFn) extraFn(x, y, cx, cy); // 적도라 * 마커 등
      ctx.restore();
    }
    function drawHonor(ch, color) {
      return function (x, y, cx, cy) {
        ctx.fillStyle = color;
        ctx.font = 'bold ' + honorSize + 'px ' + hanzi;
        ctx.fillText(ch, cx, cy);
      };
    }
    // 적도라 * 마커: 셀 중앙 + 수트별 오프셋(타일 높이 대비 %), 빨강 산세리프.
    function drawStar(suit) {
      return function (x, y, cx, cy) {
        var s = state.star;
        var ox = suit === 'm' ? s.mx : suit === 'p' ? s.px : s.sx;
        var oy = suit === 'm' ? s.my : suit === 'p' ? s.py : s.sy;
        ctx.fillStyle = accent;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold ' + (cellH * s.size / 100) + 'px ' + STAR_SANS;
        ctx.fillText('*', cx + cellH * ox / 100, cy + cellH * oy / 100);
      };
    }
    // 여러 컨텐츠 드로어를 순서대로 실행하는 셀.
    function drawAll() {
      var fns = Array.prototype.slice.call(arguments);
      return function (x, y, cx, cy) {
        fns.forEach(function (f) { if (f) f(x, y, cx, cy); });
      };
    }

    var n;
    if (state.glyphSource === 'svg') {
      // SVG 모드: 모든 셀을 완전한 타일 SVG로 (아이보리 몸체·한자 드로잉 미사용).
      for (n = 1; n <= 9; n++) svgCell(n - 1, 0, 'm' + n);   // 만수
      for (n = 1; n <= 9; n++) svgCell(n - 1, 1, 'p' + n);   // 통수
      for (n = 1; n <= 9; n++) svgCell(n - 1, 2, 's' + n);   // 삭수
      for (n = 1; n <= 7; n++) svgCell(n - 1, 3, 'z' + n);   // 자패 (z5=빈 몸체)
      // 행4: 적도라(빨강 재채색 SVG) + * 마커 / 빈타일 z5 / 뒷면 back
      svgCell(0, 4, 'm0', drawStar('m'));
      svgCell(1, 4, 'p0', drawStar('p'));
      svgCell(2, 4, 's0', drawStar('s'));
      svgCell(3, 4, 'z5');   // 빈 타일 = 백(z5) 몸체
      svgCell(4, 4, 'back'); // 뒷면
      return;
    }
    // 행0: 만수 1~9 (숫자 검정 + 萬 빨강)
    for (n = 1; n <= 9; n++) cell(n - 1, 0, ivory, drawMan(n, colMan, accent));
    // 행1: 통수 1~9 (글리프)
    for (n = 1; n <= 9; n++) cell(n - 1, 1, ivory, drawGlyph({ suit: 'p', num: n }, colPin));
    // 행2: 삭수 1~9 (글리프)
    for (n = 1; n <= 9; n++) cell(n - 1, 2, ivory, drawGlyph({ suit: 's', num: n }, colSou));
    // 행3: 자패 1~7 (백=5z는 빈 몸체)
    for (n = 1; n <= 7; n++) {
      if (n === 5) { cell(n - 1, 3, ivory, null); continue; }
      var hc = (n === 7) ? accent : (n === 6) ? colSou : ink; // 中빨강 發녹색
      cell(n - 1, 3, ivory, drawHonor(MT.HONOR_CHAR[n], hc));
    }
    // 행4: 적도라 0m,0p,0s(전부 빨강 + * 마커) / 빈타일 / 뒷면
    cell(0, 4, ivory, drawAll(drawMan(5, accent, accent), drawStar('m')));
    cell(1, 4, ivory, drawAll(drawGlyph({ suit: 'p', num: 5 }, accent), drawStar('p')));
    cell(2, 4, ivory, drawAll(drawGlyph({ suit: 's', num: 5 }, accent), drawStar('s')));
    cell(3, 4, ivory, null);   // 빈 타일(백)
    cell(4, 4, back, null);    // 뒷면(어두운 단색)
  }

  // 링 디버그 스트립(스프라이트와 분리된 별도 캔버스 → PNG에 절대 미포함).
  function drawDebugStrip(canvas) {
    var cellW = SPRITE_CELL_W;   // 스프라이트와 동일 고정 셀
    var cellH = SPRITE_CELL_H;
    var radius = SPRITE_RADIUS;
    var ivory = cssVar('--color-tile');
    var glyphFont = cssVar('--font-glyph');
    var glyphSize = cellH * (parseFloat(cssVar('--glyph-scale')) || 0.85);
    var offX = cellH * (parseFloat(cssVar('--glyph-off-x')) || 0);
    var offY = cellH * (parseFloat(cssVar('--glyph-off-y')) || 0);
    var insetF = state.ringInsetPct / 100;
    var thickPx = cellH * (state.ringThickPct / 100);
    var cutOffX = cellH * (state.cutXPct / 100);
    var cutOffY = cellH * (state.cutYPct / 100);
    var colPin = cssVar('--suit-pin');
    var colSou = cssVar('--suit-sou');

    var samples = [
      { suit: 'p', num: 9, color: colPin },
      { suit: 's', num: 9, color: colSou },
      { suit: 'p', num: 1, color: colPin }
    ];
    canvas.width = cellW * (1 + samples.length);
    canvas.height = cellH;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cellW, cellH);
    ctx.drawImage(
      buildRingStamp(cellW, cellH, glyphSize, offX, offY, insetF, thickPx, glyphFont, MAGENTA, cutOffX, cutOffY), 0, 0
    );

    samples.forEach(function (t, i) {
      var x = (i + 1) * cellW, y = 0;
      ctx.save();
      roundRectPath(ctx, x, y, cellW, cellH, radius);
      ctx.fillStyle = ivory;
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = t.color;
      ctx.font = glyphSize + 'px ' + glyphFont;
      ctx.fillText(MT.tileGlyph({ suit: t.suit, num: t.num }), x + cellW / 2 + offX, y + cellH / 2 + offY);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(
        buildRingStamp(cellW, cellH, glyphSize, offX, offY, insetF, thickPx, glyphFont, MAGENTA, cutOffX, cutOffY), x, y
      );
      ctx.globalAlpha = 1;
      ctx.restore();
    });
  }

  var redrawPending = false;
  function scheduleSpriteRedraw() {
    if (!spriteCanvas || redrawPending) return;
    redrawPending = true;
    requestAnimationFrame(function () {
      redrawPending = false;
      try { drawSprite(spriteCanvas); } catch (e) { console.error('스프라이트 그리기 오류:', e); }
      try {
        if (debugWrap) debugWrap.hidden = !state.showRing;
        if (state.showRing && debugCanvas) drawDebugStrip(debugCanvas);
      } catch (e) { console.error('디버그 스트립 오류:', e); }
    });
  }

  // 파일 폰트가 캔버스에 반영되도록 로드 완료를 기다린 뒤 재드로잉.
  // (로드 전에 fillText 하면 폴백 서체로 구워지므로 반드시 선로드.)
  function loadHanziFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var sample = '一萬東發中';
    return Promise.all([
      document.fonts.load('1em "Yuji Boku"', sample),
      document.fonts.load('1em "Kouzan Gyousho"', sample)
    ]).catch(function () { /* 로드 실패해도 폴백으로 진행 */ });
  }
  function redrawAfterFonts() {
    loadHanziFonts().then(scheduleSpriteRedraw, scheduleSpriteRedraw);
  }

  var PNG_FAIL_MSG =
    'PNG 저장 실패: file://로 열면 브라우저 보안 정책으로 캔버스 추출이 막힙니다. ' +
    'http://localhost 로 열어주세요.';
  function savePng() {
    if (!spriteCanvas) return;
    // SVG drawImage로 캔버스가 tainted되면(특히 file://) toBlob이 예외/‑null을 낸다.
    try {
      spriteCanvas.toBlob(function (blob) {
        if (!blob) { alert(PNG_FAIL_MSG); return; }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'tiles.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (e) {
      console.error('PNG 저장 오류:', e);
      alert(PNG_FAIL_MSG);
    }
  }

  function init(refs) {
    refs = refs || {};
    spriteCanvas = refs.sprite || null;
    debugCanvas = refs.debug || null;
    debugWrap = refs.debugWrap || null;
  }

  global.ShowcaseGen = {
    state: state,
    // 고정 PNG 출력 사양 (표기·검증용 단일 소스)
    SPRITE_SPEC: {
      cellW: SPRITE_CELL_W, cellH: SPRITE_CELL_H,
      cols: MT.SPRITE_COLS, rows: MT.SPRITE_ROWS,
      width: SPRITE_CELL_W * MT.SPRITE_COLS, height: SPRITE_CELL_H * MT.SPRITE_ROWS
    },
    init: init,
    scheduleSpriteRedraw: scheduleSpriteRedraw,
    redrawAfterFonts: redrawAfterFonts,
    loadHanziFonts: loadHanziFonts,
    loadGlyphSvgs: loadGlyphSvgs,
    savePng: savePng,
    buildRingStamp: buildRingStamp,
    drawSprite: drawSprite,
    drawDebugStrip: drawDebugStrip
  };
})(window);
