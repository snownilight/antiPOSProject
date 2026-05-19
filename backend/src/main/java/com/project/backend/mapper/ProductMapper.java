package com.project.backend.mapper;

import com.project.backend.entity.Product;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface ProductMapper {
    List<Product> findAllActive(@Param("categoryId") Long categoryId);
    Product findById(Long id);
    int insert(Product product);
    int update(Product product);
    int softDelete(Long id);
    int updateStatus(@Param("id") Long id, @Param("status") String status);
}
