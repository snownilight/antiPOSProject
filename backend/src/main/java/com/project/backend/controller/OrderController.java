package com.project.backend.controller;

import com.project.backend.common.ApiResponse;
import com.project.backend.dto.OrderCreateRequest;
import com.project.backend.entity.Order;
import com.project.backend.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @Autowired
    private OrderService orderService;

    @PostMapping
    public ApiResponse<Order> createOrder(@Valid @RequestBody OrderCreateRequest request) {
        Order createdOrder = orderService.createOrder(request);
        return ApiResponse.success("Order created successfully", createdOrder);
    }

    @GetMapping
    public ApiResponse<List<Order>> getAllOrders(
            @RequestParam(required = false) Long tableId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String statuses) {
        List<Order> orders;
        if (statuses != null && !statuses.trim().isEmpty()) {
            List<String> statusList = Arrays.stream(statuses.split(","))
                    .map(String::trim)
                    .filter(value -> !value.isEmpty())
                    .collect(Collectors.toList());
            orders = orderService.getAllActiveOrders(tableId, statusList);
        } else {
            orders = orderService.getAllActiveOrders(tableId, status);
        }
        return ApiResponse.success(orders);
    }

    @GetMapping("/kitchen")
    public ApiResponse<List<Order>> getKitchenOrders() {
        List<Order> orders = orderService.getKitchenOrders();
        return ApiResponse.success(orders);
    }

    @GetMapping("/{id}")
    public ApiResponse<Order> getOrderById(@PathVariable Long id) {
        Order order = orderService.getOrderById(id);
        return ApiResponse.success(order);
    }

    @GetMapping("/no/{orderNo}")
    public ApiResponse<Order> getOrderByOrderNo(@PathVariable String orderNo) {
        Order order = orderService.getOrderByOrderNo(orderNo);
        return ApiResponse.success(order);
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<Order> updateOrderStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String status = body.get("status");
        if (status == null || status.trim().isEmpty()) {
            return ApiResponse.error(400, "Status is required");
        }
        Order updatedOrder = orderService.updateOrderStatus(id, status.trim());
        return ApiResponse.success("Order status updated to " + status, updatedOrder);
    }

    @PostMapping("/{id}/checkout")
    public ApiResponse<Order> checkoutOrder(@PathVariable Long id) {
        Order checkedOutOrder = orderService.checkoutOrder(id);
        return ApiResponse.success("Order checked out successfully", checkedOutOrder);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteOrder(@PathVariable Long id) {
        orderService.deleteOrder(id);
        return ApiResponse.success("Order deleted successfully", null);
    }
}
