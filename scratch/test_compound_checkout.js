const API_BASE_URL = 'http://localhost:8080/api';

let adminToken = '';
let waiterToken = '';

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

async function checkoutOrder(orderId, payload, token) {
  const res = await fetch(`${API_BASE_URL}/orders/${orderId}/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: payload ? JSON.stringify(payload) : undefined
  });
  const json = await res.json();
  return { status: res.status, ok: res.ok, json };
}

async function getOrder(orderId, token) {
  const res = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch order ${orderId}`);
  }
  const json = await res.json();
  return json.data;
}

async function getTable(tableId, token) {
  const res = await fetch(`${API_BASE_URL}/tables/${tableId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch table ${tableId}`);
  }
  const json = await res.json();
  return json.data;
}

async function runTests() {
  console.log('=== Starting POS-56 Compound Checkout & E-Invoice Integration Tests ===\n');

  try {
    // 0. Perform logins
    console.log('Logging in to obtain JWT tokens...');
    adminToken = await login('admin', 'admin123');
    console.log('✓ Admin token obtained');
    waiterToken = await login('waiter', 'waiter123');
    console.log('✓ Waiter token obtained\n');

    // ----------------------------------------------------
    // TEST 1: Downwards Compatible Checkout (No payload)
    // ----------------------------------------------------
    console.log('Test 1: Standard Checkout (No payload, should default to 100% Cash)...');
    
    // Create an order first (T1, 1 qty of 招牌滷肉飯 - Price $50)
    const payload1 = {
      tableId: 1,
      items: [{ productId: 1, quantity: 1, note: 'Test 1' }]
    };
    const order1 = await createOrder(payload1, waiterToken);
    console.log(`✓ Order 1 created: ${order1.orderNo}, status: ${order1.status}, total: ${order1.totalAmount}`);

    // Checkout with no payload (body is null/undefined)
    const res1 = await checkoutOrder(order1.id, null, waiterToken);
    if (!res1.ok || res1.json.code !== 200) {
      throw new Error(`Test 1 Checkout failed: ${res1.json.message}`);
    }
    console.log(`✓ Checkout status: ${res1.json.message}`);

    // Verify order in database
    const checkedOrder1 = await getOrder(order1.id, waiterToken);
    console.log(`✓ Status after checkout: ${checkedOrder1.status} (Expected: PAID)`);
    console.log(`✓ Generated Invoice No: ${checkedOrder1.invoiceNo}`);
    console.log(`✓ Payments: ${JSON.stringify(checkedOrder1.payments)}`);

    if (checkedOrder1.status !== 'PAID') {
      throw new Error(`Expected status to be PAID, got ${checkedOrder1.status}`);
    }
    if (!checkedOrder1.invoiceNo || !/^[A-Z]{2}-[0-9]{8}$/.test(checkedOrder1.invoiceNo)) {
      throw new Error(`Invalid invoice number format: ${checkedOrder1.invoiceNo}`);
    }
    if (checkedOrder1.payments.length !== 1 || checkedOrder1.payments[0].paymentMethod !== 'CASH' || Number(checkedOrder1.payments[0].amount) !== 50) {
      throw new Error(`Invalid payments records: ${JSON.stringify(checkedOrder1.payments)}`);
    }
    console.log('✓ Test 1 Passed!\n');

    // ----------------------------------------------------
    // TEST 2: Carrier and Charity Code Validation
    // ----------------------------------------------------
    console.log('Test 2: Carrier and Charity Code Validations...');

    // Create order 2
    const order2 = await createOrder({
      tableId: 1,
      items: [{ productId: 1, quantity: 1, note: 'Test 2' }]
    }, waiterToken);

    // 2a. Rejection when both carrier and charity code are provided
    console.log('2a. Trying checkout with both carrier and charity code...');
    const res2a = await checkoutOrder(order2.id, {
      carrierNo: '/AB12345',
      loveCode: '888',
      payments: [{ paymentMethod: 'CASH', amount: 50 }]
    }, waiterToken);
    console.log(`✓ Got status: ${res2a.status}, message: ${res2a.json.message} (Expected error)`);
    if (res2a.status !== 400 || !res2a.json.message.includes('手機載具與愛心碼不可同時使用')) {
      throw new Error(`Expected 400 with '手機載具與愛心碼不可同時使用', got ${res2a.status} - ${res2a.json.message}`);
    }

    // 2b. Rejection with invalid carrier format
    console.log('2b. Trying checkout with invalid carrier format...');
    const res2b = await checkoutOrder(order2.id, {
      carrierNo: 'AB12345', // Missing leading '/'
      payments: [{ paymentMethod: 'CASH', amount: 50 }]
    }, waiterToken);
    console.log(`✓ Got status: ${res2b.status}, message: ${res2b.json.message} (Expected error)`);
    if (res2b.status !== 400 || !res2b.json.message.includes('手機載具格式不符合規範')) {
      throw new Error(`Expected 400 with '手機載具格式不符合規範', got ${res2b.status} - ${res2b.json.message}`);
    }

    // 2c. Rejection with invalid charity code format
    console.log('2c. Trying checkout with invalid charity code format...');
    const res2c = await checkoutOrder(order2.id, {
      loveCode: 'ab', // Not numbers, too short
      payments: [{ paymentMethod: 'CASH', amount: 50 }]
    }, waiterToken);
    console.log(`✓ Got status: ${res2c.status}, message: ${res2c.json.message} (Expected error)`);
    if (res2c.status !== 400 || !res2c.json.message.includes('愛心碼格式不符合規範')) {
      throw new Error(`Expected 400 with '愛心碼格式不符合規範', got ${res2c.status} - ${res2c.json.message}`);
    }
    console.log('✓ Test 2 Passed!\n');

    // ----------------------------------------------------
    // TEST 3: Split Payments Checkout (CASH + LINE_PAY)
    // ----------------------------------------------------
    console.log('Test 3: Split Payments Checkout with Mobile Carrier...');

    // Create order 3 (T1, 2 qty of 招牌滷肉飯 - Price $100)
    const order3 = await createOrder({
      tableId: 1,
      items: [{ productId: 1, quantity: 2, note: 'Test 3' }]
    }, waiterToken);
    console.log(`✓ Order 3 created: ${order3.orderNo}, status: ${order3.status}, total: ${order3.totalAmount}`);

    // Checkout with Cash 60 + LINE_PAY 40, and carrier /AB123.5+
    const res3 = await checkoutOrder(order3.id, {
      carrierNo: '/AB123.5',
      payments: [
        { paymentMethod: 'CASH', amount: 60 },
        { paymentMethod: 'LINE_PAY', amount: 40 }
      ]
    }, waiterToken);
    if (!res3.ok || res3.json.code !== 200) {
      throw new Error(`Test 3 Checkout failed: ${res3.json.message}`);
    }
    console.log(`✓ Checkout status: ${res3.json.message}`);

    // Verify order in database
    const checkedOrder3 = await getOrder(order3.id, waiterToken);
    console.log(`✓ Status after checkout: ${checkedOrder3.status} (Expected: PAID)`);
    console.log(`✓ Generated Invoice No: ${checkedOrder3.invoiceNo}`);
    console.log(`✓ Carrier No: ${checkedOrder3.carrierNo}`);
    console.log(`✓ Payments: ${JSON.stringify(checkedOrder3.payments)}`);

    if (checkedOrder3.status !== 'PAID') {
      throw new Error(`Expected status to be PAID, got ${checkedOrder3.status}`);
    }
    if (checkedOrder3.carrierNo !== '/AB123.5') {
      throw new Error(`Expected carrierNo to be /AB123.5, got ${checkedOrder3.carrierNo}`);
    }
    if (checkedOrder3.payments.length !== 2) {
      throw new Error(`Expected 2 payment records, got ${checkedOrder3.payments.length}`);
    }
    const cashPay = checkedOrder3.payments.find(p => p.paymentMethod === 'CASH');
    const lpPay = checkedOrder3.payments.find(p => p.paymentMethod === 'LINE_PAY');
    if (!cashPay || Number(cashPay.amount) !== 60 || !lpPay || Number(lpPay.amount) !== 40) {
      throw new Error(`Payment records mismatch: ${JSON.stringify(checkedOrder3.payments)}`);
    }
    console.log('✓ Test 3 Passed!\n');

    // ----------------------------------------------------
    // TEST 4: Invalid Payment Total Amount
    // ----------------------------------------------------
    console.log('Test 4: Rejection when payment sum does not match order total...');

    // Create order 4
    const order4 = await createOrder({
      tableId: 1,
      items: [{ productId: 1, quantity: 1, note: 'Test 4' }]
    }, waiterToken);

    // Checkout with Cash 20 + LINE_PAY 20 (Sum 40, Order Total 50)
    const res4 = await checkoutOrder(order4.id, {
      payments: [
        { paymentMethod: 'CASH', amount: 20 },
        { paymentMethod: 'LINE_PAY', amount: 20 }
      ]
    }, waiterToken);
    console.log(`✓ Got status: ${res4.status}, message: ${res4.json.message} (Expected error)`);
    if (res4.status !== 400 || !res4.json.message.includes('必須等於訂單總金額')) {
      throw new Error(`Expected 400 with '必須等於訂單總金額', got ${res4.status} - ${res4.json.message}`);
    }
    console.log('✓ Test 4 Passed!\n');

    // ----------------------------------------------------
    // TEST 5: Split Checkout Table Status Verification
    // ----------------------------------------------------
    console.log('Test 5: Split Checkout Table Status Verification...');

    // Create order 5a for Table 2
    const order5a = await createOrder({
      tableId: 2,
      items: [{ productId: 1, quantity: 1, note: 'Order 5a' }]
    }, waiterToken);
    
    // Create order 5b for Table 2
    const order5b = await createOrder({
      tableId: 2,
      items: [{ productId: 1, quantity: 1, note: 'Order 5b' }]
    }, waiterToken);
    
    // Verify Table 2 is OCCUPIED
    const tBefore = await getTable(2, waiterToken);
    console.log(`✓ Table 2 status before checkout: ${tBefore.status} (Expected: OCCUPIED)`);
    if (tBefore.status !== 'OCCUPIED') {
      throw new Error(`Expected Table 2 status to be OCCUPIED, got ${tBefore.status}`);
    }

    // Checkout Order 5a (leaving Order 5b active)
    console.log('Checking out Order 5a...');
    const res5a = await checkoutOrder(order5a.id, {
      payments: [{ paymentMethod: 'CASH', amount: 50 }]
    }, waiterToken);
    if (!res5a.ok || res5a.json.code !== 200) {
      throw new Error(`Checkout Order 5a failed: ${res5a.json.message}`);
    }

    // Table 2 status should remain OCCUPIED because Order 5b is still active
    const tMiddle = await getTable(2, waiterToken);
    console.log(`✓ Table 2 status after Order 5a checkout: ${tMiddle.status} (Expected: OCCUPIED)`);
    if (tMiddle.status !== 'OCCUPIED') {
      throw new Error(`Expected Table 2 status to remain OCCUPIED, got ${tMiddle.status}`);
    }

    // Checkout Order 5b (no other active orders on Table 2)
    console.log('Checking out Order 5b...');
    const res5b = await checkoutOrder(order5b.id, {
      payments: [{ paymentMethod: 'CASH', amount: 50 }]
    }, waiterToken);
    if (!res5b.ok || res5b.json.code !== 200) {
      throw new Error(`Checkout Order 5b failed: ${res5b.json.message}`);
    }

    // Table 2 status should change to CLEANING because all orders are paid
    const tAfter = await getTable(2, waiterToken);
    console.log(`✓ Table 2 status after Order 5b checkout: ${tAfter.status} (Expected: CLEANING)`);
    if (tAfter.status !== 'CLEANING') {
      throw new Error(`Expected Table 2 status to be CLEANING, got ${tAfter.status}`);
    }
    console.log('✓ Test 5 Passed!\n');

    console.log('===================================================');
    console.log('🎉 ALL COMPOUND CHECKOUT & INVOICE TESTS PASSED! 🎉');
    console.log('===================================================');

  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

runTests();
