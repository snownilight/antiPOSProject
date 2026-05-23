package com.project.backend.service;

import com.project.backend.dto.OrderCreateRequest;
import com.project.backend.dto.CheckoutRequest;
import com.project.backend.entity.Order;
import java.util.List;

public interface OrderService {
    Order createOrder(OrderCreateRequest request);
    Order getOrderById(Long id);
    Order getOrderByOrderNo(String orderNo);
    List<Order> getAllActiveOrders(Long tableId, String status);
    List<Order> getAllActiveOrders(Long tableId, List<String> statuses);
    List<Order> getKitchenOrders();
    Order updateOrderStatus(Long id, String status);
    Order checkoutOrder(Long id, CheckoutRequest request);
    void deleteOrder(Long id);
}
