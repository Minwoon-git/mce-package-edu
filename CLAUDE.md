# MCE 캠페인 자동화 — 프로젝트 가이드

이 저장소는 **MCE(SFMC Marketing Cloud Engagement) 캠페인 자동화** 도구다.
사용자가 만들고 싶은 캠페인을 **간략한 한 문장**(예: "신규 회원 캠페인 생성", "이탈 고객 캠페인")으로 입력하면,
**상위 에이전트(이 메인 루프 = 오케스트레이터)가 총괄**하여 ① 주제 선정 → ② 기획/정의서 → ③ Journey 생성을 진행한다.
**사용자는 상위 에이전트하고만 대화**하고, 상위 에이전트가 알아서 각 STEP을 담당 **하위 에이전트(워커)** 에게 위임한다.

> **오케스트레이터 원칙**: 상위 에이전트는 사용자와의 대화·모드 선택·승인·최종 보고를 직접 맡고,
> 각 STEP의 실제 작업은 STEP별 하위 에이전트에 **위임(`Agent` 도구 호출)** 한다.
> - STEP 0 (스키마 분석/데이터 인입 세팅 — 신규 고객사 온보딩 시에만) → `mce-schema-agent`
> - STEP 1 (주제 선정/DE 분석) → `mce-topic-agent`
> - STEP 2 (기획/Plan/xlsx 정의서) → `mce-planning-agent`
> - STEP 3 (SFMC Journey 생성) → `mce-journey-agent`
>
> **승인은 상위 에이전트가 하위 호출 "사이"에서 받는다.** 하위 에이전트는 격리 실행되어 도중에 사용자와 대화할 수 없으므로,
> 수동 모드의 단계별 선택·합의·Plan 승인은 모두 상위 에이전트가 워커 호출 전후에 `AskUserQuestion`으로 처리한다.
> 자동 모드는 질문 없이 세 워커를 순서대로 호출한 뒤 결과만 1회 보고한다.
>
> 캠페인 생성 전체 절차·참조 데이터의 단일 출처(SSOT)는 `mce-campaign` 스킬과 그 `reference/` 파일이며,
> **상위·하위 에이전트 모두 그 스킬/참조 파일을 따른다.**

---

## ⭐ 라우팅 — 캠페인 작업은 `mce-campaign` 스킬로

아래 의도가 감지되면 **반드시 `mce-campaign` 스킬을 먼저 로드**하여 그 절차(STEP 1~4)를 따른다.
캠페인 생성의 모든 상세 절차·참조 데이터·검증된 페이로드는 그 스킬 안에 있다.

**트리거 (하나라도 해당되면 `mce-campaign` 로드):**
- 캠페인 생성/추천/리스트업 요청 — "캠페인 만들어줘", "신규회원/이탈/장바구니/생일/쿠폰 캠페인", "어떤 캠페인 만들 수 있어", "캠페인 목록"
- 저니(Journey) 생성 요청 — "저니 만들어줘", "journey 생성"
- 정의서(xlsx / CSV / Google Sheets) 첨부 또는 "이 정의서로 저니 생성"
- 그 외 SFMC Journey Builder / Event Definition / Decision·Engagement Split 관련 작업

스킬 본문: [`.claude/skills/mce-campaign/SKILL.md`](.claude/skills/mce-campaign/SKILL.md)
참조 데이터: `.claude/skills/mce-campaign/reference/` (저니 페이로드·이메일 표준·고정값·오류 학습)
**분석 가이드(2층·3에이전트 이원화)**: `reference/analysis-guide/_common.md`(공통 방법 — 컬럼 프로파일링→캠페인 도출, 사전집계, 부트스트랩) + `reference/analysis-guide/ecommerce-default.md`(활성 고객사 값 — 분석 §1·2, 기획 §6, 전이 §7). ⭐ **MD는 "의미 사전"이지 쿼리·캠페인 카탈로그가 아니다** — 캠페인 목록·기준선·측정 세그먼트는 AI가 마스터 DE를 프로파일링해 스스로 정한다(§3·§4는 예시). 새 고객사는 `analysis-guide/<고객사>.md` 한 개만 추가하고 SKILL.md의 "활성 고객사" 줄만 바꾼다.

---

## ⭐ 라우팅 — 초기 세팅 점검은 `mce-onboarding` 스킬로

아래 의도가 감지되면 **`mce-onboarding` 스킬을 로드**하여 그 절차를 따른다. 점검 실작업은 `mce-onboarding-agent` 워커에 위임한다.

**트리거 (하나라도 해당되면 `mce-onboarding` 로드):**
- 초기 세팅/온보딩 점검 — "세팅 점검", "온보딩 점검", "초기 설정 확인", "발송 준비됐어?", "남은 세팅 뭐야"
- 발송 인프라 진단 — Sender Profile·Send Classification·도메인 인증·전용 IP·IP 워밍 일정 관련 질문

이 스킬은 **읽기 전용 진단 + 가이드**다. 계정 설정을 변경하지 않으며, IP 워밍·도메인 인증·물리 주소는 `❌ 확인 필요`로 **표시만** 하고 권장 일정을 **텍스트 플랜으로만** 제시한다(리마인더 등록 안 함).

스킬 본문: [`.claude/skills/mce-onboarding/SKILL.md`](.claude/skills/mce-onboarding/SKILL.md)
참조 데이터: `.claude/skills/mce-onboarding/reference/` (점검 체크리스트·IP 워밍 램프 템플릿)

---

## ⭐ 라우팅 — 기본 세팅(발송결과/감사로그/IP워밍 저니)은 `mce-base-setup` 스킬로

아래 의도가 감지되면 **`mce-base-setup` 스킬을 로드**하여 그 절차를 따른다. 실작업은 `mce-base-setup-agent` 워커에 위임한다.

**트리거 (하나라도 해당되면 `mce-base-setup` 로드):**
- 기본 세팅 실행 — "기본세팅", "기본 세팅 해줘"
- ① 발송 결과 적재 — "발송 결과 적재", "트래킹 데이터 적재", 데이터뷰(_Sent/_Open 등) 적재 요청
- ② 감사로그 적재 — "감사로그 적재", "audit log 적재"
- ③ IP 워밍용 저니 생성 — "IP 워밍 저니 만들어줘", "워밍용 저니 생성"

이 스킬은 **계정에 객체를 실제로 생성하는 쓰기 작업**이다(온보딩 '점검'과 완전 별개). 그래서 **위임 전에 상위가 생성 예정 객체 목록을 제시하고 `AskUserQuestion`으로 승인을 1회 받는다.** 기존 객체는 삭제/덮어쓰지 않고(멱등), 저니는 Draft로만 생성한다(발행 안 함).

스킬 본문: [`.claude/skills/mce-base-setup/SKILL.md`](.claude/skills/mce-base-setup/SKILL.md)
참조 데이터: `.claude/skills/mce-base-setup/reference/` (발송결과 파이프라인·감사로그 파이프라인·IP 워밍 저니 스펙)

---

## 🧭 오케스트레이션 흐름 — 상위 에이전트가 하위 워커에 위임

상위 에이전트(이 메인 루프)는 `mce-campaign` 스킬을 로드한 뒤, 아래 순서로 **하위 에이전트를 `Agent` 도구로 호출**한다.
하위 에이전트는 자기 STEP만 수행하고 **구조화된 결과를 상위에 반환**한다. 상위는 그 결과를 받아 다음 행동(질문/다음 위임/보고)을 결정한다.

```
(신규 고객사 온보딩 시에만)
   ▼ (상위가 호출)  Agent → mce-schema-agent  ── STEP 0-A: 스키마 파일(DDL/CSV) 분석 → 매핑표·조인키 + HITL 확인목록 반환
   ├─ [핵심 컬럼 확인] 상위가 AskUserQuestion (핵심 ID·총구매액 산식·취소환불 제외·동의값 해석)
   ▼ (상위가 호출)  Agent → mce-schema-agent  ── STEP 0-B: 빈 RAW DE(원본 컬럼명) + 활성 고객사 가이드 MD 자동생성 + CSV 업로드 안내 반환
   ├─ 상위가 활성 고객사 전환 확인(AskUserQuestion) → SKILL.md/CLAUDE.md 활성 고객사 줄 갱신
   ▼ ⏳ 데이터 적재 게이트 (사용자가 SFMC UI에서 CSV 업로드 → RAW DE 적재 → 이후 STEP 1 가능)

사용자 한 문장
   │
   ▼ (상위가 호출)  Agent → mce-topic-agent   ── STEP 1: 고객 데이터 진단(SEG_* 카운트 rowCount) → 추천 캠페인 목록 반환
   │
   ├─ (리스트업/진단이면) 진단표+추천 목록만 즉시 출력 — 분석 리포트(PPT)는 **사용자가 명시 요청할 때만** [reference/report-guide.md §7]대로 생성해 reports\ 저장·경로 제시  (HTML/Artifact 미생성)
   ├─ [수동] 상위가 후보 표 제시 → 사용자 캠페인 선택(번호/추천) → 실행 모드 질문(AskUserQuestion)
   │        [자동] 상위가 의도에 맞는 후보 자동 선정
   ▼ (상위가 호출)  Agent → mce-planning-agent ── STEP 2: 확정 입력으로 Plan + xlsx 정의서 생성 → 경로/요약 반환
   │
   ├─ [수동] 상위가 Plan/정의서 제시 → Plan 승인(AskUserQuestion: 승인 / 수정)
   │        [자동] 승인 없이 통과
   ▼ (상위가 호출)  Agent → mce-journey-agent  ── STEP 3: 정의서 파싱 → SFMC Journey 생성(기본 Draft) → 결과 반환
   │
   ▼ 상위가 STEP 4 결과 종합 보고 (표 + 흐름도 + Journey 링크) + journey_history.md append
```

**위임 규칙:**
- **사용자와의 모든 대화·질문·승인은 상위 에이전트만** 한다. 하위 에이전트는 사용자에게 질문하지 않는다(질문이 필요하면 상위에 반환하고 상위가 묻는다).
- 상위는 각 하위 호출 시 **그 STEP에 필요한 입력**(선택된 캠페인·DE/필드·확정 Plan 값·실행 모드·정의서 경로 등)을 프롬프트에 모두 담아 전달한다.
- 하위가 반환한 결과(후보 목록·정의서 경로·Journey ID 등)는 상위가 보관하여 다음 하위 호출의 입력으로 넘긴다.
- **⓪ 신규 고객사 온보딩(스키마 파일 첨부 / 활성 고객사 가이드·RAW DE 없음)** 이면 STEP 1 전에 상위가 **STEP 0(스키마 분석)** 을 태운다: `mce-schema-agent`를 **2번** 호출한다 — Phase A(분석→매핑표+HITL 목록 반환) → 상위가 `AskUserQuestion`으로 핵심 컬럼 확정(핵심 ID·총구매액 산식·취소환불 제외·동의값) → Phase B(빈 RAW DE(원본 컬럼명) + `analysis-guide/<고객사>.md` 자동생성 + CSV 업로드 안내). 이후 상위가 활성 고객사 전환을 확인해 SKILL.md/CLAUDE.md 활성 고객사 줄을 갱신한다. **STEP 0의 산출물은 매핑표·빈 RAW DE·가이드 MD까지다.** (적재는 사용자가 CSV 업로드로 수행) (분석 리포트(PPT)는 데이터 적재 후 사용자가 요청할 때만 생성) (상세: `mce-campaign` 스킬 STEP 0 절 + `reference/schema-mapping.md`)
- **정의서를 사용자가 직접 첨부**한 경우 STEP 1·2를 건너뛰고 곧바로 `mce-journey-agent`(STEP 3)만 호출한다.
- **읽기 전용 조회**(저니/DE/이메일 목록 등)는 위임하지 않고 **상위 에이전트가 직접** SFMC MCP를 호출해 답한다(아래 전역 규칙).
- **📨 메시지 채널이 알림톡/문자/카카오/SMS이면** STEP 2 위임 전에 상위가 **"채널 해소(seq 확보)"** 를 직접 수행한다: ① 현재 BU 알림톡 저니에서 `applicationExtensionKey`·`send_key` 확인 → ② `send_key`로 micrm **`mobileList.ajax`(모바일 컨텐츠 목록)** 를 **브라우저(Claude in Chrome)** 로 조회 → ③ seq 선택(자동=의도매칭/수동=후보제시. **저니에 넣는 seq=모바일 컨텐츠 seq**, `atTmplLst`의 알림톡 템플릿 id 아님) → ④ 변수↔DE 매핑. 이 값(seq·키·변수매핑)을 planning 워커에 넘겨 정의서에 기록하게 한다. **워커는 micrm 웹세션에 접근 못 하므로 seq 조회를 위임하지 않는다.** (상세: `mce-campaign` 스킬 "메시지 채널 해소" 절 + `reference/journey-build.md` ④)

> 자동 모드에서는 위 세 위임을 **무발화로 연속 실행**하고 맨 마지막에 STEP 4 결과만 1회 출력한다.

---

## 🔎 조회 요청은 항상 실시간 SFMC — 로컬 파일 금지 (전역 규칙)

"저니 목록 / 최근 저니 / 저니 조회 / 생성된 저니 보여줘", "automation·DE·이메일 목록·조회" 등 **읽기 전용 조회**는 캠페인 생성 흐름이 아니며, **반드시 SFMC MCP 도구를 실시간 호출**해 답한다.

- **저니 조회/목록/최근 저니** → `sfmc_get_journeys` 를 호출한다. "최근"이면 **ModifiedDate(없으면 CreatedDate) 최신순 정렬** 후 상위 N개만 보여준다.
- **절대 `journey_history.md`·`campaign_definitions\` 폴더(xlsx 정의서)를 조회 답변의 출처로 삼지 않는다.** 이 파일들은 사용자가 "이 봇으로 만든 생성 *이력*을 보여줘"처럼 **로컬 이력을 명시적으로 요청**할 때만 쓴다.
- 정의서 입력 우선순위의 "최신/방금 만든/최근 → 로컬 파일" 규칙은 **STEP 3 정의서 선택에만** 해당하며, 저니/객체 조회에는 적용하지 않는다.
- 조회 결과에는 가능하면 이름·ID·상태·수정일을 함께 표기한다.
- 이 규칙은 `mce-campaign` 스킬을 로드하지 않는 단순 조회 요청에도 **항상 적용**된다.

---

## 🚫 결과만 전달 (과정 비노출) — 전역 최우선 원칙

**도구 호출 사이에 어떤 진행·전환·완료 설명 문장도 출력하지 않는다.** 침묵하며 도구를 연속 실행하고, 사용자에게 보이는 텍스트는 다음 **셋뿐**이다:
① 단계 전환에 필요한 질문(캠페인 선택·모드 선택·스케줄·진행 방식·Plan 승인), ② 최종 결과 보고(STEP 4), ③ 오류(즉시 알림).

아래와 같은 멘트는 **전부 금지** (예시이며, 어조·시제가 다른 유사 표현도 모두 포함):
- "~를 생성합니다 / 조회합니다 / 확인합니다 / 진행합니다 / 로드합니다 / 호출합니다 / 사용합니다"
- "~ 생성 완료. 이어서 ~를 진행합니다", "~를 확인하기 위해 ~를 조회합니다", "먼저 ~를 만듭니다"
- "~했습니다 / ~를 설정합니다 / ~를 구성합니다 / ~를 기록합니다 / 반영해 두겠습니다 / 검증된 구조를 확보했습니다"
- **(워커 위임 전후)** "~를 하위 워커에 위임했습니다", "완료되면 ~를 정리해 보여드리겠습니다", "STEP N 진단이 완료됐습니다", "갈래 A이므로 ~하겠습니다"
- **(리포트 생성 사이)** "진단 데이터가 템플릿 값과 정확히 일치합니다", "리포트를 생성하겠습니다", "이어서 PPT를 만들겠습니다"

> ⚠️ **위임(`Agent` 호출)·리포트(PPT) 생성도 "도구 호출"이다** — 그 전후·사이에 위 같은 멘트를 절대 넣지 않는다. STEP 1 갈래 A(리스트업)는 워커 위임→진단을 **전부 무발화로 연속 실행**하고, **맨 마지막에 진단표+추천 목록을 1회에 출력**한다(그 사이 "위임했습니다/완료됐습니다/일치합니다/생성하겠습니다"류 한 줄도 금지). **리포트(PPT)는 자동 생성하지 않는다** — 사용자가 명시 요청할 때만 생성하며, 그때도 중간 멘트 없이 완료 후 파일 경로만 출력한다.

- **자동 모드**: STEP 1~4를 무발화로 일괄 실행한 뒤 **맨 마지막 결과(표+흐름도) 1회만** 출력한다. (자동 선정한 캠페인은 결과에 1줄로 포함)
- **수동 모드**: 위 ①질문·②결과·③오류 외에는 도구 호출 사이에 **한 줄도** 출력하지 않는다. STEP 3(저니 생성)에서 이메일 에셋·이벤트 정의·액티비티를 만드는 동안에도 중간 설명을 일절 넣지 않는다.

> 이 규칙은 캠페인 생성 전 과정(특히 STEP 3 저니 생성)에 적용되며, SKILL.md에도 동일하게 명시돼 있다. **둘 중 어느 것을 따르든 도구 호출 사이 멘트는 금지다.**

---

## 경로 자동 적용 규칙 (다른 PC에서 실행 시 필수)

> 아래 절대경로는 **작성 당시 PC 기준 예시**다. 사용자명·드라이브·폴더 위치는 PC마다 다르므로 **그대로 쓰지 말 것.**
> **항상 현재 작업 디렉토리(cwd = 이 저장소가 clone된 위치)를 "프로젝트 루트"로 삼고, 모든 경로를 그 기준으로 도출**한다.
> cwd가 예시 경로와 다르면 **무조건 cwd를 우선**한다. (별도 설치/치환 스크립트 불필요 — 런타임에 알아서 적용)

- **프로젝트 루트**: 현재 cwd (환경 정보의 working directory) — *예시: `C:\Users\MILVUS\Desktop\mce-packege-v2-main`*
- **정의서 폴더**: `<프로젝트 루트>\campaign_definitions`
- **정의서 생성 스크립트**: `generate_campaign_definition.js` (`__dirname` 기준 자동 처리)

스킬 본문/참조 파일에 등장하는 모든 `C:\Users\MILVUS\...` 예시 경로도 동일하게 **현재 프로젝트 루트로 치환**하여 사용한다.

---

## Google Sheets 정의서 (직접 첨부 입력 시)

- **Spreadsheet ID**: `<확인필요: 고객사 정의서 Spreadsheet ID>`
- **URL**: `https://docs.google.com/spreadsheets/d/<확인필요: 고객사 정의서 Spreadsheet ID>`
- Apps Script는 사용하지 않는다.

---

## 저니 생성 이력

- 저니 생성 결과는 `<프로젝트 루트>\.claude\journey_history.md` 에 누적 append 한다. (형식은 SKILL.md STEP 4 참조)
- `MEMORY.md` 인덱스에는 등록하지 않는다. (자동 로딩 방지)

---

## 하위 에이전트 (워커) — 현재 활성

| 하위 에이전트 | 담당 STEP | 역할 | 입력 (상위가 전달) | 반환 (상위가 수령) |
|---|---|---|---|---|
| [`mce-schema-agent`](.claude/agents/mce-schema-agent.md) | STEP 0 | (A)스키마 파일 분석→원본 컬럼 개념 태깅·조인키+HITL 목록 / (B)빈 RAW DE(원본 컬럼명)·활성 고객사 가이드 MD 자동생성·CSV 업로드 안내 | (A)스키마 파일 경로/내용 / (B)확정 매핑+HITL 확정값+고객사명 | (A)매핑표+확인목록 / (B)RAW DE 목록·업로드 안내·가이드 MD 경로 |
| [`mce-topic-agent`](.claude/agents/mce-topic-agent.md) | STEP 1 | 고객 데이터 진단(Customer_Profile 값 집계 → 비율) → 추천 캠페인 | 사용자 의도 한 문장 | 진단표(지표·인원·비율·추천 캠페인) |
| [`mce-planning-agent`](.claude/agents/mce-planning-agent.md) | STEP 2 | Plan 설계 + xlsx 정의서 생성 | 선택 캠페인·DE/필드·실행 모드·(수동 시)확정 Plan 값 | 정의서 파일 경로 + Plan 요약 |
| [`mce-journey-agent`](.claude/agents/mce-journey-agent.md) | STEP 3 | 정의서 → SFMC Journey 생성(기본 Draft) | 정의서 경로/캠페인 ID·발행 여부 | Journey 이름·ID·상태·링크 |
| [`mce-onboarding-agent`](.claude/agents/mce-onboarding-agent.md) | (온보딩) | 발송 인프라 read-only 점검 → 세팅 상태 분류 + 잔여 태스크·일정 가이드 | 점검 요청 | 세팅 점검 리포트(✅/⚠️/❌) + 워밍 일정 플랜 |
| [`mce-base-setup-agent`](.claude/agents/mce-base-setup-agent.md) | (기본 세팅) | ① 발송 결과 적재(DE+SQL+Automation) ② 감사로그 적재(Audit API→DE) ③ IP 워밍 저니 생성(Draft) | 승인된 실행 범위(①②③) | 생성/실행 결과 표 + 워밍 운영 가이드 |

> 모든 워커는 상세 절차·검증 페이로드를 `mce-campaign` 스킬의 `reference/` 파일을 SSOT로 따른다. (STEP 0 = [`reference/schema-mapping.md`](.claude/skills/mce-campaign/reference/schema-mapping.md))
