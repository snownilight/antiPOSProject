const API_BASE_URL = 'http://localhost:8081/api';

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

async function updateProduct(productId, productData) {
  const res = await fetch(`${API_BASE_URL}/products/${productId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify(productData)
  });
  if (!res.ok) {
    throw new Error(`Failed to update product ${productId}: ${res.status}`);
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

async function runTests() {
  console.log('=== Starting POS-55 Stock Lifecycle Integration Tests ===\n');

  try {
    // 0. Perform logins
    console.log('Logging in to obtain JWT tokens...');
    adminToken = await login('admin', 'admin123');
    console.log('✓ Admin token obtained');
    waiterToken = await login('waiter', 'waiter123');
    console.log('✓ Waiter token obtained');
    customerToken = await getCustomerToken('token-t1');
    console.log('✓ Customer token obtained\n');

    // ----------------------------------------------------
    // TEST 1: Direct Waiter Order Stock Deduction & Cancel Replenish
    // ----------------------------------------------------
    console.log('Test 1: Direct Waiter Order Stock Lifecycle...');
    
    // Check initial stock of product 1 (招牌滷肉飯)
    const prod1_init = await fetchProduct(1);
    const stock1_init = prod1_init.stock;
    console.log(`Initial stock of 招牌滷肉飯: ${stock1_init}`);

    // Place a waiter order (immediate PENDING)
    const waiterPayload = {
      tableId: 1,
      items: [
        {
          productId: 1,
          quantity: 2,
          note: 'Waiter test'
        }
      ]
    };
    console.log('Creating direct waiter order (should be PENDING)...');
    const order1 = await createOrder(waiterPayload, waiterToken);
    console.log(`✓ Order created: ${order1.orderNo}, status: ${order1.status}`);
    
    if (order1.status !== 'PENDING') {
      throw new Error(`Expected order status to be PENDING, got ${order1.status}`);
    }

    // Verify stock decreases
    const prod1_afterCreate = await fetchProduct(1);
    console.log(`Stock after order creation: ${prod1_afterCreate.stock} (Expected: ${stock1_init - 2})`);
    if (prod1_afterCreate.stock !== stock1_init - 2) {
      throw new Error(`Stock mismatch after order creation: expected ${stock1_init - 2}, got ${prod1_afterCreate.stock}`);
    }

    // Cancel order
    console.log('Cancelling order...');
    const order1_cancelled = await updateOrderStatus(order1.id, 'CANCELLED', waiterToken);
    console.log(`✓ Order status updated: ${order1_cancelled.status}`);

    // Verify stock replenished
    const prod1_afterCancel = await fetchProduct(1);
    console.log(`Stock after order cancellation: ${prod1_afterCancel.stock} (Expected: ${stock1_init})`);
    if (prod1_afterCancel.stock !== stock1_init) {
      throw new Error(`Stock mismatch after cancellation: expected ${stock1_init}, got ${prod1_afterCancel.stock}`);
    }
    console.log('✓ Test 1 Passed!\n');

    // ----------------------------------------------------
    // TEST 2: Customer Order Stock Lifecycle (with confirmation)
    // ----------------------------------------------------
    console.log('Test 2: Customer Order Stock Lifecycle (requiring staff confirm)...');
    
    // Check initial stock
    const prod1_init2 = await fetchProduct(1);
    const stock1_init2 = prod1_init2.stock;
    console.log(`Initial stock of 招牌滷肉飯: ${stock1_init2}`);

    // Place guest order (token-t1, require-staff-confirm is true so should be PENDING_CONFIRM)
    const customerPayload = {
      tableToken: 'token-t1',
      items: [
        {
          productId: 1,
          quantity: 1,
          note: 'Customer test'
        }
      ]
    };
    console.log('Creating customer order (should be PENDING_CONFIRM)...');
    const order2 = await createOrder(customerPayload, customerToken);
    console.log(`✓ Order created: ${order2.orderNo}, status: ${order2.status}`);
    
    if (order2.status !== 'PENDING_CONFIRM') {
      throw new Error(`Expected order status to be PENDING_CONFIRM, got ${order2.status}`);
    }

    // Verify stock does NOT change
    const prod1_afterCustCreate = await fetchProduct(1);
    console.log(`Stock after customer order creation: ${prod1_afterCustCreate.stock} (Expected: ${stock1_init2})`);
    if (prod1_afterCustCreate.stock !== stock1_init2) {
      throw new Error(`Stock changed unexpectedly on PENDING_CONFIRM: got ${prod1_afterCustCreate.stock}`);
    }

    // Approve the order (PENDING)
    console.log('Approving customer order (updating to PENDING)...');
    const order2_approved = await updateOrderStatus(order2.id, 'PENDING', waiterToken);
    console.log(`✓ Order status updated: ${order2_approved.status}`);

    // Verify stock decreases now
    const prod1_afterApprove = await fetchProduct(1);
    console.log(`Stock after approval: ${prod1_afterApprove.stock} (Expected: ${stock1_init2 - 1})`);
    if (prod1_afterApprove.stock !== stock1_init2 - 1) {
      throw new Error(`Stock mismatch after approval: expected ${stock1_init2 - 1}, got ${prod1_afterApprove.stock}`);
    }

    // Cancel order
    console.log('Cancelling order...');
    const order2_cancelled = await updateOrderStatus(order2.id, 'CANCELLED', waiterToken);
    console.log(`✓ Order status updated: ${order2_cancelled.status}`);

    // Verify stock replenished
    const prod1_afterCancel2 = await fetchProduct(1);
    console.log(`Stock after cancellation: ${prod1_afterCancel2.stock} (Expected: ${stock1_init2})`);
    if (prod1_afterCancel2.stock !== stock1_init2) {
      throw new Error(`Stock mismatch after cancellation: expected ${stock1_init2}, got ${prod1_afterCancel2.stock}`);
    }
    console.log('✓ Test 2 Passed!\n');

    // ----------------------------------------------------
    // TEST 3: Combo Option Selection Stock Lifecycle
    // ----------------------------------------------------
    console.log('Test 3: Combo Option Selection Stock Lifecycle...');
    
    // Option 14 (升級 C 套餐) -> Bundle Item 5 selects Product 10 (黃金泡菜), Bundle Item 6 selects Product 5 (古早味紅茶)
    const prod1_init3 = await fetchProduct(1);
    const prod10_init3 = await fetchProduct(10);
    const prod5_init3 = await fetchProduct(5);

    console.log(`Initial stock - Parent (招牌滷肉飯): ${prod1_init3.stock}, Option (黃金泡菜): ${prod10_init3.stock}, Option (古早味紅茶): ${prod5_init3.stock}`);

    const comboPayload = {
      tableId: 1,
      items: [
        {
          productId: 1,
          quantity: 2,
          selectedOptions: [
            {
              optionId: 14,
              bundleItems: [
                {
                  bundleItemId: 5,
                  selectedProductId: 10,
                  optionIds: []
                },
                {
                  bundleItemId: 6,
                  selectedProductId: 5,
                  optionIds: [4, 8] // 無糖, 去冰
                }
              ]
            }
          ]
        }
      ]
    };

    console.log('Creating combo order (should be PENDING)...');
    const order3 = await createOrder(comboPayload, waiterToken);
    console.log(`✓ Combo Order created: ${order3.orderNo}, status: ${order3.status}`);

    // Verify stock deduction for both parent and child products
    const prod1_afterCombo = await fetchProduct(1);
    const prod10_afterCombo = await fetchProduct(10);
    const prod5_afterCombo = await fetchProduct(5);

    console.log(`Stock after combo creation - Parent: ${prod1_afterCombo.stock} (Expected: ${prod1_init3.stock - 2})`);
    console.log(`Stock after combo creation - 黃金泡菜: ${prod10_afterCombo.stock} (Expected: ${prod10_init3.stock - 2})`);
    console.log(`Stock after combo creation - 古早味紅茶: ${prod5_afterCombo.stock} (Expected: ${prod5_init3.stock - 2})`);

    if (prod1_afterCombo.stock !== prod1_init3.stock - 2) {
      throw new Error(`Parent product stock deduction failed: expected ${prod1_init3.stock - 2}, got ${prod1_afterCombo.stock}`);
    }
    if (prod10_afterCombo.stock !== prod10_init3.stock - 2) {
      throw new Error(`Option product 黃金泡菜 stock deduction failed: expected ${prod10_init3.stock - 2}, got ${prod10_afterCombo.stock}`);
    }
    if (prod5_afterCombo.stock !== prod5_init3.stock - 2) {
      throw new Error(`Option product 古早味紅茶 stock deduction failed: expected ${prod5_init3.stock - 2}, got ${prod5_afterCombo.stock}`);
    }

    // Cancel order
    console.log('Cancelling combo order...');
    await updateOrderStatus(order3.id, 'CANCELLED', waiterToken);
    console.log('✓ Combo order cancelled');

    // Verify replenishment
    const prod1_finalCombo = await fetchProduct(1);
    const prod10_finalCombo = await fetchProduct(10);
    const prod5_finalCombo = await fetchProduct(5);

    console.log(`Final stock - Parent: ${prod1_finalCombo.stock} (Expected: ${prod1_init3.stock})`);
    console.log(`Final stock - 黃金泡菜: ${prod10_finalCombo.stock} (Expected: ${prod10_init3.stock})`);
    console.log(`Final stock - 古早味紅茶: ${prod5_finalCombo.stock} (Expected: ${prod5_init3.stock})`);

    if (prod1_finalCombo.stock !== prod1_init3.stock || prod10_finalCombo.stock !== prod10_init3.stock || prod5_finalCombo.stock !== prod5_init3.stock) {
      throw new Error('Combo stock replenishment failed');
    }
    console.log('✓ Test 3 Passed!\n');

    // ----------------------------------------------------
    // TEST 4: Auto-SOLD_OUT and Auto-AVAILABLE Transition
    // ----------------------------------------------------
    console.log('Test 4: Auto SOLD_OUT / AVAILABLE Status Transition...');
    
    // Let's use product 11 (皮蛋豆腐)
    const originalProd11 = await fetchProduct(11);
    console.log(`Original Product 11: ${originalProd11.name}, stock: ${originalProd11.stock}, status: ${originalProd11.status}`);

    // Update stock to 1 and ensure AVAILABLE
    console.log('Setting Product 11 stock to 1 and status to AVAILABLE...');
    const setupProd11 = { ...originalProd11, stock: 1, status: 'AVAILABLE' };
    await updateProduct(11, setupProd11);

    const checkSetup11 = await fetchProduct(11);
    console.log(`Product 11 configured: stock = ${checkSetup11.stock}, status = ${checkSetup11.status}`);
    if (checkSetup11.stock !== 1 || checkSetup11.status !== 'AVAILABLE') {
      throw new Error('Failed to set up product 11 for testing');
    }

    // Place waiter order for 1 qty of product 11 (immediate PENDING)
    const singlePayload = {
      tableId: 1,
      items: [
        {
          productId: 11,
          quantity: 1,
          note: 'SOLD_OUT transition test'
        }
      ]
    };
    console.log('Creating order for 1 qty of Product 11...');
    const order4 = await createOrder(singlePayload, waiterToken);
    console.log(`✓ Order created: ${order4.orderNo}`);

    // Verify stock is 0 and status is SOLD_OUT
    const prod11_afterDeduct = await fetchProduct(11);
    console.log(`Product 11 after deduction: stock = ${prod11_afterDeduct.stock}, status = ${prod11_afterDeduct.status}`);
    if (prod11_afterDeduct.stock !== 0 || prod11_afterDeduct.status !== 'SOLD_OUT') {
      throw new Error(`Expected stock to be 0 and status to be SOLD_OUT, got stock ${prod11_afterDeduct.stock} and status ${prod11_afterDeduct.status}`);
    }
    console.log('✓ Successfully transitioned to SOLD_OUT automatically');

    // Cancel order
    console.log('Cancelling order to trigger replenishment...');
    await updateOrderStatus(order4.id, 'CANCELLED', waiterToken);

    // Verify stock is 1 and status is AVAILABLE
    const prod11_afterReplenish = await fetchProduct(11);
    console.log(`Product 11 after replenishment: stock = ${prod11_afterReplenish.stock}, status = ${prod11_afterReplenish.status}`);
    if (prod11_afterReplenish.stock !== 1 || prod11_afterReplenish.status !== 'AVAILABLE') {
      throw new Error(`Expected stock to be 1 and status to be AVAILABLE, got stock ${prod11_afterReplenish.stock} and status ${prod11_afterReplenish.status}`);
    }
    console.log('✓ Successfully transitioned back to AVAILABLE automatically');

    // Restore original Product 11 values
    console.log('Restoring Product 11 original settings...');
    await updateProduct(11, originalProd11);
    const restoredProd11 = await fetchProduct(11);
    console.log(`✓ Product 11 restored: stock = ${restoredProd11.stock}, status = ${restoredProd11.status}`);

    console.log('✓ Test 4 Passed!\n');

    console.log('==================================================');
    console.log('🎉 ALL STOCK LIFECYCLE TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('==================================================');

  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

runTests();
