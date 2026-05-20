package com.project.backend.entity;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class Category {
    private Long id;

    @NotBlank(message = "分類名稱不能為空")
    @Size(max = 100, message = "分類名稱不能超過 100 個字元")
    private String name;

    @Min(value = 0, message = "排序權重不能為負數")
    private Integer sortOrder;

    private Boolean isDeleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
