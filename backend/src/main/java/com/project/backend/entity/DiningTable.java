package com.project.backend.entity;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class DiningTable {
    private Long id;

    @NotBlank(message = "桌台名稱不能為空")
    @Size(max = 50, message = "桌台名稱不能超過 50 個字元")
    private String name;

    @Min(value = 1, message = "座位數至少為 1")
    private Integer seats;

    private String status; // EMPTY, OCCUPIED, CLEANING
    private Boolean isDeleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
