const API_BASE_URL = 'http://localhost:8081/api';

async function runTests() {
  console.log('=== Starting POS-48 Customization & Markup Integration Tests ===\n');

  try {
    // 1. Verify Products and Modifier Mapping
    console.log('1. Verifying product modifier group mapping...');
    const productsRes = await fetch(`${API_BASE_URL}/products`);
    if (!productsRes.ok) {
      throw new Error(`Failed to fetch products: ${productsRes.status}`);
    }
    const productsJson = await productsRes.ok ? await productsRes.json() : {};
    if (productsJson.code !== 200) {
      throw new Error(`Products API returned error: ${productsJson.message}`);
    }
    
    const tea = productsJson.data.find(p => p.id === 5);
    if (!tea) {
      throw new Error('Could not find product with ID 5 (古早味紅茶)');
    }
    
    console.log(`Product: ${tea.name}, Price: ${tea.price}`);
    const teaGroups = tea.modifierGroups || [];
    console.log(`Modifier groups count: ${teaGroups.length}`);
    if (teaGroups.length !== 3) {
      throw new Error(`Expected 3 modifier groups for tea, got ${teaGroups.length}`);
    }
    
    const sweetnessGroup = teaGroups.find(g => g.name === '甜度');
    const iceGroup = teaGroups.find(g => g.name === '冰塊');
    const addOnGroup = teaGroups.find(g => g.name === '加料');
    
    if (!sweetnessGroup || sweetnessGroup.minSelection !== 1 || sweetnessGroup.maxSelection !== 1) {
      throw new Error('Sweetness group validation failed');
    }
    if (!iceGroup || iceGroup.minSelection !== 1 || iceGroup.maxSelection !== 1) {
      throw new Error('Ice group validation failed');
    }
    if (!addOnGroup || addOnGroup.minSelection !== 0 || addOnGroup.maxSelection !== 3) {
      throw new Error('Add-on group validation failed');
    }
    console.log('✓ Product modifier configuration is correct.\n');

    // 2. Create Order with Valid Customizations
    console.log('2. Creating order with valid customizations...');
    // Options: ID 3 (微糖 [+$0]), ID 6 (少冰 [+$0]), ID 9 (加珍珠 [+$10])
    const validPayload = {
      tableId: 1,
      items: [
        {
          productId: 5,
          quantity: 2,
          note: '微糖少冰加珍珠',
          optionIds: [3, 6, 9]
        }
      ]
    };
    
    const validRes = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload)
    });
    
    const validJson = await validRes.json();
    if (validJson.code !== 200) {
      throw new Error(`Failed to create valid order: ${validJson.message}`);
    }
    
    const order = validJson.data;
    console.log(`✓ Order Created: ${order.orderNo}, Status: ${order.status}`);
    console.log(`Total amount: $${order.totalAmount} (Expected: $80.00)`);
    if (parseFloat(order.totalAmount) !== 80.00) {
      throw new Error(`Expected total amount to be 80.00, got ${order.totalAmount}`);
    }
    
    const orderItem = order.items[0];
    console.log(`Item: ${orderItem.productName}, Price: $${orderItem.price} (Expected: $40.00), Subtotal: $${orderItem.subtotal}`);
    if (parseFloat(orderItem.price) !== 40.00) {
      throw new Error(`Expected item price to be 40.00, got ${orderItem.price}`);
    }
    
    console.log(`Options Count: ${orderItem.options?.length}`);
    if (!orderItem.options || orderItem.options.length !== 3) {
      throw new Error(`Expected 3 options for order item, got ${orderItem.options?.length}`);
    }
    
    const pearlOpt = orderItem.options.find(o => o.optionId === 9);
    if (!pearlOpt || parseFloat(pearlOpt.priceModifier) !== 10.00) {
      throw new Error('Add-on option details mismatch');
    }
    console.log('✓ Valid order creation and price calculations verified.\n');

    // 3. Test Invalid Customizations (Constraint validations)
    console.log('3. Verifying validation constraint: sweetness minSelection = 1...');
    // Missing sweetness (optionIds lacks sweetness ID 1-4)
    const missingSweetnessPayload = {
      tableId: 1,
      items: [
        {
          productId: 5,
          quantity: 1,
          optionIds: [6, 9] // Only Ice and Pearl
        }
      ]
    };
    const errRes1 = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(missingSweetnessPayload)
    });
    const errJson1 = await errRes1.json();
    console.log(`Status code: ${errRes1.status}, Message: "${errJson1.message}"`);
    if (errRes1.status !== 400 || !errJson1.message.includes('最少需選擇')) {
      throw new Error('Expected 400 Bad Request for missing mandatory sweetness selection');
    }
    console.log('✓ Missing mandatory option validation passed.\n');

    console.log('4. Verifying validation constraint: sweetness maxSelection = 1...');
    // Duplicate sweetness (ID 3 [微糖] and ID 4 [無糖])
    const duplicateSweetnessPayload = {
      tableId: 1,
      items: [
        {
          productId: 5,
          quantity: 1,
          optionIds: [3, 4, 6] // Two sweetness, one ice
        }
      ]
    };
    const errRes2 = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(duplicateSweetnessPayload)
    });
    const errJson2 = await errRes2.json();
    console.log(`Status code: ${errRes2.status}, Message: "${errJson2.message}"`);
    if (errRes2.status !== 400 || !errJson2.message.includes('最多只能選擇')) {
      throw new Error('Expected 400 Bad Request for duplicate sweetness selection');
    }
    console.log('✓ Maximum selection count limit validation passed.\n');

    console.log('5. Verifying validation constraint: option must belong to product...');
    // ID 12 is "升級 A 套餐" (modifier group 4), which belongs to rice, not tea (Product 5)
    const crossProductOptionPayload = {
      tableId: 1,
      items: [
        {
          productId: 5,
          quantity: 1,
          optionIds: [3, 6, 12]
        }
      ]
    };
    const errRes3 = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(crossProductOptionPayload)
    });
    const errJson3 = await errRes3.json();
    console.log(`Status code: ${errRes3.status}, Message: "${errJson3.message}"`);
    if (errRes3.status !== 400 || (!errJson3.message.includes('不包含') && !errJson3.message.includes('不適用'))) {
      throw new Error('Expected 400 Bad Request for cross-product option selection');
    }
    console.log('✓ Option-to-product mapping validation passed.\n');

    // 6. Test Nested Set Meal Customization (Case 6)
    console.log('6. Verifying nested set meal customization (Case 6)...');
    
    // Test 6.1: Valid set meal creation
    // Product 1 (招牌滷肉飯 [$50]), Option 13 (升級 B 套餐 [+$60]), Option 4 (無糖 [+$0]), Option 8 (去冰 [+$0])
    // Expected unit price: $110
    const setMealPayload = {
      tableId: 1,
      items: [
        {
          productId: 1,
          quantity: 1,
          note: '升級B套餐無糖去冰',
          optionIds: [13, 4, 8]
        }
      ]
    };

    const setMealRes = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(setMealPayload)
    });

    const setMealJson = await setMealRes.json();
    if (setMealJson.code !== 200) {
      throw new Error(`Failed to create set meal order: ${setMealJson.message}`);
    }

    const setMealOrder = setMealJson.data;
    console.log(`✓ Set Meal Order Created: ${setMealOrder.orderNo}, Status: ${setMealOrder.status}`);
    console.log(`Total amount: $${setMealOrder.totalAmount} (Expected: $110.00)`);
    if (parseFloat(setMealOrder.totalAmount) !== 110.00) {
      throw new Error(`Expected total amount to be 110.00, got ${setMealOrder.totalAmount}`);
    }

    const setMealItem = setMealOrder.items[0];
    console.log(`Options Count: ${setMealItem.options?.length}`);
    if (!setMealItem.options || setMealItem.options.length !== 3) {
      throw new Error(`Expected 3 options for set meal order item, got ${setMealItem.options?.length}`);
    }

    // Find option 13, 4, 8 inside response
    const opt13 = setMealItem.options.find(o => o.optionId === 13);
    const opt4 = setMealItem.options.find(o => o.optionId === 4);
    const opt8 = setMealItem.options.find(o => o.optionId === 8);

    if (!opt13 || !opt4 || !opt8) {
      throw new Error('Could not find all expected options in the response');
    }

    console.log(`Parent Option DB ID: ${opt13.id}, parentId: ${opt13.parentId} (Expected: null)`);
    console.log(`Sweetness Option DB ID: ${opt4.id}, parentId: ${opt4.parentId} (Expected: ${opt13.id})`);
    console.log(`Ice Option DB ID: ${opt8.id}, parentId: ${opt8.parentId} (Expected: ${opt13.id})`);

    if (opt13.parentId !== null && opt13.parentId !== undefined) {
      throw new Error(`Expected parent option parentId to be null/undefined, got ${opt13.parentId}`);
    }
    if (opt4.parentId !== opt13.id) {
      throw new Error(`Expected child sweetness option parentId to be ${opt13.id}, got ${opt4.parentId}`);
    }
    if (opt8.parentId !== opt13.id) {
      throw new Error(`Expected child ice option parentId to be ${opt13.id}, got ${opt8.parentId}`);
    }
    console.log('✓ Parent-child relationship database mapping verified.\n');

    // Test 6.2: Missing mandatory child option validation
    // Missing sweetness for Set B (ID 13, ID 8, but no sweetness IDs 1-4)
    console.log('7. Verifying validation constraint: nested set meal sweetness minSelection = 1...');
    const missingChildSweetnessPayload = {
      tableId: 1,
      items: [
        {
          productId: 1,
          quantity: 1,
          optionIds: [13, 8] // Missing sweetness option
        }
      ]
    };

    const errRes4 = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(missingChildSweetnessPayload)
    });

    const errJson4 = await errRes4.json();
    console.log(`Status code: ${errRes4.status}, Message: "${errJson4.message}"`);
    if (errRes4.status !== 400 || !errJson4.message.includes('最少需選擇')) {
      throw new Error('Expected 400 Bad Request for missing mandatory set meal sweetness selection');
    }
    console.log('✓ Nested child option validation constraint passed.\n');

    console.log('==================================================');
    console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('==================================================');
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

runTests();
