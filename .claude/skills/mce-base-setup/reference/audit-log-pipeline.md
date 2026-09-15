# ② 감사로그 적재 파이프라인 — Data Extract(Audit Trail) → File Transfer → Import → DE

**기본 방식 = 방식 A (Automation Data Extract).** 이 계정에 Data Extract 타입
`Audit Trail Activity Log`·`Audit Trail Access Log`가 존재함을 확인했다(2026-08-05, `GET /automation/v1/dataextracttypes`).
REST Audit Events API(방식 B)는 이 계정에서 403(권한 없음)이라 **대안으로만** 남긴다.

## 방식 A (기본) — Automation 상주형

플랫폼 내 Automation이 매일 알아서 돈다(에이전트 개입 불필요). 흐름:

```
[Step 1] Data Extract ×2 ── Audit Trail Activity Log / Access Log → 어제치 CSV를 Safehouse에 생성
[Step 2] File Transfer ×2 ── Safehouse → Enhanced FTP /Import 로 이동
[Step 3] Import File ×2 ──── /Import 파일 → AUDITLOG_Activity / AUDITLOG_Access DE 적재
```

### 생성 객체 요약

| 유형 | 이름 | Key | 비고 |
|---|---|---|---|
| DE | `AUDITLOG_ActivityLog` | `auditlog_activity_v3` | 감사 활동 로그 (누적, CSV 헤더 1:1) |
| DE | `AUDITLOG_AccessLog` | `auditlog_access_v3` | 접속(로그인) 로그 (누적, CSV 헤더 1:1) |
| Data Extract ×2 | `EXT_AuditActivity_Daily` / `EXT_AuditAccess_Daily` | — | 어제치, 파일명에 `%%Year%%%%Month%%%%Day%%` |
| File Transfer ×2 | `FT_AuditActivity` / `FT_AuditAccess` | — | Safehouse → FTP /Import |
| Import ×2 | `IMP_AuditActivity` / `IMP_AuditAccess` | — | 헤더 기반 매핑, Add Only |
| Automation | `AUTO_AuditLog_Daily` | `auto_auditlog_daily` | 매일 03:00, 3 step 순차 |

> FTP 위치는 **기존 Enhanced FTP를 재사용**한다(신규 FTP 계정 생성 없음).
> ①(02:00)과 시간을 띄운 03:00 스케줄. 생성 직후 1회 수동 실행으로 초기 적재 확인.

### 파일/추출 설정 (⚠️ 실계정 학습 반영, 2026-08-05)

- 추출 범위: **최근 30일 롤링** (확정 정책 — 매일 30일치를 추출하고 DE의 PK 중복 스킵으로 새 이벤트만 적재.
  하루 실패해도 다음 실행이 빈틈을 자동 복구하며, 감사로그 30일 보관과 정확히 맞물린다).
  - ⚠️ **범위(일수)는 API로 설정 불가** — `/automation/v1/dataextracts`는 undocumented이며
    `intervalType`은 0/1만 허용, `Range`/`StartDate`/`EndDate` dataFields는 조용히 무시됨(실계정 프로빙 확인).
    **워커는 기본값으로 생성만 하고, 결과 보고의 후속 안내에 "Automation Studio에서 두 추출 액티비티의
    Date Range를 30일로 1회 변경" 단계를 반드시 포함**한다(스케줄 Start와 함께 콘솔 1회 작업).
- 파일명: `AuditActivity_%%Year%%%%Month%%%%Day%%.csv` / `AuditAccess_%%Year%%%%Month%%%%Day%%.csv`
- **File Transfer의 fileSpec에 경로 접두어(`Import/` 등)를 넣으면 안 된다** — Safehouse에서 파일명 패턴만으로 찾는다.
  경로를 넣으면 Step2가 실패한다(실계정 확인). fileSpec = 파일명 패턴만.
- **Import updateTypeId = 1 (Add and Do Not Update)** — Add Only 의미. `2`는 다른 의미이므로 쓰지 않는다.
- Import는 **헤더 행 기반 매핑(InferFromColumnHeadings)** + Add Only — 어제치만 매일 추가되므로 정상 운영에선 중복이 없다.
  같은 날 재실행하면 중복 행이 생길 수 있으므로, 재실행이 필요하면 결과 보고에 그 사실을 명시한다.
- **빈 데이터 주의**: 추출 범위에 감사 이벤트가 없으면 파일이 헤더 없이 공지성 1행만 담겨 나올 수 있고,
  이 경우 Import가 "1행/오류 1행"으로 실패한다. 이는 파이프라인 결함이 아니라 데이터 부재 —
  결과 보고에 "실데이터 발생 후(익일 스케줄) 정상 적재 여부 확인 필요"로 안내한다.

### DE 스키마 — 실제 추출 CSV 헤더 (✅ 공식 문서로 확정, 2026-08-05)

**Activity Log** (`AUDITLOG_ActivityLog`, key `auditlog_activity_v3` — PK: CreatedDate+ObjectTypeID+OperationID+TransactionID):
`CreatedDate(Date), EID(Number), MID(Number), UserID(Number), EmployeeID(Number), EmployeeName, ObjectTypeID(Number), ObjectTypeName, OperationID(Number), OperationName, ObjectID, ObjectName, TransactionID`

**Access Log** (`AUDITLOG_AccessLog`, key `auditlog_access_v3` — PK: UserName+AccessDate+SecurityEventTypeID):
`User, UserName, AccessDate(Date), FromIP, SecurityEventTypeID(Number), SecurityEventType, LoginStatusID(Number), LoginStatusName, UserAgent, Event Source`
(※ "Event Source" 표기가 불확실해 `Event Source`·`EventSource` 필드를 둘 다 두었다 — 매칭되는 쪽에 적재됨)

출처: Salesforce Help "Audit Trail Activity Log Fields" / "Audit Trail Access Log Fields".
헤더가 다시 불일치하면 오류 컬럼명 근거로 필드 **추가만** 하고 재실행(삭제/변경 금지, 조정 내역 ⚠️ 명시).

### 실행 절차 (워커)

1. DE 2종 생성 (존재하면 재사용).
2. Data Extract 액티비티 2종 생성 — extractId는 `GET /automation/v1/dataextracttypes`에서
   `Audit Trail Activity Log`/`Audit Trail Access Log`로 조회해 사용.
3. File Transfer 2종 생성 (`sfmc_create_automation_file_transfer`, Safehouse→FTP /Import).
4. Import 액티비티 2종 생성 (헤더 매핑, Add Only, 대상 DE 연결).
5. `AUTO_AuditLog_Daily` Automation 생성 — Step1(추출×2) → Step2(전송×2) → Step3(임포트×2), 매일 03:00.
6. 1회 수동 실행 → 완료 대기 → 두 DE 적재 행 수 확인 후 보고.
   Import 컬럼 불일치 시 위 "가변 스키마" 절차로 자기 수복 후 재실행(최대 2회, 그래도 실패면 ⚠️ 보고).
7. ①과 동일하게 **스케줄 활성화(Start)는 콘솔에서 사용자 수동** — 후속 안내에 포함
   (이 계정에서 trigger 활성화 API가 404를 반환함, ① 실행에서 확인).

## 방식 B (대안) — Audit Events REST API → bulk upsert

`GET /data/v1/audit/auditEvents` 페이지네이션 수집 → `AUDITLOG_Events` DE upsert(TransactionID PK) →
`AUDITLOG_LoadControl` 제어 행으로 증분 관리. 상세 스키마·절차는 git 이력의 이전 버전 참조.

- **현재 이 계정은 403** (Installed Package에 Audit Logs Read scope 없음 또는 Audit Logging 미활성).
- 권한이 열리면 방식 A와 병행하지 말고 하나만 택한다(중복 적재 방지).
- 워커는 실행 전 GET 1회로 권한을 확인하고, 403이면 방식 A로 진행한다(방식 A가 기본이므로 보통 확인 불필요).

## 멱등성 / 재실행 규칙

- 같은 이름/Key 객체가 이미 있으면 생성을 건너뛰고 `♻️ 이미 존재(재사용)`으로 보고.
- 기존 객체 삭제/덮어쓰기 금지. DE 필드는 **추가만** 허용(자기 수복 시).
- Import가 Add Only이므로 **같은 날 자동화를 2회 실행하면 중복 행** — 재실행 시 결과에 반드시 명시.
