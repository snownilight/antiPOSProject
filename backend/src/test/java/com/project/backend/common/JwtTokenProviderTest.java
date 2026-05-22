package com.project.backend.common;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class JwtTokenProviderTest {

    private final JwtTokenProvider tokenProvider = new JwtTokenProvider(
            "dGhpcy1pcy1hLXNhZmUta2V5LWZvci1qc29uLXdlYi10b2tlbi12YWxpZGF0aW9uLXNlY3VyZQ==",
            3600000 // 1 hour
    );

    @Test
    public void testGenerateCustomerTokenHasRoleAndTableInfo() {
        String token = tokenProvider.generateCustomerToken(1L, "A1", "token-a1");
        assertNotNull(token);
        assertTrue(tokenProvider.validateToken(token));

        String role = tokenProvider.getRoleFromToken(token);
        assertEquals("CUSTOMER", role);

        String username = tokenProvider.getUsernameFromToken(token);
        assertEquals("table:1", username);

        Claims claims = tokenProvider.getClaimsFromToken(token);
        assertNotNull(claims);
        assertEquals(1L, ((Number) claims.get("tableId")).longValue());
        assertEquals("A1", claims.get("tableName"));
        assertEquals("token-a1", claims.get("tableToken"));
    }

    @Test
    public void testGenerateTokenHasRole() {
        String token = tokenProvider.generateToken("admin", "ADMIN");
        assertNotNull(token);
        assertTrue(tokenProvider.validateToken(token));

        String role = tokenProvider.getRoleFromToken(token);
        assertEquals("ADMIN", role);

        String username = tokenProvider.getUsernameFromToken(token);
        assertEquals("admin", username);
    }
}
