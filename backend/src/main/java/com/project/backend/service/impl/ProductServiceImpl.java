package com.project.backend.service.impl;

import com.project.backend.entity.Product;
import com.project.backend.mapper.ProductMapper;
import com.project.backend.service.ProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ProductServiceImpl implements ProductService {

    @Autowired
    private ProductMapper productMapper;

    @Override
    public List<Product> getAllActiveProducts(Long categoryId) {
        return productMapper.findAllActive(categoryId);
    }

    @Override
    public Product getProductById(Long id) {
        Product product = productMapper.findById(id);
        if (product == null) {
            throw new IllegalArgumentException("找不到指定的商品 (ID: " + id + ")");
        }
        return product;
    }

    @Override
    public Product createProduct(Product product) {
        if (product.getStatus() == null || product.getStatus().isEmpty()) {
            product.setStatus("AVAILABLE");
        }
        productMapper.insert(product);
        return productMapper.findById(product.getId());
    }

    @Override
    public Product updateProduct(Long id, Product product) {
        getProductById(id);
        product.setId(id);
        productMapper.update(product);
        return productMapper.findById(id);
    }

    @Override
    public void deleteProduct(Long id) {
        getProductById(id);
        productMapper.softDelete(id);
    }

    @Override
    public void updateProductStatus(Long id, String status) {
        getProductById(id);
        productMapper.updateStatus(id, status);
    }
}
