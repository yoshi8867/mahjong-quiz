# TESTS-3 — M3: 오답 노트 + 통계 + 적응형 출제 마감

대상 산출물: `site/review.html`(오답 노트: 목록+재풀이), `site/stats.html`(유형별/난이도별 정답률),
`js/engine.js`·`js/storage.js`·`js/app.js` 보강, `index.html` 통계 요약.

## 실행 환경 / 공통 규약

- 실행 URL 베이스: **http://localhost:8931/** (M2 확정, `site/`가 서버 루트).
  - 홈 `http://localhost:8931/index.html`, 퀴즈 `.../quiz.html`, 오답 `.../review.html`, 통계 `.../stats.html`
- 상태 저장 키: `mjq.wrong`(오답 배열), `mjq.stats`(정오 통계 `{type:{}, diff:{}}`).
- 전역 API: `window.MahjongQuestions / MahjongEngine / MahjongStorage / MahjongTiles`.
- 각 케이스는 **독립 실행 가능**해야 함. 케이스 시작 시 다음으로 상태를 초기화/주입한다(개발자도구 Console 또는 browser_evaluate):
  - 초기화: `localStorage.clear()` 후 새로고침.
  - 주입 예시(오답 1건): 아래 T3.1의 SEED 참조.
- 콘솔 에러 확인은 `browser_console_messages(level:"error")`로 하며, 해당 페이지 로드~조작 동안 **에러 0건**이 기본 기대(각 케이스에 별도 명시 없어도 위반 시 실패로 본다).

### 참조 상수 (문제은행 M2 확정)
- 유형 분포(난이도 전체): discard 8 / yaku 8 / score 7 / rule 7 = 30문제.
- 오답 엔트리 정책: `MahjongStorage.addWrong(q)`는 **같은 id는 갱신(중복 미생성)**. M3에서 "내가 고른 답(선택 index)"을 엔트리에 포함하도록 보강되어야 하며, 정답/해설/보기는 id로 `MahjongQuestions`에서 조회한다.

---

## A. 오답 노트 목록 표시 (수용기준 1)

### T3.1: 오답 발생 → review.html 목록에 문제/내가 고른 답/정답/해설 표시
- 절차:
  1. `http://localhost:8931/quiz.html?types=discard&min=1&max=1` 진입(단일 문제군 d001 확정 조건에 근접).
  2. 첫 문제에서 **정답이 아닌 보기**를 클릭(정오/해설 표시 확인).
  3. `http://localhost:8931/review.html` 로 이동.
  - (대안 SEED, 브라우저 직접 주입) console에서:
    `MahjongStorage.clear(); var q=MahjongQuestions[0]; MahjongStorage.addWrong(q); MahjongStorage.recordResult(q,false);` 후 review 새로고침.
- 기대:
  - 방금 틀린 문제가 목록에 카드/행으로 1건 나타난다.
  - 각 항목에 **문제 지문(prompt)**, **내가 고른 답**, **정답(choices[answer])**, **해설(explanation)** 4요소가 모두 보인다.
  - 유형 라벨(타패/역 판정/점수/룰)과 난이도가 함께 표시된다.

### T3.2: 오답 0건일 때 review 빈 상태
- 절차: `localStorage.clear()` → `http://localhost:8931/review.html` 로드.
- 기대: 목록 대신 "오답이 없습니다" 류의 빈 상태 안내가 보이고, 홈/퀴즈로 가는 링크가 존재한다. JS 콘솔 에러 0건. 페이지가 깨지지 않는다.

### T3.3: 같은 문제 중복 오답 시 목록 중복 없음(갱신 정책)
- 절차: console에서
  `MahjongStorage.clear(); var q=MahjongQuestions[0]; MahjongStorage.addWrong(q); var t1=MahjongStorage.getWrong()[0].ts; MahjongStorage.addWrong(q);` 후 review 새로고침.
- 기대:
  - review 목록에 해당 문제가 **정확히 1건만** 표시된다(중복 행 없음).
  - `MahjongStorage.getWrong().length === 1`. 두 번째 기록의 ts가 첫 번째 이상(갱신됨). 정책: 같은 id는 중복 저장하지 않고 최신으로 갱신.

---

## B. 재풀이 → 해소/유지 (수용기준 1)

### T3.4: 재풀이 진입 → 정답 시 오답 목록에서 해소
- 절차:
  1. console SEED: `MahjongStorage.clear(); var q=MahjongQuestions[0]; MahjongStorage.addWrong(q);` → `review.html` 새로고침.
  2. 목록 항목의 **"재풀이"** 버튼/링크를 클릭해 해당 문제 풀이 화면으로 진입.
  3. 그 문제의 **정답 보기**(d001은 answer index 0)를 클릭.
  4. `review.html` 로 돌아가(또는 목록 자동 갱신 확인).
- 기대:
  - 재풀이 화면에는 목록에서 고른 **그 문제(id 동일)** 가 표시된다(임의 랜덤 문제 아님).
  - 정답 처리 후 해당 항목이 오답 목록에서 사라진다. `MahjongStorage.getWrong()` 에 해당 id 없음.
  - `mjq.stats`의 해당 유형 total이 1 증가하고 correct도 1 증가(정답 반영).

### T3.5: 재풀이에서 오답 시 목록 유지
- 절차:
  1. console SEED: `MahjongStorage.clear(); var q=MahjongQuestions[0]; MahjongStorage.addWrong(q);` → `review.html`.
  2. "재풀이" 진입 후 **틀린 보기**를 클릭.
  3. `review.html` 로 복귀/갱신.
- 기대:
  - 해당 항목이 오답 목록에 **그대로 유지**된다. `MahjongStorage.getWrong()` 에 해당 id가 여전히 존재(중복은 생기지 않고 1건 유지).
  - 정오 통계 total은 증가하되 correct는 증가하지 않는다.

---

## C. 통계 표시 (수용기준 2)

### T3.6: stats.html 유형별·난이도별 정답률이 mjq.stats 수치와 일치
- 절차: console 주입 후 `http://localhost:8931/stats.html` 로드:
  ```
  MahjongStorage.clear();
  localStorage.setItem('mjq.stats', JSON.stringify({
    type: { discard:{correct:3,total:4}, yaku:{correct:1,total:2}, score:{correct:0,total:0}, rule:{correct:2,total:5} },
    diff: { "1":{correct:2,total:2}, "3":{correct:1,total:4} }
  }));
  ```
- 기대:
  - 유형별 표/막대에 discard 75%(3/4), yaku 50%(1/2), rule 40%(2/5)가 각각 표시된다(반올림 규칙 허용하되 계산값 일치).
  - 난이도별에 난이도1 100%(2/2), 난이도3 25%(1/4)가 표시된다.
  - 표시된 분수/퍼센트가 주입한 correct/total로부터 산출한 값과 **정확히 일치**한다(browser_evaluate로 DOM 텍스트 파싱해 대조).

### T3.7: 통계 0건일 때 stats.html 방어 표시
- 절차: `localStorage.clear()` → `stats.html` 로드.
- 기대:
  - 페이지가 예외 없이 렌더된다(콘솔 에러 0건).
  - 데이터 없는 유형/난이도는 "-" 또는 "기록 없음"/"0/0" 등으로 표시되고 NaN·`Infinity`·빈 화면이 아니다.
  - `typeAccuracy()`가 null을 주는 유형에서 화면에 `NaN%`가 나오지 않는다.

### T3.8: 홈(index.html)에 통계 요약 표시
- 절차: console 주입:
  ```
  localStorage.setItem('mjq.stats', JSON.stringify({
    type:{discard:{correct:4,total:5}, yaku:{correct:2,total:4}, score:{correct:0,total:0}, rule:{correct:1,total:3}},
    diff:{}
  }));
  localStorage.setItem('mjq.wrong', JSON.stringify([{id:'d002',type:'discard',difficulty:2,prompt:'x',ts:Date.now()}]));
  ```
  → `http://localhost:8931/index.html` 새로고침.
- 기대:
  - 홈에 통계 요약(예: 전체 정답률 또는 유형별 요약, 오답 개수 1건)이 표시된다.
  - 요약 수치가 주입값과 일치(총 정답 7/총 시도 12 = 약 58%, 오답 1건 등 — 구현이 채택한 요약 지표 기준으로 계산값과 일치).
  - stats.html·review.html 로 가는 내비 링크가 홈에 존재하고 실제 대상 파일이 열린다(링크 클릭 시 404 아님).

---

## D. 적응형 출제 (수용기준 3)

### T3.9: 특정 유형 정답률을 낮추면 출제 분포가 그 유형으로 쏠린다 (200+회 샘플링)
- 절차: 아무 페이지(engine+storage 로드된 quiz.html) console에서:
  ```
  MahjongStorage.clear();
  localStorage.setItem('mjq.stats', JSON.stringify({
    type:{ rule:{correct:0,total:10}, discard:{correct:10,total:10},
           yaku:{correct:10,total:10}, score:{correct:10,total:10} }, diff:{} }));
  var pool = MahjongEngine.filter({});           // 전체 30문제
  var stats = MahjongStorage.getStats();
  var c={discard:0,yaku:0,score:0,rule:0};
  for (var i=0;i<2000;i++){ var q=MahjongEngine.pickWeighted(pool,{stats:stats}); c[q.type]++; }
  c;
  ```
- 기대:
  - `rule`(정답률 0% → weight 3) 비율이 통계적으로 크게 상승. 이론값 = (3*7)/(3*7 + 1*8 + 1*8 + 1*7) = 21/44 ≈ **0.477**.
  - 2000회 샘플에서 `c.rule/2000`이 **0.40 이상**(균등 baseline 7/30 ≈ 0.233보다 뚜렷이 큼).
  - 정답률 100%인 discard/yaku/score 각각의 비율은 baseline(≈0.27/0.27/0.23) 근처 또는 그 이하로 억제된다. rule 비율 > 각 타 유형 비율.

### T3.10: 통계 없을 때(초기) 출제는 균등 가중
- 절차: `MahjongStorage.clear();` 후 console:
  ```
  var pool=MahjongEngine.filter({});
  var w=MahjongEngine.typeWeights(MahjongStorage.getStats());
  w;   // {discard:1,yaku:1,score:1,rule:1}
  ```
  이어 2000회 pickWeighted 샘플링해 유형 비율 수집.
- 기대:
  - `typeWeights`가 모든 유형 1을 반환(통계 없음 → 균등).
  - 샘플 분포가 pool 내 유형 개수 비율(8:8:7:7 ≈ 0.27:0.27:0.23:0.23)에 근사(각 유형 오차 ±0.06 이내). 특정 유형 쏠림 없음.

---

## E. 지속성 · 방어 (수용기준 4 · 엣지)

### T3.11: 새로고침/재방문 후 오답·통계 유지
- 절차:
  1. console SEED: `MahjongStorage.clear(); var q=MahjongQuestions[0]; MahjongStorage.addWrong(q); MahjongStorage.recordResult(q,false);`
  2. `review.html` 로드 → 오답 1건 확인 → **F5 새로고침** → 다시 확인.
  3. `stats.html` 로 이동 → 통계 반영 확인 → 새로고침 → 재확인.
  4. 탭을 닫았다가 `http://localhost:8931/review.html` 재진입.
- 기대: 새로고침·재방문 후에도 오답 1건과 해당 유형 통계(total 1, correct 0)가 그대로 유지된다(localStorage 지속). 수치가 초기화되지 않는다.

### T3.12: 오염된 mjq.wrong / mjq.stats 방어
- 절차: console에서 각각 주입 후 페이지 로드:
  - (a) `localStorage.setItem('mjq.wrong','{oops broken json');` → `review.html`
  - (b) `localStorage.setItem('mjq.wrong', JSON.stringify([null, 123, {id:'d001'}]));` → `review.html`
  - (c) `localStorage.setItem('mjq.stats', JSON.stringify([1,2,3]));` → `stats.html`(배열=형태 불일치)
  - (d) `localStorage.setItem('mjq.stats', JSON.stringify({type:'bad', diff:null}));` → `stats.html`
- 기대:
  - 모든 경우 페이지가 예외로 중단되지 않고 렌더된다(콘솔 에러 0건).
  - (a)(c)(d)는 기본값으로 복구되어 빈 상태로 표시. (b)는 깨진/부분 엔트리를 걸러 유효 항목만(또는 안전하게 빈 목록) 처리하고 크래시하지 않는다.
  - `MahjongStorage.getWrong()`은 항상 배열, `getStats()`는 항상 `{type:{}, diff:{}}` 형태를 반환.

---

## F. 레이아웃 / 내비게이션 (엣지)

### T3.13: review·stats 모바일(375px)/데스크톱(1280px) 레이아웃 무붕괴
- 절차:
  1. T3.6의 stats 주입 + T3.1 오답 SEED 적용.
  2. 뷰포트 375×812로 `review.html`, `stats.html` 각각 로드 → 스냅샷/스크린샷.
  3. 뷰포트 1280×800으로 동일 확인.
  4. 아주 긴 해설/지문(오염 대비: 긴 prompt를 가진 오답 주입 `addWrong`로 prompt 300자)에서 오버플로 확인.
- 기대: 두 뷰포트 모두에서 표/목록/막대가 겹치거나 화면 밖으로 잘리지 않는다. 가로 스크롤이 강제되지 않는다(내용 폭 ≤ 뷰포트). 긴 텍스트는 줄바꿈되어 카드 밖으로 넘치지 않는다.

### T3.14: 전 페이지 내비게이션 링크 대상 존재
- 절차: `index.html`/`quiz.html`/`review.html`/`stats.html` 각 topnav의 링크(홈·오답노트·통계·쇼케이스 등)를 클릭.
- 기대: 모든 링크가 실제 존재하는 페이지로 이동하고(404/파일없음 아님), 대상 페이지가 콘솔 에러 0건으로 로드된다. 뒤로가기 시 이전 페이지가 정상 복원된다.
</content>
</invoke>
