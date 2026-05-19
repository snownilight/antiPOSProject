package com.project.backend.common;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<String> handleCustomException(IllegalArgumentException e) {
        return ApiResponse.error(400, e.getMessage());
    }

    @ExceptionHandler(NoHandlerFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<String> handleNoHandlerFound(NoHandlerFoundException ex) {
        return ApiResponse.error(404, "404 Not Found: " + ex.getRequestURL());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<String> handleValidationException(MethodArgumentNotValidException ex) {
        // 利用 Java 21 SequencedCollection 特性，直接取得第一個錯誤 (取代舊版的 stream().findFirst())
        var error = ex.getBindingResult().getFieldErrors().getFirst();
        return ApiResponse.error(400, error.getField() + ": " + error.getDefaultMessage());
    }

    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<String> handleConstraintViolationException(ConstraintViolationException ex) {
        // 利用 var 關鍵字與 iterator 直接拿取第一個驗證錯誤
        var violation = ex.getConstraintViolations().iterator().next();
        return ApiResponse.error(400, violation.getPropertyPath() + ": " + violation.getMessage());
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<String> handleException(Exception e) {
        log.error("Unhandled exception occurred: ", e);
        return ApiResponse.error(500, "Internal Server Error, try again later");
    }
}
