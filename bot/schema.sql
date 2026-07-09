-- 마작 학습 사이트: 문제은행 + 이의 제기 스키마
-- 원본(source of truth)은 DB. site/js/questions.js 는 export 산출물.

CREATE TABLE IF NOT EXISTS questions (
  id          text PRIMARY KEY,              -- 'd001' 등 (유형접두어+일련번호)
  type        text NOT NULL CHECK (type IN ('discard','yaku','score','rule')),
  difficulty  int  NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  prompt      text NOT NULL,
  hand        text,                          -- '234m567m234p33s556s' 표기 (rule 문제는 없을 수 있음)
  draw        text,                          -- 쯔모패 표기 (discard 전용, 선택)
  dora        text,                          -- 도라 표시패 (선택)
  melds       jsonb,                         -- ["p555m","c123s"] (선택)
  discards    text,                          -- 버림패 강 (선택)
  choices     jsonb NOT NULL,                -- 보기 4개 배열
  answer      int  NOT NULL CHECK (answer BETWEEN 0 AND 3),
  explanation text NOT NULL,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired','draft')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id text NOT NULL REFERENCES questions(id),
  content     text NOT NULL,                 -- 사용자가 쓴 이의 내용
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','accepted','rejected')),
  resolution  text,                          -- 에이전트의 처리 결과 노트
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- 에이전트 루프 실행 이력 (관측용)
CREATE TABLE IF NOT EXISTS bot_runs (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  reports_done int DEFAULT 0,
  questions_added int DEFAULT 0,
  note         text
);
