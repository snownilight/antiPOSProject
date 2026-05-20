package com.project.backend.service;

import com.project.backend.entity.DiningTable;
import java.util.List;

public interface DiningTableService {
    List<DiningTable> getAllActiveTables();
    DiningTable getTableById(Long id);
    DiningTable createTable(DiningTable table);
    DiningTable updateTable(Long id, DiningTable table);
    void deleteTable(Long id);
    DiningTable updateTableStatus(Long id, String status);
}
