package com.project.backend.entity;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class DiningTable {
    private Long id;
    private String name;
    private Integer seats;
    private String status; // EMPTY, OCCUPIED, CLEANING
    private Boolean isDeleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
