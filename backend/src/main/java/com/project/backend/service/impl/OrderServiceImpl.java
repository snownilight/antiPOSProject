package com.project.backend.service.impl;

import com.project.backend.dto.OrderCreateRequest;
import com.project.backend.dto.OrderItemCreateRequest;
import com.project.backend.entity.DiningTable;
import com.project.backend.entity.Order;
import com.project.backend.entity.OrderItem;
import com.project.backend.entity.Product;
import com.project.backend.mapper.OrderMapper;
import com.project.backend.service.DiningTableService;
import com.project.backend.service.OrderService;
import com.project.backend.service.ProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

@Service
public class OrderServiceImpl implements OrderService {

    @Autowired
    private OrderMapper orderMapper;

    @Autowired
    private ProductService productService;

    @Autowired
    private DiningTableService diningTableService;

    private static final List<String> VALID_ORDER_STATUSES = Arrays.asList("PENDING", "PAID", "CANCELLED");

    @Override
    @Transactional
    public Order createOrder(OrderCreateRequest request) {
        // 1. 驗證桌台是否存在
        DiningTable table;
        try {
            table = diningTableService.getTableById(request.getTableId());
        } catch (Exception e) {
            throw new IllegalArgumentException("開單失敗：找不到指定的桌台 (ID: " + request.getTableId() + ")");
        }

        // 2. 計算總金額與建立訂單品項
        BigDecimal totalAmount = BigDecimal.ZERO;
        List<OrderItem> itemsToCreate = new ArrayList<>();

        for (OrderItemCreateRequest itemReq : request.getItems()) {
            Product product;
            try {
                product = productService.getProductById(itemReq.getProductId());
            } catch (Exception e) {
                throw new IllegalArgumentException("開單失敗：找不到商品 (ID: " + itemReq.getProductId() + ")");
            }

            // 檢查商品狀態是否為可用
            if (!"AVAILABLE".equalsIgnoreCase(product.getStatus())) {
                throw new IllegalArgumentException("開單失敗：商品「" + product.getName() + "」已售罄或暫不供應");
            }

            BigDecimal price = product.getPrice();
            BigDecimal quantity = new BigDecimal(itemReq.getQuantity());
            BigDecimal subtotal = price.multiply(quantity);
            totalAmount = totalAmount.add(subtotal);

            OrderItem orderItem = new OrderItem();
            orderItem.setProductId(product.getId());
            orderItem.setProductName(product.getName());
            orderItem.setPrice(price);
            orderItem.setQuantity(itemReq.getQuantity());
            orderItem.setSubtotal(subtotal);
            orderItem.setNote(itemReq.getNote());
            itemsToCreate.add(orderItem);
        }

        // 3. 產生 15 碼訂單編號
        String orderNo = generateOrderNo();

        // 4. 插入訂單主檔
        Order order = new Order();
        order.setTableId(request.getTableId());
        order.setOrderNo(orderNo);
        order.setTotalAmount(totalAmount);
        order.setStatus("PENDING");
        orderMapper.insert(order);

        // 5. 插入訂單明細
        for (OrderItem item : itemsToCreate) {
            item.setOrderId(order.getId());
            orderMapper.insertOrderItem(item);
        }

        // 6. 連動更新桌台狀態為 OCCUPIED (用餐中)
        if (!"OCCUPIED".equalsIgnoreCase(table.getStatus())) {
            diningTableService.updateTableStatus(request.getTableId(), "OCCUPIED");
        }

        return getOrderById(order.getId());
    }

    @Override
    public Order getOrderById(Long id) {
        Order order = orderMapper.findById(id);
        if (order == null) {
            throw new IllegalArgumentException("找不到指定的訂單 (ID: " + id + ")");
        }
        return order;
    }

    @Override
    public Order getOrderByOrderNo(String orderNo) {
        Order order = orderMapper.findByOrderNo(orderNo);
        if (order == null) {
            throw new IllegalArgumentException("找不到指定的訂單編號 (OrderNo: " + orderNo + ")");
        }
        return order;
    }

    @Override
    public List<Order> getAllActiveOrders(Long tableId, String status) {
        return orderMapper.findAllActive(tableId, status);
    }

    @Override
    @Transactional
    public Order updateOrderStatus(Long id, String status) {
        Order order = getOrderById(id);
        String upperStatus = status.toUpperCase();
        if (!VALID_ORDER_STATUSES.contains(upperStatus)) {
            throw new IllegalArgumentException("不合法的訂單狀態: " + status);
        }

        if (order.getStatus().equals(upperStatus)) {
            return order; // 狀態一致無須更新
        }

        // 業務規則驗證：例如已付款或已取消訂單不允許再修改狀態
        if ("PAID".equals(order.getStatus()) || "CANCELLED".equals(order.getStatus())) {
            throw new IllegalArgumentException("訂單已結帳或已取消，無法變更狀態");
        }

        order.setStatus(upperStatus);
        orderMapper.update(order);

        // 7. 桌台狀態連動邏輯
        if ("PAID".equals(upperStatus)) {
            // 付款成功連動更新桌台為 CLEANING (清潔中)
            diningTableService.updateTableStatus(order.getTableId(), "CLEANING");
        } else if ("CANCELLED".equals(upperStatus)) {
            // 取消訂單時，如果桌台沒有其他 PENDING (活動中) 訂單，則連動更新桌台為 EMPTY (空閒)
            List<Order> activeOrders = orderMapper.findAllActive(order.getTableId(), "PENDING");
            boolean hasOtherPending = activeOrders.stream()
                    .anyMatch(o -> !o.getId().equals(order.getId()));
            if (!hasOtherPending) {
                diningTableService.updateTableStatus(order.getTableId(), "EMPTY");
            }
        }

        return getOrderById(id);
    }
    
    @Override
    @Transactional
    public Order checkoutOrder(Long id) {
        Order order = getOrderById(id);
        
        if ("PAID".equals(order.getStatus()) || "CANCELLED".equals(order.getStatus())) {
            throw new IllegalArgumentException("訂單已結帳或已取消，無法重複結帳");
        }
        
        // 1. 計算金額
        List<OrderItem> items = orderMapper.findItemsByOrderId(id);
        BigDecimal totalAmount = BigDecimal.ZERO;
        for (OrderItem item : items) {
            totalAmount = totalAmount.add(item.getSubtotal());
        }
        order.setTotalAmount(totalAmount);
        
        // 2. 更新狀態為 PAID
        order.setStatus("PAID");
        orderMapper.update(order);
        
        // 3. 桌台狀態連動邏輯
        diningTableService.updateTableStatus(order.getTableId(), "CLEANING");
        
        return getOrderById(id);
    }

    @Override
    @Transactional
    public void deleteOrder(Long id) {
        Order order = getOrderById(id);
        // 僅允許刪除已付款或已取消的訂單以防誤刪活動中的訂單
        if ("PENDING".equals(order.getStatus())) {
            throw new IllegalArgumentException("無法刪除未付款的活動中訂單，請先取消或結帳");
        }
        orderMapper.softDelete(id);
    }

    /**
     * 產生符合規則的 15 碼訂單編號
     * 結構: TW-YYMMDD-XXXXX
     * - 前綴: TW
     * - 日期: 採用 UTC+8 (Asia/Taipei) 的 YYMMDD
     * - 混淆流水號: 5 碼隨機字元 (排除易混淆字元 I, O, L, U)
     */
    private String generateOrderNo() {
        String prefix = "TW";
        LocalDate date = LocalDate.now(ZoneId.of("Asia/Taipei"));
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyMMdd");
        String dateStr = date.format(formatter);

        // 排除 I, O, L, U 之後的字元池
        String charPool = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
        Random random = new Random();
        StringBuilder sb = new StringBuilder(5);
        for (int i = 0; i < 5; i++) {
            sb.append(charPool.charAt(random.nextInt(charPool.length())));
        }

        return prefix + "-" + dateStr + "-" + sb.toString();
    }
}
