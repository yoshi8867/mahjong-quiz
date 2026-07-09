# TESTS-2 — M2: 퀴즈 코어 (문제은행 + 출제 + 정오/해설)

대상 파일: `site/index.html`, `site/quiz.html`, `site/js/questions.js`, `site/js/engine.js`, `site/js/storage.js`, `site/js/app.js`, `site/SCHEMA.md`(완성)
실행 URL(실행 모드): 홈 `http://localhost:8931/index.html`, 퀴즈 `http://localhost:8931/quiz.html`

## 사전 메모 (실행 모드용)

- **전역 노출명은 구현에서 정해진다.** 각 페이지 로드 후 우선 아래를 평가해 실제 네임스페이스를 찾는다:
  `Object.keys(window).filter(k => /question|engine|quiz|storage|app|mj|mahjong/i.test(k))`
  아래 케이스는 편의상 `QUESTIONS`(문제 배열), `Engine`(출제/판정), `Storage`(localStorage 래퍼), `parseHand`(타일 파서)로 적지만 실제 노출명(예: `window.MahjongQuiz.questions`, `window.MJEngine.pick`)으로 치환해 평가한다. 노출되지 않으면 DOM 관찰로 대체 판정하고 근거를 TESTRUN에 명시한다.
- **필터 전달 방식**은 구현에서 정해진다(localStorage 설정 키 또는 quiz.html?type=...&diff=... 쿼리스트링 중 하나). 실행 시 홈에서 시작 클릭 후 quiz.html의 URL과 `Object.keys(localStorage)`를 함께 확인해 어느 방식인지 판정한다.
- **파서**: `window.MahjongTiles.parseHand` / `window.parseHand`(alias) 는 M1에서 확정됨. 유효 표기는 `[]`(빈문자열) 또는 타일 배열 반환, 무효 표기는 throw.
- **타일 렌더 기본은 스프라이트 모드**: 손패/도라/보기 타일 요소는 `.tile--sprite` 클래스 + inline `background-position`(%)로 렌더된다. 스프라이트 시트는 `assets/tiles.png`(1494×1240, 9열×5행, 셀 166×248).
- **스키마 필드**(SCHEMA.md 완성본 기준): `id`(문자열, 고유), `type`(`discard`|`yaku`|`score`|`rule`), `difficulty`(1~5 정수), `prompt`(문자열), `hand`(표준 표기), `dora`(선택), `melds`(선택 배열), `discards`(선택), `choices`(길이 4 배열), `answer`(0~3 정수), `explanation`(문자열).
- localStorage 조작 케이스(T2.11)는 다른 케이스 판정을 오염시키지 않도록 **마지막에 가깝게** 실행하고, 끝나면 `localStorage.clear()` 후 재로드해 정상 복귀를 확인한다.

---

### T2.1: 30문제 스키마 준수 — 필수 필드/타입/값 범위
- 절차: quiz.html(또는 questions.js 로드되는 아무 페이지) 로드 후 `Engine`/`QUESTIONS` 배열을 얻어 각 문제를 순회 평가한다. 다음을 한 번에 계산: 총 개수, `type`이 4종 집합에 속하지 않는 문제 수, `difficulty`가 1~5 정수 아닌 수, `choices`가 배열 아니거나 길이≠4인 수, `answer`가 0~3 정수 아닌 수, `id`가 문자열이거나 중복인 경우, `prompt`/`explanation`이 비어있는(공백만 포함) 수.
- 기대: 총 30문제. 위 위반 카운트가 모두 0. 즉 모든 문제가 `type∈{discard,yaku,score,rule}`, `difficulty∈{1..5}`, `choices.length===4`, `answer∈{0,1,2,3}`, `id` 고유·비어있지 않음, `prompt`/`explanation` 비어있지 않음. 위반 발견 시 해당 `id` 목록을 TESTRUN에 기록.

### T2.2: 유형×난이도 분포가 고르게
- 절차: `QUESTIONS`를 집계해 (a) 유형별 개수 map, (b) 난이도별 개수 map, (c) 유형×난이도 교차표를 평가로 만든다.
- 기대: 4종 유형(discard/yaku/score/rule)이 모두 1개 이상 존재하고 특정 유형에 과도하게 쏠리지 않는다(각 유형 대략 5~10개 수준, 어느 유형도 0개 아님). 난이도 1~5가 모두 1개 이상 존재. 30문제 기준 "고르게 분포"(브리핑의 유형 4종×난이도 1~5)를 만족. 실제 교차표를 TESTRUN에 기록.

### T2.3: hand/dora/choices 타일 표기 파싱 가능
- 절차: 각 문제에 대해 `parseHand(q.hand)`를 호출(빈 문자열이면 skip). `q.dora`가 있으면 `parseHand(q.dora)`. `q.melds`가 있으면 각 요소에서 접두어(p/c/k)를 제외한 표기부를 `parseHand`. `q.choices` 중 패 표기로 의도된 항목은 파싱 시 예외 없이 통과하고, 텍스트(점수/역명 등) 보기는 파싱 실패해도 문제 없음 — throw를 try/catch로 잡아 카운트만 집계한다.
- 기대: 모든 `hand`가 예외 없이 파싱되어 타일 배열(길이>0)을 반환. `dora`가 지정된 문제는 정확히 1장으로 파싱. `melds` 표기부도 파싱 가능. `choices`는 패 표기 항목이 파싱되고, 파싱 실패 항목은 순수 텍스트 보기로 렌더될 대상(치명 아님). hand가 파싱 불가한 문제가 있으면 그 `id`를 실패로 기록.

### T2.4: 홈 필터 선택 → 시작 → 퀴즈에 조건 반영 [수용1]
- 절차: 홈(index.html) 로드 → snapshot으로 유형 선택 UI와 난이도 범위 UI를 찾는다. 유형을 `rule` 하나로, 난이도 범위를 특정 구간(예: 4~5)으로 설정하고 "시작"(퀴즈 시작) 버튼 클릭. quiz.html로 이동한 뒤 표시된 문제의 `type`/`difficulty`를 DOM(문제 유형 라벨) 또는 `Engine`의 현재 문제 객체로 확인. 이어 "다음 문제"를 5~8회 눌러 나오는 문제들의 type/difficulty를 모두 수집.
- 기대: quiz.html에 나타나는 모든 문제가 선택 조건을 만족한다(type===`rule`, difficulty 4~5). 조건 밖 유형/난이도가 한 번도 출제되지 않는다. 필터가 URL 쿼리 또는 localStorage 설정으로 quiz에 실제 전달됨을 확인.

### T2.5: 퀴즈 화면 타일이 스프라이트로 렌더 (손패·도라·보기) [수용1]
- 절차: quiz.html에서 discard 유형 문제가 나오도록 홈에서 discard 필터로 시작(또는 여러 번 다음으로 discard 문제 도달). 손패 영역·도라 표시패 영역·보기 4개 영역의 타일 요소를 `document.querySelectorAll('.tile--sprite')`로 센다. 임의 타일 하나에 대해 `getComputedStyle(el).backgroundImage`(tiles.png 참조 여부)와 `el.style.backgroundPosition`(퍼센트 좌표)를 확인. 해당 타일 종류를 `MahjongTiles.spriteIndex`가 산출하는 col/row와 background-position % 값이 일치하는지 대조.
- 기대: 손패 타일이 여러 장, 도라 지정 시 도라 타일 1장, 패 표기 보기는 타일로 스프라이트 렌더된다. 스프라이트 타일의 `backgroundImage`가 `tiles.png`를 가리키고, `background-position`이 `spriteIndex`(예: 5p → row1/col4 → 대략 `50% 25%`) 공식과 일치. 타일이 유니코드 텍스트(두부/이모지)로 렌더되지 않는다.

### T2.6: 정답 클릭 → 즉시 정답 피드백 + 해설 표시 [수용2]
- 절차: quiz.html에서 현재 문제의 정답 index를 `Engine` 현재 문제 객체(`.answer`)로 확인한 뒤, 그 index에 해당하는 보기 버튼을 클릭. 클릭 직후 snapshot과 `getComputedStyle`로 (a) 선택 보기의 정답 색(그린 계열 `--color-*` 정오 토큰) 적용, (b) 해설 영역이 표시(비어있지 않음)되는지 확인.
- 기대: 정답 보기가 즉시 정답 색(그린 계열)으로 강조되고, 해당 문제의 `explanation` 텍스트가 해설 영역에 나타난다. 판정이 클릭 즉시(페이지 이동 없이) 이루어진다. 정답 클릭이므로 오답 기록은 남지 않아야 한다(T2.8과 대조).

### T2.7: 오답 클릭 → 오답 표시 + 정답 강조 + 해설 [수용2]
- 절차: 새 문제에서 정답 index가 아닌 보기(예: `(answer+1)%4`)를 클릭. snapshot/`getComputedStyle`로 (a) 클릭한 오답 보기가 오답 색(레드 계열 정오 토큰), (b) 실제 정답 보기가 정답 색으로 함께 강조, (c) 해설 표시, (d) 판정 후 나머지 보기 클릭이 무효화(중복 제출 방지)되는지 확인 — 판정 후 다른 보기를 눌러도 점수/기록이 추가로 바뀌지 않아야 한다.
- 기대: 오답 보기는 레드 계열, 정답 보기는 그린 계열로 동시 표시되고 해설이 나타난다. 이미 판정된 문제에서 추가 클릭은 무시된다(연속/중복 제출로 기록이 중복되지 않음).

### T2.8: 오답 시 localStorage에 기록 [수용4]
- 절차: 시작 전 `Object.keys(localStorage)`와 관련 키 값을 스냅샷. 한 문제에서 **의도적으로 오답**을 클릭. 직후 `Object.keys(localStorage)` 및 오답/통계 관련 키(JSON)를 파싱해, 방금 틀린 문제의 `id`가 오답 목록(또는 통계의 오답 카운트)에 추가됐는지 확인. 대조로 T2.6의 정답 문제 id는 오답 목록에 없어야 한다.
- 기대: 오답 클릭 후 localStorage의 오답 관련 키에 방금 문제의 `id`(및 최소한 유형/시각 등 식별정보)가 기록된다. 개발자도구/`evaluate`로 확인 가능. 저장 값이 유효한 JSON이며, 정답만 맞힌 문제는 오답 목록에 들어가지 않는다.

### T2.9: "다음 문제" 연속 출제 + 동일 문제 연속 반복 없음 [수용3]
- 절차: quiz.html에서 (판정 후) "다음 문제" 버튼을 20회 이상 반복 클릭하며 매회 현재 문제 `id`를 수집(`Engine` 현재 문제 또는 DOM data-id). 연속한 두 문제의 id가 같은 경우 수를 집계. 필터를 전체(4종·난이도 1~5)로 두고 실행.
- 기대: 매 클릭마다 문제가 실제로 새로 출제되고(문제 패널 내용 변경), 바로 직전 문제와 **동일 id가 연속으로 나오지 않는다**(연속 중복 0회). 20+회 중 다양한 id가 등장(출제가 한 문제에 고정되지 않음). 후보가 2개 이상일 때 직전 문제 재출제가 회피됨을 확인.

### T2.10: 엣지 — 필터 결과 0문제일 때 처리
- 절차: 홈에서 **해당 문제가 존재하지 않는 조합**을 만든다(예: 특정 유형 하나 + 그 유형에 없는 난이도만 선택, 또는 UI가 다중 선택이면 모든 유형 해제). 데이터상 0문제가 되는 조합을 T2.2 교차표를 근거로 고른다. "시작" 클릭 후 quiz.html 동작을 관찰. 만약 UI가 0문제 조합을 애초에 막는다면(시작 버튼 비활성/경고) 그 동작을 확인.
- 기대: 0문제일 때 앱이 크래시하지 않고, (a) 시작 자체가 막히거나(버튼 비활성/안내 문구), (b) quiz.html에서 "조건에 맞는 문제가 없습니다" 류의 빈 상태 메시지를 표시한다. 빈 화면·미처리 예외·무한 로딩·콘솔 error가 없어야 한다. 실제로 어떤 방식으로 처리하는지 TESTRUN에 기록.

### T2.11: 엣지 — localStorage 없음/오염 시 동작 + 새로고침 상태
- 절차: (a) `localStorage.clear()` 후 quiz.html 새로고침 → 정상 출제·판정 되는지 확인(초기 통계 없음 = 균등 출제). (b) 오답 관련 키에 **오염 값**을 주입(`localStorage.setItem(<오답키>, '{깨진 JSON')` 또는 배열 자리에 `'null'`/`'123'`) 후 새로고침 → 앱이 죽지 않고 방어적으로 기본값으로 복구되는지 확인. (c) 정상 상태에서 오답 1건 기록 후 quiz.html을 새로고침 → 기록이 유지되는지(오답 목록/통계 유지) 확인. 마지막에 `localStorage.clear()`로 정리.
- 기대: (a) 저장소가 비어도 정상 시작·출제. (b) 오염된 JSON이 있어도 파싱 예외를 삼키고 기본값으로 초기화하며 콘솔 error로 페이지가 중단되지 않는다. (c) 새로고침 후에도 오답/통계 기록이 남는다(localStorage 지속성). 각 (a)(b)(c)의 관찰 결과를 TESTRUN에 기록.

### T2.12: 콘솔 에러 0건 + 반응형(375px/1280px) 겹침·잘림 없음
- 절차: index.html과 quiz.html 각각 로드 직후 `browser_console_messages(level:"error")` 확인(정상 흐름: 시작→문제표시→정답클릭→다음). `browser_resize`로 375×812(모바일)·1280×800(데스크톱) 두 뷰포트에서 quiz.html의 손패/보기/해설 영역을 snapshot+스크린샷으로 관찰하고, 타일·보기 버튼이 뷰포트 밖으로 잘리거나 서로 겹치는지 `getBoundingClientRect`로 검사.
- 기대: 두 페이지의 정상 흐름에서 콘솔 error 0건(T2.10/T2.11의 의도된 방어 케이스 제외, 단 그 경우에도 미처리 예외로 페이지가 죽지 않음). 두 뷰포트 모두에서 손패·보기 4개·해설이 가로 스크롤/겹침/글리프 잘림 없이 표시되고, 최대 폭 720px 중앙 컬럼 레이아웃이 모바일에서 세로로 자연스럽게 재배치된다.
