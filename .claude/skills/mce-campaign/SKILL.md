---
name: mce-campaign
description: >
  MCE(SFMC Marketing Cloud Engagement) 캠페인 자동 생성. 사용자가 만들고 싶은 캠페인을
  한 문장으로 말하면(예: "신규 회원 캠페인 생성", "이탈 고객 캠페인", "장바구니 캠페인",
  "생일 쿠폰", "쿠폰 친구추가") ① 주제 선정 → ② 기획/정의서 → ③ Journey 생성을 수행한다.
  "캠페인 만들어줘", "캠페인 리스트업", "어떤 캠페인 만들 수 있어", "저니 생성",
  정의서(xlsx/CSV/Google Sheets) 첨부 시에도 이 스킬을 사용한다.
---

# MCE 캠페인 자동화 — 오케스트레이터 + 하위 워커

사용자가 만들고 싶은 MCE 캠페인을 **간략한 한 문장**으로 입력하면,
**상위 에이전트(오케스트레이터)가 총괄**하여 ① 주제 선정 → ② 기획/정의서 → ③ Journey 생성을 진행하되,
각 STEP의 실제 작업은 **STEP별 하위 에이전트(워커)에게 `Agent` 도구로 위임**한다.

> **오케스트레이터 원칙**: 사용자는 상위 에이전트하고만 대화한다.
> - STEP 1 → `mce-topic-agent` / STEP 2 → `mce-planning-agent` / STEP 3 → `mce-journey-agent` 에 위임한다.
> - **사용자와의 대화·모드 선택·승인은 상위 에이전트만** 한다. 하위 에이전트는 격리 실행되어 도중에 사용자에게 질문할 수 없으므로,
>   수동 모드의 단계별 합의·승인은 **상위가 하위 호출 "사이"에서** `AskUserQuestion`으로 받는다.
> - 자동 모드는 질문 없이 세 워커를 순서대로 호출하고 맨 마지막에 결과만 1회 보고한다.
> - 상위는 하위에 그 STEP에 필요한 입력을 모두 전달하고, 하위가 반환한 결과(후보 목록·정의서 경로·Journey ID 등)를 받아 다음 위임의 입력으로 넘긴다.
>
> 아래 STEP 1~4의 상세 절차·참조 데이터는 **상위·하위 에이전트 공통의 단일 출처(SSOT)** 다. 각 워커는 자기 STEP 절에 해당하는 규칙과 `reference/` 파일을 그대로 따른다.

## 활성 고객사 분석 가이드

- **활성 고객사 = `ecommerce-default`** (일반 이커머스 / 기본 템플릿 — 실습 데이터셋 `docs/schema-samples/urbanmall/`) → 이 BU의 값(스키마·의미규칙·진입DE·기획·전이 고정값) 단일 출처는 [`reference/analysis-guide/ecommerce-default.md`](reference/analysis-guide/ecommerce-default.md). 3개 에이전트가 각자 절을 읽는다(분석 §1·2, 기획 §6, 전이 §7).
  - 기본 템플릿(`ecommerce-default`)은 [`reference/analysis-guide/ecommerce-default.md`](reference/analysis-guide/ecommerce-default.md)에 남아 있으나 **비활성**이다 — 참조하지 않는다.
- 실제 고객사 확정 시 `reference/analysis-guide/<고객사>.md` 를 만들고 이 줄의 활성 고객사만 바꾼다. 공통 방법론·에이전트·스크립트는 수정하지 않는다.

## 참조 파일 (필요 시점에 읽는다)

- **분석 가이드 — 공통(방법)** → [`reference/analysis-guide/_common.md`](reference/analysis-guide/_common.md) — 진단 차원·아키타입·사전집계(`SEG_*`)·동의 원칙·폴더 fallback (STEP 1·2 공통)
- **분석 가이드 — 고객사(값)** → [`reference/analysis-guide/ecommerce-default.md`](reference/analysis-guide/ecommerce-default.md) — §1 스키마·§2 의미규칙(분석) / §3·§4 예시·참고 / §5 진입 DE / §6 기획 / §7 전이 BU 고정값. (기준선·세그먼트는 고정 아님 — AI가 프로파일링해 도출)
- **진입 DE / 폴더 구조 (분석 가이드 진입점 요약)** → [`reference/de-and-folders.md`](reference/de-and-folders.md) — STEP 1에서 캠페인 후보를 읽을 때 (상세는 위 분석 가이드 2파일)
- **저니 페이로드 / 액티비티 규칙** → [`reference/journey-build.md`](reference/journey-build.md) — STEP 3에서 Journey 생성할 때
- **이메일 콘텐츠 표준 / 샘플 이메일** → [`reference/email-standard.md`](reference/email-standard.md) — 이메일 에셋을 만들거나 고를 때
- **SFMC 고정값(GUID 등)** → [`reference/fixed-values.md`](reference/fixed-values.md) — 저니 이메일 액티비티 구성 시
- **오류 학습 / 알려진 이슈** → [`reference/error-log.md`](reference/error-log.md) — STEP 3 시작 전 먼저 훑고, 새 오류 발생·해결 시 여기에 한 줄 추가
- **분석 리포트 생성 가이드 (D1)** → [`reference/report-guide.md`](reference/report-guide.md) — 진단 결과를 고객 전달용 PPT 리포트로 만들 때(구조·내용·디자인·품질 체크리스트 SSOT)
- **스키마 매핑 (STEP 0)** → [`reference/schema-mapping.md`](reference/schema-mapping.md) — 고객 스키마 파일(DDL/CSV)의 원본 컬럼에 표준 개념을 태깅하고 RAW DE(원본 컬럼명)·Import·가이드 MD를 세팅할 때(STEP 0 SSOT)

## 시트 정보 (Google Sheets 정의서 입력 시)

- **Spreadsheet ID**: `<확인필요: 고객사 정의서 Spreadsheet ID>`
- **URL**: `https://docs.google.com/spreadsheets/d/<확인필요: 고객사 정의서 Spreadsheet ID>`

> Apps Script는 사용하지 않는다.

## 경로

> ⚠️ **경로 자동 적용 규칙 (다른 PC에서 실행 시 필수)** — 절대경로는 작성 당시 PC 기준 예시다. 사용자명·드라이브·폴더 위치는 PC마다 다르므로 그대로 쓰지 말 것.
> **항상 현재 작업 디렉토리(cwd = 이 저장소가 clone된 위치)를 "프로젝트 루트"로 삼고, 모든 경로를 그 기준으로 도출**한다.
> - 프로젝트 루트 = 현재 cwd (환경 정보의 working directory)
> - 정의서 폴더 = `<프로젝트 루트>\campaign_definitions`
> - 정의서 생성 스크립트 = `<프로젝트 루트>\generate_campaign_definition.js`
>
> 아래에 `C:\Users\MILVUS\Desktop\mce-packege-v2-main` 가 나오는 모든 곳(STEP 2·3의 xlsx 생성/파싱 절대경로 포함)은 **실제 현재 프로젝트 루트로 치환하여 사용**한다. cwd가 예시 경로와 다르면 **무조건 cwd를 우선**한다.

- **프로젝트 루트**: `C:\Users\MILVUS\Desktop\mce-packege-v2-main` *(예시 — 실제로는 현재 cwd 사용)*
- **정의서 폴더**: `<프로젝트 루트>\campaign_definitions`
- **정의서 생성 스크립트**: `generate_campaign_definition.js` (`__dirname` 기준 자동 처리)

---

## 전체 흐름

```
(신규 고객사 온보딩 시에만 — 원천 데이터를 처음 붙일 때)
[STEP 0] 스키마 분석  →  고객 스키마 파일(DDL/CSV) 분석 → 표준 매핑
   │        Phase A: 매핑표·조인키·값변환 + HITL 확인목록 반환
   │        [★핵심 컬럼 확인] 오케스트레이터가 AskUserQuestion (핵심 ID·금액 산식·취소환불·동의값)
   │        Phase B: 빈 RAW DE(원본 컬럼명) + GCS→DE Import + Automation(Ready) + 활성 고객사 가이드 MD 자동생성
   │        → 활성 고객사 전환(오케스트레이터, 사용자 확인 후)
   ▼        ⏳ 데이터 적재 게이트 (고객이 GCS 버킷에 업로드 → Import가 RAW DE 채움)
   │
사용자: "신규 회원을 위한 캠페인 생성"
   │
   ▼
[STEP 1] 주제 선정  →  연결된 DE 분석 → 캠페인 후보 목록 추천
   │        → (리스트업/진단이면) 진단표+추천 목록만 즉시 출력 (리포트(PPT)는 사용자가 요청할 때만 생성)
   │        → 사용자가 만들 캠페인을 선택   (※ 모드와 무관, 항상 동일)
   │
   ├── (메시지 채널이 알림톡/문자/카카오/SMS인 경우만)
   │   [★채널 해소] 오케스트레이터가 micrm seq 확보  →  ① BU 연결 채널·키 확인
   │        (브라우저)                                   ② send_key로 mobileList(모바일 컨텐츠) 조회
   │                                                     ③ seq 선택(자동=의도매칭 / 수동=후보제시)
   │                                                     ④ 템플릿 변수 #{…}→DE컬럼 매핑
   ▼
[STEP 2] 실행 모드 선택  ──  수동 / 자동   (※ 기획부터 적용)
   │        Plan 설계 + xlsx 정의서 생성  (알림톡이면 위 seq·키·변수매핑을 정의서에 기록)
   │        (수동: 대화로 Plan 합의 후 정의서 생성)
   │        (자동: 기본값으로 일괄 설계 → 그대로 STEP 3까지 진행)
   ▼
[STEP 3] Journey 생성  →  SFMC Journey 생성 (기본 Draft)
   │
   ▼
[STEP 4] 결과 보고
```

> ⓪ **STEP 0(스키마 분석)은 신규 고객사 온보딩 시에만** 수행한다 — 고객 원천 데이터를 이 패키지로 처음 붙일 때 1회. 이미 활성 고객사 가이드 + RAW DE가 갖춰진 계정에서는 건너뛴다. 상세 절차·표준 개념·태깅 규칙·HITL 항목은 [`reference/schema-mapping.md`](reference/schema-mapping.md)가 SSOT이고, 실작업은 `mce-schema-agent` 워커에 위임한다(2-페이즈: 분석 → HITL → materialize). **STEP 0의 산출물은 매핑표(구조) + 빈 RAW DE + Import + 가이드 MD**까지다. (분석 리포트(PPT)는 데이터 적재 후 요청 시에만 생성)

> 사용자가 정의서(xlsx/CSV/Google Sheets)를 **직접 첨부**한 경우 STEP 1·2를 건너뛰고 STEP 3(저니 생성)으로 바로 이동한다.

> 📨 **메시지 채널이 알림톡/문자/카카오/SMS일 때만 추가되는 "채널 해소(seq 확보)" 단계** — micrm 템플릿 카탈로그 조회는 **micrm 웹세션(브라우저)이 필요**하므로 격리·헤드리스 워커는 못 한다. 따라서 **seq·`applicationExtensionKey`·변수매핑은 오케스트레이터가 STEP 2 위임 전에 브라우저로 확정**해 planning 워커에 입력으로 넘기고, 워커는 그 값을 정의서에 기록만 한다. 상세 절차는 아래 "메시지 채널 해소" 절 참조.

## 조회 요청 (읽기 전용 — 생성 흐름과 분리)

"저니 목록", "최근 저니", "저니 조회", "생성된 저니 보여줘", "automation/DE/이메일 목록" 등 **읽기 전용 조회**는 STEP 1~4 생성 흐름이 아니다. **반드시 SFMC를 실시간으로 조회**해 답한다.

- **저니 조회/목록/최근 저니** → `sfmc_get_journeys` 를 호출한다. "최근"이면 **ModifiedDate(없으면 CreatedDate) 최신순으로 정렬**해 상위 N개만 보여준다.
- **절대 `journey_history.md` 나 `campaign_definitions\` 폴더를 조회 답변의 출처로 쓰지 않는다.** 그 파일들은 "이 봇으로 만든 생성 *이력*을 보여줘"처럼 **명시적으로 로컬 이력을 요청**할 때만 사용한다.
- (정의서 입력 소스 우선순위의 "최신/방금 만든/최근 → 로컬 파일" 규칙은 **STEP 3 정의서 선택에만** 해당한다. 저니 조회에는 적용하지 않는다.)
- 조회 결과에는 가능한 한 Journey 이름·ID·상태·수정일을 함께 표기한다.

> **결과만 전달 (과정 비노출)**: 진행 과정·중간 작업·"이제 ~를 조회합니다" / "~를 생성합니다" / "~를 확인합니다" 같은 설명은 텍스트로 공유하지 않는다.
> 도구 호출이나 내부 처리 과정을 설명하지 말고, **결과물만 텍스트로 전달**한다.
> 사용자에게 노출하는 것은 다음뿐이다: 단계 전환에 필요한 질문(캠페인 선택, 모드 선택, Plan 승인), 최종 결과 보고, 그리고 오류(즉시 알림).
> 그 외 진행 상황 설명은 일절 출력하지 않는다.
>
> ⭐ **자동 모드에서도 동일**: "알아서 골라줘"로 캠페인을 자동 선정하거나 자동 모드로 일괄 진행할 때도, 단계별 진행 설명("Event Definition을 생성합니다", "스케줄을 PATCH합니다" 등)을 출력하지 않는다.
> 자동 모드는 STEP 1~4를 **무발화로 일괄 실행**하고, 맨 마지막 STEP 4 실행 결과(표 + 흐름도)만 한 번에 보여준다. (자동 선정한 캠페인이 무엇인지는 결과 보고에 1줄로 포함한다.)
>
> 🚫 **수동 모드에서도 동일 — 도구 호출 사이에 진행 멘트 금지**: 도구를 연속 실행하는 동안 그 사이에 어떤 설명 문장도 넣지 않는다.
> 다음과 같은 표현은 모두 금지: "~를 분석했습니다", "~를 설정합니다", "~를 구성합니다", "~를 기록합니다", "~했습니다", "반영해 두겠습니다", "검증된 구조를 확보했습니다" 등 진행/전환/완료 보고성 멘트.
> 침묵하며 도구를 실행하고, 사용자에게 출력하는 텍스트는 ① 단계 전환 질문, ② 최종 결과 보고, ③ 오류 — 이 셋뿐이다. 그 외에는 한 줄도 출력하지 않는다.

---

## 클릭형 선택 (수동 모드 — `AskUserQuestion` 사용)

> **STEP 2(실행 모드 선택)부터의 결정 지점은 `AskUserQuestion` 도구로 묻는다.** 사용자가 텍스트로 입력하는 대신 **버튼을 클릭**해 고르게 한다.
> (자동 모드는 질문하지 않으므로 해당 없음. 사용자가 그래도 텍스트로 답하면 그 입력을 그대로 수용한다.)
>
> ⚠️ **STEP 1-5 캠페인 후보 선택은 예외 — 클릭형이 아니라 기존 텍스트(번호/`추천`) 입력 방식을 유지한다.**

적용 지점은 4곳이며, 각 STEP의 해당 위치에 표시돼 있다:

| 지점 | 질문(header) | 클릭 옵션 |
|---|---|---|
| STEP 2 실행 모드 | `실행 모드` | `수동` / `자동` |
| STEP 2 스케줄 모드 | `스케줄` | `Recurring (반복 발송)` / `On Activation (발행 시 1회)` (Recurring 선택 시 주기·시작일·시각은 텍스트로 이어서 확정) |
| STEP 2 수동 진행 방식 | `진행 방식` | `정의서 후 승인` / `바로 저니 생성` |
| STEP 2 Plan 승인 | `Plan 승인` | `승인 (저니 생성)` / `수정할게요` |

규칙:
- 옵션 `description`에는 각 선택의 의미·결과를 한 줄로 적는다(예: 다음에 일어날 일).
- 사용자가 버튼 대신 직접 타이핑("수동", "바로", "수정")해도 동일하게 처리한다.
- "수정할게요"를 고르면 어느 항목을 바꿀지 다시 대화로 합의한 뒤 Plan을 갱신한다.

---

# STEP 0 — 스키마 분석 (신규 고객사 온보딩 시에만)

> 고객마다 파일명·컬럼명이 제각각인 원천 데이터의 **각 컬럼에 표준 개념을 태깅**하고, **빈 RAW DE(원본 컬럼명) + GCS Import + 활성 고객사 가이드 MD**를 세팅해 STEP 1이 그대로 돌 수 있게 만드는 **앞단**이다. **상세 절차·표준 개념·태깅 규칙·HITL 항목·가드레일의 SSOT = [`reference/schema-mapping.md`](reference/schema-mapping.md).** 실작업은 `mce-schema-agent` 워커에 위임한다.
>
> ⭐ **원본 컬럼명 보존이 "계약"이다.** RAW DE·`RECON_Profile`·진단 SQL 모두 고객사 **원본 컬럼명을 그대로** 쓴다(rename 금지). 표준 이름은 DE에 넣는 이름이 아니라 **의미 사전**이며, 하류가 원본명을 읽게 해주는 것은 **가이드 MD §1 매핑표**다. STEP 0는 지금 사람이 손으로 쓰던 활성 고객사 가이드 MD를 **자동 생성**하는 일이다.
> ⭐ **분석 대상은 "구조(스키마)"** 다 — 데이터 없이도 동작한다. **값 분석·캠페인 추천은 데이터 적재 후 STEP 1**에서 나온다(리포트는 요청 시에만).

## 0-1. 언제 하나
- 신규 고객사 온보딩(원천 데이터 최초 연결) 1회. 또는 사용자가 스키마 파일(DDL/CSV)을 첨부하며 "스키마 분석/매핑/이 데이터 붙여줘"라고 할 때.
- 캠페인 요청인데 **활성 고객사 가이드가 없거나 원천 RAW DE가 비어 있으면**, 오케스트레이터가 STEP 0를 먼저 태운다.
- 이미 활성 고객사 가이드 + RAW DE가 갖춰진 계정에서는 **건너뛴다**(재실행 금지, 스키마 변경 시만).

## 0-2. 오케스트레이터 진행 (2-페이즈 + 사이 HITL)

STEP 0의 HITL(핵심 컬럼 확인)은 워커가 격리 실행이라 직접 못 묻는다. **오케스트레이터가 워커 호출 "사이"에서** `AskUserQuestion`으로 받는다(채널 해소와 동일 패턴).

1. **Phase A 위임** — `mce-schema-agent`에 스키마 파일 경로/내용을 넘겨 호출 → 워커가 **매핑표(고객 컬럼→표준 컬럼)·조인키·값변환 규칙 + HITL 확인 필요 목록**을 반환한다. (DE/Import/MD는 아직 안 만듦 = **산출물 ① 매핑표**, 데이터 없이 나옴)
2. **핵심 컬럼 확인(HITL)** — 오케스트레이터가 워커가 올린 항목을 `AskUserQuestion`으로 사용자에게 확정받는다. 최소:
   - **핵심 ID(조인키)** — 전 테이블을 잇는 회원 식별자 확정
   - **총구매액 산식** — `order_amount` 합 vs 상세 `price×quantity` 합 / **취소·환불(`order_status`) 제외 여부**
   - **날짜 기준** — `last_order_date`·`last_login_date`가 어느 컬럼인지
   - **동의값 해석** — `Y/N`·공란을 동의/미동의로 어떻게 볼지
   - 신뢰도 낮은 매핑 전부
3. **Phase B 위임** — 확정 매핑 + HITL 확정값 + 고객사명을 `mce-schema-agent`에 넘겨 다시 호출 → 워커가 **빈 RAW DE(원본 컬럼명) 생성 + GCS Import 세팅 + `analysis-guide/<고객사>.md` 자동 생성**을 수행하고 결과를 반환한다.
4. **활성 고객사 전환** — 오케스트레이터가 사용자에게 전환 여부를 확인한 뒤, SKILL.md "활성 고객사" 줄과 CLAUDE.md 라우팅 표기를 `<고객사>`로 바꾼다. (활성 소스 변경은 시스템 전체 영향 → **명시적 단계**, 워커가 임의 전환 금지.)
5. **데이터 적재 게이트 안내** — 세팅 완료 후 "고객이 GCS 버킷에 업로드 → Import 적재 → 그때 STEP 1 진단 가능(리포트는 요청 시)"임을 보고한다. STEP 0는 적재를 **세팅만** 한다(즉시 실행 안 함).

> RECON_Profile·SEG_*·CP_DIAGNOSIS_AUTOMATION은 STEP 0가 만들지 않는다 — 데이터 적재 후 **STEP 1이 가이드를 읽어 자동 부트스트랩**한다([`reference/analysis-guide/_common.md`](reference/analysis-guide/_common.md) §6).
> 🚫 **결과만 전달**: Phase A/B 위임·DE 생성 사이에 진행 멘트를 넣지 않는다(전역 규칙). 노출은 ① HITL 질문 ② 활성 전환 확인 ③ 최종 결과 ④ 오류뿐.

---

# STEP 1 — 주제 선정 (캠페인 후보 추천)

> **모드 선택과 무관하게 항상 동일하게 동작한다.** 연결된 DE를 읽어 캠페인을 추천하는 단계다.
> 한국어로 소통하고 결과를 한국어로 보고한다.
> 진입 DE 목록·폴더 구조·핵심 필드는 [`reference/de-and-folders.md`](reference/de-and-folders.md)를 참조한다.

## 1-0. 입력 분기 — 사용자 프롬프트로 갈래를 먼저 판정한다

STEP 1에 진입하면, **사용자가 입력한 프롬프트에 특정 의도 키워드가 담겨 있는지** 먼저 판정하여 아래 두 갈래 중 하나로 진행한다.

| 갈래 | 트리거 (사용자 입력 예) | 읽기 범위 | 출력 형태 |
|---|---|---|---|
| **A. 의도 없이 전체 (리스트업)** *(우선 갈래)* | "생성 가능한 캠페인 리스트 업", "어떤 캠페인 만들 수 있어?", "전체 보여줘", "캠페인 목록" 등 **특정 의도 키워드가 없는 포괄적 요청** | `Customer_Profile`(key `CD_Customer_Profile_DE`)을 **진단 집계** (진단 DE 요약본 ~15줄 또는 단일 집계 SQL/행 조회) | **진단 결과표(지표·비율·약점·추천) + 약점 우선순위 추천 캠페인 목록**을 제시 (진입 DE 나열·확정 대상자 추출 없음, → 1-4-A) |
| **B. 의도 포함** | "신규 회원 캠페인 만들어줘", "이탈 고객 캠페인", "장바구니 캠페인" 등 **신규/이탈/장바구니/생일/쿠폰 등 의도 키워드 포함** | `Customer_Profile`의 해당 의도 지표 위주로 진단 | 해당 지표의 진단 비율을 근거로 한 **상세 후보 표** (복잡도 단순→복합 정렬, → 1-4-B) |

> ⚠️ **갈래 A는 "캠페인"을 추천한다 — "진입 DE"를 나열하지 않는다.** `Customer_Profile`을 진단해 약점에 맞는 캠페인을 [`reference/analysis-guide/_common.md`](reference/analysis-guide/_common.md)의 진단 방법 + 활성 고객사 분석 가이드([`reference/analysis-guide/ecommerce-default.md`](reference/analysis-guide/ecommerce-default.md))의 기준선·룰셋 기준으로 제시한다. `Campaign_Package` 하위 진입 DE(`WELCOME_ENTRY_DE` 등)나 계정에 떠 있는 기존 진입 DE 목록을 긁어 나열하지 않는다. (진입 DE는 캠페인을 **고른 뒤** 1-6에서 Automation SQL Query로 생성한다.)

**판정 규칙:**
- 의도 키워드(신규·가입·온보딩·웰컴 / 이탈·휴면·재활성화 / 장바구니·구매 / 생일·기념일 / 쿠폰·친구추가·프로모션 / 등급·멤버십)가 **하나도 없으면 → 갈래 A**.
- 의도 키워드가 **하나라도 있으면 → 갈래 B**.
- 모호하면(예: 의도 같기도, 전체 같기도) **갈래 A(리스트업)를 우선** 적용한다.

**전형적 흐름**: 사용자가 갈래 A로 가능 캠페인 목록을 먼저 본다 → 그중 하나를 의도로 지목("신규회원 캠페인 만들어줘") → **갈래 B로 전환**되어 그 신호의 상세 후보 표를 제시한다.

이후 1-1 ~ 1-5는 위에서 정해진 갈래(읽기 범위·출력 형태)에 맞춰 수행한다.

## 1-1. 고객 데이터 진단 — `Customer_Profile` 을 집계한다 (먼저 수행)

> 추천은 **고객 데이터 진단에 근거**한다(3차원). 분석 소스는 **활성 고객사 분석 가이드 §1이 지정한 DE**를 쓴다.
> ⭐ **현재 ecommerce-default 활성 소스 = 다중 엔티티 → `RECON_Profile`(Key `RECON_Profile_DE`)** (`RAW_Customers`·`RAW_Orders`·`RAW_OrderDetails`·`RAW_Products`·`RAW_Coupons` 5종을 JOIN 집계한 프로파일, 빌드 패턴은 [`analysis-guide/_common.md`](reference/analysis-guide/_common.md) §6-0, 대상 컬럼은 [`analysis-guide/ecommerce-default.md`](reference/analysis-guide/ecommerce-default.md) §1). **아래 절차에 나오는 `Customer_Profile`은 예시 이름일 뿐 — §1이 지정한 소스 DE(현재 `RECON_Profile`)로 치환해 읽는다.** 진단 `SEG_*`도 이 프로파일을 읽는다. (프로파일에 없는 컬럼이 필요한 캠페인은 원천 엔티티에서 읽는다 — §1 확장 컬럼 안내.) ⚠️ 1:N 엔티티(`RAW_Orders`·`RAW_OrderDetails`·`RAW_Coupons`)는 `GROUP BY member_id` 사전집계 후 조인해 팬아웃을 피한다. **고객사 원본 컬럼명은 제각각이다** — STEP 0가 만든 활성 고객사 가이드 §1 매핑표가 유일한 번역 사전이며, 위 이름도 그 자리에 들어갈 예시다.
> 진단 방법(프로파일링→도출·사전집계·fallback)은 [`reference/analysis-guide/_common.md`](reference/analysis-guide/_common.md) §2·§3, 스키마·의미규칙은 활성 고객사 분석 가이드 [`reference/analysis-guide/ecommerce-default.md`](reference/analysis-guide/ecommerce-default.md) §1·§2가 SSOT다. **측정 세그먼트·기준선은 고정이 아니라 AI가 프로파일링해 정한다.**

`Customer_Profile`을 **집계 진단**한다 — 단순히 "컬럼이 있으니 가능"이 아니라, **실제 데이터 값으로 지표 비율을 내고 약점을 찾아 추천**한다.
- **집계 경로(사전 집계, 대기 없음)**: 매일 새벽 Automation(`CP_DIAGNOSIS_AUTOMATION`)이 세그먼트별 `SEG_*` 카운트 DE(member_id 1컬럼, 비-sendable)에 미리 적재한다. 추천 시엔 각 `SEG_*` + 모수(`Customer_Profile`·`SEG_buyers_DE`)의 **`rowCount`만** `sfmc_get_data_extension`으로 읽어 비율을 낸다(행 값 안 읽음). 읽기 패턴 상세는 [`reference/analysis-guide/_common.md`](reference/analysis-guide/_common.md) 3절, `SEG_*` 목록·조건은 [`reference/analysis-guide/ecommerce-default.md`](reference/analysis-guide/ecommerce-default.md) 4절. ⚠️ 즉석 집계는 매번 1~2분 대기·비동기 0 오판으로 불안정하니 하지 않는다.
  - **자동 구축**: `SEG_*`/Automation이 **없으면** Claude가 활성 고객사 분석 가이드의 세그먼트 정의를 읽어 집계 SQL·DE·Automation을 **자동 생성**하고 1회 실행 후 읽는다([`reference/analysis-guide/_common.md`](reference/analysis-guide/_common.md) 6절). 이미 있으면 재생성하지 않는다(부하 방지). raw는 직접 읽지 않고 Contact Key 1컬럼 집계 쿼리만 만든다.
- 산출한 비율의 **분포에서 두드러진 지점**을 찾아 **비율 높은 순**으로 추천 순위를 정한다. 고정 임계값(분석 가이드 §3 참고값: 이탈~25%·1회성~60% 등)을 쓸 땐 "이 기준으로 가정함"을 밝힌다.
- **발송(진입) DE는 진단 단계에서 만들지 않는다.** 캠페인을 고른 뒤 **1-6에서** 세그먼트 조건 + 채널 동의 필터를 적용해 생성한다(실제 발송 인원 = 세그먼트 ∩ 동의).
- 갈래 A(리스트업)면 주요 지표 전체를 진단해 **약점 우선순위로** 추천 캠페인을 제시한다.
- 갈래 B(의도 포함)면 해당 의도 지표 위주로 진단하고 복잡도 변형까지 후보로 만든다.

## 1-2. 캠페인 신호 매칭 (원천 컬럼 기준)

활성 고객사 분석 가이드([`reference/analysis-guide/ecommerce-default.md`](reference/analysis-guide/ecommerce-default.md) 2절)의 **원천 컬럼 → 추천 캠페인 + 판정 계산식 표**를 기준으로, Customer_Profile에 그 **원천 컬럼이 있는지**로 부합 캠페인을 식별한다. (신호는 Boolean 플래그가 아니라 원천 날짜·수치 컬럼이며, 대상 판정 계산식은 1-6에서 SQL로 평가한다.)
- 생일(`birthday`), 신규(`signup_date`), 휴면(`last_login_date`), 이탈위험(`last_order_date`), 장바구니(`has_abandoned_cart`/`cart_total_amount`), 쿠폰만료(`coupon_expire_date`/`unused_coupon_count`), 포인트만료(`points_expire_date`/`points_balance`), VIP(`grade`), 취향(`preferred_category`), 지역(`region`) 등.
- ⚠️ 발송 동의 반영: 이메일 캠페인은 `email_consent=true`, SMS/알림톡은 `sms_consent=true`인 고객만 대상으로 규모를 집계한다.

## 1-3. 진단 비율 산출 + 약점 판정

- 각 진단 지표의 **비율**(전체 대비 %)을 집계하고, 약점 기준과 대조해 `is_weakness`를 판정한다(데이터 근거).
- 약점인 지표의 추천 캠페인을 상위 후보로 올린다(약점 우선순위). 약점이 아닌 지표는 "추가 가능 캠페인"으로 하위에 둔다.
- 분기·세분화에 쓸 컬럼(`grade`, `last_order_date`, `total_spent`, `order_count`, `preferred_category`, `cart_total_amount` 등)으로 복잡도(단순/중간/복합) 변형이 가능한지 판단한다.
- 비율이 0%인 지표는 후보에서 제외하거나 "(현재 대상 0명)"으로 명시한다.
> ⚠️ 진단의 **비율**은 가벼운 전체 집계(세그먼트 %)다. 캠페인 선택 후의 *확정 발송 대상자 추출·진입 DE 생성*은 1-6에서 한다(둘은 별개).

## 1-4. 캠페인 후보 추천

1-0에서 판정한 갈래에 따라 출력 형태가 다르다.

### 1-4-A. 갈래 A (의도 없이 전체 = 리스트업) — 진단 기반 추천 목록

`Customer_Profile`을 **진단**해, 약점 우선순위로 **추천 캠페인**을 제시한다.
> ⚡ 여기서 내는 것은 약점 탐지용 **세그먼트 비율(전체 대비 %)** 까지다(가벼운 1회 집계). 발송 *확정 대상자 추출·진입 DE 생성*은 캠페인 선택 후(1-6)에 한다.
> "컬럼이 있으니 가능하다"(1차원)로 끝내지 말고, **"비율이 약점 기준을 넘었다 → 이 캠페인을 추천한다"**(3차원)로 제시한다.

출력 형식 (지표·인원·비율·추천 캠페인만 — "주목"/"약점" 별도 컬럼 없음, 비율 높은 순):

```
고객 데이터(Customer_Profile) 분석 결과입니다. (모수 N명, YYYY-MM-DD)

지표                | 인원   | 비율 | 추천 캠페인
1회성 구매자         | 6,400 | 64% | 2차 구매 유도
휴면 (로그인90일+)   | 3,500 | 35% | 휴면 고객 재활성화
이탈위험 (주문90일+) | 2,528 | 32% | 이탈 고객 재구매 유도

**추천 캠페인 — 우선순위**
1️⃣ **2차 구매 유도** ← 1회성 구매자 64% (6,400명)
2️⃣ **휴면 고객 재활성화** ← 휴면 35% (3,500명)
3️⃣ **이탈 고객 재구매 유도** ← 이탈위험 32% (2,528명)
> 추가 가능: 생일 쿠폰(birthday), 쿠폰 만료 리마인더(coupon_expire_date), 등급/취향/지역 분기 ...

만들고 싶은 캠페인을 골라주세요. 번호를 고르시거나 `추천`이라고 입력하시면 의도에 맞는 후보를 골라드립니다.
```

- **목록 표기**: 각 추천은 `숫자 이모지 + **캠페인명(볼드)** ← 지표 비율 (인원)` 형식으로 쓴다. 숫자 이모지는 1️⃣~🔟을 순위대로 쓰고(10위 초과만 `11.` 평문 폴백), "추가 가능…" 줄은 `>` 인용으로 흐리게 둔다. 위 3줄은 예시일 뿐 실제 추천 개수만큼 이어서 낸다.
- 집계에 필요한 원천 컬럼이 **없으면** 그 지표는 제외한다. 집계하지 못한 지표를 지어내지 않는다.
- 집계가 불가하면(세션/권한 등) 그 사유를 밝히고, 부득이하면 컬럼 존재 기반 목록으로 폴백하되 "비율 미산출"임을 명시한다.
- 사용자가 특정 캠페인을 지목하면 → **갈래 B(1-4-B)** 로 상세 후보를 좁히고, 선택 확정 후 **1-6(집계+진입 DE 생성)** 으로 간다.

> 📄 **분석 리포트 생성 — 사용자가 명시적으로 요청할 때만 (자동 생성 금지)**: 갈래 A 진단 직후에는 리포트를 만들지 않고 **진단표+추천 목록만 즉시 출력**한다(출력 말미에 "분석 리포트(PPT)가 필요하면 요청하세요" 1줄 안내). 사용자가 "리포트 만들어줘/리포트 줘/PPT로" 등으로 요청하면 그때 [`reference/report-guide.md`](reference/report-guide.md) §6·§7대로 **진단 데이터 JSON을 작성해 빌더로 PPTX 리포트를 생성**한다(`node reference/report-builder/gen_report.js <데이터.json> <출력.pptx>` — 디자인·레이아웃은 빌더에 고정, AI는 데이터 JSON만 작성). `reports/`에 저장하고 파일 경로를 제시한다. 리포트엔 핵심 요약·고객 기반 구조(퍼널/도달)·세그먼트 진단·기회 우선순위·캠페인 상세가 담긴다(구조·디자인은 공통, 값은 이번 진단·활성 고객사 분석 가이드 기준). **HTML/Artifact는 생성하지 않으며, 슬라이드 코드를 매번 새로 작성하지 않는다.** 직전 진단 데이터는 세션 안에 있으므로 재진단 없이 JSON만 작성해 빌더를 돌린다.
> 🚫 **무발화**: 워커 위임→진단은 **전부 침묵하며 연속 실행**한다. "위임했습니다 / 완료됐습니다 / 갈래 A이므로 생성하겠습니다" 같은 진행 멘트를 도구 호출 사이에 **한 줄도** 넣지 않고, **맨 마지막에 진단표 + 추천 목록을 1회에** 출력한다(전역 "🚫 결과만 전달" 규칙). 리포트를 요청받아 생성할 때도 동일 — 중간 멘트 없이 완료 후 파일 경로만 출력한다.

사용자 의도와 분석한 DE/필드를 결합하여 **2~5개의 캠페인 후보**를 단일 표로 제시한다.

**후보 구성·정렬 규칙:**
- **복잡도 오름차순 정렬**: 1번을 가장 단순한 후보(단순 발송)로 두고, 번호가 커질수록 분기·단계가 많아지는 순서로 배치한다.
- **복잡도 컬럼 표시**: 각 후보에 복잡도를 명시한다 — `단순` / `중간` / `복합`.
  - `단순`: Email → Wait & Exit (분기 없음)
  - `중간`: 분기 1회 (Decision Split 또는 Engagement Split 1개)
  - `복합`: 다단계·중첩 분기 (Decision Split → Email → Wait → Engagement Split 등)
- **복합 후보 항상 1개 이상 포함**: DE가 분기 가능한 필드(Boolean/Date/Number/등급 Text 등)를 1개라도 가지면, 후보 목록 **마지막 칸에 반드시 복합 분기 후보를 1개 넣는다.** 간략한 한 문장만 입력해도 복합 분기 옵션을 빠짐없이 추천받게 하기 위함이다.
  - DE 필드가 부족해 복합 분기를 만들 수 없을 때만 생략하고, 그 사실(어떤 필드가 없는지)을 명시한다.

선택된 의도에 대해 **복잡도 변형(단순/중간/복합)** 을 후보로 제시한다. (활용 신호 = Customer_Profile 컬럼)
> 대상자 수는 여기서 강제로 세지 않아도 된다 — **확정 대상자 집계는 선택 후 1-6에서** 한다. (간단히 규모를 미리 보여주면 선택에 도움은 되지만 필수는 아님)

| 번호 | 캠페인명 | 활용 신호(컬럼) | 추천 Journey 유형 | 복잡도 | 한 줄 설명 |
|---|---|---|---|---|---|
| 1 | 신규회원 웰컴 이메일 | signup_date, email_consent | Email → Wait & Exit | 단순 | 가입 직후 웰컴 메시지 1회 발송 |
| 2 | 신규회원 온보딩 시리즈 | signup_date | Email → Wait → Engagement Split | 중간 | 가입 후 열람 여부에 따라 후속 안내 차등 발송 |
| 3 | 신규회원 등급별 온보딩 | grade, signup_date | Decision Split → Email → Wait → Engagement Split | 복합 | 등급 분기 후 열람 반응까지 반영한 다단계 안내 |

각 후보는 **실제 Customer_Profile에 존재하는 컬럼에 근거**해야 한다. 없는 신호를 지어내지 않는다.
필요한 분기 신호가 Profile에 없으면 그 사실을 명시하고 대안을 제시한다.

## 1-5. 캠페인 선택

후보 표를 사용자에게 보여주고 **어떤 캠페인을 만들지 선택**하게 한다. (복잡도 컬럼이 있어 사용자가 난이도를 보고 고를 수 있다.)
후보 표 아래에 선택 안내를 한 줄 덧붙인다: **"번호를 고르시거나 `추천`이라고 입력하시면 의도에 맞는 후보를 골라드립니다."** (이 단계는 텍스트 입력 방식 — 클릭형 아님)

**자동 선택 트리거 — `추천`:**
- 사용자가 **`추천`** 이라고 입력하면(또는 "알아서 골라줘", "알아서" 등 동의 표현) **복잡도를 강제로 올리지 않고**, 사용자가 원하는 캠페인 의도에 가장 적합한 후보를 오케스트레이터가 선택한다. 무엇을 왜 골랐는지(어떤 의도에 부합해서) 1줄로 알린다.
  - 의도가 단순 1회 발송 성격이면 단순 후보를, 단계적 반응·세분화가 필요한 의도면 그에 맞는 중간/복합 후보를 고른다. 즉 **의도 정합성**이 자동 선택의 유일한 기준이다.
  - ⚠️ `추천`(후보 자동 선택)과 STEP 2의 `자동`(대화 없이 저니까지 일괄 실행 모드)은 별개다. `추천`은 후보만 고르는 것이고, 이후 실행 모드(수동/자동)는 STEP 2에서 별도로 진행한다.

원칙:
1. **범위 한정 우선**: 전체 DE를 무차별 조회하지 않는다. 폴더/카테고리로 먼저 좁히고, 매칭이 모호할 때만 전체 조회로 fallback.
2. **근거 기반 추천**: 모든 후보는 실제 조회한 DE/필드에 근거한다.
3. **의도 정합성**: 자동 선택 시 사용자의 한 문장 의도에 가장 부합하는 후보를 고른다. (정렬은 복잡도 오름차순이되, 선택 기준은 의도 적합성)
4. **복잡도 다양성 보장**: 후보는 단순 → 복합으로 정렬하고, 복합 분기 후보를 항상 1개 이상 포함한다(1-4 규칙). 간략 입력에도 복합 옵션이 추천 목록에 노출되게 한다.

## 1-6. 선택 후 — 대상자 집계 + Automation 진입 DE 생성

캠페인이 **선택되면**, 그제서야 대상자를 집계하고 진입 DE를 만든다. (목록 단계에서는 안 함)

1. **대상자 집계** — 선택된 캠페인의 신호 조건으로 `Customer_Profile`을 필터해 대상 고객 수를 집계한다.
   - 예: 생일 캠페인 → `WHERE MONTH(birthday)=MONTH(GETDATE()) AND DAY(birthday)=DAY(GETDATE()) AND email_consent = 'True'` → "대상 N명". (휴면=`DATEDIFF(day, last_login_date, GETDATE()) >= 90` 등 신호는 원천 컬럼으로 계산. Boolean은 `= 'True'`·`= 1` 둘 다 동작)
   - ⚠️ **SQL Query 실행은 비동기다 — `run` 후 1~2분 기다린 뒤** `sfmc_get_data_extension` `rowCount`로 확인한다. 성급히 0을 보고 오판하지 말 것.
   - 동의 필터(이메일=`email_consent`, SMS/알림톡=`sms_consent`)를 반드시 포함한다.
2. **Automation SQL Query로 진입 DE 생성/채움** — `Customer_Profile`을 필터한 결과를 캠페인별 **진입 DE**(`Campaign_Package` 하위, 예: `BIRTHDAY_ENTRY_DE`)에 적재한다.
   - `sfmc_create_sql_query`로 SQL Query 액티비티 생성 → `sfmc_run_sql_query`(또는 Automation)로 실행.
   - SELECT 컬럼은 **타겟 진입 DE의 필드와 일치**시킨다(예: `member_id AS SubscriberKey, email AS EmailAddress, birthday AS Birthday, grade AS MemberGrade, ...`).
   - targetUpdateType은 보통 `Overwrite`(매 실행 시 대상 갱신).
3. 생성/적재된 **진입 DE가 곧 STEP 3 저니의 Entry Source**가 된다.

> 이 단계는 STEP 2(기획/정의서) 진행과 함께 처리한다. 정의서의 Entry DE 명은 여기서 만든 진입 DE로 채운다.
> SQL Query·진입 DE 매핑 상세는 [`reference/de-and-folders.md`](reference/de-and-folders.md)를 따른다.

---

# STEP 2 — 실행 모드 선택 + 기획 / 정의서

캠페인이 선택되면 **이 시점에서** 실행 모드를 묻는다. 이 선택이 기획(STEP 2)과 저니 생성(STEP 3)의 진행 방식을 가른다.

| 모드 | 동작 |
|---|---|
| **수동 (Manual)** | Plan을 **대화 형식**으로 함께 구성한다. 진입 방식·이메일·단계·분기·대기·재진입·스케줄을 사용자와 하나씩 합의한 뒤 정의서를 만들고, STEP 3 전에 한 번 더 승인을 받는다. |
| **자동 (Auto)** | **대화 없이** Plan 기획 → 정의서 → MCE Journey 생성까지 일괄 진행한다. 명시되지 않은 값은 MCE 표준 기본값을 자동 적용한다. |

> 🔘 **클릭형 선택**: 모드는 `AskUserQuestion`(header `실행 모드`)으로 **`수동` / `자동`** 버튼을 제시해 받는다.
> 사용자가 처음부터 "자동으로", "알아서 저니까지 만들어줘"라고 명시하면 이 질문을 생략하고 **자동**으로 진행한다.

**모드별 STEP 2 처리:**

- **자동** → 의도를 분석해 기본값으로 Plan 설계 + 정의서 생성을 일괄 수행하고, 곧바로 STEP 3로 이어간다.

- **수동** → 직접 대화로 Plan을 합의한다. 아래 항목을 순서대로 사용자와 정한다:
  1. Entry Source (Data Extension / API Event) 및 진입 DE
  2. **스케줄** — 발송 일정 / 스케줄 시작일 / Schedule Flow Mode (Recurring vs On Activation)
     → 🔘 `AskUserQuestion`(header `스케줄`)으로 **`Recurring (반복 발송)` / `On Activation (발행 시 1회)`** 을 먼저 받는다.
       `Recurring`이면 이어서 **주기(매일/매주/매월)·시작일·발송 시각**을 대화로 확정한다(날짜·시각은 텍스트 입력).
  3. 재진입 설정 (No re-entry / Re-entry anytime / Re-entry only after exiting)
  4. Journey 단계 구성 (Email / Wait / Decision Split / Engagement Split / Wait & Exit ...)
  5. 각 단계의 상세값 (이메일명·ID, 대기 기간, 분기 조건/기준 속성)

  > ⚠️ **스케줄을 자동 기본값으로 조용히 넘기지 않는다.** 수동 모드에서는 스케줄(발송 일정·시작일·Schedule Flow Mode)을 **반드시 사용자와 확정**하고, Plan 요약(2-1)의 `스케줄` 라인을 항상 실제 값으로 채워 보여준다. 사용자가 스케줄을 언급하지 않았더라도 추천값을 제시해 **확인을 받는다**(애매한 항목만 묻는 사전 확인 체크리스트를 쓸 때도 스케줄을 반드시 포함).

  합의가 끝나면 확정된 Plan을 요약해 보여준 뒤, **진행 방식을 한 번 묻는다** (🔘 `AskUserQuestion`, header `진행 방식`):
  - ① **정의서 생성 후 승인** — xlsx 정의서를 먼저 생성해 보여주고, 사용자 승인을 받은 뒤 STEP 3 Journey 생성
  - ② **바로 저니 생성** — 정의서 xlsx 생성 후 중간 확인 없이 곧바로 STEP 3 Journey(Draft)까지 생성

  선택된 값 그대로 정의서를 생성한다. (임의로 바꾸지 않는다.)

## 2-1. Journey Plan 요약 (정의서 생성 전 먼저 제시)

```
[ Plan: <캠페인 시나리오명> ]
- 목적      : <비즈니스 목적>
- 진입      : <Entry Source> / <진입 DE 또는 Event Key>
- 스케줄    : <발송 일정> (시작 <스케줄 시작일>) / <Recurring | On Activation>
- 재진입    : <No re-entry | Re-entry anytime | Re-entry only after exiting>
- 흐름      : Entry → Email(<이메일명>) → Wait(<기간>) → Decision Split(<기준>) → ...
- 분기 속성 : <DE 필드명 및 조건> (실제 DE에 존재하는 필드 기준)
```

Plan의 분기 기준 속성은 **실제 DE에 존재하는 필드**를 사용한다. 필드가 없으면 Plan에 그 사실을 명시한다(예: "IsCouponUsed 필드 없음 — DE에 추가 필요").

## 2-2. 정의서 시트 구조

캠페인 정의서는 **캠페인 개요 / 저니 구조** 2개 탭으로 구성된다.

### 캠페인 개요 탭

| 컬럼명 | 설명 |
|---|---|
| 캠페인 ID | 고유 식별자 (예: CP_001) |
| 캠페인 시나리오명 | Journey 이름으로 사용 |
| 설명 및 비즈니스 목적 | 캠페인 목적 설명 |
| 발송 일정 | 발송 기준 일정 |
| 스케줄 시작일 | 실행 시작 날짜 (예: 2026-06-01) |
| Entry Source | Data Extensions / API Event |
| Entry DE 명 | 진입 DE 이름 |

### 저니 구조 탭

| 컬럼명 | 설명 |
|---|---|
| 캠페인 ID | 개요 탭과 매칭 키 |
| 단계 (Step) | 순서 (1, 2, 3-A, 3-B ...) |
| 컴포넌트 유형 | Entry Source / Message (Email) / Message (알림톡/문자/카카오/SMS) / Wait / Decision Split / Engagement Split / Wait & Exit 등 |
| 상세 설정 조건 / 분기 로직 (Criteria & Path) | 컴포넌트별 세부 조건 및 분기 경로 |
| 연결 콘텐츠 명칭 (Email Name / 알림톡 컨텐츠명) | 이메일=Content Builder 에셋명 / 알림톡=micrm 모바일 컨텐츠명 |
| 연결 콘텐츠 ID (Email ID / 알림톡 seq) | 이메일=Content Builder legacyId / 알림톡=micrm **모바일 컨텐츠 seq**(문자열, 예 `<seq>`. `mobileList.ajax`. tmpl_seq 아님) |
| 대기 기간 (Wait) | 대기 시간 (예: 3 Days, 1 Day) |
| 고객 재진입 설정 (Contact Re-entry) | No re-entry / Re-entry only after exiting / Re-entry at any time |
| Schedule Flow Mode | Recurring (반복) 또는 빈값 (On Activation — 발행 시 1회) |
| applicationExtensionKey (알림톡/문자) | 알림톡/문자 채널일 때만. 그 BU 커스텀 액티비티 키(오케스트레이터가 채널 해소 단계에서 확정). 이메일은 빈값 |
| 변수 매핑 (알림톡 #{변수}→DE컬럼) | 알림톡/문자 채널일 때만. 템플릿 변수↔진입 DE 컬럼 매핑(예: `FirstName→FirstName; phone→Phone`). 이메일은 빈값 |

**메시지 채널 판단 기준 (컴포넌트 유형 결정):**

| 캠페인/정의서에 등장하는 문구 | 컴포넌트 유형 | STEP 3 생성 방식 |
|---|---|---|
| `알림톡`, `문자`, `카카오`, `SMS` 중 하나라도 포함 | `Message (알림톡/문자/카카오/SMS)` | **REST 커스텀 액티비티** ([`reference/journey-build.md`](reference/journey-build.md) ④) — 이메일 에셋/액티비티 생성 안 함 |
| 위 문구 없음 (기본) | `Message (Email)` | 이메일 액티비티(`EMAILV2`) + 이메일 에셋 생성 |

> ⚠️ 위 4종 채널 문구가 감지되면 **`Message (Email)`을 `Message (알림톡/문자/카카오/SMS)`로 대체**한다. 같은 단계에 이메일과 채널 메시지를 중복으로 넣지 않는다. (REST 단독 처리)

#### 📨 메시지 채널 해소 (seq 확보) — 알림톡/문자/카카오/SMS일 때 오케스트레이터가 STEP 2 위임 전에 수행

> micrm 카탈로그 조회엔 **micrm 웹세션(브라우저)** 이 필요하다. 격리·헤드리스 워커(planning/journey)는 micrm에 접근 못 하므로, 아래는 **반드시 오케스트레이터(메인 루프)가 직접** 수행하고 결과(seq·키·변수매핑)를 planning 워커 입력으로 넘긴다.

1. **BU 연결 채널·키 확인** — 현재 BU의 기존 알림톡 저니를 `sfmc_get_journey`로 읽어 ① REST 액티비티의 `configurationArguments.applicationExtensionKey` ② 발신 프로필의 `send_key`를 얻는다. (저니 UI에서 커스텀 액티비티 열기 → 발신 프로필 `@채널명(send_key)`로도 확인 가능. 키·`send_key`는 **BU마다 다름** — 하드코딩 금지.)
2. **카탈로그 불러오기** — 위 `send_key`로 micrm **모바일 컨텐츠 목록(`mobileList.ajax`)** 과 **알림톡 템플릿 목록(`atTmplLst.ajax`)** 을 브라우저(Claude in Chrome)로 불러온다. **검증된 재사용 스니펫·응답 파싱·세션/CSRF 규격은 [`reference/micrm-catalog.md`](reference/micrm-catalog.md) 가 SSOT** — `https://sales.micrm.co.kr/*` 로그인 탭에서 그 스니펫을 `javascript_tool`로 실행하면 `{ mobile:[{seq,name,title}], tmpl:[{tmpl_seq,tmpl_cd,name}] }` 를 반환한다. **저니 `inArguments.seq`에 넣는 값은 `mobile[].seq`(모바일 컨텐츠 seq)** 다. (`atTmplLst`의 `tmpl_seq`는 그 안에 들어가는 카카오 "알림톡 템플릿" id일 뿐 — 저니 seq 아님.)
3. **seq 선택** — 카탈로그가 크고(200건+) micrm 서버검색이 안 먹으므로 **클라이언트 이름 필터**로 좁힌다. **수동 모드**: 의도 키워드로 필터한 후보(seq+이름)를 `AskUserQuestion`으로 제시해 사용자가 선택(후보 많으면 키워드 추가). **자동 모드**: **이름매칭+확신 임계치(전략 A)** — 의도 키워드로 점수화해 확신 높으면 자동 채택(왜 골랐는지 1줄), **확신 낮으면 임의 선택 금지·상위 반환해 그 1건만 사용자에게 질문**. 상세 절차·점수/임계치는 [`reference/micrm-catalog.md`](reference/micrm-catalog.md) "자동 모드 seq 선택 전략" 참조.
4. **변수 매핑** — 선택 템플릿 본문의 카카오 변수 `#{변수명}`을 진입 DE 컬럼에 매핑한다(예: `FirstName→FirstName; phone→Phone; contactkey→SubscriberKey`).
5. **위임** — 위 {seq, `applicationExtensionKey`, 변수매핑}을 STEP 2 planning 워커에 입력으로 넘겨 **정의서의 해당 컬럼에 기록**하게 한다. 이후 STEP 3 journey 워커는 정의서 값만으로 REST 액티비티를 만든다(micrm 재접근 불필요).

> ⚠️ **seq는 반드시 "이 BU 연결 채널"의 것**이어야 한다. 다른 채널 seq를 넣으면 JB UI에서 "사용할 수 없는 콘텐츠"로 뜬다. ([`reference/journey-build.md`](reference/journey-build.md) ④)

**고객 재진입 설정 판단 기준 (자동 모드에서 미지정 시):**

| 의도 예시 | 재진입 설정 |
|---|---|
| "웰컴 1번만", "가입 즉시 발송", "생일 축하 1회" | `No re-entry` |
| "이탈할 때마다", "구매할 때마다 발송" | `Re-entry at any time` |
| "여정 끝난 고객은 다시 받을 수 있게", "매일 체크해서 재시도" | `Re-entry only after exiting` |
| 사용자가 명시 | 지정값 우선 |
| 판단 불가 | `No re-entry` (기본값) |

**Schedule Flow Mode 판단 기준:**

| 요청 | Schedule Flow Mode | 발송 일정 | 스케줄 시작일 |
|---|---|---|---|
| "매일 09:00", "매주 월요일" 등 반복 | `Recurring` | 예: `매일 09:00` | 예: `2026-06-10` |
| "가입 즉시", "1회 발송", 반복 언급 없음 | *(빈값)* | `즉시` 또는 `-` | `-` |
| API Event 기반 | *(빈값)* | `실시간` | `-` |

## 2-3. 정의서 생성 워크플로우

### ① 캠페인 ID 채번

`campaign_definitions\` 폴더 내 기존 xlsx 파일명에서 `CP_NNN` 패턴을 스캔한다.
- 가장 큰 번호 + 1을 새 캠페인 ID로 사용 (예: CP_014 존재 → CP_015)
- 기존 파일이 없으면 CP_001부터 시작

### ② xlsx 파일 생성

확인 없이 즉시 `generate_campaign_definition.js` 스크립트로 xlsx 파일을 생성한다.

**출력 경로**: `<프로젝트 루트>\campaign_definitions\`
**파일명 규칙**: `{캠페인ID}_{캠페인시나리오명}_{YYYYMMDD}.xlsx`
**시트 구성**: `시나리오 정의` 탭 + `저니 구조` 탭

생성 방법:
1. 데이터를 **`campaign_data.json`** 파일로 저장 (Write 도구 사용)
2. `node generate_campaign_definition.js <파일명.xlsx> campaign_data.json` 실행
3. 실행 완료 후 `campaign_data.json` 삭제

```json
// campaign_data.json 형식
{
  "overviewRows": [
    ["CP_XXX", "시나리오명", "설명", "발송일정", "2026-06-03", "Data Extensions", "DE명"]
  ],
  "journeyRows": [
    ["CP_XXX", "1", "Entry Source", "조건", "-", "-", "-", "No re-entry", "-"],
    ["CP_XXX", "2", "Message (Email)", "설명", "이메일명", "63559", "-", "-", "-"],
    ["CP_XXX", "3", "Wait & Exit", "종료", "-", "-", "1 Day", "-", "-"]
  ]
}
```

```bash
node generate_campaign_definition.js CP_XXX_시나리오명_20260603.xlsx campaign_data.json
```

**절대 `node -e` 인라인 실행 금지** — Windows 백슬래시 경로가 깨져 파일이 엉뚱한 위치에 생성됨.

### ③ 완료 보고

Plan 요약 → 파일 경로 → 생성된 정의서 테이블(캠페인 개요 / 저니 구조)을 순서대로 출력한다.

```
[ 정의서 생성 완료 ]
파일: campaign_definitions/CP_XXX_시나리오명_YYYYMMDD.xlsx
캠페인 ID: CP_XXX
```

- **수동 모드** → 정의서를 사용자에게 보여주고 STEP 3 전에 승인을 받는다. (🔘 `AskUserQuestion`, header `Plan 승인` — `승인 (저니 생성)` / `수정할게요`. "수정할게요"면 변경 항목을 다시 합의 후 정의서 갱신.)
- **자동 모드** → 곧바로 STEP 3로 진행한다.

## 2-4. 저니 구조 설계 패턴

저니 구조 설계 패턴(단순 이메일 / Decision Split / Engagement Split 및 중첩 분기) 예시는 [`reference/journey-build.md`](reference/journey-build.md)의 "저니 구조 설계 패턴" 절을 참조한다.

---

# STEP 3 — Journey 생성 (SFMC)

STEP 2에서 생성된 정의서(또는 사용자가 직접 첨부한 정의서)를 읽어 SFMC Journey Builder에 Journey를 생성한다.

> ⚠️ **STEP 3 시작 전, [`reference/error-log.md`](reference/error-log.md)(오류 학습 표)를 먼저 훑어 같은 오류를 반복하지 않는다.**
> 저니 페이로드/액티비티 상세 규칙(이벤트 정의·스케줄 PATCH·Decision Split criteria XML·entryMode·Engagement Split statsTypeId 등)은 [`reference/journey-build.md`](reference/journey-build.md)에 정리돼 있다.

**모드별 처리:**
- **자동** → STEP 2 직후 대화 없이 곧바로 진행한다.
- **수동** → STEP 2에서 승인을 받은 뒤 진행한다.

## 3-1. 캠페인 정의서 읽기

**입력 소스 우선순위 (위에서부터 순서대로 판단)**

1. **전체 경로 또는 파일명 제시** → 해당 파일을 직접 파싱
   - 전체 경로 예: `campaign_definitions/CP_005_신규회원웰컴이메일_20260604.xlsx`
   - 파일명만 제시 시 기본 경로 자동 적용: `<프로젝트 루트>\campaign_definitions\`
2. **캠페인 ID만 제시** (예: `CP_005`) → `campaign_definitions\` 폴더에서 `CP_005` 패턴으로 파일을 검색하여 파싱
3. **"최신 파일", "방금 만든", "최근"** 등의 키워드 → `campaign_definitions\` 폴더에서 수정일 기준 가장 최근 xlsx 파일을 자동 선택
4. **위 3가지에 해당하지 않는 경우** → Google Sheets를 읽는다 (Spreadsheet ID: `<확인필요: 고객사 정의서 Spreadsheet ID>`)

> STEP 2에서 방금 정의서를 만든 경우, 그 데이터를 그대로 메모리에 들고 STEP 3로 넘어가도 된다(재파싱 불필요).

읽은 데이터에서 **캠페인 개요 테이블**과 **저니 구조 테이블**을 파싱한다.
캠페인 ID를 키로 두 테이블을 매칭하여 Journey별 실행 정보를 구성한다.

파싱 과정에서 생성한 임시 JSON 파일(예: `cp0XX_parsed.json`)은 파싱 완료 즉시 삭제한다.

**xlsx 파싱 시 절대 경로 규칙:**
- `cd "경로" && python ...` 형태 **금지** — `cd` + 경로 조합은 보안 정책상 매번 승인 요구됨
- 대신 `python -c "... pd.ExcelFile(r'<프로젝트 루트>\campaign_definitions\파일명.xlsx') ..."` 형태로 절대 경로를 직접 사용한다
- PowerShell에서도 동일하게 `cd` 없이 절대 경로만 사용한다

## 3-2. Journey 이름 중복 확인 및 버전 suffix 부여

`sfmc_get_journeys` 로 동일한 캠페인 시나리오명이 존재하는지 확인한다.

- **중복 없음** → 정의서의 시나리오명 그대로 사용
- **중복 있음** → 기존 버전 번호를 확인하여 자동으로 suffix 부여:
  - 동일 이름이 처음 중복: `시나리오명_v1`
  - `_v1` 도 존재하면: `_v2`, `_v3` ... 순으로 증가
- Journey Key, Event Definition Key에도 동일하게 suffix 반영
  - 예: `CP006-WelcomeEmail-Entry-20260604` → `CP006-WelcomeEmail-Entry-v1-20260604`

## 3-3. 캠페인 ID별 Journey 생성 (즉시 실행)

파싱한 모든 캠페인 ID에 대해 순서대로 Journey를 생성한다.
이벤트 정의 생성·스케줄 PATCH·Journey 액티비티 구성·entryMode·발행 규칙의 **상세 페이로드와 검증된 형식**은 모두 [`reference/journey-build.md`](reference/journey-build.md)에 있다. 그 문서의 규칙을 그대로 따른다.

> ⚠️ **최우선 규칙: 정의서에 명시된 모든 액티비티의 조건/설정값은 빠짐없이 Journey에 채워 넣는다.**
> 조건을 비워둔 채(미설정 상태) Journey를 생성하는 것은 절대 허용되지 않는다.

> 📨 **메시지 채널 분기**: 정의서의 컴포넌트 유형이 `Message (알림톡/문자/카카오/SMS)`이거나 단계 설명에 `알림톡·문자·카카오·SMS` 문구가 있으면, 이메일 액티비티(`EMAILV2`) 대신 **REST 커스텀 액티비티**([`reference/journey-build.md`](reference/journey-build.md) ④)를 생성한다. 이 경우 **이메일 에셋·이메일 표준 단계는 건너뛴다.** 그 외(`Message (Email)`)는 기존대로 이메일 액티비티로 생성한다.

> ⚠️ **발행은 기본적으로 하지 않는다.** 정의서에 `auto_publish = TRUE`가 명시되었거나 사용자가 명시적으로 "발행해줘"/"publish"를 요청한 경우에만 `sfmc_publish_journey`를 호출한다. 그 외에는 **Draft 상태로 둔 채 종료**하고, "Draft 상태로 생성됨 (미발행)"임을 보고한다.

---

# STEP 4 — 결과 보고

모든 처리 완료 후 결과를 요약한다.

Journey 생성에 성공하면 **`sfmc_get_journey_link` 를 호출해 Journey Builder 접속 URL을 얻어** 결과에 포함한다. (여러 저니를 만들었으면 저니마다 이름·ID·링크를 각각 표기한다.)

```
[ 실행 결과 ]
선택 캠페인 : <캠페인명>
실행 모드   : 수동 / 자동
정의서      : campaign_definitions/CP_XXX_시나리오명_YYYYMMDD.xlsx
Journey 명  : <Journey 이름>
Journey ID  : <uuid> (Draft / 발행됨)
접속 링크   : <Journey Builder URL>
```

> 링크는 가능한 한 클릭 가능한 형태로 제공한다. `sfmc_get_journey_link` 가 URL을 돌려주지 못하면 ID·이름까지만 표기하고 링크 줄은 생략한다.

오류가 발생한 단계는 오류 내용을 명시하고, 가능한 경우 다음 단계로 계속 진행한다.

> ⭐ **자기 학습 규칙**: 캠페인 생성 중 오류가 발생하여 수정/우회했다면, **그 원인과 해결책을 즉시 [`reference/error-log.md`](reference/error-log.md)에 한 줄 추가**한다. 다음 캠페인 생성 시 그 문서를 먼저 참고하여 같은 오류를 반복하지 않는다.

---

## 저니 생성 이력 관리

- 저니 생성 결과는 `<프로젝트 루트>\.claude\journey_history.md` 에 단일 파일로 누적 저장한다.
- 매 실행 후 아래 형식으로 append 한다.

```
## YYYY-MM-DD HH:MM
- 캠페인 ID: CP_XXX
- Journey 명: <name>
- Journey ID: <uuid>
- 상태: 성공 / 실패 (<오류내용>)
```

- `MEMORY.md` 인덱스에는 등록하지 않는다. (자동 로딩 방지)
