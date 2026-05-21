package com.project.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * WebSocket 訂單事件廣播 DTO
 * 用於將訂單狀態變動即時推送至所有連線客戶端
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderEventDTO {
    /** 事件類型：ORDER_CREATED / ORDER_STATUS_CHANGED */
    private String event;
    /** 訂單 ID */
    private Long orderId;
    /** 訂單編號 (15 碼) */
    private String orderNo;
    /** 桌台名稱 */
    private String tableName;
    /** 桌台 ID */
    private Long tableId;
    /** 訂單狀態 */
    private String status;
    /** 事件發生時間 (ISO 8601) */
    private String timestamp;
}
