const http = require('http');

const API_BASE = 'http://localhost:8081/api';

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
          reject(new Error(`Failed to parse response (Status: ${res.statusCode}): ${data}`));
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

async function run() {
  console.log('=== Starting Concurrent Checkout Debug Test ===');
  let tableId;
  let order1Id, order2Id;

  try {
    // Get product
    const productsRes = await request(`${API_BASE}/products`);
    const productId = productsRes.body.data[0].id;

    // 1. Create a table
    const tableRes = await request(`${API_BASE}/tables`, 'POST', { name: 'T_CONC', seats: 4 });
    tableId = tableRes.body.data.id;
    console.log(`Created table ID: ${tableId}`);

    // 2. Create order 1
    const o1Res = await request(`${API_BASE}/orders`, 'POST', {
      tableId: tableId,
      items: [{ productId: productId, quantity: 1 }]
    });
    order1Id = o1Res.body.data.id;

    // 3. Create order 2
    const o2Res = await request(`${API_BASE}/orders`, 'POST', {
      tableId: tableId,
      items: [{ productId: productId, quantity: 2 }]
    });
    order2Id = o2Res.body.data.id;

    console.log(`Created Order 1 ID: ${order1Id}, Order 2 ID: ${order2Id}`);

    // 4. Sequential Checkout (simulating frontend's new sequential checkout loop)
    console.log('Sending sequential checkout requests...');
    const results = [];
    try {
      const res1 = await request(`${API_BASE}/orders/${order1Id}/checkout`, 'POST');
      results.push(res1);
    } catch (err) {
      results.push({ error: err });
    }
    try {
      const res2 = await request(`${API_BASE}/orders/${order2Id}/checkout`, 'POST');
      results.push(res2);
    } catch (err) {
      results.push({ error: err });
    }

    results.forEach((res, i) => {
      if (res.error) {
        console.error(`Request ${i + 1} encountered client/network error:`, res.error.message);
      } else {
        console.log(`Request ${i + 1} Response (Status ${res.status}):`, JSON.stringify(res.body));
      }
    });

  } catch (err) {
    console.error('Test script error:', err);
  } finally {
    if (tableId) {
      await request(`${API_BASE}/tables/${tableId}`, 'DELETE');
      console.log(`Deleted table ${tableId}`);
    }
  }
}

run();
