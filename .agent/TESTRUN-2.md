# M2 테스트 실행 — PASS (통과 12/12)

실행 환경: Playwright(Chromium), 대상 http://localhost:8931 (index.html / quiz.html)
전역 노출 확인: `window.MahjongQuestions`(true), `window.MahjongEngine`(true), `window.MahjongStorage`(true), `window.MahjongTiles`(true).
필터 전달: 쿼리스트링 방식 확정 — 홈 "시작" → `quiz.html?types=<...>&min=<n>&max=<n>`.
localStorage 키: `mjq.wrong`(오답 배열), `mjq.stats`(정오 통계).
콘솔 판정 제외: favicon.ico 404. (실측상 정상 흐름에서 그 외 error 0건.)

- [x] T2.1: 30문제 스키마 준수 — 총 30문제. badType/badDiff/badChoices/badAnswer/badId/badPrompt/badExp 모두 0, 중복 id 0. 위반 id 없음.
- [x] T2.2: 유형×난이도 분포 — 유형 discard 8 / yaku 8 / score 7 / rule 7 (모두 5~10, 0 없음). 난이도 1:5 2:6 3:8 4:7 5:4 (1~5 모두 존재). 교차표 20칸 모두 1개 이상.
- [x] T2.3: hand/dora/choices 파싱 — hand 보유 17문제 전부 예외 없이 파싱(길이>0). 빈 hand 13문제(score/rule)는 `""`로 정상 skip 대상(치명 아님). dora 지정 문제는 정확히 1장 파싱, melds 표기부 파싱 실패 0. 패 표기 보기 32개 파싱 통과, 텍스트 보기 88개는 파싱 실패=순수 텍스트 렌더 대상(정상).
- [x] T2.4: 홈 필터→시작→반영 — rule 단독 + 난이도 4~5 설정(홈 pool-count 2). 시작 후 URL `quiz.html?types=rule&min=4&max=5`. 다음 12회 포함 13회 출제 전부 type=rule, difficulty∈{4,5} (위반 0). 후보 2개(r006/r007) 교대 출제.
- [x] T2.5: 스프라이트 렌더 — discard 문제에서 손패 14장·보기 4개가 `.tile--sprite`로 렌더, `backgroundImage`가 tiles.png 참조. 표본 타일 6종 background-position이 `spriteIndex` 공식(col/8×100%, row/4×100%)과 100% 일치(예 3m→25% 0%, 5m→50% 0%). dora 지정 문제(d001) 도라 1장 1p→"0% 25%" 일치. `.tile--unicode` 0건(유니코드/두부 렌더 없음).
- [x] T2.6: 정답 클릭 — y008(answer=0) 정답 클릭 즉시 정답 보기 `is-correct` + 그린(rgb(31,122,68)) 강조, 해설 영역 표시("정답입니다" + explanation), 페이지 이동 없음. 오답목록에 y008 미기록.
- [x] T2.7: 오답 클릭 — s001(answer=0)에서 index1 오답 클릭 → 오답 보기 레드(rgb(192,57,43)) + 실제 정답 보기 그린 동시 강조, 해설 표시, 전 보기 disabled. 판정 후 다른 보기 추가 클릭 시 stats/오답 기록 불변(중복 제출 방지 확인).
- [x] T2.8: 오답 localStorage 기록 — 오답 후 `mjq.wrong`에 {id:s001,type,difficulty,prompt,ts} 저장(유효 JSON). `mjq.stats`도 유효 JSON. 정답만 맞힌 y008은 오답목록에 없음.
- [x] T2.9: 연속 출제·직전 중복 회피 — 다음 30회 클릭(총 31문제) 매회 prompt 변경(30/30), 연속 동일 id 0회, 고유 id 19종. 출제 고정 없음.
- [x] T2.10: 필터 0문제 처리 — 데이터상 모든 (유형×난이도) 셀이 1개 이상이라 단일 조합 공집합은 없음. (a) 홈에서 전체 유형 해제 시 pool-count=0, 시작 버튼 disabled + 경고문 노출(시작 차단). (b) quiz.html에 공집합 쿼리(types=zzz) 직접 진입 시 "조건에 맞는 문제가 없습니다" 빈 상태 표시, 문제 패널 숨김, 콘솔 error 0건, 크래시 없음.
- [x] T2.11: localStorage 없음/오염/지속 — (a) `clear()` 후 로드 → 정상 출제(문제·보기4), stats 기본값 `{type:{},diff:{}}`. (b) `mjq.wrong`='{broken JSON', `mjq.stats`='123' 주입 후 재로드 → 방어적 기본값 복구, 정상 출제, 콘솔 error 0건. (c) 오답 1건(d008) 기록 후 재로드 → 오답목록 [d008] 유지, stats 데이터 유지. 종료 시 `clear()`로 정리.
- [x] T2.12: 콘솔 error 0 + 반응형 — index.html/quiz.html 정상 흐름(시작→표시→정답클릭→다음)에서 콘솔 error 0건(favicon 제외). 375×812: 가로 오버플로 없음(scrollWidth 360≤375), 손패 14장·보기 4개 뷰포트 밖 잘림 0, 보기 세로 1열 재배치. 1280×800: 가로 오버플로 없음, 중앙 컬럼 폭 688px(left296~right984 중앙 정렬), 잘림·겹침 없음. 스크린샷 quiz-375.png / quiz-1280.png 확인.

## 총평
판정: **PASS (12/12)**. M2 수용기준(문제은행 스키마·고른 분포, 홈 필터→쿼리 전달 및 반영, 스프라이트 렌더, 즉시 정오+해설, 오답 localStorage 기록, 연속 출제·직전 회피, 0문제/오염 방어)을 모두 충족. 정상 흐름 콘솔 error 0건, 두 뷰포트 레이아웃 정상.
