package com.project.backend.controller;

import com.project.backend.common.ApiResponse;
import com.project.backend.entity.Category;
import com.project.backend.service.CategoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
@CrossOrigin(origins = "http://localhost:5173")
public class CategoryController {

    @Autowired
    private CategoryService categoryService;

    @GetMapping
    public ApiResponse<List<Category>> getAllCategories() {
        return ApiResponse.success(categoryService.getAllActiveCategories());
    }

    @GetMapping("/{id}")
    public ApiResponse<Category> getCategoryById(@PathVariable Long id) {
        return ApiResponse.success(categoryService.getCategoryById(id));
    }

    @PostMapping
    public ApiResponse<Category> createCategory(@RequestBody Category category) {
        return ApiResponse.success("Category created successfully", categoryService.createCategory(category));
    }

    @PutMapping("/{id}")
    public ApiResponse<Category> updateCategory(@PathVariable Long id, @RequestBody Category category) {
        return ApiResponse.success("Category updated successfully", categoryService.updateCategory(id, category));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteCategory(@PathVariable Long id) {
        categoryService.deleteCategory(id);
        return ApiResponse.success("Category deleted successfully", null);
    }
}
