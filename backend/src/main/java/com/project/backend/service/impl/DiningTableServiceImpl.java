package com.project.backend.service.impl;

import com.project.backend.entity.DiningTable;
import com.project.backend.mapper.DiningTableMapper;
import com.project.backend.service.DiningTableService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class DiningTableServiceImpl implements DiningTableService {

    @Autowired
    private DiningTableMapper diningTableMapper;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

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
        DiningTable updated = diningTableMapper.findById(id);
        if (table.getStatus() != null && !table.getStatus().equals(existing.getStatus())) {
            broadcastTableStatusChanged(updated, existing.getStatus());
        }
        return updated;
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
        if (status.equals(existing.getStatus())) {
            return existing;
        }
        DiningTable updateObj = new DiningTable();
        updateObj.setId(id);
        updateObj.setStatus(status);
        diningTableMapper.update(updateObj);
        DiningTable updated = diningTableMapper.findById(id);
        broadcastTableStatusChanged(updated, existing.getStatus());
        return updated;
    }

    private void broadcastTableStatusChanged(DiningTable table, String previousStatus) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("event", "TABLE_STATUS_CHANGED");
        event.put("tableId", table.getId());
        event.put("tableName", table.getName());
        event.put("status", table.getStatus());
        event.put("previousStatus", previousStatus);
        event.put("timestamp", LocalDateTime.now(ZoneId.of("Asia/Taipei"))
                .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        messagingTemplate.convertAndSend("/topic/orders", event);
    }
}
