package com.project.backend.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class OrderItemCreateRequest {
    @NotNull(message = "商品 ID 不能為空")
    private Long productId;

    @NotNull(message = "商品數量不能為空")
    @Min(value = 1, message = "商品數量必須大於或等於 1")
    private Integer quantity;

    private String note;
}
