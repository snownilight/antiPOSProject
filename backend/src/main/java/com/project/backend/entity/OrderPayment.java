package com.project.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderPayment {
    private Long id;
    private Long orderId;
    private String paymentMethod;
    private BigDecimal amount;
    private LocalDateTime createdAt;
}
