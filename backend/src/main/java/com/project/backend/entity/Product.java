package com.project.backend.entity;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class Product {
    private Long id;
    private Long categoryId;
    private String name;
    private String description;
    private BigDecimal price;
    private String imageUrl;
    private String status; // AVAILABLE, SOLD_OUT, HIDDEN
    private Boolean isDeleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
