# 분석 가이드 — 공통(베이스) 방법론 (모든 고객사 공통)

> 이 파일은 **고객사와 무관하게 동일한 "분석·추천 방법론"** 만 담는다.
> 실제 컬럼명·기준선·세그먼트 조건·DE Key 등 **고객사마다 바뀌는 값은 절대 여기에 두지 않는다.**
> 그런 값은 **활성 고객사 분석 가이드 파일**(예: [`ecommerce-default.md`](ecommerce-default.md))에 있다.
>
> **읽는 순서**: 이 `_common.md`(방법) → 활성 고객사 분석 가이드(`ecommerce-default.md`, 값) 순으로 함께 읽는다.
> 활성 고객사 가이드의 경로는 [`../active-customer.json`](../active-customer.json)의 `analysis_guide` 하나로 정해진다(문서에 고객사명을 중복 기재하지 않는다).

---

## 1. 진단의 차원 — 1·2·3차원

추천은 **고객 데이터 진단에 근거**한다. 단순히 "컬럼이 있으니 가능"이 아니라, **실제 값을 집계해 비중이 두드러진 지점을 찾아** 그에 맞는 캠페인을 우선 추천한다.

- **1차원**: 필드 존재 → "생일 필드 있음 → 생일 캠페인 가능"
- **2차원**: 데이터 값 → "이탈 12,400명 → 이탈 캠페인"
- **3차원(목표)**: 데이터 분석 → "이탈위험 32% → 이탈 고객 재구매 유도 **추천**"

> ⚠️ **출력엔 "약점/주목" 단어·컬럼을 쓰지 않는다.** 사용자에겐 **지표·인원·비율·추천 캠페인**만, **비율 높은 순**으로 보여준다. (기준선 초과 여부는 추천 순위 산정용 내부 참고값일 뿐.)

---

## 2. 컬럼 프로파일링 → 캠페인 도출 (자율 추천 방법)

> ⭐ **캠페인 목록·기준선을 분석 가이드에 미리 정해두고 고르는 게 아니다.** AI가 **마스터 DE 컬럼을 프로파일링**(집계로 분포 파악)해서 **두드러진 지점을 스스로 찾아** 캠페인을 도출한다. 분석 가이드가 주는 건 §1 스키마(어떤 컬럼) + §2 의미규칙(그 컬럼이 무슨 뜻)뿐이고, "무엇을 측정할지·무엇을 추천할지·기준선 얼마"는 **AI가 데이터를 보고 정한다.**

### 2-1. 프로파일링 (컬럼 타입별로 분포를 집계)

고객사 분석 가이드 §1 스키마의 컬럼을 타입별로 **집계 쿼리**로 프로파일링한다. (raw 행을 직접 읽지 않는다 — 부하 방지 3절.)

| 컬럼 타입 | 프로파일링 방법 | 도출 예 |
|---|---|---|
| 날짜 (`last_login_date` 등) | **최근성 분포** — N일 이내/초과 카운트 (30·60·90…) | 로그인 90일+ 큰 덩어리 → 휴면 캠페인 |
| 수치 (`order_count`·`total_spent`) | **값 분포** — 0 / 1 / 2+ 구간, 상·하위 | order_count=1이 다수 → 2차 구매 |
| Boolean (`has_abandoned_cart`·동의) | **True/False 비율** | 장바구니 보유↑ → 리마인더 (미동의 비율은 도달 가능 기반 파악용 — 캠페인 아님) |
| 범주 (`grade`·`region`·`preferred_category`) | **값별 카운트(GROUP BY)** | 특정 등급·카테고리 쏠림 → 타겟 캠페인 |

> ⚠️ **sf-mce 제약**: 집계 결과 "값"을 직접 못 읽고 **DE `rowCount`만** 읽힌다. 따라서 프로파일링도 각 구간을 **개별 count DE(rowCount)** 로 떨궈 읽는다(§6에서 생성). 즉 "AI가 측정 대상을 정하면 → 그 세그먼트들의 count DE를 만들어 rowCount로 분포 파악".

### 2-2. 도출 (분포 → 캠페인 추천)

프로파일링 분포를 보고 AI가 **도메인 지식으로** 캠페인을 도출한다.
- **두드러진 지점**(전체 대비 비중이 크거나 매출·이탈 영향이 큰 곳)을 우선 추천, **비율 높은 순** 정렬.
- **기준선은 데이터 분포에서** 잡는다(예: "1회성이 65%로 다수"). 고정 임계값을 쓸 땐 분석 가이드 §3의 참고값을 쓰되 **"이 기준으로 가정함"을 밝힌다.**
- 분석 가이드 §2에 정의된 지표뿐 아니라, **분포에서 새로 발견한 쏠림**(특정 등급·카테고리·지역 등)도 캠페인 후보로 올린다.

**흔한 도출 예 (예시일 뿐, 고정 목록 아님):**

| 관찰된 분포 | 도출 캠페인 |
|---|---|
| 1회성 구매자 비중↑ | 2차 구매 유도 |
| 마지막 주문 90일+ 구매자↑ | 이탈 고객 재구매 유도 |
| 마지막 로그인 90일+↑ | 휴면 고객 재활성화 |
| 주문 0 (미전환)↑ | 신규 첫구매 유도 |
| 장바구니 이탈↑ | 장바구니 리마인더 |
| (범주 쏠림) 특정 카테고리·등급 집중 | 해당 세그먼트 맞춤 캠페인 |

> ⚠️ 신호는 **플래그(Boolean)로 박제하지 않는다.** 휴면·이탈·생일 등 날짜 상대 신호를 `is_dormant`로 저장하면 매일 stale 되므로, **원천 날짜·수치 컬럼**만 두고 **판정은 SQL이 계산**한다(`GETDATE()`=오늘). 쓰는 원천 컬럼·의미는 고객사 분석 가이드 §1·§2를 따른다.
> ⚠️ 출력엔 "약점/주목" 표현 금지 — 지표·인원·비율·추천 캠페인만.

---

## 3. 사전 집계 패턴 — 부하 방지 (raw 직접 스캔 금지)

모수가 크고(수십만) 거래가 수백만 건이면 **raw 데이터를 추천 때마다 스캔하면 안 된다**(부하·지연·비동기 0 오판). 대신 **사전 집계 카운트 DE**(`SEG_*`)를 미리 만들어 두고, 진단 때는 **`rowCount`만 즉시 읽는다.**

```
[새벽 Automation]                  [추천 시점 STEP 1]            [캠페인 선택 후 1-6]
Customer_Profile ─COUNT SQL─► SEG_* 카운트 DE ─rowCount 즉시 읽기─► 선택 캠페인만 발송 DE 생성
 (raw, 그대로)               세그먼트별 인원     비율→추천(대기 없음)  (조건+동의 필터+발송 컬럼)
```

- **원본은 그대로.** 무거운 집계는 매일 새벽 Automation이 미리 수행해 `SEG_*` 카운트 DE(보통 식별자 1컬럼·비-sendable)에 적재한다.
- **진단(STEP 1)**: 이미 집계된 `SEG_*`의 **`rowCount`만 읽어** 즉시 진단한다(대기 없음).
  - ⚠️ **읽기 채널 = rowCount**: sf-mce는 DE 행 값 일괄읽기 도구가 없다(단건 PK 조회는 SQL/import 행을 404). `rowCount`(메타)만 항상 읽힘 → "세그먼트 인원 = DE 행 수"로 rowCount만 읽는다. (data-cloud `get_de_rows`는 다른 BU라 사용 불가.)
- **발송(진입) DE는 캠페인을 고른 뒤** STEP 1-6에서 생성한다 — 세그먼트 조건 + **채널 동의 필터** + 발송 컬럼. (발송 인원 = 세그먼트 ∩ 동의 → 진단 인원보다 작음.)
- ⚠️ **즉석 집계(on-demand)는 채택하지 않는다** — 추천 때마다 1~2분 대기 + 비동기 race(rowCount 0 오판)로 불안정.

**진단 읽기 절차 (대기 없음):**
1. 모수 DE + 각 `SEG_*` DE의 **rowCount**를 `sfmc_get_data_extension`(GUID)로 읽는다. (GUID는 `sfmc_get_data_extensions($search:"<접두어>_SEG_")`로 조회 — ⚠️ 접두어 없이 `"SEG_"` 로 조회하면 **다른 고객사·다른 교육생의 DE가 섞여 잡힌다**.)
2. **비율** = 세그먼트 rowCount / 분모 rowCount → 고객사 분석 가이드의 기준선과 대조 → **비율 높은 순** 추천.

> `SEG_*`/Automation이 **아예 없으면** = 최초 구축 → 6절 부트스트랩으로 **자동 생성 후** 읽는다. DE/Automation은 있는데 rowCount만 0이면 = 비동기 지연이거나 실제 0명 → 재생성하지 말고 잠시 후 재확인한다. **"데이터가 SQL 레이어에 없다"는 식으로 오판 금지**(비동기 지연일 뿐).
> ⚠️ **현재 한계 — 추세 미지원**: `SEG_*`가 매일 overwrite면 스냅샷만 본다. 추세까지 보려면 별도 이력 DE에 `snapshot_date`+세그먼트별 rowCount를 매일 append로 쌓는다(후속 과제).

---

## 4. 동의 필터 원칙 (채널별)

발송(진입) DE 생성 시 **채널 동의 필터를 반드시 결합**한다:
- 이메일 캠페인 → 이메일 수신 동의 컬럼 `= 'True'`
- SMS/알림톡/카카오 → SMS 수신 동의 컬럼 `= 'True'`

> ⚠️ **완전 미동의자 대상 "동의 확보" 마케팅 캠페인은 추천·발송하지 않는다** — 미동의자에게 이메일·알림톡 등으로 광고성 메시지를 보내는 것 자체가 발송 불가(도달 채널 없음). 동의 필터를 우회해 미동의자에게 발송하는 저니를 만들지 않는다.
> 실제 동의 컬럼명은 고객사 분석 가이드의 스키마 매핑을 따른다.

---

## 5. 폴더 탐색 fallback (분석 소스가 없을 때)

고객사 분석 가이드에 지정된 분석 소스 DE가 없거나 비어 있을 때만 아래로 폴백한다.

1. `sfmc_get_data_extension_folders` 로 폴더(카테고리) 트리를 조회한다.
2. 폴더명을 사용자 의도와 대조해 관련 폴더를 1~3개 선정한다(Welcome/Churn/Cart/Birthday/Coupon/Grade 등).
3. 선정 폴더에 대해 `sfmc_get_data_extensions_by_category` 로 해당 폴더의 DE만 조회한다.
4. 그래도 부족하면 `sfmc_get_data_extensions` 전체 조회 후 이름/설명으로 1차 필터한다.

---

## 6. ③ 집계 DE 자동 생성 — 진단 인프라 부트스트랩

진단은 사전집계 `SEG_*` 카운트 DE에 의존한다(3절). 이 `SEG_*` DE와 진단 Automation을 **사람이 미리 만들어 두지 않아도**, **Claude가 활성 고객사 분석 가이드를 입력으로 읽어 집계 쿼리·DE·Automation을 자동 생성**한다. 이것이 "AI에게 raw를 다 던지지 말고, 고객사 규칙이 담긴 MD를 읽혀 스스로 집계 테이블을 만들게 한다"는 설계의 핵심이다.

> ⚠️ **대전제 (부하 방지)**: 자동 생성하는 것은 **집계 쿼리/DE/스케줄**이지, raw를 읽어오는 코드가 아니다. 무거운 집계는 SFMC Automation(서버)이 수행하고, Claude·진단은 그 결과 `rowCount`만 읽는다(3절). 어떤 단계에서도 Claude가 수십만 행을 직접 끌어오지 않는다.

### 6-0. 원천이 여러 테이블일 때 — 다중 엔티티 → 프로파일 집계 (⚠️ 선행 단계)

> 실제 고객사 원천은 **단일 평탄화 DE가 아니라 정규화된 여러 엔티티**인 경우가 많다(예: `고객`·`구매마스터(주문)`·`구매상세`·`제품`·`쿠폰`, 고객 1:N 주문, 주문 1:N 상세, 상세 N:1 제품). 이때 `order_count`·`total_spent`·`last_order_date`·`preferred_category`·`unused_coupon_count` 같은 **진단 지표는 원본 컬럼이 아니라 여러 테이블을 JOIN·집계해야 나오는 파생값**이다. 따라서 `SEG_*` 카운트(6-2)를 만들기 **전에**, 먼저 이 파생값들을 담은 **중간 "고객 프로파일 DE"를 JOIN 집계로 생성**한다. (원천이 이미 단일 프로파일 DE면 이 단계는 건너뛴다.)

**원칙:**
- ⭐ **컬럼명은 원본 그대로 쓴다 (rename 금지)** — RAW DE도 `RECON_Profile`도 고객사 원본 컬럼명을 유지한다. 아래 SQL 예시의 `member_id`·`order_amount`는 **표준 개념 이름일 뿐** 실제 컬럼명이 아니다. 실제 SQL은 활성 고객사 가이드 §1 매핑표를 읽어 **그 고객사의 원본 컬럼명으로 조립**한다(예: `c.CustomerID`, `o.PAY_AMT`).
- **재계산 파생값만 새 이름을 붙인다** — 원천에 없는 집계값(주문 건수·총구매액·마지막 주문일·선호 카테고리·미사용 쿠폰 수)은 원본에 대응 컬럼이 없으므로 가이드 §1에 정한 이름으로 새로 만든다. 이 이름들은 가이드 §1에 반드시 기록한다.
- ⚠️ **박제 파생값과 충돌 주의** — 원천 고객 테이블이 이미 집계된 평탄화 프로파일이면(`TotalPurchaseAmount`·`PurchaseCount`·`LastPurchaseDate` 등) **같은 지표에 답이 둘**이 된다. **재계산본이 정답**이고, 박제 컬럼은 `RECON_DIFF` 대조 검증용으로만 쓴다. 진단·세그먼트는 재계산본을 참조한다.
- **파생값은 박제하지 말고 원천에서 계산한다** — 프로파일 DE 자체도 Automation SQL로 **매번 재집계**(Overwrite). 원천 테이블·관계·파생 정의는 활성 고객사 분석 가이드 §1(스키마)에 엔티티·조인키로 명시한다(컬럼명·키는 고객사 파일, 방법은 여기).
- **집계는 서버측 SQL JOIN** — Claude가 원천 스키마를 읽고 JOIN·GROUP BY SQL을 **직접 조립**한다(§6-2와 동일 정신). raw 행을 끌어오지 않는다(부하 방지 대전제 유지).
- **타입 보정은 SQL에서** — 원본이 문자열 날짜/숫자라 비교가 안 되면 빌드 SQL에서 `CAST`/`CONVERT`로 처리한다(적재 시점에 바꾸지 않는다).
- 프로파일 DE가 완성되면 그 위에서 §2 프로파일링 / §3 rowCount 진단 / 6-2 `SEG_*` 생성을 **그대로** 수행한다(하류는 단일 DE 때와 동일).

**검증된 집계 패턴** (2026-07-03 실측: 다중 5테이블 → 프로파일 재구성이 원본 파생값과 **불일치 0/5,000** 확인. 테스트 하네스 = `RAW_Customers`·`RAW_Orders`·`RAW_OrderDetails`·`RAW_Products`·`RAW_Coupons` → `RECON_Profile`, 대조 `RECON_DIFF`):

> ⚠️ **아래 SQL의 컬럼명은 "개념 이름"이지 실제 컬럼명이 아니다.** 구조(JOIN 형태·집계 함수·`LEFT JOIN`+`COALESCE`·`ROW_NUMBER` 최빈값)만 그대로 쓰고, **컬럼명은 가이드 §1 매핑표의 원본명으로 바꿔** 조립한다.

```sql
SELECT c.member_id,
       COALESCE(o.order_count,0)   AS order_count,      -- COUNT(주문)
       COALESCE(o.total_spent,0)   AS total_spent,      -- SUM(주문금액)
       o.last_order_date,                               -- MAX(주문일)
       pc.category                 AS preferred_category,-- 상세⨝제품 최빈 카테고리(ROW_NUMBER)
       COALESCE(cp.unused_coupon_count,0) AS unused_coupon_count -- COUNT(미사용 쿠폰)
FROM   Customers c
LEFT JOIN (SELECT member_id, COUNT(*) order_count, SUM(order_amount) total_spent,
                  MAX(order_date) last_order_date FROM Orders GROUP BY member_id) o ON o.member_id=c.member_id
LEFT JOIN (SELECT member_id, COUNT(*) unused_coupon_count FROM Coupons WHERE is_used='False' GROUP BY member_id) cp ON cp.member_id=c.member_id
LEFT JOIN (SELECT member_id, category FROM (SELECT o2.member_id, p.category,
                  ROW_NUMBER() OVER (PARTITION BY o2.member_id ORDER BY COUNT(*) DESC) rn
                  FROM Orders o2 JOIN OrderDetails d ON d.order_id=o2.order_id
                  JOIN Products p ON p.product_id=d.product_id GROUP BY o2.member_id,p.category) z WHERE rn=1) pc ON pc.member_id=c.member_id
```

**주의 (실측에서 확인된 한계):**
- **`LEFT JOIN` + `COALESCE(...,0)`** 로 비구매자(주문 0건)도 프로파일에 남긴다(모수 누락 방지).
- **비구매자의 `preferred_category`는 구매내역으로 도출 불가** — 주문이 없으면 NULL. 선호를 열람/기타 신호로 잡아야 하면 그 원천을 별도로 조인한다(구매 기반만으로는 못 채움을 명시).
- **금액 합산 반올림** — 파생 금액을 나눴다 합치면 센트 단위 오차가 날 수 있으니 정합성 대조 시 소액 허용오차를 둔다.
- 프로파일 DE도 **stale 대상**이다(6-1b) — 원천이 바뀌면 재집계한다.

### 6-1. 언제 실행하나 (트리거)

STEP 1 진단 시작 시 `sfmc_get_data_extensions($search:"SEG_")`로 현재 `SEG_*` DE를 조회해 **활성 고객사 분석 가이드의 "세그먼트 정의" 표**와 대조한다.

| 상태 | 동작 |
|---|---|
| 정의된 `SEG_*`가 **전부 존재 + Automation 존재 + 신선함** | 부트스트랩 **건너뜀** → 3절대로 `rowCount`만 읽음 (평상시, 부하·대기 0) |
| `SEG_*` 일부/전부 없음, 또는 Automation 없음 | 6-2 부트스트랩으로 **생성** |
| **`SEG_*`는 있지만 낡음(stale)** | **6-1b 신선도 체크**대로 **재집계**(생성 아님) 후 읽음 |
| 분석 가이드 조건이 바뀜(기존 쿼리 WHERE ≠ 분석 가이드) | 해당 SQL Query만 6-2로 **갱신** |

> ⚠️ **평상시 재생성 금지**: 이미 구축돼 있으면 DE/Automation을 다시 만들지 않는다(부하·중복 방지). "없을 때 1회 구축"이면 충분하고, 갱신은 재집계(6-1b)로 한다.

### 6-1b. 신선도 체크 (stale 감지 → 재집계) — ⚠️ 필수

`SEG_*`가 "있으니 OK"로 끝내지 말고, **집계본이 현재 마스터 DE를 반영하는지** 확인한다. 아래 중 하나라도 해당하면 **stale(낡음)** 으로 보고 **재집계**한다:

1. 진단 Automation이 **멈춰 있음**(`status = PausedSchedule` 등 미가동) — 새벽 자동 갱신이 안 돌고 있다는 뜻.
2. Automation `lastRunTime` < 마스터 DE의 **최근 import/`modifiedDate`** — 데이터가 집계 이후에 바뀜.
3. 모수 정합성 깨짐 — 예: `SEG_buyers` 등 세그먼트 합/비율이 마스터 `rowCount` 규모와 명백히 안 맞음(모수 10만인데 구매자 7,901 등).

**재집계 절차** (생성이 아니라 갱신):
- `sfmc_run_automation(<진단 Automation id>)`로 1회 실행(또는 각 세그먼트 쿼리 `sfmc_run_sql_query`) → **1~2분 대기**(비동기, 순차 실행되어 일부만 먼저 갱신될 수 있음) → 전 세그먼트 `rowCount` 재조회로 확인 후 진단.
- ⚠️ **DE·Automation·쿼리를 새로 만들지 않는다** — 기존 것을 다시 돌리기만 한다(부하·중복 방지).
- 재집계로 얻은 값이 **현재 진단값**이다. 낡은 스냅샷을 그대로 보고하지 말 것(6-3 정직 보고).

> 💡 근본 해결: 진단 Automation을 **활성 스케줄(매일 03:00)로 유지**하면 매일 자동 갱신되어 stale이 안 생긴다. 멈춰 있으면 위 재집계로 그때그때 맞춘다.

### 6-2. 생성 절차 (Claude가 "지표 정의"로부터 SQL을 조립)

> 🔑 **이름은 전부 활성 고객사 가이드에 적힌 그대로 쓴다** — `SEG_*`·Automation 모두 `<접두어>_` 가 붙은
> 실제 생성명이다([`../schema-mapping.md`](../schema-mapping.md) "🔑 `<접두어>`"). 접두어를 떼고 만들면
> 같은 BU의 다른 고객사·다른 교육생 DE를 덮어쓴다. **조회도 `$search:"<접두어>_SEG_"` 처럼 접두어로 한다.**

활성 고객사 분석 가이드의 ① 분석 소스 DE·스키마(§1) ② **지표 정의(§2 — 말로 된 정의 + 의미 규칙)** ③ 기본 진단 세트 목록(§4)을 읽어, 기본 세트의 각 세그먼트마다 아래를 수행한다.

> ⭐ **쿼리는 "복사"가 아니라 "생성"이다.** 분석 가이드 §2의 **자연어 지표 정의**(예: "휴면 = 마지막 로그인 후 90일 경과")와 §1 스키마 컬럼명으로 **Claude가 WHERE 절을 직접 작성**한다. §2의 SQL 예시는 참고용이며, 정의가 바뀌면(휴면 90→60일, 거래액에서 세금 제외 등) 생성되는 쿼리도 따라 바뀐다.

1. **카운트 DE 생성** (없을 때만) — `sfmc_create_data_extension`
   - 필드 **1개**: 분석 소스의 Contact Key와 동일(예 `member_id`, 동일 타입/길이), **비-sendable**.
   - 위치: 분석 가이드(§4)가 지정한 카운트 DE 폴더.

2. **집계 SQL Query 생성/갱신** — `sfmc_create_sql_query` (변경 시 `sfmc_update_sql_query`)
   - §2 지표 정의를 SQL로 번역해 조립한다:
     ```sql
     SELECT <ContactKey> FROM <분석 소스 DE> WHERE <§2 정의로 작성한 조건>
     ```
   - ⚠️ **`SELECT *` 또는 raw 다중 컬럼 금지** — Contact Key **1컬럼만** SELECT(집계 결과 식별자만 적재 → 저장·부하 최소).
   - `targetDataExtension` = 해당 `SEG_*` DE, `targetUpdateType` = **Overwrite**.
   - ⚠️ 생성 전 `sfmc_validate_sql_query`로 문법을 검증한다(오타·컬럼 부재 조기 발견).
   - 📐 **쿼리문은 여러 줄로 작성한다** — 아래 "SQL 작성 서식" 규칙을 따른다.

### 📐 SQL 작성 서식 (모든 Query Activity 공통 — 필수)

`sfmc_create_sql_query`·`sfmc_update_sql_query`의 `queryText`에 **실제 개행(`\n`)을 넣어** 여러 줄로 작성한다.
한 줄로 flatten해서 보내면 SFMC 콘솔 Query Activity 편집창에 **한 줄로 그대로 저장돼** 사람이 읽거나 수정할 수 없다.

| 규칙 | 내용 |
|---|---|
| 절 단위 줄바꿈 | `SELECT` / `FROM` / `JOIN` / `WHERE` / `GROUP BY` / `HAVING` / `ORDER BY`는 **각각 새 줄**에서 시작 |
| SELECT 컬럼 | 컬럼 **1개당 1줄** (컬럼 3개 이하의 단순 쿼리는 한 줄 허용) |
| 들여쓰기 | 2칸. 서브쿼리·`JOIN` 조건은 한 단계 더 들여씀 |
| 블록 분리 | `UNION ALL`로 잇는 각 블록, 상관 서브쿼리는 **앞뒤 빈 줄**로 분리 |
| 조건 나열 | `WHERE`의 `AND`/`OR`는 줄 **앞**에 두어 세로로 정렬 |
| 주석 | 블록 의도가 자명하지 않으면 `--` 한 줄 주석을 블록 위에 붙임 |

```sql
SELECT
  c.member_id,
  c.email,
  o.order_count
FROM <접두어>_RAW_Customers c
  LEFT JOIN (
    SELECT member_id, COUNT(*) AS order_count
    FROM <접두어>_RAW_Orders
    GROUP BY member_id
  ) o ON o.member_id = c.member_id
WHERE c.email_consent = 'True'
  AND DATEDIFF(day, c.last_login_date, GETDATE()) >= 90
```

> 생성 후 `sfmc_get_sql_query`로 재조회해 **개행이 보존됐는지** 확인한다(도구·직렬화 과정에서 깨질 수 있음).

3. **진단 Automation 생성/갱신** — `sfmc_create_automation` (이름은 분석 가이드 지정, 예 `CP_DIAGNOSIS_AUTOMATION`)
   - 위 SQL Query들을 스텝으로 포함, **매일 03:00 KST Scheduled**, 각 Query는 Overwrite.

4. **1회 즉시 실행** — `sfmc_run_automation`(또는 각 `sfmc_run_sql_query`) → **1~2분 후** `rowCount` 확인 → 3절 진단으로 진행.
   - ⚠️ SQL Query는 비동기다. `run` 직후 rowCount 0을 보고 "데이터 없음"으로 오판하지 말 것(비동기 지연).

### 6-3. 🚨 생성 후 검증 의무 (오보 방지 — 절대 생략 금지)

> **"만들었다"고 보고하기 전에, 반드시 라이브로 다시 조회해 실재를 확인한다.** (과거에 이미 있던 객체를 "새로 만들었다"고 잘못 보고한 사례가 있었다.)

각 생성 직후 `sfmc_get_data_extensions($search:"SEG_")` / `sfmc_get_sql_queries` / `sfmc_get_automations`로 재조회해 **다음을 확인하고, 확인된 것만 보고**한다:

1. **실재 여부**: 응답에 해당 객체가 실제로 있는가.
2. **`createdDate`가 "오늘"인가** — 오늘이 아니면 **내가 만든 게 아니라 기존 객체**다. "신규 생성"이라고 보고하지 말고 "기존에 존재(생성일 YYYY-MM-DD)"로 보고한다.
3. **`rowCount`는 재조회로 읽은 실제 값**만 보고한다 — 머릿속 추정·예상치를 적지 않는다.
4. **실패한 생성**은 실패로 보고한다(성공으로 가장하지 않는다).

> 이 검증을 통과하지 못한 항목은 결과 표에 "생성됨"으로 적지 않는다. 추정 rowCount·추정 생성 결과를 보고하는 것은 금지다.

### 6-4. 캠페인 특정·커스텀 쿼리 생성 (고정 세트 밖)

기본 진단 세트(§4)에 없는 캠페인·세그먼트(예: "VIP 중 장바구니 3일 경과", "선호 카테고리=뷰티 & 휴면")는 **즉석 생성**한다:
- 사용자 의도를 §1 스키마 컬럼 + §2 지표 정의로 해석해 WHERE 절을 조립한다.
- 캠페인 선택 후 **발송(진입) DE 쿼리**는 위 조건 + 채널 동의 필터(§2-3)를 AND로 결합해 작성한다(SKILL.md 1-6). 발송 DE는 SubscriberKey 등 발송에 필요한 컬럼을 SELECT(진단용 1컬럼과 다름).
- 정의에 없는 새 기준으로 만들었으면 **어떤 컬럼·기준으로 조립했는지 1줄 밝힌다**(임의 컬럼 생성 금지 — 스키마에 없으면 그 사실을 알린다).

### 6-3. 새 고객사로 갈아끼울 때

활성 고객사 분석 가이드 파일의 **세그먼트 정의 표만 고치면**(예: 휴면 기준 90→60일, 세그먼트 추가/삭제), 다음 진단 때 6-1 트리거가 불일치를 감지해 쿼리·DE·Automation을 **그 정의대로 자동 재구성**한다. 코드·에이전트·공통 문서는 손대지 않는다.
