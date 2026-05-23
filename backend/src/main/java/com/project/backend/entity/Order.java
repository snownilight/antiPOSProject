package com.project.backend.entity;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class Order {
    private Long id;
    private Long tableId;
    private String orderNo;
    private BigDecimal totalAmount;
    private String status; // PENDING, PREPARING, READY, PAID, CANCELLED
    private String invoiceNo;
    private String carrierNo;
    private String loveCode;
    private Boolean isDeleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Relation fields
    private List<OrderItem> items;
    private List<OrderPayment> payments;
    private String tableName; // Table name populated by join queries
}
