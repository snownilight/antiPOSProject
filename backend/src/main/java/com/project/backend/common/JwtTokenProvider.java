package com.project.backend.common;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Component
public class JwtTokenProvider {

    // Default base64 secret (must be at least 256 bits / 32 bytes)
    private static final String DEFAULT_SECRET = "dGhpcy1pcy1hLXNhZmUta2V5LWZvci1qc29uLXdlYi10b2tlbi12YWxpZGF0aW9uLXNlY3VyZQ==";

    private final SecretKey secretKey;
    private final long expirationMs;

    public JwtTokenProvider(
            @Value("${jwt.secret:" + DEFAULT_SECRET + "}") String secret,
            @Value("${jwt.expiration:86400000}") long expirationMs) { // default 24 hours
        // If the secret is not base64 encoded, or to ensure we have a valid key:
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            // pad or use default if key is too short
            keyBytes = DEFAULT_SECRET.getBytes(StandardCharsets.UTF_8);
        }
        this.secretKey = Keys.hmacShaKeyFor(keyBytes);
        this.expirationMs = expirationMs;
    }

    /**
     * Generate token with subject and role
     */
    public String generateToken(String username, String role) {
        return generateToken(username, role, new HashMap<>());
    }

    /**
     * Generate token with subject, role, and custom claims
     */
    public String generateToken(String username, String role, Map<String, Object> additionalClaims) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expirationMs);

        Map<String, Object> claims = new HashMap<>(additionalClaims);
        claims.put("role", role);

        return Jwts.builder()
                .claims(claims)
                .subject(username)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(secretKey)
                .compact();
    }

    /**
     * Generate a temporary customer token with dining table information
     */
    public String generateCustomerToken(Long tableId, String tableName, String tableToken) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("tableId", tableId);
        claims.put("tableName", tableName);
        claims.put("tableToken", tableToken);
        
        // Customers get an 8-hour token instead of 24-hour
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + (8 * 60 * 60 * 1000));

        return Jwts.builder()
                .subject("table:" + tableId)
                .claim("role", "CUSTOMER")
                .claims(claims)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(secretKey)
                .compact();
    }

    /**
     * Extract claims from JWT token
     */
    public Claims getClaimsFromToken(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    /**
     * Validate JWT Token
     */
    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    /**
     * Get Username/Subject from token
     */
    public String getUsernameFromToken(String token) {
        Claims claims = getClaimsFromToken(token);
        return claims != null ? claims.getSubject() : null;
    }

    /**
     * Get Role from token
     */
    public String getRoleFromToken(String token) {
        Claims claims = getClaimsFromToken(token);
        return claims != null ? claims.get("role", String.class) : null;
    }
}
