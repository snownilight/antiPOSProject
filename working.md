<!-- 
[AI 讀寫規範]：
每次更新此檔案時，請嚴格保持以下結構：
1. 目前架構/功能現況
2. 已完成的工單與變更 (請附上日期與工單號)
-->

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

### 3. 後端訂單系統 API (Jira: POS-21)
- **實作內容**：`Order` 與 `OrderItem` 的完整 CRUD、狀態變更與聯表查詢明細 API (`/api/orders`)。
- **編號產生規則**：固定 15 碼 `TW-YYMMDD-XXXXX`（時區強制為 UTC+8 台北時間，後 5 碼隨機流水號排除易混淆字元 `I`, `O`, `L`, `U`）。
- **桌台狀態自動連動**：
  - 允許單一桌台重複開立多筆 `PENDING` 訂單。
  - 新增訂單：桌台狀態自動連動轉為 `OCCUPIED` (用餐中)。
  - 訂單付款：狀態變為 `PAID`，桌台連動更新為 `CLEANING` (清潔中)。
  - 訂單取消：狀態變為 `CANCELLED`，若該桌台無其他活動中的 `PENDING` 訂單，則連動還原桌台為 `EMPTY` (空閒)。
- **安全與業務驗證**：自動阻擋購買已下架或已售完（`SOLD_OUT`/`HIDDEN`）的商品，且未付款的活動中訂單不允許直接刪除。

### 4. 前端外場點餐介面與結帳流程 (Jira: POS-22)
- **實作內容**：新增服務生點餐介面 [OrderInterface.jsx](file:///d:/Learing/project/antiPOSProject/frontend/src/components/admin/OrderInterface.jsx)，支援選桌點餐、分類篩選、商品加點、數量備註與送單。調整選單排序（桌台、點餐、商品、分類）與預設路由導向。
- **桌台狀態連動與加點**：桌台管理頁的「開桌點餐」或「加點」會引導並鎖定桌台 ID 到點餐介面。送出訂單後發送 POST 請求至後端，桌台狀態將由後端自動連動轉為 `OCCUPIED`。
- **多訂單合併結帳與付款**：對 `OCCUPIED` 桌台點擊「結帳」，會拉取該桌台所有的 `PENDING` 訂單，於彈窗中展示消費明細並合併計價。確認付款後併行將訂單改為 `PAID`，使桌台由後端連動轉為 `CLEANING`。
- **容錯與重置**：對於 `OCCUPIED` 桌台查無訂單的情境，提供「手動設為清潔中」的安全回退機制。

---

## 🧪 測試與驗證資源
- **自動化 E2E 測試**：
  - 桌台、商品與分類模組測試：`C:\Users\snown\.gemini\antigravity-ide\scratch\test_e2e.js` (包含 SQL 注入防護、XSS 攻擊阻擋等共 **76 項 API 邊緣條件測試皆 100% 通過**)。
  - 訂單系統模組測試：`C:\Users\snown\.gemini\antigravity-ide\brain\1df2973f-ed92-47fb-831a-2642f728deec\scratch\test_orders.js` (包含 15 碼自定義訂單編號格式、排除混淆字元、桌台狀態雙向連動、刪除限制與售罄驗證等 **8 大核心情境皆 100% 通過**)。
- **Postman 匯入檔**：
  - 位置：[postman/antiPOS_API_Collection.json](file:///d:/Learing/project/antiPOSProject/postman/antiPOS_API_Collection.json)
  - 包含：全模組（分類、商品、桌台、訂單）共計 **62 個 API 測試案例**。

---

## 🌿 Git 分支狀態
- 當前分支：`POS-22` (開發中分支，包含外場點餐介面與多訂單結帳流程)。
