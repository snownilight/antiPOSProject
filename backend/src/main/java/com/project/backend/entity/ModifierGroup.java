package com.project.backend.entity;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class ModifierGroup {
    private Long id;
    private String name;
    private Integer minSelection;
    private Integer maxSelection;
    private Boolean isDeleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Associated options
    private List<ModifierOption> options;
}
