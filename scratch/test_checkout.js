const http = require('http');

const API_BASE = 'http://localhost:8081/api';

// Helper to make HTTP requests
function request(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Accept': 'application/json',
      }
    };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== Starting Checkout API E2E Tests ===');

  let tableId, orderId;
  let testTable2Id, order2AId, order2BId;

  try {
    // 0. Ensure we have products to order
    console.log('0. Retrieving products...');
    const productsRes = await request(`${API_BASE}/products`);
    if (productsRes.body.code !== 200 || !productsRes.body.data.length) {
      throw new Error('No products found in DB. Make sure data.sql is loaded.');
    }
    const productId = productsRes.body.data[0].id;
    console.log(`Using product ID: ${productId} (${productsRes.body.data[0].name})`);

    // 1. Create a table
    console.log('\n1. Creating test table...');
    const tableRes = await request(`${API_BASE}/tables`, 'POST', {
      name: 'T_TEST_1',
      seats: 4
    });
    if (tableRes.body.code !== 200) {
      throw new Error(`Failed to create table: ${JSON.stringify(tableRes.body)}`);
    }
    tableId = tableRes.body.data.id;
    console.log(`Created table ID: ${tableId}, status: ${tableRes.body.data.status}`);
    if (tableRes.body.data.status !== 'EMPTY') {
      throw new Error(`Expected new table to be EMPTY, got: ${tableRes.body.data.status}`);
    }

    // 2. Create a pending order on this table
    console.log('\n2. Creating pending order...');
    const orderRes = await request(`${API_BASE}/orders`, 'POST', {
      tableId: tableId,
      items: [
        { productId: productId, quantity: 2, note: 'test note' }
      ]
    });
    if (orderRes.body.code !== 200) {
      throw new Error(`Failed to create order: ${JSON.stringify(orderRes.body)}`);
    }
    orderId = orderRes.body.data.id;
    console.log(`Created order ID: ${orderId}, orderNo: ${orderRes.body.data.orderNo}`);

    // Verify table status is now OCCUPIED
    const tableCheck = await request(`${API_BASE}/tables/${tableId}`);
    console.log(`Table status after order: ${tableCheck.body.data.status}`);
    if (tableCheck.body.data.status !== 'OCCUPIED') {
      throw new Error(`Expected table status to be OCCUPIED, got: ${tableCheck.body.data.status}`);
    }

    // 3. Checkout the order
    console.log('\n3. Performing checkout on order...');
    const checkoutRes = await request(`${API_BASE}/orders/${orderId}/checkout`, 'POST');
    console.log(`Checkout API status: ${checkoutRes.status}, code: ${checkoutRes.body.code}, message: ${checkoutRes.body.message}`);
    if (checkoutRes.body.code !== 200) {
      throw new Error(`Checkout failed: ${JSON.stringify(checkoutRes.body)}`);
    }

    // Verify order is PAID
    const orderCheck = await request(`${API_BASE}/orders/${orderId}`);
    console.log(`Order status after checkout: ${orderCheck.body.data.status}`);
    if (orderCheck.body.data.status !== 'PAID') {
      throw new Error(`Expected order status to be PAID, got: ${orderCheck.body.data.status}`);
    }

    // Verify table status is now CLEANING (since it was the last pending order)
    const tableCheckAfterPaid = await request(`${API_BASE}/tables/${tableId}`);
    console.log(`Table status after checkout: ${tableCheckAfterPaid.body.data.status}`);
    if (tableCheckAfterPaid.body.data.status !== 'CLEANING') {
      throw new Error(`Expected table status to be CLEANING, got: ${tableCheckAfterPaid.body.data.status}`);
    }

    // 4. Try checkout again - should fail
    console.log('\n4. Attempting duplicate checkout...');
    const dupRes = await request(`${API_BASE}/orders/${orderId}/checkout`, 'POST');
    console.log(`Duplicate checkout response code: ${dupRes.body.code}, message: ${dupRes.body.message}`);
    if (dupRes.body.code !== 400) {
      throw new Error(`Expected 400 Bad Request for duplicate checkout, got: ${dupRes.body.code}`);
    }

    // 5. Test multiple orders on same table
    console.log('\n5. Creating test table 2 for multi-order tests...');
    const table2Res = await request(`${API_BASE}/tables`, 'POST', {
      name: 'T_TEST_2',
      seats: 6
    });
    testTable2Id = table2Res.body.data.id;

    console.log('Creating order 2A on table 2...');
    const order2ARes = await request(`${API_BASE}/orders`, 'POST', {
      tableId: testTable2Id,
      items: [{ productId: productId, quantity: 1 }]
    });
    order2AId = order2ARes.body.data.id;

    console.log('Creating order 2B on table 2...');
    const order2BRes = await request(`${API_BASE}/orders`, 'POST', {
      tableId: testTable2Id,
      items: [{ productId: productId, quantity: 3 }]
    });
    order2BId = order2BRes.body.data.id;

    // Verify table 2 is OCCUPIED
    const table2Check = await request(`${API_BASE}/tables/${testTable2Id}`);
    console.log(`Table 2 status (with 2 orders): ${table2Check.body.data.status}`);
    if (table2Check.body.data.status !== 'OCCUPIED') {
      throw new Error(`Expected Table 2 status to be OCCUPIED, got: ${table2Check.body.data.status}`);
    }

    // Checkout order 2A. Since any checkout transitions table to CLEANING, Table 2 must be CLEANING.
    console.log('Checking out Order 2A...');
    const checkout2ARes = await request(`${API_BASE}/orders/${order2AId}/checkout`, 'POST');
    if (checkout2ARes.body.code !== 200) {
      throw new Error(`Checkout 2A failed: ${JSON.stringify(checkout2ARes.body)}`);
    }

    const table2CheckAfter2A = await request(`${API_BASE}/tables/${testTable2Id}`);
    console.log(`Table 2 status after Order 2A paid (Order 2B pending): ${table2CheckAfter2A.body.data.status}`);
    if (table2CheckAfter2A.body.data.status !== 'CLEANING') {
      throw new Error(`Expected Table 2 to be CLEANING after Order 2A is checked out, got: ${table2CheckAfter2A.body.data.status}`);
    }

    // Checkout order 2B. Since no pending orders remain, Table 2 must transition to CLEANING.
    console.log('Checking out Order 2B...');
    const checkout2BRes = await request(`${API_BASE}/orders/${order2BId}/checkout`, 'POST');
    if (checkout2BRes.body.code !== 200) {
      throw new Error(`Checkout 2B failed: ${JSON.stringify(checkout2BRes.body)}`);
    }

    const table2CheckAfter2B = await request(`${API_BASE}/tables/${testTable2Id}`);
    console.log(`Table 2 status after Order 2B paid (All paid): ${table2CheckAfter2B.body.data.status}`);
    if (table2CheckAfter2B.body.data.status !== 'CLEANING') {
      throw new Error(`Expected Table 2 status to be CLEANING, got: ${table2CheckAfter2B.body.data.status}`);
    }

    console.log('\n=== All Tests Passed Successfully! ===');
  } catch (err) {
    console.error('\n❌ Test Failure:', err.message);
  } finally {
    // Cleanup tables
    console.log('\nCleaning up created tables...');
    if (tableId) {
      await request(`${API_BASE}/tables/${tableId}`, 'DELETE');
      console.log(`Deleted table ${tableId}`);
    }
    if (testTable2Id) {
      await request(`${API_BASE}/tables/${testTable2Id}`, 'DELETE');
      console.log(`Deleted table ${testTable2Id}`);
    }
  }
}

runTests();
