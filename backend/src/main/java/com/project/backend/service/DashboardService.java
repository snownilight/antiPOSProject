package com.project.backend.service;

import com.project.backend.dto.DashboardDataDTO;
import com.project.backend.entity.Product;

public interface DashboardService {
    DashboardDataDTO getTodayDashboardData();
    void broadcastDashboardUpdate();
    void broadcastStockAlert(Product product);
}
