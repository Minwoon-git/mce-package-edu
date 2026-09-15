# 추천 데이터 소스 / 진입 DE / 폴더 구조 (STEP 1 참조) — 분석 가이드 진입점

> ⭐ **이 파일은 분석 가이드 2층 구조의 진입점이다.** 실제 분석·추천 절차와 값은 아래 두 파일로 이원화돼 있다.
> - **공통(방법)** → [`analysis-guide/_common.md`](analysis-guide/_common.md) : 진단 차원(1/2/3), 캠페인 아키타입, 사전집계(`SEG_*`+rowCount) 패턴, 동의 원칙, 폴더 fallback
> - **고객사(값)** → 활성 고객사 분석 가이드, 기본 [`analysis-guide/ecommerce-default.md`](analysis-guide/ecommerce-default.md) : 분석 소스 DE·스키마 매핑, 해석 규칙(세금/포인트/취소 등), 기준선, `SEG_*` 정의, 진입 DE/폴더 매핑
>
> **STEP 1·2를 수행할 땐 `_common.md`(방법) + 활성 고객사 분석 가이드(값)를 함께 읽는다.** 활성 고객사는 `SKILL.md`/`CLAUDE.md`의 "활성 고객사 분석 가이드" 지정을 따른다(기본 `ecommerce-default`).

---

## 요약 (빠른 참조)

STEP 1(주제 선정/캠페인 추천)은 **고객 데이터를 직접 진단**해 캠페인을 추천한다(3차원).
- 분석의 단일 소스 = 활성 고객사 분석 가이드에 지정된 분석 DE(기본 템플릿 = `Customer_Profile` / `CD_Customer_Profile_DE`).
- 진단은 **사전집계 `SEG_*` 카운트 DE의 `rowCount`만 즉시 읽어** 비율을 내고, 기준선과 대조해 비율 높은 순으로 추천한다(대기 없음). → 상세 [`analysis-guide/_common.md`](analysis-guide/_common.md) 3절.
- 추천된 캠페인의 **발송(진입) DE는 캠페인 선택 후** STEP 1-6에서 세그먼트 조건 + 동의 필터로 생성한다(진단 단계에서 만들지 않음).
- 분석 소스가 없거나 비면 **폴더 탐색 fallback** ([`analysis-guide/_common.md`](analysis-guide/_common.md) 5절)으로 폴백한다.

> 컬럼명·기준선·세그먼트 WHERE·폴더 categoryId 등 **구체값은 모두 활성 고객사 분석 가이드**([`analysis-guide/ecommerce-default.md`](analysis-guide/ecommerce-default.md))에 있다. 이 파일에는 더 이상 고객사 고정값을 두지 않는다(새 고객사 추가 시 분석 가이드 파일만 작성).
