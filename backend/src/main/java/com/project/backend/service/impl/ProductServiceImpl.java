package com.project.backend.service.impl;

import com.project.backend.entity.Product;
import com.project.backend.mapper.ProductMapper;
import com.project.backend.service.ProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

import com.project.backend.service.DashboardService;

@Service
public class ProductServiceImpl implements ProductService {

    @Autowired
    private ProductMapper productMapper;

    @Autowired
    private DashboardService dashboardService;

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
        
        Product createdProduct = productMapper.findById(product.getId());
        checkAndBroadcastProductUpdate(createdProduct);
        return createdProduct;
    }

    @Override
    public Product updateProduct(Long id, Product product) {
        getProductById(id);
        product.setId(id);
        productMapper.update(product);
        Product updatedProduct = productMapper.findById(id);
        checkAndBroadcastProductUpdate(updatedProduct);
        return updatedProduct;
    }

    @Override
    public void deleteProduct(Long id) {
        getProductById(id);
        productMapper.softDelete(id);
        // Deleting a product should also update the dashboard alerts list
        dashboardService.broadcastDashboardUpdate();
    }

    @Override
    public void updateProductStatus(Long id, String status) {
        getProductById(id);
        productMapper.updateStatus(id, status);
        Product updatedProduct = productMapper.findById(id);
        checkAndBroadcastProductUpdate(updatedProduct);
    }

    private void checkAndBroadcastProductUpdate(Product product) {
        if (product != null) {
            int stock = product.getStock() != null ? product.getStock() : 0;
            int threshold = product.getStockAlertThreshold() != null ? product.getStockAlertThreshold() : 0;
            if (stock <= threshold || "SOLD_OUT".equalsIgnoreCase(product.getStatus())) {
                dashboardService.broadcastStockAlert(product);
            }
            dashboardService.broadcastDashboardUpdate();
        }
    }
}
