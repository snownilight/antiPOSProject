const API_BASE_URL = 'http://localhost:8081/api';

async function login(username, password) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error('Login failed');
  const json = await res.json();
  return json.data.token;
}

async function run() {
  console.log('Resetting database state for E2E tests...');
  const token = await login('admin', 'admin123');
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 1. Clean up active orders first (to avoid table OCCUPIED issues)
  const ordersRes = await fetch(`${API_BASE_URL}/orders?statuses=PENDING_CONFIRM,PENDING,PREPARING,READY`, { headers });
  const ordersJson = await ordersRes.json();
  if (ordersJson.data && ordersJson.data.length > 0) {
    console.log(`Cleaning up ${ordersJson.data.length} active orders...`);
    for (const order of ordersJson.data) {
      // Set to CANCELLED to trigger stock replenishment
      await fetch(`${API_BASE_URL}/orders/${order.id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'CANCELLED' })
      });
      // Soft delete
      await fetch(`${API_BASE_URL}/orders/${order.id}`, {
        method: 'DELETE',
        headers
      });
    }
  }
  console.log('✓ Cleaned up active orders.');

  // 2. Reset product stocks and status
  const products = [
    { id: 1, stock: 15, status: 'AVAILABLE' },
    { id: 2, stock: 8, status: 'AVAILABLE' },
    { id: 3, stock: 20, status: 'AVAILABLE' },
    { id: 4, stock: 0, status: 'SOLD_OUT' },
    { id: 5, stock: 30, status: 'AVAILABLE' },
    { id: 9, stock: 15, status: 'AVAILABLE' },
    { id: 10, stock: 25, status: 'AVAILABLE' },
    { id: 11, stock: 12, status: 'AVAILABLE' },
    { id: 12, stock: 15, status: 'AVAILABLE' }
  ];

  for (const p of products) {
    const res = await fetch(`${API_BASE_URL}/products/${p.id}`, { headers });
    const json = await res.json();
    if (json.data) {
      const prod = json.data;
      prod.stock = p.stock;
      prod.status = p.status;
      const upRes = await fetch(`${API_BASE_URL}/products/${p.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(prod)
      });
      if (!upRes.ok) console.error(`Failed to update product ${p.id}`);
    }
  }
  console.log('✓ Reset products stock and status.');

  // 3. Reset table status
  const tables = [
    { id: 1, status: 'EMPTY' },
    { id: 2, status: 'EMPTY' },
    { id: 3, status: 'OCCUPIED' },
    { id: 4, status: 'CLEANING' }
  ];

  for (const t of tables) {
    const res = await fetch(`${API_BASE_URL}/tables/${t.id}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: t.status })
    });
    if (!res.ok) console.error(`Failed to update table ${t.id} status`);
  }
  console.log('✓ Reset dining tables status.');
  console.log('Database reset complete!\n');
}

run().catch(err => {
  console.error('Reset failed:', err);
  process.exit(1);
});
