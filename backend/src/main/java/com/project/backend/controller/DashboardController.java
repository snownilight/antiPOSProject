package com.project.backend.controller;

import com.project.backend.common.ApiResponse;
import com.project.backend.dto.DashboardDataDTO;
import com.project.backend.service.DashboardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    @Autowired
    private DashboardService dashboardService;

    @GetMapping("/today")
    public ApiResponse<DashboardDataDTO> getTodayDashboardData() {
        return ApiResponse.success(dashboardService.getTodayDashboardData());
    }
}
