package com.project.backend.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
public class CheckoutRequest {
    private List<PaymentRequest> payments;
    private String carrierNo;
    private String loveCode;

    @Data
    public static class PaymentRequest {
        private String paymentMethod; // CASH, LINE_PAY, CREDIT_CARD, etc.
        private BigDecimal amount;
    }
}
