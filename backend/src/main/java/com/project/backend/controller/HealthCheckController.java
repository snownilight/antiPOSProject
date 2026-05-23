package com.project.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.project.backend.common.ApiResponse;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/health")
public class HealthCheckController {

    /**
     * 測試正常回傳 ApiResponse
     */
    @GetMapping
    public ApiResponse<Map<String, String>> checkHealth() {
        var data = Map.of(
            "status", "UP",
            "framework", "Spring Boot 3 + Java 21"
        );
        return ApiResponse.success("HealthCheck API 測試成功！", data);
    }

    /**
     * 測試 GlobalExceptionHandler 攔截 IllegalArgumentException
     */
    @GetMapping("/error-test")
    public ApiResponse<String> triggerError() {
        // 故意拋出例外來測試攔截器是否會轉成自訂的 400 JSON 錯誤格式
        throw new IllegalArgumentException("這是一個測試用的參數錯誤例外！");
    }
}
