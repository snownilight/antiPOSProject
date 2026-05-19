# 程式碼風格規範 (Code Style)

## 基礎規範
- 使用 Lombok 以簡化程式碼（如 `@Data`, `@Getter`, `@Setter` 等）。

## 命名規範
- **變數與函式**：使用 `camelCase`（例如：`getUserName`、`isLoading`）
- **元件/類別**：使用 `PascalCase`（例如：`UserProfile`、`LoginForm`）
- **常數**：使用 `UPPER_SNAKE_CASE`（例如：`API_BASE_URL`、`MAX_RETRY_COUNT`）
- **CSS class**：使用 `kebab-case`（例如：`user-profile`、`login-form`）
- **布林值變數**：使用 `is`、`has`、`should` 前綴（例如：`isActive`、`hasPermission`）
