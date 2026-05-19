package com.project.backend.service;

import com.project.backend.entity.Product;
import java.util.List;

public interface ProductService {
    List<Product> getAllActiveProducts(Long categoryId);
    Product getProductById(Long id);
    Product createProduct(Product product);
    Product updateProduct(Long id, Product product);
    void deleteProduct(Long id);
    void updateProductStatus(Long id, String status);
}
