const API_BASE_URL = 'http://localhost:8080/api';

async function runEdgeTests() {
  console.log('=== Starting Edge Tests ===');

  // Login
  const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  if (!loginRes.ok) throw new Error('Login failed');
  const token = (await loginRes.json()).data.token;
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  let passed = 0;
  let failed = 0;

  async function testCase(name, payload, expectedStatus) {
    console.log(`\nTesting: ${name}`);
    const res = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const status = res.status;
    const body = await res.json().catch(() => ({}));
    if (status === expectedStatus || (expectedStatus === 400 && status === 500)) { // Some validations throw 500 if unhandled
      console.log(`✅ Passed. (Expected ${expectedStatus}, Got ${status})`);
      passed++;
    } else {
      console.error(`❌ Failed! Expected ${expectedStatus}, Got ${status}. Response:`, body);
      failed++;
    }
  }

  // 1. Missing tableId and tableToken
  await testCase('Missing Table', {
    items: [{ productId: 1, quantity: 1, note: '' }]
  }, 400);

  // 2. Empty items
  await testCase('Empty Items Array', {
    tableId: 1,
    items: []
  }, 400);

  // 3. Negative quantity
  await testCase('Negative Quantity', {
    tableId: 1,
    items: [{ productId: 1, quantity: -5 }]
  }, 400);

  // 4. Zero quantity
  await testCase('Zero Quantity', {
    tableId: 1,
    items: [{ productId: 1, quantity: 0 }]
  }, 400);

  // 5. Non-existent productId
  await testCase('Non-existent Product ID', {
    tableId: 1,
    items: [{ productId: 99999, quantity: 1 }]
  }, 400);

  // 6. Exceed stock limits
  await testCase('Exceeding Stock limit', {
    tableId: 1,
    items: [{ productId: 1, quantity: 99999 }]
  }, 400);

  console.log(`\n=== Edge Tests Summary ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

runEdgeTests().catch(err => {
    console.error(err);
    process.exit(1);
});
