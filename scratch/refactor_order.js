const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../backend/src/main/java/com/project/backend/service/impl/OrderServiceImpl.java');
let content = fs.readFileSync(filePath, 'utf-8');

const startStr = "    public Order createOrder(OrderCreateRequest request) {";
const endStr = "    public Order getOrderById(Long id) {";

let startIdx = content.indexOf(startStr);
let endIdx = content.indexOf(endStr);

if (startIdx === -1 || endIdx === -1) {
    console.error("Boundaries not found");
    process.exit(1);
}

let overrideIdx = content.lastIndexOf("    @Override", startIdx);
let methodEndIdx = content.lastIndexOf("    }", endIdx) + 5;

let originalMethod = content.substring(overrideIdx, methodEndIdx);

let loopStartStr = "        for (OrderItemCreateRequest itemReq : request.getItems()) {";
let loopStartIdx = originalMethod.indexOf(loopStartStr);
if (loopStartIdx === -1) {
    console.error("Loop start not found");
    process.exit(1);
}

let braceCount = 1;
// Start counting after the opening brace
let idx = originalMethod.indexOf('{', loopStartIdx) + 1;
while (braceCount > 0 && idx < originalMethod.length) {
    if (originalMethod[idx] === '{') braceCount++;
    else if (originalMethod[idx] === '}') braceCount--;
    idx++;
}
let loopEndIdx = idx;

// Extract loop body without the outer braces
let loopBody = originalMethod.substring(originalMethod.indexOf('{', loopStartIdx) + 1, loopEndIdx - 1);

let replace1From = "            totalAmount = totalAmount.add(subtotal);";
let replace2From = "            itemsToCreate.add(orderItem);";

if (!loopBody.includes(replace1From) || !loopBody.includes(replace2From)) {
    console.error("Replacements not found in loop body!");
    process.exit(1);
}

let loopBodyModified = loopBody
    .replace(replace1From, "")
    .replace(replace2From, "            return orderItem;");

const newMethod = `    @Override
    @Transactional
    public Order createOrder(OrderCreateRequest request) {
        // 1. 驗證與獲取桌台
        DiningTable table = validateAndFetchTable(request);

        // 2. 計算總金額與建立訂單品項
        BigDecimal totalAmount = BigDecimal.ZERO;
        List<OrderItem> itemsToCreate = new ArrayList<>();

        for (OrderItemCreateRequest itemReq : request.getItems()) {
            OrderItem orderItem = processOrderItem(itemReq);
            totalAmount = totalAmount.add(orderItem.getSubtotal());
            itemsToCreate.add(orderItem);
        }

        // 3. 產生 15 碼訂單編號
        String orderNo = generateOrderNo();

        // 4. 決定初始狀態與插入訂單主檔
        boolean isGuestOrder = request.getTableToken() != null && !request.getTableToken().trim().isEmpty();
        String initialStatus = (isGuestOrder && requireStaffConfirm) ? "PENDING_CONFIRM" : "PENDING";

        Order order = new Order();
        order.setTableId(table.getId());
        order.setOrderNo(orderNo);
        order.setTotalAmount(totalAmount);
        order.setStatus(initialStatus);
        orderMapper.insert(order);

        // 5. 插入訂單明細
        saveOrderItems(order.getId(), itemsToCreate);

        // 6. 連動更新桌台狀態為 OCCUPIED (用餐中)
        if (!"OCCUPIED".equalsIgnoreCase(table.getStatus())) {
            diningTableService.updateTableStatus(table.getId(), "OCCUPIED");
        }

        Order createdOrder = getOrderById(order.getId());

        if ("PENDING".equals(initialStatus)) {
            deductStock(createdOrder);
        }

        // 7. 廣播 WebSocket 事件 (POS-33)
        broadcastOrderEvent("ORDER_CREATED", createdOrder);

        return createdOrder;
    }

    private DiningTable validateAndFetchTable(OrderCreateRequest request) {
        if (request.getTableToken() != null && !request.getTableToken().trim().isEmpty()) {
            try {
                return diningTableService.getTableByToken(request.getTableToken().trim());
            } catch (Exception e) {
                throw new IllegalArgumentException("開單失敗：找不到指定的桌台 (Token: " + request.getTableToken() + ")");
            }
        } else if (request.getTableId() != null) {
            try {
                return diningTableService.getTableById(request.getTableId());
            } catch (Exception e) {
                throw new IllegalArgumentException("開單失敗：找不到指定的桌台 (ID: " + request.getTableId() + ")");
            }
        } else {
            throw new IllegalArgumentException("開單失敗：桌台 ID 或 Token 不能為空");
        }
    }

    private void saveOrderItems(Long orderId, List<OrderItem> itemsToCreate) {
        for (OrderItem item : itemsToCreate) {
            item.setOrderId(orderId);
            orderMapper.insertOrderItem(item);
            
            if (item.getOptions() != null) {
                Map<Long, Long> parentDbIdMap = new HashMap<>();
                for (OrderItemOption opt : item.getOptions()) {
                    if (opt.getParentId() == null) {
                        opt.setOrderItemId(item.getId());
                        orderMapper.insertOrderItemOption(opt);
                        parentDbIdMap.put(opt.getOptionId(), opt.getId());
                    }
                }
                
                for (OrderItemOption opt : item.getOptions()) {
                    if (opt.getParentId() != null) {
                        Long dbParentId = parentDbIdMap.get(opt.getParentId());
                        opt.setOrderItemId(item.getId());
                        opt.setParentId(dbParentId);
                        orderMapper.insertOrderItemOption(opt);
                    }
                }
            }
        }
    }

    private OrderItem processOrderItem(OrderItemCreateRequest itemReq) {
${loopBodyModified}
    }\n`;

content = content.substring(0, overrideIdx) + newMethod + content.substring(methodEndIdx);

fs.writeFileSync(filePath, content, 'utf-8');
console.log("Success");
