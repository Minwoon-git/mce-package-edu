# MCE 웹 브릿지 (web-bridge)

Chrome 확장(`chrome-extension/`) ↔ 로컬 Claude Code(CLI) 브릿지 **API 서버**.
이 repo의 스킬(`mce-campaign`·`mce-onboarding`·`mce-base-setup`)·워커·SFMC MCP를 그대로 사용.
(자체 웹 채팅 페이지는 제거됨 — UI는 Chrome 확장이 담당)

## 구조

```
Chrome 확장 (MCE 화면 위 챗봇 팝업)
   │  POST /api/chat  (SSE 스트리밍 응답)
   ▼
server.js (Express, localhost:3456)
   │  claude -p --output-format stream-json --resume <세션>
   ▼
Claude Code CLI (cwd = 프로젝트 루트 → CLAUDE.md·스킬·에이전트·sf-mce-mcp 적용)
```

## 실행

- 사전 조건: 이 PC에 `claude` CLI 설치 + SFMC MCP(`sf-mce-mcp`) 인증 완료 상태
- 최초 1회: `cd web-bridge && npm install`
- 실행 방법 3가지:
  - **`autostart-install.cmd` 더블클릭 (권장)** — Windows 로그온 시 자동 시작 + 창 없이 백그라운드 실행. 1회만 실행하면 이후 재부팅해도 알아서 뜸. 해제는 `autostart-remove.cmd`
  - `run-web-hidden.vbs` 더블클릭 — 이번만 창 없이 백그라운드 실행 (자동 시작 등록 없음)
  - `run-web.cmd` 더블클릭 — 콘솔 창을 띄워 로그를 보며 실행 (창을 닫으면 서버 종료)
- 어느 방식이든 크래시 시 5초 후 자동 재시작. **완전 종료는 `stop-web.cmd`** (재시작 루프+서버를 함께 종료)
- 포트 변경: 환경변수 `PORT` 지정 (변경 시 `chrome-extension/background.js`·`content.js`(FILE_BASE)·`manifest.json`의 주소도 함께 수정)

## 계정 게이트 (챗봇 버튼 노출 제한)

- `config.example.json`을 `config.json`으로 복사 → `allowedAccounts`에 MCE 상단 헤더에 표시되는 계정명(BU 이름) 기입
- 확장이 시작 시 `GET /api/config`로 이 목록을 받아, **계정명이 상단 헤더 가시 영역에 보이는 MCE에서만** 🤖 버튼을 노출
- 파일이 없거나 목록이 비어 있으면 게이트 없이 모든 MCE 화면에서 노출
- **서버가 꺼져 있으면 확장이 버튼을 아예 숨김**(fail-closed) — 모든 BU에 버튼이 뜬다면 서버 다운 여부부터 확인
- `config.json`은 테넌트별 값이므로 git 추적 제외 (.gitignore 등록됨)
- 수정 후 서버 재시작 필요

## API

- `POST /api/chat` — `{ message, sessionId?, chatId? }` → SSE 스트림
  - 이벤트: `session`(세션 ID) · `tool`(도구 실행) · `text`(중간 안내) · `result`(최종 답변+비용) · `error` · `done`
  - `sessionId`를 주면 `--resume`으로 대화 맥락을 이어간다
- `POST /api/stop` — `{ chatId }` → 실행 중인 요청 프로세스 종료 (Windows에서는 `taskkill /T /F`로 프로세스 트리 전체 종료). 중단된 요청은 `result` 이벤트로 "⏹ 요청을 중단했습니다."를 내려보냄
- `GET /api/mcp-status` — SFMC MCP 인증 상태 `{ needsAuth }`. `claude mcp get`으로 확정 판정(60초 캐시, 모델 호출 없음). 확장이 패널을 열 때 상단 인증 배너 표시용으로 호출
- `POST /api/mcp-login` — **SFMC MCP 재인증**. `claude mcp login sf-mce-mcp`를 실행해 이 PC 기본 브라우저에 OAuth 로그인 창을 연다. 챗봇 답변에서 SFMC 세션 만료("session is invalid / access revoked")가 감지되면 확장이 말풍선에 "🔐 SFMC 인증" 버튼을 자동 표시하고, 그 버튼이 이 엔드포인트를 호출한다. 완료 후 다음 요청부터 적용(브릿지 재시작 불필요), 진행 중 중복 호출은 거부, 3분 미완료 시 자동 정리
- `GET /api/result?chatId=` — `{ result: { text, sessionId, cost, ts } | null, running }` — 스트림 도중 연결이 끊긴 클라이언트가 결과를 회수(폴링)하는 용도. 결과는 1시간 보관. 확장은 포트가 결과 없이 끊기면 자동으로 이 엔드포인트를 폴링해 답변을 이어받음
- `GET /dashboard` — **캠페인 성과 대시보드** (정적 HTML, 챗봇 헤더 📊 버튼으로 열림). KPI 타일(전기간 대비)·일별 발송량·오픈/클릭률 추이·저니별 성과(막대+표)·인사이트/다음 캠페인 제안 카드, 기간 필터(7/14/30일 + 날짜 직접 지정), 다크모드 토글, 인쇄(Ctrl+P) 최적화. 고객사별 테마: 데이터 JSON의 `theme` 객체가 CSS 변수를 덮어씀
- `POST /api/journey-xlsx` — 저니별 성과를 **서식 입힌 엑셀(xlsx)** 로 생성 (대시보드 "⬇ 엑셀" 버튼). 타이틀·헤더 색·퍼센트 서식·줄무늬·합계행·자동필터·고정 헤더 포함 (exceljs)
- `GET /api/dashboard-data` — 대시보드 데이터 JSON. `reports\dashboard-data.json`(실데이터 — 봇/배치가 SENDLOG 집계로 생성)이 있으면 그걸, 없으면 `dashboard\sample-data.json`(샘플, ⚠ 배지 표시)을 서빙

### 🔜 [미적용] 대시보드 데이터 자동 갱신 — 설계 메모 (추후 적용)

> 현재 데이터 흐름: `SENDLOG_History` DE는 SFMC Automation(`AUTO_SendLog_Daily`, 매일 02:00)이 자동 갱신하지만,
> 대시보드가 실제로 읽는 `reports\dashboard-data.json`은 **수동 생성** 상태다 — DE가 갱신돼도 대시보드 숫자는 멈춰 있다.
> (2026-08-14 확정: "열 때 자동 갱신" 방식으로 추후 구현하기로 함. 아직 코드 반영 안 됨.)

구현 방식 (server.js `/api/dashboard-data`에 로직 추가):

1. 요청이 오면 `reports\dashboard-data.json`의 수정 시각을 확인
2. **24시간 이내면** 그대로 서빙 (현재와 동일)
3. **24시간 경과(또는 파일 없음)면** 기존 파일을 즉시 서빙하되, 백그라운드로 갱신을 1회 트리거:
   - `claude -p "SENDLOG_History DE를 일별·저니별로 집계해 reports\dashboard-data.json을 갱신해줘"` 헤드리스 실행 (기존 `/api/chat`과 같은 spawn 패턴, `--dangerously-skip-permissions`)
   - JSON 포맷은 기존 파일과 동일 유지: `{ generatedAt, source: "sendlog_history", daily[], journeys[], insights[] }`
     (journeys[] 항목에 `id`(JourneyID)·`version`을 포함하면 챗봇 대시보드에서 저니 이름이 Journey Builder 링크가 됨 — 선택 필드, 없으면 일반 텍스트)
   - **중복 실행 잠금** 필수: 갱신 실행 중 플래그를 두고, 진행 중이면 재트리거하지 않음 (동시에 여러 탭이 열려도 1회만)
4. 갱신 완료 후의 요청부터 새 숫자가 보임 (화면에는 "갱신 N시간 전" 표시로 상태 확인 가능)

특성: 별도 스케줄 불필요, 보는 날에만 하루 최대 1회 Claude 실행(좌석 사용량 소량), PC 꺼짐 영향 없음.
주의: SFMC 배치(02:00, 계정 표준시) 직전에 열면 "어제까지" 데이터로 갱신될 수 있음 — 정상 동작.
- `POST /api/upload?name=` — 파일 첨부(드래그&드롭) 업로드. raw body로 받은 파일을 저장하고 `{ path, name }` 반환. 정의서(xlsx/xlsm/csv)는 `campaign_definitions\`, 그 외 허용 확장자(txt/sql/md/json/jpg/jpeg/png)는 `uploads\`에 저장. 동명 파일은 타임스탬프를 붙여 보존, 그 외 확장자는 403, 최대 25MB
- `GET /api/file?path=` — 캠페인 산출물 다운로드. 확장이 답변 속 산출물 경로(정의서 xlsx·분석 리포트 등)를 이 링크(📎 칩)로 바꿔 말풍선에서 바로 내려받게 함. **허용 범위: `campaign_definitions\`·`reports\` 폴더 안의 xlsx·xlsm·csv·pptx·pdf·png·md·html만** — 그 외 경로/확장자는 403 (경로 조작 방지)

## 유의 사항

- `--dangerously-skip-permissions`로 실행 — 사람이 "허용"을 누를 수 없는 헤드리스 구조이기 때문. 외부 공개 시 반드시 인증 계층 추가 필요
- **파일 수정 차단 지침** — 챗봇 실행에는 시스템 지침(`--append-system-prompt`)이 붙어, 저장소 코드·설정·문서를 고쳐달라는 직접 요청은 거부하고 Claude Code에서 하도록 안내한다. 캠페인 워크플로 산출물(정의서 xlsx·리포트·저니 이력 등) 생성은 정상 동작. 지침 기반이라 100% 강제는 아님
- 탭을 닫아도 진행 중 작업은 계속됨 — 다시 열면 같은 세션으로 이어짐

## 사용 계정 · 사용량 (중요)

챗봇은 매 요청마다 이 PC의 `claude` CLI(`claude -p`)를 실행한다([`server.js`](server.js)의 `spawn('claude', …)`). 따라서:

- 챗봇은 **이 PC의 `claude` CLI에 로그인된 계정**으로 동작하며, **토큰·사용량도 그 계정에서 차감**된다 — 터미널에서 Claude Code를 쓰는 것과 과금상 동일한 행위다. (데스크톱 Claude 앱에 로그인한 계정과 **다를 수 있다.**)
- 캠페인 생성처럼 **하위 워커(`Agent`)에 위임하는 요청은 한 번에 여러 에이전트 세션이 돌아** 단순 조회보다 사용량을 많이 쓴다.
- 챗봇이 `You've hit your session limit · resets …` 류의 답을 하면 봇 오류가 아니라 **CLI 로그인 계정의 사용 한도** 도달이다. 현재 계정 확인: `C:\Users\<사용자>\.claude.json` 의 `oauthAccount.emailAddress` 값.
- CLI가 요청마다 돌려주는 비용 환산치(`total_cost_usd`)를 서버가 `result` 이벤트의 `cost`로 내려보내지만, **현재 Chrome 확장 UI는 이 값을 표시하지 않는다** (서버만 전달, 화면 표시 없음).
- 계정 변경은 터미널에서 `claude` → `/logout` → `/login` 후 **브릿지 재시작**(`stop-web.cmd` → `run-web.cmd`). 이는 사용량/과금 주체만 바꾸며 SFMC(MCE) 접근은 별도 MCP 인증이라 무관하다.

## SFMC Custom App 등록 (선택, 추후)

- MCE 화면 안 탭으로 띄우려면: 챗봇 UI를 HTTPS로 호스팅 → SFMC Setup > Apps > Installed Packages > New > Marketing Cloud App 컴포넌트 추가 → Login/Redirect URL에 앱 URL 등록
- SFMC는 `frame-ancestors`로 외부 페이지에서의 iframe 삽입을 차단하므로, 반대 방향(SFMC 안에 앱을 삽입)만 가능
