package com.project.backend.mapper;

import com.project.backend.entity.Category;
import org.apache.ibatis.annotations.Mapper;
import java.util.List;

@Mapper
public interface CategoryMapper {
    List<Category> findAllActive();
    Category findById(Long id);
    int insert(Category category);
    int update(Category category);
    int softDelete(Long id);
}
