# MCE 사용 준비 점검 체크리스트 (SSOT)

이 파일은 `mce-onboarding` 스킬과 `mce-onboarding-agent` 워커가 공통으로 따르는 점검 항목 정의다.
목표는 **"이 계정으로 MCE를 실제로 운영(발송)할 수 있는 상태인가"** 를 진단하는 것이다.

## 점검 방식 라벨

| 라벨 | 의미 |
|---|---|
| 🟢 API 확인 | MCP 읽기 도구로 직접 점검 가능 |
| 🟡 추론 | 해당 API 엔드포인트가 응답하는지로 활성화 여부를 간접 추정 |
| 🔵 Setup 수동 | Setup(관리) 영역 — API로 점검 불가, 콘솔에서 직접 확인 (질문하지 않고 표시만) |

## 결과 분류 라벨 (리포트 출력용)

- **✅ 구성됨** — 확인된 정상 구성
- **⚠️ 점검필요** — 존재하나 미완/비정상 (행 0개, 일시정지, 리스트 미분리, 한쪽만 존재 등)
- **❌ 수동확인** — 🔵 Setup 항목 (콘솔에서 직접 확인) 또는 점검 불가
- **➖ 미구성** — (카테고리 B 전용) 기본 세팅 산출물이 아직 생성되지 않음 — 오류가 아니라 선택 사항이며, `mce-base-setup` 스킬로 생성 가능함을 안내

---

## 카테고리 A — 접속/연동 기반 (MCE 진입 조건)

| # | 항목 | 점검 방식 | 도구 / 확인 위치 | 판정 |
|---|---|---|---|---|
| A1 | API 연동 (Installed Package / OAuth) | 🟡 추론 | MCP 도구 호출이 200 응답 → 연동 정상 | 응답하면 ✅ |
| A2 | Business Unit 구성 | 🔵 Setup | Administration → Account → Business Units | 표시만 |
| A3 | 사용자 / 역할 / 권한 | 🔵 Setup | Administration → Users / Roles | 표시만 |
| A4 | 기능 프로비저닝 (Email Studio / Journey Builder / Automation Studio / Contact Builder) | 🟡 추론 | 각 API 응답 여부 (`get_content_categories`=Content Builder, `get_data_extension_folders`=Contact Builder/데이터 모델, `get_automations`=Automation Studio, `get_journeys`=Journey Builder) | 응답하면 ✅ |

> **데이터/대상(진입 DE·데이터 적재·구독 리스트)은 이 점검 범위 밖이다.** 그것은 캠페인 흐름(`mce-campaign` STEP 1: 대상자 집계·진입 DE 생성)이 담당한다.
> 온보딩은 "데이터 모델/Contact Builder를 **쓸 수 있는가**"까지만(A4 추론) 본다.

## 카테고리 B — 기본 세팅 산출물 (`mce-base-setup` 3종 파이프라인)

`mce-base-setup` 스킬이 생성하는 운영 기반 객체들이 계정에 존재하는지 **읽기 전용으로** 점검한다.
(객체 이름/Key의 SSOT = [`mce-base-setup` 스킬의 reference](../../mce-base-setup/SKILL.md). 승인 단계에서 이름을 바꿔 생성했을 수 있으므로, 기본 이름으로 못 찾으면 유사 이름 검색 후에도 없을 때만 ➖로 판정한다.)

| # | 항목 | 점검 방식 | 도구 / 확인 대상 | 판정 |
|---|---|---|---|---|
| B1 | 발송 결과 적재 (①) | 🟢 API 확인 | DE `SENDLOG_Daily`(key `sendlog_daily`)·`SENDLOG_History`(key `sendlog_history`) → `sfmc_get_data_extension`, Automation `AUTO_SendLog_Daily` → `sfmc_get_automations`, SQL Query `QRY_SendLog_Daily`/`QRY_SendLog_History` → `sfmc_get_sql_queries` | 아래 공통 판정 |
| B2 | 감사로그 적재 (②) | 🟢 API 확인 | DE `AUDITLOG_Activity`·`AUDITLOG_Access`(key `auditlog_*`) → `sfmc_get_data_extension`, Automation `AUTO_AuditLog_Daily` → `sfmc_get_automations` | 아래 공통 판정 |
| B3 | IP 워밍 저니 (③) | 🟢 API 확인 | DE `IPWARM_Targets`(key `ipwarm_targets`) → `sfmc_get_data_extension`, Journey `IPWarming_Ramp` → `sfmc_get_journeys` | 아래 공통 판정 |

**B 공통 판정:**

- 해당 세트의 객체가 **전부 존재 + 정상**(Automation이 스케줄/Ready, 저니 존재) → ✅ 구성됨
- **일부만 존재**하거나 존재하되 비정상(Automation Paused/미스케줄, History DE rowCount 0인데 Automation은 오래전 생성 등) → ⚠️ 점검필요 (누락 객체·이슈 명시)
- **전부 없음** → ➖ 미구성 — "`mce-base-setup`(해당 번호)로 생성 가능"을 잔여 태스크에 안내 (오류 아님)
- 카테고리 B는 ❌(수동확인)를 쓰지 않는다 — 전 항목 API로 점검 가능하다.

> C3(IP 워밍 진행)과 B3의 관계: B3은 "워밍용 저니/DE **객체가 있는가**"(API), C3은 "워밍 **운영이 진행되고 있는가**"(수동) — 별개 항목이다.

## 카테고리 C — 발송 인증 / 평판 (Deliverability)

| # | 항목 | 점검 방식 | 도구 / 확인 위치 | 판정 |
|---|---|---|---|---|
| C1 | 도메인 인증 (SAP: SPF/DKIM/DMARC) | 🔵 Setup | Setup → Sender Authentication Package | 표시만 (운영 발송 전 **필수**) |
| C2 | 전용 IP 보유 여부 | 🔵 Setup | Setup → Reputation / 영업 담당 | 표시만 |
| C3 | IP 워밍 진행 | 🔵 Setup(운영) | (수동 운영) | 표시만 (신규 전용 IP면 필수) |
| C4 | Reply Mail Management (회신 처리) | 🔵 Setup | Setup → Reply Mail Management | 표시만 |
| C5 | CAN-SPAM 물리 주소 | 🔵 Setup | Setup → Account Settings | 표시만 (**필수**) |
| C6 | Link/Tracking 도메인 브랜딩 | 🔵 Setup | Setup → Domains | 표시만 |

## 카테고리 D — 발송 구성 (Send Configuration)

| # | 항목 | 점검 방식 | 도구 / 확인 위치 | 판정 |
|---|---|---|---|---|
| D1 | Sender Profile | 🟢 API 확인 | `sfmc_get_sender_profiles` | 없으면 ⚠️ |
| D2 | Send Classification (Marketing/Operational) | 🟢 API 확인 | `sfmc_get_send_classifications` | 한쪽만 존재 → ⚠️ |
| D3 | Delivery Profile 연결 | 🟢 API 확인 | Send Classification의 DeliveryProfile 참조 | 미연결 → ⚠️ |
| D4 | Subscription/Profile Center, Unsubscribe | 🔵 Setup | Setup → Subscriber 관리 | 표시만 (**필수**) |

---

## 판정 원칙

> - 판정 기준은 절대 규칙이 아니라 가이드다. 계정 성격(운영/교육/테스트)에 따라 ⚠️ 항목이 정상일 수 있으므로,
>   워커는 단정하지 말고 "이슈 + 권장 조치"를 함께 제시한다.
> - 🔵 Setup 항목은 사용자에게 되묻지 않는다. 리포트에 `❌ 확인 필요`로 표시하고 확인 위치만 안내한다(정책: 표시만).
> - 🟡 추론 항목은 "API 응답으로 추정"임을 명시한다(단정 금지).
