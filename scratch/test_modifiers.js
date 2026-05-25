const API_BASE_URL = 'http://localhost:8080/api';

let jwtToken = '';

async function authFetch(url, options = {}) {
  options.headers = options.headers || {};
  if (jwtToken) {
    options.headers['Authorization'] = `Bearer ${jwtToken}`;
  }
  return fetch(url, options);
}

async function runTests() {
  console.log('=== Starting POS-48 Customization & Markup Integration Tests ===\n');

  try {
    // 0. Fetch customer token
    console.log('0. Fetching customer JWT token using table token (token-t1)...');
    const tableRes = await fetch(`${API_BASE_URL}/tables/token/token-t1`);
    if (!tableRes.ok) {
      throw new Error(`Failed to fetch table by token: ${tableRes.status}`);
    }
    const tableJson = await tableRes.json();
    if (tableJson.code !== 200 || !tableJson.data || !tableJson.data.jwtToken) {
      throw new Error(`Failed to get customer JWT token: ${tableJson.message}`);
    }
    jwtToken = tableJson.data.jwtToken;
    console.log(`✓ Obtained customer JWT Token\n`);

    // 1. Verify Products and Modifier Mapping
    console.log('1. Verifying product modifier group mapping (古早味紅茶)...');
    const productsRes = await authFetch(`${API_BASE_URL}/products`);
    if (!productsRes.ok) {
      throw new Error(`Failed to fetch products: ${productsRes.status}`);
    }
    const productsJson = await productsRes.json();
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

    // 2. Create Order with Valid Customizations (Flat)
    console.log('2. Creating order with valid customizations for tea (Flat format)...');
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
    
    const validRes = await authFetch(`${API_BASE_URL}/orders`, {
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

    // 3. Test Invalid Customizations (Constraint validations for tea)
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
    const errRes1 = await authFetch(`${API_BASE_URL}/orders`, {
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
    const errRes2 = await authFetch(`${API_BASE_URL}/orders`, {
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
    const errRes3 = await authFetch(`${API_BASE_URL}/orders`, {
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

    // 6. Test New POS-48 Set Meal Product Query response mapping
    console.log('6. Verifying Set Meal bundleItems query response mapping...');
    const rice = productsJson.data.find(p => p.id === 1);
    if (!rice) {
      throw new Error('Could not find product with ID 1 (招牌滷肉飯)');
    }
    console.log(`Product: ${rice.name}`);
    const riceGroups = rice.modifierGroups || [];
    const setMealGroup = riceGroups.find(g => g.name === '套餐升級');
    if (!setMealGroup) {
      throw new Error('Could not find "套餐升級" modifier group for 招牌滷肉飯');
    }
    const option13 = setMealGroup.options?.find(o => o.id === 13);
    if (!option13) {
      throw new Error('Could not find option ID 13 "升級 B 套餐"');
    }
    console.log(`Option: ${option13.name}, Price modifier: +${option13.priceModifier}`);
    const bundleItems = option13.bundleItems || [];
    console.log(`Bundle items count: ${bundleItems.length}`);
    if (bundleItems.length !== 2) {
      throw new Error(`Expected 2 bundle items for "升級 B 套餐", got ${bundleItems.length}`);
    }

    const itemGreens = bundleItems.find(bi => bi.name === '燙青菜');
    const itemTea = bundleItems.find(bi => bi.name === '紅茶');

    if (!itemGreens || itemGreens.sortOrder !== 0 || (itemGreens.modifierGroups && itemGreens.modifierGroups.length > 0)) {
      throw new Error('Bundle item "燙青菜" validation failed');
    }
    if (!itemTea || itemTea.sortOrder !== 1 || !itemTea.modifierGroups || itemTea.modifierGroups.length !== 2) {
      throw new Error('Bundle item "紅茶" validation failed');
    }

    const teaSweetness = itemTea.modifierGroups.find(g => g.name === '甜度');
    const teaIce = itemTea.modifierGroups.find(g => g.name === '冰塊');
    if (!teaSweetness || teaSweetness.minSelection !== 1 || teaSweetness.maxSelection !== 1) {
      throw new Error('Sweetness modifier group configuration under "紅茶" bundle item failed');
    }
    if (!teaIce || teaIce.minSelection !== 1 || teaIce.maxSelection !== 1) {
      throw new Error('Ice modifier group configuration under "紅茶" bundle item failed');
    }
    console.log('✓ Set Meal bundleItems and recursive modifierGroups query response structure verified.\n');

    // 7. Test Structured Order Creation (selectedOptions payload)
    console.log('7. Creating set meal order with structured "selectedOptions" payload...');
    // Product 1 (招牌滷肉飯 [$50]), Option 13 (升級 B 套餐 [+$60])
    // Bundle Item 2 (紅茶): Sweetness Option 4 (無糖 [+$0]), Ice Option 8 (去冰 [+$0])
    // Expected unit price: $110.00
    const structuredPayload = {
      tableId: 1,
      items: [
        {
          productId: 1,
          quantity: 1,
          note: '結構化套餐無糖去冰',
          selectedOptions: [
            {
              optionId: 13,
              bundleItems: [
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

    const structOrderRes = await authFetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(structuredPayload)
    });
    const structOrderJson = await structOrderRes.json();
    if (structOrderJson.code !== 200) {
      throw new Error(`Failed to create order with structured payload: ${structOrderJson.message}`);
    }

    const sOrder = structOrderJson.data;
    console.log(`✓ Structured Set Meal Order Created: ${sOrder.orderNo}`);
    console.log(`Total amount: $${sOrder.totalAmount} (Expected: $110.00)`);
    if (parseFloat(sOrder.totalAmount) !== 110.00) {
      throw new Error(`Expected total amount to be 110.00, got ${sOrder.totalAmount}`);
    }

    const sItem = sOrder.items[0];
    console.log(`Options Count: ${sItem.options?.length}`);
    if (!sItem.options || sItem.options.length !== 5) {
      throw new Error(`Expected 5 options for structured set meal order item, got ${sItem.options?.length}`);
    }

    const parentOpt = sItem.options.find(o => o.optionId === 13);
    const subSweetOpt = sItem.options.find(o => o.optionId === 4);
    const subIceOpt = sItem.options.find(o => o.optionId === 8);

    if (!parentOpt || !subSweetOpt || !subIceOpt) {
      throw new Error('Could not find all expected options in the response');
    }

    console.log(`Parent Option DB ID: ${parentOpt.id}, parentId: ${parentOpt.parentId} (Expected: null), bundleItemId: ${parentOpt.bundleItemId} (Expected: null)`);
    console.log(`Sweetness Option DB ID: ${subSweetOpt.id}, parentId: ${subSweetOpt.parentId} (Expected: ${parentOpt.id}), bundleItemId: ${subSweetOpt.bundleItemId} (Expected: 2), bundleItemName: "${subSweetOpt.bundleItemName}" (Expected: "紅茶")`);
    console.log(`Ice Option DB ID: ${subIceOpt.id}, parentId: ${subIceOpt.parentId} (Expected: ${parentOpt.id}), bundleItemId: ${subIceOpt.bundleItemId} (Expected: 2), bundleItemName: "${subIceOpt.bundleItemName}" (Expected: "紅茶")`);

    if (parentOpt.parentId !== null && parentOpt.parentId !== undefined) {
      throw new Error(`Expected parent option parentId to be null, got ${parentOpt.parentId}`);
    }
    if (subSweetOpt.parentId !== parentOpt.id || subSweetOpt.bundleItemId !== 2 || subSweetOpt.bundleItemName !== '紅茶') {
      throw new Error('Structured sweetness option database mapping verification failed');
    }
    if (subIceOpt.parentId !== parentOpt.id || subIceOpt.bundleItemId !== 2 || subIceOpt.bundleItemName !== '紅茶') {
      throw new Error('Structured ice option database mapping verification failed');
    }
    console.log('✓ Structured selectedOptions payload parsing and DB lineage mapping verified.\n');

    // 8. Test Legacy Flat Order Creation (Backward Compatibility)
    console.log('8. Creating set meal order with legacy flat "optionIds" payload...');
    const legacyPayload = {
      tableId: 1,
      items: [
        {
          productId: 1,
          quantity: 1,
          note: '扁平相容套餐無糖去冰',
          optionIds: [13, 4, 8]
        }
      ]
    };

    const legacyOrderRes = await authFetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(legacyPayload)
    });
    const legacyOrderJson = await legacyOrderRes.json();
    if (legacyOrderJson.code !== 200) {
      throw new Error(`Failed to create order with legacy payload: ${legacyOrderJson.message}`);
    }

    const lOrder = legacyOrderJson.data;
    console.log(`✓ Legacy Set Meal Order Created: ${lOrder.orderNo}`);
    const lItem = lOrder.items[0];
    const lpOpt = lItem.options.find(o => o.optionId === 13);
    const lsSweetOpt = lItem.options.find(o => o.optionId === 4);
    const lsIceOpt = lItem.options.find(o => o.optionId === 8);

    if (!lpOpt || !lsSweetOpt || !lsIceOpt) {
      throw new Error('Could not find all expected options in legacy response');
    }

    if (lsSweetOpt.parentId !== lpOpt.id || lsSweetOpt.bundleItemId !== 2 || lsSweetOpt.bundleItemName !== '紅茶') {
      throw new Error('Legacy flat sweetness mapping verification failed');
    }
    if (lsIceOpt.parentId !== lpOpt.id || lsIceOpt.bundleItemId !== 2 || lsIceOpt.bundleItemName !== '紅茶') {
      throw new Error('Legacy flat ice mapping verification failed');
    }
    console.log('✓ Legacy flat optionIds automatic reconstruction verified.\n');

    // 9. Validation Test: Missing required option within bundle items
    console.log('9. Verifying validation constraint: bundle item sweetness minSelection = 1...');
    // Missing sweetness for Set B's "紅茶" (bundleItemId: 2) (Only supplying ice option 8)
    const missingSweetPayload = {
      tableId: 1,
      items: [
        {
          productId: 1,
          quantity: 1,
          selectedOptions: [
            {
              optionId: 13,
              bundleItems: [
                {
                  bundleItemId: 2,
                  optionIds: [8] // Only ice, missing sweetness
                }
              ]
            }
          ]
        }
      ]
    };

    const errRes4 = await authFetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(missingSweetPayload)
    });
    const errJson4 = await errRes4.json();
    console.log(`Status code: ${errRes4.status}, Message: "${errJson4.message}"`);
    if (errRes4.status !== 400 || !errJson4.message.includes('最少需選擇') || !errJson4.message.includes('紅茶')) {
      throw new Error('Expected 400 Bad Request with message indicating missing sweetness selection in bundle item 紅茶');
    }
    console.log('✓ Missing bundle item mandatory option validation passed.\n');

    // 10. Validation Test: Option Mismatch (Option does not belong to bundle item)
    console.log('10. Verifying validation constraint: option mismatch (prevent option injection)...');
    // Supplying sweetness Option 4 (無糖) to bundleItemId: 1 (燙青菜, which doesn't support modifier groups)
    const mismatchPayload = {
      tableId: 1,
      items: [
        {
          productId: 1,
          quantity: 1,
          selectedOptions: [
            {
              optionId: 13,
              bundleItems: [
                {
                  bundleItemId: 1, // 燙青菜
                  optionIds: [4] // sweetness option
                },
                {
                  bundleItemId: 2, // 紅茶
                  optionIds: [4, 8]
                }
              ]
            }
          ]
        }
      ]
    };

    const errRes5 = await authFetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mismatchPayload)
    });
    const errJson5 = await errRes5.json();
    console.log(`Status code: ${errRes5.status}, Message: "${errJson5.message}"`);
    if (errRes5.status !== 400 || !errJson5.message.includes('不支援') || !errJson5.message.includes('燙青菜')) {
      throw new Error('Expected 400 Bad Request with message indicating bundle item does not support/contain this option');
    }
    console.log('✓ Mismatched option prevention validation passed.\n');

    // 11. Validation Test: Invalid Bundle Item ID
    console.log('11. Verifying validation constraint: invalid bundle item ID under option...');
    const invalidBiPayload = {
      tableId: 1,
      items: [
        {
          productId: 1,
          quantity: 1,
          selectedOptions: [
            {
              optionId: 13,
              bundleItems: [
                {
                  bundleItemId: 9999, // Non-existent bundle item ID
                  optionIds: [4]
                }
              ]
            }
          ]
        }
      ]
    };

    const errRes6 = await authFetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidBiPayload)
    });
    const errJson6 = await errRes6.json();
    console.log(`Status code: ${errRes6.status}, Message: "${errJson6.message}"`);
    if (errRes6.status !== 400 || !errJson6.message.includes('不包含子餐點')) {
      throw new Error('Expected 400 Bad Request with message indicating set meal option does not contain this bundle item ID');
    }
    console.log('✓ Invalid bundle item ID validation passed.\n');

    // 12. Dynamic Bundle Item Selection & Markup Validation (Case 8)
    console.log('12. Creating dynamic bundle set meal order with markup (Case 8)...');
    // Product 1 (招牌滷肉飯 [$50]), Option 14 (升級 C 套餐 [+$70])
    // Bundle Item 5 (自選小菜, Category 2, Allowance $20): selectedProduct 10 (黃金泡菜, Price $25, excess $5)
    // Bundle Item 6 (自選飲料, Category 3, Allowance $30): selectedProduct 5 (古早味紅茶, Price $30, excess $0)
    //   Sub-options under bundle item 6: Option 4 (無糖 [+$0]), Option 8 (去冰 [+$0])
    // Expected total: $50 + $70 + $5 + $0 = $125.00
    const dynamicPayload = {
      tableId: 1,
      items: [
        {
          productId: 1,
          quantity: 1,
          note: '自選套餐價差客製化測試',
          selectedOptions: [
            {
              optionId: 14,
              bundleItems: [
                {
                  bundleItemId: 5,
                  selectedProductId: 10, // 黃金泡菜
                  optionIds: []
                },
                {
                  bundleItemId: 6,
                  selectedProductId: 5, // 古早味紅茶
                  optionIds: [4, 8] // 無糖, 去冰
                }
              ]
            }
          ]
        }
      ]
    };

    const dynamicRes = await authFetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dynamicPayload)
    });
    const dynamicJson = await dynamicRes.json();
    if (dynamicJson.code !== 200) {
      throw new Error(`Failed to create order with dynamic bundle payload: ${dynamicJson.message}`);
    }

    const dOrder = dynamicJson.data;
    console.log(`✓ Dynamic Bundle Order Created: ${dOrder.orderNo}`);
    console.log(`Total amount: $${dOrder.totalAmount} (Expected: $125.00)`);
    if (parseFloat(dOrder.totalAmount) !== 125.00) {
      throw new Error(`Expected total amount to be 125.00, got ${dOrder.totalAmount}`);
    }

    const dItem = dOrder.items[0];
    console.log(`Options Count: ${dItem.options?.length} (Expected: 5)`);
    if (!dItem.options || dItem.options.length !== 5) {
      throw new Error(`Expected 5 options for dynamic bundle order item, got ${dItem.options?.length}`);
    }

    const dynamicParentOpt = dItem.options.find(o => o.optionId === 14 && o.parentId === null);
    const cabbageOpt = dItem.options.find(o => o.selectedProductId === 10);
    const teaOpt = dItem.options.find(o => o.selectedProductId === 5);
    const teaSweetOpt = dItem.options.find(o => o.optionId === 4);
    const teaIceOpt = dItem.options.find(o => o.optionId === 8);

    if (!dynamicParentOpt || !cabbageOpt || !teaOpt || !teaSweetOpt || !teaIceOpt) {
      throw new Error('Could not find all expected options in dynamic bundle response');
    }

    console.log(`Parent Option DB ID: ${dynamicParentOpt.id}, priceModifier: $${dynamicParentOpt.priceModifier} (Expected: $70.00)`);
    console.log(`Cabbage Option: ${cabbageOpt.optionName}, selectedProductId: ${cabbageOpt.selectedProductId}, priceModifier: $${cabbageOpt.priceModifier} (Expected: $5.00), parentId: ${cabbageOpt.parentId}`);
    console.log(`Tea Option: ${teaOpt.optionName}, selectedProductId: ${teaOpt.selectedProductId}, priceModifier: $${teaOpt.priceModifier} (Expected: $0.00), parentId: ${teaOpt.parentId}`);

    if (parseFloat(dynamicParentOpt.priceModifier) !== 70.00) {
      throw new Error(`Expected parent option price modifier to be 70.00, got ${dynamicParentOpt.priceModifier}`);
    }
    if (parseFloat(cabbageOpt.priceModifier) !== 5.00) {
      throw new Error(`Expected selected product cabbage price modifier to be 5.00, got ${cabbageOpt.priceModifier}`);
    }
    if (parseFloat(teaOpt.priceModifier) !== 0.00) {
      throw new Error(`Expected selected product tea price modifier to be 0.00, got ${teaOpt.priceModifier}`);
    }
    if (cabbageOpt.parentId !== dynamicParentOpt.id || cabbageOpt.bundleItemId !== 5 || cabbageOpt.bundleItemName !== '自選小菜') {
      throw new Error('Cabbage option bundle relation mismatch');
    }
    if (teaOpt.parentId !== dynamicParentOpt.id || teaOpt.bundleItemId !== 6 || teaOpt.bundleItemName !== '自選飲料') {
      throw new Error('Tea option bundle relation mismatch');
    }
    if (teaSweetOpt.parentId !== dynamicParentOpt.id || teaSweetOpt.bundleItemId !== 6 || teaSweetOpt.bundleItemName !== '自選飲料') {
      throw new Error('Sub sweetness option relation mismatch');
    }
    console.log('✓ Dynamic bundle item selection and markup calculation verified.\n');

    // 13. Dynamic Bundle Category Mismatch Validation (Case 9)
    console.log('13. Verifying category mismatch validation for dynamic bundle (Case 9)...');
    // Supplying product 5 (古早味紅茶, Category 3) to bundleItem 5 (自選小菜, Category 2)
    const mismatchCategoryPayload = {
      tableId: 1,
      items: [
        {
          productId: 1,
          quantity: 1,
          selectedOptions: [
            {
              optionId: 14,
              bundleItems: [
                {
                  bundleItemId: 5,
                  selectedProductId: 5, // Red tea (Category 3) instead of Category 2
                  optionIds: []
                }
              ]
            }
          ]
        }
      ]
    };

    const mismatchCategoryRes = await authFetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mismatchCategoryPayload)
    });
    const mismatchCategoryJson = await mismatchCategoryRes.json();
    console.log(`Status code: ${mismatchCategoryRes.status}, Message: "${mismatchCategoryJson.message}"`);
    if (mismatchCategoryRes.status !== 400 || !mismatchCategoryJson.message.includes('不屬於') || !mismatchCategoryJson.message.includes('指定分類')) {
      throw new Error('Expected 400 Bad Request for dynamic bundle item category mismatch');
    }
    console.log('✓ Category mismatch validation passed.\n');

    console.log('==================================================');
    console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('==================================================');
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

runTests();
