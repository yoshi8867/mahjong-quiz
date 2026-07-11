# bot/LOOP.md — 문제은행 자율 관리 루프 (에이전트 실행 지침)

이 문서는 주기적으로(매일 자정) 실행되는 에이전트의 작업 절차다.
에이전트는 리치마작 이론에 정통해야 하며, 확신이 없는 내용은 만들지도 고치지도 않는다.

## 전제
- DB 원본: Neon Postgres (`DATABASE_URL` — 로컬은 저장소 루트 `.env`, 절대 커밋 금지)
- 테이블: `questions`(문제은행), `reports`(이의 제기), `bot_runs`(실행 이력) — 정의는 `bot/schema.sql`
- 배포 사이트는 `/api/questions`로 DB에서 직접 읽는다. `site/js/questions.js`는 file:// 폴백.
- 문제 스키마·패 표기법: `site/SCHEMA.md`
  (id는 유형접두어 + 일련번호 — discard=d, yaku=y, score=s, rule=r, call=c, furiten=f, defense=b, wait=w)
- DB 접근: 항상 `bot/db.js`의 `createDb()`를 쓴다 (`await db.query(text, params)` → `{rows}`).
  - 기본은 pg(raw TCP 5432). **클라우드 샌드박스는 5432 egress가 막혀 있으므로 `NEON_HTTP=1`을
    export 하고 실행할 것** — HTTPS(443) 기반 `@neondatabase/serverless`로 전환된다.
  - ad-hoc SQL도 psql/psycopg 등 raw TCP 클라이언트 대신 `node -e`로 `bot/db.js`를 경유할 것.
    예: `NEON_HTTP=1 node -e "require('./bot/db').createDb().query('select 1').then(r=>console.log(r.rows))"`

## 실행 절차

### 0. 시작 기록
`INSERT INTO bot_runs DEFAULT VALUES RETURNING id` — 이 run_id로 마지막에 결과를 남긴다.

### 1. 이의 제기 처리 (`reports.status = 'pending'` 전부)
각 report에 대해:
1. 해당 문제를 DB에서 읽고, 이의 내용을 마작 이론으로 재검증한다.
   - 何切る(discard): 우케이레 수(대기 매수)를 실제로 계산해 비교. 점수: 부수×2^(2+판수) 공식 검산.
   - 역/룰: 표준 리치마작 룰(절상 만관 없음 기준) 근거로 판단.
2. **이의가 타당하면**: `questions`를 UPDATE로 수정(정답·보기·해설·hand 등).
   수정 후 반드시 `node bot/validate.js`로 기계 검증 통과 확인.
   `UPDATE reports SET status='accepted', resolution='<무엇을 어떻게 고쳤는지>', resolved_at=now()`.
3. **이의가 틀렸으면**: 문제는 그대로 두고
   `UPDATE reports SET status='rejected', resolution='<왜 원래 문제가 맞는지 근거>', resolved_at=now()`.
4. **판단 불가(이론적으로 애매/룰 편차)**: rejected 처리하되 resolution에
   "룰 편차 사안 — 사람 검토 필요: <쟁점>" 형태로 남긴다.

### 2. 신규 문제 3개 생성
1. 현재 분포 조회: `SELECT type, difficulty, count(*) FROM questions WHERE status='active' GROUP BY 1,2`.
2. **가장 부족한 (유형×난이도) 칸부터** 채우는 방향으로 3문제를 만든다. 같은 유형만 3개 몰지 말 것.
3. 작성 규칙:
   - id: 해당 유형의 다음 일련번호 (예: d009). `SELECT max(id) FROM questions WHERE type='discard'`.
   - discard: hand 14장(+draw 지정, melds 있으면 세트당 -3), 정답이 우케이레 계산상 **명확히 단독 우위**인 손만.
     보기 4개는 전부 hand에 있는 패 표기, choices[answer]가 정답 패.
   - yaku: 성립 역이 논쟁 없이 확정되는 완성형. score: 공식 검산 필수. rule: 표준 룰 기준.
   - call: hand 13장 + `offered`(상대 버림패 1장) 필수. 퐁/치/스루 판단 — 정답이 이론상 명확한 상황만
     (역 소멸 여부, 쿠이탕, 역패·도라 퐁, 속도 vs 타점). choices는 텍스트.
   - furiten: 텐파이 hand 13장 + `discards`(**내** 버림패 강) 필수. 대기 전체를 실제로 나열해
     강과 대조한 뒤 출제. choices는 텍스트.
   - defense: hand 14장 + draw 필수 + `discards`(**상대 리치자의** 강) 필수. 겐부츠/스지/자패 안전도
     기준으로 정답 패가 명확히 최선인 상황만. 보기 4개는 hand의 패 표기, choices[answer]가 정답 패.
   - wait: 텐파이 hand 13장. 대기패를 **전부 손으로 나열·검산**한 뒤 choices에 "3s·6s·9s" 같은
     가운뎃점 구분 텍스트로. 오답 보기는 그럴듯한 부분집합/초과집합으로.
   - 기존 문제와 중복(같은 손패/같은 논점) 금지: `SELECT hand, prompt FROM questions WHERE type=...`로 대조.
   - 해설은 "왜 정답인지 + 왜 오답들이 아닌지"를 2~3문장으로.
4. INSERT 후 `node bot/validate.js` 실행 — FAIL이면 해당 문제를 고치거나 DELETE 후 다시 만든다.
   **검증 실패 상태로 루프를 끝내지 말 것.**

### 3. 정적 폴백 동기화 (저장소 접근 가능할 때만)
`node bot/export.js` → `site/js/questions.js` 재생성 → 변경 있으면 커밋·푸시.
커밋 메시지: `bot: 문제 N개 추가, 이의 M건 처리 (run #<id>)`.
저장소 접근이 불가한 환경이면 생략 — 배포 사이트는 DB에서 직접 읽으므로 사이트는 이미 최신이다.

### 4. 종료 기록
`UPDATE bot_runs SET finished_at=now(), reports_done=<처리 수>, questions_added=<추가 수>, note='<요약>' WHERE id=<run_id>`.

## 금지 사항
- `.env`/커넥션 스트링을 어떤 파일에도 커밋하지 않는다.
- 확신 없는 마작 이론으로 문제를 만들거나 고치지 않는다 (만들 수 없으면 그 회차는 적게 만들고 note에 사유).
- `questions.js`를 손으로 수정하지 않는다 (항상 export.js 경유).
- reports를 삭제하지 않는다 (상태 변경만).
