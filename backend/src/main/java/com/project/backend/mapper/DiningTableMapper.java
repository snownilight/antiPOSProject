package com.project.backend.mapper;

import com.project.backend.entity.DiningTable;
import org.apache.ibatis.annotations.Mapper;
import java.util.List;

@Mapper
public interface DiningTableMapper {
    List<DiningTable> findAllActive();
    DiningTable findById(Long id);
    DiningTable findByToken(String token);
    int insert(DiningTable table);
    int update(DiningTable table);
    int softDelete(Long id);
}
