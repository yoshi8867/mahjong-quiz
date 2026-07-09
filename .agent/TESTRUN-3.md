# M3 테스트 실행 — PASS (통과 14/14)

실행 환경: http://localhost:8931/ (index/quiz/review/stats.html), Playwright 브라우저.
favicon.ico 404는 판정 제외. 그 외 각 페이지 로드·조작 중 콘솔 에러 0건 확인.

- [x] T3.1: 오답 발생 → review 목록 표시 — quiz.html?types=discard&min=1&max=1에서 d001 9s(오답) 클릭 후 review에 카드 1건. 지문/내가 고른 답(9s)/정답(3z)/해설 + 유형(타패)·난이도1 모두 표시.
- [x] T3.2: 오답 0건 빈 상태 — "오답이 없습니다..." 안내와 퀴즈/홈 링크 노출, 에러 0건.
- [x] T3.3: 중복 오답 목록 중복 없음 — addWrong 2회 후 getWrong().length===1, 카드 1건. ts2>=ts1(동일값, 갱신 성립).
- [x] T3.4: 재풀이 정답 시 해소 — 인라인 재풀이에서 3z(정답) 클릭 → 카드 제거(0건), getWrong에 d001 없음, discard 통계 total1/correct1, 빈 상태 노출.
- [x] T3.5: 재풀이 오답 시 유지 — 9s(오답) 클릭 → 카드 1건 유지, d001 여전히 존재, discard total1/correct0(정답 미증가).
- [x] T3.6: stats 유형·난이도 정답률 일치 — discard 3/4 75%, yaku 1/2 50%, rule 2/5 40%, score 0/0 "-", 난이도1 2/2 100%, 난이도3 1/4 25%. 전체 6/11 55%. DOM 텍스트 대조 정확 일치.
- [x] T3.7: stats 0건 방어 — 모든 셀 "-", overall "아직 기록이 없습니다.", NaN/Infinity 없음, 에러 0건.
- [x] T3.8: 홈 통계 요약 — 전체 정답률 58%(7/12), 오답 1건, 가장 약한 유형 "룰 판단"(33%). 요약 내 review.html·stats.html 링크 클릭 시 각 페이지 정상 로드(404 아님).
- [x] T3.9: 적응형 쏠림 — mjq.stats 주입 후 pool(30) 2000회 pickWeighted: rule 913(0.457≥0.40), discard0.198/yaku0.176/score0.170. rule 비율이 타 유형 모두보다 뚜렷이 큼(이론 0.477 근접).
- [x] T3.10: 통계 없을 때 균등 — typeWeights 모두 1. 2000회 샘플 비율 discard0.251/yaku0.281/score0.236/rule0.233, 개수비(0.27/0.27/0.23/0.23) ±0.06 이내.
- [x] T3.11: 새로고침·재방문 후 유지 — SEED 후 review 1건, 재로드·stats 이동·홈 경유 재방문에도 오답1건·discard total1/correct0 유지.
- [x] T3.12: 오염 데이터 방어 — (a)깨진 JSON→빈 목록·배열반환, (b)[null,123,{id:'d001'}]→유효 1건만 카드 렌더·크래시 없음, (c)stats 배열→{type:{},diff:{}}로 복구, (d){type:'bad',diff:null}→type {}로 복구. 모두 에러 0건·NaN 없음.
- [x] T3.13: 레이아웃 무붕괴 — 375px/1280px 모두 review·stats 가로 오버플로 없음(scrollW==clientW). prompt 300자 카드 줄바꿈되어 카드/뷰포트 밖 넘침 없음.
- [x] T3.14: 내비게이션 링크 대상 존재 — index/review/stats/showcase/quiz 모두 HTTP 200. review→통계→쇼케이스 클릭 이동 정상(에러 0건), 뒤로가기로 stats.html 정상 복원.

## 총평
판정: PASS. 14개 케이스 전부 통과. 오답 노트(목록/재풀이 해소·유지), 통계(유형·난이도·전체 정답률, 방어), 홈 요약, 적응형 가중 출제, 지속성, 오염 방어, 반응형 레이아웃, 내비게이션이 모두 기대대로 동작. favicon 404 외 콘솔 에러 없음.
