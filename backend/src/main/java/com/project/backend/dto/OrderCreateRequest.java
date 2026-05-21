package com.project.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.List;

@Data
public class OrderCreateRequest {
    private Long tableId;
    private String tableToken;

    @NotEmpty(message = "訂單品項不能為空")
    @Valid
    private List<OrderItemCreateRequest> items;
}
