# 스키마 매핑 (STEP 0) — 고객 스키마 분석 → 개념 태깅 → GCS 데이터 인입 세팅

> **이 문서는 STEP 0(스키마 분석)의 단일 출처(SSOT)다.** 워커 `mce-schema-agent`와 오케스트레이터가 함께 따른다.
> STEP 0는 **캠페인 생성(STEP 1~4)의 앞단**이다. 고객마다 파일명·컬럼명이 제각각인 원천 데이터를,
> **원본 컬럼명 그대로** RAW DE에 담고 각 컬럼에 표준 개념을 태깅한 뒤, GCS Import를 세팅해 **STEP 1(값 분석)이 그대로 돌 수 있는 상태**를 만든다.

```
[STEP 0] 스키마 분석 → 개념 태깅 → 핵심 컬럼 확인(HITL) → RAW DE(원본 컬럼명) + GCS Import + Automation + 가이드 MD
   │  산출물 ①: 매핑표(구조) — 데이터 없이도 나옴
   ▼  ⏳ 데이터 적재 게이트 (고객이 GCS 버킷에 업로드 → Import가 RAW DE 채움)
[STEP 1] 값 분석 → 진단 → 분석 리포트(PPT)   ← 산출물 ②
[STEP 2~4] 기획/정의서 → Journey → 결과 보고
```

> ⭐ **설계 원리 — 원본 컬럼명 보존이 "계약"이다.** RAW DE·`RECON_Profile`·진단 SQL 모두 고객사 **원본 컬럼명을 그대로** 쓴다(rename 금지). 표준 이름은 DE에 넣는 이름이 아니라 "이 컬럼이 어떤 개념인가"를 나타내는 **의미 사전**이다.
> 하류(STEP 1~4)가 원본명으로 동작할 수 있게 해주는 것은 **가이드 MD §1의 매핑표**이므로, STEP 0의 핵심 산출물은 그 매핑표다. 기존 시스템은 이미 "가이드 MD만 있으면 프로파일 빌드·집계·진단·리포트가 자동"이도록 설계돼 있고([`analysis-guide/_common.md`](analysis-guide/_common.md) §6), 진단 SQL도 **복사가 아니라 가이드를 읽어 생성**되므로 컬럼명이 원본이어도 그대로 돈다. STEP 0는 지금 **사람이 손으로 쓰던 그 가이드 MD를 자동 생성**하는 일이다.
>
> 왜 rename하지 않나: ① 번역 손실·매핑 오류가 조용히 굳는 것을 막고(원본이 DE에 남아 있어야 대조 가능) ② Import를 `InferFromColumnHeadings`로 단순화하며 ③ 원천 전 컬럼을 무손실로 확보해 나중에 필요해진 컬럼을 재적재 없이 쓸 수 있다.

---

## 0. 언제 실행하나 (트리거)

- **신규 고객사 온보딩** — 고객 원천 데이터를 이 패키지로 처음 붙일 때 1회.
- 사용자가 스키마 파일(DDL/CSV)을 첨부하며 "스키마 분석", "이 데이터 붙여줘", "매핑해줘"라고 할 때.
- 캠페인 생성 요청인데 활성 고객사 가이드가 아직 없거나 원천 RAW DE가 비어 있을 때(오케스트레이터가 STEP 0를 먼저 태운다).

> 이미 활성 고객사 가이드 + RAW DE가 갖춰진 계정에서는 STEP 0를 다시 돌리지 않는다(부하·중복 방지). 스키마가 바뀐 경우만 재실행.

---

## 1. 입력 (A안 — 스키마 파일)

STEP 0는 **스키마(구조)** 만 있으면 된다. 실제 데이터 행은 필요 없다.

| 형태 | 받는 것 | 파싱 방법 |
|---|---|---|
| **DDL** (`.sql`) | `CREATE TABLE …` 정의 (컬럼·타입·PK/FK·COMMENT) | 테이블·컬럼·타입·키·주석 추출 |
| **CSV** (`.csv`) | 파일당 **헤더 + 샘플 행 몇 개** | 헤더=컬럼명, 샘플 값으로 타입·의미 추론 |
| **템플릿 시트** (xlsx) | 데이터정보 템플릿 "3.스키마(직접 기입)" 시트 (테이블명·컬럼명·타입·설명·샘플) | 시트 행을 컬럼 정의로 읽음 (파일 미제공 고객사 경로) |
| **ERD** (이미지/PDF) | 테이블 관계도 | **보조 입력** — 관계(조인키) 확인용으로 우선 활용. 전 컬럼·타입이 판독 가능한 상세 ERD면 단독 입력 허용(판독 불가 항목은 HITL로) |

- 여러 파일(엔티티)이 함께 온다: 보통 **고객 / 주문(구매마스터) / 주문상세 / 상품 / 쿠폰** 5종(고객사에 따라 가감).
- CSV는 값이 있으면 타입 추론이 쉬워지므로 **샘플 3~10행**을 권장. 헤더만 있어도 진행하되 추론 신뢰도를 낮춘다.
- 파일명 자체도 힌트다(예: `CUST_MST.csv` → 고객 마스터). 단 파일명만으로 단정하지 말고 컬럼으로 검증한다.

---

## 2. 표준 개념 (매핑 목표가 아니라 "의미 사전")

> ⭐ **컬럼명은 고객사 원본을 그대로 쓴다 (rename 금지).** RAW DE도, `RECON_Profile`도, 진단 SQL도
> 고객사 원천의 컬럼명을 그대로 참조한다. 아래 표준 이름은 **DE에 넣는 이름이 아니라**,
> "이 원본 컬럼이 어떤 개념인가"를 태깅하기 위한 **의미 사전**이다.
> 표준 이름으로 바꿔 적재하지 않는다 — 번역 손실·매핑 오류·원본 대조 불가를 피하기 위해서다.

아래가 STEP 1 이후가 **개념 수준에서** 기대하는 엔티티·역할이다. 각 원본 컬럼을 이 개념 중 하나에 태깅한다.
(원천이 단일 평탄화 테이블이면 일부 엔티티가 합쳐질 수 있다. 파생값은 원천에서 계산 — 박제 금지.)

| 개념 엔티티 | PK 역할 | 개념 컬럼 (← 원본 컬럼을 여기에 태깅) | 파생값(`RECON_Profile`에서 재계산) |
|---|---|---|---|
| 고객 | `member_id` | `email`, `phone`, `birthday`, `grade`, `region`, `signup_date`, `last_login_date`, `email_consent`, `sms_consent`, `has_abandoned_cart`, `cart_total_amount`, `points_balance`, `points_expire_date` | — |
| 주문 | `order_id` | `member_id`, `order_date`, `order_amount`, `order_status` | `order_count`, `total_spent`, `last_order_date` |
| 주문상세 | `detail_id` | `order_id`, `product_id`, `quantity`, `price` | (제품 조인) |
| 제품 | `product_id` | `product_name`, `category`, `price` | `preferred_category` |
| 쿠폰 | `coupon_id` | `member_id`, `issue_date`, `coupon_expire_date`, `used_flag` | `unused_coupon_count` |

**태깅 결과는 가이드 MD §1의 매핑표에 기록한다.** 이 매핑표가 하류의 **유일한 번역 사전**이므로 누락하면 안 된다.

```
예) GCS_Test_Customer(원본) → 개념 태깅
    CustomerID          → member_id (PK)
    EmailOptIn          → email_consent   (Y/N)
    TotalPurchaseAmount → total_spent 개념 ⚠ 박제 파생값 — 주문 원천 인입 후에는 재계산본이 정답
```

> 개념 정의·의미규칙의 상세 SSOT는 활성 고객사 가이드 템플릿 [`analysis-guide/ecommerce-default.md`](analysis-guide/ecommerce-default.md) §1·§2. **여기 없는 개념을 지어내지 않는다.**
> 원천에만 있고 개념 표에 없는 컬럼도 **그대로 적재한다**(원본 무손실이 원칙). 가이드 §1에 "확장 컬럼"으로 의미만 적어 둔다.
>
> ⚠️ **박제 파생값 주의** — 원천이 이미 집계된 평탄화 프로파일이면(`TotalPurchaseAmount`·`PurchaseCount`·`LastPurchaseDate` 등) 그 값은 스냅샷이다.
> 나중에 주문·주문상세 원천이 들어오면 **같은 지표에 답이 둘**이 된다. 이때는 **재계산본이 정답**이고 박제 컬럼은 **대조 검증용**으로만 쓴다.
> 가이드 §1에 해당 컬럼을 "박제 파생값(대조용)"으로 표시한다.

---

## 3. 스키마 분석 + 매핑 (매핑 산출)

### 3-1. 엔티티·컬럼·관계 파악
1. 각 파일 = 어떤 표준 엔티티인지 판정(컬럼 구성·PK·파일명 종합). 애매하면 후보를 표시한다.
2. 컬럼별 **타입**(정수/실수/날짜/문자/불리언)과 **역할**(식별자·외래키·날짜·금액·수량·플래그·범주) 추정.
3. **관계(조인키)** 파악: `주문.회원번호 → 고객.회원번호`, `주문상세.주문번호 → 주문.주문번호`, `주문상세.상품코드 → 상품.상품코드`, `쿠폰.회원번호 → 고객.회원번호`.

### 3-2. 개념 태깅 (원본 컬럼 → 표준 개념, 1:1)
> ⚠️ **이름을 바꾸는 작업이 아니다.** 원본 컬럼명은 그대로 두고 "이 컬럼이 어떤 개념인가"만 붙인다.

태깅 근거는 3가지를 종합한다(이름만으로 단정 금지):
- **이름 유사도**: `CUST_NO`≈customer number→`member_id` 개념, `ORD_AMT`≈order amount→`order_amount` 개념.
- **타입/역할**: PK 정수+타 테이블서 FK로 쓰이면 식별자, `DECIMAL`+"AMT/PRICE"면 금액, `DATE`+"조인/로그인/주문"이면 해당 날짜.
- **샘플 값**: `Y/N`→Boolean, `010-…`→phone, `@` 포함→email, `2026-…`→date.

각 태깅에 **신뢰도(높음/보통/낮음)** 를 부여한다. 낮음·모호는 4절 HITL 후보로 올린다.
**어느 개념에도 안 붙는 컬럼도 버리지 않는다** — 확장 컬럼으로 그대로 적재하고 가이드 §1에 의미만 적는다.

### 3-3. 값 해석 규칙 식별
> 값을 **변환해 적재하지 않는다.** 원본 값을 그대로 넣고, 해석 규칙을 가이드 §2에 적어 진단 SQL이 그 규칙대로 읽게 한다.

- 불리언 표기: `Y/N`·`1/0`·`T/F` 중 무엇인지, 공란(NULL)을 어떻게 볼지 (예: `EmailOptIn`: `Y`=동의, 공란=미동의)
- 날짜 포맷: 원본이 `YYYY-MM-DD` / `YYYYMMDD` / datetime 중 무엇인지 (SQL에서 비교할 때 필요)
- 코드값 의미: `GRADE_CD`: BRONZE/SILVER/GOLD/VIP, `ORDER_STATUS`: 어떤 값이 취소·환불인지

> 💡 값 변환이 꼭 필요한 경우(예: 날짜가 문자열이라 비교 불가)는 **적재 시점이 아니라 `RECON_Profile` 빌드 SQL에서** `CAST`/`CONVERT`로 처리한다. RAW DE는 원본을 보존한다.

---

## 4. 핵심 컬럼 확인 (HITL) — ⚠️ 반드시 사용자 확인

> 워커는 격리 실행이라 **직접 묻지 못한다.** 워커는 **"확인이 필요한 항목"을 목록으로 반환**하고,
> **오케스트레이터가 `AskUserQuestion`으로 사용자에게 확정**받은 뒤(채널 해소와 동일 패턴), 그 확정값을 5절 materialize에 넘긴다.

회의 요건("이 컬럼으로 계산 맞나요?")이 여기다. **최소 아래는 반드시 확인**한다:

1. **핵심 ID (조인키)** — 전 테이블을 잇는 회원 식별자가 무엇인지 확정 (예: `CUST_NO` = `member_id` 맞나?).
2. **총구매액(`total_spent`) 산식** — 어느 금액 컬럼을 합산하나?
   - `RAW_Orders.order_amount` 합 vs `RAW_OrderDetails.price × quantity` 합 (회의 L182 "썸이 아니고 이 밑에 걸로" 사례)
   - **취소/환불 제외 여부** — `order_status`가 `CANCEL`/`REFUND`인 주문을 뺄지.
3. **날짜 기준** — `last_order_date`·`last_login_date`가 어느 컬럼인지(여러 날짜 컬럼이 있을 때).
4. **동의 값 해석** — `Y/N`을 각각 동의/미동의로 볼지, 공란은 어떻게 볼지.
5. **신뢰도 낮은 매핑** — 3-2에서 낮음/모호로 표시된 항목 전부.

확인 결과는 매핑·의미규칙에 반영한다. **사용자가 수정한 값이 우선**이다(임의로 바꾸지 않는다).

---

## 5. Materialize (확정 후) — RAW DE + GCS Import + Automation + 가이드 MD

> HITL 확정값을 받은 뒤 실행한다. **부하 방지 대전제 유지**: 원천 raw 행을 끌어오지 않는다. DE는 "빈 테이블"로 만들고, 적재는 Import(서버)가 한다.

### 5-1. RAW DE 생성 (빈 테이블) — **원본 컬럼명 그대로**
- 활성 고객사 폴더(예: `Data Extensions > test > <고객사>`)를 확인/생성(`sfmc_get_data_extension_folders` / `sfmc_create_folder`)하고 `categoryId`를 확보한다.
- 원천 파일별로 `sfmc_create_data_extension`으로 **원본 컬럼 이름 그대로** 생성한다. **rename 금지.**
  - **원천의 전 컬럼을 만든다** — 개념 태깅이 안 된 확장 컬럼도 포함(원본 무손실).
  - 타입은 원본에 맞춰 지정한다(`Date`/`Number`/`Decimal`/`Text`/`EmailAddress`). ⚠️ 전부 Text로 만들면 하류 SQL이 `CAST` 범벅이 되므로 타입은 반드시 추론해 지정한다.
  - PK는 개념 태깅에서 식별자로 잡힌 **원본 컬럼**을 지정한다(예: `CustomerID`, `ORDER_ITEM_SEQ`).
  - 생성명 규칙: `<고객사>_RAW_<원천명>_DE` (예: `LIVORA_RAW_Customers_DE`). **DE 이름은 표준 어휘, 컬럼명은 원본** — 둘을 혼동하지 않는다.
  - 비-sendable로 만든다(발송 DE 아님).
- 🚨 **생성 후 검증**: `sfmc_get_data_extensions`·`sfmc_get_data_extension_fields`로 재조회해 실제 생성·필드 구성을 확인하고, 확인된 것만 보고한다(추정 금지).

### 5-2. GCS → RAW DE Import 세팅 (**기본 인입 경로 = GCS**)

> ⭐ **이 패키지의 기본 데이터 인입 경로는 Google Cloud Storage다.** 고객사가 GCS 버킷에 원천 파일을 올리면 Import가 직접 읽어 RAW DE를 채운다.
> (SFTP·S3도 SFMC가 지원하므로 고객사 사정에 따라 대체 가능하지만, **기본 가정·기본 문구·기본 안내는 GCS**로 한다.)

**① File Location 확보 — 조회 우선, 생성은 최후**
- `sfmc_get_automation_ftp_locations`로 **기존 위치를 먼저 조회**한다. 등록된 GCS 위치가 있으면 그 `id`를 **재사용**한다(신규 생성 금지).
  - `locationTypeId`: **`16` = Google Cloud Storage** (`locationUrl` = `GCP://<버킷>/`) ← 기본. 참고: `0`=Enhanced FTP, `4`=Salesforce Objects & Reports.
- 새 위치가 꼭 필요하면 `sfmc_rest_create`(`/data/v1/filetransferlocation`)를 쓴다. ⚠️ **GCS 인증 필드 형태는 도구 문서에 없다** — 추측해서 생성하지 말고 **콘соль(Setup → Data Management → File Locations)에서 생성한 뒤 `id`만 조회해 쓰도록** 상위에 요청한다.

**② Import Definition — 원천 파일 1개당 1개**
- 전용 MCP 도구가 없으면 **`sfmc_rest_create`(`/automation/v1/imports`) 또는 `sfmc_soap_create`(ImportDefinition)** 로 생성한다.
- `fileTransferLocationId` = ①의 GCS 위치 id. **Import가 GCS에서 직접 읽으므로 File Transfer 액티비티는 만들지 않는다.**
- ⭐ **`fieldMappingType`은 `InferFromColumnHeadings`** 를 쓴다. RAW DE 컬럼명 = 원본 헤더명이므로 헤더가 그대로 맞아떨어진다. **`ManualMap` rename을 쓰지 않는다.**
  - 헤더와 DE 컬럼명이 안 맞는 예외(원천 헤더에 공백·특수문자가 있어 DE 필드명으로 못 쓰는 경우)에만 `ManualMap`을 쓰고, 그 사실을 가이드 §1에 기록한다.
- `fileSpec`(파일명 패턴): 고정 파일명이면 그대로, 날짜가 붙으면 `<원천명>_%%Year%%%%Month%%%%Day%%.csv` 패턴을 쓴다.
- `updateTypeId`: ⭐ **전 파일 `4`(Overwrite) 를 기본으로 쓴다** — 고정 파일명 전량 스냅샷 인입이므로 마스터·트랜잭션 구분 없이 Overwrite가 맞다. ⚠️ **`updateTypeId: 2` 금지** — Add-and-Update가 아니며, 빈 DE에 `Completed`/`TotalRows 0`/`NumberErrors 0` 으로 **조용히 0행 적재**된다(2026-09-04 실측, `error-log.md` 참조). 증분 파일을 받는 고객사만 HITL로 갱신 방식을 재확정한다.

**③ Import Automation — 1개**
- `sfmc_create_automation`으로 **Import들을 순차 실행하는 Automation 1개**를 만든다(파일이 N개여도 Automation은 1개).
  - 조인 대상이 되는 마스터(고객·상품)를 앞 스텝, 트랜잭션(주문·주문상세·쿠폰)을 뒤 스텝에 둔다.
- **`Ready` 상태로만 만들고 스케줄을 등록하지 않는다.** 온보딩 단계에서는 고객 파일 업로드 전이라 돌릴 게 없다. 첫 업로드 확인 후 일배치(예: 05:30 KST, `FREQ=DAILY`, `timeZoneId` 48)로 전환한다.

> ⚠️ **File Transfer 액티비티는 이 경로에 필요 없다.** Import Definition이 File Location을 직접 참조하기 때문이다. File Transfer는 반대 방향(Safehouse → 외부 FTP, 예: 감사로그 내보내기)이나 압축 해제·복호화가 필요할 때만 쓴다. (2026-09-04 계정 실측: 어반몰·LIVORA 온보딩 모두 Import만 존재, File Transfer 0개.)
> ⚠️ Import Definition 생성이 사용 가능한 도구로 불가하면, **RAW DE까지 만들고 Import 정의는 "수동/REST 필요"로 표시**해 상위에 반환한다(지어내지 않는다).

**생성 결과 요약 (파일 N개 기준)**

| 객체 | 개수 |
|---|---|
| RAW DE | N (파일당 1) |
| Import Definition | N (파일당 1) |
| Automation | 1 (Ready, 스케줄 미등록) |
| File Location | 0 (기존 GCS 위치 재사용) |
| File Transfer | 0 (불필요) |

### 5-3. 활성 고객사 가이드 MD 자동 생성
[`analysis-guide/ecommerce-default.md`](analysis-guide/ecommerce-default.md)를 **골격 템플릿**으로 복제해 `analysis-guide/<고객사>.md`를 생성한다. 채우는 내용:
- **§1 분석 소스 + 스키마**: 원천 엔티티(생성한 RAW DE명·**원본 PK 컬럼명**·폴더 `categoryId`), 조인키/관계(원본 컬럼명 기준), **원본 컬럼 → 표준 개념 매핑표**(= 하류의 유일한 번역 사전, 누락 금지), 확장 컬럼, **박제 파생값 표시**, 재계산 파생값 정의. `RECON_Profile` 빌드 대상으로 지정.
- **§2 의미규칙**: 4절 HITL로 확정한 산식(총구매액=…, 취소/환불 제외 여부, 휴면/이탈 기준 날짜 컬럼, 동의값 해석)을 **원본 컬럼명으로** 자연어 기록. 예: "휴면 = `LastPurchaseDate` 기준 90일 경과", "이메일 동의 = `EmailOptIn` = `Y`(공란은 미동의)".
- **§3 기준선 / §4 SEG_* / §5 진입DE / §6 기획 / §7 전이**: 템플릿 값을 기본으로 두되, 고객사 특이사항이 있으면 반영(없으면 템플릿 유지 — AI가 STEP 1에서 프로파일링해 정함).
- 파일 상단에 "STEP 0 자동 생성, 사람이 검토 요망" 배너와 생성일·확정 산식을 남긴다.

> `RECON_Profile`·`SEG_*`·`CP_DIAGNOSIS_AUTOMATION`은 STEP 0가 만들지 않는다 — 데이터가 적재된 뒤 **STEP 1이 이 가이드를 읽어 자동 부트스트랩**한다([`analysis-guide/_common.md`](analysis-guide/_common.md) §6). STEP 0의 책임은 **빈 RAW DE + Import + 가이드 MD**까지다.

### 5-4. 활성 고객사 전환 (오케스트레이터)
가이드 MD가 생성되면, **오케스트레이터가 사용자에게 전환 여부를 확인한 뒤** SKILL.md "활성 고객사" 줄과 CLAUDE.md 라우팅의 활성 고객사 표기를 `<고객사>`로 바꾼다. (활성 소스 변경은 시스템 전체에 영향을 주므로 **명시적 단계**로 둔다. 워커가 임의로 전환하지 않는다.)

---

## 6. 호출/반환 규약 (2-페이즈)

워커 `mce-schema-agent`는 오케스트레이터가 **두 번** 호출한다(채널 해소와 유사).

- **Phase A — 분석/제안** (입력: 스키마 파일 경로/내용)
  - 3절 수행 → **반환물**: ① 엔티티·매핑표(원본 컬럼→표준 개념 태깅, 신뢰도) ② 관계(조인키, 원본 컬럼명 기준) ③ 값 해석 규칙 ④ **박제 파생값 목록**(재계산 대상 vs 대조용) ⑤ **HITL 확인 필요 목록(4절)**. DE/Import/MD는 **아직 만들지 않는다.**
- (오케스트레이터가 4절 HITL을 `AskUserQuestion`으로 확정)
- **Phase B — Materialize** (입력: Phase A 매핑 + HITL 확정값 + 고객사명)
  - 5-1~5-3 수행 → **반환물**: 생성한 RAW DE 목록·검증 결과, Import 세팅 상태(또는 수동필요 표시), 생성한 가이드 MD 경로, 요약.
  - 5-4(활성 전환)는 오케스트레이터가 한다.

> 산출물 ①(매핑표)은 **Phase A 반환물**이며 데이터 없이 나온다. 분석 리포트(PPT)는 STEP 0가 아니라 **데이터 적재 후 STEP 1**에서 나온다.

---

## 7. 가드레일 (반드시 준수)

1. **원본 컬럼명 보존이 계약**: RAW DE·`RECON_Profile`·진단 SQL 모두 **고객사 원본 컬럼명을 그대로** 쓴다. 표준 이름으로 rename하지 않는다. 하류가 원본명을 읽을 수 있게 해주는 것은 **가이드 MD §1 매핑표**이므로, 매핑표를 반드시 완전하게 남긴다(누락 = 하류가 깨짐).
2. **부하 방지**: raw 행을 끌어오지 않는다. DE는 빈 테이블로 만들고 적재는 Import(서버)가 한다. CSV 샘플은 타입 추론용 소량만.
3. **지어내기 금지**: 없는 표준 컬럼/매핑을 만들지 않는다. 모호하면 HITL로 올린다. Import 정의가 도구로 불가하면 "수동필요"로 표시.
4. **HITL 필수**: 핵심 ID·금액 산식·취소환불·동의값은 반드시 사용자 확정을 받고 반영한다(4절).
5. **생성 후 검증 의무**: DE/Import 생성 직후 라이브 재조회로 실재·구성을 확인하고 확인된 것만 보고(추정 금지).
6. **활성 전환은 명시적으로**: 활성 고객사 줄 변경은 오케스트레이터가 사용자 확인 후에만.
7. **한국어**로 소통·보고한다.
