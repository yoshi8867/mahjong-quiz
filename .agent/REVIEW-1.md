# M1 리뷰 — PASS

## 수용 기준
- [x] 34종 타일이 유니코드/CSS 두 줄로 나란히 비교 — showcase.html:100-102가 `123456789m123456789p123456789s1234567z`(9+9+9+7=34)를 `row-unicode`/`row-css`에 각각 렌더, 같은 순서 대응.
- [x] 90도 회전 퐁/치 세트 + 6장씩 버림패 강, 회전 비율 유지 — `renderMeld`(tiles.js:195, rotatedIndex 1장 회전) + `.tile-rot`(styles.css:184-195)가 폭=`--tile-h`/높이=`--tile-w`로 눕힌 자리를 확보(겹침 방지). 강은 `.pond` 6열 그리드(styles.css:229-234)로 6+6+1 줄바꿈.
- [x] 손패 13 + 쯔모 1(간격 분리) + 도라 표시패 — showcase.html:124 `123456m789p1122s`(13장) + `tsumo:'3s'`, `.hand .tsumo{margin-left:var(--space-5)}`(styles.css:216-218)로 분리. dora-sample 별도 구역.
- [x] 적도라 빨간5 구분 — `50m50p50s`로 일반5/적5 병치(showcase.html:105-107), `is-aka`→`--color-accent`가 CSS·유니코드 방식 모두 적용(styles.css:162-164,178).

## 결함
없음 (FAIL 사유 없음).

지정 확인 항목 검증 결과:
- 자패 매핑: `HONOR_CP`(tiles.js:26-29) 5z=U+1F006, 6z=U+1F005, 7z=U+1F004 — 순서 역전 정확. 수패도 m=1F007+, s=1F010+, p=1F019+ 정확(tiles.js:98-100).
- 파서 방어: ""→[](tiles.js:68), null/undefined·8z/9z/0z·"123"·"m123"·"12x3m"·"1.5m"·"!!" 전부 throw로 일관 방어(tiles.js:38-49,77,85,88). 잘못된 타일 생성 없음. 호출부 try/catch(showcase.html:98,126)로 페이지 로드 보호.
- 회전 자리: 세로/가로 비율 뒤바꿔 자리 확보 → 겹침 없음(위 기준2).
- 티어: 프레임워크·빌드 도구 없음. 바닐라 JS 전역 노출만.

## 권고 (선택 반영)
- Pretendard 웹폰트 CDN(showcase.html:7-11)은 PLAN(시스템 산세리프 스택 명시)에 없는 외부 의존 추가. 시스템 폰트로 폴백되긴 하나, 계획 범위상 제거하거나 정당화 여부 검토 권장.
- 토큰 규율 일부 이탈: `showcase-section` border-radius 10px·box-shadow 하드코딩, `.dora-indicator`/`.felt-panel` radius 8px, `.meld` gap 2px, `.tile-suit` margin-top 1px 등 간격·치수 리터럴이 남음. "하드코딩 금지" 원칙상 토큰화 여지.
- 렌더 전체를 단일 try/catch(showcase.html:98-128)로 감싸 한 섹션 실패 시 이후 섹션까지 중단됨. 섹션별 try/catch로 격리하면 데모 견고성 향상(현재 입력은 모두 유효해 실동작 문제는 없음).
