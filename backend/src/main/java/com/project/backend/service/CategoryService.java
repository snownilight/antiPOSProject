package com.project.backend.service;

import com.project.backend.entity.Category;
import java.util.List;

public interface CategoryService {
    List<Category> getAllActiveCategories();
    Category getCategoryById(Long id);
    Category createCategory(Category category);
    Category updateCategory(Long id, Category category);
    void deleteCategory(Long id);
}
