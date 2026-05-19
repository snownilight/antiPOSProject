package com.project.backend.controller;

import com.project.backend.common.ApiResponse;
import com.project.backend.entity.Product;
import com.project.backend.service.ProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/products")
@CrossOrigin(origins = "http://localhost:5173")
public class ProductController {

    @Autowired
    private ProductService productService;

    @GetMapping
    public ApiResponse<List<Product>> getAllProducts(@RequestParam(required = false) Long categoryId) {
        return ApiResponse.success(productService.getAllActiveProducts(categoryId));
    }

    @GetMapping("/{id}")
    public ApiResponse<Product> getProductById(@PathVariable Long id) {
        return ApiResponse.success(productService.getProductById(id));
    }

    @PostMapping
    public ApiResponse<Product> createProduct(@RequestBody Product product) {
        return ApiResponse.success("Product created successfully", productService.createProduct(product));
    }

    @PutMapping("/{id}")
    public ApiResponse<Product> updateProduct(@PathVariable Long id, @RequestBody Product product) {
        return ApiResponse.success("Product updated successfully", productService.updateProduct(id, product));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteProduct(@PathVariable Long id) {
        productService.deleteProduct(id);
        return ApiResponse.success("Product deleted successfully", null);
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<Void> updateProductStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String status = body.get("status");
        if (status == null || status.isEmpty()) {
            return ApiResponse.error(400, "Status is required");
        }
        productService.updateProductStatus(id, status);
        return ApiResponse.success("Product status updated to " + status, null);
    }
}
