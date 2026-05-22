package com.project.backend.service.impl;

import com.project.backend.dto.DashboardDataDTO;
import com.project.backend.dto.DashboardEventDTO;
import com.project.backend.mapper.DashboardMapper;
import com.project.backend.service.DashboardService;
import com.project.backend.entity.Product;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements DashboardService {

    private final DashboardMapper dashboardMapper;
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public DashboardDataDTO getTodayDashboardData() {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Taipei"));
        LocalDateTime startTime = today.atStartOfDay();
        LocalDateTime endTime = today.atTime(LocalTime.MAX);

        BigDecimal todayRevenue = dashboardMapper.getTodayRevenue(startTime, endTime);
        int paidOrderCount = dashboardMapper.getTodayPaidOrderCount(startTime, endTime);
        
        BigDecimal averageOrderAmount = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        if (paidOrderCount > 0) {
            averageOrderAmount = todayRevenue.divide(BigDecimal.valueOf(paidOrderCount), 2, RoundingMode.HALF_UP);
        }

        List<DashboardDataDTO.ProductSalesDTO> topProducts = dashboardMapper.getTodayTopProducts(startTime, endTime);
        List<DashboardDataDTO.ProductStockAlertDTO> stockAlerts = dashboardMapper.getStockAlerts();

        return DashboardDataDTO.builder()
                .todayRevenue(todayRevenue)
                .paidOrderCount(paidOrderCount)
                .averageOrderAmount(averageOrderAmount)
                .topProducts(topProducts)
                .stockAlerts(stockAlerts)
                .build();
    }

    @Override
    public void broadcastDashboardUpdate() {
        try {
            DashboardDataDTO data = getTodayDashboardData();
            DashboardEventDTO event = DashboardEventDTO.builder()
                    .event("DASHBOARD_UPDATE")
                    .data(data)
                    .build();
            messagingTemplate.convertAndSend("/topic/dashboard", event);
            log.info("Successfully broadcasted dashboard update via WebSocket");
        } catch (Exception e) {
            log.error("Failed to broadcast dashboard update: ", e);
        }
    }

    @Override
    public void broadcastStockAlert(Product product) {
        try {
            DashboardDataDTO.ProductStockAlertDTO alert = DashboardDataDTO.ProductStockAlertDTO.builder()
                    .productId(product.getId())
                    .productName(product.getName())
                    .stock(product.getStock())
                    .stockAlertThreshold(product.getStockAlertThreshold())
                    .status(product.getStatus())
                    .build();
            
            DashboardEventDTO event = DashboardEventDTO.builder()
                    .event("STOCK_ALERT")
                    .data(alert)
                    .build();
            messagingTemplate.convertAndSend("/topic/dashboard", event);
            log.info("Successfully broadcasted stock alert for product: {}", product.getName());
        } catch (Exception e) {
            log.error("Failed to broadcast stock alert: ", e);
        }
    }
}
