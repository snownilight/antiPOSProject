package com.project.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardDataDTO {
    private BigDecimal todayRevenue;
    private int paidOrderCount;
    private BigDecimal averageOrderAmount;
    private List<ProductSalesDTO> topProducts;
    private List<ProductStockAlertDTO> stockAlerts;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProductSalesDTO {
        private Long productId;
        private String productName;
        private Integer quantitySold;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProductStockAlertDTO {
        private Long productId;
        private String productName;
        private Integer stock;
        private Integer stockAlertThreshold;
        private String status; // AVAILABLE, SOLD_OUT
    }
}
