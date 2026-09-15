# 이메일 콘텐츠 템플릿 — 생성 가이드 (SSOT)

이메일 콘텐츠는 **"브랜드 킷이 주인공, 템플릿은 그걸 렌더하는 고정 틀"** 원칙으로 생성한다.

```
이메일 = 고정 _master.html  +  <고객사>.json (브랜드 킷)  +  캠페인 카피/이미지
         (레이아웃·색·폰트·모양은 브랜드 킷 밖에서 임의로 바꾸지 않는다)
```

- **골격(고정)**: [`_master.html`](_master.html) — 레이아웃·구조는 잠겨 있음. 시각값은 전부 토큰.
- **브랜드 킷(단일 진실)**: `<고객사>.json` (구조 예시: [`_example-brand.json`](_example-brand.json))

> ⭐ 2층 구조는 `analysis-guide/`와 동일 철학. 새 고객사는 `<고객사>.json` **한 개만** 추가하고 아래 줄만 바꾼다.
>
> **활성 고객사: `<확인필요: 신규 고객사 브랜드 킷 파일명>`** — `_example-brand.json`을 복제해 만든 뒤 이 줄을 그 파일명으로 바꾼다.

---

## 0. 절대 규칙 (LOCKED)

1. **브랜드 킷이 단일 진실.** 색·폰트·로고·버튼모양·모서리·헤더·푸터 회사정보는 `<고객사>.json`에서만 온다.
2. **템플릿 레이아웃은 고정.** `_master.html`의 구조·섹션 순서를 바꾸지 않는다.
3. **브랜드 킷에 없는 값 임의 생성 금지.** 킷에 없는 색/폰트/레이아웃을 지어내지 않는다.
4. **AI가 채우는 건 캠페인 카피·이미지뿐.** (제목·헤드라인·오퍼·CTA·상품 이미지)
5. **born-compliant 요소(§4)는 삭제·공란 금지.**

## 1. 브랜드 킷 → 템플릿 토큰 매핑

`<고객사>.json`의 값을 `_master.html`의 `{{token}}`으로 치환한다.

| 브랜드 킷 키 | 템플릿 토큰 | 의미 |
|---|---|---|
| `brand_name` | `{{brand_name}}` | 브랜드명 |
| `logo_url` | `{{logo_url}}` | 로고 URL (**비면** 텍스트 브랜드명으로 자동 대체) |
| `logo_width` | `{{logo_width}}` | 로고 px 폭 |
| `colors.accent` | `{{accent}}` | 포인트색 (eyebrow·오퍼·CTA·구분선) |
| `colors.accent_bg` | `{{accent_bg}}` | 오퍼 박스 배경 |
| `colors.header_bg` | `{{header_bg}}` | 헤더 배경 |
| `colors.header_text` | `{{header_text}}` | 로고 없을 때 헤더 텍스트색 |
| `colors.text` | `{{text_color}}` | 본문 강조 텍스트 |
| `colors.muted` | `{{muted_color}}` | 본문 보조 텍스트 |
| `colors.page_bg` | `{{page_bg}}` | 메일 바깥 배경 |
| `font_stack` | `{{font_stack}}` | 폰트 스택 |
| `style.card_radius` | `{{card_radius}}` | 카드/컨테이너 모서리(px) |
| `style.btn_radius` | `{{btn_radius}}` | 버튼 모서리(px). pill≈30, square≈6 |
| `image_folder_category_id` | (C 업로드 폴더) | 이미지 업로드 대상 |

> `style.button_shape`(pill/square)는 사람이 읽는 라벨이고, 실제 렌더는 `btn_radius` 숫자를 쓴다. 두 값을 일치시켜 둔다.

## 2. 캠페인 값 (STEP 2/3에서 채움 — 캠페인마다 다름)

`subject` · `preheader` · `eyebrow` · `hero_headline` · `body_line1` · `body_line2`
· `offer_label` · `offer_headline` · `offer_sub` · `cta_text` · `cta_url`
· (이미지형) `hero_img` · `hero_alt` · `products_title` · `product_{1..3}_img/name/url`
· (이모지형) `benefit_{1..3}_icon/title/desc`

## 3. 조건부 블록 (`<!-- #IF ... -->`) — 생성 시 한쪽만 남긴다

- `#IF logo_url … #ELSE … #ENDIF` — 로고 URL 있으면 `<img>`, 없으면 텍스트 브랜드명.
- `#IF hero_img … #ENDIF` — 히어로 배너 이미지(publishedURL) 있을 때만.
- `#IF products … #ENDIF` — 상품 3-up(이미지 카드) 쓸 때만. **좁은 화면에서도 한 줄 유지.**
- `#IF benefits … #ENDIF` — 이모지 혜택 3-up 쓸 때만. (products와 택1 권장)
- 최종 HTML엔 `#IF` 주석과 미채택 분기를 **모두 제거**.

## 4. SFMC 생성 조건 (born-compliant) — 빠지면 발송 검증 실패

`_master.html`에 내장돼 있으니 삭제/공란 금지:

| 요소 | 위치 / 형식 |
|---|---|
| AMPscript 안전 개인화 | HTML 맨 앞 `%%[ VAR @name … ]%%`, 본문 `%%=v(@name)=%%님` |
| 물리주소 (CAN-SPAM) | `%%Member_Busname%%` + `%%Member_Addr%% … %%Member_Country%%` |
| 수신거부 + 프로필센터 (**둘 다**) | `%%unsub_center_url%%` + `%%profile_center_url%%` |
| 오픈 추적 | `</body>` 앞 `<custom name="opencounter" type="tracking"/>` |
| 반응형 | `width="600"` + `@media max-width:620px` |

**공식 문서 근거 (2026-07 검증):**
- **CAN-SPAM 요건** — 상업 이메일은 발송인 물리주소 + 수신거부 수단이 필수이며, 시스템이 발송 전 반환주소·수신거부 링크를 자동 검증한다. [CAN-SPAM Requirements](https://help.salesforce.com/s/articleView?language=en_US&id=mktg.mc_es_can_spam_requirements.htm&type=5)
- **물리주소 필드** — `%%Member_Busname%% %%Member_Addr%% %%Member_City%% %%Member_State%% %%Member_PostalCode%% %%Member_Country%%` = 계정 Account Information 값. [AMPscript Sender Strings](https://developer.salesforce.com/docs/marketing/marketing-cloud-ampscript/guide/mc-ampscript-guide-language-basics-personalization-strings-sender.html) · [Headers and Footers](https://help.salesforce.com/apex/HTViewHelpDoc?id=mc_overview_headers_and_footers.htm)
- **수신거부/프로필** — `%%unsub_center_url%%`(수신거부 서비스 링크) · `%%profile_center_url%%`(프로필센터 링크). 표준 헤더·푸터에 기본 포함되는 CAN-SPAM 요소. [Headers and Footers](https://help.salesforce.com/apex/HTViewHelpDoc?id=mc_overview_headers_and_footers.htm)
- **오픈 추적** — 1x1 추적 픽셀은 모든 이메일에 자동 삽입되지만 **HTML-Paste 템플릿은 예외 → `opencounter` 수동 삽입 필수.** 우리 에셋은 `kind=paste`라 반드시 넣는다. [Tracking in Email Studio](https://help.salesforce.com/s/articleView?id=mktg.mc_es_tracking_overview.htm&language=en_US&type=5)
- **개인화 문자열 규격** — `%%...%%`(2중 퍼센트), 안전 처리는 AMPscript `AttributeValue()`. [Personalization Strings](https://help.salesforce.com/s/articleView?id=sf.mc_es_personalization_strings.htm&language=en_US&type=5)

## 5. 이미지 (C: Content Builder 업로드 → publish URL)

실사 이미지를 쓸 때. (없으면 이모지형 A로 완성)

1. **업로드** — `sfmc_create_content_builder_asset`:
   ```jsonc
   { "assetType":{"id":28,"name":"png"},   // jpg=23, jpeg=22, gif=20
     "name":"...", "category":{"id":<image_folder_category_id>},
     "file":"<base64>" }
   ```
2. 응답 **`fileProperties.publishedURL`** 을 이미지 슬롯에 사용.
3. ⚠️ **http→https** — publishedURL이 `http://`면 프로토콜만 `https://`로. (도메인은 계정별 — `<확인필요: 계정 이미지 도메인>`)
4. ⚠️ **고객사 CDN 직링크 금지(실발송).** 홈페이지 이미지는 반드시 다운로드→Content Builder 업로드 후 우리 URL로 교체(고객사가 원본을 바꾸면 발송본이 깨짐).
5. 이미지 규칙: `alt` 필수 · `width`+`max-width:100%`+`height:auto` · 이미지-only 금지(텍스트·푸터 유지).

## 6. 에셋 생성 (검증된 방법)

- 도구: **`sfmc_create_content_builder_asset`** (`assetType {id:208,name:"htmlemail"}`).
  ⚠️ `sfmc_create_email` 헬퍼는 `30000` 오류 이력 → 우회. ([`error-log.md`](../error-log.md))
- 폴더: **하드코딩 금지.** `sfmc_get_content_categories`로 현재 BU 폴더 확인.
  BU마다 다름 — 어떤 BU엔 `MCE-Package` 전용 폴더가 있고 어떤 BU엔 루트만 있다. **활성 BU에서 반드시 재확인 후 사용**(폴더 ID는 계정마다 다른 값).
- `views.subjectline.content`=제목, `views.html.content`=완성 HTML.
- 성공(201) 응답 **`data.email.legacy.legacyId`** = 저니 이메일 액티비티 `emailId`.

## 7. 재사용 우선

신규 생성 전 항상 기존 에셋을 먼저 검색해 재사용한다([`email-standard.md`](../email-standard.md) §콘텐츠 선택 정책). 없을 때만 위 절차로 신규 생성.
