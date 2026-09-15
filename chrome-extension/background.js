// 백그라운드 서비스 워커 — 콘텐츠 스크립트 대신 로컬 web-bridge(localhost:3456)와 통신한다.
// 페이지(CSP/CORS) 제약을 받지 않도록 fetch는 전부 여기서 수행하고, SSE 조각을 Port로 중계한다.
const BRIDGE = 'http://localhost:3456';

// ── 툴바 아이콘 클릭 = 챗봇 전역 ON/OFF 토글 ──
// 상태는 chrome.storage.local.botDisabled에 영구 저장되고, content.js가 onChanged로 받아 즉시 반영한다.
const reflectBadge = (off) => {
  chrome.action.setBadgeText({ text: off ? 'OFF' : '' });
  if (off) chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
};
chrome.action.onClicked.addListener(() => {
  chrome.storage.local.get('botDisabled', ({ botDisabled }) => {
    const next = !botDisabled;
    chrome.storage.local.set({ botDisabled: next });
    reflectBadge(next);
  });
});
// 서비스 워커가 깨어날 때마다 배지를 저장된 상태와 동기화 (브라우저 재시작 시 배지가 초기화되므로)
chrome.storage.local.get('botDisabled', ({ botDisabled }) => reflectBadge(!!botDisabled));

// 콘텐츠 스크립트 단발 요청 처리: whoami(탭 ID) / getConfig(계정 게이트 설정)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'whoami') {
    sendResponse({ tabId: sender.tab?.id ?? null });
    return;
  }
  if (msg && msg.type === 'getConfig') {
    fetch(`${BRIDGE}/api/config`)
      .then((r) => r.json())
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true; // 비동기 응답
  }
  if (msg && msg.type === 'getResult') {
    // 스트림이 끊긴 대화의 결과 회수 (content.js가 폴링)
    fetch(`${BRIDGE}/api/result?chatId=${encodeURIComponent(msg.chatId || '')}`)
      .then((r) => r.json())
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true;
  }
  if (msg && msg.type === 'mcpStatus') {
    // SFMC 인증 상태 — 패널 상단 인증 배너 표시용
    fetch(`${BRIDGE}/api/mcp-status`)
      .then((r) => r.json())
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true;
  }
  if (msg && msg.type === 'mcpLogin') {
    // SFMC MCP 재인증 — 서버가 claude mcp login을 실행하고 인증 URL을 돌려주면 새 탭으로 연다
    fetch(`${BRIDGE}/api/mcp-login`, { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.url) chrome.tabs.create({ url: data.url });
        sendResponse(data);
      })
      .catch(() => sendResponse(null));
    return true;
  }
  if (msg && msg.type === 'getDash') {
    // 성과 대시보드 데이터 — 챗봇 패널 안의 대시보드 뷰가 사용 (Claude 호출 없음)
    fetch(`${BRIDGE}/api/dashboard-data`)
      .then((r) => r.json())
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true;
  }
  if (msg && msg.type === 'upload') {
    // 파일 첨부(드래그&드롭) — content.js가 base64로 넘긴 파일을 web-bridge에 저장하고 절대 경로를 돌려준다
    try {
      const bin = atob(msg.dataB64 || '');
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      fetch(`${BRIDGE}/api/upload?name=${encodeURIComponent(msg.name || 'file')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: bytes,
      })
        .then((r) => r.json())
        .then(sendResponse)
        .catch(() => sendResponse(null));
    } catch {
      sendResponse(null);
    }
    return true;
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'mce-chat') return;
  let ctrl = null;
  let keepalive = null;
  // 긴 작업(세팅 점검 등) 동안 서비스 워커가 유휴 종료되지 않게 주기적으로 확장 API를 호출해 타이머를 리셋한다
  const stopKeepalive = () => { clearInterval(keepalive); keepalive = null; };

  port.onMessage.addListener(async (msg) => {
    if (msg.type === 'send') {
      ctrl = new AbortController();
      if (!keepalive) keepalive = setInterval(() => chrome.runtime.getPlatformInfo(() => {}), 20000);
      try {
        const resp = await fetch(`${BRIDGE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg.payload),
          signal: ctrl.signal,
        });
        if (!resp.ok) {
          const e = await resp.json().catch(() => ({}));
          port.postMessage({ type: 'error', message: e.error || `HTTP ${resp.status}` });
          port.postMessage({ type: 'done' });
          return;
        }
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const chunk = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const line = chunk.split('\n').find((l) => l.startsWith('data: '));
            if (!line) {
              // 서버의 keep-alive 핑(: ping) — 서비스 워커 유휴 종료를 막기 위해 노옵 메시지로 중계
              port.postMessage({ type: 'ping' });
              continue;
            }
            try {
              port.postMessage(JSON.parse(line.slice(6)));
            } catch {
              /* 손상된 조각 무시 */
            }
          }
        }
        stopKeepalive();
        port.postMessage({ type: 'done' });
      } catch (err) {
        stopKeepalive();
        if (err.name !== 'AbortError') {
          port.postMessage({
            type: 'error',
            message: `브릿지 연결 실패: ${err.message} — web-bridge 서버(run-web.cmd)가 켜져 있는지 확인하세요.`,
          });
        }
        port.postMessage({ type: 'done' });
      }
    } else if (msg.type === 'stop') {
      fetch(`${BRIDGE}/api/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: msg.chatId }),
      }).catch(() => {});
    }
  });

  port.onDisconnect.addListener(() => { stopKeepalive(); ctrl?.abort(); });
});
