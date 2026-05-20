package com.project.backend.controller;

import com.project.backend.common.ApiResponse;
import com.project.backend.entity.DiningTable;
import com.project.backend.service.DiningTableService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tables")
@CrossOrigin(origins = "http://localhost:5173")
public class DiningTableController {

    @Autowired
    private DiningTableService diningTableService;

    @GetMapping
    public ApiResponse<List<DiningTable>> getAllTables() {
        return ApiResponse.success(diningTableService.getAllActiveTables());
    }

    @GetMapping("/{id}")
    public ApiResponse<DiningTable> getTableById(@PathVariable Long id) {
        return ApiResponse.success(diningTableService.getTableById(id));
    }

    @PostMapping
    public ApiResponse<DiningTable> createTable(@RequestBody DiningTable table) {
        return ApiResponse.success("Table created successfully", diningTableService.createTable(table));
    }

    @PutMapping("/{id}")
    public ApiResponse<DiningTable> updateTable(@PathVariable Long id, @RequestBody DiningTable table) {
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
}
