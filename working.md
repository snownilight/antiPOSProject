# antiPOS 專案開發進度總結 (Working Summary)

## 📌 環境設定與連線資訊
- **資料庫**：已由 H2 移轉至本地 **MariaDB**。
  - 連線網址：`jdbc:mysql://localhost:3306/antipos` (帳密 `root`/`root`)
  - 初始化指令：使用 `schema.sql` 與 `data.sql` (含有防重複載入的 `IF NOT EXISTS` / `INSERT IGNORE`)。
- **跨域 CORS 設定**：已由各 Controller 的 `@CrossOrigin` 抽離，集中至 [CorsConfig.java](file:///d:/Learing/project/antiPOSProject/backend/src/main/java/com/project/backend/common/CorsConfig.java)。可由 `application.properties` 中的 `cors.allowed-origins` 統一控制。
- **前端 API Base URL**：抽離為環境變數設定。
  - 設定檔：[frontend/.env](file:///d:/Learing/project/antiPOSProject/frontend/.env) (`VITE_API_BASE_URL=http://localhost:8081/api`)
  - 引用模組：[frontend/src/utils/api.js](file:///d:/Learing/project/antiPOSProject/frontend/src/utils/api.js) 的 `API_BASE_URL` 常數。

---

## 🛠️ 已完成功能與優化

### 1. 後端桌台管理 API (Jira: POS-14)
- **實作內容**：`DiningTable` 的完整 CRUD 與狀態更新 API (`/api/tables`)。
- **狀態流轉**：`EMPTY` (空閒) ➔ `OCCUPIED` (用餐中) ➔ `CLEANING` (清潔中) ➔ `EMPTY`。
- **Bean Validation**：全面導入 `@Valid` 以及 `@NotBlank`、`@DecimalMin`、`@Min` 等約束，在 Controller 層完成阻擋，回傳標準 `400 Bad Request` 與繁中錯誤訊息。

### 2. 前端桌台管理 UI (Jira: POS-18)
- **實作元件**：[TableList.jsx](file:///d:/Learing/project/antiPOSProject/frontend/src/components/admin/TableList.jsx)。
- **功能亮點**：
  - 桌台卡片式 Grid 網格排版，依狀態（空閒 🟢、使用中 🔴、清潔中 🟡）動態呈現配色。
  - 支援一鍵快速狀態流轉按鈕（開桌/結帳清潔/清潔完成）。
  - 新增/編輯彈窗及軟刪除提示。
- **路由配置**：在 `App.jsx` 配置 `/admin/tables`，並在 `ProductDashboard.jsx` 側邊欄加入連結。

---

## 🧪 測試與驗證資源
- **自動化 E2E 測試**：
  - 腳本位置：`C:\Users\snown\.gemini\antigravity-ide\scratch\test_e2e.js`
  - 測試結果：全模組 (Category, Product, Table) 包含 SQL 注入防護、XSS 攻擊阻擋等共 **76 項 API 邊緣條件測試皆 100% 通過**。
- **Postman 匯入檔**：
  - 位置：[postman/antiPOS_API_Collection.json](file:///d:/Learing/project/antiPOSProject/postman/antiPOS_API_Collection.json)
  - 包含：全模組共 51 個 API 測試案例。

---

## 🌿 Git 分支狀態
- 當前分支：`dev` (工作區完全乾淨，已將 `POS-14` 與 `POS-18` 功能分支安全合併至此)。
- 本地 commit 領先 origin/dev，待 push 遠端。
