package com.project.backend.service.impl;

import com.project.backend.entity.Category;
import com.project.backend.mapper.CategoryMapper;
import com.project.backend.service.CategoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CategoryServiceImpl implements CategoryService {

    @Autowired
    private CategoryMapper categoryMapper;

    @Override
    public List<Category> getAllActiveCategories() {
        return categoryMapper.findAllActive();
    }

    @Override
    public Category getCategoryById(Long id) {
        Category category = categoryMapper.findById(id);
        if (category == null) {
            throw new IllegalArgumentException("找不到指定的分類 (ID: " + id + ")");
        }
        return category;
    }

    @Override
    public Category createCategory(Category category) {
        if (category.getSortOrder() == null) {
            category.setSortOrder(0);
        }
        categoryMapper.insert(category);
        return categoryMapper.findById(category.getId());
    }

    @Override
    public Category updateCategory(Long id, Category category) {
        Category existing = getCategoryById(id);
        category.setId(id);
        categoryMapper.update(category);
        return categoryMapper.findById(id);
    }

    @Override
    public void deleteCategory(Long id) {
        getCategoryById(id);
        categoryMapper.softDelete(id);
    }
}
