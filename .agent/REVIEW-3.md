# M3 리뷰 — PASS

## 수용 기준
- [x] 1. 오답이 review 목록에 나타나고 재풀이 정답 시 해소 — `app.js` initReview: 오답 클릭 시 `addWrong(current,i)`(app.js:230), 재풀이 정답 시 `removeWrong(q.id)` 후 `refresh()`로 카드 제거(app.js:476,479). 오답 시 `addWrong(q,i)`로 1건 유지(app.js:481). 재풀이 결과는 정오 모두 `recordResult`로 stats 반영(app.js:471) — 정책 일관.
- [x] 2. stats.html 유형별·난이도별 정답률 + 홈 요약 — initStats가 `Engine.TYPES`/난이도 1~5 순회하며 `correct/total`·`pct()` 렌더(app.js:526-537), 홈은 `overall()`/`weakestType()`/`getWrong().length`로 요약(app.js:295-312). 전체 정답률 지표가 stats·홈 모두 `overall()` 공유 → 일관.
- [x] 3. 약한 유형 가중 출제 — `typeWeights`가 `1+(1-acc)*BOOST`(BOOST=2)로 정답률 낮을수록 가중, 통계 없으면 1 균등(engine.js:34-46). T3.9 이론값 21/44≈0.477 로직 일치, `pickWeighted` 누적합 방식 정상(engine.js:49-73).
- [x] 4. 새로고침 후 오답·통계 유지 — 모든 상태 localStorage(`mjq.wrong`/`mjq.stats`) 기반, 페이지 로드 시 재읽기. 별도 세션 캐시 없음.

## 결함
없음 (FAIL 사유 없음).

주요 검증 결과:
- 구버전 엔트리(chosen 없음) 호환 — buildCard가 `typeof entry.chosen==='number'` 가드 후 아니면 '기록 없음' 표시(app.js:378-382). undefined 미노출 확인.
- 오염 방어 T3.12 4종 모두 통과: (a) 깨진 JSON → `read` catch로 기본값(storage.js:36), (b) `[null,123,{id}]` → getWrong 배열 유지 + review에서 `e&&typeof e==='object'&&e.id` 필터(app.js:322-324), (c) 배열형 stats → `shapeOk` 거부 후 기본값(storage.js:21-27), (d) `{type:'bad',diff:null}` → getStats 재정규화로 `{type:{},diff:{}}`(storage.js:54-55). getWrong 항상 배열, getStats 항상 정규 형태.
- 시도 0건: `overall().accuracy===null` → '기록 없음', `pct`가 total 0에서 null 반환 후 표에서 '-' 처리(app.js:516-518). NaN/Infinity 노출 없음.
- 내비게이션: 4개 페이지 topnav의 index/review/stats/showcase 링크 대상 파일 모두 존재.
- 티어/토큰: 순수 HTML/CSS/JS, 프레임워크 없음. M3 신규 스타일 전부 기존 `--space-*`/`--color-*` 토큰 사용.

## 권고 (선택)
1. 재풀이는 매번 `recordResult`로 stats total을 누적한다(원 풀이 + 재풀이 이중 집계). 테스트 정책과는 일치하나, 원한다면 재풀이를 별도 지표로 분리하는 것도 고려 가능 — 현 상태로도 문제 없음.
2. `aria-live="polite"` 오답 목록에서 재풀이 정답 후 600ms 뒤 카드가 사라지는데, 스크린리더 사용자에게 해소 사실을 알리는 문구가 카드 제거로 함께 사라진다. 별도 상태 메시지 영역 유지를 고려.
3. review 카드에서 질문 미조회(`q` null) 시 정답/해설이 생략되는데, 실 문제은행에는 발생하지 않지만 안내 문구 한 줄을 두면 견고성이 올라간다.
