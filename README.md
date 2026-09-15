# sf-mce-mcp

Salesforce Marketing Cloud Engagement (MCE) MCP 서버입니다. Claude Code에서 SFMC의 주요 기능을 자연어로 조작할 수 있도록 도구(Tool)를 제공합니다.

> 🆕 **이 저장소는 신규 고객사 구축용 템플릿입니다.** 이전 고객사의 데이터·계정 ID·산출물이 모두 제거돼 있고,
> 계정 고유값은 `<확인필요: …>` 자리표시자로 표시돼 있습니다.
> **구축 순서와 교체 대상은 [`docs/신규고객사_구축_체크리스트.md`](docs/신규고객사_구축_체크리스트.md)를 먼저 보세요.**
>
> 🎓 **처음이라면** — 실제 고객사 데이터를 붙이기 전에 동봉된 가상 데이터셋([`docs/schema-samples/urbanmall/`](docs/schema-samples/urbanmall/), 회원 10,000명)으로
> STEP 0→1→2→3을 그대로 한 바퀴 돌려볼 수 있습니다. 체크리스트 **0단계** 참조.

---

## 개요

| 항목 | 내용 |
|------|------|
| **서버명** | `sf-mce-mcp` |
| **연동 플랫폼** | Salesforce Marketing Cloud Engagement |
| **주요 기능** | Journey Builder, Data Extension, Email/SMS 발송, Automation Studio, Content Builder |
| **캠페인 자동화** | **오케스트레이터 + 서브 에이전트** — 상위 에이전트([CLAUDE.md](CLAUDE.md))가 총괄하고 STEP 1~3을 서브 에이전트(topic/planning/journey)에 위임 |

---

## 서버 아키텍처

`sf-mce-mcp`는 로컬에서 실행되는 서버가 아닌 **Salesforce가 호스팅하는 원격 MCP 서버**입니다.

```
https://mai-mce-mcp-cdp1.sfdc-yfeipo.svc.sfdcfc.net/t/<테넌트ID>/c/<클라이언트ID>/api/mcp
```

- 별도의 서버 설치, 빌드, 실행이 필요 없습니다
- 엔드포인트 URL은 계정의 **테넌트 ID(28자 Subdomain)** 와 Public App 패키지의 **Client ID(24자)** 로 구성됩니다
- 모든 SFMC API 호출은 Salesforce 인프라 내에서 처리됩니다

---

## 다른 PC에서 가져와 사용하기 (빠른 시작)

새 PC 세팅은 **사전 조건(MC 관리자) → 0단계(사전 설치) → 1~3단계(가져오기·연결) → 4단계(인증)** 순서입니다. (경로 수정·치환 작업은 필요 없습니다.)

### 사전 조건 (MC 관리자 작업)

**사용자 본인이 할 수 없는 단계**입니다. 아래가 안 되어 있으면 0~3단계를 마쳐도 4단계 인증에서 `user_not_licensed` 로 막힙니다.

| 항목 | 위치 |
|---|---|
| ① MC 사용자 계정 발급 + **대상 BU 접근 권한** | Setup → Users |
| ② Installed Package(Public App)에 **그 사용자 라이선스 부여** | Administration → Installed Packages → 해당 패키지 |

> **②는 ①과 별개입니다.** BU 접근 권한이 있어도 패키지 라이선스가 없으면 MCP 인증이 거부됩니다.
> **라이선스가 이미 부여돼 있는데도 `user_not_licensed` 가 나오면**, 이미 정상 동작하는(라이선스 보유) 다른 사용자가 자기 PC에서 `/mcp` → `Authenticate` 로 재인증한 뒤 다시 시도하세요. 2026-08 사례에서 이 방법으로 해결됐습니다.

### 0단계: 사전 설치 (새 PC에 최초 1회)

**① Node.js LTS 설치**

[nodejs.org](https://nodejs.org)에서 LTS 버전 설치. 설치 확인:

```bash
node -v
npm -v
```

> `'node'은(는) 내부 또는 외부 명령...` 이 나오면 Node.js 미설치 또는 PATH 미반영 상태입니다. 설치 후 **터미널을 새로 열어야** 합니다.

**② Claude Code CLI 설치** — 둘 중 하나 선택:

```powershell
# 방법 1 — PowerShell 네이티브 설치 (Node 불필요, 권장)
irm https://claude.ai/install.ps1 | iex
```

```bash
# 방법 2 — npm 설치 (Node.js 설치 후)
npm install -g @anthropic-ai/claude-code
```

설치 후 **터미널을 완전히 닫고 새로 연 다음** 확인:

```bash
claude --version
```

**③ Claude 계정 로그인 (최초 1회)**

```bash
claude
```

첫 실행 시 브라우저로 Anthropic 계정 로그인이 진행됩니다.

> (선택) xlsx 파싱에 Python을 쓰는 경우 Python도 권장

### 1~3단계: 저장소 가져오기 + MCP 연결

```bash
# 1) 저장소 가져오기 — clone 위치/폴더명은 자유
git clone <레포 URL>
cd <클론한 폴더>

# 2) 의존성 설치 — node_modules 는 깃에 없으므로 반드시 실행
#    (MCP 연결과는 무관. xlsx 정의서·PPT 리포트 생성에 필요)
npm install

# 3) 원격 MCP 서버 연결 — URL은 테넌트별 고정값 재사용
#    -s user: PC 전체에서 사용 가능하게 등록 (생략 시 현재 폴더 전용)
claude mcp add -s user --transport http sf-mce-mcp "<테넌트별 엔드포인트 URL>"
```

> **엔드포인트 URL은 MC 관리자에게 받으세요.** 저장소에는 포함되지 않습니다 — URL의 `/t/<테넌트ID>/c/<ClientID>` 부분이 계정·Installed Package마다 다르기 때문입니다. 직접 구성해야 하면 아래 **설치 및 연결** 1단계로 테넌트ID(28자)·Client ID(24자)를 확인하세요.

### 4단계: SFMC 인증 + 동작 확인

```bash
claude
```

프로젝트 폴더에서 실행 후:

1. `/mcp` 입력 → 브라우저에서 **SFMC 계정 로그인** 1회 → `Authentication successful. Connected to sf-mce-mcp.` 확인
   (이때 로그인하는 SFMC 계정이 해당 테넌트/BU에 접근 가능하고, **사전 조건 ②의 패키지 라이선스**를 받은 상태여야 합니다. URL만으로는 접근 불가)
2. "저니 목록 보여줘" 같은 읽기 조회가 실시간 응답하면 연결 완료

### 자주 나오는 오류

| 증상 | 원인 | 해결 |
|---|---|---|
| `'claude'은(는) 내부 또는 외부 명령...` | Claude Code CLI 미설치 / PATH 미반영 | 0단계 ②로 설치 → **터미널 새로 열기** (그래도 안 되면 재부팅) |
| `'node'은(는) 내부 또는 외부 명령...` | Node.js 미설치 | 0단계 ①로 설치 → 터미널 새로 열기 |
| `npm install` 중 `ETIMEDOUT`/`ECONNRESET` | 사내 프록시/네트워크 차단 | 프록시 설정 또는 다른 네트워크에서 재시도 |
| `npm install` 중 `EPERM`/`EACCES` | OneDrive 동기화·백신 파일 잠금 | OneDrive 밖 경로(예: `C:\work\`)에 clone |
| `/mcp`에서 서버가 안 보임 | `--transport http` 누락(로컬 stdio로 등록됨) | `claude mcp remove sf-mce-mcp` 후 3단계 명령 그대로 재등록 |
| 저니 조회 시 권한 오류 | SFMC 로그인 계정의 BU 접근 권한 부족 | 대상 BU 접근 가능한 계정으로 재인증 |
| `/mcp` 인증 시 `user_not_licensed` | 로그인한 MC 계정에 **패키지 라이선스 없음**, 또는 **계정 단위 앱 승인이 무효화됨** (Claude Code 설정 문제 아님) | **사전 조건** ② 확인 → 이미 부여돼 있으면 **라이선스 보유 사용자가 먼저 재인증** 후 다시 시도 |
| 잘 쓰던 PC가 갑자기 조회 실패 (`Token Expired`) | 캐시된 토큰 만료 | `/mcp` → `Authenticate` 로 재인증 |

### 참고

- **경로 자동 적용**: `CLAUDE.md`의 절대경로 예시(`C:\Users\...\mce-packege-v2-main`)는 **작성 당시 PC 기준 예시**일 뿐입니다. Claude Code가 실행 시 **현재 작업 디렉토리(cwd)를 프로젝트 루트로 삼아 모든 경로를 자동 적용**하므로, clone 위치가 달라도 그대로 동작합니다. (별도 설치/치환 스크립트 불필요)
- **로컬 권한 파일**: `.claude/settings.local.json`은 PC마다 다른 **로컬 전용 권한 파일**이라 깃 추적에서 제외돼 있습니다. 새 PC에서는 자동 생성되며, 도구 사용을 승인하면서 권한이 다시 누적됩니다. (공유 권한은 추적되는 `.claude/settings.json`에 있음)
- **옮길 필요 없는 것**: OAuth 토큰(`.credentials.json` — 새 PC에서 `/mcp` 재인증으로 새로 발급), `node_modules`(재설치), `settings.local.json`(자동 재생성)
- **(선택) 웹 챗봇**: `web-bridge`에서 `npm install` + `autostart-install.cmd` 실행, Chrome `chrome://extensions` → 개발자 모드 → `chrome-extension` 폴더 로드 (상세: [web-bridge/README.md](web-bridge/README.md))
- **(선택) Slack 봇**: `slack-bridge/.env`에 토큰 2개(`SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`)를 직접 옮겨야 합니다 — `.env`는 깃에 없음 (상세: 아래 **Slack 연동** 절)

> 엔드포인트 URL을 모른다면 아래 **설치 및 연결** 1단계(Installed Package, Public App)부터 진행해 테넌트 ID·Client ID로 URL을 구성하세요.

---

## 설치 및 연결

### 1단계: Marketing Cloud Installed Package 설정

Marketing Cloud에서 API 연동용 패키지를 생성합니다.

1. Marketing Cloud 로그인 후 **Administration** 이동
2. **Installed Packages** 클릭
3. **New** 버튼으로 새 패키지 생성
4. 패키지 이름 입력 후 **Add Component** 클릭
5. Component 유형: **API Integration** 선택
6. Integration 유형: **Public App** 선택 (⚠️ Server-to-Server 아님 — 아래 참고)
7. Redirect URI: 우선 임시로 `https://salesforce.com` 입력 (10번에서 실제 값으로 교체)
8. 아래 권한(Scope) 설정 후 저장 (AI에게 맡길 작업에 필요한 권한만 부여):

| 카테고리 | 권한 |
|----------|------|
| Email | Read, Write, Send |
| Journeys | Read, Write, Execute |
| List and Subscribers | Read, Write |
| Data Extensions | Read, Write |
| Contacts | Read, Write |
| Automation | Read, Write, Execute |
| SMS | Read, Write, Send |
| Push | Read, Write, Send |

9. 저장 후 패키지 상세(API Integration 컴포넌트)에서 **Client ID(24자)** 확인
10. **Authentication Base URI**(`https://<28자리 테넌트ID>.auth.marketingcloudapis.com`)에서 **테넌트 ID(Subdomain, 28자)** 확인
11. 컴포넌트를 다시 편집해 Redirect URI를 실제 콜백 URL로 교체:
    `https://mai-mce-mcp-cdp1.sfdc-yfeipo.svc.sfdcfc.net/t/<테넌트ID>/c/<클라이언트ID>/api/mcp/oauth/callback`

> MCP 엔드포인트 URL은 위 두 값으로 직접 구성합니다: `https://mai-mce-mcp-cdp1.sfdc-yfeipo.svc.sfdcfc.net/t/<테넌트ID>/c/<클라이언트ID>/api/mcp` (US 스택 기준. EU 스택은 `sfdc-yzvdd4`)
> 인증은 URL 등록 후 `/mcp`에서 뜨는 **사용자 OAuth 로그인**으로 처리됩니다. Client Secret을 로컬에 입력하는 과정은 없습니다.
> ⚠️ **Server-to-Server** 패키지는 REST/SOAP API 직접 호출(client_credentials)용이며, MCP 연결에는 **Public App**만 사용합니다.

---

### 2단계: Claude Code에 MCP 서버 연결

1단계에서 확보한 테넌트 ID·Client ID로 구성한 **원격 MCP 엔드포인트 URL**을 HTTP transport로 등록합니다.

```bash
claude mcp add --transport http sf-mce-mcp "https://mai-mce-mcp-cdp1.sfdc-yfeipo.svc.sfdcfc.net/t/<테넌트ID>/c/<클라이언트ID>/api/mcp"
```

> ⚠️ 이 서버는 **원격 HTTP MCP 서버**이므로 `--transport http`와 URL을 반드시 지정해야 합니다.
> `claude mcp add sf-mce-mcp`처럼 이름만 주면 로컬(stdio) 서버로 처리되어 연결되지 않습니다.

연결 확인:

```
/mcp
```

성공 시 `Authentication successful. Connected to sf-mce-mcp.` 메시지가 표시됩니다.

---

## 통합 캠페인 에이전트 (오케스트레이터 + 서브 에이전트 흐름)

사용자가 만들고 싶은 캠페인을 **간략한 한 문장**(예: "신규 회원을 위한 캠페인 생성")으로 입력하면,
**상위 에이전트(오케스트레이터)**([CLAUDE.md](CLAUDE.md))가 총괄하여 STEP 1~4를 진행해 MCE 캠페인을 완성합니다.
사용자는 상위 에이전트하고만 대화하고, 상위가 각 STEP을 담당 **서브 에이전트**(`mce-topic-agent`/`mce-planning-agent`/`mce-journey-agent`)에게 `Agent` 도구로 위임합니다.
사용자와의 모드 선택·승인은 상위가 하위 호출 사이에서 처리합니다.

```
사용자 입력 → 상위 에이전트(오케스트레이터)
  → [STEP 1] 주제 선정   : mce-topic-agent   — 마스터 DE 프로파일링(분석 가이드 기반) → 캠페인 추천 → (진단이면) 분석 리포트 자동 생성 → (상위가) 사용자 선택
  → [STEP 2] 모드 선택 + 기획 : mce-planning-agent — 수동/자동 선택 → Plan 설계 + xlsx 정의서 생성
  → [STEP 3] Journey 생성 : mce-journey-agent  — 정의서 기반 SFMC Journey 생성 (기본 Draft)
  → [STEP 4] 결과 보고     : 상위가 종합 보고
```

**STEP 1 입력 2갈래** — 사용자가 입력한 문장에 의도 키워드가 있는지로 갈립니다.

| 갈래 | 입력 예 | 출력 |
|------|---------|------|
| **리스트업 (의도 없음)** | "생성 가능한 캠페인 리스트 업", "어떤 캠페인 만들 수 있어?" | **고객 데이터 진단표**(지표·인원·비율·추천 캠페인) + 비율 높은 순 추천 목록 |
| **의도 포함** | "신규회원 캠페인 만들어줘", "장바구니 캠페인" | 해당 신호의 상세 후보 표(복잡도 단순→복합, 2~5개) |

> 리스트업으로 진단 결과를 먼저 본 뒤 특정 캠페인을 지목하면 자동으로 의도 갈래(상세 후보 표)로 전환됩니다.

> 사용자가 정의서(xlsx/CSV/Google Sheets)를 **직접 첨부**한 경우 STEP 1·2를 건너뛰고 STEP 3으로 바로 이동합니다.

#### STEP 1 — 데이터 기반 자율 추천 (분석 가이드 + 프로파일링)

필드 존재만 보는 1차원이 아니라, **AI가 고객 프로파일을 프로파일링**(집계로 분포 파악)해 두드러진 지점을 찾고 **캠페인·기준선을 스스로 도출**합니다. 캠페인 목록·기준선을 문서에 하드코딩하지 않습니다.

- **원천이 다중 테이블이면 자동 통합**: 원천이 `고객·구매마스터·구매상세·제품·쿠폰`처럼 정규화된 여러 엔티티면, AI가 스키마를 읽고 **JOIN·집계로 고객 프로파일 DE를 먼저 빌드**한 뒤 그 위에서 진단합니다(단일 평탄화 DE면 이 단계 생략 — 방법은 [`_common.md`](.claude/skills/mce-campaign/reference/analysis-guide/_common.md) §6-0). ecommerce-default는 현재 다중 엔티티(`RAW_*` 5테이블) → `RECON_Profile` 기반으로 동작하며, 단일 프로파일 대비 **10만 전수 대조 파생값 불일치 0**으로 검증됨.

- **분석 가이드 2층 (MD = 의미 사전)**: 공통 방법([`analysis-guide/_common.md`](.claude/skills/mce-campaign/reference/analysis-guide/_common.md)) + 고객사 값([`analysis-guide/ecommerce-default.md`](.claude/skills/mce-campaign/reference/analysis-guide/ecommerce-default.md): §1 스키마 · §2 의미규칙(세금/포인트/동의) · §6 기획 · §7 전이 BU값). **AI는 §1·§2만 읽고** 어떤 세그먼트를 잴지, 어떤 캠페인을 추천할지, 기준선을 얼마로 볼지 **데이터를 보고 정합니다.** (§3·§4는 예시일 뿐)
- **AI가 집계 쿼리 자동 생성**: 진단에 필요한 `SEG_*` 카운트 DE·SQL·Automation이 없으면 AI가 분석 가이드 정의로부터 **직접 만들어** 적재합니다(부하 방지 위해 raw는 안 읽고 `rowCount`만 읽음). 다중 테이블 원천이면 **프로파일 빌드(JOIN 집계)까지 포함**합니다. 낡으면(automation 멈춤·마스터 변경) **자동 재집계**합니다.
- **출력**: 지표·인원·비율·추천 캠페인(비율 높은 순). 고정 임계값을 쓰면 "이 기준으로 가정함"을 밝힙니다.
- **📄 분석 리포트 자동 생성 (D1)**: 리스트업/진단 직후, 진단 결과를 **문서형 HTML 리포트**로 자동 생성·게시하고 링크를 제시합니다(공통 틀 [`report-guide.md`](.claude/skills/mce-campaign/reference/report-guide.md) + `report-template.html`, 값은 고객사 진단·분석 가이드 기준).
- **발송(진입) DE는 캠페인 선택 후 생성** — 세그먼트 조건 + 채널 동의 필터(이메일 `email_consent`, SMS/알림톡 `sms_consent`)를 적용. 실제 발송 인원 = 세그먼트 ∩ 동의(진단 인원보다 작음).

```
고객 데이터 분석 (모수 N명)
지표                 | 인원   | 비율 | 추천 캠페인
1회성 구매자          | 6,400 | 64% | 2차 구매 유도
휴면 (로그인 90일+)   | 3,500 | 35% | 휴면 고객 재활성화
이탈위험 (주문 90일+) | 2,528 | 32% | 이탈 고객 재구매 유도
```

> ⚠️ 진단은 sf-mce의 **`rowCount`(메타) 읽기**로만 한다 — sf-mce엔 DE 행 값 일괄읽기 도구가 없다(단건 PK 조회는 SQL/import 행을 404). 그래서 "세그먼트 인원 = 카운트 DE 행 수"로 인코딩해 rowCount를 읽는다. 즉석 집계(추천 때마다 SQL 실행)는 매번 1~2분 대기·비동기 0 오판으로 불안정해 쓰지 않고, 새벽 사전 집계분을 읽는다.

**실행 모드 (STEP 2부터 적용)**
- **수동(Manual)**: Plan 구성을 사용자와 대화로 합의한 뒤 정의서/Journey 생성, 생성 전 승인.
- **자동(Auto)**: 대화 없이 Plan 기획 → 정의서 → Journey 생성까지 일괄 진행.

**동작 원칙**
- **결과만 전달**: 진행 과정·중간 작업 설명을 출력하지 않고, 단계 전환 질문·최종 결과·오류만 사용자에게 노출합니다. **자동 모드에서도 동일**하며, STEP 1~4를 무발화로 일괄 실행한 뒤 마지막 실행 결과만 보여줍니다.
- **오류 자기 학습**: 캠페인 생성 중 오류가 발생해 수정/우회하면, 그 원인·해결책을 `.claude/skills/mce-campaign/reference/error-log.md`의 오류 학습 표에 즉시 추가하여 다음 캠페인 생성 시 같은 오류를 반복하지 않습니다.

**공통 기능:**
- 고객 데이터(`Customer_Profile`) **값 진단** 기반 캠페인 추천 (3차원 — 위 STEP 1 참고)
- CSV/XLSX/Google Sheets 정의서 파싱 및 MCE 컴포넌트 자동 생성
- Journey Builder 다단계 플로우(Decision/Engagement Split, Wait, Email) 구성
- Event Definition + Automation 스케줄(Recurring/On Activation) 설정
- 한국어 정의서 완전 지원

---

## 사전 준비 — 의존성 설치

정의서(xlsx) 생성 스크립트(`generate_campaign_definition.js`)는 `exceljs` 패키지를 사용합니다.
최초 1회 프로젝트 루트에서 설치합니다.

```bash
npm install
# 또는 개별 설치
npm install exceljs
```

> ⚠️ 미설치 시 정의서 생성 단계에서 `Error: Cannot find module 'exceljs'` 오류가 발생합니다.

---

## 사용 예시

### 통합 캠페인 에이전트 (권장)

캠페인 의도를 **한 문장**으로 입력하면 상위 에이전트(오케스트레이터)가 STEP별 서브 에이전트(topic/planning/journey)에 위임해 STEP 1~4를 수행합니다.
(주제 선정 → 후보 추천 → 모드 선택 → 정의서 생성 → Journey 생성 → 결과 보고)

```
생성 가능한 캠페인 리스트 업           # 의도 없음 → 고객 데이터 진단 → 추천 캠페인 목록
신규 회원을 위한 캠페인 생성          # 의도 포함 → 캠페인 상세 후보 표
생일 고객을 위한 캠페인 만들어줘       # 후보 선택 → 모드(수동/자동) → 정의서 + Journey
이탈 고객 캠페인 자동으로 만들어줘     # 자동 모드: STEP 1~4 무발화 일괄 생성
```

정의서(xlsx/CSV/Google Sheets)를 직접 첨부하면 STEP 1·2를 건너뛰고 Journey 생성으로 바로 진입합니다.

```
campaign_definitions/CP_019_생일쿠폰_열람분기Journey_20260610.xlsx 로 저니 생성해줘
CP_019 정의서로 Journey 만들어줘        # 캠페인 ID만으로 폴더 검색 후 생성
방금 만든 정의서로 저니 생성해줘         # 최신 xlsx 자동 선택
```

### 개별 도구 직접 호출

에이전트 흐름을 거치지 않고 `sfmc_*` 도구를 단건으로 활용할 수도 있습니다.

```
# Journey 생성
welcome Journey를 만들어줘.
- 진입 트리거: DE Key = 1sgHo00000001MNIAY_85RHo00000000ZMMAY_I
- 액티비티: 이메일 → Wait 2일 → Engagement Split (오픈 여부)
- 재진입: 불가

# Data Extension 조회
최근 생성된 Data Extension 1개만 찾아줘

# Journey 수정
welcome Journey의 Wait를 1일로 수정해줘

# SQL Query 실행
All_Customer DE에서 오늘 가입한 회원만 조회하는 SQL Query를 실행해줘
```

---

## Journey 생성 워크플로우

`sfmc_create_journey_builder_journey` 도구는 5단계 워크플로우를 따릅니다:

```
Step 1: Journey 이름 설정
Step 2: 진입 방식 + 재진입 설정 (API Event / Data Extension)
Step 3: 채널 + 에셋 결정 (Email / SMS / 기존 사용 여부)
Step 4: 에셋 준비 (Event Definition, 트리거, 액티비티 JSON 생성)
Step 5: Journey 최종 생성
```

### Engagement Split 주의사항

Engagement Split(오픈/클릭 기반)은 **반드시 선행 Email 액티비티가 필요**합니다.

```
올바른 플로우: 이메일 액티비티 → Wait → Engagement Split
잘못된 플로우: Wait → Engagement Split (동작하지 않음)
```

### 재진입(entryMode) 주의사항

`sfmc_create_journey_builder_journey`에 full `body_json`을 넘기면 `entry_mode` 파라미터가 무시되어 `entryMode`가 `NotSet`으로 생성됩니다.

```
권장: body_json 최상위에 "entryMode" 직접 명시
  - No re-entry                 → "OnceAndDone"
  - Re-entry anytime            → "MultipleEntries"
  - Re-entry only after exiting → "SingleEntryAcrossAllVersions"
보정: NotSet으로 생성된 경우 sfmc_update_journey로 entryMode만 교정 PUT
```

---

## 커스텀 액티비티(알림톡/문자/카카오/SMS) — micrm 콘텐츠 연동

이메일 대신 **알림톡/문자/카카오/SMS**로 발송하는 저니는, SFMC 기본 이메일 액티비티가 아니라 BU에 설치된 **micrm REST 커스텀 액티비티**로 처리합니다. **저니 배치는 MCP, 발송 콘텐츠(seq)는 micrm 템플릿을 참조**하는 구조입니다. (페이로드 상세 규격 SSOT: [`.claude/skills/mce-campaign/reference/journey-build.md`](.claude/skills/mce-campaign/reference/journey-build.md) ④)

> ⚠️ 비밀값(Client Secret / JWT Signing Secret / CSRF / JSESSIONID)은 이 문서에 기록하지 않습니다.

### 3-에이전트 흐름에서의 위치

메시지 채널이 알림톡/문자/카카오/SMS면 **오케스트레이터가 STEP 2 위임 전에 "채널 해소(seq 확보)" 단계**를 수행합니다. micrm 카탈로그 조회엔 웹세션(브라우저)이 필요해 격리 워커는 못 하기 때문입니다.

```
STEP1 topic-agent  →  캠페인 후보
   │
   ★채널 해소 (오케스트레이터, 브라우저)        ← 알림톡/문자일 때만
   │   ① BU 알림톡 저니에서 applicationExtensionKey·send_key 확인
   │   ② send_key로 mobileList(모바일 컨텐츠) 목록 조회 → 클라이언트 이름 필터(서버검색 X)
   │   ③ seq 선택 (모바일 컨텐츠 seq. 자동=이름매칭+임계치 / 수동=후보제시)
   │   ④ 템플릿 변수 #{…} → 진입 DE 컬럼 매핑
   ▼
STEP2 planning-agent → 정의서에 seq·키·변수매핑 기록   (micrm 접근 X)
   ▼
STEP3 journey-agent  → 정의서 값으로 REST 액티비티 생성  (micrm 접근 X)
```

→ 정의서가 self-contained해져 STEP 3는 micrm 재접근 없이 재현 가능. 워커는 값을 **소비만** 하며, 비어 있으면 임의 생성하지 않고 상위에 반환합니다.

### 사용법 (요약)

1. **현재 BU 확인** — MCP 연결 BU 조회. 알림톡 커스텀 액티비티가 그 BU에 설치돼 있어야 동작.
2. **키·채널 확보** — 그 BU 기존 알림톡 저니를 `sfmc_get_journey`로 읽어 ① `configurationArguments.applicationExtensionKey` ② 발신 프로필 `send_key`(JB 액티비티 열기 → `@채널명(send_key)`) 확인.
3. **seq 고르기** — 위 `send_key`로 **`mobileList.ajax`(모바일 컨텐츠 목록)** 조회(브라우저) → 목록이 200건+이고 서버검색이 안 먹으니 **클라이언트에서 이름 필터** 후 캠페인 의도에 맞는 **모바일 컨텐츠 seq**(예 <seq>) 선택(자동=이름매칭+임계치, 수동=후보제시). (⚠️ `atTmplLst`의 알림톡 템플릿 id가 아님)
4. **저니 생성** — `body_json`에 REST 액티비티 추가: `inArguments`에 `seq`(문자열)+DE 필드 바인딩, `configurationArguments.applicationExtensionKey`=그 BU 키.
5. **확인** — Draft로 두고 JB UI에서 템플릿 정상 로드 확인 → 필요 시 발행.

### ⚠️ 유의점 (자주 막히는 곳)

- **`applicationExtensionKey`는 BU마다 다름** → 하드코딩 금지, 매번 현재 BU에서 확인.
- **`seq`는 "연결 채널"의 모바일 컨텐츠여야 함** → 다른 채널이거나 알림톡 템플릿 id(tmpl_seq)를 넣으면 JB UI에서 **"사용할 수 없는 콘텐츠"**.
- **`seq` 누락 = 빈 껍데기 액티비티** (콘텐츠가 안 채워짐).
- **`seq`는 문자열**로 넣음(예 `"<seq>"`). `§extention_cnt§`는 콘텐츠마다 다름(실측 `0`도 정상).
- **카탈로그 조회는 micrm 웹세션 필요** → 워커가 아니라 **오케스트레이터가 브라우저로** 확정해 전달.
- 별도 `ContactExit` 액티비티 불필요(마지막 액티비티 뒤 JB가 자동 종료).

### 정의서 ↔ REST 액티비티 매핑

정의서 `저니 구조` 탭의 알림톡 행이 REST 커스텀 액티비티로 들어가는 대응:

| 정의서 컬럼 | 값(예) | REST 매핑 |
|---|---|---|
| 컴포넌트 유형 | `Message (알림톡/문자/카카오/SMS)` | `type: "REST"` |
| 연결 콘텐츠 ID (… 알림톡 seq) | `<seq>` (모바일 컨텐츠 seq) | `arguments.execute.inArguments[].seq`(문자열) |
| applicationExtensionKey (알림톡/문자) | `<appExtKey>` | `configurationArguments.applicationExtensionKey` |
| 변수 매핑 (#{변수}→DE컬럼) | `FirstName→FirstName; phone→Phone` | `inArguments`의 각 키 = `{{Event.<EventDefKey>.<DE컬럼>}}` |

> 진입 DE GUID는 `§data_extension_id§`에 넣음. micrm 엔드포인트: `https://sales.micrm.co.kr/sf/06/` 하위 `execute / save / validate / publish / stop / unpublish / testSave .service`.

### 목록 조회 API — 두 종류 구분이 핵심

micrm엔 두 목록이 있고, **저니 seq는 "모바일 컨텐츠"에서 온다.** (알림톡 템플릿이 아님)

| 목록 | API | id(=화면 표기) | 저니 seq? |
|---|---|---|---|
| **모바일 컨텐츠** (템플릿+캠페인/수신정보 포장한 발송 단위) | **`POST /sf/06/mobileList.ajax`** | `<input name="list" value="<seq>">` | ✅ **이 seq를 `inArguments.seq`에 넣음** |
| 알림톡 템플릿 (카카오 승인 양식) | `POST /sf/06/kko/atTmplLst.ajax` | `<input name="tmpl_seq" value="1778">` | ❌ (모바일 컨텐츠 만들 때 안에 넣는 재료) |

- 공통 인증: **micrm 웹세션**(세션 쿠키 + 헤더 `X-CSRF-TOKEN` + `X-Requested-With: XMLHttpRequest` + 폼 `_csrf`), SFMC JWT 아님.
- 공통 폼 파라미터: `send_key`(채널 키) · `pageNo` · `_csrf` (atTmplLst는 `kep_status=O`(승인) 추가).
- 비유: 알림톡 템플릿=레시피, 모바일 컨텐츠=그 레시피로 포장 끝낸 도시락. 저니엔 **도시락 번호(모바일 컨텐츠 seq)** 를 넣는다.
- 🔧 **두 목록을 한 번에 불러오는 검증된 재사용 스니펫**(Claude in Chrome `javascript_tool`용)은 [`micrm-catalog.md`](.claude/skills/mce-campaign/reference/micrm-catalog.md) 가 SSOT다. `https://sales.micrm.co.kr/*` 로그인 탭에서 실행 → `{ mobile:[{seq,name}], tmpl:[{tmpl_seq,name}] }` 반환.
- 📏 **페이지당 4건 고정, seq 내림차순(최신 먼저)**, `pageNo`로 순회. 모바일 컨텐츠는 **현재 BU 200건+**(알림톡 템플릿은 11건).
- 🔎 **서버 검색이 안 먹는다 (2026-06-25 확인)** — `searchValue`를 보내도 무시하고 최신순 전체만 반환. **이름 필터는 클라이언트 측**에서 한다(스니펫의 `KEYWORD`). 기본은 최신 N페이지만, 못 찾으면 전수 순회.
- 🤖 **seq 선택** — 수동=의도 키워드로 필터한 후보를 제시해 사용자가 선택 / 자동=**이름매칭+확신 임계치(전략 A)**, 확신 낮으면 임의선택 금지하고 그 1건만 사용자에게 질문. 상세 [`micrm-catalog.md`](.claude/skills/mce-campaign/reference/micrm-catalog.md) "자동 모드 seq 선택 전략".

#### ⛔ 알림톡 템플릿(tmpl_seq)을 저니에 직접 넣으면 안 된다 (테스트로 확정)

- **검증(2026-06-25):** 같은 밀버스 채널의 알림톡 템플릿 `tmpl_seq=1778`을 저니 `inArguments.seq`에 직접 넣어 생성 → JB UI에서 **"사용할 수 없는 콘텐츠"**. 채널을 고정했는데도 실패 = **"채널 문제가 아니라 템플릿이라서" 불가**가 증명됨.
- **이유:** micrm은 `seq`를 **모바일 컨텐츠 id로 해석**한다. 템플릿은 문구·이미지·버튼 *양식*일 뿐, 발송에 필요한 컨텍스트(발신 채널·캠페인명·수신정보·포맷)가 없다. 그래서 템플릿 번호를 모바일 컨텐츠 자리에 넣으면 해당 발송 콘텐츠를 못 찾아 실패한다. (레시피 번호를 "주문번호" 칸에 적은 격)
- **그래서 템플릿을 쓰려면 — 먼저 "모바일 컨텐츠"로 감싼다:**
  1. micrm > 모바일 > **모바일 컨텐츠 생성**
  2. 컨텐츠 포맷 = **카카오톡**
  3. **템플릿 선택** = 원하는 알림톡 템플릿
  4. 캠페인명·수신정보 입력 → 저장 → 새 **모바일 컨텐츠 seq(5xxx)** 발급
  5. 그 모바일 컨텐츠 seq를 저니 `inArguments.seq`에 넣는다
- 모바일 컨텐츠도 **커스텀 액티비티가 연결된 채널(밀버스)** 것이어야 한다(다른 채널 = 또 "사용할 수 없는 콘텐츠").

### 참고 — 현재 연결 BU 값 (⚠️ BU마다 다름)

| 항목 | 현재 BU(`<테넌트 서브도메인>`, 2026-06-24) | 확인 방법 |
|---|---|---|
| applicationExtensionKey | `<appExtKey>` | 알림톡 저니 REST 액티비티의 `configurationArguments` |
| 연결 채널 / send_key | 밀버스 / `bec993a052e5a19c9e9bcbb32412b19341be2449` | JB 커스텀 액티비티 → 발신 프로필 |

> 값 `<다른 BU 값>`은 다른 BU 값입니다. 새 BU에서는 위 "확인 방법"으로 다시 얻으세요(하드코딩 금지).

---

## 제공 도구 목록

### Data Extension (DE)

| 도구 | 설명 |
|------|------|
| `sfmc_get_data_extensions` | DE 목록 검색 조회 |
| `sfmc_get_data_extension` | 단일 DE 상세 조회 |
| `sfmc_get_data_extension_fields` | DE 필드 목록 조회 |
| `sfmc_get_data_extension_folders` | DE 폴더 목록 조회 |
| `sfmc_get_data_extensions_by_category` | 카테고리별 DE 조회 |
| `sfmc_get_data_extension_link` | DE 링크 조회 |
| `sfmc_create_data_extension` | DE 생성 |
| `sfmc_create_data_extension_field_async` | DE 필드 추가 (비동기) |
| `sfmc_update_data_extension` | DE 수정 |
| `sfmc_update_data_extension_field_async` | DE 필드 수정 (비동기) |
| `sfmc_delete_data_extension` | DE 삭제 |
| `sfmc_clear_data_extension_data` | DE 데이터 전체 초기화 |
| `sfmc_retrieve_data_extension_record` | DE 레코드 조회 |
| `sfmc_upsert_data_extension_record` | DE 레코드 삽입/수정 |
| `sfmc_data_extension_trigger` | DE Entry 트리거 JSON 생성 |

### Journey Builder

| 도구 | 설명 |
|------|------|
| `sfmc_get_journeys` | Journey 목록 조회 |
| `sfmc_get_journey` | 단일 Journey 상세 조회 (ASCII 플로우 시각화 포함) |
| `sfmc_get_journey_versions` | Journey 버전 목록 조회 |
| `sfmc_get_journey_link` | Journey UI 링크 조회 |
| `sfmc_get_journey_publish_status` | Journey 발행 상태 조회 |
| `sfmc_create_journey` | Journey 생성 (기본) |
| `sfmc_create_journey_builder_journey` | Journey 생성 (워크플로우 가이드 포함) |
| `sfmc_update_journey` | Journey 수정 |
| `sfmc_publish_journey` | Journey 발행 |
| `sfmc_pause_journey` | Journey 일시정지 |
| `sfmc_resume_journey` | Journey 재개 |
| `sfmc_stop_journey` | Journey 중지 |
| `sfmc_delete_journey` | Journey 삭제 |
| `sfmc_republish_journey_content` | Journey 콘텐츠 재발행 |
| `sfmc_fire_journey_event` | Journey API 이벤트 발동 |
| `sfmc_insert_contacts_into_journey_async` | Journey 연락처 일괄 삽입 (비동기) |
| `sfmc_insert_contacts_into_journey_status` | 연락처 삽입 상태 확인 |
| `sfmc_exit_contact_from_journey` | Journey에서 연락처 제거 |
| `sfmc_exit_contact_from_journey_status` | 연락처 제거 상태 확인 |

### Journey 액티비티 빌더

| 도구 | 설명 |
|------|------|
| `sfmc_email_activity` | Email 액티비티 JSON 생성 |
| `sfmc_sms_activity` | SMS 액티비티 JSON 생성 |
| `sfmc_wait_activity` | Wait 액티비티 JSON 생성 |
| `sfmc_decision_split_activity` | Decision Split JSON 생성 |
| `sfmc_random_split_activity` | Random Split JSON 생성 |
| `sfmc_engagement_decision_activity` | Engagement Decision Split JSON 생성 (이메일 오픈/클릭 기반) |
| `sfmc_einstein_sto_activity` | Einstein STO(최적 발송 시간) 액티비티 JSON 생성 |
| `sfmc_einstein_engagement_frequency_activity` | Einstein Engagement Frequency Split JSON 생성 |

### Event Definition

| 도구 | 설명 |
|------|------|
| `sfmc_get_event_definitions` | Event Definition 목록 조회 |
| `sfmc_get_event_definition` | 단일 Event Definition 조회 |
| `sfmc_create_event_definition` | Event Definition 생성 (APIEvent / EmailAudience) |
| `sfmc_update_event_definition` | Event Definition 수정 |
| `sfmc_delete_event_definition` | Event Definition 삭제 |
| `sfmc_api_event_trigger` | API Event 트리거 JSON 생성 |

### Email

| 도구 | 설명 |
|------|------|
| `sfmc_create_email` | 이메일 생성 |
| `sfmc_create_email_template` | 이메일 템플릿 생성 |
| `sfmc_create_email_send_definition` | 이메일 발송 정의 생성 |
| `sfmc_send_transactional_email` | 트랜잭셔널 이메일 발송 |
| `sfmc_refresh_transactional_email` | 트랜잭셔널 이메일 갱신 |
| `sfmc_get_transactional_send_status` | 트랜잭셔널 발송 상태 조회 |
| `sfmc_create_triggered_send_definition` | Triggered Send 정의 생성 |
| `sfmc_republish_triggered_send` | Triggered Send 재발행 |
| `sfmc_get_triggered_send_summary` | Triggered Send 요약 조회 |
| `sfmc_get_email_subscription_status` | 이메일 구독 상태 조회 |
| `sfmc_get_send_classifications` | 발송 분류(Send Classification) 조회 |
| `sfmc_get_sender_profiles` | 발신자 프로필 조회 |

### SMS

| 도구 | 설명 |
|------|------|
| `sfmc_create_sms` | SMS 콘텐츠 에셋 생성 |
| `sfmc_create_sms_definition` | SMS 발송 정의 생성 |
| `sfmc_create_sms_send_definition` | SMS Send Definition 생성 |
| `sfmc_get_sms_definition` | SMS 정의 단건 조회 |
| `sfmc_get_sms_definitions` | SMS 정의 목록 조회 |
| `sfmc_send_outbound_sms_message` | 아웃바운드 SMS 즉시 발송 |
| `sfmc_get_sms_subscription_status` | SMS 구독 상태 조회 |
| `sfmc_get_mobileconnect_codes` | MobileConnect 코드 조회 |
| `sfmc_create_mobileconnect_keyword` | MobileConnect 키워드 생성 |

### Content Builder

| 도구 | 설명 |
|------|------|
| `sfmc_get_content_assets` | 콘텐츠 에셋 목록 조회 |
| `sfmc_get_content_builder_asset` | 콘텐츠 에셋 단건 조회 |
| `sfmc_create_content_builder_asset` | 콘텐츠 에셋 생성 |
| `sfmc_update_content_builder_asset` | 콘텐츠 에셋 수정 |
| `sfmc_search_content_builder_assets` | 콘텐츠 에셋 검색 |
| `sfmc_get_content_categories` | 콘텐츠 카테고리 조회 |

### Automation Studio

| 도구 | 설명 |
|------|------|
| `sfmc_get_automations` | Automation 목록 조회 |
| `sfmc_get_automation` | Automation 단건 조회 |
| `sfmc_get_automation_instance` | Automation 실행 인스턴스 조회 |
| `sfmc_get_automation_categories` | Automation 카테고리 조회 |
| `sfmc_create_automation` | Automation 생성 |
| `sfmc_update_automation` | Automation 수정 |
| `sfmc_run_automation` | Automation 즉시 실행 |
| `sfmc_run_automation_activities` | Automation 특정 액티비티 실행 |

### SQL Query (Automation Studio)

| 도구 | 설명 |
|------|------|
| `sfmc_create_sql_query` | SQL Query 액티비티 생성 |
| `sfmc_get_sql_query` | SQL Query 단건 조회 |
| `sfmc_get_sql_queries` | SQL Query 목록 조회 |
| `sfmc_update_sql_query` | SQL Query 수정 |
| `sfmc_run_sql_query` | SQL Query 즉시 실행 |
| `sfmc_validate_sql_query` | SQL Query 유효성 검사 |

### 연락처 및 구독자

| 도구 | 설명 |
|------|------|
| `sfmc_get_contact_key_by_email_address` | 이메일 주소로 Contact Key 조회 |
| `sfmc_retrieve_contact_status` | 연락처 상태 조회 |
| `sfmc_update_contact_attributes` | 연락처 속성 수정 |
| `sfmc_search_attributes` | 연락처 속성 검색 |
| `sfmc_get_list_subscribers` | 구독 목록의 구독자 조회 |
| `sfmc_get_lists` | 구독 목록 조회 |

### Push 알림

| 도구 | 설명 |
|------|------|
| `sfmc_send_push_notification` | 푸시 알림 발송 |
| `sfmc_get_push_opt_in_status_by_subscriber_key` | Subscriber Key로 푸시 수신 동의 상태 조회 |

### 기타 유틸리티

| 도구 | 설명 |
|------|------|
| `sfmc_get_timezones` | 사용 가능한 타임존 목록 조회 |
| `sfmc_describe_object` | SFMC 오브젝트 스키마 조회 (SOAP API) |

---

## 관련 파일

```
<프로젝트 루트>/
├── README.md                          # 이 파일
├── CLAUDE.md                          # 오케스트레이터 정의 (총괄 + STEP 1~3 서브 에이전트 위임)
├── generate_campaign_definition.js    # xlsx 정의서 생성 스크립트 (exceljs 의존)
├── package.json                       # 의존성 (exceljs 등)
├── campaign_definitions/              # 생성된 정의서 보관
├── docs/                              # 도입안내 · 구축 체크리스트 · 온보딩킷 · 스키마 샘플
├── reports/                           # 생성된 분석 리포트 산출물 (html — gitignore, 템플릿은 reference/)
├── web-bridge/                        # Chrome 확장 ↔ Claude Code(CLI) 브릿지 API 서버 + 성과 대시보드
├── chrome-extension/                  # 챗봇 UI (Chrome 확장 — 압축해제 로드)
└── .claude/
    ├── settings.json                  # MCP 권한 설정
    ├── journey_history.md             # 저니 생성 이력 누적 기록
    ├── agents/                        # 서브 에이전트 (현재 활성 — 상위가 Agent 도구로 호출)
    │   ├── mce-topic-agent.md         # STEP 1 주제 선정 서브 에이전트
    │   ├── mce-planning-agent.md      # STEP 2 기획 / 정의서 생성 서브 에이전트
    │   └── mce-journey-agent.md       # STEP 3 Journey 생성 서브 에이전트
    ├── skills/
    │   └── mce-campaign/              # 캠페인 생성 스킬 (STEP 1~4)
    │       └── reference/             #   분석 가이드·저니 페이로드·리포트 가이드 등 SSOT
    │           ├── analysis-guide/          #     _common.md(공통 방법) + ecommerce-default.md(고객사 값)
    │           ├── report-guide.md    #     분석 리포트(D1) 품질 기준
    │           ├── report-template.html #   리포트 재사용 템플릿(디자인·구조)
    │           ├── journey-build.md · email-standard.md · fixed-values.md · error-log.md · micrm-catalog.md
    │           └── de-and-folders.md  #     분석 가이드 진입점(요약)
```

---

## 참고

- Salesforce Marketing Cloud REST API: `https://<subdomain>.rest.marketingcloudapis.com`
- Salesforce Marketing Cloud SOAP API: `https://<subdomain>.soap.marketingcloudapis.com`
- Journey Builder API Version: `1.0`
