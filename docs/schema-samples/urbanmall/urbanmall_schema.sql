-- ==========================================================================
-- UrbanMall(어반몰) — 고객 제공 스키마 (DDL 형태)
-- 산업군: 일반 이커머스 (패션 쇼핑몰)
--
-- ※ 교육/데모용으로 프로그램이 생성한 가상(합성) 데이터입니다.
--   실존 기업·인물과 무관하며, 이메일은 IANA 예약 도메인(example.com/net/org),
--   휴대폰은 미할당 국번(010-0000-xxxx)만 사용해 실제 발송이 도달하지 않습니다.
--
-- STEP 0 스키마 분석 입력용 · 원천 5개 엔티티
--   회원 / 상품 / 주문 / 주문상세 / 쿠폰
-- DBMS: MySQL 8 방언 가정 (COMMENT 로 컬럼 의미 힌트 포함)
-- 기준일: 2026-09-04 · 회원 10,000명
-- 관계도: ../../onboarding-kit/작성예시_어반몰/ERD_urbanmall.svg 와 동일
-- ==========================================================================

-- 1) 회원                                             파일: MEMBER_INFO.csv
CREATE TABLE MEMBER_INFO (
  MBR_ID             BIGINT       NOT NULL COMMENT '회원ID(PK) — 전 테이블 조인키, Contact Key', -- ↔ member_id
  MBR_EMAIL          VARCHAR(120)          COMMENT '이메일 주소',                   -- ↔ email
  HP_NO              VARCHAR(20)           COMMENT '휴대폰 번호',                   -- ↔ phone
  BIRTH_YMD          DATE                  COMMENT '생년월일',                      -- ↔ birthday
  MBR_GRD            VARCHAR(10)           COMMENT '회원 등급(VIP/GOLD/BASIC) — 누적 실결제액 기준', -- ↔ grade
  ADDR_CITY          VARCHAR(20)           COMMENT '거주 시/도',                    -- ↔ region
  REG_DTM            DATETIME              COMMENT '가입일시',                      -- ↔ signup_date
  LST_LOGIN_DTM      DATETIME              COMMENT '최종 로그인 일시 — 휴면 판정용', -- ↔ last_login_date
  EML_AGREE_YN       CHAR(1)               COMMENT '이메일 수신동의(Y/N) — 문자값',  -- ↔ email_consent
  SMS_AGREE_YN       CHAR(1)               COMMENT 'SMS/알림톡 수신동의(Y/N) — 문자값', -- ↔ sms_consent
  BASKET_YN          CHAR(1)               COMMENT '장바구니 보유 여부(Y/N)',       -- ↔ has_abandoned_cart
  BASKET_AMT         DECIMAL(12,0)         COMMENT '장바구니 담긴 금액(원)',        -- ↔ cart_total_amount
  MILEAGE            DECIMAL(12,0)         COMMENT '마일리지 잔액(원)',             -- ↔ points_balance
  MILEAGE_EXP_YMD    DATE                  COMMENT '마일리지 만료 예정일',          -- ↔ points_expire_date
  PRIMARY KEY (MBR_ID)
) COMMENT '회원 마스터 — 1행 = 1고객';

-- 2) 상품                                             파일: ITEM_MST.csv
CREATE TABLE ITEM_MST (
  ITEM_CD            VARCHAR(20)  NOT NULL COMMENT '상품코드(PK) UM-{카테고리}-{일련}', -- ↔ product_id
  ITEM_NM            VARCHAR(120)          COMMENT '상품명 (컬러 포함)',            -- ↔ product_name
  CAT_NM             VARCHAR(20)           COMMENT '카테고리명(상의/하의/아우터/신발/액세서리)', -- ↔ category
  SELL_PRC           DECIMAL(12,0)         COMMENT '판매 정가(원)',                 -- ↔ list_price
  PRIMARY KEY (ITEM_CD)
) COMMENT '상품 마스터';

-- 3) 주문                                             파일: ORDER_MST.csv
CREATE TABLE ORDER_MST (
  ORDER_ID           VARCHAR(20)  NOT NULL COMMENT '주문번호(PK) U{YYMMDD}-{일련}',  -- ↔ order_id
  MBR_ID             BIGINT                COMMENT '회원ID(FK→MEMBER_INFO)',        -- ↔ member_id
  ORDER_DTM          DATETIME              COMMENT '주문일시',                      -- ↔ order_date
  PAY_AMT            DECIMAL(12,0)         COMMENT '실결제액(할인 반영 후, 원)',    -- ↔ order_amount
  ORDER_STATUS       VARCHAR(12)           COMMENT '주문상태(COMPLETE 구매확정/CANCELED 취소/RETURNED 반품)',
  PRIMARY KEY (ORDER_ID),
  KEY IX_ORDER_MBR (MBR_ID)
) COMMENT '주문 마스터 — 누적 구매액·최근 구매일 산출 원천. ⚠️ CANCELED/RETURNED 는 실적에서 제외';

-- 4) 주문상세                                         파일: ORDER_ITEM.csv
CREATE TABLE ORDER_ITEM (
  ORDER_ITEM_SEQ     BIGINT       NOT NULL COMMENT '주문상세 일련번호(PK)',
  ORDER_ID           VARCHAR(20)           COMMENT '주문번호(FK→ORDER_MST)',
  ITEM_CD            VARCHAR(20)           COMMENT '상품코드(FK→ITEM_MST)',
  ORD_QTY            INT                   COMMENT '주문 수량',                     -- ↔ quantity
  UNIT_PRC           DECIMAL(12,0)         COMMENT '판매단가(시즌 할인 반영, 원)',  -- ↔ unit_price
  PRIMARY KEY (ORDER_ITEM_SEQ),
  KEY IX_ITEM_ORDER (ORDER_ID),
  KEY IX_ITEM_CD (ITEM_CD)
) COMMENT '주문상세 — 선호 카테고리 도출 원천(ITEM_MST 조인)';

-- 5) 쿠폰 발급                                        파일: COUPON_ISSUE.csv
CREATE TABLE COUPON_ISSUE (
  COUPON_ID          VARCHAR(20)  NOT NULL COMMENT '쿠폰번호(PK)',                   -- ↔ coupon_id
  MBR_ID             BIGINT                COMMENT '회원ID(FK→MEMBER_INFO)',        -- ↔ member_id
  ISSUE_YMD          DATE                  COMMENT '발급일',                        -- ↔ coupon_issue_date
  EXPIRE_YMD         DATE                  COMMENT '만료일 — 만료 임박 캠페인 트리거', -- ↔ coupon_expire_date
  USED_YN            CHAR(1)               COMMENT '사용 여부(Y/N) — 문자값',        -- ↔ coupon_used
  PRIMARY KEY (COUPON_ID),
  KEY IX_CPN_MBR (MBR_ID)
) COMMENT '쿠폰 발급 이력 — 미사용 유효쿠폰 수 산출 원천';

-- ==========================================================================
-- 관계 요약
--   MEMBER_INFO 1:N ORDER_MST   (MBR_ID)
--   ORDER_MST   1:N ORDER_ITEM  (ORDER_ID)
--   ITEM_MST    1:N ORDER_ITEM  (ITEM_CD)
--   MEMBER_INFO 1:N COUPON_ISSUE(MBR_ID)
--   Contact Key = MBR_ID
--
-- 값 해석 규칙 (STEP 0 HITL 확정 대상)
--   · *_YN 은 Boolean 이 아니라 CHAR(1) 문자 'Y'/'N' 이다 — SQL 비교 시 = 'Y' 로 쓴다
--   · 누적 구매액/최근 구매일은 ORDER_STATUS = 'COMPLETE' 만 집계 (취소·반품 제외)
--   · 수신 동의는 채널별로 분리 — 이메일 발송엔 EML_AGREE_YN, SMS/알림톡엔 SMS_AGREE_YN
--   · MILEAGE_EXP_YMD 는 과거일 수 있다(이미 만료) — 임박 판정은 0 <= 잔여일 <= 90
-- ==========================================================================
