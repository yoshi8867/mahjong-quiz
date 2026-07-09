/*
 * questions.js — 문제은행 (bot/export.js 가 DB에서 생성한 파일. 직접 수정 금지)
 *
 * 원본은 Neon DB의 questions 테이블이다. 배포 사이트는 /api/questions 로
 * DB에서 직접 읽고, 이 파일은 file:// 폴백용. 스키마 상세는 SCHEMA.md 참조.
 * 전역 노출: window.MahjongQuestions
 */
(function (global) {
  'use strict';

  var QUESTIONS = [
    {
      id: 'd001', type: 'discard', difficulty: 1,
      prompt: '무엇을 버리는 것이 가장 좋을까?',
      hand: '234m567m234p7899s3z', draw: '9s', dora: '1p',
      choices: ['3z', '9s', '7s', '2m'], answer: 0,
      explanation: '3z(서)는 어느 멘쯔에도 붙지 않는 고립 객풍패다. 버리면 7899s가 99s 머리 + 78s로 6-9s 양면 텐파이가 된다. 9s를 버리면 3z 단기 대기로 손해다.'
    },
    {
      id: 'd002', type: 'discard', difficulty: 2,
      prompt: '무엇을 버릴까?',
      hand: '234m678m345p78p22s9s', draw: '8p',
      choices: ['2s', '9s', '7p', '6m'], answer: 1,
      explanation: '9s는 고립된 종패라 발전성이 없다. 버리면 234m·678m·345p 세 멘쯔 + 22s 머리 + 78p로 6-9p 양면 텐파이(핑후 가능)가 된다.'
    },
    {
      id: 'd003', type: 'discard', difficulty: 2,
      prompt: '무엇을 버릴까?',
      hand: '345m567m88m123p46p9s', draw: '6p',
      choices: ['4p', '6p', '9s', '8m'], answer: 2,
      explanation: '지금 남는 패는 고립 9s뿐. 9s를 버리면 46p 간짱(5p) 텐파이. 양면이 없는 형태라 5p 대기를 감수한다. 46p를 깨면 텐파이를 놓친다.'
    },
    {
      id: 'd004', type: 'discard', difficulty: 3,
      prompt: '가장 좋은 텐파이가 되는 타패는?',
      hand: '234m567m234p33s556s', draw: '6s',
      choices: ['6s', '5s', '3s', '2p'], answer: 1,
      explanation: '삭수 556s에서 5s를 버리면 56s 양면(4-7s) 텐파이 + 33s 머리로 핑후가 된다. 6s를 버리면 33s·55s 샨퐁(3s/5s)이라 대기가 좁고, 3s를 버리면 머리가 깨져 텐파이를 놓친다.'
    },
    {
      id: 'd005', type: 'discard', difficulty: 3,
      prompt: '무엇을 버려야 즉시 좋은 텐파이가 될까?',
      hand: '234m567m55p23p4678s', draw: '4s',
      choices: ['2p', '4s', '6s', '5p'], answer: 1,
      explanation: '삭수 4678s에서 4s를 버리면 678s 멘쯔가 완성되고, 234m·567m·678s 세 멘쯔 + 55p 머리 + 23p로 1-4p 양면 텐파이가 된다. 다른 패를 버리면 텐파이를 놓치거나 대기가 좁아진다.'
    },
    {
      id: 'd006', type: 'discard', difficulty: 4,
      prompt: '가장 넓은 대기를 남기는 타패는?',
      hand: '234m34567p234s55s9m', draw: '7p', dora: '2p',
      choices: ['3p', '9m', '7p', '5s'], answer: 1,
      explanation: '통수 34567p는 2-5-8p 삼면 대기 형태다. 고립된 9m을 버리면 234m·234s 두 멘쯔 + 55s 머리 + 34567p 삼면장으로 최고의 텐파이. 통수를 건드리면 대기가 좁아진다.'
    },
    {
      id: 'd007', type: 'discard', difficulty: 4,
      prompt: '대기를 넓히려면 무엇을 버릴까?',
      hand: '234m567m55m234p467s', draw: '7s',
      choices: ['4s', '7s', '5m', '2p'], answer: 0,
      explanation: '삭수 467s에서 4s를 버리면 67s 양면(5-8s) 텐파이. 7s를 버리면 46s 간짱(5s)이 되어 대기가 절반으로 줄어든다. 간짱→양면 승급이 핵심.'
    },
    {
      id: 'd008', type: 'discard', difficulty: 5,
      prompt: '이 손의 최선의 타패는?',
      hand: '23456m789m234p55s1z', draw: '6m',
      choices: ['6m', '1z', '2m', '5s'], answer: 1,
      explanation: '만수 23456m은 1-4-7m 삼면 대기다. 고립 1z를 버리면 789m·234p 멘쯔 + 55s 머리 + 23456m 삼면장으로 핑후 삼면 텐파이. 만수를 깨면 삼면 대기가 무너진다.'
    },
    {
      id: 'r001', type: 'rule', difficulty: 1,
      prompt: '리치 선언 조건으로 옳지 않은 설명은?',
      hand: '',
      choices: ['멘젠(부름 없음)이어야 한다', '텐파이 상태여야 한다', '점수 1000점 이상이어야 한다', '이미 퐁을 했어도 리치할 수 있다'], answer: 3,
      explanation: '리치는 멘젠 텐파이 + 점수 1000점 이상 + 산에 4장 이상 남았을 때만 가능. 한 번이라도 울면(퐁/치/밍깡) 리치할 수 없다.'
    },
    {
      id: 'r002', type: 'rule', difficulty: 2,
      prompt: '45s로 3s·6s 양면 대기다. 내 버림패에 6s가 있다. 상대의 3s로 론할 수 있는가?',
      hand: '234m567m234p45s55p',
      discards: '1p9m7z2p6s3m',
      choices: ['론 불가, 쯔모만 가능', '3s 론 가능', '6s 론 가능', '아무 문제 없음'], answer: 0,
      explanation: '대기패(3s·6s) 중 하나(6s)가 자기 버림패에 있으면 후리텐. 후리텐은 어느 대기패든 론할 수 없고 쯔모로만 화료 가능하다.'
    },
    {
      id: 'r003', type: 'rule', difficulty: 2,
      prompt: '치(슌쯔 부름)에 대한 설명으로 옳은 것은?',
      hand: '',
      choices: ['바로 왼쪽(상가)의 버림패로만 치 가능', '누구의 버림패든 치 가능', '대면의 버림패만 치 가능', '치는 애초에 불가능하다'], answer: 0,
      explanation: '치는 자신의 바로 앞 순번(상가, 왼쪽)이 버린 패로만 가능하다. 퐁·깡은 아무에게서나 가능하지만 치는 방향이 정해져 있다.'
    },
    {
      id: 'r004', type: 'rule', difficulty: 3,
      prompt: '안깡(暗槓)을 했을 때 일어나는 일로 옳은 것은?',
      hand: '',
      choices: ['새 도라 표시패가 즉시 공개되고 영상패를 쯔모한다', '멘젠이 깨져 리치할 수 없게 된다', '점수가 절반이 된다', '아무 일도 일어나지 않는다'], answer: 0,
      explanation: '안깡은 멘젠을 유지한다(리치 후에도 대기가 안 바뀌면 가능). 깡을 하면 새 도라 표시패(깡도라)가 즉시 공개되고 왕패에서 영상패를 가져온다.'
    },
    {
      id: 'r005', type: 'rule', difficulty: 3,
      prompt: '역이 하나도 없는 멘젠 텐파이(리치 안 함)에서 상대 버림패로 론할 수 있는가?',
      hand: '',
      choices: ['역이 없어 론 불가', '언제나 론 가능', '도라가 있으면 론 가능', '무조건 가능'], answer: 0,
      explanation: '화료에는 최소 1역이 필요하다. 도라는 역이 아니므로 도라만으로는 화료할 수 없다. 리치·멘젠쯔모 등 역이 없으면 론 불가(쯔모하면 멘젠쯔모 역이 붙어 화료 가능).'
    },
    {
      id: 'r006', type: 'rule', difficulty: 4,
      prompt: '리치를 선언한 뒤 허용되지 않는 것은?',
      hand: '',
      choices: ['대기(기다림)가 바뀌는 안깡', '쯔모 화료', '론 화료', '쯔모한 패를 그대로 버리기'], answer: 0,
      explanation: '리치 후에는 손을 바꿀 수 없어 쯔모패는 그대로 버린다. 대기가 바뀌지 않는 안깡만 허용되며, 대기가 달라지는 안깡은 금지다.'
    },
    {
      id: 'r007', type: 'rule', difficulty: 5,
      prompt: '상대가 가깡(加槓, 밍깡에 1장 추가)하려는 그 패로 내 손이 완성된다면?',
      hand: '',
      choices: ['창깡(槍槓)으로 론 가능', '어떤 경우에도 불가', '안깡도 창깡 대상이 된다', '점수가 붙지 않는다'], answer: 0,
      explanation: '가깡하려는 패로 화료하면 창깡(槍槓) 1판이 붙어 론할 수 있다. 원칙적으로 안깡은 창깡 대상이 아니다(국사무쌍만 예외).'
    },
    {
      id: 's001', type: 'score', difficulty: 1,
      prompt: '자가(비장) 30부 1판을 론으로 화료했다. 상대가 지불하는 점수는?',
      hand: '',
      choices: ['1000점', '1300점', '1500점', '2000점'], answer: 0,
      explanation: '기본점 = 30 × 2^(2+1) = 240. 자가 론은 ×4 = 960 → 100단위 올림 = 1000점.'
    },
    {
      id: 's002', type: 'score', difficulty: 2,
      prompt: '자가 40부 2판 론. 점수는?',
      hand: '',
      choices: ['2000점', '2600점', '2900점', '3900점'], answer: 1,
      explanation: '기본점 = 40 × 2^(2+2) = 640. 자가 론 ×4 = 2560 → 올림 2600점.'
    },
    {
      id: 's003', type: 'score', difficulty: 3,
      prompt: '장가(딜러) 30부 3판 론. 점수는?',
      hand: '',
      choices: ['4500점', '5200점', '5800점', '7700점'], answer: 2,
      explanation: '기본점 = 30 × 2^(2+3) = 960. 장가 론 ×6 = 5760 → 올림 5800점.'
    },
    {
      id: 's004', type: 'score', difficulty: 3,
      prompt: '자가 만관 쯔모. 각 플레이어의 지불액(자·자·장)은?',
      hand: '',
      choices: ['2000/2000/4000', '2600/2600/5200', '3000/3000/6000', '1500/1500/3000'], answer: 0,
      explanation: '만관 기본점 2000 고정. 자가 쯔모 시 비장은 각 2000, 장가는 4000 지불 → 2000/2000/4000(합 8000).'
    },
    {
      id: 's005', type: 'score', difficulty: 4,
      prompt: '자가 40부 3판 론. 점수는?',
      hand: '',
      choices: ['3900점', '5200점', '6400점', '7700점'], answer: 1,
      explanation: '기본점 = 40 × 2^(2+3) = 1280. 자가 론 ×4 = 5120 → 올림 5200점. (절상 만관을 쓰지 않는 표준 룰 기준.)'
    },
    {
      id: 's006', type: 'score', difficulty: 4,
      prompt: '자가 6판(하네만) 론. 점수는?',
      hand: '',
      choices: ['8000점', '12000점', '16000점', '18000점'], answer: 1,
      explanation: '6~7판은 하네만. 자가 하네만 론은 12000점 고정.'
    },
    {
      id: 's007', type: 'score', difficulty: 5,
      prompt: '장가(딜러) 40부 3판 쯔모. 각 비장이 지불하는 점수는?',
      hand: '',
      choices: ['2600점 올(all)', '2000점 올(all)', '3900점 올(all)', '2300점 올(all)'], answer: 0,
      explanation: '기본점 = 40 × 2^(2+3) = 1280. 장가 쯔모는 세 명이 각 ×2 = 2560 → 올림 2600점씩(2600 올).'
    },
    {
      id: 'y001', type: 'yaku', difficulty: 1,
      prompt: '멘젠으로 화료했다. 성립하는 역은?',
      hand: '234m555m22p345p678s',
      choices: ['탕야오', '핑후', '삼안커', '역패'], answer: 0,
      explanation: '모든 패가 2~8의 수패(자패·1·9 없음)로만 구성 → 탕야오. 555m 커쯔가 있어 핑후는 성립하지 않는다.'
    },
    {
      id: 'y002', type: 'yaku', difficulty: 1,
      prompt: '中을 퐁한 손패다. 성립하는 역은?',
      hand: '234m567m234p55s',
      melds: ['p777z'],
      choices: ['역패(중)', '탕야오', '핑후', '찬타'], answer: 0,
      explanation: '中(7z) 커쯔 = 삼원패 역패 1판. 자패가 있어 탕야오는 아니고, 부른 손이라 핑후도 불가.'
    },
    {
      id: 'y003', type: 'yaku', difficulty: 2,
      prompt: '멘젠·양면 대기로 론 화료(99s는 자패 아닌 삭수 머리). 확정 역은?',
      hand: '123m567m234p456p99s',
      choices: ['핑후', '탕야오', '일기통관', '찬타'], answer: 0,
      explanation: '4멘쯔 모두 슌쯔 + 역패 아닌 머리(99s) + 양면 대기 → 핑후. 1m·9s가 있어 탕야오는 아니다.'
    },
    {
      id: 'y004', type: 'yaku', difficulty: 3,
      prompt: '멘젠 손패에 성립하는 역은?',
      hand: '112233m456p678p55s',
      choices: ['이페코', '삼색동순', '일기통관', '역패'], answer: 0,
      explanation: '112233m = 123m 슌쯔가 두 벌 → 이페코(멘젠 한정 1판). 세 수트 같은 배열(삼색)도, 123-456-789(일기통관)도 아니다.'
    },
    {
      id: 'y005', type: 'yaku', difficulty: 3,
      prompt: '이 손패의 대표 역은?',
      hand: '234m234p234s567m99s',
      choices: ['삼색동순', '일기통관', '이페코', '찬타'], answer: 0,
      explanation: '234가 만·통·삭 세 수트에 모두 있음 → 삼색동순(멘젠 2판).'
    },
    {
      id: 'y006', type: 'yaku', difficulty: 4,
      prompt: '이 손패의 대표 역은?',
      hand: '123456789m234p55s',
      choices: ['일기통관', '삼색동순', '청일색', '이페코'], answer: 0,
      explanation: '만수 123-456-789가 한 수트로 완성 → 일기통관(멘젠 2판). 통수·삭수가 섞여 청일색은 아니다.'
    },
    {
      id: 'y007', type: 'yaku', difficulty: 4,
      prompt: '123s를 치한 손패다. 성립하는 역은?',
      hand: '456s789s234s11z',
      melds: ['c123s'],
      choices: ['혼일색', '청일색', '삼색동순', '치또이쯔'], answer: 0,
      explanation: '삭수 + 자패(東)로만 구성 → 혼일색. 부른 혼일색은 2판. 자패가 있어 청일색은 아니다.'
    },
    {
      id: 'y008', type: 'yaku', difficulty: 5,
      prompt: '이 손패의 대표(최고 판수) 역은?',
      hand: '234p345p678p789p99p',
      choices: ['청일색', '혼일색', '일기통관', '삼색동순'], answer: 0,
      explanation: '모든 패가 통수 한 종류 → 청일색(멘젠 6판). 자패가 없어 혼일색이 아니고, 123-456-789 배열이 아니라 일기통관도 아니다.'
    },
  ];

  global.MahjongQuestions = QUESTIONS;
})(window);
