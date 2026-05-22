package com.project.backend.mapper;

import com.project.backend.entity.User;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper {
    User findByUsername(String username);
    int insert(User user);
}
