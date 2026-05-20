package com.project.backend.service.impl;

import com.project.backend.entity.DiningTable;
import com.project.backend.mapper.DiningTableMapper;
import com.project.backend.service.DiningTableService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Arrays;

@Service
public class DiningTableServiceImpl implements DiningTableService {

    @Autowired
    private DiningTableMapper diningTableMapper;

    private static final List<String> VALID_STATUSES = Arrays.asList("EMPTY", "OCCUPIED", "CLEANING");

    @Override
    public List<DiningTable> getAllActiveTables() {
        return diningTableMapper.findAllActive();
    }

    @Override
    public DiningTable getTableById(Long id) {
        DiningTable table = diningTableMapper.findById(id);
        if (table == null) {
            throw new RuntimeException("Table not found with id: " + id);
        }
        return table;
    }

    @Override
    public DiningTable createTable(DiningTable table) {
        if (table.getSeats() == null || table.getSeats() <= 0) {
            table.setSeats(2); // default to 2 seats
        }
        if (table.getStatus() == null || !VALID_STATUSES.contains(table.getStatus())) {
            table.setStatus("EMPTY");
        }
        diningTableMapper.insert(table);
        return diningTableMapper.findById(table.getId());
    }

    @Override
    public DiningTable updateTable(Long id, DiningTable table) {
        DiningTable existing = getTableById(id);
        table.setId(id);
        if (table.getStatus() != null && !VALID_STATUSES.contains(table.getStatus())) {
            throw new RuntimeException("Invalid table status: " + table.getStatus());
        }
        diningTableMapper.update(table);
        return diningTableMapper.findById(id);
    }

    @Override
    public void deleteTable(Long id) {
        getTableById(id);
        diningTableMapper.softDelete(id);
    }

    @Override
    public DiningTable updateTableStatus(Long id, String status) {
        DiningTable existing = getTableById(id);
        if (status == null || !VALID_STATUSES.contains(status)) {
            throw new RuntimeException("Invalid table status: " + status);
        }
        DiningTable updateObj = new DiningTable();
        updateObj.setId(id);
        updateObj.setStatus(status);
        diningTableMapper.update(updateObj);
        return diningTableMapper.findById(id);
    }
}
