# API 設計規範 (API Guidelines)

本專案的前後端通訊 API 遵循統一的回傳格式與例外處理機制（參考你 GitHub 中的 `backtowork` 專案標準）。

## 1. 統一回傳格式 (ApiResponse)

所有 API 請求（無論成功或失敗）都必須封裝成統一的 JSON 格式：

```json
{
  "code": 200,          // HTTP 狀態碼或自定義錯誤碼
  "message": "Success", // 執行結果訊息
  "data": { ... }       // 實際的回傳資料，發生錯誤時通常為 null
}
```

### 後端實作規範：
- 必須使用共用的 `ApiResponse<T>` 類別包裝回傳值。
- **成功時**：呼叫 `ApiResponse.success(data)` 或 `ApiResponse.success(message, data)`
- **失敗時**：呼叫 `ApiResponse.error(code, message)`

## 2. 全域例外處理 (GlobalExceptionHandler)

系統中的錯誤與例外，將統一由 `@RestControllerAdvice` 進行攔截處理，並確保最終必定回傳上述的 `ApiResponse` 格式給前端。

### 已定義的例外攔截規則：
- **`IllegalArgumentException`**：一般參數錯誤，回傳 `400 (Bad Request)`。
- **參數驗證失敗**（`MethodArgumentNotValidException`, `ConstraintViolationException`）：表單參數或實體欄位驗證失敗，回傳 `400 (Bad Request)`，並自動提取出**第一個驗證錯誤**的訊息回傳。
- **`NoHandlerFoundException`**：找不到對應的 API 路由，回傳 `404 (Not Found)`。
- **`Exception.class`**：其他未預期的伺服器錯誤，統一攔截並回傳 `500 (Internal Server Error)`，避免後端 Stacktrace 曝露給前端。

## 3. 網址命名風格 (RESTful URL)
- 資源名稱請使用**名詞複數**與 **kebab-case**（例如：`GET /api/v1/users`, `POST /api/v1/user-profiles`）。
- 網址中**不應包含動詞**（動作由 HTTP Method 表示，如 GET 取得, POST 新增, PUT 更新, DELETE 刪除）。
