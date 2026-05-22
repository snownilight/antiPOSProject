package com.project.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.backend.common.JwtTokenProvider;
import com.project.backend.entity.Category;
import com.project.backend.service.CategoryService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = CategoryController.class, excludeAutoConfiguration = {
        org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration.class,
        org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration.class
})
public class CategoryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private CategoryService categoryService;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    public void testGetAllCategories() throws Exception {
        Category category = new Category();
        category.setId(1L);
        category.setName("飲料");
        category.setSortOrder(10);

        Mockito.when(categoryService.getAllActiveCategories()).thenReturn(Arrays.asList(category));

        mockMvc.perform(get("/api/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].name").value("飲料"));
    }

    @Test
    public void testCreateCategory() throws Exception {
        Category category = new Category();
        category.setName("主餐");
        category.setSortOrder(20);

        Category savedCategory = new Category();
        savedCategory.setId(2L);
        savedCategory.setName("主餐");
        savedCategory.setSortOrder(20);

        Mockito.when(categoryService.createCategory(Mockito.any(Category.class))).thenReturn(savedCategory);

        mockMvc.perform(post("/api/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(category)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(2))
                .andExpect(jsonPath("$.data.name").value("主餐"));
    }
}
