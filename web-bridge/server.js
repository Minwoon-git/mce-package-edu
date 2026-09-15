// MCE 웹 브릿지 — 브라우저 채팅 UI의 메시지를 로컬 Claude Code(CLI)로 처리하고 결과를 스트리밍한다.
// claude -p + --resume 로 세션을 이어가는 실행 패턴을 쓰되,
// 웹에서는 stream-json + SSE로 진행 상황(도구 실행·중간 텍스트)을 실시간으로 내려보낸다.
const fs = require('fs');
const path = require('path');
const express = require('express');
const { spawn } = require('child_process');

// 프로젝트 루트 = 이 파일의 상위 폴더 (mce-campaign 스킬·sf-mce-mcp가 연결된 곳)
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3456;

const app = express();
app.use(express.json({ limit: '1mb' }));
// 웹 UI는 제거됨 — 이 서버는 Chrome 확장(chrome-extension/)이 쓰는 API 전용이다
app.get('/', (_req, res) => res.type('text/plain').send('MCE 웹 브릿지 (API 전용) — UI는 Chrome 확장을 사용하세요.'));

// 계정 게이트 설정 — config.json의 allowedAccounts(계정명 배열)가 있으면,
// 확장이 그 계정명이 화면에 보이는 MCE에서만 챗봇 버튼을 노출한다. 없으면 게이트 없이 항상 노출.
let CONFIG = {};
try { CONFIG = require('./config.json'); } catch { /* 파일 없으면 게이트 미적용 */ }
app.get('/api/config', (_req, res) =>
  res.json({ allowedAccounts: Array.isArray(CONFIG.allowedAccounts) ? CONFIG.allowedAccounts : [] }),
);

// 산출물 다운로드 — 캠페인 워크플로가 만든 파일(정의서 xlsx·분석 리포트 등)을 확장 말풍선에서 바로 내려받는다.
// 확장(content.js)이 답변 속 산출물 경로를 이 엔드포인트 링크(📎 칩)로 바꿔 준다.
// 안전장치: 프로젝트 루트 안 + 허용 폴더 + 허용 확장자만 서빙 (경로 조작·임의 파일 노출 방지)
const FILE_DIRS = new Set(['campaign_definitions', 'reports']);
const FILE_EXTS = new Set(['.xlsx', '.xlsm', '.csv', '.pptx', '.pdf', '.png', '.md', '.html']);
app.get('/api/file', (req, res) => {
  const q = String(req.query.path || '');
  const abs = path.isAbsolute(q) ? path.resolve(q) : path.resolve(PROJECT_ROOT, q);
  const rel = path.relative(PROJECT_ROOT, abs);
  const inside = rel && !rel.startsWith('..') && !path.isAbsolute(rel);
  if (!inside || !FILE_DIRS.has(rel.split(path.sep)[0]) || !FILE_EXTS.has(path.extname(abs).toLowerCase())) {
    return res.status(403).json({ error: '허용되지 않은 경로입니다.' });
  }
  res.download(abs, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  });
});

// 캠페인 성과 대시보드 — 정적 페이지 + 데이터 JSON.
// 데이터는 reports\dashboard-data.json(실데이터, 봇/배치가 SENDLOG 집계로 생성)이 있으면 그걸 쓰고,
// 없으면 dashboard\sample-data.json(샘플)을 서빙한다. 페이지는 챗봇 헤더의 📊 버튼으로 연다.
app.get('/dashboard', (_req, res) => res.sendFile(path.join(__dirname, 'dashboard', 'index.html')));
app.use('/dashboard', express.static(path.join(__dirname, 'dashboard'))); // 이미지 등 정적 에셋 (/dashboard/fab.png)
app.get('/api/dashboard-data', (_req, res) => {
  const real = path.join(PROJECT_ROOT, 'reports', 'dashboard-data.json');
  res.sendFile(fs.existsSync(real) ? real : path.join(__dirname, 'dashboard', 'sample-data.json'));
});

// 저니별 성과 엑셀 다운로드 — 대시보드의 "⬇ 엑셀" 버튼. 현재 표시 중인 저니 데이터를 받아
// 서식(타이틀·헤더 색·퍼센트 서식·줄무늬·합계행·필터·고정 헤더)이 입혀진 xlsx로 만들어 준다.
const ExcelJS = require('exceljs');
app.post('/api/journey-xlsx', async (req, res) => {
  const { from, to, journeys } = req.body || {};
  if (!Array.isArray(journeys) || !journeys.length) return res.status(400).json({ error: '데이터가 없습니다.' });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('저니별 성과');
  const HEAD = ['저니', '발송', '전달', '전달률', '오픈', '오픈율', '클릭', '클릭률', 'CTOR', '바운스', '바운스율', '발송 비중'];
  ws.columns = [{ width: 32 }, { width: 10 }, { width: 10 }, { width: 9 }, { width: 10 }, { width: 9 },
    { width: 10 }, { width: 9 }, { width: 9 }, { width: 10 }, { width: 10 }, { width: 10 }];

  ws.mergeCells('A1:L1');
  const title = ws.getCell('A1');
  title.value = `캠페인 성과 — 저니별 (${from} ~ ${to})`;
  title.font = { bold: true, size: 13 };
  ws.getRow(1).height = 22;

  const headRow = ws.getRow(3);
  headRow.values = HEAD;
  headRow.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10.5 };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  headRow.height = 20;

  const totalSent = journeys.reduce((s, j) => s + j.sent, 0);
  const toRow = (name, o) => [name, o.sent, o.sent - o.bounce, (o.sent - o.bounce) / o.sent,
    o.open, o.open / o.sent, o.click, o.click / o.sent, o.open ? o.click / o.open : 0,
    o.bounce, o.bounce / o.sent, o.sent / totalSent];
  const CNT = [2, 3, 5, 7, 10];        // 건수 컬럼 (1-base)
  const PCT = [4, 6, 8, 9, 11, 12];    // 비율 컬럼
  const styleRow = (row, zebra) => {
    row.eachCell({ includeEmpty: true }, (c, col) => {
      if (CNT.includes(col)) c.numFmt = '#,##0';
      if (PCT.includes(col)) c.numFmt = '0.0%';
      c.border = { bottom: { style: 'thin', color: { argb: 'FFE8EAF0' } } };
      if (zebra) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F6FC' } };
    });
  };
  journeys.forEach((j, i) => styleRow(ws.addRow(toRow(j.name, j)), i % 2 === 1));
  const sum = (k) => journeys.reduce((s, j) => s + j[k], 0);
  const total = ws.addRow(toRow('합계', { sent: sum('sent'), open: sum('open'), click: sum('click'), bounce: sum('bounce') }));
  styleRow(total, false);
  total.eachCell({ includeEmpty: true }, (c) => {
    c.font = { bold: true };
    c.border = { top: { style: 'double', color: { argb: 'FF1D4ED8' } } };
  });

  ws.views = [{ state: 'frozen', ySplit: 3 }];
  ws.autoFilter = 'A3:L3';

  const fname = `저니별성과_${from}_${to}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`);
  await wb.xlsx.write(res);
  res.end();
});

// 파일 첨부(드래그&드롭) 업로드 — 확장 패널에 놓은 파일을 저장하고 절대 경로를 돌려준다.
// 정의서(xlsx/xlsm/csv)는 campaign_definitions\에 저장돼 "정의서 직접 첨부 → STEP 3" 흐름과 그대로 연결되고,
// 그 외 허용 확장자(스키마 DDL 등)는 uploads\에 저장된다. 실행 파일 등은 거부.
const UPLOAD_DEF_EXTS = new Set(['.xlsx', '.xlsm', '.csv']);
const UPLOAD_ETC_EXTS = new Set(['.txt', '.sql', '.md', '.json', '.jpg', '.jpeg', '.png']);
app.post('/api/upload', express.raw({ type: () => true, limit: '25mb' }), (req, res) => {
  const name = path.basename(String(req.query.name || '')).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
  const ext = path.extname(name).toLowerCase();
  if (!name || (!UPLOAD_DEF_EXTS.has(ext) && !UPLOAD_ETC_EXTS.has(ext))) {
    return res.status(403).json({ error: `허용되지 않은 파일 형식입니다 (${ext || '확장자 없음'})` });
  }
  if (!req.body || !req.body.length) return res.status(400).json({ error: '파일 내용이 비어 있습니다.' });
  const dir = path.join(PROJECT_ROOT, UPLOAD_DEF_EXTS.has(ext) ? 'campaign_definitions' : 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  let dest = path.join(dir, name);
  if (fs.existsSync(dest)) {
    // 동명 파일 덮어쓰기 방지 — 타임스탬프를 붙여 새 파일로 저장
    const t = new Date();
    const stamp = [t.getFullYear(), t.getMonth() + 1, t.getDate()].map((n) => String(n).padStart(2, '0')).join('') +
      '_' + [t.getHours(), t.getMinutes(), t.getSeconds()].map((n) => String(n).padStart(2, '0')).join('');
    dest = path.join(dir, `${path.basename(name, ext)}_${stamp}${ext}`);
  }
  fs.writeFileSync(dest, req.body);
  res.json({ path: dest, name: path.basename(dest) });
});

// chatId → 실행 중인 claude 프로세스. 같은 대화에 동시 요청이 겹치는 것을 막고, 중지 버튼에 쓴다.
const running = new Map();

// chatId → 마지막 결과. 스트림 도중 연결이 끊긴 클라이언트(확장 서비스 워커 종료 등)가
// /api/result 폴링으로 결과를 회수할 때 쓴다. 작업 자체는 연결과 무관하게 끝까지 돈다.
const lastResult = new Map();
function rememberResult(chatId, data) {
  if (!chatId) return;
  lastResult.set(chatId, { ...data, ts: Date.now() });
  for (const [k, v] of lastResult) if (Date.now() - v.ts > 3600e3) lastResult.delete(k); // 1시간 경과분 정리
}

// SSE 이벤트 한 건 전송
function send(res, obj) {
  if (!res.writableEnded && !res.destroyed) res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

// 도구 이름을 표시용으로 정리 (mcp__sf-mce-mcp__sfmc_get_journeys → SFMC · sfmc_get_journeys)
function toolLabel(name) {
  if (name.startsWith('mcp__sf-mce-mcp__')) return `SFMC · ${name.slice('mcp__sf-mce-mcp__'.length)}`;
  return name.replace(/^mcp__([^_]+(?:_[^_]+)*)__/, '$1 · ');
}

// 도구 입력에서 사람이 읽을 만한 한 줄 힌트를 뽑는다
function toolDetail(input) {
  if (!input || typeof input !== 'object') return '';
  const v =
    input.description || input.file_path || input.pattern || input.name || input.query ||
    (typeof input.prompt === 'string' ? input.prompt : '');
  return String(v).replace(/\s+/g, ' ').slice(0, 100);
}

// SFMC MCP 인증 상태 확인 — `claude mcp get <서버명>` 출력의 "Needs authentication" 여부로 판정.
// 채팅 스폰과 병렬로 돌고(약 15초 — 헬스체크 포함), result 전송은 프로브 완료를 기다린다.
// 결과는 60초 캐시해 연속 요청마다 CLI를 새로 띄우지 않는다. (모델 호출이 아니라서 사용량 0)
let probeCache = { ts: 0, needsAuth: false };
let probeInflight = null;
// 도구 호출 단계에서 인증 오류(리프레시 토큰 만료 등)가 났던 시각 — MCP 연결은 Connected로 보여
// 프로브가 못 잡는 유형이라, 최근 30분 내 발생했으면 /api/mcp-status가 '인증 필요'로 답해 배너를 띄운다.
// 재인증(mcp-login) 완료 시 초기화.
let lastToolAuthErr = 0;
function probeMcpAuth() {
  if (Date.now() - probeCache.ts < 60e3) return Promise.resolve(probeCache.needsAuth);
  if (probeInflight) return probeInflight;
  probeInflight = new Promise((resolve) => {
    let out = '';
    let called = false;
    const once = (v) => {
      if (called) return;
      called = true;
      probeCache = { ts: Date.now(), needsAuth: v };
      probeInflight = null;
      resolve(v);
    };
    try {
      const p = spawn('claude', ['mcp', 'get', MCP_NAME], { cwd: PROJECT_ROOT, shell: true });
      p.stdout.on('data', (d) => (out += d.toString()));
      p.stderr.on('data', (d) => (out += d.toString()));
      p.on('close', () => once(/needs authentication/i.test(out)));
      p.on('error', () => once(false));
      setTimeout(() => { once(false); try { killTree(p); } catch { /* 이미 종료 */ } }, 25000);
    } catch {
      once(false);
    }
  });
  return probeInflight;
}

// SFMC 인증 상태 조회 — 확장이 패널을 열 때 상단 인증 배너 표시용으로 호출 (프로브 60초 캐시 재사용).
// 프로브가 정상이어도 최근 30분 내 도구 호출에서 인증 오류가 났으면 '인증 필요'로 답한다.
app.get('/api/mcp-status', (_req, res) => {
  probeMcpAuth().then((needsAuth) =>
    res.json({ needsAuth: needsAuth || Date.now() - lastToolAuthErr < 30 * 60e3 }),
  );
});

app.post('/api/chat', (req, res) => {
  const { message, sessionId, chatId } = req.body || {};
  const prompt = (message || '').trim();
  if (!prompt) return res.status(400).json({ error: '메시지가 비어 있습니다.' });
  if (chatId && running.has(chatId)) {
    return res.status(409).json({ error: '이 대화에서 이미 처리 중인 요청이 있습니다.' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // --dangerously-skip-permissions: 웹 봇은 사람이 "허용"을 못 누르므로 자동 승인이 필요
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'];
  // 챗봇 정책: 저장소 코드/설정/문서를 고쳐달라는 직접 요청은 거부하게 한다.
  // (캠페인 워크플로가 만드는 산출물 — 정의서 xlsx·리포트·저니 이력 등 — 은 예외로 정상 동작)
  // shell:true 스폰은 인자를 자동 인용하지 않으므로 직접 큰따옴표로 감싼다(그래서 영문·ASCII로 작성).
  const BOT_POLICY =
    'This session runs inside the MCE chatbot used by campaign operators, not the developer CLI. ' +
    'If the user directly asks you to modify, create, or delete source code, configuration, skills, agents, ' +
    'or any other repository files, refuse and tell them to do it in Claude Code on this PC instead. ' +
    'This restriction does NOT apply to files produced by the normal campaign workflows, such as campaign ' +
    'definition xlsx files, analysis reports, journey history logs, and agent memory - those keep working as usual.';
  args.push('--append-system-prompt', `"${BOT_POLICY}"`);
  if (sessionId) args.push('--resume', sessionId);

  const child = spawn('claude', args, { cwd: PROJECT_ROOT, shell: true });
  if (chatId) running.set(chatId, child);

  // 프록시·브라우저가 유휴 연결을 끊지 않도록 주기적으로 핑을 보낸다
  const ping = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n');
  }, 15000);

  let gotResult = false;
  let stderr = '';
  let buf = '';
  let authErr = false; // SFMC MCP 인증 만료 감지 — 확장이 result와 함께 받아 재인증 버튼을 띄운다

  // ⚠ init 이벤트의 mcp_servers 상태는 타이밍 경합이라 못 쓴다 — 같은 '인증 필요' 상태에서도
  //   스폰 타이밍에 따라 'needs-auth' 또는 'pending'(연결 중)으로 찍힌다(2026-08-27 실측).
  //   대신 요청마다 `claude mcp get`을 병렬로 돌려 인증 상태를 확정적으로 확인하고,
  //   result 전송을 프로브 완료까지 지연시켜 짧은 응답에서도 플래그를 놓치지 않는다.
  const probeP = probeMcpAuth().then((needsAuth) => { if (needsAuth) authErr = true; });
  let resultPending = null; // result 이벤트 처리 프라미스 — done/종료 처리가 이걸 기다린다

  const handleEvent = (ev) => {
    if (ev.type === 'system' && ev.subtype === 'init') {
      send(res, { type: 'session', sessionId: ev.session_id });
      return;
    }
    if (ev.type === 'assistant' && ev.message && Array.isArray(ev.message.content)) {
      for (const block of ev.message.content) {
        if (block.type === 'text' && block.text && block.text.trim()) {
          send(res, { type: 'text', text: block.text });
        } else if (block.type === 'tool_use') {
          send(res, { type: 'tool', name: toolLabel(block.name || ''), detail: toolDetail(block.input) });
        }
      }
      return;
    }
    if (ev.type === 'result') {
      gotResult = true;
      if (ev.is_error && !ev.result) {
        send(res, { type: 'error', message: ev.error || ev.subtype || '알 수 없는 오류' });
      } else {
        // 인증 프로브가 아직이면 완료까지 기다렸다가 result를 보낸다 (내부 25초 타임아웃 있음)
        resultPending = probeP.then(() => {
          const payload = {
            type: 'result',
            text: ev.result ?? '(빈 응답)',
            cost: ev.total_cost_usd,
            sessionId: ev.session_id,
            authError: authErr || undefined,
          };
          rememberResult(chatId, payload); // 연결이 끊긴 클라이언트의 폴링 회수용
          send(res, payload);
        });
      }
    }
  };

  child.stdout.on('data', (d) => {
    buf += d.toString();
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      // SFMC 인증 계열 오류가 스트림(도구 결과)에 보이면 표시해 둔다.
      // - "session is invalid or access is revoked": MCP 세션 만료
      // - "refresh token is revoked/expired" / "obtain a new refresh token": SFMC 리프레시 토큰 만료
      //   (이 경우 MCP 연결 자체는 Connected라 프로브로는 못 잡는다 — 2026-08-28 실측)
      if (!authErr && /(session is invalid or access is revoked|refresh token is (revoked|expired)|obtain a new refresh token)/i.test(line)) {
        authErr = true;
        lastToolAuthErr = Date.now(); // 패널 재오픈 시 배너 표시용으로 기억
      }
      try {
        handleEvent(JSON.parse(line));
      } catch {
        /* JSON이 아닌 로그 줄은 무시 */
      }
    }
  });
  child.stderr.on('data', (d) => (stderr += d.toString()));

  const finish = (extra) => {
    clearInterval(ping);
    if (chatId) running.delete(chatId);
    if (extra) send(res, extra);
    send(res, { type: 'done' });
    if (!res.writableEnded) res.end();
  };

  child.on('error', (err) => finish({ type: 'error', message: `claude 실행 실패: ${err.message}` }));
  child.on('close', (code) => {
    // result 전송이 인증 프로브를 기다리는 중이면 done도 그 뒤에 보낸다 (순서 보장)
    Promise.resolve(resultPending).then(() => {
      if (child.stoppedByUser && !gotResult) {
        const payload = { type: 'result', text: '⏹ 요청을 중단했습니다.' }; // 사용자 중단은 오류가 아닌 안내로
        rememberResult(chatId, payload);
        finish(payload);
      } else if (!gotResult && code !== 0) {
        finish({ type: 'error', message: stderr.trim() || `claude 종료 코드 ${code}` });
      } else {
        finish();
      }
    });
  });

  // 탭이 닫혀도 작업은 계속 진행 — 세션이 저장되므로 다시 열면 --resume으로 이어진다
  req.on('close', () => clearInterval(ping));

  child.stdin.write(prompt);
  child.stdin.end();
});

// 실행 중인 요청 중지 (UI의 ⏹ 버튼)
// Windows에서 shell:true 스폰은 cmd가 부모라 child.kill()로는 실제 claude 프로세스가 살아남는다
// → taskkill /T 로 프로세스 트리 전체를 종료한다
function killTree(child) {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
  } else {
    child.kill();
  }
}

// 연결이 끊긴 클라이언트의 결과 회수 (확장이 폴링) — ts로 어느 요청의 결과인지 판별한다
app.get('/api/result', (req, res) => {
  const chatId = String(req.query.chatId || '');
  res.json({ result: lastResult.get(chatId) || null, running: running.has(chatId) });
});

// SFMC MCP 재인증 — 확장 말풍선의 "🔐 SFMC 재인증" 버튼이 호출한다.
// `claude mcp login <서버명>`을 실행하면 이 PC의 기본 브라우저에 OAuth 로그인 창이 열리고,
// 완료되면 인증이 저장되어 다음 claude -p 실행부터 적용된다 (브릿지 재시작 불필요).
const MCP_NAME = 'sf-mce-mcp';
let mcpLoginProc = null; // 진행 중인 로그인 프로세스 (중복 실행 방지)
app.post('/api/mcp-login', (_req, res) => {
  if (mcpLoginProc) {
    return res.json({ started: true, dup: true });
  }
  // ⚠ 헤드리스 스폰으로는 불가 — CLI가 "stdin isn't a terminal"로 인증 완료를 거부하고 종료해
  // 로컬 콜백 리스너까지 죽는다(검증됨). 그래서 실제 콘솔 창(TTY)을 하나 띄워 그 안에서 실행한다.
  // CLI가 스스로 기본 브라우저에 OAuth 로그인 창을 열고 로컬 콜백으로 완료를 받으며,
  // 완료되면 콘솔 창은 자동으로 닫힌다. (start /wait 로 창이 닫힐 때까지 프로세스를 추적)
  const child = spawn(`start "SFMC MCP Login" /wait cmd /c "claude mcp login ${MCP_NAME}"`, [], {
    cwd: PROJECT_ROOT,
    shell: true,
  });
  mcpLoginProc = child;
  // 5분 내 완료되지 않으면 정리 (로그인 창을 방치한 경우 등 — 이후 재시도 가능)
  const timeout = setTimeout(() => killTree(child), 300e3);
  const done = () => {
    clearTimeout(timeout);
    mcpLoginProc = null;
    probeCache.ts = 0; // 재인증 직후엔 캐시를 비워 다음 요청이 새 상태를 보게 한다
    lastToolAuthErr = 0; // 도구 단계 인증 오류 기억도 초기화 (배너 자동 소멸)
  };
  child.on('close', done);
  child.on('error', done);
  res.json({ started: true });
});

app.post('/api/stop', (req, res) => {
  const { chatId } = req.body || {};
  const child = chatId && running.get(chatId);
  if (child) {
    child.stoppedByUser = true;
    killTree(child);
    running.delete(chatId);
    return res.json({ stopped: true });
  }
  res.json({ stopped: false });
});

app.listen(PORT, () => {
  console.log(`⚡ MCE 웹 브릿지 실행 중 → http://localhost:${PORT}`);
  console.log('   프로젝트 루트:', PROJECT_ROOT);
});
