# ① 발송 결과 적재 파이프라인 — Data View 4종 UNION → 결과 DE 2개 (어제치 + 누적 히스토리)

발송 트래킹 데이터뷰 4종(_Sent/_Open/_Click/_Bounce)을 **UNION + `EventType` 컬럼**(이벤트당 1행)으로 통합하고,
저니 정보(JourneyID·JourneyName·ActivityName)를 JOIN해 **결과 DE 2개**에 적재한다:

- **`SENDLOG_Daily`** — 오늘 기준 **어제 하루치 이벤트 전부**를 매일 갈아끼움(Overwrite). "어제 뭐가 나갔고 무슨 반응이 왔나"를 바로 보는 용도.
- **`SENDLOG_History`** — 같은 이벤트를 매일 **누적 append**(Update·멱등). 전 기간 히스토리 원장.

(수신거부는 적재하지 않는다 — 사용자 확정.)

## 생성 객체 요약

| 유형 | 이름 | Key | 액션/윈도우 |
|---|---|---|---|
| DE | `SENDLOG_Daily` | `sendlog_daily` | 어제 하루치, 매일 전체 교체 |
| DE | `SENDLOG_History` | `sendlog_history` | 누적 (PK 멱등 append) |
| SQL Query | `QRY_SendLog_Daily` | `qry_sendlog_daily` | **Overwrite**, 어제 00:00~24:00 |
| SQL Query | `QRY_SendLog_History` | `qry_sendlog_history` | **Update**, 최근 2일 (실패 복구용 겹침) |
| Automation | `AUTO_SendLog_Daily` | `auto_sendlog_daily` | 매일 02:00, 쿼리 2종 실행 |

> 생성 순서: **DE 2개 → SQL Query 2개 → Automation** (쿼리는 대상 DE가 있어야 검증 통과).
> 생성 후 `sfmc_run_automation`으로 **1회 수동 실행**해 초기 적재하고, 두 DE의 적재 행 수를 결과에 보고한다.

## 공통 스키마 — 두 DE 동일  (PK: EventType+JobID+ListID+BatchID+SubscriberID+EventDate)

| 필드 | 타입 | PK | 비고 |
|---|---|---|---|
| EventType | Text(10) | ✔ | `Sent` / `Open` / `Click` / `Bounce` (SQL 리터럴로 부여) |
| JobID | Number | ✔ | |
| ListID | Number | ✔ | |
| BatchID | Number | ✔ | |
| SubscriberID | Number | ✔ | |
| EventDate | Date | ✔ | 이벤트 발생 시각 |
| SubscriberKey | Text(254) | | |
| EmailAddress | Text(254) | | _Subscribers JOIN (트래킹 데이터뷰엔 이메일이 없음) |
| JourneyID | Text(50) | | _Journey JOIN (비저니 발송이면 NULL) |
| JourneyName | Text(200) | | _Journey JOIN |
| JourneyVersion | Number | | _Journey.VersionNumber |
| ActivityName | Text(200) | | _JourneyActivity JOIN |
| ActivityType | Text(50) | | _JourneyActivity |
| URL | Text(900) | | Click만 |
| LinkName | Text(500) | | Click만 |
| BounceCategory | Text(50) | | Bounce만 |
| BounceType | Text(50) | | Bounce만 |
| LoadedAt | Date | | 적재 시각 |

> Email Studio 단독 발송 등 **저니 외 발송도 행은 적재**되며 Journey*/Activity* 컬럼만 NULL이다.
>
> ✅ **검증 이력 (2026-08-05, 현재 계정)**: Daily·History 두 쿼리 모두 `sfmc_validate_sql_query` 통과.
> 이 계정의 `_Click`에는 `URLID` 컬럼이 **없어서** 스키마/PK에서 제외했다(URL·LinkName은 존재).
> 극히 드물게 같은 수신자가 **같은 초에 서로 다른 링크 2개**를 클릭하면 PK가 겹쳐 1행만 남는다(허용 가능한 손실로 확정).

## SQL — 공통 본문 (UNION 4종 + 저니 JOIN)

두 쿼리는 **본문이 같고 날짜 WHERE 절만 다르다.** `{{윈도우}}` 자리에 각 쿼리의 조건을 넣는다.

```sql
SELECT
  e.EventType, e.JobID, e.ListID, e.BatchID, e.SubscriberID, e.EventDate,
  e.SubscriberKey,
  sub.EmailAddress,
  j.JourneyID, j.JourneyName, j.VersionNumber AS JourneyVersion,
  ja.ActivityName, ja.ActivityType,
  e.URL, e.LinkName, e.BounceCategory, e.BounceType,
  GETDATE() AS LoadedAt
FROM (
  SELECT 'Sent' AS EventType, s.JobID, s.ListID, s.BatchID, s.SubscriberID,
         s.EventDate, s.SubscriberKey, s.TriggererSendDefinitionObjectID,
         NULL AS URL, NULL AS LinkName, NULL AS BounceCategory, NULL AS BounceType
  FROM _Sent s
  WHERE {{윈도우}}
  UNION ALL
  SELECT 'Open', o.JobID, o.ListID, o.BatchID, o.SubscriberID,
         o.EventDate, o.SubscriberKey, o.TriggererSendDefinitionObjectID,
         NULL, NULL, NULL, NULL
  FROM _Open o
  WHERE {{윈도우}}
  UNION ALL
  SELECT 'Click', c.JobID, c.ListID, c.BatchID, c.SubscriberID,
         c.EventDate, c.SubscriberKey, c.TriggererSendDefinitionObjectID,
         c.URL, c.LinkName, NULL, NULL
  FROM _Click c
  WHERE {{윈도우}}
  UNION ALL
  SELECT 'Bounce', b.JobID, b.ListID, b.BatchID, b.SubscriberID,
         b.EventDate, b.SubscriberKey, b.TriggererSendDefinitionObjectID,
         NULL, NULL, b.BounceCategory, b.BounceType
  FROM _Bounce b
  WHERE {{윈도우}}
) e
LEFT JOIN _Subscribers sub
  ON e.SubscriberID = sub.SubscriberID
LEFT JOIN _JourneyActivity ja
  ON e.TriggererSendDefinitionObjectID = ja.JourneyActivityObjectID
LEFT JOIN _Journey j
  ON ja.VersionID = j.VersionID
```

**날짜 윈도우** (`EventDate`는 서버 시간 기준):

```sql
-- QRY_SendLog_Daily → SENDLOG_Daily (Overwrite): 어제 00:00 ~ 오늘 00:00
EventDate >= CONVERT(DATE, DATEADD(DAY, -1, GETDATE()))
AND EventDate <  CONVERT(DATE, GETDATE())

-- QRY_SendLog_History → SENDLOG_History (Update): 최근 2일 (하루 실패해도 다음 실행이 복구)
EventDate >= DATEADD(DAY, -2, GETDATE())
```

> - **Daily = Overwrite**: 매일 전체 교체라 항상 "어제 하루치"만 남는다.
> - **History = Update + PK**: 같은 이벤트를 다시 넣어도 같은 행에 덮이므로 중복 없이 누적된다(멱등).
>   Open/Click은 발송 며칠 뒤에도 발생하는데, 히스토리는 **이벤트 발생일 기준**으로 매일 쓸어 담으므로 늦은 반응도 새 행으로 자연히 적재된다(별도 재집계 불필요).
> - 생성 전 `sfmc_validate_sql_query`로 검증한다. `_Journey`/`_JourneyActivity` 조회 불가(권한/미활성) 시
>   **저니 JOIN 2개와 Journey*/Activity* 컬럼만 제거**, `_Subscribers` 조회 불가 시 **해당 JOIN과 EmailAddress 컬럼만 제거**하고
>   (DE 스키마도 동일 조정) 진행하되 결과에 ⚠️ 명시. 그 외 컬럼 오류도 해당 컬럼만 제외 후 명시.

## Automation

- 이름 `AUTO_SendLog_Daily` / key `auto_sendlog_daily`
- 스케줄: **매일 02:00 (계정 표준시간대)**, 시작일 = 생성 다음 날
- 구성: 1 step에 Query Activity 2종 (Daily·History — 서로 의존 없어 동시 실행 가능)
- 생성 도구: `sfmc_create_sql_query`(2회) → `sfmc_create_automation`(스케줄 포함)
- 생성 직후 `sfmc_run_automation` 1회 → 초기 적재. 완료 후 두 DE의 적재 행 수를 확인해 보고.
  (최초 실행 시 History도 최근 2일치부터 시작한다 — 과거 백필이 필요하면 History 쿼리의 윈도우를 임시로 늘려 1회 실행하는 방법을 후속 안내에 적는다.)

## 멱등성 / 재실행 규칙

- 같은 key의 DE/쿼리/Automation이 이미 있으면 생성을 건너뛰고 `♻️ 이미 존재(재사용)`으로 보고.
- 기존 객체의 스키마가 본 스펙과 다르면 **변경하지 않고** ⚠️로 차이만 보고한다(덮어쓰기 금지).
- Daily는 Overwrite, History는 PK Update — 둘 다 몇 번 재실행해도 같은 결과로 수렴한다.
- History DE는 계속 자라므로 **데이터 보존 정책(예: 2년) 설정 여부를 후속 안내에 옵션으로 제시**한다(기본은 미설정, 임의 적용 금지).
