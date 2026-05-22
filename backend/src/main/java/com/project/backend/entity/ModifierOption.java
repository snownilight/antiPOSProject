package com.project.backend.entity;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class ModifierOption {
    private Long id;
    private Long groupId;
    private String name;
    private BigDecimal priceModifier;
    private Boolean isDeleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Nested sub-groups for this option
    private List<ModifierGroup> modifierGroups;
}
