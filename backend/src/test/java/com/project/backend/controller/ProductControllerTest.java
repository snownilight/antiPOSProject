package com.project.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.backend.common.JwtTokenProvider;
import com.project.backend.entity.Product;
import com.project.backend.service.ProductService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = ProductController.class, excludeAutoConfiguration = {
        org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration.class,
        org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration.class
})
public class ProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ProductService productService;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    public void testGetAllProducts() throws Exception {
        Product p = new Product();
        p.setId(1L);
        p.setName("珍珠奶茶");
        p.setPrice(new BigDecimal("60.00"));
        p.setStatus("AVAILABLE");

        Mockito.when(productService.getAllActiveProducts(null)).thenReturn(Arrays.asList(p));

        mockMvc.perform(get("/api/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].name").value("珍珠奶茶"))
                .andExpect(jsonPath("$.data[0].price").value(60.0));
    }

    @Test
    public void testUpdateProductStatus() throws Exception {
        Map<String, String> body = new HashMap<>();
        body.put("status", "SOLD_OUT");

        Mockito.doNothing().when(productService).updateProductStatus(1L, "SOLD_OUT");

        mockMvc.perform(patch("/api/products/1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.message").value("Product status updated to SOLD_OUT"));
    }
}
