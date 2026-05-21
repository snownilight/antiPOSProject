package com.project.backend.controller;

import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/debug")
public class DebugController {

    @PostMapping("/log")
    public Map<String, String> logMessage(@RequestBody Map<String, Object> payload) {
        String logLine = "[FRONTEND_DEBUG] " + payload.get("message") + " | Data: " + payload.get("data");
        System.out.println(logLine);
        try {
            java.nio.file.Files.writeString(
                java.nio.file.Path.of("frontend_debug.log"),
                logLine + "\n",
                java.nio.file.StandardOpenOption.CREATE,
                java.nio.file.StandardOpenOption.APPEND
            );
        } catch (Exception e) {
            e.printStackTrace();
        }
        return Map.of("status", "ok");
    }
}
