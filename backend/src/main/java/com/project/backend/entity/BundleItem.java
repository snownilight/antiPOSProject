package com.project.backend.entity;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class BundleItem {
    private Long id;
    private Long optionId;
    private String name;
    private Integer sortOrder;
    private Boolean isDeleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Associated modifier groups for this specific bundle item
    private List<ModifierGroup> modifierGroups;
}
