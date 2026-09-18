# 이메일 콘텐츠 생성 표준 (고퀄리티 기본값)

## ⭐ 콘텐츠 선택 정책 — 재사용 우선 (STEP 3 이메일 연결 시 항상 먼저 적용)

> 저니의 이메일 액티비티에 연결할 콘텐츠는 **새로 만들기 전에 기존 에셋을 먼저 검색·재사용**한다.
> 새 이메일을 무조건 생성하지 않는다. 아래 순서를 지킨다.

1. **기존 콘텐츠 검색** — `MCE-Package`(categoryId `<확인필요: sfmc_get_content_categories>`) 폴더에서 캠페인 유형 키워드로 매칭되는 에셋을 찾는다.
   (`sfmc_search_content_builder_assets` 또는 `sfmc_get_content_builder_assets` + 이름 필터)
2. **매칭 결과 처리**:
   - 매칭 에셋이 있으면 → 그 `legacyId`를 이메일 액티비티 `emailId`로 **재사용**한다. (수동 모드에서 후보가 여럿이면 사용자에게 보여주고 고르게 한다. 자동 모드에서는 가장 적합한 1개를 골라 1줄로 알린다.)
   - 매칭 에셋이 없을 때만 → 아래 "고퀄리티 + born-compliant" 방식으로 **신규 생성**한다.

**캠페인 유형별 검색 키워드 (이름에 아래 단어가 포함된 콘텐츠를 우선 매칭):**

| 캠페인 (진입 DE) | 검색 키워드 | 기준 샘플 emailId |
|---|---|---|
| 신규회원 (New Join) | `신규회원`, `웰컴`, `Welcome` | `<확인필요: 계정 샘플 emailId>` |
| 이탈고객 (Old Member) | `이탈`, `재활성화`, `윈백` | `<확인필요: 계정 샘플 emailId>` |
| 장바구니 (Cart) | `장바구니`, `리마인드`, `Cart` | `<확인필요: 계정 샘플 emailId>` |
| 생일 (Birthday) | `생일`, `Birthday` | `<확인필요: 계정 샘플 emailId>` |
| 쿠폰/친구추가 (Coupon) | `쿠폰`, `친구추가`, `Coupon` | `<확인필요: 계정 샘플 emailId>` |

> 예: 신규회원 캠페인 생성 시 → 이름에 `신규회원`/`웰컴`이 들어간 MCE-Package 콘텐츠를 먼저 찾아 재사용한다.
> 같은 캠페인에 단계별 이메일이 여러 개 필요한데(예: 웰컴 + 리마인드) 일부만 존재하면, 있는 것은 재사용하고 없는 단계만 신규 생성한다.

---

> 이메일 콘텐츠(에셋)를 새로 만들 때는 **항상 아래 "고퀄리티 + born-compliant" 방식**으로 생성한다.
> 빈 본문/단순 텍스트 이메일을 만든 뒤 나중에 footer만 붙이는 방식은 **금지** — SFMC 검증 플래그가 갱신되지 않아 CAN-SPAM "물리적 주소 없음" 오류가 계속 남는다.

> ⭐ **신규 생성은 템플릿 기반으로 한다.** 골격·자리표시자·이미지(C) 절차·고객사 값 분리는 [`email-template/_template-guide.md`](email-template/_template-guide.md)가 SSOT다.
> `email-template/_master.html`(검증 통과 골격) + **[`active-customer.json`](active-customer.json)의 `brand_kit`이 가리키는 `<고객사>.json`**(브랜드 값)을 채워 완성 HTML을 만든 뒤 `sfmc_create_content_builder_asset`으로 생성한다.
> 🔒 `brand_kit`이 `null`이거나 그 파일이 없으면 **예시 색으로 만들지 말고 중단**하고 상위에 보고한다(_template-guide.md §0-6).
> 아래 항목은 그 요약이다.

**필수 구성 (모든 발송용 이메일):**
1. 반응형 `<table>` 레이아웃 (600px + 인라인 CSS + `@media max-width:620px` 모바일 대응)
2. 브랜드 헤더(로고/브랜드명) + 히어로(헤드라인) + 본문(가치 제안 1개) + 오퍼/혜택 섹션
3. Bulletproof CTA (table + `bgcolor` 기반 버튼 — Outlook 호환)
4. Preheader (받은편지함 미리보기 문구, 숨김 `<div>`)
5. 규정 푸터 3요소: 물리적 주소(`%%Member_Busname%% %%Member_Addr%% %%Member_City%%, %%Member_State%%, %%Member_PostalCode%%, %%Member_Country%%`) + 프로필센터(`%%profile_center_url%%`) + 수신거부(`%%unsub_center_url%%`)
6. **안전한 개인화** — `%%FirstName%%` 단독 사용 금지(진입 DE에 없으면 personalization 검증 오류). AMPscript fallback 사용:
   `%%[ VAR @name SET @name = AttributeValue("FirstName") IF EMPTY(@name) THEN SET @name = "고객" ENDIF ]%%` → 본문에서 `%%=v(@name)=%%님`

**생성 방법:** `sfmc_create_email`로 완성된 HTML을 한 번에 생성한다(born-compliant → 생성 시점에 검증 통과, HTML+자동 text 뷰 포함). 타입(htmlemail/paste/template)은 무관 — 위 요소만 갖추면 통과한다. 캠페인 성격(신규/이탈/장바구니/생일/쿠폰)에 맞춰 헤드라인·오퍼·악센트 컬러·CTA만 바꾼다.

**전용 폴더 — `MCE-Package` (Content Builder categoryId `<확인필요: sfmc_get_content_categories>`):**
- 캠페인 발송용 이메일은 모두 이 폴더에 둔다. **새 이메일 생성 시 `category_id: <확인필요: MCE-Package 폴더 categoryId>`로 생성**하고, 저니 생성(STEP 3)에서 이메일을 찾을 때는 **이 폴더 + 이름으로 우선 조회**한다(루트의 옛 임시 이메일과 혼동 방지 — 비슷한 이름 오선택이 과거 오류의 원인이었음).
- 하위폴더는 두지 않는다(캠페인당 이메일 1개, 이름으로 식별 충분).
- ⛔ **categoryId는 BU 종속이다 — 하드코딩 금지.** 폴더 ID는 계정마다 다르므로 생성 전 `sfmc_get_content_categories`로 재확인한다. (구 값 `93427`은 다른 BU 값 — 400 `Unable to find a Category`.)

**⚠️ 생성 후·수정 시 반드시 지킬 것:**
- **푸터 3요소를 지운 채 저장하지 않는다.** 기존 에셋의 HTML을 다시 PATCH할 때 물리주소·`%%profile_center_url%%`·`%%unsub_center_url%%` 블록이 빠지면 그 순간부터 CAN-SPAM 검증 실패로 **발송 불가**가 된다(생성 시 정상이었어도 이후 수정으로 깨진다). 수정 후 `views.html.content`에 세 요소가 남아 있는지 재확인한다.
- **`characterEncoding`은 `utf-8`로 만든다.** `sfmc_create_content_builder_asset`으로 만들면 기본이 `us-ascii`가 되어 한글 제목·본문이 깨질 수 있다 — `data.email.options.characterEncoding: "utf-8"`을 명시한다.
- **`views.text`를 함께 넣는다**(`data.email.options.generateFrom: "html"`). 누락 시 multipart가 구성되지 않는다.

**캠페인별 기준 샘플 이메일 (MCE-Package / <확인필요: 폴더 categoryId>):**

| 캠페인 (진입 DE) | 이메일명 | emailId |
|---|---|---|
| 신규회원 (New Join) | 신규회원 웰컴 이메일 (샘플) | `<확인필요: 계정 샘플 emailId>` |
| 이탈고객 (Old Member) | 이탈고객 재활성화 이메일 (샘플) | `<확인필요: 계정 샘플 emailId>` |
| 장바구니 (Cart) | 장바구니 이탈 리마인더 이메일 (샘플) | `<확인필요: 계정 샘플 emailId>` |
| 생일 (Birthday) | 생일 축하 쿠폰 이메일 (샘플) | `<확인필요: 계정 샘플 emailId>` |
| 쿠폰/친구추가 (Coupon) | 쿠폰 친구추가 이메일 (샘플) | `<확인필요: 계정 샘플 emailId>` |
