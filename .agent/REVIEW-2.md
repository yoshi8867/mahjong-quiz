# M2 리뷰 — FAIL

대상: `site/index.html`, `site/quiz.html`, `site/js/{questions,engine,storage,app}.js`, `site/js/tiles.js`(연동), `site/SCHEMA.md`

## 수용 기준
- [x] 수용1 — 홈에서 유형/난이도 범위 선택 → `quiz.html?types=..&min=..&max=..` 쿼리스트링 전달, `Engine.filter`로 후보 산출, `Tiles.renderHand(..,{mode:'sprite'})`로 타일 렌더. app.js:69-75, 82-92, 107-113.
- [x] 수용2 — 보기 클릭 시 `onChoose`가 정답 보기에 `is-correct`, 오답 보기에 `is-wrong` 부여 + 해설 영역 표시, 페이지 이동 없음, `answered` 플래그로 중복 제출 차단. app.js:216-243.
- [x] 수용3 — "다음 문제"가 `pickWeighted(pool,{excludeId:current.id,...})`로 새 문제 출제, 후보 2개 이상이면 직전 문제 회피. app.js:245-254, engine.js:52-57.
- [x] 수용4 — 오답 시 `Storage.addWrong(current)`로 `mjq.wrong`에 `{id,type,difficulty,prompt,ts}` 기록, 정답은 기록 안 함. app.js:229-230, storage.js:76-89.

## 결함 (FAIL 사유, 파일:줄 명시)
- **questions.js:48 (d004) — 何切る 문제의 손패가 13장(정상 14장이어야 함).** `234m567m55m24p78p9s` = 3+3+2+2+2+1 = 13장. 何切る는 14장에서 1장을 버려 13장 텐파이/1샨텐을 남기는 문제인데, 정답 `9s`를 버리면 12장이 되어 문제가 성립하지 않는다. 해설도 234m·567m·55m·24p·78p·9s(=13장)만 근거로 삼아 손패 자체가 1장 부족하다. 다른 7개 discard 문제(d001~d003, d005~d008)는 모두 14장으로 정상. 이론 검증 대상에서 명확한 데이터 오류이므로 FAIL.

## 참고 — 검증 통과 항목 (재작업 불필요)
- 나머지 29문제 이론 정확: yaku 8문제 정답 역 성립·오답 역 불성립 확인, score 7문제 전부 `부수×2^(2+판수)` 공식 및 자/장·론/쯔모 배수 일치(s001~s007), rule 7문제(후리텐 r002, 창깡 r007, 리치조건 r001 등) 정확. discard d001~d003·d005~d008 우케이레 우위 정답 일치.
- answer 인덱스 전부 실제 정답 보기 지시. hand/dora/melds/discards 표기 파서 문법 준수, choices의 패 표기/텍스트 자동 판별(engine.js `parseChoiceTiles`) 정상.
- 엔진 가중 랜덤(통계 없을 때 균등, 정답률 낮을수록 가중↑, excludeId·pool 0/1 처리), storage 오염 방어(JSON.parse try/catch, `shapeOk` 스키마 검증, 기본값 복구) 모두 규약 충족.
- 스프라이트 연동(`renderHand`/`renderTile`/`renderMeld`/`renderDiscards` 모두 `mode:'sprite'`), 접근성(lang, aria-label 타일, label 폼) 양호.

## 권고 (선택 반영, 최대 3개)
1. **PLAN 위반 — 외부 CDN 폰트 제거.** index.html:7-11, quiz.html:7-11이 jsdelivr에서 Pretendard 웹폰트를 로드한다. PLAN §1은 "CDN 의존성 없이 진행", §3은 "시스템 산세리프 스택"을 명시했으므로 티어 규율상 시스템 폰트 스택(CSS 토큰)으로 대체 권장. (기능은 정상이라 FAIL 사유 아님)
2. d004를 14장으로 교정(예: 부족한 1장을 고립패로 추가해 정답 `9s` 버림이 13장 1샨텐이 되도록)하거나 문제 자체를 교체.
3. score 40부 3판(s005)은 룰에 따라 키리아게 만관(kiriage) 처리되는 경우가 있으므로, 해설에 "표준(비절상) 룰 기준"임을 한 줄 명시하면 학습자 혼동을 줄일 수 있음.
