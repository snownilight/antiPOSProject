const http = require('http');

const API_BASE = 'http://localhost:8081/api';

// Helper to make HTTP requests
function request(url, method = 'GET', body = null, responseType = 'json') {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Accept': responseType === 'json' ? 'application/json' : '*/*',
      }
    };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(options, (res) => {
      if (responseType === 'binary') {
        const chunks = [];
        res.on('data', (chunk) => { chunks.push(chunk); });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks)
          });
        });
      } else {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : null;
            resolve({ status: res.statusCode, headers: res.headers, body: parsed });
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      }
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== Starting POS-41 QR Code Self-Ordering E2E Tests ===');

  let tableId, tableToken, orderId;

  try {
    // 0. Ensure we have products to order
    console.log('0. Retrieving products...');
    const productsRes = await request(`${API_BASE}/products`);
    if (productsRes.body.code !== 200 || !productsRes.body.data.length) {
      throw new Error('No products found in DB. Make sure data.sql is loaded.');
    }
    const productId = productsRes.body.data[0].id;
    console.log(`Using product ID: ${productId} (${productsRes.body.data[0].name})`);

    // 1. Create a table with auto-generated token
    console.log('\n1. Creating table and verifying auto-generated token...');
    const tableRes = await request(`${API_BASE}/tables`, 'POST', {
      name: 'T_QR_TEST',
      seats: 4
    });
    if (tableRes.body.code !== 200) {
      throw new Error(`Failed to create table: ${JSON.stringify(tableRes.body)}`);
    }
    tableId = tableRes.body.data.id;
    tableToken = tableRes.body.data.token;
    console.log(`Created table ID: ${tableId}, Name: T_QR_TEST, Status: ${tableRes.body.data.status}`);
    console.log(`Auto-generated token: ${tableToken}`);
    if (!tableToken || tableToken.length < 10) {
      throw new Error(`Expected a valid UUID token, got: ${tableToken}`);
    }

    // 2. Retrieve table info by token
    console.log('\n2. Validating token via GET /api/tables/token/{token}...');
    const tokenRes = await request(`${API_BASE}/tables/token/${tableToken}`);
    console.log(`Response status: ${tokenRes.status}, code: ${tokenRes.body.code}`);
    if (tokenRes.body.code !== 200 || tokenRes.body.data.id !== tableId) {
      throw new Error(`Failed to retrieve correct table by token: ${JSON.stringify(tokenRes.body)}`);
    }
    console.log(`Table retrieved by token successfully: Name = ${tokenRes.body.data.name}`);

    // 3. Test invalid token
    console.log('\n3. Testing invalid token via GET /api/tables/token/invalid-token-123...');
    const invalidTokenRes = await request(`${API_BASE}/tables/token/invalid-token-123`);
    console.log(`Response code: ${invalidTokenRes.body.code}, message: ${invalidTokenRes.body.message}`);
    if (invalidTokenRes.body.code === 200) {
      throw new Error(`Expected error for invalid token, got success code 200`);
    }

    // 4. GET QR Code PNG stream
    console.log('\n4. Retrieving QR Code PNG via GET /api/tables/{id}/qrcode...');
    const qrcodeRes = await request(`${API_BASE}/tables/${tableId}/qrcode`, 'GET', null, 'binary');
    console.log(`Response status: ${qrcodeRes.status}`);
    console.log(`Content-Type: ${qrcodeRes.headers['content-type']}`);
    if (qrcodeRes.status !== 200) {
      throw new Error(`Failed to retrieve QR Code image`);
    }
    if (qrcodeRes.headers['content-type'] !== 'image/png') {
      throw new Error(`Expected Content-Type image/png, got: ${qrcodeRes.headers['content-type']}`);
    }
    console.log(`QR Code image size: ${qrcodeRes.body.length} bytes`);

    // 5. Submit customer self-order (via tableToken)
    console.log('\n5. Submitting self-order via tableToken (order.require-staff-confirm is true)...');
    const selfOrderRes = await request(`${API_BASE}/orders`, 'POST', {
      tableToken: tableToken,
      items: [
        { productId: productId, quantity: 2, note: '去冰無糖' }
      ]
    });
    if (selfOrderRes.body.code !== 200) {
      throw new Error(`Failed to create self-order: ${JSON.stringify(selfOrderRes.body)}`);
    }
    orderId = selfOrderRes.body.data.id;
    console.log(`Created self-order ID: ${orderId}, orderNo: ${selfOrderRes.body.data.orderNo}`);
    console.log(`Initial order status: ${selfOrderRes.body.data.status}`);
    if (selfOrderRes.body.data.status !== 'PENDING_CONFIRM') {
      throw new Error(`Expected initial status to be PENDING_CONFIRM, got: ${selfOrderRes.body.data.status}`);
    }

    // Check table status is OCCUPIED
    const tableCheck1 = await request(`${API_BASE}/tables/${tableId}`);
    console.log(`Table status after self-order: ${tableCheck1.body.data.status}`);
    if (tableCheck1.body.data.status !== 'OCCUPIED') {
      throw new Error(`Expected table to be OCCUPIED, got: ${tableCheck1.body.data.status}`);
    }

    // 6. Submit waiter order (via tableId directly, should bypass confirmation)
    console.log('\n6. Submitting waiter-entered order directly via tableId (should bypass confirmation)...');
    // First, let's reset table state to EMPTY to simulate clean state
    await request(`${API_BASE}/tables/${tableId}/status`, 'PATCH', { status: 'EMPTY' });
    
    const waiterOrderRes = await request(`${API_BASE}/orders`, 'POST', {
      tableId: tableId,
      items: [
        { productId: productId, quantity: 1 }
      ]
    });
    if (waiterOrderRes.body.code !== 200) {
      throw new Error(`Failed to create waiter order: ${JSON.stringify(waiterOrderRes.body)}`);
    }
    const waiterOrderId = waiterOrderRes.body.data.id;
    console.log(`Created waiter order ID: ${waiterOrderId}, status: ${waiterOrderRes.body.data.status}`);
    if (waiterOrderRes.body.data.status !== 'PENDING') {
      throw new Error(`Expected waiter order status to be PENDING, got: ${waiterOrderRes.body.data.status}`);
    }

    // Clean up waiter order so we can focus on the self-order
    await request(`${API_BASE}/orders/${waiterOrderId}/status`, 'PATCH', { status: 'CANCELLED' });

    // 7. Waiter confirms the customer self-order
    console.log('\n7. Waiter approving the self-order (PATCH status to PENDING)...');
    const approveRes = await request(`${API_BASE}/orders/${orderId}/status`, 'PATCH', {
      status: 'PENDING'
    });
    console.log(`Approve status code: ${approveRes.body.code}, message: ${approveRes.body.message}`);
    if (approveRes.body.code !== 200) {
      throw new Error(`Failed to approve order: ${JSON.stringify(approveRes.body)}`);
    }
    
    const orderCheck = await request(`${API_BASE}/orders/${orderId}`);
    console.log(`Order status after approval: ${orderCheck.body.data.status}`);
    if (orderCheck.body.data.status !== 'PENDING') {
      throw new Error(`Expected order status to be PENDING, got: ${orderCheck.body.data.status}`);
    }

    // 8. Checkout the self-order
    console.log('\n8. Performing checkout on self-order...');
    const checkoutRes = await request(`${API_BASE}/orders/${orderId}/checkout`, 'POST');
    if (checkoutRes.body.code !== 200) {
      throw new Error(`Checkout failed: ${JSON.stringify(checkoutRes.body)}`);
    }
    
    const tableCheck2 = await request(`${API_BASE}/tables/${tableId}`);
    console.log(`Table status after checkout: ${tableCheck2.body.data.status}`);
    if (tableCheck2.body.data.status !== 'CLEANING') {
      throw new Error(`Expected table to be CLEANING after checkout, got: ${tableCheck2.body.data.status}`);
    }

    console.log('\n=== All QR Code Self-Ordering Tests Passed Successfully! ===');
  } catch (err) {
    console.error('\n❌ Test Failure:', err.message);
  } finally {
    // Cleanup table
    console.log('\nCleaning up created table...');
    if (tableId) {
      await request(`${API_BASE}/tables/${tableId}`, 'DELETE');
      console.log(`Deleted table ${tableId}`);
    }
  }
}

runTests();
