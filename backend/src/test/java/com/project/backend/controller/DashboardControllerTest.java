package com.project.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.backend.common.JwtTokenProvider;
import com.project.backend.dto.DashboardDataDTO;
import com.project.backend.service.DashboardService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.ArrayList;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = DashboardController.class, excludeAutoConfiguration = {
        org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration.class,
        org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration.class
})
public class DashboardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DashboardService dashboardService;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @Test
    public void testGetTodayDashboardData() throws Exception {
        DashboardDataDTO dto = DashboardDataDTO.builder()
                .todayRevenue(new BigDecimal("1250.00"))
                .paidOrderCount(5)
                .averageOrderAmount(new BigDecimal("250.00"))
                .topProducts(new ArrayList<>())
                .stockAlerts(new ArrayList<>())
                .build();

        Mockito.when(dashboardService.getTodayDashboardData()).thenReturn(dto);

        mockMvc.perform(get("/api/dashboard/today"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.todayRevenue").value(1250.0))
                .andExpect(jsonPath("$.data.paidOrderCount").value(5))
                .andExpect(jsonPath("$.data.averageOrderAmount").value(250.0));
    }
}
