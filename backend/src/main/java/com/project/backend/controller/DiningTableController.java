package com.project.backend.controller;

import com.project.backend.common.ApiResponse;
import com.project.backend.entity.DiningTable;
import com.project.backend.service.DiningTableService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;

import java.util.List;
import java.util.Map;
import com.project.backend.common.JwtTokenProvider;

@RestController
@RequestMapping("/api/tables")
public class DiningTableController {

    @Value("${app.frontend.url:http://localhost:5173}")
    private String frontendUrl;

    @Autowired
    private DiningTableService diningTableService;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @GetMapping
    public ApiResponse<List<DiningTable>> getAllTables() {
        return ApiResponse.success(diningTableService.getAllActiveTables());
    }

    @GetMapping("/{id}")
    public ApiResponse<DiningTable> getTableById(@PathVariable Long id) {
        return ApiResponse.success(diningTableService.getTableById(id));
    }

    @PostMapping
    public ApiResponse<DiningTable> createTable(@Valid @RequestBody DiningTable table) {
        return ApiResponse.success("Table created successfully", diningTableService.createTable(table));
    }

    @PutMapping("/{id}")
    public ApiResponse<DiningTable> updateTable(@PathVariable Long id, @Valid @RequestBody DiningTable table) {
        return ApiResponse.success("Table updated successfully", diningTableService.updateTable(id, table));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteTable(@PathVariable Long id) {
        diningTableService.deleteTable(id);
        return ApiResponse.success("Table deleted successfully", null);
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<DiningTable> updateTableStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String status = body.get("status");
        if (status == null || status.isEmpty()) {
            return ApiResponse.error(400, "Status is required");
        }
        try {
            DiningTable updated = diningTableService.updateTableStatus(id, status);
            return ApiResponse.success("Table status updated to " + status, updated);
        } catch (Exception e) {
            return ApiResponse.error(400, e.getMessage());
        }
    }

    @GetMapping("/{id}/qrcode")
    public ResponseEntity<byte[]> getTableQRCode(@PathVariable Long id) {
        try {
            DiningTable table = diningTableService.getTableById(id);
            String token = table.getToken();
            if (token == null || token.isEmpty()) {
                token = java.util.UUID.randomUUID().toString();
                table.setToken(token);
                diningTableService.updateTable(id, table);
            }
            String qrCodeText = frontendUrl + "/order?token=" + token;
            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            BitMatrix bitMatrix = qrCodeWriter.encode(qrCodeText, BarcodeFormat.QR_CODE, 300, 300);
            
            java.io.ByteArrayOutputStream pngOutputStream = new java.io.ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(bitMatrix, "PNG", pngOutputStream);
            byte[] pngData = pngOutputStream.toByteArray();
            
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_PNG)
                    .body(pngData);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(null);
        }
    }

    @GetMapping("/token/{token}")
    public ApiResponse<DiningTable> getTableByToken(@PathVariable String token) {
        try {
            DiningTable table = diningTableService.getTableByToken(token);
            if (table != null) {
                String jwt = jwtTokenProvider.generateCustomerToken(table.getId(), table.getName(), table.getToken());
                table.setJwtToken(jwt);
            }
            return ApiResponse.success(table);
        } catch (Exception e) {
            return ApiResponse.error(404, e.getMessage());
        }
    }
}

