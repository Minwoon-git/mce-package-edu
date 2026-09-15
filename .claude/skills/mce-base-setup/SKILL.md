---
name: mce-base-setup
description: >
  MCE(SFMC Marketing Cloud Engagement) 기본 세팅 — 계정 운영에 필요한 3종 기반 작업을 실제로 생성/실행한다.
  ① 발송 결과 적재(데이터뷰 _Sent/_Open/_Click/_Bounce UNION+EventType → 어제치 DE + 누적 히스토리 DE(저니ID·저니명·액티비티명 포함) + 일배치 Automation),
  ② 감사로그 적재(Data Extract 'Audit Trail Activity/Access Log' → File Transfer → Import → 감사로그 DE, 일배치 Automation),
  ③ IP 워밍용 Journey 생성(워밍 대상 DE + 램프 단계별 Decision Split 저니, Draft).
  "기본세팅", "기본 세팅 해줘", "발송 결과 적재", "트래킹 데이터 적재", "감사로그 적재",
  "audit log 적재", "IP 워밍 저니 만들어줘", "워밍용 저니 생성" 등의 요청 시 이 스킬을 사용한다.
  (초기 세팅 '점검'은 mce-onboarding, 마케팅 캠페인 생성은 mce-campaign — 이 스킬과 별개.)
---

# MCE 기본 세팅 — 오케스트레이터 + 워커

사용자가 "기본세팅 해줘" 류의 요청을 하면, **상위 에이전트(오케스트레이터)** 가
실작업을 **`mce-base-setup-agent` 워커에게 `Agent` 도구로 위임**하고,
워커가 반환한 생성 결과 리포트를 사용자에게 보고한다.

> ⚠️ 이 스킬은 **계정에 객체를 실제로 생성하는 쓰기 작업**이다(온보딩 점검과 달리 read-only가 아님).
> 그래서 **위임 전에 상위가 "생성될 객체 목록"을 요약 제시하고 승인을 1회 받는다.**

## 3종 작업 (요청 범위)

| # | 작업 | 생성/실행 내용 | 참조 스펙 |
|---|---|---|---|
| ① | **발송 결과 적재** | 데이터뷰(_Sent/_Open/_Click/_Bounce) 4종을 **UNION+EventType(이벤트당 1행)**으로 통합(저니ID·저니명·액티비티명 JOIN 포함) → `SENDLOG_Daily`(어제치, Overwrite) + `SENDLOG_History`(누적, Update) DE 2종 + SQL Query 2종 + 일배치 Automation 1종 생성 | [`reference/send-results-pipeline.md`](reference/send-results-pipeline.md) |
| ② | **감사로그 적재** | Data Extract(Audit Trail Activity/Access Log) → File Transfer → Import로 감사로그 DE 2종에 일배치 적재하는 Automation 생성 (REST API 방식은 대안) | [`reference/audit-log-pipeline.md`](reference/audit-log-pipeline.md) |
| ③ | **IP 워밍 저니 생성** | 워밍 대상 DE + 워밍 이메일(플레이스홀더) + 램프 단계별 Decision Split 저니 1개 생성 (**Draft, 발행 안 함**) | [`reference/ip-warming-journey.md`](reference/ip-warming-journey.md) |

**범위 판정**: "기본세팅/기본 세팅" = ①+②+③ 전체. "발송 결과/트래킹 적재" = ①만.
"감사로그/audit log" = ②만. "IP 워밍 저니/워밍 저니" = ③만. 불명확하면 상위가 `AskUserQuestion`으로 범위를 확인한다.

## 정책 (확정값)

- **승인 1회 필수**: 쓰기 작업이므로 위임 전에 상위가 생성 예정 객체 목록(아래 표 형식)을 제시하고
  `AskUserQuestion`(진행 / 범위 수정 / 취소)으로 승인받는다. 승인 후 워커는 무질문 실행.
- **멱등성**: 같은 이름/Key의 객체가 이미 있으면 **재생성하지 않고 "이미 존재(재사용)"으로 보고**한다. 기존 객체를 삭제/덮어쓰지 않는다.
- **저니는 Draft만**: ③의 저니는 생성만 하고 **발행(publish)하지 않는다.** 발행·실발송 시작은 사용자가 콘솔에서 결정.
- **삭제 금지**: 이 스킬은 어떤 기존 객체도 삭제하지 않는다 (`delete_*` 호출 금지).
- **워밍 발송량 제어 = 운영 가이드**: 일일 발송량 램프는 저니가 아니라 **워밍 대상 DE에 넣는 행 수로 운영자가 제어**한다.
  램프 표는 결과 보고에 텍스트로만 포함한다(리마인더 등록 안 함).

## 경로

> ⚠️ 절대경로는 PC마다 다르다. 항상 현재 작업 디렉토리(cwd)를 프로젝트 루트로 삼는다.

---

## 전체 흐름

```
사용자: "기본세팅 해줘" (또는 ①/②/③ 개별 요청)
   │
   ├─ 상위: 요청 범위 판정 (①②③ 중 해당분) — 불명확하면 질문
   ├─ 상위: 생성 예정 객체 요약 표 제시 → AskUserQuestion 승인 (진행/수정/취소)
   │
   ▼ (상위가 호출)  Agent → mce-base-setup-agent  (승인된 범위 + 스펙 참조 지시 전달)
   │     ① 발송 결과 적재: DE 2종(어제치+누적) + SQL Query 2종 + Automation 생성 (+ 1회 수동 실행으로 초기 적재)
   │     ② 감사로그 적재: DE 2종 + Extract/Transfer/Import 액티비티 + Automation 생성 (+ 1회 실행)
   │     ③ IP 워밍 저니: 대상 DE + 워밍 이메일 + Decision Split 저니(Draft) 생성
   │
   ▼ 상위가 결과 종합 보고 (생성 객체 표 + 워밍 램프 가이드 + 후속 안내)
```

---

## STEP 1 — 범위 판정 + 승인 (상위)

1. 요청 문구로 ①②③ 범위를 판정한다.
2. 해당 범위의 **생성 예정 객체**를 참조 스펙의 이름/Key 그대로 표로 제시한다:

```
## 생성 예정 객체 (승인 요청)
| # | 유형 | 이름 | Key | 비고 |
| ① | DE | SENDLOG_Daily / SENDLOG_History | sendlog_daily / sendlog_history | 어제치 교체 / 누적 히스토리 |
| ① | SQL Query | QRY_SendLog_Daily / QRY_SendLog_History | qry_sendlog_* | Overwrite 어제치 / Update 2일 |
| ① | Automation | AUTO_SendLog_Daily | auto_sendlog_daily | 매일 02:00, 쿼리 2종 |
| ② | DE | AUDITLOG_Activity / AUDITLOG_Access | auditlog_* | 감사 활동/접속 로그 누적 |
| ② | Extract·Transfer·Import | EXT_/FT_/IMP_ Audit* 각 2종 | — | 어제치 CSV → FTP → DE |
| ② | Automation | AUTO_AuditLog_Daily | auto_auditlog_daily | 매일 03:00, 3 step |
| ③ | DE | IPWARM_Targets | ipwarm_targets | 저니 진입 DE |
| ③ | Email | EML_IPWarming_Base | — | 플레이스홀더 |
| ③ | Journey | IPWarming_Ramp | — | Draft, 미발행 |
```

3. `AskUserQuestion`으로 승인(진행 / 범위 수정 / 취소)을 받는다.

## STEP 2 — 위임 (상위 → 워커)

승인된 범위·특이사항(이름 변경 요청 등)을 프롬프트에 모두 담아 `mce-base-setup-agent`를 호출한다.
워커는 참조 스펙 3개 파일을 SSOT로 실행하고, 아래 STEP 3 포맷의 결과를 반환한다.

## STEP 3 — 결과 보고 (출력 포맷)

```
## 🧱 MCE 기본 세팅 결과  (<범위: ①②③>)

### 생성/실행 결과
| # | 유형 | 이름 | Key/ID | 상태 | 비고 |
(상태: ✅ 생성됨 / ♻️ 이미 존재(재사용) / ▶️ 실행됨(적재 N행) / ⚠️ 실패-사유)

### ③ IP 워밍 운영 가이드 — 해당 시
(램프 표 + "IPWARM_Targets에 넣는 행 수로 일일 발송량을 제어" 안내 + 저니는 Draft이며 발행은 콘솔에서)

### 후속 안내
- (실패 항목 재시도 방법 / 콘솔 확인 위치 / 다음 증분 적재 방법 등)
```

> **결과만 전달 (과정 비노출)**: 도구 호출 사이에 진행 멘트를 넣지 않는다.
> 사용자에게 노출하는 것은 STEP 1 승인 질문, 최종 결과 보고, 오류뿐이다.

---

## 다른 스킬과의 관계

- **`mce-onboarding`** = 발송 인프라 **점검(read-only)**. 이 스킬(`mce-base-setup`)은 **실제 생성(write)** — 완전 별개.
  단, 온보딩 점검 체크리스트의 **카테고리 B**가 이 스킬의 산출물(SENDLOG·AUDITLOG·IPWARM 객체) 존재 여부를 점검한다 — 미구성이면 온보딩 리포트가 이 스킬로 안내한다.
- **`mce-campaign`** = 마케팅 캠페인/저니 생성. IP 워밍 저니(③)는 캠페인이 아니라 인프라성 저니이므로 이 스킬 담당.
- 단순 조회(저니/DE 목록)는 CLAUDE.md 전역 조회 규칙(SFMC 실시간 조회)을 따른다.
