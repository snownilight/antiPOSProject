package com.project.backend.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.List;

@Data
public class OrderItemCreateRequest {
    @NotNull(message = "商品 ID 不能為空")
    private Long productId;

    @NotNull(message = "商品數量不能為空")
    @Min(value = 1, message = "商品數量必須大於或等於 1")
    private Integer quantity;

    private String note;

    // Selected customization option IDs (POS-48) (legacy/flat support)
    private List<Long> optionIds;

    // Selected customization option structures (nested set meals) (POS-48)
    private List<SelectedOptionRequest> selectedOptions;

    @Data
    public static class SelectedOptionRequest {
        private Long optionId;
        private List<BundleItemSelection> bundleItems;
    }

    @Data
    public static class BundleItemSelection {
        private Long bundleItemId;
        private List<Long> optionIds;
    }
}


