package com.project.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.List;

@Data
public class OrderCreateRequest {
    @NotNull(message = "桌台 ID 不能為空")
    private Long tableId;

    @NotEmpty(message = "訂單品項不能為空")
    @Valid
    private List<OrderItemCreateRequest> items;
}
