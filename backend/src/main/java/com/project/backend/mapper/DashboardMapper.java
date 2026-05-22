package com.project.backend.mapper;

import com.project.backend.dto.DashboardDataDTO.ProductSalesDTO;
import com.project.backend.dto.DashboardDataDTO.ProductStockAlertDTO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface DashboardMapper {
    BigDecimal getTodayRevenue(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);
    
    int getTodayPaidOrderCount(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);
    
    List<ProductSalesDTO> getTodayTopProducts(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);
    
    List<ProductStockAlertDTO> getStockAlerts();
}
