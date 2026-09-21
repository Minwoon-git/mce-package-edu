# SFMC 고정값 (활성 BU 기준)

> ⛔ **하드코딩 금지 — 이 문서의 GUID·ID는 전부 "BU 종속" 값이다.**
> Send Classification·Sender Profile·Delivery Profile·List·Content Builder 폴더 ID는 **BU마다 다르고**, BU를 옮기거나 계정이 바뀌면 전부 무효다.
> 저니 이메일 액티비티를 만들기 전에 **아래 조회 명령으로 현재 BU 실제 값을 확인한 뒤 사용**한다. 이 표는 "마지막 확인값"일 뿐 계약이 아니다.
> (과거 사고: 다른 BU 값을 그대로 써서 저니 8개 중 5개 이메일 액티비티가 존재하지 않는 발송 설정을 참조 → 발행·발송 불가. `error-log.md` 참조.)

**확인 명령 (매번 실행):**

| 확인 대상 | 도구 |
|---|---|
| Send Classification (+연결된 Sender/Delivery Profile GUID) | `sfmc_get_send_classifications` |
| Sender Profile (FromName·FromAddress 포함) | `sfmc_get_sender_profiles` |
| Publication List / All Subscribers ID | `sfmc_get_lists` |
| Content Builder 폴더 categoryId | `sfmc_get_content_categories` |
| 현재 토큰의 BU(MID) | `sfmc_rest_get` → `/platform/v1/tokenContext` |

---

## 마지막 확인값 — BU `<연결 BU 이름>` (tenant `<테넌트 서브도메인>`, MID `<MID>`)

*신규 고객사 시작 상태 — 최초 저니 생성 전에 위 조회 명령으로 실제 값을 채운다.*

### 발송 설정 (이메일 액티비티 `configurationArguments.triggeredSend`)

| 항목 | 이름 | GUID / ID |
|---|---|---|
| Send Classification (Marketing) | Default Commercial | `002f8a15-ecd4-f011-a5da-5cba2c19fe48` |
| Send Classification (Operational) | Default Transactional | `012f8a15-ecd4-f011-a5da-5cba2c19fe48` |
| Sender Profile | Default (`salesforce_edu@milvus.co.kr`) | `fe2e8a15-ecd4-f011-a5da-5cba2c19fe48` |
| Delivery Profile | Default | `ff2e8a15-ecd4-f011-a5da-5cba2c19fe48` |
| Publication List | All Subscribers | `5523` (ObjectID `1ba80504-bdf9-4f7a-b398-6f61f78bc44d`) |

> 위 값은 2026-09-21 `sfmc_get_send_classifications`/`sfmc_get_sender_profiles`/`sfmc_get_lists`로 실측 확인. Default Commercial의 SenderProfile.ObjectID/DeliveryProfile.ObjectID를 그대로 사용(위 표와 동일).

- **Send Classification과 Sender Profile은 짝을 맞춘다.** Send Classification이 이미 Sender/Delivery Profile을 물고 있으므로, `sfmc_get_send_classifications` 응답의 `SenderProfile.ObjectID`·`DeliveryProfile.ObjectID`를 그대로 쓰는 것이 가장 안전하다. 임의 조합 시 발송 도메인이 의도와 달라진다.
- **Publication List는 BU마다 다르다** — `sfmc_get_lists`로 All Subscribers ID를 확인한다(다른 BU의 리스트 ID를 그대로 쓰면 발송 불가).
- **한 저니 안에서 액티비티별로 발송 설정이 섞이지 않게 한다.** 전체 이메일 액티비티가 동일한 Send Classification·Sender Profile·Publication List를 쓰는지 생성 후 반드시 검증한다.

### Content Builder 폴더

| 폴더 | categoryId | 비고 |
|---|---|---|
| Content Builder (루트) | `82578` | — |
| MCE-Package (캠페인 발송용 이메일 전용) | `96253` | 루트 하위. **다른 BU의 폴더 ID를 재사용하지 말 것** |
| Query 루트 폴더 (SQL Query 액티비티) | `82567` | `sfmc_get_automation_categories?$filter=categorytype eq queryactivity` |

### 시간대
- **timeZoneId**: `48` (Seoul, GMT+09:00) — Automation 스케줄 PATCH 시 항상 사용. (BU 종속 아님)

---

## 다른 BU/고객사로 전환할 때

1. `sfmc_rest_get` → `/platform/v1/tokenContext` 로 MID 확인.
2. 위 5개 조회 명령을 모두 실행해 새 BU 실제 값 수집.
3. 이 문서의 "마지막 확인값" 블록 + [`analysis-guide/<고객사>.md`](analysis-guide/) §7-1 표 + [`../../../agents/mce-journey-agent.md`](../../../agents/mce-journey-agent.md) 참고 블록을 **동시에** 갱신.
4. 기존 저니가 있으면 이메일 액티비티의 `sendClassificationId`·`senderProfileId`·`deliveryProfileId`·`publicationListId`가 새 BU 값인지 점검(구 BU 값이면 발행 불가).
