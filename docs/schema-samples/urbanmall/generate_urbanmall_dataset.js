/**
 * UrbanMall(어반몰) 샘플 데이터셋 생성기 — 교육/데모용
 * ---------------------------------------------------------------
 * ※ 프로그램이 생성한 100% 가상 데이터입니다. 실존 기업·인물과 무관합니다.
 * ※ 이메일은 IANA 예약 도메인(example.com/net/org), 휴대폰은 미할당 국번(010-0000-xxxx)만
 *    사용합니다 — 실수로 실제 발송이 나가도 외부에 도달하지 않습니다.
 * ---------------------------------------------------------------
 * 일반 이커머스(패션 쇼핑몰) 5개 테이블 CSV 생성 (SFMC UI에서 RAW DE로 직접 import)
 *   1) MEMBER_INFO  회원        (3,000 — 상단 N_MEMBER 로 조정)
 *   2) ITEM_MST     상품
 *   3) ORDER_MST    주문
 *   4) ORDER_ITEM   주문상세
 *   5) COUPON_ISSUE 쿠폰 발급
 *
 * 스키마 출처: docs/onboarding-kit/작성예시_어반몰/ERD_urbanmall.svg 와 완전 동일
 * 실행: node generate_urbanmall_dataset.js
 * 출력: 이 파일과 같은 폴더에 *.csv (UTF-8, no BOM)
 */

const fs = require('fs');
const path = require('path');

// ── 재현 가능한 난수 (LCG) ────────────────────────────────────────
let _seed = 20260904;
function rnd() {
  _seed = (_seed * 1664525 + 1013904223) % 4294967296;
  return _seed / 4294967296;
}
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
function wpick(pairs) {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = rnd() * total;
  for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
  return pairs[pairs.length - 1][0];
}

// ── 날짜 유틸 ────────────────────────────────────────────────────
const TODAY = new Date(Date.UTC(2026, 8, 4));               // 2026-09-04 (기준일)
const DAY = 86400000;
const d2s = (d) => d.toISOString().slice(0, 10);
const d2dt = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const addD = (d, n) => new Date(d.getTime() + n * DAY);
const daysBetween = (a, b) => Math.round((b - a) / DAY);
function randDate(from, to) { return addD(from, ri(0, Math.max(0, daysBetween(from, to)))); }
function randDateSkewRecent(from, to) {          // 최근일수록 확률 ↑
  const span = Math.max(1, daysBetween(from, to));
  return addD(from, Math.round(span * Math.pow(rnd(), 0.55)));
}
function withTime(d) {                            // 쇼핑 시간대 분포 반영
  const h = wpick([[9, 4], [10, 6], [11, 7], [12, 7], [13, 6], [14, 7], [15, 7], [16, 6],
                   [17, 6], [18, 7], [19, 9], [20, 12], [21, 13], [22, 10], [23, 6], [0, 4], [8, 3]]);
  return new Date(d.getTime() + h * 3600000 + ri(0, 59) * 60000 + ri(0, 59) * 1000);
}

// ── 지역 (ADDR_CITY) ─────────────────────────────────────────────
const CITY = [['서울', 210], ['경기', 250], ['인천', 58], ['부산', 66], ['대구', 47], ['대전', 30], ['광주', 29],
              ['울산', 22], ['세종', 8], ['강원', 28], ['충북', 30], ['충남', 40], ['전북', 32], ['전남', 33],
              ['경북', 48], ['경남', 60], ['제주', 13]];
const EMAIL_DOMAIN = [['example.com', 55], ['example.net', 28], ['example.org', 17]];

// ── 1) 상품 마스터 (ITEM_MST) ────────────────────────────────────
// CAT_NM 코드값은 ERD 고정: 상의 / 하의 / 아우터 / 신발 / 액세서리
const CATALOG = [
  ['상의', 'TS', 19000, 89000, 34, [
    '베이직 코튼 티셔츠', '오버핏 반팔 티셔츠', '스트라이프 긴팔 티셔츠', '피케 카라 티셔츠', '크롭 슬리브리스',
    '루즈핏 맨투맨', '기모 후드 스웨트셔츠', '립 니트 풀오버', '케이블 니트 가디건', '옥스퍼드 셔츠',
    '린넨 오버셔츠', '실크 블라우스', '하프집 니트', '그래픽 프린팅 티셔츠', '터틀넥 이너', '슬럽 라운드 티셔츠',
    '와플 조직 롱슬리브', '빈티지 워싱 티셔츠', '캐시미어 혼방 니트', '브이넥 베이직 니트']],
  ['하의', 'BT', 29000, 129000, 26, [
    '와이드 데님 팬츠', '슬림핏 청바지', '스트레이트 워싱 데님', '테이퍼드 슬랙스', '와이드 슬랙스',
    '코튼 치노 팬츠', '카고 조거 팬츠', '트레이닝 스웨트 팬츠', '플리츠 롱스커트', '데님 미니스커트',
    '린넨 밴딩 팬츠', '코듀로이 팬츠', '하이웨스트 밴딩 슬랙스', '숏 데님 팬츠', '점프수트']],
  ['아우터', 'OT', 79000, 399000, 14, [
    '오버핏 블레이저', '싱글 코트', '핸드메이드 울 코트', '트렌치 코트', '숏 패딩 점퍼', '롱 구스다운 패딩',
    '무스탕 자켓', '레더 라이더 자켓', '바람막이 아노락', '플리스 집업', '데님 트러커 자켓', '퀼팅 베스트',
    '더플 코트', '가디건형 자켓']],
  ['신발', 'SH', 49000, 249000, 16, [
    '레더 스니커즈', '캔버스 스니커즈', '청키 러닝화', '로퍼', '첼시 부츠', '앵클 워커', '더비 슈즈',
    '슬립온', '스트랩 샌들', '뮬 슬리퍼', '발레리나 플랫', '하이탑 스니커즈', '트레킹 스니커즈', '패딩 부츠']],
  ['액세서리', 'AC', 9000, 89000, 10, [
    '레더 크로스백', '캔버스 에코백', '미니 숄더백', '더플 백팩', '가죽 카드지갑', '반지갑',
    '니트 머플러', '캐시미어 스카프', '볼캡', '버킷햇', '비니', '레더 벨트', '실버 체인 목걸이',
    '데일리 이어링', '메탈 시계', '울 장갑', '양말 3종 세트', '선글라스']]
];
const COLORWAY = ['블랙', '아이보리', '차콜', '네이비', '베이지', '브라운', '카키', '그레이', '화이트', '버건디'];

const items = [];
for (const [cat, prefix, minP, maxP, , names] of CATALOG) {
  let seq = 0;
  for (const nm of names) {
    const nColor = wpick([[1, 40], [2, 38], [3, 22]]);
    const colors = [];
    while (colors.length < nColor) { const c = pick(COLORWAY); if (!colors.includes(c)) colors.push(c); }
    for (const c of colors) {
      seq++;
      const price = Math.round((minP + (maxP - minP) * Math.pow(rnd(), 0.8)) / 1000) * 1000;
      items.push({
        ITEM_CD: `UM-${prefix}-${String(seq).padStart(3, '0')}`,
        ITEM_NM: `${nm} (${c})`,
        CAT_NM: cat,
        SELL_PRC: price
      });
    }
  }
}
const byCat = {};
for (const it of items) (byCat[it.CAT_NM] ||= []).push(it);
const CAT_W = [['상의', 34], ['하의', 24], ['아우터', 13], ['신발', 16], ['액세서리', 13]];
const pickItem = () => pick(byCat[wpick(CAT_W)]);

// ── 2) 회원 (MEMBER_INFO) ────────────────────────────────────────
const N_MEMBER = 3000;
const START = new Date(Date.UTC(2022, 0, 1));
const GRADE_BY_SPEND = (amt) => amt >= 2000000 ? 'VIP' : amt >= 600000 ? 'GOLD' : 'BASIC';

const members = [];
for (let i = 1; i <= N_MEMBER; i++) {
  const mbrId = 20000 + i;                                  // BIGINT, 작성예시(20001~)와 연속
  const birth = new Date(Date.UTC(ri(1968, 2008), ri(0, 11), ri(1, 28)));
  const reg = randDateSkewRecent(START, addD(TODAY, -1));
  // 활동성 페르소나 — 진단이 의미를 갖도록 약점 구간을 의도적으로 배분
  const persona = wpick([['DORMANT', 22], ['LIGHT', 34], ['REGULAR', 26], ['HEAVY', 13], ['NEW', 5]]);
  members.push({
    MBR_ID: mbrId,
    MBR_EMAIL: `um${String(i).padStart(5, '0')}@${wpick(EMAIL_DOMAIN)}`,
    HP_NO: `010-0000-${String(i).padStart(4, '0')}`,         // 미할당 국번(발송 불가) — 의도적
    BIRTH_YMD: d2s(birth),
    MBR_GRD: 'BASIC',                                        // 주문 생성 후 재계산
    ADDR_CITY: wpick(CITY),
    REG_DTM: d2dt(withTime(reg)),
    LST_LOGIN_DTM: '',
    EML_AGREE_YN: chance(0.62) ? 'Y' : 'N',
    SMS_AGREE_YN: chance(0.55) ? 'Y' : 'N',
    BASKET_YN: 'N',
    BASKET_AMT: 0,
    MILEAGE: 0,
    MILEAGE_EXP_YMD: '',
    _persona: persona, _reg: reg
  });
}

// ── 3) 주문 / 주문상세 (ORDER_MST / ORDER_ITEM) ──────────────────
const ORD_CNT_BY_PERSONA = {
  NEW:     [[0, 50], [1, 38], [2, 12]],
  DORMANT: [[0, 28], [1, 38], [2, 22], [3, 12]],
  LIGHT:   [[1, 48], [2, 30], [3, 15], [4, 7]],
  REGULAR: [[3, 25], [4, 25], [5, 20], [6, 15], [7, 10], [8, 5]],
  HEAVY:   [[8, 24], [10, 22], [12, 19], [14, 15], [16, 11], [18, 6], [20, 3]]
};

const orders = [], orderItems = [];
let ordSeq = 0, itemSeq = 0;
for (const m of members) {
  const n = wpick(ORD_CNT_BY_PERSONA[m._persona]);
  if (n === 0) continue;
  // 휴면 페르소나는 주문일을 과거 구간에 몰아넣어 "최근구매 365일+"를 만든다
  const upper = m._persona === 'DORMANT'
    ? addD(TODAY, -ri(400, 1100))
    : (m._persona === 'NEW' ? addD(TODAY, -ri(1, 80)) : addD(TODAY, -1));
  const lo = m._reg;
  const hi = upper > lo ? upper : addD(lo, 3);
  for (let k = 0; k < n; k++) {
    const od = withTime(m._persona === 'DORMANT' ? randDate(lo, hi) : randDateSkewRecent(lo, hi));
    if (od > TODAY) continue;
    ordSeq++;
    const orderId = 'U' + d2s(od).slice(2).replace(/-/g, '') + '-' + String(100000 + ordSeq).slice(1);
    const nLine = wpick([[1, 46], [2, 30], [3, 15], [4, 6], [5, 3]]);
    const lines = [];
    let gross = 0;
    for (let j = 0; j < nLine; j++) {
      const it = pickItem();
      const qty = wpick([[1, 84], [2, 12], [3, 4]]);
      const unit = Math.round(it.SELL_PRC * (0.7 + rnd() * 0.3) / 100) * 100;   // 시즌 할인 반영
      gross += unit * qty;
      lines.push({ it, qty, unit });
    }
    const dcRate = wpick([[0, 42], [0.03, 18], [0.05, 17], [0.08, 12], [0.12, 8], [0.2, 3]]);
    const payAmt = gross - Math.round(gross * dcRate / 100) * 100;
    const status = wpick([['COMPLETE', 88], ['CANCELED', 7], ['RETURNED', 5]]);
    orders.push({
      ORDER_ID: orderId,
      MBR_ID: m.MBR_ID,
      ORDER_DTM: d2dt(od),
      PAY_AMT: payAmt,
      ORDER_STATUS: status,
      _dt: od, _mbr: m
    });
    for (const l of lines) {
      itemSeq++;
      orderItems.push({
        ORDER_ITEM_SEQ: itemSeq,
        ORDER_ID: orderId,
        ITEM_CD: l.it.ITEM_CD,
        ORD_QTY: l.qty,
        UNIT_PRC: l.unit
      });
    }
  }
}

// ── 4) 회원 누적 실적 → 등급 / 마일리지 / 장바구니 / 최근접속 보정 ──
const spendBy = {}, lastOrdBy = {};
for (const o of orders) {
  if (o.ORDER_STATUS !== 'COMPLETE') continue;              // 취소·반품은 실적에서 제외
  spendBy[o.MBR_ID] = (spendBy[o.MBR_ID] || 0) + o.PAY_AMT;
  if (!lastOrdBy[o.MBR_ID] || o._dt > lastOrdBy[o.MBR_ID]) lastOrdBy[o.MBR_ID] = o._dt;
}
for (const m of members) {
  const spend = spendBy[m.MBR_ID] || 0;
  m.MBR_GRD = GRADE_BY_SPEND(spend);
  m.MILEAGE = Math.round(spend * 0.01 / 10) * 10 + (chance(0.3) ? ri(0, 5000) : 0);
  if (m.MILEAGE > 0) m.MILEAGE_EXP_YMD = d2s(addD(TODAY, ri(-20, 400)));   // 일부는 이미 만료
  const last = lastOrdBy[m.MBR_ID];
  const base = last && last > m._reg ? last : m._reg;
  const login = m._persona === 'DORMANT'
    ? randDate(base, addD(TODAY, -ri(180, 700)))
    : randDateSkewRecent(base, addD(TODAY, -1));
  m.LST_LOGIN_DTM = d2dt(withTime(login > TODAY ? addD(TODAY, -1) : login));
  // 장바구니 담기만 하고 미구매
  if (chance(m._persona === 'DORMANT' ? 0.08 : 0.20)) {
    const nLine = wpick([[1, 58], [2, 28], [3, 14]]);
    let amt = 0;
    for (let j = 0; j < nLine; j++) amt += pickItem().SELL_PRC * wpick([[1, 88], [2, 12]]);
    m.BASKET_YN = 'Y';
    m.BASKET_AMT = Math.round(amt / 100) * 100;
  }
}

// ── 5) 쿠폰 발급 (COUPON_ISSUE) ──────────────────────────────────
const coupons = [];
let cpnSeq = 0;
for (const m of members) {
  const n = wpick([[0, 22], [1, 26], [2, 22], [3, 15], [4, 9], [5, 6]]);
  for (let k = 0; k < n; k++) {
    const iss = randDateSkewRecent(m._reg, addD(TODAY, -1));
    const exp = addD(iss, wpick([[14, 18], [30, 40], [60, 24], [90, 18]]));
    const expired = exp < TODAY;
    // 만료된 쿠폰은 사용률이 높게(이미 결판남), 유효 쿠폰은 미사용이 많이 남도록
    const used = expired ? chance(0.42) : chance(0.18);
    cpnSeq++;
    coupons.push({
      COUPON_ID: 'CP-' + d2s(iss).slice(2, 7).replace('-', '') + '-' + String(10000 + cpnSeq).slice(1),
      MBR_ID: m.MBR_ID,
      ISSUE_YMD: d2s(iss),
      EXPIRE_YMD: d2s(exp),
      USED_YN: used ? 'Y' : 'N'
    });
  }
}

// ── CSV 출력 ─────────────────────────────────────────────────────
function toCsv(rows, cols) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const out = [cols.join(',')];
  for (const r of rows) out.push(cols.map(c => esc(r[c])).join(','));
  return out.join('\n') + '\n';
}
function write(file, rows, cols) {
  fs.writeFileSync(path.join(__dirname, file), toCsv(rows, cols), 'utf8');
  console.log(`${file.padEnd(18)} ${String(rows.length).padStart(7)} rows  (${cols.length} cols)`);
}

write('MEMBER_INFO.csv', members, ['MBR_ID', 'MBR_EMAIL', 'HP_NO', 'BIRTH_YMD', 'MBR_GRD', 'ADDR_CITY',
  'REG_DTM', 'LST_LOGIN_DTM', 'EML_AGREE_YN', 'SMS_AGREE_YN', 'BASKET_YN', 'BASKET_AMT', 'MILEAGE', 'MILEAGE_EXP_YMD']);
write('ITEM_MST.csv', items, ['ITEM_CD', 'ITEM_NM', 'CAT_NM', 'SELL_PRC']);
write('ORDER_MST.csv', orders, ['ORDER_ID', 'MBR_ID', 'ORDER_DTM', 'PAY_AMT', 'ORDER_STATUS']);
write('ORDER_ITEM.csv', orderItems, ['ORDER_ITEM_SEQ', 'ORDER_ID', 'ITEM_CD', 'ORD_QTY', 'UNIT_PRC']);
write('COUPON_ISSUE.csv', coupons, ['COUPON_ID', 'MBR_ID', 'ISSUE_YMD', 'EXPIRE_YMD', 'USED_YN']);

// ── 요약 통계 (STEP 1 진단 기대값) ───────────────────────────────
const cnt = (arr, f) => arr.filter(f).length;
const pct = (n) => `${n.toLocaleString()} (${(n / N_MEMBER * 100).toFixed(1)}%)`;
const validCoupon = coupons.filter(c => c.USED_YN === 'N' && new Date(c.EXPIRE_YMD + 'T00:00:00Z') >= TODAY);
console.log('\n[세그먼트 요약 — 기준일 ' + d2s(TODAY) + ', 모수 ' + N_MEMBER.toLocaleString() + '명]');
console.log('  가입 90일 이내 신규      :', pct(cnt(members, m => daysBetween(m._reg, TODAY) <= 90)));
console.log('  구매 이력 없음           :', pct(cnt(members, m => !spendBy[m.MBR_ID])));
console.log('  1회 구매 후 미재구매     :', pct(cnt(members, m => {
  const c = orders.filter(o => o.MBR_ID === m.MBR_ID && o.ORDER_STATUS === 'COMPLETE').length; return c === 1;
})));
console.log('  최근구매 365일+ (휴면)   :', pct(cnt(members, m => lastOrdBy[m.MBR_ID] && daysBetween(lastOrdBy[m.MBR_ID], TODAY) > 365)));
console.log('  최근로그인 180일+        :', pct(cnt(members, m => daysBetween(new Date(m.LST_LOGIN_DTM.replace(' ', 'T') + 'Z'), TODAY) > 180)));
console.log('  장바구니 보유(미구매)    :', pct(cnt(members, m => m.BASKET_YN === 'Y')));
console.log('  VIP/GOLD                 :', pct(cnt(members, m => m.MBR_GRD !== 'BASIC')));
console.log('  미사용 유효쿠폰 보유     :', pct(new Set(validCoupon.map(c => c.MBR_ID)).size));
console.log('  마일리지 90일내 만료     :', pct(cnt(members, m => {
  if (!m.MILEAGE_EXP_YMD) return false;
  const dd = daysBetween(TODAY, new Date(m.MILEAGE_EXP_YMD + 'T00:00:00Z')); return dd >= 0 && dd <= 90;
})));
console.log('  이메일 수신동의          :', pct(cnt(members, m => m.EML_AGREE_YN === 'Y')));
console.log('  SMS 수신동의             :', pct(cnt(members, m => m.SMS_AGREE_YN === 'Y')));
console.log('  동의 전무(발송 불가)     :', pct(cnt(members, m => m.EML_AGREE_YN === 'N' && m.SMS_AGREE_YN === 'N')));
