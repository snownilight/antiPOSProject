const API_BASE_URL = 'http://localhost:8080/api';

let adminToken = '';
let waiterToken = '';
let customerToken = '';

async function login(username, password) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    throw new Error(`Failed to login for ${username}: ${res.status}`);
  }
  const json = await res.json();
  if (json.code !== 200 || !json.data || !json.data.token) {
    throw new Error(`Login failed for ${username}: ${json.message}`);
  }
  return json.data.token;
}

async function getCustomerToken(tableToken) {
  const res = await fetch(`${API_BASE_URL}/tables/token/${tableToken}`);
  if (!res.ok) {
    throw new Error(`Failed to get table by token: ${res.status}`);
  }
  const json = await res.json();
  if (json.code !== 200 || !json.data || !json.data.jwtToken) {
    throw new Error(`Customer login failed: ${json.message}`);
  }
  return json.data.jwtToken;
}

async function fetchProduct(productId) {
  const res = await fetch(`${API_BASE_URL}/products/${productId}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch product ${productId}: ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

async function createOrder(payload, token) {
  const res = await fetch(`${API_BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!res.ok || json.code !== 200) {
    throw new Error(`Failed to create order: ${json.message || res.statusText}`);
  }
  return json.data;
}

async function updateOrderStatus(orderId, status, token) {
  const res = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status })
  });
  const json = await res.json();
  if (!res.ok || json.code !== 200) {
    throw new Error(`Failed to update order status to ${status}: ${json.message || res.statusText}`);
  }
  return json.data;
}

async function fetchDashboard() {
  const res = await fetch(`${API_BASE_URL}/dashboard/today`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch dashboard: ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

async function runTests() {
  console.log('=== Starting Combo Stock & Stats Integration Tests ===\n');

  try {
    // 0. Perform logins
    console.log('Logging in to obtain JWT tokens...');
    adminToken = await login('admin', 'admin123');
    waiterToken = await login('waiter', 'waiter123');
    customerToken = await getCustomerToken('token-t1');
    console.log('✓ All tokens obtained\n');

    // Fetch initial product stocks and dashboard sales
    const prod1_init = await fetchProduct(1);   // 招牌滷肉飯
    const prod3_init = await fetchProduct(3);   // 燙青菜 (B套餐固定子項)
    const prod5_init = await fetchProduct(5);   // 古早味紅茶 (B套餐固定子項)

    console.log(`[Initial Stock]`);
    console.log(`- 招牌滷肉飯 (ID 1): ${prod1_init.stock}`);
    console.log(`- 燙青菜 (ID 3): ${prod3_init.stock}`);
    console.log(`- 古早味紅茶 (ID 5): ${prod5_init.stock}`);
    console.log('');

    const initialDashboard = await fetchDashboard();
    const getInitialSales = (productId) => {
      const stats = initialDashboard.topProducts.find(p => p.productId === productId);
      return stats ? { single: stats.singleSold || 0, combo: stats.comboSold || 0, total: stats.quantitySold || 0 } : { single: 0, combo: 0, total: 0 };
    };

    const initSales1 = getInitialSales(1);
    const initSales3 = getInitialSales(3);
    const initSales5 = getInitialSales(5);

    console.log(`[Initial Sales in Dashboard]`);
    console.log(`- 招牌滷肉飯: Single: ${initSales1.single}, Combo: ${initSales1.combo}`);
    console.log(`- 燙青菜: Single: ${initSales3.single}, Combo: ${initSales3.combo}`);
    console.log(`- 古早味紅茶: Single: ${initSales5.single}, Combo: ${initSales5.combo}`);
    console.log('');

    // ----------------------------------------------------
    // TEST 1: Create B Combo Order & Verify Fixed Item Stock Deductions
    // ----------------------------------------------------
    console.log('Test 1: Ordering B Combo (招牌滷肉飯 + 升級 B 套餐)...');
    const orderPayload = {
      tableId: 1,
      items: [
        {
          productId: 1,
          quantity: 2,
          selectedOptions: [
            {
              optionId: 13, // 升級 B 套餐 (燙青菜 + 紅茶)
              bundleItems: [
                {
                  bundleItemId: 1, // 燙青菜
                  optionIds: []
                },
                {
                  bundleItemId: 2, // 紅茶
                  optionIds: [4, 8] // 無糖, 去冰
                }
              ]
            }
          ]
        }
      ]
    };

    const order = await createOrder(orderPayload, waiterToken);
    console.log(`✓ Order created: ${order.orderNo}, status: ${order.status}`);

    // Verify stock decrease for parent and fixed combo products
    const prod1_after = await fetchProduct(1);
    const prod3_after = await fetchProduct(3);
    const prod5_after = await fetchProduct(5);

    console.log(`[After Order Stock]`);
    console.log(`- 招牌滷肉飯: ${prod1_after.stock} (Expected: ${prod1_init.stock - 2})`);
    console.log(`- 燙青菜: ${prod3_after.stock} (Expected: ${prod3_init.stock - 2})`);
    console.log(`- 古早味紅茶: ${prod5_after.stock} (Expected: ${prod5_init.stock - 2})`);

    if (prod1_after.stock !== prod1_init.stock - 2) {
      throw new Error('Stock deduction failed for 招牌滷肉飯');
    }
    if (prod3_after.stock !== prod3_init.stock - 2) {
      throw new Error('Stock deduction failed for combo item 燙青菜');
    }
    if (prod5_after.stock !== prod5_init.stock - 2) {
      throw new Error('Stock deduction failed for combo item 古早味紅茶');
    }
    console.log('✓ Test 1 Passed! Fixed combo item stock deduction verified.\n');

    // ----------------------------------------------------
    // TEST 2: Pay Order & Verify Dashboard Sales Stats (Single vs Combo Split)
    // ----------------------------------------------------
    console.log('Test 2: Paying order and verifying dashboard stats...');
    await updateOrderStatus(order.id, 'PAID', waiterToken);
    console.log('✓ Order paid.');

    let dashboard = await fetchDashboard();
    console.log('Fetched dashboard data after payment.');

    // Helper to print product stats from dashboard
    const printProductStats = (productId) => {
      const stats = dashboard.topProducts.find(p => p.productId === productId);
      if (!stats) {
        console.log(`- Product ID ${productId}: No sales record found in dashboard.`);
        return null;
      }
      console.log(`- Product "${stats.productName}" (ID ${productId}, Category "${stats.categoryName}"):`);
      console.log(`    Total: ${stats.quantitySold}, Single: ${stats.singleSold}, Combo: ${stats.comboSold}`);
      return stats;
    };

    const stats1 = printProductStats(1);
    const stats3 = printProductStats(3);
    const stats5 = printProductStats(5);

    if (!stats1 || stats1.singleSold !== initSales1.single + 2 || stats1.comboSold !== initSales1.combo) {
      throw new Error(`Stats mismatch for 招牌滷肉飯: expected Single: ${initSales1.single + 2}, Combo: ${initSales1.combo}, got Single: ${stats1.singleSold}, Combo: ${stats1.comboSold}`);
    }
    if (!stats3 || stats3.singleSold !== initSales3.single || stats3.comboSold !== initSales3.combo + 2) {
      throw new Error(`Stats mismatch for 燙青菜: expected Single: ${initSales3.single}, Combo: ${initSales3.combo + 2}, got Single: ${stats3.singleSold}, Combo: ${stats3.comboSold}`);
    }
    if (!stats5 || stats5.singleSold !== initSales5.single || stats5.comboSold !== initSales5.combo + 2) {
      throw new Error(`Stats mismatch for 古早味紅茶: expected Single: ${initSales5.single}, Combo: ${initSales5.combo + 2}, got Single: ${stats5.singleSold}, Combo: ${stats5.comboSold}`);
    }
    console.log('✓ Test 2 Passed! Single vs. Combo sales statistics verified.\n');

    // ----------------------------------------------------
    // TEST 3: Create Single Order & Verify Split Sum
    // ----------------------------------------------------
    console.log('Test 3: Ordering Single "古早味紅茶" (Product 5) and paying...');
    const singlePayload = {
      tableId: 1,
      items: [
        {
          productId: 5, // 古早味紅茶
          quantity: 1,
          optionIds: [3, 6] // 微糖, 少冰
        }
      ]
    };

    const orderSingle = await createOrder(singlePayload, waiterToken);
    await updateOrderStatus(orderSingle.id, 'PAID', waiterToken);
    console.log(`✓ Single order paid: ${orderSingle.orderNo}`);

    dashboard = await fetchDashboard();
    const stats5_final = printProductStats(5);

    if (!stats5_final || stats5_final.singleSold !== initSales5.single + 1 || stats5_final.comboSold !== initSales5.combo + 2 || stats5_final.quantitySold !== initSales5.total + 3) {
      throw new Error(`Stats mismatch for 古早味紅茶 after single order: expected Single: ${initSales5.single + 1}, Combo: ${initSales5.combo + 2}, Total: ${initSales5.total + 3}, got Single: ${stats5_final.singleSold}, Combo: ${stats5_final.comboSold}, Total: ${stats5_final.quantitySold}`);
    }
    console.log('✓ Test 3 Passed! Aggregate single vs combo stats verified.\n');

    console.log('==================================================');
    console.log('🎉 ALL COMBO STOCK & STATS INTEGRATION TESTS PASSED 🎉');
    console.log('==================================================');

  } catch (error) {
    console.error('\n❌ Integration Test failed:', error.message);
    process.exit(1);
  }
}

// Wait for a few seconds to let backend spin up before running tests
console.log('Waiting 5 seconds for backend to start up...');
setTimeout(runTests, 5000);
