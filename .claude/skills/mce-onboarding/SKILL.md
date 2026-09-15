---
name: mce-onboarding
description: >
  MCE(SFMC Marketing Cloud Engagement) 초기 세팅 점검 / 온보딩 가이드. 프로젝트 초기 설정 후
  계정의 발송 인프라(Sender Profile·Send Classification·List·DE·Automation 등) 상태를
  실시간 점검하여 '구성됨 / 점검필요 / 수동확인'으로 분류하고, IP 워밍·도메인 인증 등
  API로 자동화할 수 없는 잔여 태스크와 권장 일정을 텍스트 플랜으로 가이드한다.
  "세팅 점검", "온보딩 점검", "초기 설정 확인", "발송 준비됐어?", "IP 워밍 일정",
  "남은 세팅 뭐야" 등의 요청 시 이 스킬을 사용한다.
---

# MCE 초기 세팅 점검 / 온보딩 가이드 — 오케스트레이터 + 워커

사용자가 "세팅 점검해줘" 류의 요청을 하면, **상위 에이전트(오케스트레이터)** 가
점검 작업을 **`mce-onboarding-agent` 워커에게 `Agent` 도구로 위임**하고,
워커가 반환한 세팅 상태 리포트 + 잔여 태스크 + 권장 일정을 사용자에게 보고한다.

> 이 스킬은 **읽기 전용 진단 + 가이드**다. 계정 설정을 자동으로 변경하지 않는다.
> 특히 **IP 워밍·도메인 인증(SAP)·물리 주소 등록은 API로 수행하지 않는다** — 상태를 점검·표시하고
> 권장 일정을 텍스트 플랜으로 제시할 뿐이다.

## 정책 (확정값)

- **수동 확인 항목 처리 = 표시만**: 도메인 인증·전용 IP·IP 워밍·CAN-SPAM 물리 주소처럼 API로 점검 불가한 항목은
  사용자에게 되묻지 않고 `❌ 확인 필요`로 **표시만** 한다. (인터랙티브 질문 없음)
- **일정 = 텍스트 플랜만**: 워밍 마일스톤·발송량 램프는 **리포트에 표로 출력만** 하고,
  `schedule`/CronCreate 등 실제 리마인더는 **등록하지 않는다.**

## 참조 파일

- **점검 체크리스트** → [`reference/setup-checklist.md`](reference/setup-checklist.md) — 점검 항목 정의(API 자동분 / 수동확인분)와 분류 기준
- **IP 워밍 램프 템플릿** → [`reference/ip-warming-plan.md`](reference/ip-warming-plan.md) — 전용 IP 신규 시 권장 발송량 일정

## 경로

> ⚠️ 절대경로는 PC마다 다르다. 항상 현재 작업 디렉토리(cwd)를 프로젝트 루트로 삼는다.

---

## 전체 흐름

```
사용자: "세팅 점검해줘"
   │
   ▼ (상위가 호출)  Agent → mce-onboarding-agent
   │     ① API 자동 점검 (Sender Profile / Send Classification / List / DE / Automation ...)
   │     ② 상태 분류 (✅ 구성됨 / ⚠️ 점검필요 / ❌ 수동확인)
   │     ③ 잔여 태스크 + 권장 일정(텍스트 플랜) 산출
   │
   ▼ 상위가 리포트 종합 보고 (점검 표 + 잔여 태스크 + 워밍 일정 플랜)
```

---

## STEP 1 — 점검 (read-only)

워커는 **"이 계정으로 MCE를 운영(발송)할 수 있는 상태인가"** 를 [`reference/setup-checklist.md`](reference/setup-checklist.md)의 **4개 카테고리**로 점검한다. 점검 방식은 3가지다:

- 🟢 **API 확인** — MCP 읽기 도구로 직접 점검
- 🟡 **추론** — 해당 API 엔드포인트가 응답하는지로 활성화 여부를 간접 추정 (단정 금지)
- 🔵 **Setup 수동** — Setup(관리) 영역, API 점검 불가 → `❌ 확인 필요`로 표시만

| 카테고리 | 주요 항목 | 대표 점검 |
|---|---|---|
| **A. 접속/연동 기반** | API 연동(Installed Package), Business Unit, 사용자/권한, 기능 프로비저닝 | 🟡 API 응답 / 🔵 Setup |
| **B. 기본 세팅 산출물** | 발송결과 적재(SENDLOG DE·Automation), 감사로그 적재(AUDITLOG DE·Automation), IP 워밍 저니(IPWARM DE·Journey) — `mce-base-setup` 3종 | 🟢 `get_data_extension`·`get_automations`·`get_journeys` |
| **C. 발송 인증/평판** | 도메인 인증(SAP), 전용 IP·IP 워밍, RMM, 물리 주소, 트래킹 도메인 | 🔵 Setup (대부분 수동확인) |
| **D. 발송 구성** | Sender Profile, Send Classification, Delivery Profile, 구독센터 | 🟢 `get_sender_profiles`·`get_send_classifications` |

> **데이터/대상(진입 DE·데이터 적재·구독 리스트)은 점검 범위 밖**이다 — 캠페인 흐름(`mce-campaign` STEP 1)이 담당한다. 온보딩은 "데이터 모델/Contact Builder를 쓸 수 있는가"까지만(A4 추론) 본다.

**사용하는 읽기 전용 MCP 도구**: `sfmc_get_sender_profiles`, `sfmc_get_send_classifications`, `sfmc_get_data_extension_folders`, `sfmc_get_content_categories`, `sfmc_get_automations`, `sfmc_get_journeys`, `sfmc_get_data_extension`, `sfmc_get_sql_queries`. (`get_content_categories`·`get_data_extension_folders`·`get_automations`·`get_journeys`의 정상 응답은 각각 Content Builder·Contact Builder·Automation Studio·Journey Builder **활성화 추론**에 쓰고, `get_data_extension`·`get_sql_queries`·`get_automations`·`get_journeys`는 **카테고리 B(기본 세팅 산출물)** 존재 점검에 쓴다.)

## STEP 2 — 상태 분류

| 분류 | 의미 |
|---|---|
| ✅ 구성됨 | 확인된 정상 구성 (🟢 또는 🟡 응답) |
| ⚠️ 점검필요 | 존재하나 비정상/미완(행 0개, 일시정지, 리스트 미분리, 한쪽만 존재 등) |
| ❌ 수동확인 | 🔵 Setup 항목 — 콘솔에서 직접 확인 (질문 없이 표시만) |
| ➖ 미구성 | (카테고리 B 전용) 기본 세팅 산출물 없음 — 오류 아님, `mce-base-setup`으로 생성 가능 안내 |

**❌ 수동확인 항목 (체크리스트 카테고리 A/C/D의 🔵 Setup 항목 — 질문하지 않고 표시만):**

| 항목 | 콘솔 확인 위치 | 운영 발송 전 |
|---|---|---|
| Business Unit / 사용자·권한 | Administration → Account / Users | — |
| 도메인 인증 (SAP / SPF·DKIM·DMARC) | Setup → Sender Authentication Package | **필수** |
| 전용 IP / IP 워밍 | Setup → Reputation / 영업 담당 | 대량 발송 시 |
| Reply Mail Management | Setup → Reply Mail Management | 권장 |
| CAN-SPAM 물리 주소 | Setup → Account Settings | **필수** |
| Subscription/Profile Center, Unsubscribe | Setup → Subscriber 관리 | **필수** |

## STEP 3 — 잔여 태스크 + 권장 일정 (텍스트 플랜)

⚠️·❌ 항목을 모아 **잔여 태스크 목록**을 만들고, 전용 IP 워밍이 필요하면
[`reference/ip-warming-plan.md`](reference/ip-warming-plan.md)의 램프 표를 그대로 제시한다.

> 일정은 **표로 출력만** 한다. 리마인더를 실제로 등록하지 않는다.
> 마일스톤 예: "도메인 인증·물리 주소 등록은 워밍 시작 D-7 전까지 완료 권장."

---

## STEP 4 — 결과 보고 (출력 포맷)

상위 에이전트가 워커 반환물을 아래 형식으로 보고한다.

```
## 📋 MC 초기 세팅 점검 리포트  (<BU 이름>)

### ✅ 구성 완료
| 항목 | 상태 | 내용 |

### ⚠️ 점검 필요
| 항목 | 이슈 | 권장 조치 |

### ❌ 수동 확인 (콘솔에서 직접 확인)
| 항목 | 이유 | 확인 위치 |

### ➖ 기본 세팅 미구성 (`mce-base-setup`로 생성 가능 — 해당 시)
| 항목 | 상태 | 생성 방법 |

### 🗓️ 잔여 태스크 + 권장 일정
- (잔여 태스크 목록 — 기본 세팅 미구성분은 "기본세팅 해줘(①/②/③)"로 생성 가능함을 안내)
- (IP 워밍 램프 표 — 해당 시)
```

> **결과만 전달 (과정 비노출)**: 도구 호출 사이에 진행 멘트를 넣지 않는다.
> 사용자에게 노출하는 것은 최종 리포트와 오류뿐이다.

---

## 조회 요청과의 관계

이 스킬은 "세팅이 준비됐는지"를 **진단**하는 용도다.
단순 "저니 목록 / DE 목록" 같은 읽기 전용 조회는 이 스킬이 아니라 CLAUDE.md의 전역 조회 규칙(SFMC 실시간 조회)을 따른다.
