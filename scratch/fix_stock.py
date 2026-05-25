import sys

file_path = 'backend/src/main/java/com/project/backend/service/impl/OrderServiceImpl.java'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# We want to replace changeProductStock, deductStock, and replenishStock

old_methods = """    private void changeProductStock(Long productId, Integer quantity, boolean isDeduct) {
        try {
            if (isDeduct) {
                productService.deductStock(productId, quantity);
            } else {
                productService.addStock(productId, quantity);
            }
        } catch (Exception e) {
            log.error("Failed to update stock for product ID: " + productId, e);
        }
    }

    private void deductStock(Order order) {
        try {
            List<OrderItem> items = orderMapper.findItemsByOrderId(order.getId());
            if (items != null) {
                for (OrderItem item : items) {
                    // 1. Deduct primary product stock
                    changeProductStock(item.getProductId(), item.getQuantity(), true);
                    
                    // 2. Deduct selected products in combo options
                    if (item.getOptions() != null) {
                        for (OrderItemOption opt : item.getOptions()) {
                            if (opt.getSelectedProductId() != null) {
                                changeProductStock(opt.getSelectedProductId(), item.getQuantity(), true);
                            }
                        }
                    }
                }
            }
            dashboardService.broadcastDashboardUpdate();
        } catch (Exception e) {
            log.error("Failed to deduct stock for order ID: " + order.getId(), e);
        }
    }

    private void replenishStock(Order order) {
        try {
            List<OrderItem> items = orderMapper.findItemsByOrderId(order.getId());
            if (items != null) {
                for (OrderItem item : items) {
                    // 1. Replenish primary product stock
                    changeProductStock(item.getProductId(), item.getQuantity(), false);
                    
                    // 2. Replenish selected products in combo options
                    if (item.getOptions() != null) {
                        for (OrderItemOption opt : item.getOptions()) {
                            if (opt.getSelectedProductId() != null) {
                                changeProductStock(opt.getSelectedProductId(), item.getQuantity(), false);
                            }
                        }
                    }
                }
            }
            dashboardService.broadcastDashboardUpdate();
        } catch (Exception e) {
            log.error("Failed to replenish stock for order ID: " + order.getId(), e);
        }
    }"""

new_methods = """    private void changeProductStock(Long productId, Integer quantity, boolean isDeduct) {
        if (isDeduct) {
            productService.deductStock(productId, quantity);
        } else {
            productService.addStock(productId, quantity);
        }
    }

    private void deductStock(Order order) {
        List<OrderItem> items = orderMapper.findItemsByOrderId(order.getId());
        if (items != null) {
            for (OrderItem item : items) {
                // 1. Deduct primary product stock
                changeProductStock(item.getProductId(), item.getQuantity(), true);
                
                // 2. Deduct selected products in combo options
                if (item.getOptions() != null) {
                    for (OrderItemOption opt : item.getOptions()) {
                        if (opt.getSelectedProductId() != null) {
                            changeProductStock(opt.getSelectedProductId(), item.getQuantity(), true);
                        }
                    }
                }
            }
        }
        dashboardService.broadcastDashboardUpdate();
    }

    private void replenishStock(Order order) {
        List<OrderItem> items = orderMapper.findItemsByOrderId(order.getId());
        if (items != null) {
            for (OrderItem item : items) {
                // 1. Replenish primary product stock
                changeProductStock(item.getProductId(), item.getQuantity(), false);
                
                // 2. Replenish selected products in combo options
                if (item.getOptions() != null) {
                    for (OrderItemOption opt : item.getOptions()) {
                        if (opt.getSelectedProductId() != null) {
                            changeProductStock(opt.getSelectedProductId(), item.getQuantity(), false);
                        }
                    }
                }
            }
        }
        dashboardService.broadcastDashboardUpdate();
    }"""

if old_methods in content:
    content = content.replace(old_methods, new_methods)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully replaced stock logic")
else:
    # Try line by line replacement with regex or just fallback to simple logic
    print("Could not find the exact old_methods string. The indentation or newlines might differ.")
    sys.exit(1)
