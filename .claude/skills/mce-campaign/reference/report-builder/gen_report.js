// 분석 리포트 PPT 빌더 — report-guide.md §7 SSOT의 실행체.
// 사용: node gen_report.js <data.json> <out.pptx> [--brand <브랜드킷.json|고객사명|none>]
// 데이터 계약은 report-guide.md §6 + sample-data.json 참조. 레이아웃은 여기 고정 —
// 진단 데이터(JSON)만 바꾸면 항상 같은 품질로 나온다. 레이아웃 수정은 이 파일에서만.
//
// ⭐ 색·폰트·로고는 여기 하드코딩하지 않는다. 이메일과 **같은 브랜드 킷 1개**
//    (email-template/<고객사>.json)를 읽어 디자인 토큰을 파생한다 → report-guide.md §5.
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const argv = process.argv.slice(2);
const brandArgIdx = argv.indexOf("--brand");
const brandArg = brandArgIdx >= 0 ? argv[brandArgIdx + 1] : null;
const positional = argv.filter((a, i) => brandArgIdx < 0 || (i !== brandArgIdx && i !== brandArgIdx + 1));
const dataPath = positional[0];
const outPath = positional[1];
if (!dataPath || !outPath) { console.error("usage: node gen_report.js <data.json> <out.pptx> [--brand <kit.json|고객사명|none>]"); process.exit(1); }
const D = JSON.parse(fs.readFileSync(path.resolve(dataPath), "utf8"));

// ===================================================================
// 브랜드 킷 해석 (이메일·리포트 공통 SSOT)
// 우선순위: --brand > data.json meta.brandKit > _template-guide.md 활성 고객사 > 중립 기본
// ===================================================================
const REF_DIR = path.resolve(__dirname, "..");
const KIT_DIR = path.join(REF_DIR, "email-template");
const ACTIVE_JSON = path.join(REF_DIR, "active-customer.json");
const GUIDE_MD = path.join(KIT_DIR, "_template-guide.md");

function kitPathFrom(ref, baseDir) {
  if (!ref) return null;
  const cands = /\.json$/i.test(ref)
    ? [path.resolve(baseDir, ref), path.resolve(process.cwd(), ref), path.join(KIT_DIR, path.basename(ref))]
    : [path.join(KIT_DIR, ref + ".json")];
  return cands.find(fs.existsSync) || null;
}
// 활성 고객사 선언(reference/active-customer.json) — 분석 가이드·브랜드 킷 공통 단일 스위치.
function readActiveCustomer() {
  if (!fs.existsSync(ACTIVE_JSON)) return null;
  try { return JSON.parse(fs.readFileSync(ACTIVE_JSON, "utf8")); }
  catch (e) { console.error(`active-customer.json 파싱 실패: ${e.message}`); process.exit(1); }
}
// (레거시) _template-guide.md 의 **활성 고객사: `<파일명>`** 줄 — active-customer.json 이 없을 때만.
function activeKitFromGuide() {
  if (!fs.existsSync(GUIDE_MD)) return null;
  const m = fs.readFileSync(GUIDE_MD, "utf8").match(/활성 고객사:\s*`([^`]+)`/);
  if (!m) return null;
  const ref = m[1].trim();
  if (!ref || ref.startsWith("<")) return null;   // <확인필요: ...> = 미해소
  return kitPathFrom(ref, KIT_DIR);
}

let brandPath = null, brandSource = "";
if (brandArg && brandArg !== "none") {
  brandPath = kitPathFrom(brandArg, process.cwd());
  if (!brandPath) { console.error(`브랜드 킷을 찾을 수 없습니다: --brand ${brandArg}`); process.exit(1); }
  brandSource = "--brand";
} else if (!brandArg && D.meta && D.meta.brandKit) {
  brandPath = kitPathFrom(D.meta.brandKit, path.dirname(path.resolve(dataPath)));
  if (!brandPath) { console.error(`브랜드 킷을 찾을 수 없습니다: meta.brandKit = ${D.meta.brandKit}`); process.exit(1); }
  brandSource = "meta.brandKit";
}

// 활성 고객사 선언은 지정이 없을 때의 기본이자, 지정이 있을 때의 대조 기준이다.
const AC = readActiveCustomer();
const acKitPath = AC && AC.brand_kit ? kitPathFrom(AC.brand_kit, REF_DIR) : null;
if (AC && AC.brand_kit && !acKitPath) {
  console.error(`활성 고객사 '${AC.customer}'의 브랜드 킷을 찾을 수 없습니다: active-customer.json → brand_kit = ${AC.brand_kit}`);
  console.error(`킷을 만들거나(email-template/_example-brand.json 복제) active-customer.json 의 brand_kit 을 고친 뒤 다시 실행하세요.`);
  process.exit(1);
}
if (!brandPath && !brandArg) {
  if (acKitPath) { brandPath = acKitPath; brandSource = `활성 고객사 ${AC.customer}`; }
  else if (!AC) {   // active-customer.json 이 없는 구버전 설치
    brandPath = activeKitFromGuide();
    if (brandPath) { brandSource = "_template-guide.md 활성 고객사(레거시)"; console.warn("[brand] 활성 고객사 선언을 reference/active-customer.json 으로 옮기세요(레거시 경로 사용 중)."); }
  }
}
// 브랜드를 명시 지정했는데 활성 고객사 킷과 다르면 — 다른 고객사 브랜드로 나가는 사고를 눈에 보이게 한다.
if (brandPath && acKitPath && path.resolve(brandPath) !== path.resolve(acKitPath)) {
  console.warn(`[brand] ⚠️ 활성 고객사(${AC.customer}: ${path.basename(acKitPath)}) 와 다른 브랜드로 생성합니다 → ${path.basename(brandPath)}`);
}
if (brandArg === "none" && acKitPath) console.warn(`[brand] --brand none — 활성 고객사(${AC.customer}) 킷을 무시하고 중립 팔레트로 생성합니다.`);
if (brandArg !== "none" && !brandPath && AC && !AC.brand_kit) {
  console.warn(`[brand] 활성 고객사 '${AC.customer}'에 브랜드 킷이 없습니다 — 중립 팔레트로 생성합니다. 고객사 전달용이면 email-template/<고객사>.json 을 만들고 active-customer.json 의 brand_kit 에 지정하세요.`);
}
const BRAND = brandPath ? JSON.parse(fs.readFileSync(brandPath, "utf8")) : null;

// ---- 색 유틸 (결정적 파생 — 임의 색 생성 아님) ----
const hx = c => String(c == null ? "" : c).replace(/^#/, "").trim().toUpperCase();
const ok = c => /^[0-9A-F]{6}$/.test(c);
const rgb = c => [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
const hex = a => a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();
const mixTo = (c, t, tg) => hex(rgb(c).map((v, i) => v + (tg[i] - v) * t));
const tint = (c, t) => mixTo(c, t, [255, 255, 255]);   // 흰색 쪽으로
const shade = (c, t) => mixTo(c, t, [0, 0, 0]);        // 검정 쪽으로
const lum = c => { const [r, g, b] = rgb(c).map(v => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const firstFont = stack => {
  const f = String(stack || "").split(",")[0].replace(/['"]/g, "").trim();
  return f || null;
};

// ---- 디자인 토큰 (report-guide §2 SSOT) ----
// 브랜드 킷이 없으면 아래 중립 기본값(검증 샘플과 동일)을 그대로 쓴다.
const NEUTRAL = {
  INK: "1A2238", INK_BG: "141B2E", TEXT: "2B3245", MUTE: "6B7280",
  LINE: "E5E8EE", CARD: "F7F8FB", ACCENT: "0E9F8E", ACCENT_SOFT: "E7F4F1",
  ACCENT_DARK: "0B3F39", ACCENT_TEXT: "154A44", WHITE: "FFFFFF",
  BAR_REST: "B7BFD0",                        // 강조 외 막대
  TOP_TINT: "F1F8F6", TOP_LINE: "CBE4DE",    // 우선순위 상위 3행
  CHIP_BG: "F0F2F7",                         // 분모 칩
  TRACK: "D9DEE8",                           // 스택바 트랙
  SHADOW: "9AA0AE",                          // 카드 그림자
  // 다크 슬라이드 전용
  DK_KICKER: "6FD8C9", DK_META: "8B93A8", DK_LINE: "3A425A",
  DK_BODY: "C7CCDA", DK_SUB: "B8C0D0", DK_RING: "222C47",
  DK_STAT: "B9C2D6", DK_STAT_LBL: "6E7891", DK_VALUE: "EEF0F5",
  FONT: "맑은 고딕",
};

// 브랜드 킷 → 리포트 토큰 파생 (매핑·계수는 report-guide.md §5 표와 1:1)
function tokensFromBrand(b) {
  const R = b.report || {};
  const C = b.colors || {};
  const ACCENT = hx(R.accent || C.accent);
  const INK = hx(R.ink || C.text);
  if (!ok(ACCENT) || !ok(INK)) {
    console.error(`브랜드 킷에 리포트 필수 색이 없습니다 (${path.basename(brandPath)}): colors.accent · colors.text(또는 report.accent · report.ink)`);
    process.exit(1);
  }
  // 대비 가드 — 밝은 색이 INK/ACCENT로 들어오면 슬라이드 가독성이 깨지므로 경고한다.
  if (lum(INK) > 0.45) console.warn(`[brand] INK(기본 colors.text=#${INK})가 밝아 제목·다크 슬라이드 대비가 낮습니다 — report.ink 에 진한 브랜드 컬러를 지정하세요.`);
  if (lum(ACCENT) > 0.72) console.warn(`[brand] ACCENT(#${ACCENT})가 밝아 흰 글자(순위 칩·CTA) 대비가 낮습니다 — report.accent 에 진한 톤을 지정하세요.`);
  const INK_BG = ok(hx(R.ink_bg)) ? hx(R.ink_bg) : shade(INK, 0.20);
  const MUTE = ok(hx(C.muted)) ? hx(C.muted) : tint(INK, 0.45);
  const t = {
    INK, INK_BG, TEXT: tint(INK, 0.10), MUTE,
    LINE: tint(INK, 0.90), CARD: tint(INK, 0.965), CHIP_BG: tint(INK, 0.94),
    TRACK: tint(INK, 0.84), BAR_REST: tint(INK, 0.70), SHADOW: tint(INK, 0.60),
    ACCENT, ACCENT_SOFT: tint(ACCENT, 0.90), ACCENT_DARK: shade(ACCENT, 0.60),
    ACCENT_TEXT: shade(ACCENT, 0.52), TOP_TINT: tint(ACCENT, 0.955), TOP_LINE: tint(ACCENT, 0.80),
    WHITE: "FFFFFF",
    DK_KICKER: tint(ACCENT, 0.42), DK_META: tint(INK_BG, 0.53), DK_LINE: tint(INK_BG, 0.18),
    DK_BODY: tint(INK_BG, 0.78), DK_SUB: tint(INK_BG, 0.73), DK_RING: tint(INK_BG, 0.08),
    DK_STAT: tint(INK_BG, 0.74), DK_STAT_LBL: tint(INK_BG, 0.42), DK_VALUE: tint(INK_BG, 0.93),
    FONT: R.font || firstFont(b.font_stack) || NEUTRAL.FONT,
  };
  // report.tokens 로 개별 토큰 직접 지정 가능 (파생값을 쓰지 않고 브랜드 지정값을 쓸 때)
  Object.entries(R.tokens || {}).forEach(([k, v]) => { if (ok(hx(v))) t[k] = hx(v); });
  return t;
}

const T = BRAND ? tokensFromBrand(BRAND) : NEUTRAL;
const {
  INK, INK_BG, TEXT, MUTE, LINE, CARD, ACCENT, ACCENT_SOFT, ACCENT_DARK, ACCENT_TEXT,
  WHITE, BAR_REST, TOP_TINT, TOP_LINE, CHIP_BG, TRACK, SHADOW,
  DK_KICKER, DK_META, DK_LINE, DK_BODY, DK_SUB, DK_RING, DK_STAT, DK_STAT_LBL, DK_VALUE,
} = T;
const F = T.FONT;

// 표지 로고: data.json meta.logo 가 없으면 브랜드 킷 report.logo(로컬 경로) 사용
if (!D.meta.logo && BRAND && BRAND.report && BRAND.report.logo && BRAND.report.logo.path) {
  const L = BRAND.report.logo;
  const lp = path.resolve(path.dirname(brandPath), L.path);
  if (fs.existsSync(lp)) D.meta.logo = Object.assign({}, L, { path: lp });
  else console.warn(`[brand] report.logo.path 파일 없음 — 표지 로고 생략: ${L.path}`);
}
console.log(BRAND
  ? `[brand] ${BRAND.brand_name || path.basename(brandPath, ".json")} (${brandSource}: ${path.basename(brandPath)}) · accent #${ACCENT} · font ${F}`
  : "[brand] 브랜드 킷 없음 — 중립 기본 팔레트로 생성");
if (BRAND && !D.meta.logo) console.warn("[brand] 표지 로고 미주입 — meta.logo 또는 브랜드 킷 report.logo(로컬 파일)를 지정하면 표지에 들어갑니다.");

const W = 13.333, H = 7.5, MX = 0.7, CW = W - 2 * MX;
const FOOT_Y = 7.06;

const p = new pptxgen();
p.defineLayout({ name: "WIDE", width: W, height: H });
p.layout = "WIDE";

const shadow = () => ({ type: "outer", color: SHADOW, blur: 8, offset: 3, angle: 90, opacity: 0.10 });
const num = n => n.toLocaleString("en-US");

// ---- 공통 요소 ----
function dot(s, x, y, size) { const d = size || 0.12; s.addShape(p.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: ACCENT } }); }
function kicker(s, t, darkMode) {
  dot(s, MX, 0.545);
  s.addText(t, { x: MX + 0.24, y: 0.42, w: 8, h: 0.36, fontFace: F, fontSize: 12, bold: true, color: darkMode ? DK_KICKER : ACCENT, charSpacing: 2, margin: 0 });
}
// 제목 = 주제형(명사) + 부제 = 결론 한 줄 (report-guide §0-1)
function title(s, t) {
  s.addText(t, { x: MX, y: 0.78, w: CW, h: 0.52, fontFace: F, fontSize: 27, bold: true, color: INK, lineSpacing: 33, margin: 0 });
}
function subtitle(s, t) {
  s.addText(t, { x: MX, y: 1.34, w: CW, h: 0.32, fontFace: F, fontSize: 13.5, color: TEXT, margin: 0 });
}
// 본문 슬라이드 하단 러닝 푸터: 좌 = 각주(없으면 리포트명·기준일), 우 = 페이지
function footer(s, pageNo, noteText) {
  const left = noteText || `${D.meta.title} · 기준일 ${D.meta.baseDate}`;
  s.addText(left, { x: MX, y: FOOT_Y, w: 11.0, h: 0.3, fontFace: F, fontSize: 8.5, color: MUTE, margin: 0, valign: "middle" });
  s.addText(String(pageNo), { x: W - MX - 0.6, y: FOOT_Y, w: 0.6, h: 0.3, fontFace: F, fontSize: 9, color: MUTE, align: "right", margin: 0, valign: "middle" });
}
// JSON rich-text runs → pptxgenjs runs
function runs(arr, opt) {
  const o = opt || {};
  return arr.map(r => ({
    text: r.t,
    options: { bold: !!r.b, color: r.accent ? (o.accentColor || ACCENT) : (r.b ? (o.boldColor || INK) : (o.baseColor || TEXT)) },
  }));
}
function insightBox(s, x, y, w, h, text) {
  s.addShape(p.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: ACCENT_SOFT }, line: { color: ACCENT_SOFT, width: 0 } });
  s.addText([
    { text: "해석.  ", options: { bold: true, color: ACCENT_DARK } },
    { text, options: { color: ACCENT_TEXT } },
  ], { x: x + 0.28, y: y + 0.1, w: w - 0.56, h: h - 0.2, fontFace: F, fontSize: 11.5, lineSpacing: 16, valign: "middle", margin: 0 });
}
// 동심원 모티프 (다크 슬라이드 시각 앵커)
function rings(s, cx, cy, sizes, dotAngleY) {
  sizes.forEach(d => s.addShape(p.ShapeType.ellipse, {
    x: cx - d / 2, y: cy - d / 2, w: d, h: d, fill: { type: "none" }, line: { color: DK_RING, width: 1.25 },
  }));
  if (dotAngleY !== undefined) dot(s, cx - 0.07, dotAngleY, 0.14);
}

// ===================================================================
// Slide 1 — 표지 (다크)
// ===================================================================
{
  const s = p.addSlide();
  s.background = { color: INK_BG };
  rings(s, 11.95, 6.15, [3.6, 2.5, 1.4], 4.28);

  if (D.meta.sample) {
    s.addShape(p.ShapeType.roundRect, { x: MX, y: 1.52, w: 1.05, h: 0.34, rectRadius: 0.06, fill: { type: "none" }, line: { color: ACCENT, width: 1 } });
    s.addText("SAMPLE", { x: MX, y: 1.52, w: 1.05, h: 0.34, fontFace: F, fontSize: 10, bold: true, color: ACCENT, align: "center", valign: "middle", charSpacing: 1.5, margin: 0 });
  }
  dot(s, MX, 2.2);
  s.addText(D.meta.kicker, { x: MX + 0.24, y: 2.07, w: 9, h: 0.36, fontFace: F, fontSize: 12, bold: true, color: DK_KICKER, charSpacing: 3, margin: 0 });
  s.addText(D.meta.title, { x: MX, y: 2.5, w: 11.6, h: 1.3, fontFace: F, fontSize: 40, bold: true, color: WHITE, lineSpacing: 48, margin: 0 });
  if (D.meta.subtitle) s.addText(D.meta.subtitle, { x: MX, y: 3.72, w: 10.8, h: 0.45, fontFace: F, fontSize: 15.5, color: DK_SUB, margin: 0 });

  if (D.meta.logo) s.addImage({ path: D.meta.logo.path, x: D.meta.logo.x || 11.5, y: D.meta.logo.y || 0.6, w: D.meta.logo.w, h: D.meta.logo.h });

  s.addShape(p.ShapeType.line, { x: MX, y: 5.72, w: CW, h: 0, line: { color: DK_LINE, width: 1 } });
  const meta = [["모수", D.meta.population], ["기준일", D.meta.baseDate], ["업종", D.meta.industry], ["분석 소스", D.meta.source]];
  meta.forEach(([k, v], i) => {
    const x = MX + i * 2.85;
    s.addText(k, { x, y: 5.96, w: 2.6, h: 0.28, fontFace: F, fontSize: 10.5, color: DK_META, charSpacing: 1, margin: 0 });
    s.addText(v, { x, y: 6.26, w: 2.6, h: 0.4, fontFace: F, fontSize: 17, bold: true, color: DK_VALUE, margin: 0 });
  });
}

// ===================================================================
// Slide 2 — 핵심 요약
// ===================================================================
{
  const s = p.addSlide(); s.background = { color: WHITE };
  const S = D.summary;
  kicker(s, "01");
  title(s, S.title);
  subtitle(s, S.subtitle);
  s.addText(runs(S.narrative), { x: MX, y: 1.86, w: CW, h: 0.88, fontFace: F, fontSize: 14, color: TEXT, lineSpacing: 22, margin: 0 });

  const fw = (CW - 2 * 0.35) / 3;
  S.stats.forEach((st, i) => {
    const x = MX + i * (fw + 0.35), y = 2.9;
    s.addShape(p.ShapeType.roundRect, { x, y, w: fw, h: 2.3, rectRadius: 0.1, fill: { color: CARD }, line: { color: LINE, width: 1 }, shadow: shadow() });
    s.addText([
      { text: st.value, options: { fontSize: 52, bold: true, color: INK } },
      { text: st.unit, options: { fontSize: 22, bold: true, color: ACCENT } },
    ], { x: x + 0.3, y: y + 0.22, w: fw - 0.6, h: 0.95, fontFace: F, margin: 0 });
    s.addText(st.label, { x: x + 0.3, y: y + 1.22, w: fw - 0.6, h: 0.3, fontFace: F, fontSize: 12.5, bold: true, color: INK, margin: 0 });
    s.addShape(p.ShapeType.line, { x: x + 0.3, y: y + 1.6, w: fw - 0.6, h: 0, line: { color: LINE, width: 0.75 } });
    s.addText(st.sub, { x: x + 0.3, y: y + 1.7, w: fw - 0.6, h: 0.52, fontFace: F, fontSize: 10.5, color: MUTE, lineSpacing: 14, margin: 0 });
  });

  // 권장 우선순위 밴드
  const by = 5.48, bh = 1.28;
  s.addShape(p.ShapeType.roundRect, { x: MX, y: by, w: CW, h: bh, rectRadius: 0.1, fill: { color: CARD }, line: { color: LINE, width: 1 } });
  s.addText("권장 우선순위", { x: MX + 0.32, y: by + 0.14, w: 4, h: 0.28, fontFace: F, fontSize: 10.5, bold: true, color: MUTE, charSpacing: 1.5, margin: 0 });
  const iw = (CW - 0.64) / 3;
  S.priority.forEach((pr, i) => {
    const x = MX + 0.32 + i * iw;
    s.addShape(p.ShapeType.ellipse, { x, y: by + 0.55, w: 0.34, h: 0.34, fill: { color: ACCENT } });
    s.addText(String(i + 1), { x, y: by + 0.55, w: 0.34, h: 0.34, fontFace: F, fontSize: 12, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });
    s.addText(pr.name, { x: x + 0.48, y: by + 0.5, w: iw - 1.0, h: 0.3, fontFace: F, fontSize: 14, bold: true, color: INK, margin: 0 });
    s.addText(pr.why, { x: x + 0.48, y: by + 0.82, w: iw - 1.0, h: 0.26, fontFace: F, fontSize: 10.5, color: MUTE, margin: 0 });
    if (i < S.priority.length - 1) s.addText("→", { x: x + iw - 0.5, y: by + 0.52, w: 0.4, h: 0.36, fontFace: F, fontSize: 16, color: BAR_REST, margin: 0 });
  });
  footer(s, 2, S.footnote);
}

// ===================================================================
// Slide 3 — 고객 기반 구조 (퍼널 + 도달 가능성)
// ===================================================================
{
  const s = p.addSlide(); s.background = { color: WHITE };
  const B = D.base;
  kicker(s, "02");
  title(s, B.title);
  subtitle(s, B.subtitle);

  // 좌: 재구매 퍼널
  const fx = MX, fwMax = 5.9;
  const maxV = B.funnel[0].value;
  let fy = 2.0;
  B.funnel.forEach((st, i) => {
    if (st.conv) {
      s.addText([
        { text: "▾  ", options: { color: ACCENT, bold: true } },
        { text: st.conv, options: { color: MUTE } },
      ], { x: fx + 0.05, y: fy, w: 4, h: 0.26, fontFace: F, fontSize: 10.5, bold: true, margin: 0 });
      fy += 0.32;
    }
    s.addText(st.label, { x: fx, y: fy, w: 4.4, h: 0.24, fontFace: F, fontSize: 11.5, color: MUTE, margin: 0 });
    s.addText(st.display, { x: fx + 4.4, y: fy, w: fwMax - 4.4, h: 0.24, fontFace: F, fontSize: 13, bold: true, color: INK, align: "right", margin: 0 });
    const bw = Math.max(0.6, fwMax * (st.value / maxV));
    s.addShape(p.ShapeType.roundRect, { x: fx, y: fy + 0.28, w: bw, h: 0.5, rectRadius: 0.05, fill: { color: i === B.funnel.length - 1 ? ACCENT : INK }, line: { color: WHITE, width: 0 } });
    fy += 0.86;
  });

  // 우: 도달 가능성 패널
  const rx = 7.0, rw = W - MX - rx, ry = 2.0, rh = 2.98;
  const R = B.reach;
  s.addShape(p.ShapeType.roundRect, { x: rx, y: ry, w: rw, h: rh, rectRadius: 0.1, fill: { color: CARD }, line: { color: LINE, width: 1 }, shadow: shadow() });
  s.addText(R.title, { x: rx + 0.3, y: ry + 0.2, w: rw - 0.6, h: 0.28, fontFace: F, fontSize: 12.5, bold: true, color: MUTE, charSpacing: 1, margin: 0 });
  s.addText([
    { text: R.reachableDisplay, options: { fontSize: 30, bold: true, color: INK } },
    { text: `   (${R.reachablePct})`, options: { fontSize: 14, bold: true, color: ACCENT } },
  ], { x: rx + 0.3, y: ry + 0.52, w: rw - 0.6, h: 0.55, fontFace: F, margin: 0 });
  const tot = R.reachable + R.unreachable, bw2 = rw - 0.6;
  s.addShape(p.ShapeType.roundRect, { x: rx + 0.3, y: ry + 1.24, w: bw2, h: 0.4, rectRadius: 0.04, fill: { color: TRACK }, line: { color: TRACK, width: 0 } });
  s.addShape(p.ShapeType.roundRect, { x: rx + 0.3, y: ry + 1.24, w: bw2 * (R.reachable / tot), h: 0.4, rectRadius: 0.04, fill: { color: INK }, line: { color: INK, width: 0 } });
  s.addShape(p.ShapeType.ellipse, { x: rx + 0.3, y: ry + 1.82, w: 0.11, h: 0.11, fill: { color: INK } });
  s.addText(`도달 가능 ${R.reachableDisplay}`, { x: rx + 0.48, y: ry + 1.73, w: 2.6, h: 0.28, fontFace: F, fontSize: 10.5, color: TEXT, margin: 0 });
  s.addShape(p.ShapeType.ellipse, { x: rx + 3.1, y: ry + 1.82, w: 0.11, h: 0.11, fill: { color: TRACK } });
  s.addText(`미동의 ${R.unreachableDisplay}`, { x: rx + 3.28, y: ry + 1.73, w: 2.3, h: 0.28, fontFace: F, fontSize: 10.5, color: TEXT, margin: 0 });
  s.addText(R.note, { x: rx + 0.3, y: ry + 2.12, w: rw - 0.6, h: 0.75, fontFace: F, fontSize: 10.5, color: MUTE, lineSpacing: 14, margin: 0 });

  insightBox(s, MX, 5.3, CW, 1.15, B.insight);
  footer(s, 3, B.footnote);
}

// ===================================================================
// Slide 4 — 세그먼트 진단 (바 테이블)
// ===================================================================
{
  const s = p.addSlide(); s.background = { color: WHITE };
  const G = D.segments;
  kicker(s, "03");
  title(s, G.title);
  subtitle(s, G.subtitle);

  const hy = 1.84;
  const bx = 3.05, bwMax = 5.6, ratX = 10.15, chipX = 11.55;
  s.addText("세그먼트", { x: MX, y: hy, w: 2.2, h: 0.24, fontFace: F, fontSize: 10, bold: true, color: MUTE, charSpacing: 1, margin: 0 });
  s.addText("규모 (명)", { x: bx, y: hy, w: 3, h: 0.24, fontFace: F, fontSize: 10, bold: true, color: MUTE, charSpacing: 1, margin: 0 });
  s.addText("비율", { x: ratX, y: hy, w: 1.25, h: 0.24, fontFace: F, fontSize: 10, bold: true, color: MUTE, charSpacing: 1, align: "right", margin: 0 });
  s.addText("분모", { x: chipX, y: hy, w: 1.18, h: 0.24, fontFace: F, fontSize: 10, bold: true, color: MUTE, charSpacing: 1, align: "center", margin: 0 });
  s.addShape(p.ShapeType.line, { x: MX, y: hy + 0.32, w: CW, h: 0, line: { color: LINE, width: 1 } });

  const rows = [...G.rows].sort((a, b) => b.count - a.count);
  const maxC = rows[0].count;
  let ry2 = 2.3;
  rows.forEach(r => {
    const barW = Math.max(0.35, bwMax * (r.count / maxC));
    s.addText(r.label, { x: MX, y: ry2, w: 2.25, h: 0.34, fontFace: F, fontSize: 12.5, bold: true, color: r.top ? INK : TEXT, valign: "middle", margin: 0 });
    if (r.constraint) {
      s.addShape(p.ShapeType.roundRect, { x: bx, y: ry2 + 0.02, w: barW, h: 0.3, rectRadius: 0.04, fill: { color: WHITE }, line: { color: BAR_REST, width: 1, dashType: "dash" } });
    } else {
      s.addShape(p.ShapeType.roundRect, { x: bx, y: ry2 + 0.02, w: barW, h: 0.3, rectRadius: 0.04, fill: { color: r.top ? INK : BAR_REST }, line: { color: WHITE, width: 0 } });
    }
    s.addText(r.display, { x: bx + barW + 0.12, y: ry2, w: 1.05, h: 0.34, fontFace: F, fontSize: 11.5, bold: true, color: r.top ? INK : TEXT, valign: "middle", margin: 0 });
    s.addText(r.ratio, { x: ratX, y: ry2, w: 1.25, h: 0.34, fontFace: F, fontSize: 13.5, bold: r.top, color: r.top ? INK : TEXT, align: "right", valign: "middle", margin: 0 });
    s.addShape(p.ShapeType.roundRect, { x: chipX, y: ry2 + 0.035, w: 1.18, h: 0.27, rectRadius: 0.05, fill: { color: CHIP_BG }, line: { color: CHIP_BG, width: 0 } });
    s.addText(r.denom, { x: chipX, y: ry2 + 0.035, w: 1.18, h: 0.27, fontFace: F, fontSize: 8.5, color: MUTE, align: "center", valign: "middle", margin: 0 });
    ry2 += 0.58;
  });

  insightBox(s, MX, ry2 + 0.16, CW, 0.92, G.insight);
  footer(s, 4, G.footnote);
}

// ===================================================================
// Slide 5 — 기회 우선순위
// ===================================================================
{
  const s = p.addSlide(); s.background = { color: WHITE };
  const O = D.opportunities;
  kicker(s, "04");
  title(s, O.title);
  subtitle(s, O.subtitle);

  let by = 1.92;
  const bh = 0.74, pitch = 0.85;
  O.rows.forEach(r => {
    s.addShape(p.ShapeType.roundRect, {
      x: MX, y: by, w: CW, h: bh, rectRadius: 0.07,
      fill: { color: r.top ? TOP_TINT : WHITE }, line: { color: r.top ? TOP_LINE : LINE, width: 1 },
    });
    s.addText(r.rank, { x: MX + 0.24, y: by, w: 0.55, h: bh, fontFace: F, fontSize: 24, bold: true, color: r.top ? ACCENT : BAR_REST, valign: "middle", margin: 0 });
    s.addText(r.name, { x: MX + 0.88, y: by, w: 2.95, h: bh, fontFace: F, fontSize: 15, bold: true, color: INK, valign: "middle", margin: 0 });
    s.addShape(p.ShapeType.roundRect, { x: 4.6, y: by + (bh - 0.36) / 2, w: 1.85, h: 0.36, rectRadius: 0.06, fill: { color: WHITE }, line: { color: LINE, width: 1 } });
    s.addText(r.basis, { x: 4.6, y: by + (bh - 0.36) / 2, w: 1.85, h: 0.36, fontFace: F, fontSize: 10.5, bold: true, color: TEXT, align: "center", valign: "middle", margin: 0 });
    if (r.reachable) {
      s.addText(r.target, { x: 6.6, y: by + 0.08, w: 1.5, h: 0.3, fontFace: F, fontSize: 14, bold: true, color: INK, align: "right", margin: 0 });
      s.addText(`도달 ${r.reachable}`, { x: 6.6, y: by + 0.42, w: 1.5, h: 0.24, fontFace: F, fontSize: 9.5, color: MUTE, align: "right", margin: 0 });
    } else {
      s.addText(r.target, { x: 6.6, y: by, w: 1.5, h: bh, fontFace: F, fontSize: 14, bold: true, color: INK, align: "right", valign: "middle", margin: 0 });
    }
    s.addText(r.impact, { x: 8.35, y: by, w: 4.15, h: bh, fontFace: F, fontSize: 11, color: TEXT, lineSpacing: 13.5, valign: "middle", margin: 0 });
    by += pitch;
  });

  const ny = by + 0.08;
  s.addText(runs(O.narrative), { x: MX, y: ny, w: 8.5, h: 0.8, fontFace: F, fontSize: 12.5, color: TEXT, lineSpacing: 19, margin: 0 });
  if (O.stat) {
    s.addShape(p.ShapeType.roundRect, { x: 9.5, y: ny - 0.02, w: W - MX - 9.5, h: 0.82, rectRadius: 0.08, fill: { color: CARD }, line: { color: LINE, width: 1 } });
    s.addText(O.stat.value, { x: 9.72, y: ny + 0.08, w: 1.5, h: 0.6, fontFace: F, fontSize: 24, bold: true, color: INK, valign: "middle", margin: 0 });
    s.addText(O.stat.label, { x: 11.2, y: ny + 0.08, w: 1.55, h: 0.6, fontFace: F, fontSize: 9, color: MUTE, lineSpacing: 11.5, valign: "middle", margin: 0 });
  }
  footer(s, 5, O.footnote);
}

// ===================================================================
// Slide 6 — 핵심 캠페인 상세
// ===================================================================
{
  const s = p.addSlide(); s.background = { color: WHITE };
  const C = D.campaigns;
  kicker(s, "05");
  title(s, C.title);
  subtitle(s, C.subtitle);

  const fw = (CW - 2 * 0.35) / 3, cy = 1.88, ch = 4.98;
  C.cards.forEach((c, i) => {
    const x = MX + i * (fw + 0.35);
    s.addShape(p.ShapeType.roundRect, { x, y: cy, w: fw, h: ch, rectRadius: 0.1, fill: { color: CARD }, line: { color: LINE, width: 1 }, shadow: shadow() });
    s.addShape(p.ShapeType.ellipse, { x: x + 0.3, y: cy + 0.3, w: 0.4, h: 0.4, fill: { color: ACCENT } });
    s.addText(String(i + 1), { x: x + 0.3, y: cy + 0.3, w: 0.4, h: 0.4, fontFace: F, fontSize: 14, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });
    s.addText(c.name, { x: x + 0.86, y: cy + 0.28, w: fw - 1.12, h: 0.62, fontFace: F, fontSize: 16, bold: true, color: INK, lineSpacing: 19, valign: "top", margin: 0 });

    s.addText(c.target, { x: x + 0.3, y: cy + 1.0, w: fw - 0.6, h: 0.42, fontFace: F, fontSize: 23, bold: true, color: INK, margin: 0 });
    s.addText(c.targetSub, { x: x + 0.3, y: cy + 1.44, w: fw - 0.6, h: 0.26, fontFace: F, fontSize: 10.5, color: MUTE, margin: 0 });
    if (c.reachable) s.addText(`도달 가능 ${c.reachable}`, { x: x + 0.3, y: cy + 1.68, w: fw - 0.6, h: 0.24, fontFace: F, fontSize: 10.5, bold: true, color: ACCENT_DARK, margin: 0 });
    s.addShape(p.ShapeType.line, { x: x + 0.3, y: cy + 1.98, w: fw - 0.6, h: 0, line: { color: LINE, width: 0.75 } });

    s.addText("채널", { x: x + 0.3, y: cy + 2.06, w: 2, h: 0.2, fontFace: F, fontSize: 9.5, color: MUTE, charSpacing: 1, margin: 0 });
    let chx = x + 0.3;
    c.channels.forEach(chn => {
      const cw2 = 0.34 + chn.length * 0.16;
      s.addShape(p.ShapeType.roundRect, { x: chx, y: cy + 2.28, w: cw2, h: 0.32, rectRadius: 0.06, fill: { color: WHITE }, line: { color: LINE, width: 1 } });
      s.addText(chn, { x: chx, y: cy + 2.28, w: cw2, h: 0.32, fontFace: F, fontSize: 10, color: TEXT, align: "center", valign: "middle", margin: 0 });
      chx += cw2 + 0.12;
    });
    if (c.channelNote) s.addText(c.channelNote, { x: chx + 0.04, y: cy + 2.3, w: x + fw - chx - 0.3, h: 0.28, fontFace: F, fontSize: 9, color: MUTE, valign: "middle", margin: 0 });

    s.addText("메시지 방향", { x: x + 0.3, y: cy + 2.72, w: 2.5, h: 0.2, fontFace: F, fontSize: 9.5, color: MUTE, charSpacing: 1, margin: 0 });
    s.addText(c.message, { x: x + 0.3, y: cy + 2.94, w: fw - 0.6, h: 0.78, fontFace: F, fontSize: 11, color: TEXT, lineSpacing: 14.5, margin: 0 });

    s.addText("측정 지표", { x: x + 0.3, y: cy + 3.8, w: 2.5, h: 0.2, fontFace: F, fontSize: 9.5, color: MUTE, charSpacing: 1, margin: 0 });
    s.addText(c.kpi, { x: x + 0.3, y: cy + 4.02, w: fw - 0.6, h: 0.4, fontFace: F, fontSize: 10.5, color: TEXT, lineSpacing: 13.5, margin: 0 });

    s.addShape(p.ShapeType.roundRect, { x: x + 0.3, y: cy + 4.5, w: fw - 0.6, h: 0.38, rectRadius: 0.06, fill: { color: ACCENT_SOFT }, line: { color: ACCENT_SOFT, width: 0 } });
    s.addText(`기대효과 — ${c.impact}`, { x: x + 0.45, y: cy + 4.5, w: fw - 0.85, h: 0.38, fontFace: F, fontSize: 10.5, bold: true, color: ACCENT_DARK, valign: "middle", margin: 0 });
  });
  footer(s, 6, C.footnote);
}

// ===================================================================
// Slide 7 — 마무리 (다크)
// ===================================================================
{
  const s = p.addSlide(); s.background = { color: INK_BG };
  const Z = D.closing;
  rings(s, 12.4, 0.85, [2.7, 1.85, 1.0], 1.72);

  dot(s, MX, 1.6);
  s.addText("종합 결론", { x: MX + 0.24, y: 1.47, w: 8, h: 0.36, fontFace: F, fontSize: 12, bold: true, color: DK_KICKER, charSpacing: 2, margin: 0 });
  s.addText(Z.headline, { x: MX, y: 1.98, w: 11.6, h: 1.55, fontFace: F, fontSize: 30, bold: true, color: WHITE, lineSpacing: 40, margin: 0 });
  s.addText(runs(Z.narrative, { baseColor: DK_BODY, boldColor: WHITE, accentColor: DK_KICKER }),
    { x: MX, y: 3.78, w: 11.2, h: 1.05, fontFace: F, fontSize: 15, lineSpacing: 23, margin: 0 });

  if (Z.stats) {
    Z.stats.forEach((st, i) => {
      const x = MX + i * 2.7;
      s.addText(st.value, { x, y: 5.12, w: 2.4, h: 0.44, fontFace: F, fontSize: 22, bold: true, color: DK_STAT, margin: 0 });
      s.addText(st.label, { x, y: 5.56, w: 2.4, h: 0.26, fontFace: F, fontSize: 9.5, color: DK_STAT_LBL, margin: 0 });
    });
  }

  s.addShape(p.ShapeType.line, { x: MX, y: 6.1, w: CW, h: 0, line: { color: DK_LINE, width: 1 } });
  s.addText(Z.methodology, { x: MX, y: 6.25, w: CW, h: 1.0, fontFace: F, fontSize: 9.5, color: DK_META, lineSpacing: 13.5, margin: 0 });
}

p.writeFile({ fileName: outPath }).then(f => console.log("OK " + f)).catch(e => { console.error(e); process.exit(1); });
