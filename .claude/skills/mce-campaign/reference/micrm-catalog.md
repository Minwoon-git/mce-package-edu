# micrm 카탈로그 불러오기 (모바일 컨텐츠 + 알림톡 템플릿) — 채널 해소 SSOT

알림톡/문자/카카오/SMS 캠페인에서 **저니에 넣을 seq를 고르기 위해** micrm의 두 목록을
오케스트레이터(메인 루프)가 **브라우저(Claude in Chrome)** 로 불러오는 기능의 단일 출처(SSOT).

- **모바일 컨텐츠** (`mobileList.ajax`) — 저니 `inArguments.seq`에 넣는 **그 seq의 출처**. ✅ 저니가 참조.
- **알림톡 템플릿** (`atTmplLst.ajax`) — 카카오 승인 양식(`tmpl_seq`). 모바일 컨텐츠를 만들 때 안에 넣는 **재료**. ❌ 저니 seq 아님.

> ⚠️ 왜 워커가 아니라 오케스트레이터가 하나: micrm은 **로그인 웹세션**(세션 쿠키 + CSRF)으로만 인증된다(SFMC JWT 아님).
> 격리·헤드리스 워커(planning/journey)는 이 세션이 없으므로 micrm에 접근 못 한다.
> 사용자 Chrome에 **이미 로그인된 micrm 세션을 재사용**해야 하므로 반드시 Claude in Chrome으로 오케스트레이터가 수행한다.

---

## 동작 원리 (2026-06-25 라이브 검증)

| 항목 | 값 |
|---|---|
| 베이스 | `https://sales.micrm.co.kr` (모든 호출은 **이 오리진의 탭**에서 실행 — 동일 출처라야 세션 쿠키·CSRF가 자동 적용) |
| 모바일 컨텐츠 목록 | `POST /sf/06/mobileList.ajax` (UI 페이지는 `/cont/mdmLst.mi`) |
| 알림톡 템플릿 목록 | `POST /sf/06/kko/atTmplLst.ajax` (추가 폼 `kep_status=O` = 승인됨. UI 페이지 `/cont/atTemplate.mi`) |
| 인증 | 세션 쿠키(httpOnly, `credentials:'include'`로 자동 전송) + CSRF |
| CSRF | 폼 파라미터 `_csrf` **그리고** 헤더 `X-CSRF-TOKEN` 둘 다. 토큰값은 페이지의 `input[name=_csrf]`에서 읽는다 |
| 필수 헤더 | `X-CSRF-TOKEN`, `X-Requested-With: XMLHttpRequest`, `Content-Type: application/x-www-form-urlencoded` |
| 공통 폼 | `send_key`(채널 키, **BU·채널마다 다름**), `pageNo`, `_csrf` |
| 페이지 크기 | **고정 4건/페이지** (`pageNo` 증가로 순회). 정렬 = **seq 내림차순(최신 생성 먼저)** |
| 응답 | HTML 조각. **모바일**=카드당 `div.column`(seq는 `input[name=list]`), **템플릿**=`input[name=tmpl_seq]`(+`input[name=tmpl_cd]`) |

> ⚠️ **검색은 서버에서 안 먹는다 (2026-06-25 확인).** `mobileList.ajax`는 `searchType`/`searchValue`를 보내도 무시하고 항상 최신순 전체를 페이지로만 돌려준다. **이름 필터는 클라이언트 측에서** 한다(아래 스니펫).
> ⚠️ **모바일 컨텐츠 목록은 크다 (현재 BU 200건+).** 전수 순회는 50+요청이라 느리므로, 기본은 **최신 N페이지만** 가져와 필터하고, 못 찾을 때만 전수 순회로 넓힌다.
> ⚠️ `send_key`는 하드코딩하지 않는다. **채널 해소 1단계**(현재 BU 알림톡 저니의 발신 프로필 `@채널명(send_key)`)에서 얻은 값을 넣는다.
> ⚠️ 응답 원문(HTML)을 그대로 도구 밖으로 반환하면 안전필터가 가린다(쿠키/쿼리 문자열 오탐). **반드시 페이지 안에서 파싱해 `seq`·이름만** 구조화해 반환한다.

---

## 불러오기 스니펫 (Claude in Chrome `javascript_tool`용)

전제: 현재 탭이 `https://sales.micrm.co.kr/*` 이고 micrm에 로그인돼 있어야 한다(아니면 먼저 `navigate`로 이동).
`SEND_KEY`만 채널 해소 1단계 값으로 치환하고, `KEYWORD`(이름 필터)·`MAX_PAGES`(순회 한도)를 상황에 맞게 조절한 뒤 `javascript_tool`로 실행한다.

```js
await (async () => {
  const SEND_KEY  = '<채널 해소 1단계에서 얻은 send_key>';  // ⚠️ BU/채널마다 다름 — 하드코딩 금지
  const KEYWORD   = '';     // 이름 부분일치 필터(공백=필터 없음). 예: '신규', '휴면', '장바구니'
  const MAX_PAGES = 8;      // 모바일 컨텐츠 순회 한도(4건/페이지). 8=최신 32건. 전수는 크게(예: 300)

  const csrf = document.querySelector('input[name=_csrf]')?.value
            || document.querySelector('meta[name=_csrf]')?.content;
  if (!csrf) return { error: 'CSRF 토큰을 못 찾음 — micrm 로그인 탭인지 확인' };
  const clean = s => (s||'').replace(/\s+/g,' ').trim();

  async function fetchAll(path, extra, parse, maxPages) {
    const items = [], seen = new Set();
    for (let p = 1; p <= maxPages; p++) {
      const body = new URLSearchParams(Object.assign({ send_key: SEND_KEY, pageNo: String(p), _csrf: csrf }, extra));
      const res = await fetch(path, {
        method: 'POST', credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-CSRF-TOKEN': csrf,
          'X-Requested-With': 'XMLHttpRequest'
        },
        body
      });
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const rows = parse(doc);
      let fresh = 0;
      for (const r of rows) { if (seen.has(r.id)) continue; seen.add(r.id); items.push(r); fresh++; }
      if (rows.length === 0 || fresh === 0) break;   // 빈 페이지거나 새 항목 없음 → 끝(중복 stop)
    }
    return items;
  }

  // ── 모바일 컨텐츠: 카드 1개 = div.column, seq = input[name=list]
  let mobile = await fetchAll('/sf/06/mobileList.ajax', {}, doc =>
    [...doc.querySelectorAll('div.column')].map(col => {
      const seq = col.querySelector('input[name=list]')?.value; if (!seq) return null;
      const hs = [...col.querySelectorAll('h3,h4')].map(e => clean(e.textContent)).filter(Boolean);
      return { id: seq, seq, name: hs[0] || '', title: hs.find(t => /[\[\]]/.test(t)) || hs[1] || '' };
    }).filter(Boolean), MAX_PAGES);

  // ── 알림톡 템플릿: input[name=tmpl_seq] (+ tmpl_cd). 목록이 작아 전수(최대 50p) 순회
  let tmpl = await fetchAll('/sf/06/kko/atTmplLst.ajax', { kep_status: 'O' }, doc =>
    [...doc.querySelectorAll('input[name=tmpl_seq]')].map(inp => {
      const box = inp.closest('li') || inp.closest('div.column') || inp.parentElement;
      const hs = [...box.querySelectorAll('h3,h4,strong,a')].map(e => clean(e.textContent)).filter(Boolean);
      return { id: inp.value, tmpl_seq: inp.value, tmpl_cd: box.querySelector('input[name=tmpl_cd]')?.value || '', name: hs[0] || '' };
    }), 50);

  // ── 클라이언트 측 이름 필터 (서버 검색이 안 먹으므로)
  if (KEYWORD) {
    const kw = KEYWORD.toLowerCase();
    mobile = mobile.filter(m => (m.name + ' ' + m.title).toLowerCase().includes(kw));
    tmpl   = tmpl.filter(t => t.name.toLowerCase().includes(kw));
  }

  return {
    mobileCount: mobile.length, mobile: mobile.map(m => ({ seq: m.seq, name: m.name, title: m.title })),
    tmplCount: tmpl.length,     tmpl: tmpl.map(t => ({ tmpl_seq: t.tmpl_seq, tmpl_cd: t.tmpl_cd, name: t.name }))
  };
})()
```

### 반환 예 (현재 BU 밀버스 채널, 2026-06-25 검증)

`KEYWORD=''`, `MAX_PAGES=2` 일 때(최신 8건):

```json
{
  "mobileCount": 8,
  "mobile": [
    { "seq": "5355", "name": "캐러셀 테스트" },
    { "seq": "5328", "name": "[장보기] 프리미엄 멤버십 혜택 안내" },
    { "seq": "<seq>", "name": "신규 회원 알림톡" },
    { "seq": "<seq>", "name": "<컨텐츠명>" },
    { "seq": "5262", "name": "[장보기] 프리미엄 멤버십 혜택 안내" },
    { "seq": "5261", "name": "[장보기] 프리미엄 멤버십 혜택 안내" },
    { "seq": "5247", "name": "테스트 템플릿" },
    { "seq": "5062", "name": "브랜드톡 마수동 테스트 1" }
  ]
}
```

알림톡 템플릿(전수 11건): `2033 ECS MFA 인증 번호` · `1778 기부금영수증안내` · `1658 자동 결제 안내` · `1657 구독서비스_가이드안내` · `1656 리뷰안내` · `595 회원가입 알림톡` · `34 Porche_엔진 오일 교환` · `33 Porche_배송` · `16 한국 컴패션 당첨 쿠폰 발급` · `12 밀버스운영테스트` · `7 운영테스트`.

> ⚠️ 모바일 컨텐츠 이름은 지저분하다(중복 "사료추천" 다수, "12421"·"캐러셀 테스트" 같은 무의미 이름). 키워드 필터로 못 좁히면 사용자에게 후보를 제시(수동)하거나 전수 순회 후 의도 매칭(자동)으로 넓힌다.
> **저니에 넣는 값은 `mobile[].seq`(모바일 컨텐츠 seq, 문자열)** 다. `tmpl[].tmpl_seq`는 절대 저니 `inArguments.seq`에 넣지 않는다
> (2026-06-25 테스트: tmpl_seq 직접 사용 시 JB UI "사용할 수 없는 콘텐츠"). 상세 근거 [`journey-build.md`](journey-build.md) ④.

---

## 채널 해소 절차에서의 위치

1. **BU 연결 채널·키 확인** — 현재 BU 알림톡 저니를 `sfmc_get_journey`로 읽어 ① `configurationArguments.applicationExtensionKey` ② 발신 프로필 `send_key` 확보.
2. **카탈로그 불러오기** — micrm 탭에서 위 스니펫 실행(`SEND_KEY`=1단계 값). 캠페인 의도 키워드가 있으면 `KEYWORD`로 1차 필터.
3. **seq 선택** — **수동 모드**: 필터된 후보(seq+이름)를 `AskUserQuestion`으로 제시해 사용자가 선택(후보가 4개 초과면 키워드로 더 좁히거나 상위 후보만). **자동 모드**: 캠페인 의도와 콘텐츠 이름을 매칭해 자동 선택하되, **확신이 낮으면 임의로 고르지 말고 상위에 반환**(잘못된 seq = 깨진 발송). ⇒ 자동 모드 매칭 전략은 아래 절 참조.
   - 원하는 알림톡 템플릿만 있고 그걸 감싼 모바일 컨텐츠가 없으면, micrm UI에서 "모바일 컨텐츠 생성"으로 감싼 뒤 새 seq를 받아 사용([`journey-build.md`](journey-build.md) ④ 참조).
4. **변수 매핑** — 선택 콘텐츠의 카카오 변수 `#{변수명}`(예 `{{name}}`)을 진입 DE 컬럼에 매핑.
5. **위임** — {seq, applicationExtensionKey, 변수매핑}을 STEP 2 planning 워커에 넘겨 정의서에 기록.

> ⚠️ seq는 반드시 **그 BU 커스텀 액티비티가 연결된 채널**의 모바일 컨텐츠여야 한다. 다른 채널 seq = JB UI "사용할 수 없는 콘텐츠".

---

## 자동 모드 seq 선택 전략 — **A. 이름매칭 + 확신 임계치** (확정 2026-06-25)

모바일 컨텐츠가 200건+이고 이름이 지저분(중복·무의미 이름)하므로, **이름 매칭으로 고르되 확신이 낮으면 절대 임의로 고르지 않고 상위에 반환**해 사용자에게 묻는다(자동→미니 수동 강등). 잘못된 seq = JB "사용할 수 없는 콘텐츠"/빈 발송이라, "틀린 자동 선택"보다 "한 번 더 묻기"가 항상 낫다.

**절차:**

1. **의도 키워드 세트 구성** — 캠페인 의도에서 1차 키워드 + 동의어를 만든다. 예:
   - 신규회원/웰컴 → `['신규','웰컴','welcome','가입','환영']`
   - 휴면/윈백 → `['휴면','dormant','복귀','윈백']`
   - 장바구니 → `['장바구니','cart','담은']`
   - 생일 → `['생일','birthday','축하']`
   - 쿠폰/할인 → `['쿠폰','할인','coupon']`
2. **후보 수집** — 스니펫을 `KEYWORD`=1차 키워드로 실행(부분일치 필터). 결과가 0이면 동의어로 재시도, 그래도 0이면 `MAX_PAGES`를 키워(전수 순회) 다시 시도.
3. **점수화** — 각 후보 이름(`name`+`title`)에:
   - 의도 핵심 구절 전체 포함 → **3점**
   - 1차 키워드 포함 → **2점**
   - 동의어 포함 → **1점** (여러 키워드 적중 시 합산)
4. **임계치 판정**:
   - 최고점 **≥ 2** **그리고** (최고점 후보가 1개뿐 **이거나** 1등−2등 점수차 ≥ 1) → **자동 채택**. 결과 보고에 "왜 그 seq를 골랐는지" 1줄 남긴다(CLAUDE.md 자동모드 보고 규칙).
   - 그 외(최고점 < 2, 또는 동점 다수로 모호, 또는 후보 0) → **자동 선택하지 않고 상위에 후보(상위 N)와 함께 반환** → 오케스트레이터가 `AskUserQuestion`으로 사용자에게 확인(자동 모드라도 이 1건만 질문).
5. **검증** — 채택 seq는 같은 `send_key` 채널 카탈로그에서 나온 것이므로 채널 정합성은 보장됨(다른 채널 seq 혼입 불가).

> 후보 0건이고 적합 템플릿만 있는 경우: 자동으로 새 모바일 컨텐츠를 만들지 않는다(발송정보 입력 필요·위험). 상위에 "적합 모바일 컨텐츠 없음, 템플릿 X로 생성 필요"를 반환해 사용자 판단을 받는다.
