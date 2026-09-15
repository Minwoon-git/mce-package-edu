const ExcelJS = require('exceljs');
const path = require('path');

// 색상 팔레트 (스크린샷 기준)
const COLOR = {
  headerBg: '1F3864',   // 진한 네이비 (헤더 배경)
  headerFg: 'FFFFFF',   // 흰색 (헤더 글자)
  titleBg:  'FFD966',   // 노란색 (제목 행 배경)
  titleFg:  '1F3864',   // 네이비 (제목 글자)
  rowEven:  'DCE6F1',   // 연한 파란색 (짝수 행)
  rowOdd:   'FFFFFF',   // 흰색 (홀수 행)
  border:   '8EA9C1',   // 테두리
};

function applyBorder(cell) {
  const border = { style: 'thin', color: { argb: COLOR.border } };
  cell.border = { top: border, left: border, bottom: border, right: border };
}

function styleHeaderRow(row, colCount) {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
    cell.font = { bold: true, color: { argb: COLOR.headerFg }, size: 10, name: '맑은 고딕' };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    applyBorder(cell);
  }
  row.height = 30;
}

function styleDataRow(row, colCount, isEven) {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? COLOR.rowEven : COLOR.rowOdd } };
    cell.font = { size: 10, name: '맑은 고딕' };
    cell.alignment = { vertical: 'middle', wrapText: true };
    applyBorder(cell);
  }
  row.height = 22;
}

async function generateCampaignDefinition(overviewRows, journeyRows, outputPath) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MCE Campaign Expert';
  wb.created = new Date();

  // ── 시나리오 정의 탭 ──────────────────────────────────────
  const ws1 = wb.addWorksheet('시나리오 정의', { views: [{ state: 'frozen', ySplit: 3 }] });

  // 타이틀 행
  ws1.mergeCells('A1:G1');
  const title1 = ws1.getCell('A1');
  title1.value = 'MCE 캠페인 시나리오 정의서';
  title1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.titleBg } };
  title1.font = { bold: true, size: 13, color: { argb: COLOR.titleFg }, name: '맑은 고딕' };
  title1.alignment = { vertical: 'middle', horizontal: 'left' };
  ws1.getRow(1).height = 28;

  ws1.mergeCells('A2:G2');
  const sub1 = ws1.getCell('A2');
  sub1.value = '※ 목적: SFMC Journey Builder 자동 생성 및 연동을 위한 기획 정의서';
  sub1.font = { italic: true, size: 9, color: { argb: '595959' }, name: '맑은 고딕' };
  sub1.alignment = { vertical: 'middle', horizontal: 'left' };
  ws1.getRow(2).height = 18;

  // 헤더 행
  const overviewHeaders = ['캠페인 ID', '캠페인 시나리오명', '설명 및 비즈니스 목적', '발송 일정', '스케줄 시작일', 'Entry Source', 'Entry DE 명'];
  const hRow1 = ws1.addRow(overviewHeaders);
  styleHeaderRow(hRow1, overviewHeaders.length);

  // 데이터 행
  overviewRows.forEach((row, i) => {
    const r = ws1.addRow(row);
    styleDataRow(r, overviewHeaders.length, i % 2 === 0);
  });

  // 열 너비
  [8, 24, 40, 16, 14, 16, 22].forEach((w, i) => {
    ws1.getColumn(i + 1).width = w;
  });

  // ── 저니 구조 탭 ──────────────────────────────────────────
  const ws2 = wb.addWorksheet('저니 구조', { views: [{ state: 'frozen', ySplit: 3 }] });

  ws2.mergeCells('A1:K1');
  const title2 = ws2.getCell('A1');
  title2.value = 'MCE Journey 구조 정의서';
  title2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.titleBg } };
  title2.font = { bold: true, size: 13, color: { argb: COLOR.titleFg }, name: '맑은 고딕' };
  title2.alignment = { vertical: 'middle', horizontal: 'left' };
  ws2.getRow(1).height = 28;

  ws2.mergeCells('A2:K2');
  const sub2 = ws2.getCell('A2');
  sub2.value = '※ 목적: SFMC Journey Builder 자동 생성 및 연동을 위한 기획 정의서';
  sub2.font = { italic: true, size: 9, color: { argb: '595959' }, name: '맑은 고딕' };
  sub2.alignment = { vertical: 'middle', horizontal: 'left' };
  ws2.getRow(2).height = 18;

  const journeyHeaders = [
    '캠페인 ID', '단계 (Step)', '컴포넌트 유형',
    '상세 설정 조건 / 분기 로직 (Criteria & Path)',
    '연결 콘텐츠 명칭 (Email Name / 알림톡 템플릿명)', '연결 콘텐츠 ID (Email ID / 알림톡 seq)',
    '대기 기간 (Wait)', '고객 재진입 설정 (Contact Re-entry)', 'Schedule Flow Mode',
    'applicationExtensionKey (알림톡/문자)', '변수 매핑 (알림톡 #{변수}→DE컬럼)'
  ];
  const hRow2 = ws2.addRow(journeyHeaders);
  styleHeaderRow(hRow2, journeyHeaders.length);

  journeyRows.forEach((row, i) => {
    const r = ws2.addRow(row);
    styleDataRow(r, journeyHeaders.length, i % 2 === 0);
  });

  [10, 12, 18, 44, 28, 22, 14, 28, 16, 40, 36].forEach((w, i) => {
    ws2.getColumn(i + 1).width = w;
  });

  await wb.xlsx.writeFile(outputPath);
  console.log(`생성 완료: ${outputPath}`);
}

// ── CLI 모드: node generate_campaign_definition.js <파일명> <json파일> ──
// 사용법: node generate_campaign_definition.js CP_004_신규회원웰컴Journey_20260603.xlsx data.json
// data.json 형식: { "overviewRows": [...], "journeyRows": [...] }
if (require.main === module) {
  const OUTPUT_DIR = path.join(__dirname, 'campaign_definitions');
  const fileName = process.argv[2];
  const dataFile = process.argv[3];

  if (!fileName || !dataFile) {
    console.error('사용법: node generate_campaign_definition.js <파일명.xlsx> <데이터.json>');
    process.exit(1);
  }

  const data = JSON.parse(require('fs').readFileSync(path.join(__dirname, dataFile), 'utf8'));
  generateCampaignDefinition(data.overviewRows, data.journeyRows, path.join(OUTPUT_DIR, fileName))
    .catch(console.error);
}

module.exports = { generateCampaignDefinition };
