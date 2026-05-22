package com.project.backend.controller;

import com.project.backend.common.ApiResponse;
import com.project.backend.common.JwtTokenProvider;
import com.project.backend.dto.LoginRequest;
import com.project.backend.dto.LoginResponse;
import com.project.backend.entity.User;
import com.project.backend.mapper.UserMapper;
import jakarta.validation.Valid;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserMapper userMapper;
    private final JwtTokenProvider tokenProvider;

    public AuthController(AuthenticationManager authenticationManager, UserMapper userMapper, JwtTokenProvider tokenProvider) {
        this.authenticationManager = authenticationManager;
        this.userMapper = userMapper;
        this.tokenProvider = tokenProvider;
    }

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest loginRequest) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        loginRequest.getUsername(),
                        loginRequest.getPassword()
                )
        );

        User user = userMapper.findByUsername(loginRequest.getUsername());
        String token = tokenProvider.generateToken(user.getUsername(), user.getRole());

        LoginResponse response = new LoginResponse(
                token,
                user.getUsername(),
                user.getRole(),
                user.getDisplayName()
        );

        return ApiResponse.success("登入成功", response);
    }
}
