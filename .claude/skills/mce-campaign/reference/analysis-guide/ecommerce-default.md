# 분석 가이드 — 고객사: ecommerce-default (일반 이커머스 기업 / 기본 고객사 템플릿)

> 🚧 **이 파일은 "예시 템플릿"이지 활성 고객사 값이 아니다.** DE 이름의 `<접두어>_`는 자리표시자다(실제 이름 아님).
> 실제 값은 **STEP 0이 생성하는 [`analysis-guide/<고객사>.md`](.)** 에 들어가고, 활성 선언은 [`../active-customer.json`](../active-customer.json) 한 곳에서 한다.
> `active-customer.json`의 `analysis_guide`가 `null`이면 **아직 활성 고객사가 없다는 뜻**이다 — 이 파일을 활성 값으로 착각해 읽지 말고 STEP 0(스키마 분석 → RAW DE → 가이드 MD 생성)부터 수행한다.

> 이 파일은 **이 고객사(BU)의 값 모음**이다. 에이전트 3개가 각자 필요한 절을 읽는다:
> - **분석**(`mce-topic-agent`) → §1 스키마 · §2 의미규칙 (+ §3·§4 예시·§5 진입DE)
> - **기획**(`mce-planning-agent`) → §6 기획 가이드 (+ §1·§2 필드/의미, §5 진입DE)
> - **전이**(`mce-journey-agent`) → §7 전이 BU 고정값 (+ §5 진입DE)
>
> 분석·추천의 "방법"(공통)은 [`_common.md`](_common.md), 기획·전이의 공통 규칙은 [`journey-build.md`](../journey-build.md)를 따른다. **이 파일엔 그 방법을 이 BU에 적용할 "값"만** 둔다.
>
> ⭐ **이 파일은 "쿼리·캠페인·기준선 카탈로그"가 아니다.** 아래 §3 기준선·§4 세그먼트·SQL/WHERE는 **전부 예시/참고**일 뿐, 규칙도 고정 목록도 아니다.
> **AI는 [§1 스키마] + [§2 의미규칙]을 읽고 마스터 DE를 프로파일링해서 → 어떤 지표·세그먼트를 측정할지, 어떤 캠페인을 추천할지, 기준선을 얼마로 볼지 스스로 정한다** ([`_common.md`](_common.md) "컬럼 프로파일링 → 캠페인 도출" 절). §4 목록에 없는 캠페인도 즉석 생성한다.
> 즉 고객사는 **컬럼명(§1)과 "이 컬럼/지표는 이런 뜻"이라는 의미(§2)만** 적어두면, 나머지(측정할 세그먼트·쿼리·기준선·추천)는 AI가 데이터를 보고 알아서 한다.
>
> ℹ️ **스키마 출처**: 아래 컬럼 매핑은 cafe24 기반 쇼핑몰 스키마를 참고한 **일반 이커머스 표준 템플릿**이다(cafe24는 컬럼 참고용, 실제 고객사명 아님). 실제 고객사 확정 시 이 파일을 복제해 컬럼·의미 규칙·기준선을 실제 값으로 갱신한다.

---

## 1. 분석 소스 + 스키마 (AI가 쿼리를 짤 때 쓰는 "재료")

> ⭐ **이 고객사 원천은 다중 엔티티(정규화된 여러 테이블)다.** 진단은 이들을 JOIN·집계해 만든 **고객 프로파일 DE(`<접두어>_RECON_Profile`)** 위에서 수행한다(빌드 방법 = [`_common.md`](_common.md) §6-0). 진단 `SEG_*`와 STEP 1은 이 프로파일을 읽는다.

**원천 엔티티 (다중 테이블 — 위치 `Data Extensions > <고객사 루트 폴더> > 01_RAW(원천)`, categoryId `<확인필요>`):**

| 엔티티 | DE Key | 조인키 | 도출되는 파생값 |
|---|---|---|---|
| 고객 | `<접두어>_RAW_Customers_DE` | member_id (PK) | (직접) 로그인·동의·장바구니·생일·등급·포인트 등 |
| 구매마스터 | `<접두어>_RAW_Orders_DE` | order_id (PK), member_id | `order_count`·`total_spent`·`last_order_date` |
| 구매상세 | `<접두어>_RAW_OrderDetails_DE` | detail_id (PK), order_id, product_id | (제품 조인) `preferred_category` |
| 제품 | `<접두어>_RAW_Products_DE` | product_id (PK) | 카테고리 |
| 쿠폰 | `<접두어>_RAW_Coupons_DE` | coupon_id (PK), member_id | `unused_coupon_count` |

- **관계**: 고객 1:N 주문, 주문 1:N 상세, 상세 N:1 제품, 고객 1:N 쿠폰. Contact Key = `member_id`.
- **분석 base(진단 소스) = `<접두어>_RECON_Profile`** — Key `<접두어>_RECON_Profile_DE`, id `<확인필요: 생성 후 조회>`, categoryId `<확인필요: <고객사 루트 폴더> 하위 진단 폴더 생성 후>`. 위 5테이블을 JOIN·집계해 **1행=1고객**으로 통합한 프로파일. 빌드 쿼리 = `<접두어>_BUILD_RECON_Profile`(§6-0 패턴), rowCount = 적재 후 확인.
  - **현재 materialize된 컬럼(11)**: `member_id`, `order_count`, `total_spent`, `last_order_date`, `preferred_category`, `unused_coupon_count`, `last_login_date`, `email_consent`, `sms_consent`, `has_abandoned_cart`, `cart_total_amount` → **핵심 진단 6캠페인(2차구매·이탈·휴면·동의·장바구니·미전환) 커버**.
  - **확장 컬럼(생일·등급·쿠폰/포인트 만료 캠페인용)**: `birthday`·`grade`·`region`·`signup_date`·`points_balance`·`points_expire_date`는 `<접두어>_RAW_Customers`에, `coupon_expire_date`(MIN 미사용)는 `<접두어>_RAW_Coupons`에 있으므로, 해당 캠페인이 필요할 때 `<접두어>_BUILD_RECON_Profile`에 승계 컬럼으로 추가한다.
  - *(2026-07-03 다중 엔티티로 전환. 이전엔 단일 평탄화 DE `Customer_Profile`(CD_Customer_Profile_DE)을 직접 사용. RECON_Profile은 그것과 파생값 **완전 일치** — 10만 전수 대조 불일치 **0**으로 검증됨.)*
- ⚠️ **신호는 플래그로 저장하지 않는다** — `is_dormant` 같은 Boolean을 두지 않고 원천 날짜·수치만 두며, 대상 판정은 **쿼리가 계산**한다([`_common.md`](_common.md) 2절).

### 스키마 매핑 (원천 컬럼 — AI가 SQL에서 참조)

| 의미 | 컬럼명 | 타입 |
|---|---|---|
| 가입일 | `signup_date` | Date |
| 마지막 로그인 | `last_login_date` | Date |
| 마지막 주문일 | `last_order_date` | Date |
| 생일 | `birthday` | Date |
| 쿠폰 만료일 | `coupon_expire_date` | Date |
| 포인트 만료일 | `points_expire_date` | Date |
| 장바구니 수정일 | `cart_updated_date` | Date |
| 누적 주문 수 | `order_count` | Number |
| 누적 결제액 | `total_spent` | Number |
| 포인트 잔액 | `points_balance` | Number |
| 장바구니 금액 | `cart_total_amount` | Number |
| 미사용 쿠폰 수 | `unused_coupon_count` | Number |
| 장바구니 이탈 여부 | `has_abandoned_cart` | Boolean (`'True'`/`1`) |
| 회원 등급 | `grade` | Text (예: VIP/General) |
| 회원 유형 | `member_type` | Text |
| 선호 카테고리 | `preferred_category` | Text |
| 지역 | `region` | Text |
| **이메일 수신 동의** | `email_consent` | Boolean (`'True'`/`1`) |
| **SMS/알림톡 수신 동의** | `sms_consent` | Boolean (`'True'`/`1`) |

> 위에 없는 컬럼은 쓰지 않는다. 캠페인에 필요한 신호 컬럼이 스키마에 없으면 "그 컬럼이 없다"고 명시하고 대안을 제시한다(지어내지 않는다).

---

## 2. 지표 정의 (의미 사전 — AI는 이 "정의"를 SQL로 번역한다)

> ⭐ **여기가 핵심이다.** 고객사는 **"이 지표는 이런 뜻"** 이라는 정의만 적는다. AI는 이 정의 + §1 스키마로 SQL을 **직접 작성**한다.
> 정의를 바꾸면(예: 휴면 90→60일, "거래액에 세금 빼기") AI가 만드는 쿼리도 따라 바뀐다 — **DE 재적재·코드 수정 불필요, 이 정의만 수정**.

### 2-1. 데이터 의미 규칙 (이 고객사의 해석 기준)

| 항목 | 이 고객사 정의 | 비고 |
|---|---|---|
| 누적 결제액(`total_spent`) | **세금 포함, 취소·환불건 제외, 포인트 사용분 차감 전 결제 기준** | ※ 고객사 확인 후 확정 |
| 주문 수(`order_count`) | **완료 주문 기준(취소 제외)** | |
| Boolean 비교 | `= 'True'` / `= 1` 둘 다 동작 | |

> ⚠️ "세금/포인트/취소 포함 여부"는 고객사 거래 정의에 따라 **반드시 실제 값으로 확정**해야 매출/이탈 진단이 정확하다. 현재는 일반적 가정값.

### 2-2. 지표 정의 (자연어 정의 → AI가 SQL 조립)

| 지표 | **정의 (말로)** | 쓰는 컬럼 | AI가 조립할 SQL 조건 *(예시)* |
|---|---|---|---|
| 구매자 | 주문 1회 이상 | `order_count` | `order_count >= 1` |
| 1회성 구매자 | 주문이 정확히 1회 | `order_count` | `order_count = 1` |
| 첫구매 미전환 | 가입했으나 주문 0 | `order_count` | `order_count = 0` |
| 이탈위험 | **구매자 중** 마지막 주문 후 90일 경과 | `order_count`,`last_order_date` | `order_count>=1 AND DATEDIFF(day,last_order_date,GETDATE())>=90` |
| 휴면 | 마지막 로그인 후 90일 경과 | `last_login_date` | `DATEDIFF(day,last_login_date,GETDATE())>=90` |
| 신규 회원 | 가입 30일 이내 | `signup_date` | `DATEDIFF(day,signup_date,GETDATE())<=30` |
| 장바구니 이탈 | 담아두고 미결제 | `has_abandoned_cart`,`cart_total_amount` | `has_abandoned_cart='True' AND cart_total_amount>0` |
| 생일 | 오늘이 생일 | `birthday` | `MONTH(birthday)=MONTH(GETDATE()) AND DAY(birthday)=DAY(GETDATE())` |
| 쿠폰 만료 임박 | 만료 7일 이내 + 미사용 보유 | `coupon_expire_date`,`unused_coupon_count` | `coupon_expire_date BETWEEN GETDATE() AND DATEADD(day,7,GETDATE()) AND unused_coupon_count>0` |
| 포인트 만료 임박 | 만료 7일 이내 + 잔액 보유 | `points_expire_date`,`points_balance` | `points_expire_date BETWEEN GETDATE() AND DATEADD(day,7,GETDATE()) AND points_balance>0` |
| VIP | 최상위 등급 | `grade` | `grade='VIP'` |
| 미동의 | 이메일·SMS 모두 미동의 | `email_consent`,`sms_consent` | `email_consent='False' AND sms_consent='False'` |

> **위 "SQL 조건"은 정의를 보여주는 예시다.** 캠페인이 더 복잡하면(예: "VIP 중 장바구니 담고 3일 지난 사람") AI가 해당 정의들을 **AND로 조합**해 새 쿼리를 만든다. 정의에 없는 완전히 새로운 조건은, 사용자 의도를 §1 스키마 컬럼으로 해석해 작성하고 어떤 컬럼·기준으로 만들었는지 1줄 밝힌다.
> `GETDATE()`=오늘. 기준일수(90/30/7 등)는 2-1·2-2의 정의를 고치면 바뀐다.
>
> 📅 **경과일 셈법은 `DATEDIFF(day, <날짜컬럼>, <기준일>) >= N` 한 가지로 고정한다** — 경계 포함(N일째도 대상), 시각은 무시하고 달력 날짜만 비교. `> N`과 섞거나 datetime을 타임스탬프로 빼면 같은 데이터에서도 경계 인원이 어긋난다. 모든 세그먼트가 **같은 기준일**을 쓴다.

### 2-3. 동의 필터 (채널별, 발송 쿼리에 항상 결합)

- 이메일 → `email_consent='True'` / SMS·알림톡·카카오 → `sms_consent='True'`
- ⚠️ 완전 미동의자(`email_consent='False' AND sms_consent='False'`)는 도달 채널이 없어 **마케팅 캠페인 대상에서 제외**한다. 동의 필터를 우회한 발송 저니를 만들지 않는다([`_common.md`](_common.md) 4절).

---

## 3. 추천 기준선 — ⚠️ 참고용 예시 (규칙 아님)

> ⭐ **원칙: 기준선은 AI가 데이터 분포를 프로파일링해서 정한다** ([`_common.md`](_common.md) "컬럼 프로파일링 → 캠페인 도출"). 실제 분포에서 두드러진 지점을 찾아 추천한다.
> 아래 표는 **고정 규칙이 아니라, 분포를 못 봤을 때 쓸 상식 기본값(fallback) 예시**다. 고정 임계값을 그대로 쓸 땐 결과에 **"이 기준으로 가정함"을 반드시 밝힌다.** 출력엔 "약점/주목" 표현 금지, 비율 높은 순.
> 모수는 기본 전체 고객, 이탈·1회성은 구매자 모수.

| 지표 | 참고 기본값(예시) | 흔한 추천 캠페인(예시) |
|---|---|---|
| 1회성 구매자 비중 | ~60% | 2차 구매 유도 |
| 이탈위험 | ~25% | 이탈 고객 재구매 유도 |
| 휴면 | ~30% | 휴면 고객 재활성화 |
| 첫구매 미전환 | ~20% | 신규 첫구매 유도 |
| 장바구니 이탈 | ~15% | 장바구니 리마인더 |

> 이 표에 없는 지표·캠페인도 AI가 컬럼 분포에서 도출할 수 있다(예: 특정 등급·카테고리·지역 쏠림). 표는 출발점일 뿐이다.

---

## 4. 진단 세그먼트 — `SEG_*` (⚠️ 예시 세트 · 캐시, 고정 목록 아님)

> ⭐ **측정할 세그먼트는 AI가 §1 스키마 + §2 의미규칙을 프로파일링해서 스스로 정한다** ([`_common.md`](_common.md)). 아래 7개는 **이커머스에서 흔한 예시 세트(자주 나오는 것)** 일 뿐, 반드시 이것만·이대로 측정하라는 고정 목록이 아니다. AI는 데이터에 맞게 세그먼트를 **추가·제외·변형**한다.
> ⭐ 각 세그먼트 SQL은 §2 정의로부터 **생성**한다(복사 아님). 정의(§2)를 고치면 따라 바뀐다.
> ⭐ 특정/커스텀 세그먼트는 이 목록에 없어도 AI가 §1+§2로 즉석 생성한다(STEP 1-6 발송 DE도 마찬가지).
> ※ 이미 계정에 존재하는 `SEG_*`는 이 예시 세트가 이전에 생성된 것이다(재생성 말고 rowCount만 읽음 — [`_common.md`](_common.md) 6-1).

카운트 DE 위치: **`Data Extensions > <고객사 루트 폴더>`** 하위 진단 폴더 (categoryId `<확인필요: 폴더 생성 후 조회>`). **member_id 1컬럼·비-sendable**, rowCount=인원. **발송 DE 아님.**

| 세그먼트 | 카운트 DE Key | 근거 지표(§2) |
|---|---|---|
| 1회성 구매자 | `<접두어>_SEG_repeat_buyer_DE` | 1회성 구매자 |
| 구매자(이탈 분모) | `<접두어>_SEG_buyers_DE` | 구매자 |
| 이탈위험 | `<접두어>_SEG_churn_DE` | 이탈위험 |
| 휴면 | `<접두어>_SEG_dormant_DE` | 휴면 |
| 첫구매 미전환 | `<접두어>_SEG_noconv_DE` | 첫구매 미전환 |
| 장바구니 이탈 | `<접두어>_SEG_cart_DE` | 장바구니 이탈 |
| 미동의 | `<접두어>_SEG_noconsent_DE` | 미동의 |

- **Automation**: `<접두어>_CP_DIAGNOSIS_AUTOMATION` — 매일 03:00 KST에 위 세트를 Overwrite 집계. (없으면 [`_common.md`](_common.md) 6절이 §2 정의로부터 SQL·DE·Automation을 자동 생성)
- **생성 SQL 형태**: `SELECT member_id FROM <접두어>_RECON_Profile WHERE <§2 정의로 조립한 조건>` — **Contact Key 1컬럼만**, Overwrite. raw 다중 컬럼 SELECT 금지.
- **전체 모수** = `<접두어>_RECON_Profile` rowCount, **구매자 모수** = `<접두어>_SEG_buyers_DE` rowCount.
- 읽기·자동생성 절차는 [`_common.md`](_common.md) 3·6절.

---

## 5. 진입(발송) DE / 폴더 매핑 (저니 진입 레이어)

캠페인 선택 후 AI가 `<접두어>_RECON_Profile`을 **§2 정의 + 동의 필터로 조립한 쿼리**로 필터해 진입 DE를 채운다(SKILL.md STEP 1-6). 저니는 이 진입 DE에서 진입한다.

> ⚠️ **아래 폴더 categoryId는 미지정** — <접두어> 전환으로 진입 DE 폴더를 아직 만들지 않았다. 실제 진입 DE 생성 전 **라이브 폴더 조회로 categoryId를 확인**하고 갱신한다.

| 의도 | 진입 DE명(예) | DE Key(예) | categoryId(미지정) |
|---|---|---|---|
| 신규 회원 | 신규회원_웰컴 | `<접두어>_WELCOME_ENTRY_DE` | `<확인필요>` |
| 이탈/재활성화 | 이탈고객_재활성화 | `<접두어>_CHURN_ENTRY_DE` | `<확인필요>` |
| 장바구니 이탈 | 장바구니_이탈 | `<접두어>_CART_ABANDON_ENTRY_DE` | `<확인필요>` |
| 생일 | 생일_쿠폰 | `<접두어>_BIRTHDAY_ENTRY_DE` | `<확인필요>` |
| 쿠폰/프로모션 | 쿠폰_친구추가 | `<접두어>_COUPON_FRIEND_ENTRY_DE` | `<확인필요>` |

---

## 6. 기획(planning) 가이드 — `mce-planning-agent`가 참조

> 기획 공통 패턴(저니 구조·정의서 형식)은 [`reference/journey-build.md`](../journey-build.md)·`SKILL.md` STEP 2를 따르고, **이 고객사에서만 다른 값**만 여기 둔다.

- **주 채널**: 이 BU는 **알림톡(카카오)** 채널이 연결돼 있음 → 메시지 캠페인 기본 채널은 알림톡 우선 검토(이메일도 가능). 알림톡 발송값은 §7 참조.
- **재진입 기본값**(의도 미지정 시): `No re-entry`. ("~때마다"=Re-entry anytime, "여정 끝난 뒤 재시도"=Re-entry only after exiting.)
- **스케줄 관례**: 반복 발송 기본 시각 **09:00 KST**, `timeZoneId=48`(Seoul). 1회성 의도면 On Activation(빈값).
- **동의 채널 매핑**: 이메일=`email_consent`, 알림톡/SMS=`sms_consent` (§2-3).

---

## 7. 전이(journey) 가이드 — `mce-journey-agent`가 참조 (⚠️ BU 고정값)

> 저니 빌드 공통 규칙(페이로드·액티비티·entryMode)은 [`reference/journey-build.md`](../journey-build.md)·[`reference/fixed-values.md`](../fixed-values.md)를 따르고, **아래는 이 BU에서만 유효한 고정값**이다(다른 BU/고객사로 바뀌면 이 표만 교체).

### 7-1. 발송 고정값 (이메일 액티비티 `triggeredSend`)

| 항목 | 이름 | GUID / ID |
|---|---|---|
| Send Classification | Default Commercial | `<확인필요: sfmc_get_send_classifications>` |
| Sender Profile | Default | `<확인필요: sfmc_get_sender_profiles>` |
| Delivery Profile | Default | `<확인필요: Delivery Profile ID>` |
| Publication List | <BU Publication List 이름> | `<확인필요: sfmc_get_lists>` |

> ⛔ **사용 전 `sfmc_get_send_classifications`·`sfmc_get_sender_profiles`·`sfmc_get_lists`로 현재 BU 실제 값을 재확인한다.** 다른 BU의 GUID를 그대로 쓰면 저니가 발행·발송되지 않는다(`error-log.md` 참조).

### 7-2. 알림톡/문자 (REST 커스텀 액티비티)

| 항목 | 값 | 비고 |
|---|---|---|
| `applicationExtensionKey` | `<appExtKey>` | 이 BU 운영 알림톡 저니(CP_038/040 등) 공통 키 |
| 모바일 컨텐츠 seq (예) | `<seq>` | 웰컴 알림톡 검증값. 실제 seq는 채널 해소 단계에서 micrm 조회로 확정 |

> ⚠️ 이 값들은 **BU마다 다르다.** 다른 BU 값을 쓰면 JB UI에서 "사용할 수 없는 콘텐츠"로 뜬다. 기존 알림톡 저니를 `sfmc_get_journeys`로 조회해 재확인 가능(상세: [`reference/journey-build.md`](../journey-build.md) ④, [`reference/error-log.md`](../error-log.md)).
