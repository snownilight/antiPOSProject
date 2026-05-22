package com.project.backend.entity;

import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class Product {
    private Long id;

    @NotNull(message = "必須選擇分類")
    private Long categoryId;

    @NotBlank(message = "商品名稱不能為空")
    @Size(max = 200, message = "商品名稱不能超過 200 個字元")
    private String name;

    @Size(max = 500, message = "商品描述不能超過 500 個字元")
    private String description;

    @NotNull(message = "價格不能為空")
    @DecimalMin(value = "0.0", inclusive = true, message = "價格不能為負數")
    @Digits(integer = 8, fraction = 2, message = "價格格式不正確")
    private BigDecimal price;

    @Size(max = 1000, message = "圖片網址不能超過 1000 個字元")
    private String imageUrl;

    private String status; // AVAILABLE, SOLD_OUT, HIDDEN
    private Boolean isDeleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Customization options (POS-48)
    private List<ModifierGroup> modifierGroups;
}

