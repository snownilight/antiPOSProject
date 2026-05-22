package com.project.backend.entity;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class User {
    private Long id;
    private String username;
    private String password;
    private String role; // ADMIN, WAITER, KITCHEN, CUSTOMER
    private String displayName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
