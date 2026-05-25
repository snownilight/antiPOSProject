const fs = require('fs');

const filePath = 'backend/src/main/java/com/project/backend/service/impl/OrderServiceImpl.java';
let content = fs.readFileSync(filePath, 'utf8');

// Replace changeProductStock
content = content.replace(
    /private void changeProductStock\(Long productId, int quantity, boolean isDeduct\) \{\s+try \{\s+Product product = productService\.getProductById\(productId\);\s+if \(product != null\) \{\s+int currentStock = product\.getStock\(\) != null \? product\.getStock\(\) : 0;\s+int newStock;\s+if \(isDeduct\) \{\s+newStock = Math\.max\(0, currentStock - quantity\);\s+product\.setStock\(newStock\);\s+if \(newStock == 0\) \{\s+product\.setStatus\("SOLD_OUT"\);\s+\}\s+\} else \{\s+newStock = currentStock \+ quantity;\s+product\.setStock\(newStock\);\s+if \("SOLD_OUT"\.equalsIgnoreCase\(product\.getStatus\(\)\) && newStock > 0\) \{\s+product\.setStatus\("AVAILABLE"\);\s+\}\s+\}\s+productService\.updateProduct\(product\.getId\(\), product\);\s+int threshold = product\.getStockAlertThreshold\(\) != null \? product\.getStockAlertThreshold\(\) : 0;\s+if \(newStock <= threshold \|\| "SOLD_OUT"\.equalsIgnoreCase\(product\.getStatus\(\)\)\) \{\s+dashboardService\.broadcastStockAlert\(product\);\s+\}\s+\}\s+\} catch \(Exception e\) \{\s+log\.error\("Failed to update stock for product ID: " \+ productId, e\);\s+\}\s+\}/,
    `private void changeProductStock(Long productId, int quantity, boolean isDeduct) {
        Product product = productService.getProductById(productId);
        if (product != null) {
            int currentStock = product.getStock() != null ? product.getStock() : 0;
            int newStock;
            if (isDeduct) {
                if (currentStock < quantity) {
                    throw new IllegalArgumentException("商品 " + product.getName() + " 庫存不足！(剩餘: " + currentStock + ")");
                }
                newStock = currentStock - quantity;
                product.setStock(newStock);
                if (newStock == 0) {
                    product.setStatus("SOLD_OUT");
                }
            } else {
                newStock = currentStock + quantity;
                product.setStock(newStock);
                if ("SOLD_OUT".equalsIgnoreCase(product.getStatus()) && newStock > 0) {
                    product.setStatus("AVAILABLE");
                }
            }
            productService.updateProduct(product.getId(), product);
            
            int threshold = product.getStockAlertThreshold() != null ? product.getStockAlertThreshold() : 0;
            if (newStock <= threshold || "SOLD_OUT".equalsIgnoreCase(product.getStatus())) {
                dashboardService.broadcastStockAlert(product);
            }
        }
    }`
);

// Replace deductStock
content = content.replace(
    /private void deductStock\(Order order\) \{\s+try \{\s+List<OrderItem> items = orderMapper\.findItemsByOrderId\(order\.getId\(\)\);\s+if \(items != null\) \{\s+for \(OrderItem item : items\) \{\s+\/\/ 1\. Deduct primary product stock\s+changeProductStock\(item\.getProductId\(\), item\.getQuantity\(\), true\);\s+\/\/ 2\. Deduct selected products in combo options\s+if \(item\.getOptions\(\) != null\) \{\s+for \(OrderItemOption opt : item\.getOptions\(\)\) \{\s+if \(opt\.getSelectedProductId\(\) != null\) \{\s+changeProductStock\(opt\.getSelectedProductId\(\), item\.getQuantity\(\), true\);\s+\}\s+\}\s+\}\s+\}\s+\}\s+dashboardService\.broadcastDashboardUpdate\(\);\s+\} catch \(Exception e\) \{\s+log\.error\("Failed to deduct stock for order ID: " \+ order\.getId\(\), e\);\s+\}\s+\}/,
    `private void deductStock(Order order) {
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
    }`
);

// Replace replenishStock
content = content.replace(
    /private void replenishStock\(Order order\) \{\s+try \{\s+List<OrderItem> items = orderMapper\.findItemsByOrderId\(order\.getId\(\)\);\s+if \(items != null\) \{\s+for \(OrderItem item : items\) \{\s+\/\/ 1\. Replenish primary product stock\s+changeProductStock\(item\.getProductId\(\), item\.getQuantity\(\), false\);\s+\/\/ 2\. Replenish selected products in combo options\s+if \(item\.getOptions\(\) != null\) \{\s+for \(OrderItemOption opt : item\.getOptions\(\)\) \{\s+if \(opt\.getSelectedProductId\(\) != null\) \{\s+changeProductStock\(opt\.getSelectedProductId\(\), item\.getQuantity\(\), false\);\s+\}\s+\}\s+\}\s+\}\s+\}\s+dashboardService\.broadcastDashboardUpdate\(\);\s+\} catch \(Exception e\) \{\s+log\.error\("Failed to replenish stock for order ID: " \+ order\.getId\(\), e\);\s+\}\s+\}/,
    `private void replenishStock(Order order) {
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
    }`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Replaced successfully with regex.");
