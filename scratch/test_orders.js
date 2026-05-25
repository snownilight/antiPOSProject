const http = require('http');

const BASE_URL = 'http://localhost:8080';
let token = '';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method: method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    if (body) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== starting E2E Order System API tests ===\n');

  try {
    // Obtain JWT token
    console.log('Logging in to obtain JWT token...');
    const loginRes = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
    if (loginRes.status !== 200 || !loginRes.body.data?.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
    }
    token = loginRes.body.data.token;
    console.log('✓ Token obtained successfully.\n');

    // 0. Ensure table 2 is EMPTY at startup
    console.log('0. Preparing Table 2 status to EMPTY...');
    await request('PATCH', '/api/tables/2/status', { status: 'EMPTY' });

    // 1. Create first order for Table 2
    console.log('1. Creating order 1 for Table 2...');
    const order1Res = await request('POST', '/api/orders', {
      tableId: 2,
      items: [
        { productId: 1, quantity: 2, note: '少油' }, // 招牌滷肉飯: 50.00 * 2 = 100.00
        { productId: 3, quantity: 1, note: null }    // 燙青菜: 40.00 * 1 = 40.00
      ]
    });

    if (order1Res.status !== 200 || order1Res.body.code !== 200) {
      throw new Error(`Failed to create order 1: ${JSON.stringify(order1Res.body)}`);
    }

    const order1 = order1Res.body.data;
    console.log(`-> Order 1 created successfully: ${order1.orderNo}`);
    console.log(`-> Total Amount: ${order1.totalAmount} (Expected: 140.00)`);
    if (order1.totalAmount !== 140.00) {
      throw new Error(`Total amount mismatch. Got ${order1.totalAmount}, expected 140.00`);
    }

    // Validate 15-character order number format: TW-YYMMDD-XXXXX
    const orderNo = order1.orderNo;
    console.log(`-> Validating order number format: ${orderNo}`);
    if (orderNo.length !== 15) {
      throw new Error(`Order number length is ${orderNo.length}, expected 15.`);
    }
    const orderNoPattern = /^TW-\d{6}-[0-9A-Z]{5}$/;
    if (!orderNoPattern.test(orderNo)) {
      throw new Error(`Order number format is invalid: ${orderNo}`);
    }
    // Check for excluded characters I, O, L, U
    const serial = orderNo.split('-')[2];
    if (/[IOLU]/i.test(serial)) {
      throw new Error(`Order serial contains forbidden characters I, O, L, or U: ${serial}`);
    }
    console.log('-> Order number format is VALID!');

    // 2. Check if table 2 status is updated to OCCUPIED
    console.log('2. Verifying Table 2 status has changed to OCCUPIED...');
    const tableRes = await request('GET', '/api/tables/2');
    if (tableRes.body.data.status !== 'OCCUPIED') {
      throw new Error(`Expected Table 2 status to be OCCUPIED, got ${tableRes.body.data.status}`);
    }
    console.log('-> Table 2 status is OCCUPIED!');

    // 3. Create second order for Table 2 (testing that multiple PENDING orders are allowed)
    console.log('3. Creating second order for Table 2 (should be allowed)...');
    const order2Res = await request('POST', '/api/orders', {
      tableId: 2,
      items: [
        { productId: 5, quantity: 3, note: '去冰', optionIds: [4, 8] } // 古早味紅茶: 30.00 * 3 = 90.00
      ]
    });

    if (order2Res.status !== 200 || order2Res.body.code !== 200) {
      throw new Error(`Failed to create order 2: ${JSON.stringify(order2Res.body)}`);
    }

    const order2 = order2Res.body.data;
    console.log(`-> Order 2 created successfully: ${order2.orderNo}`);
    console.log(`-> Total Amount: ${order2.totalAmount} (Expected: 90.00)`);
    if (order2.totalAmount !== 90.00) {
      throw new Error(`Total amount mismatch for order 2. Got ${order2.totalAmount}, expected 90.00`);
    }

    // 4. Retrieve order 1 details by id and orderNo
    console.log('4. Retrieving Order 1 details...');
    const getByIdRes = await request('GET', `/api/orders/${order1.id}`);
    const getByNoRes = await request('GET', `/api/orders/no/${order1.orderNo}`);

    if (getByIdRes.body.data.orderNo !== order1.orderNo || getByNoRes.body.data.id !== order1.id) {
      throw new Error('Get order details mismatch');
    }
    console.log('-> Get order details verified successfully!');
    console.log(`-> Table Name: ${getByIdRes.body.data.tableName} (Expected: T2)`);
    console.log('-> Items count:', getByIdRes.body.data.items.length);
    if (getByIdRes.body.data.items.length !== 2) {
      throw new Error(`Expected 2 items, got ${getByIdRes.body.data.items.length}`);
    }

    // 5. Pay order 1: table status should update to CLEANING
    console.log('5. Paying Order 1...');
    const payRes = await request('PATCH', `/api/orders/${order1.id}/status`, { status: 'PAID' });
    if (payRes.body.code !== 200 || payRes.body.data.status !== 'PAID') {
      throw new Error(`Failed to pay order 1: ${JSON.stringify(payRes.body)}`);
    }
    console.log('-> Order 1 status changed to PAID.');

    console.log('-> Checking table 2 status (expected: OCCUPIED since order 2 is still active)...');
    const tableRes2 = await request('GET', '/api/tables/2');
    if (tableRes2.body.data.status !== 'OCCUPIED') {
      throw new Error(`Expected Table 2 status to be OCCUPIED, got ${tableRes2.body.data.status}`);
    }
    console.log('-> Table 2 status is OCCUPIED!');

    // 6. Cancel order 2: table status should update to EMPTY since no other PENDING orders exist
    console.log('6. Cancelling Order 2...');
    const cancelRes = await request('PATCH', `/api/orders/${order2.id}/status`, { status: 'CANCELLED' });
    if (cancelRes.body.code !== 200 || cancelRes.body.data.status !== 'CANCELLED') {
      throw new Error(`Failed to cancel order 2: ${JSON.stringify(cancelRes.body)}`);
    }
    console.log('-> Order 2 status changed to CANCELLED.');

    console.log('-> Checking table 2 status (expected: EMPTY since no other PENDING orders exist)...');
    const tableRes3 = await request('GET', '/api/tables/2');
    if (tableRes3.body.data.status !== 'EMPTY') {
      throw new Error(`Expected Table 2 status to be EMPTY, got ${tableRes3.body.data.status}`);
    }
    console.log('-> Table 2 status is EMPTY!');

    // 7. Try deleting a PENDING order (should fail)
    console.log('7. Testing deletion restrictions...');
    // Create temporary order 3
    const order3Res = await request('POST', '/api/orders', {
      tableId: 2,
      items: [{ productId: 1, quantity: 1 }]
    });
    const order3 = order3Res.body.data;
    
    // Try to delete order 3 while PENDING
    const deletePendingRes = await request('DELETE', `/api/orders/${order3.id}`);
    if (deletePendingRes.status === 200 && deletePendingRes.body.code === 200) {
      throw new Error('Should not allow deleting a PENDING order');
    }
    console.log('-> Deleting PENDING order blocked as expected!');

    // Cancel order 3 and delete it
    await request('PATCH', `/api/orders/${order3.id}/status`, { status: 'CANCELLED' });
    const deleteCancelledRes = await request('DELETE', `/api/orders/${order3.id}`);
    if (deleteCancelledRes.body.code !== 200) {
      throw new Error(`Failed to delete cancelled order: ${JSON.stringify(deleteCancelledRes.body)}`);
    }
    console.log('-> Deleted CANCELLED order successfully!');

    // Verify it is not found now
    const getDeletedRes = await request('GET', `/api/orders/${order3.id}`);
    if (getDeletedRes.status !== 400 && getDeletedRes.body.code !== 400) {
      throw new Error('Deleted order should not be found');
    }
    console.log('-> Deleted order is not found (verified soft delete)!');

    // 8. Test business validation: Ordering a sold out product (productId: 4 is SOLD_OUT)
    console.log('8. Testing ordering SOLD_OUT product...');
    const soldOutRes = await request('POST', '/api/orders', {
      tableId: 2,
      items: [{ productId: 4, quantity: 1 }]
    });
    if (soldOutRes.status === 200 && soldOutRes.body.code === 200) {
      throw new Error('Should not allow ordering a SOLD_OUT product');
    }
    console.log('-> Ordering SOLD_OUT product blocked successfully with error:', soldOutRes.body.message);

    console.log('\n=== ALL API TESTS PASSED SUCCESSFULLY! 100% SUCCESS ===');
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  }
}

runTests();
