import sys

with open('backend/src/main/java/com/project/backend/service/impl/OrderServiceImpl.java', 'r', encoding='utf-8') as f:
    content = f.read()

start_str = "    @Override\n    @Transactional\n    public Order createOrder(OrderCreateRequest request) {"
end_str = "    }\n\n    @Override\n    public Order getOrderById(Long id) {"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx == -1 or end_idx == -1:
    print("Could not find boundaries")
    sys.exit(1)

original_method = content[start_idx:end_idx + 5]

loop_start_str = "        for (OrderItemCreateRequest itemReq : request.getItems()) {\n"
loop_start = original_method.find(loop_start_str)

brace_count = 1
idx = loop_start + len(loop_start_str)
while brace_count > 0 and idx < len(original_method):
    if original_method[idx] == '{': brace_count += 1
    elif original_method[idx] == '}': brace_count -= 1
    idx += 1
loop_end = idx

loop_body = original_method[loop_start + len(loop_start_str):loop_end - 1]

loop_body_modified = loop_body.replace(
    "            totalAmount = totalAmount.add(subtotal);\n\n            OrderItem orderItem = new OrderItem();",
    "            OrderItem orderItem = new OrderItem();"
).replace(
    "            itemsToCreate.add(orderItem);",
    "            return orderItem;"
)

new_method = """    @Override
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
""" + loop_body_modified + """
    }"""

content = content[:start_idx] + new_method + content[end_idx:]

with open('backend/src/main/java/com/project/backend/service/impl/OrderServiceImpl.java', 'w', encoding='utf-8') as f:
    f.write(content)

print("Success")
