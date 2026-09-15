# ③ IP 워밍용 Journey 생성 — 워밍 대상 DE + 램프 단계별 Decision Split 저니 (Draft)

전용 IP 워밍 기간에 사용할 인프라성 저니 1개를 생성한다. **저니는 Draft로만 생성하고 발행하지 않는다.**
일일 발송량 램프는 저니 로직이 아니라 **운영자가 `IPWARM_Targets`에 넣는 행 수로 제어**한다.

## 생성 객체 요약

| 유형 | 이름 | Key | 비고 |
|---|---|---|---|
| DE | `IPWARM_Targets` | `ipwarm_targets` | 저니 진입 DE (Sendable) |
| Email | `EML_IPWarming_Base` | — | 플레이스홀더 (사용자가 콘텐츠 교체) |
| Journey | `IPWarming_Ramp` | — | Draft, Decision Split 6분기 |

> 생성 순서: **DE → Email → Journey** (저니의 Email Activity가 이메일 에셋을 참조).
> 이메일 표준(FROM/Send Classification 등 고정값)과 저니 생성 검증 페이로드는
> `mce-campaign` 스킬의 [`reference/email-standard.md`](../../mce-campaign/reference/email-standard.md) ·
> [`reference/journey-build.md`](../../mce-campaign/reference/journey-build.md)를 참고하되, 본 스펙이 우선한다.

## IPWARM_Targets 스키마  (Sendable — SubscriberKey → Subscriber Key 관계)

| 필드 | 타입 | PK | 비고 |
|---|---|---|---|
| SubscriberKey | Text(254) | ✔ | Subscriber Key 매핑 |
| EmailAddress | EmailAddress | | 발송 주소 |
| EngagementTier | Text(20) | | 예: HOT / ACTIVE / SEMI / ALL |
| WarmingStage | Text(10) | | `D1` / `D2-3` / `W1` / `W2` / `W3` / `W4` (분기 키) |
| AddedDate | Date | | 투입일 |

## 워밍 이메일 (플레이스홀더)

- 이름 `EML_IPWarming_Base`, 제목 예: `[브랜드명] 안내 메일`
- 본문: 간단한 브랜드 인사 + 수신거부 링크 등 표준 요소를 갖춘 최소 HTML.
  **실 콘텐츠는 사용자가 교체**한다는 전제를 결과 보고에 명시한다.
- 워밍 수칙상 "반응이 확실한 콘텐츠"를 써야 하므로, 교체 전 실발송 금지 안내를 후속 안내에 포함.

## Journey 구조 — `IPWarming_Ramp` (Draft) — ⭐ Wait 기반 자동 페이싱 (2026-08-06 확정)

**워밍 대상 전체를 1회 대량 투입**하면 저니가 Wait로 날짜를 나눠 스스로 램프를 진행한다(매일 수동 투입 불필요).

```
Entry: IPWARM_Targets (Audience, 재진입 허용 안 함) — 전체 코호트 1회 투입
   │
   ▼ Decision Split — WarmingStage 기준 6분기
   ├─ D1   → (대기 없음)        → Email (EML_IPWarming_Base)   ← 투입 당일
   ├─ D2-3 → Wait 1일           → Email (〃)
   ├─ W1   → Wait 3일           → Email (〃)
   ├─ W2   → Wait 7일           → Email (〃)
   ├─ W3   → Wait 14일          → Email (〃)
   └─ W4 (Remainder) → Wait 21일 → Email (〃)
```

- Wait는 **진입 시점 기준 상대 기간(duration)** — 투입 시각과 같은 시각에 발송되므로 **오전 중 투입 권장**(워밍 수칙: 매일 같은 시각).
- 분기 분리 이유는 동일: 스테이지별 성과를 저니 통계에서 따로 보고, 스테이지별 이메일 교체 가능.
- Event Definition은 `IPWARM_Targets` 기반 Audience로 생성한다.
- **생성 후 발행하지 않는다** (`sfmc_publish_journey` 호출 금지). 발행은 사용자가 콘솔에서.
- **비상 제동 = 저니 Pause**: 바운스/스팸 급등 시 Journey Builder에서 Pause → 대기 중 물량이 멈춘다.
  회복 후 Resume. (세밀한 감속이 필요하면 Pause 후 남은 코호트를 DE에서 재구성해 재투입.)

## 운영 가이드 — 코호트 램프 표 (결과 보고에 그대로 포함)

**투입은 1회.** 아래 상한에 맞춰 `WarmingStage`별 코호트 크기를 정해 한 번에 넣으면, 발송일은 저니가 알아서 배분한다.

| 발송일 (투입 후) | 코호트 크기(권장 상한) | WarmingStage | 대상 우선순위 |
|---|---|---|---|
| Day 1 (당일) | ~50 | `D1` | 최근 30일 오픈/클릭한 최우량 인게이지 고객 |
| Day 2 | ~500 | `D2-3` | 고인게이지 세그먼트 |
| Day 4 | ~5,000 | `W1` | 오픈율 높은 활성 고객 |
| Day 8 | ~50,000 | `W2` | 활성 고객 점진 확대 |
| Day 15 | ~250,000 | `W3` | 준활성 포함 |
| Day 22 | 나머지 전체 | `W4` | 전체 구독자 |

**워밍 중 운영 수칙** (결과 보고 후속 안내에 요약 포함):
1. 인게이지 순서로 — 가장 잘 여는 고객부터 뒤 코호트로 갈수록 확대.
2. 바운스율·스팸신고율 급등 시 **저니 Pause** (① `SENDLOG_Daily`로 매일 모니터링).
3. 투입은 오전 중 1회 — 이후 발송 시각이 자동으로 일관됨.
4. 워밍 기간엔 반응이 확실한 콘텐츠만.

## 멱등성

- 같은 이름의 DE/이메일/저니가 이미 있으면 생성을 건너뛰고 `♻️ 이미 존재(재사용)`으로 보고한다.
- 기존 저니를 수정/발행/삭제하지 않는다.

## ✅ 검증 이력 (2026-08-06, 현재 계정 — 1회 실행으로 전체 성공)

| 객체 | ID/Key |
|---|---|
| DE `IPWARM_Targets` | GUID `<생성 후 확인>` |
| Email `EML_IPWarming_Base` | Content Builder `<생성 후 확인>` / legacyId `<생성 후 확인>` |
| Event Definition | `<생성 후 확인>` (EmailAudience) |
| Journey `IPWarming_Ramp` (Draft) | `<생성 후 확인>` / key `IPWarming_Ramp-<YYYYMMDD>` |

- ⚠️ **Content Builder 폴더**: `email-standard.md`의 categoryId `93427`이 이 계정에 없어 `MCE-Package` 폴더를
  `96253`으로 신규 생성함. **이 계정에서 이메일 폴더는 `96253`을 사용할 것.**
- 저니 entryMode는 `OnceAndDone`(재진입 불허)으로 생성됨.
- **2026-08-06 Wait 기반 교체 성공**: Draft 저니는 `sfmc_update_journey`(PUT) **in-place 교체 가능** —
  id/key/version 유지, 삭제/재생성 불필요. WAIT 액티비티는 `waitUnit: DAYS` + duration으로 삽입.
