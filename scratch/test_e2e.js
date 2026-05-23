/**
 * antiPOS 專案端對端 API 測試（含邊緣條件）
 * 
 * 測試範圍：
 *   1. Category（分類）— CRUD + 邊緣條件
 *   2. Product（商品）— CRUD + 狀態切換 + 邊緣條件
 *   3. DiningTable（桌台）— CRUD + 狀態流轉 + 邊緣條件
 *   4. CORS 驗證
 */

const BASE = 'http://localhost:8081/api';
let passed = 0;
let failed = 0;
const failures = [];

// ─── 測試工具 ─────────────────────────────────
async function api(method, path, body = undefined) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  return res.json();
}

function assert(testName, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}${detail ? ' — ' + detail : ''}`);
    failed++;
    failures.push(testName);
  }
}

// ─── 1. Category 測試 ──────────────────────────
async function testCategory() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   1. Category（分類）測試            ║');
  console.log('╚══════════════════════════════════════╝');

  // --- 正常流程 ---
  console.log('\n--- 正常流程 ---');
  
  // 取得所有分類
  let json = await api('GET', '/categories');
  assert('GET /categories 回傳 200', json.code === 200);
  assert('初始分類數量 >= 1', json.data.length >= 1);
  const initialCount = json.data.length;

  // 新增分類
  json = await api('POST', '/categories', { name: 'E2E測試分類', sortOrder: 999 });
  assert('POST 建立分類回傳 200', json.code === 200);
  assert('回傳資料含有 id', json.data?.id != null);
  const catId = json.data.id;

  // 取得單筆
  json = await api('GET', `/categories/${catId}`);
  assert('GET 單筆分類名稱正確', json.data?.name === 'E2E測試分類');
  assert('GET 單筆排序權重正確', json.data?.sortOrder === 999);

  // 更新分類
  json = await api('PUT', `/categories/${catId}`, { name: 'E2E更新後分類', sortOrder: 888 });
  assert('PUT 更新分類回傳 200', json.code === 200);
  assert('更新後名稱正確', json.data?.name === 'E2E更新後分類');
  assert('更新後排序正確', json.data?.sortOrder === 888);

  // 刪除分類（軟刪除）
  json = await api('DELETE', `/categories/${catId}`);
  assert('DELETE 軟刪除回傳 200', json.code === 200);

  // 確認已被軟刪除（不在列表中）
  json = await api('GET', '/categories');
  const found = json.data.find(c => c.id === catId);
  assert('軟刪除後列表中不包含該筆', found === undefined);
  assert('分類數量回復原始', json.data.length === initialCount);

  // --- 邊緣條件 ---
  console.log('\n--- 邊緣條件 ---');

  // 名稱為空
  json = await api('POST', '/categories', { name: '', sortOrder: 0 });
  assert('空字串名稱 → 400', json.code === 400);

  // 名稱為 null
  json = await api('POST', '/categories', { sortOrder: 0 });
  assert('缺少 name 欄位 → 400', json.code === 400);

  // 名稱僅空白
  json = await api('POST', '/categories', { name: '   ', sortOrder: 0 });
  assert('僅空白字串名稱 → 400', json.code === 400);

  // 排序為負數
  json = await api('POST', '/categories', { name: '負數排序', sortOrder: -1 });
  assert('負數排序權重 → 400', json.code === 400);

  // 查詢不存在的 ID
  json = await api('GET', '/categories/99999');
  assert('查詢不存在 ID → 500 或無資料', json.code !== 200 || json.data == null);

  // 超長名稱（超過 100 字元）
  const longName = 'A'.repeat(101);
  json = await api('POST', '/categories', { name: longName, sortOrder: 0 });
  assert('超長名稱 (101 字元) → 400', json.code === 400);

  // 邊界值：剛好 100 字元應通過
  const exactName = 'B'.repeat(100);
  json = await api('POST', '/categories', { name: exactName, sortOrder: 0 });
  assert('名稱剛好 100 字元 → 200', json.code === 200);
  if (json.data?.id) await api('DELETE', `/categories/${json.data.id}`); // 清理
}

// ─── 2. Product 測試 ──────────────────────────
async function testProduct() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   2. Product（商品）測試             ║');
  console.log('╚══════════════════════════════════════╝');

  // --- 正常流程 ---
  console.log('\n--- 正常流程 ---');

  let json = await api('GET', '/products');
  assert('GET /products 回傳 200', json.code === 200);
  const initialCount = json.data.length;

  // 新增商品
  json = await api('POST', '/products', {
    name: 'E2E測試商品',
    categoryId: 1,
    price: 123.50,
    description: '端對端測試用商品',
    status: 'AVAILABLE'
  });
  assert('POST 建立商品回傳 200', json.code === 200);
  assert('回傳含 id', json.data?.id != null);
  const prodId = json.data.id;

  // 篩選分類
  json = await api('GET', '/products?categoryId=1');
  assert('篩選分類 ID=1 回傳 200', json.code === 200);
  const allInCat1 = json.data.every(p => p.categoryId === 1);
  assert('篩選結果全部屬於分類 1', allInCat1);

  // 更新商品
  json = await api('PUT', `/products/${prodId}`, {
    name: 'E2E更新商品',
    categoryId: 1,
    price: 200.00,
    description: '已更新',
    status: 'AVAILABLE'
  });
  assert('PUT 更新商品回傳 200', json.code === 200);
  assert('更新後價格正確', json.data?.price === 200.0 || json.data?.price === 200);

  // 切換狀態
  json = await api('PATCH', `/products/${prodId}/status`, { status: 'SOLD_OUT' });
  assert('PATCH 狀態切換至 SOLD_OUT → 200', json.code === 200);

  json = await api('PATCH', `/products/${prodId}/status`, { status: 'HIDDEN' });
  assert('PATCH 狀態切換至 HIDDEN → 200', json.code === 200);

  json = await api('PATCH', `/products/${prodId}/status`, { status: 'AVAILABLE' });
  assert('PATCH 狀態切換回 AVAILABLE → 200', json.code === 200);

  // 刪除
  json = await api('DELETE', `/products/${prodId}`);
  assert('DELETE 軟刪除商品 → 200', json.code === 200);

  json = await api('GET', '/products');
  assert('刪除後商品數量回復', json.data.length === initialCount);

  // --- 邊緣條件 ---
  console.log('\n--- 邊緣條件 ---');

  // 缺少必要欄位
  json = await api('POST', '/products', { categoryId: 1, price: 50 });
  assert('缺少 name → 400', json.code === 400);

  json = await api('POST', '/products', { name: '測試', price: 50 });
  assert('缺少 categoryId → 400', json.code === 400);

  json = await api('POST', '/products', { name: '測試', categoryId: 1 });
  assert('缺少 price → 400', json.code === 400);

  // 不合法值
  json = await api('POST', '/products', { name: '測試', categoryId: 1, price: -10 });
  assert('負數價格 → 400', json.code === 400);

  json = await api('POST', '/products', { name: '', categoryId: 1, price: 50 });
  assert('空字串商品名 → 400', json.code === 400);

  // 狀態切換邊緣
  json = await api('PATCH', `/products/${prodId}/status`, {});
  assert('缺少 status 欄位 → 400', json.code === 400);

  json = await api('PATCH', `/products/${prodId}/status`, { status: '' });
  assert('空字串 status → 400', json.code === 400);

  // 超長名稱（超過 200 字元）
  json = await api('POST', '/products', {
    name: 'X'.repeat(201),
    categoryId: 1,
    price: 10
  });
  assert('商品名 201 字元 → 400', json.code === 400);

  // 價格 0 應通過
  json = await api('POST', '/products', { name: '免費贈品', categoryId: 1, price: 0 });
  assert('價格 0 → 200（免費合法）', json.code === 200);
  if (json.data?.id) await api('DELETE', `/products/${json.data.id}`);

  // 超長描述
  json = await api('POST', '/products', {
    name: '描述測試',
    categoryId: 1,
    price: 10,
    description: 'D'.repeat(501)
  });
  assert('描述超過 500 字元 → 400', json.code === 400);
}

// ─── 3. DiningTable 測試 ─────────────────────
async function testDiningTable() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   3. DiningTable（桌台）測試         ║');
  console.log('╚══════════════════════════════════════╝');

  // --- 正常流程 ---
  console.log('\n--- 正常流程 ---');

  let json = await api('GET', '/tables');
  assert('GET /tables 回傳 200', json.code === 200);
  const initialCount = json.data.length;

  // 新增桌台
  json = await api('POST', '/tables', { name: 'E2E-T1', seats: 6 });
  assert('POST 建立桌台 → 200', json.code === 200);
  assert('預設狀態為 EMPTY', json.data?.status === 'EMPTY');
  const tableId = json.data.id;

  // 狀態流轉：EMPTY → OCCUPIED → CLEANING → EMPTY
  json = await api('PATCH', `/tables/${tableId}/status`, { status: 'OCCUPIED' });
  assert('狀態流轉 EMPTY→OCCUPIED → 200', json.code === 200);
  assert('狀態確認為 OCCUPIED', json.data?.status === 'OCCUPIED');

  json = await api('PATCH', `/tables/${tableId}/status`, { status: 'CLEANING' });
  assert('狀態流轉 OCCUPIED→CLEANING → 200', json.code === 200);
  assert('狀態確認為 CLEANING', json.data?.status === 'CLEANING');

  json = await api('PATCH', `/tables/${tableId}/status`, { status: 'EMPTY' });
  assert('狀態流轉 CLEANING→EMPTY → 200', json.code === 200);
  assert('狀態確認為 EMPTY', json.data?.status === 'EMPTY');

  // 更新桌台資訊
  json = await api('PUT', `/tables/${tableId}`, { name: 'E2E-Updated', seats: 10 });
  assert('PUT 更新桌台 → 200', json.code === 200);
  assert('更新後名稱正確', json.data?.name === 'E2E-Updated');
  assert('更新後座位數正確', json.data?.seats === 10);

  // 軟刪除
  json = await api('DELETE', `/tables/${tableId}`);
  assert('DELETE 軟刪除桌台 → 200', json.code === 200);

  json = await api('GET', '/tables');
  assert('刪除後桌台數量回復', json.data.length === initialCount);

  // --- 邊緣條件 ---
  console.log('\n--- 邊緣條件 ---');

  // 名稱驗證
  json = await api('POST', '/tables', { name: '', seats: 4 });
  assert('空字串桌台名 → 400', json.code === 400);

  json = await api('POST', '/tables', { seats: 4 });
  assert('缺少 name → 400', json.code === 400);

  json = await api('POST', '/tables', { name: '   ', seats: 4 });
  assert('僅空白桌台名 → 400', json.code === 400);

  // 座位數驗證
  json = await api('POST', '/tables', { name: 'Test', seats: 0 });
  assert('座位數 0 → 400', json.code === 400);

  json = await api('POST', '/tables', { name: 'Test', seats: -5 });
  assert('座位數負數 → 400', json.code === 400);

  // 座位數邊界值：1 應通過
  json = await api('POST', '/tables', { name: 'Seat1Test', seats: 1 });
  assert('座位數 1（最小合法值）→ 200', json.code === 200);
  if (json.data?.id) await api('DELETE', `/tables/${json.data.id}`);

  // 不合法狀態
  json = await api('POST', '/tables', { name: 'BadStatus', seats: 4 });
  const tmpId = json.data?.id;
  if (tmpId) {
    json = await api('PATCH', `/tables/${tmpId}/status`, { status: 'INVALID_STATUS' });
    assert('不合法狀態值 → 400', json.code === 400);

    json = await api('PATCH', `/tables/${tmpId}/status`, {});
    assert('缺少 status 欄位 → 400', json.code === 400);

    json = await api('PATCH', `/tables/${tmpId}/status`, { status: '' });
    assert('空字串 status → 400', json.code === 400);

    await api('DELETE', `/tables/${tmpId}`); // 清理
  }

  // 超長名稱
  json = await api('POST', '/tables', { name: 'T'.repeat(51), seats: 2 });
  assert('桌台名超過 50 字元 → 400', json.code === 400);

  // 操作已刪除的桌台
  json = await api('GET', `/tables/${tableId}`);
  assert('查詢已軟刪除桌台 → 回傳無資料', json.code !== 200 || json.data == null);
}

// ─── 4. 跨模組邊緣條件 ─────────────────────────
async function testCrossModule() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   4. 跨模組與其他邊緣條件測試       ║');
  console.log('╚══════════════════════════════════════╝');

  // 不存在的路徑
  let res = await fetch(`${BASE}/nonexistent`);
  let json = await res.json().catch(() => ({ code: res.status }));
  assert('不存在的 API 路徑 → 非 200', res.status !== 200 || json.code !== 200);

  // Content-Type 錯誤
  res = await fetch(`${BASE}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'not json'
  });
  json = await res.json().catch(() => ({ code: res.status }));
  assert('非 JSON Content-Type → 非 200', res.status !== 200);

  // 空 body
  res = await fetch(`${BASE}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: ''
  });
  json = await res.json().catch(() => ({ code: res.status }));
  assert('空 body POST 分類 → 非 200', res.status !== 200);

  // 無效 JSON
  res = await fetch(`${BASE}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalid json}'
  });
  json = await res.json().catch(() => ({ code: res.status }));
  assert('無效 JSON body → 非 200', res.status !== 200);

  // 特殊字元名稱（SQL injection 測試）
  json = await api('POST', '/categories', { name: "'; DROP TABLE category; --", sortOrder: 0 });
  assert('SQL 注入字串作為名稱 → 正常處理', json.code === 200);
  if (json.data?.id) {
    // 驗證名稱確實被存為字串而非執行
    const verify = await api('GET', `/categories/${json.data.id}`);
    assert('SQL 注入字串被安全儲存', verify.data?.name === "'; DROP TABLE category; --");
    await api('DELETE', `/categories/${json.data.id}`);
  }

  // XSS 攻擊字串
  json = await api('POST', '/categories', { name: '<script>alert("xss")</script>', sortOrder: 0 });
  assert('XSS 攻擊字串作為名稱 → 正常處理', json.code === 200);
  if (json.data?.id) {
    const verify = await api('GET', `/categories/${json.data.id}`);
    assert('XSS 字串被安全儲存為純文字', verify.data?.name === '<script>alert("xss")</script>');
    await api('DELETE', `/categories/${json.data.id}`);
  }

  // 中文 / 特殊 Unicode
  json = await api('POST', '/categories', { name: '🍜 拉麵（限定版）', sortOrder: 0 });
  assert('中文 + Emoji 名稱 → 200', json.code === 200);
  if (json.data?.id) {
    const verify = await api('GET', `/categories/${json.data.id}`);
    assert('中文 + Emoji 正確儲存', verify.data?.name === '🍜 拉麵（限定版）');
    await api('DELETE', `/categories/${json.data.id}`);
  }
}

// ─── 主程式 ─────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   antiPOS 專案端對端 API 測試（含邊緣條件）     ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║   測試時間：${new Date().toLocaleString('zh-TW')}          ║`);
  console.log('╚══════════════════════════════════════════════════╝');

  await testCategory();
  await testProduct();
  await testDiningTable();
  await testCrossModule();

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║               測試結果摘要                      ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║   ✅ 通過：${String(passed).padStart(3)} 個                              ║`);
  console.log(`║   ❌ 失敗：${String(failed).padStart(3)} 個                              ║`);
  console.log(`║   合計：${String(passed + failed).padStart(3)} 個                                ║`);
  console.log('╚══════════════════════════════════════════════════╝');

  if (failures.length > 0) {
    console.log('\n失敗項目：');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }
}

main().catch(console.error);
