package com.project.backend.entity;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class OrderItemOption {
    private Long id;
    private Long orderItemId;
    private Long optionId;
    private String optionName;
    private BigDecimal priceModifier;
    private Long parentId;
    private Long bundleItemId;
    private String bundleItemName;
    private Long selectedProductId;
    private LocalDateTime createdAt;
}
