package com.project.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardEventDTO {
    private String event; // "DASHBOARD_UPDATE", "STOCK_ALERT"
    private Object data;  // payload, e.g. DashboardDataDTO or ProductStockAlertDTO
}
