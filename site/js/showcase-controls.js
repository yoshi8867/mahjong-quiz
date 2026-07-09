/*
 * showcase-controls.js — 쇼케이스 컨트롤 패널 + 페이지 초기화
 *
 * 담당: 서체 라디오, 글리프/오프셋/링/도려내기/적도라 * 마커 슬라이더,
 *       localStorage 저장·복원, 각종 applyXxx, PNG 저장 버튼 바인딩,
 *       DOM 비교 줄 렌더링 + 스프라이트 존재 감지.
 *
 * 의존: window.MahjongTiles (tiles.js), window.ShowcaseGen (sprite-gen.js).
 *       캔버스 상태는 ShowcaseGen.state를 갱신하고 scheduleSpriteRedraw()로 반영.
 */
(function (global) {
  'use strict';

  var MT = global.MahjongTiles;
  var GEN = global.ShowcaseGen;
  var root = document.documentElement;

  /* ---------- 서체 후보: 파일 폰트 2종 ---------- */
  var FONTS = [
    { id: 'yuji', name: '유지 보쿠 (佑字 墨)', stack: '"Yuji Boku", "Noto Serif KR", serif' },
    { id: 'kouzan', name: '코잔 붓글씨 행서 (衡山毛筆 行書)', stack: '"Kouzan Gyousho", "Noto Serif KR", serif' }
  ];
  var LS_FONT = 'mj-hanzi-font';
  var LS_GLYPH = 'mj-glyph-scale';

  /* ---------- 글리프(통·삭) 서체 후보: 시스템 폰트 / GL-MahjongTile SVG 이미지 ---------- */
  // GL-MahjongTile-Clr.woff2는 SVG-in-OpenType 컬러 폰트라 Chrome/Edge에서 렌더 불가 →
  // 폰트에서 추출한 개별 SVG(assets/glyphs/)를 캔버스 drawImage로 그리는 방식으로 대체.
  var SYSTEM_GLYPH_STACK =
    '"Segoe UI Symbol", "Noto Sans Symbols2", "Apple Symbols", "Segoe UI Emoji", sans-serif';
  var GLYPH_FONTS = [
    { id: 'system', source: 'font', name: '시스템 (Segoe UI Symbol)', stack: SYSTEM_GLYPH_STACK,
      preview: '\u{1F019}\u{1F007}\u{1F010}' }, // 🀙🀇🀐 (시스템 폰트로 렌더)
    { id: 'gl-svg', source: 'svg', name: 'GL-MahjongTile (SVG 이미지)',
      previewImg: ['p1', 'm1', 's1'] } // SVG 파일로 미리보기
  ];
  var LS_GLYPH_FONT = 'mj-glyph-font';

  var ALL_HAND = '123456789m123456789p123456789s1234567z';
  var AKA_HAND = '50m50p50s';

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function setText(id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; }
  function fill(id, node) { var host = document.getElementById(id); if (host) host.appendChild(node); }

  // 저장값이 새 후보에 없으면 첫 후보(유지 보쿠)로 폴백.
  function findFont(id) {
    for (var i = 0; i < FONTS.length; i++) if (FONTS[i].id === id) return FONTS[i];
    return FONTS[0];
  }
  // 글리프 서체 저장값이 없거나 무효면 시스템으로 폴백.
  function findGlyphFont(id) {
    for (var i = 0; i < GLYPH_FONTS.length; i++) if (GLYPH_FONTS[i].id === id) return GLYPH_FONTS[i];
    return GLYPH_FONTS[0];
  }

  /* ---------- applyXxx: CSS 변수/상태 갱신 + 재드로잉 ---------- */
  function applyFont(font) {
    root.style.setProperty('--font-hanzi', font.stack);
    setText('font-current', font.name);
    GEN.redrawAfterFonts(); // 파일 폰트 로드 완료 후 캔버스 재드로잉
  }
  // SVG 모드에서 무의미해지는 컨트롤(마스크/링/도려내기 + 한자 서체)을 비활성화(+흐리게)하고 안내 노출.
  function setGlyphMaskControlsDisabled(disabled) {
    var sliderIds = ['ring-thick-slider', 'ring-slider', 'cut-x-slider', 'cut-y-slider'];
    sliderIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.disabled = disabled;
      var row = el.closest ? el.closest('.slider-row') : null;
      if (row) row.classList.toggle('is-dim', disabled);
    });
    var modeRadios = document.querySelectorAll('input[name="glyph-mode"]');
    Array.prototype.forEach.call(modeRadios, function (r) { r.disabled = disabled; });
    var modeGroup = document.getElementById('glyph-mode-group');
    if (modeGroup) modeGroup.classList.toggle('is-dim', disabled);
    var note = document.getElementById('glyph-svg-note');
    if (note) note.hidden = !disabled;
    // 한자 서체 라디오: SVG 모드에서는 한자 미사용 → 비활성화
    var hanziRadios = document.querySelectorAll('input[name="hanzi-font"]');
    Array.prototype.forEach.call(hanziRadios, function (r) { r.disabled = disabled; });
    var fontOptions = document.getElementById('font-options');
    if (fontOptions) fontOptions.classList.toggle('is-dim', disabled);
    var hanziNote = document.getElementById('hanzi-svg-note');
    if (hanziNote) hanziNote.hidden = !disabled;
  }

  // 실패 시(SVG 로드 불가) 시스템 폰트 모드로 자동 복귀.
  function fallbackToSystemGlyph() {
    var sys = findGlyphFont('system');
    var r = document.querySelector('input[name="glyph-font"][value="' + sys.id + '"]');
    if (r) r.checked = true;
    lsSet(LS_GLYPH_FONT, sys.id);
    applyGlyphFont(sys);
  }

  // 현재 글리프 소스에 필요한 에셋(폰트/SVG) 로드 완료 후 재드로잉.
  function refreshGlyphRender() {
    if (GEN.state.glyphSource === 'svg') {
      Promise.all([GEN.loadHanziFonts(), GEN.loadGlyphSvgs()]).then(
        GEN.scheduleSpriteRedraw,
        function (err) {
          console.warn('글리프 SVG 로드 실패 — 시스템 폰트 모드로 폴백합니다.', err);
          fallbackToSystemGlyph();
        }
      );
    } else {
      GEN.redrawAfterFonts();
    }
  }

  function applyGlyphFont(font) {
    GEN.state.glyphSource = font.source;
    if (font.source === 'font' && font.stack) {
      root.style.setProperty('--font-glyph', font.stack);
    }
    setText('glyph-font-current', font.name);
    setGlyphMaskControlsDisabled(font.source === 'svg');
    refreshGlyphRender(); // 필요한 에셋 로드 후 캔버스 재드로잉 (SVG 실패 시 시스템 폴백)
  }
  function applyGlyph(percent) {
    root.style.setProperty('--glyph-scale', (percent / 100).toString());
    setText('glyph-current', percent + '%');
    GEN.scheduleSpriteRedraw();
  }
  function applyOffset(axis, pct) {
    root.style.setProperty('--glyph-off-' + axis, (pct / 100).toString());
    setText('off-' + axis + '-current', pct + '%');
    GEN.scheduleSpriteRedraw();
  }
  function applyMode(mode) {
    GEN.state.glyphMode = mode;
    setText('mode-current', mode === 'mask' ? '테두리 마스크' : '확대 클리핑');
    GEN.scheduleSpriteRedraw();
  }
  function applyThick(pct) {
    GEN.state.ringThickPct = pct;
    setText('ring-thick-current', pct + '%');
    GEN.scheduleSpriteRedraw();
  }
  function applyRing(pct) {
    GEN.state.ringInsetPct = pct;
    setText('ring-current', pct + '%');
    GEN.scheduleSpriteRedraw();
  }
  function applyCut(axis, pct) {
    if (axis === 'x') GEN.state.cutXPct = pct; else GEN.state.cutYPct = pct;
    setText('cut-' + axis + '-current', pct + '%');
    GEN.scheduleSpriteRedraw();
  }
  function applyStar(key, val) {
    GEN.state.star[key] = val;
    setText('star-' + key + '-current', val + '%');
    GEN.scheduleSpriteRedraw();
  }
  function applyRingView(on) {
    GEN.state.showRing = !!on;
    GEN.scheduleSpriteRedraw();
  }

  /* ---------- 슬라이더 바인딩 헬퍼 ---------- */
  // 정수/실수 슬라이더 1개: localStorage 복원 → 초기 apply → input 이벤트.
  function bindSlider(id, lsKey, def, parse, apply) {
    var el = document.getElementById(id);
    if (!el) return def;
    var saved = parse(lsGet(lsKey));
    if (isNaN(saved)) saved = def;
    el.value = String(saved);
    el.addEventListener('input', function () {
      var v = parse(el.value);
      apply(v);
      lsSet(lsKey, String(v));
    });
    return saved;
  }
  function pInt(v) { return parseInt(v, 10); }
  function pFloat(v) { return parseFloat(v); }

  function buildFontRadios(savedFont) {
    var host = document.getElementById('font-options');
    if (!host) return;
    FONTS.forEach(function (font) {
      var label = document.createElement('label');
      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'hanzi-font';
      radio.value = font.id;
      radio.checked = font.id === savedFont.id;
      radio.addEventListener('change', function () {
        var f = findFont(radio.value);
        applyFont(f);
        lsSet(LS_FONT, f.id);
      });
      var name = document.createElement('span');
      name.textContent = font.name;
      var preview = document.createElement('span');
      preview.className = 'preview';
      preview.style.fontFamily = font.stack; // 라벨 미리보기를 해당 폰트로
      preview.textContent = '一萬東發中';
      label.appendChild(radio);
      label.appendChild(name);
      label.appendChild(preview);
      host.appendChild(label);
    });
  }

  function buildGlyphFontRadios(savedFont) {
    var host = document.getElementById('glyph-font-options');
    if (!host) return;
    GLYPH_FONTS.forEach(function (font) {
      var label = document.createElement('label');
      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'glyph-font';
      radio.value = font.id;
      radio.checked = font.id === savedFont.id;
      radio.addEventListener('change', function () {
        var f = findGlyphFont(radio.value);
        applyGlyphFont(f);
        lsSet(LS_GLYPH_FONT, f.id);
      });
      var name = document.createElement('span');
      name.textContent = font.name;
      label.appendChild(radio);
      label.appendChild(name);
      if (font.previewImg) {
        // SVG 옵션: 실제 글리프 SVG 파일을 이미지로 미리보기
        font.previewImg.forEach(function (key) {
          var img = document.createElement('img');
          img.className = 'preview-svg';
          img.src = 'assets/glyphs/' + key + '.svg';
          img.alt = key + ' 타일 미리보기';
          label.appendChild(img);
        });
      } else {
        var preview = document.createElement('span');
        preview.className = 'preview';
        preview.style.fontFamily = font.stack; // 라벨 미리보기를 해당 글리프 폰트로
        preview.textContent = font.preview || '';
        label.appendChild(preview);
      }
      host.appendChild(label);
    });
  }

  function buildControls() {
    // 서체 (저장값이 새 후보에 없으면 유지 보쿠 폴백)
    var savedFont = findFont(lsGet(LS_FONT) || 'yuji');
    buildFontRadios(savedFont);

    // 글리프 서체 (저장값이 없거나 무효면 시스템 폴백)
    var savedGlyphFont = findGlyphFont(lsGet(LS_GLYPH_FONT) || 'system');
    buildGlyphFontRadios(savedGlyphFont);

    var savedGlyph = bindSlider('glyph-slider', LS_GLYPH, 85, pInt, applyGlyph);
    var savedOffX = bindSlider('off-x-slider', 'mj-off-x', 0, pInt, function (v) { applyOffset('x', v); });
    var savedOffY = bindSlider('off-y-slider', 'mj-off-y', 0, pInt, function (v) { applyOffset('y', v); });

    // 모드 토글 라디오
    var savedMode = lsGet('mj-glyph-mode') === 'mask' ? 'mask' : 'clip';
    var modeRadios = document.querySelectorAll('input[name="glyph-mode"]');
    Array.prototype.forEach.call(modeRadios, function (r) {
      r.checked = r.value === savedMode;
      r.addEventListener('change', function () {
        if (r.checked) { applyMode(r.value); lsSet('mj-glyph-mode', r.value); }
      });
    });

    var savedThick = bindSlider('ring-thick-slider', 'mj-ring-thick', 2, pFloat, applyThick);
    var savedRing = bindSlider('ring-slider', 'mj-ring-inset', 8, pFloat, applyRing);
    var savedCutX = bindSlider('cut-x-slider', 'mj-cut-x', 0, pFloat, function (v) { applyCut('x', v); });
    var savedCutY = bindSlider('cut-y-slider', 'mj-cut-y', 0, pFloat, function (v) { applyCut('y', v); });

    // 적도라 * 마커: 수트별 X/Y 오프셋 6개 + 크기 1개
    var starDefs = [
      { key: 'mx', ls: 'mj-star-mx', def: 28 },
      { key: 'my', ls: 'mj-star-my', def: -32 },
      { key: 'px', ls: 'mj-star-px', def: 28 },
      { key: 'py', ls: 'mj-star-py', def: -32 },
      { key: 'sx', ls: 'mj-star-sx', def: 28 },
      { key: 'sy', ls: 'mj-star-sy', def: -32 }
    ];
    var savedStar = {};
    starDefs.forEach(function (d) {
      savedStar[d.key] = bindSlider('star-' + d.key + '-slider', d.ls, d.def, pInt, function (v) {
        applyStar(d.key, v);
      });
    });
    var savedStarSize = bindSlider('star-size-slider', 'mj-star-size', 22, pInt, function (v) {
      applyStar('size', v);
    });

    // 링 보기(디버그) 체크박스
    var savedView = lsGet('mj-ring-view') === '1';
    var viewChk = document.getElementById('ring-view');
    if (viewChk) {
      viewChk.checked = savedView;
      viewChk.addEventListener('change', function () {
        applyRingView(viewChk.checked);
        lsSet('mj-ring-view', viewChk.checked ? '1' : '0');
      });
    }

    // 초기 적용 (CSS 변수/상태 세팅 — 첫 재드로잉은 아래 initSprite에서 폰트 로드 후)
    applyGlyph(savedGlyph);
    applyOffset('x', savedOffX);
    applyOffset('y', savedOffY);
    applyThick(savedThick);
    applyRing(savedRing);
    applyCut('x', savedCutX);
    applyCut('y', savedCutY);
    starDefs.forEach(function (d) { applyStar(d.key, savedStar[d.key]); });
    applyStar('size', savedStarSize);
    applyMode(savedMode);
    applyRingView(savedView);
    applyGlyphFont(savedGlyphFont); // CSS 변수만 세팅(재드로잉은 initSprite에서 폰트 로드 후)
    applyFont(savedFont); // 폰트는 로드 후 재드로잉 유발
  }

  // assets/tiles.png 존재 감지 → 스프라이트 모드 비교 줄 렌더
  function detectSprite() {
    var status = document.getElementById('sprite-status');
    var probe = new Image();
    probe.onload = function () {
      if (status) status.textContent = 'assets/tiles.png 로드됨 — 스프라이트 모드 렌더링.';
      try {
        fill('sprite-row', MT.renderRow(MT.parseHand(ALL_HAND), { mode: 'sprite' }));
        fill('sprite-aka', MT.renderRow(MT.parseHand(AKA_HAND), { mode: 'sprite' }));
      } catch (e) { console.error(e); }
    };
    probe.onerror = function () {
      if (status) {
        status.textContent =
          '아직 생성된 tiles.png가 없습니다 — 위에서 "PNG 저장" 후 site/assets/tiles.png로 옮기세요.';
      }
    };
    probe.src = 'assets/tiles.png?probe=' + Date.now();
  }

  // 34종/적도라/회전·퐁치/버림패/손패 DOM 샘플 렌더
  function renderSamples() {
    fill('row-unicode', MT.renderRow(MT.parseHand(ALL_HAND), { mode: 'unicode' }));
    fill('row-css', MT.renderRow(MT.parseHand(ALL_HAND), { mode: 'css' }));

    fill('aka-unicode', MT.renderRow(MT.parseHand(AKA_HAND), { mode: 'unicode' }));
    fill('aka-css', MT.renderRow(MT.parseHand(AKA_HAND), { mode: 'css' }));

    var rotRow = document.getElementById('rot-sample');
    if (rotRow) {
      rotRow.appendChild(MT.renderTile(MT.parseTile('5m'), { mode: 'css' }));
      rotRow.appendChild(MT.renderTile(MT.parseTile('5m'), { mode: 'css', rotated: true }));
    }

    var meldRow = document.getElementById('meld-sample');
    if (meldRow) {
      meldRow.appendChild(MT.renderMeld('777z', { mode: 'css', rotatedIndex: 0 }));
      meldRow.appendChild(MT.renderMeld('123m', { mode: 'css', rotatedIndex: 0 }));
    }

    fill('pond-sample', MT.renderDiscards('119m234p567s1234z', { mode: 'css' }));
    fill('hand-sample', MT.renderHand('123456m789p1122s', { mode: 'css', tsumo: '3s' }));
    fill('dora-sample', MT.renderTile(MT.parseTile('3p'), { mode: 'css' }));
  }

  function initSprite() {
    GEN.init({
      sprite: document.getElementById('sprite-canvas'),
      debug: document.getElementById('debug-canvas'),
      debugWrap: document.getElementById('debug-wrap')
    });
    var saveBtn = document.getElementById('png-save');
    if (saveBtn) saveBtn.addEventListener('click', GEN.savePng);
    // 고정 PNG 사양 표기 (JS 상수 단일 소스에서 출력)
    var sp = GEN.SPRITE_SPEC;
    if (sp) {
      setText('sprite-spec',
        '시트 ' + sp.width + '×' + sp.height + 'px · ' +
        sp.cols + '열×' + sp.rows + '행 · 셀 ' + sp.cellW + '×' + sp.cellH + 'px');
    }
    // 파일 폰트 로드 완료 후 첫 스프라이트/디버그 드로잉 (폴백으로 구워지지 않게)
    GEN.redrawAfterFonts();
    detectSprite();
  }

  // 컨트롤 패널 접기/펼치기 토글 (접힘 상태 localStorage 저장·복원)
  function bindControlsToggle() {
    var panel = document.querySelector('.controls');
    var btn = document.getElementById('controls-toggle');
    if (!panel || !btn) return;
    var open = lsGet('mj-controls-open') !== '0'; // 기본 펼침
    function apply(isOpen) {
      panel.classList.toggle('is-collapsed', !isOpen);
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
    apply(open);
    btn.addEventListener('click', function () {
      open = !open;
      apply(open);
      lsSet('mj-controls-open', open ? '1' : '0');
    });
  }

  // file://로 열면 SVG로 오염된 캔버스의 PNG 저장이 막히므로 패널 상단에 경고 노출.
  function showFileProtocolWarning() {
    if (location.protocol !== 'file:') return;
    var panel = document.querySelector('.controls');
    if (!panel || document.getElementById('controls-warning')) return;
    var warn = document.createElement('p');
    warn.id = 'controls-warning';
    warn.className = 'controls-warning';
    warn.textContent =
      '⚠ file://로 열려 있습니다 — SVG 모드 PNG 저장은 http://localhost 에서만 동작합니다.';
    var body = document.getElementById('controls-body');
    panel.insertBefore(warn, body || null); // 헤더 바 바로 아래(접혀도 보이게)
  }

  function init() {
    try { showFileProtocolWarning(); } catch (e) { console.error('프로토콜 경고 오류:', e); }
    try { bindControlsToggle(); } catch (e) { console.error('컨트롤 토글 오류:', e); }
    try { buildControls(); } catch (e) { console.error('컨트롤 초기화 오류:', e); }
    try { initSprite(); } catch (e) { console.error('스프라이트 초기화 오류:', e); }
    try { renderSamples(); } catch (e) { console.error('쇼케이스 렌더 오류:', e); }
  }

  global.ShowcaseControls = { init: init };
})(window);
