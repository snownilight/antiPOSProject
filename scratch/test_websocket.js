/**
 * POS-33 WebSocket E2E 測試腳本
 * 使用原生 HTTP 連線 SockJS，不需要額外 npm 套件
 */
const http = require('http');

const API_BASE = 'http://localhost:8081/api';
const WS_BASE = 'http://localhost:8081/ws';

let jwtToken = '';

// --- Utility: HTTP Request ---
function httpRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(jwtToken ? { 'Authorization': `Bearer ${jwtToken}` } : {})
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// --- SockJS info endpoint to get websocket URL ---
function getSockJSInfo() {
  return new Promise((resolve, reject) => {
    http.get(`${WS_BASE}/info`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Failed to parse SockJS info')); }
      });
    }).on('error', reject);
  });
}

// --- STOMP Frame helpers ---
function buildStompFrame(command, headers = {}, body = '') {
  let frame = command + '\n';
  for (const [k, v] of Object.entries(headers)) {
    frame += `${k}:${v}\n`;
  }
  frame += '\n' + body + '\0';
  return frame;
}

function parseStompFrames(raw) {
  // SockJS wraps messages in arrays
  let messages = [];
  try {
    if (raw.startsWith('a')) {
      const arr = JSON.parse(raw.substring(1));
      messages = arr;
    } else if (raw.startsWith('o')) {
      return [{ command: 'OPEN' }];
    } else if (raw.startsWith('h')) {
      return [{ command: 'HEARTBEAT' }];
    } else if (raw.startsWith('c')) {
      return [{ command: 'CLOSE' }];
    }
  } catch {
    messages = [raw];
  }

  return messages.map(msg => {
    const nullIdx = msg.indexOf('\0');
    const content = nullIdx >= 0 ? msg.substring(0, nullIdx) : msg;
    const parts = content.split('\n\n');
    const headerSection = parts[0];
    const body = parts.length > 1 ? parts.slice(1).join('\n\n') : '';
    const lines = headerSection.split('\n');
    const command = lines[0];
    const headers = {};
    for (let i = 1; i < lines.length; i++) {
      const colonIdx = lines[i].indexOf(':');
      if (colonIdx > 0) {
        headers[lines[i].substring(0, colonIdx)] = lines[i].substring(colonIdx + 1);
      }
    }
    return { command, headers, body };
  });
}

// --- SockJS XHR-Streaming Transport ---
function connectSockJSXHR() {
  return new Promise((resolve, reject) => {
    const serverId = Math.floor(Math.random() * 1000);
    const sessionId = Math.random().toString(36).substring(2, 10);
    const xhrUrl = `${WS_BASE}/${serverId}/${sessionId}/xhr_streaming`;
    const sendUrl = `${WS_BASE}/${serverId}/${sessionId}/xhr_send`;

    const timeout = setTimeout(() => reject(new Error('SockJS 連線逾時 (10s)')), 10000);

    const url = new URL(xhrUrl);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: { 'Accept': 'application/javascript' }
    }, (res) => {
      let connected = false;
      const messageHandlers = [];

      const conn = {
        send: (data) => {
          return new Promise((res2, rej2) => {
            const sUrl = new URL(sendUrl);
            const sendReq = http.request({
              hostname: sUrl.hostname,
              port: sUrl.port,
              path: sUrl.pathname,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              }
            }, (sendRes) => {
              sendRes.resume();
              sendRes.on('end', () => res2());
            });
            sendReq.on('error', rej2);
            sendReq.write(JSON.stringify([data]));
            sendReq.end();
          });
        },
        onMessage: (handler) => messageHandlers.push(handler),
        close: () => { req.destroy(); }
      };

      res.on('data', (chunk) => {
        const text = chunk.toString().trim();
        if (!text) return;

        const frames = parseStompFrames(text);
        for (const frame of frames) {
          if (frame.command === 'OPEN' && !connected) {
            connected = true;
            clearTimeout(timeout);
            resolve(conn);
          } else {
            messageHandlers.forEach(h => h(frame));
          }
        }
      });
    });

    req.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    req.end();
  });
}

// --- Main Test ---
async function main() {
  let passed = 0;
  let failed = 0;
  const results = [];

  function assert(name, condition, detail = '') {
    if (condition) {
      passed++;
      results.push(`  ✅ ${name}`);
    } else {
      failed++;
      results.push(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
    }
  }

  console.log('=== POS-33 WebSocket E2E 測試 ===\n');

  // Obtain JWT token
  try {
    const loginRes = await httpRequest('POST', '/auth/login', { username: 'admin', password: 'admin123' });
    if (loginRes.status === 200 && loginRes.body.data?.token) {
      jwtToken = loginRes.body.data.token;
      console.log('✓ Obtained JWT Token successfully.\n');
    } else {
      throw new Error(loginRes.body.message || 'Unknown error');
    }
  } catch (e) {
    console.error('Login failed, cannot run E2E WebSocket test:', e.message);
    process.exit(1);
  }

  // 0. Check SockJS info endpoint
  console.log('📡 測試 0: SockJS Info Endpoint...');
  try {
    const info = await getSockJSInfo();
    assert('SockJS /ws/info 端點可用', info.websocket !== undefined);
  } catch (e) {
    assert('SockJS /ws/info 端點可用', false, e.message);
    console.log('\n❌ 後端 WebSocket 服務未啟動，中止測試。');
    process.exit(1);
  }

  // 1. Connect via SockJS XHR
  console.log('\n📡 測試 1: SockJS + STOMP 連線...');
  let conn;
  try {
    conn = await connectSockJSXHR();
    assert('SockJS XHR-Streaming 連線成功', true);
  } catch (e) {
    assert('SockJS XHR-Streaming 連線成功', false, e.message);
    console.log('\n❌ 無法建立 SockJS 連線，中止測試。');
    process.exit(1);
  }

  // STOMP CONNECT
  const stompConnected = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('STOMP CONNECT 逾時')), 5000);
    conn.onMessage((frame) => {
      if (frame.command === 'CONNECTED') {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  await conn.send(buildStompFrame('CONNECT', {
    'accept-version': '1.2',
    'heart-beat': '0,0'
  }));
  try {
    await stompConnected;
    assert('STOMP CONNECTED 握手成功', true);
  } catch (e) {
    assert('STOMP CONNECTED 握手成功', false, e.message);
    process.exit(1);
  }

  // Subscribe to /topic/orders
  const eventQueue = [];
  const pendingWaiters = [];
 
  conn.onMessage((frame) => {
    if (frame.command === 'MESSAGE') {
      try {
        const payload = JSON.parse(frame.body);
        const waiterIdx = pendingWaiters.findIndex(w => w.eventType === payload.event && (!w.orderId || w.orderId === payload.orderId));
        if (waiterIdx >= 0) {
          const waiter = pendingWaiters.splice(waiterIdx, 1)[0];
          clearTimeout(waiter.timer);
          waiter.resolve(payload);
        } else {
          eventQueue.push(payload);
        }
      } catch (e) {
        console.error('  解析 MESSAGE 失敗:', e);
      }
    }
  });

  await conn.send(buildStompFrame('SUBSCRIBE', {
    'id': 'sub-0',
    'destination': '/topic/orders'
  }));
  assert('訂閱 /topic/orders 成功', true);

  function waitForEvent(eventType, orderId = null, timeoutMs = 5000) {
    const idx = eventQueue.findIndex(e => e.event === eventType && (!orderId || e.orderId === orderId));
    if (idx >= 0) {
      return Promise.resolve(eventQueue.splice(idx, 1)[0]);
    }
    return new Promise((resolve, reject) => {
      const waiter = {
        eventType,
        orderId,
        resolve,
        reject
      };
      waiter.timer = setTimeout(() => {
        const wIdx = pendingWaiters.indexOf(waiter);
        if (wIdx >= 0) {
          pendingWaiters.splice(wIdx, 1);
        }
        reject(new Error(`等待 WebSocket 事件 ${eventType} 逾時`));
      }, timeoutMs);
      pendingWaiters.push(waiter);
    });
  }

  // 2. Test ORDER_CREATED event
  console.log('\n📡 測試 2: 建立訂單 → ORDER_CREATED 事件廣播...');

  const tablesRes = await httpRequest('GET', '/tables');
  const firstTable = tablesRes.body.data?.[0];
  assert('取得桌台資料', !!firstTable);

  const productsRes = await httpRequest('GET', '/products');
  const availableProduct = productsRes.body.data?.find(p => p.status === 'AVAILABLE');
  assert('取得可用商品', !!availableProduct);

  if (firstTable && availableProduct) {
    const orderRes = await httpRequest('POST', '/orders', {
      tableId: firstTable.id,
      items: [{ productId: availableProduct.id, quantity: 1, note: 'WS測試' }]
    });
    assert('訂單建立 API 回傳 200', orderRes.body.code === 200, orderRes.body.message);

    if (orderRes.body.code === 200) {
      const orderId = orderRes.body.data.id;
 
      try {
        const event = await waitForEvent('ORDER_CREATED', orderId, 5000);
        assert('收到 ORDER_CREATED 事件', event.event === 'ORDER_CREATED', `event=${event.event}`);
        assert('事件 orderId 正確', event.orderId === orderId, `expected=${orderId}, got=${event.orderId}`);
        assert('事件 status 為 PENDING', event.status === 'PENDING', `status=${event.status}`);
        assert('事件包含 timestamp', !!event.timestamp);
        assert('事件包含 tableId', event.tableId === firstTable.id);
      } catch (e) {
        assert('收到 ORDER_CREATED 事件', false, e.message);
      }
 
      // 3. Test checkout → ORDER_STATUS_CHANGED
      console.log('\n📡 測試 3: 結帳訂單 → ORDER_STATUS_CHANGED 事件廣播...');
      
      const checkoutRes = await httpRequest('POST', `/orders/${orderId}/checkout`);
      assert('結帳 API 回傳 200', checkoutRes.body.code === 200, checkoutRes.body.message);
 
      if (checkoutRes.body.code === 200) {
        try {
          const checkoutEvent = await waitForEvent('ORDER_STATUS_CHANGED', orderId, 5000);
          assert('收到 ORDER_STATUS_CHANGED 事件', checkoutEvent.event === 'ORDER_STATUS_CHANGED', `event=${checkoutEvent.event}`);
          assert('事件 status 為 PAID', checkoutEvent.status === 'PAID', `status=${checkoutEvent.status}`);
          assert('事件 orderId 正確', checkoutEvent.orderId === orderId);
        } catch (e) {
          assert('收到 ORDER_STATUS_CHANGED 事件', false, e.message);
        }
      }
 
      // Cleanup
      await httpRequest('DELETE', `/orders/${orderId}`);
    }

    // 4. Latency test
    console.log('\n📡 測試 4: 廣播延遲驗證 (< 1 秒)...');
    const startTime = Date.now();
    const orderRes2 = await httpRequest('POST', '/orders', {
      tableId: firstTable.id,
      items: [{ productId: availableProduct.id, quantity: 1, note: '延遲測試' }]
    });

    if (orderRes2.body.code === 200) {
      try {
        const oid = orderRes2.body.data.id;
        await waitForEvent('ORDER_CREATED', oid, 3000);
        const latency = Date.now() - startTime;
        assert(`廣播延遲 ${latency}ms (需 < 1000ms)`, latency < 1000);
 
        // Cleanup
        await httpRequest('POST', `/orders/${oid}/checkout`);
        await waitForEvent('ORDER_STATUS_CHANGED', oid, 3000).catch(() => {});
        await httpRequest('DELETE', `/orders/${oid}`);
      } catch (e) {
        assert('廣播延遲驗證', false, e.message);
      }
    }
  }

  // Close
  conn.close();

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`📊 測試結果: ${passed} 通過, ${failed} 失敗 (共 ${passed + failed} 項)`);
  console.log('='.repeat(50));
  results.forEach(r => console.log(r));

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('測試失敗:', err);
  process.exit(1);
});
