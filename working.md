<!-- 
[AI 讀寫規範]：
每次更新此檔案時，請嚴格保持以下結構：
1. 目前架構/功能現況
2. 已完成的工單與變更 (請附上日期與工單號)
-->

# antiPOS 專案開發進度總結 (Working Summary)

## 1. 目前架構/功能現況

### 📌 環境設定與連線資訊
- **資料庫**：採用本地 MariaDB (`jdbc:mysql://localhost:3306/antipos`，帳密 `root`/`root`)，透過 `schema.sql` 與 `data.sql` 自動初始化。
- **跨域設定**：後端統一配置 CORS，前端定義 API 網址並透過 axios/fetch 介接。

### 💻 後端架構
- **開發環境**：Spring Boot 3.2.5 + MyBatis + Lombok + Java 21。
- **安全防護 (RBAC & JWT)**：整合 Spring Security，支援店員角色（ADMIN、WAITER、KITCHEN）與顧客（CUSTOMER）權限管控，透過過濾器解析 Bearer Token。
- **異常與診斷**：使用 GlobalExceptionHandler 與 ApiResponse，提供 `/api/v1/health` 健康檢查端點。
- **即時通訊**：整合 STOMP over SockJS，即時廣播訂單狀態與看板數據。
- **結帳與發票**：支援複合式支付（一張訂單多筆付款方式記錄）、手機載具與愛心碼 Regex 格式校驗、自動生成電子發票，並連動桌台狀態（所有活動訂單均結清後才轉為清潔中）。

### 🎨 前端架構
- **開發環境**：React + Vite + Vanilla CSS。
- **身分驗證**：全域 AuthContext 結合 localStorage 同步，解決非同步競態問題，並以 ProtectedRoute 進行路由守護與自動超時登出。
- **即時看板與管理介面**：
  - 看板管理：暗色玻璃磨砂風格，提供今日營業額、客單價及熱銷品項統計（支援單點與套餐拆分展示）。
  - 桌台管理：卡片式呈現桌台狀態，整合狀態變更與統一的結帳彈窗 CheckoutModal。
  - 外場點餐與 KDS：支援桌台點餐、廚房即時接單與狀態流轉。
  - 顧客自助點餐：RWD 介面，依桌台 Token 取得暫時權限並進行點餐。

### 🧪 測試資源
- **自動化 E2E 測試**：包含分類商品（test_e2e）、訂單流轉（test_orders）、結帳功能（test_checkout）、即時通訊（test_websocket）、自助點餐（test_qrcode_ordering）、庫存連動（test_combo_stock_and_stats）等 11 項測試。
- **API 測試**：Postman 集合檔案（包含 62 個 API 測試案例）。

---

## 2. 已完成的工單與變更

### 📅 2026-05-23 | [Jira: POS-72] Phase2 專案審視與優化
- **前端收銀彈窗重構**：建立統一的 CheckoutModal 元件，將 TableList 與 OrderList 的收銀、拆帳、載具校驗邏輯合併，精簡 600 行程式碼。
- **後端安全防護**：移除冗餘 CORS 設定，將 `/api/tables/*/qrcode` 限制為 ADMIN/WAITER，增加 `/api/v1/health` 健康檢查端點並調整白名單，修正 JWT role 被覆蓋問題。
- **測試優化**：優化 E2E 測試腳本容錯與錯誤診斷能力，11 項測試 100% 通過。

### 📅 2026-05-23 | [Jira: POS-56] 複合式結帳與模擬電子發票模組
- **資料庫更新**：新增發票欄位、手機載具、愛心碼至 orders 表，新增 order_payment 付款明細表。
- **後端商務邏輯**：實作台灣手機載具與愛心碼格式 Regex 檢驗與互斥限制，結帳後自動生成發票編號並連動桌台狀態。
- **前端拆帳與平分**：結帳彈窗支援動態付款列、未分配金額動態提示、人數平分與除不盡餘數自動分配。

### 📅 2026-05-22 | [Jira: POS-55] 管理員即時營收與庫存數據看板
- **資料庫更新**：新增商品庫存與預警門檻欄位，套餐子項目關聯商品實體。
- **即時數據統計**：實作熱銷品項 SQL 聯表統計（拆分單點與套餐銷售量），並透過 WebSocket 實時廣播。
- **庫存自動增減與自癒**：
  - 點單或審核通過時扣減庫存，取消時回補庫存，並防止重複扣減。
  - 支援套餐/組合商品之遞迴庫存扣減。
  - 庫存為 0 時商品狀態自動設為 SOLD_OUT，回補後自動恢復 AVAILABLE。
- **前端看板 UI/UX**：玻璃磨砂風格卡片，結合 SVG 甜甜圈圓餅圖與分類 Tab 選擇器。

### 📅 2026-05-22 | [Jira: POS-54] 系統權限控管與安全機制 (RBAC & JWT)
- **後端安全建置**：整合 Spring Security 與 jjwt，建立 JwtAuthenticationFilter，配置 API 角色存取權限。
- **資料庫整合**：建立 users 資料表，使用 BCrypt 加密密碼，預設插入系統店員帳號。
- **競態問題修復**：重構 AuthContext 使其與 localStorage 同步讀寫，徹底排除點餐頁未授權 403 競態錯誤。

### 📅 2026-05-21 | [Jira: POS-48] 結構化商品客製化選項與加價系統
- **資料表建立**：新增 modifier_group, modifier_option, product_modifier_group, order_item_option 及其 parent_id。
- **套餐二次客製化**：支援套餐子品項二級客製化（如甜度、冰塊）與 min/max 選擇驗證。
- **動態套餐自選與價差計算**：支援套餐項目依分類自選並計算超額補差價。
- **KDS 直列呈現**：優化廚房看板，將套餐項目自動展開直列顯示，防止漏單。

### 📅 2026-05-21 | [Jira: POS-47] 第一階段專案審視與優化
- **後端清理**：刪除 DebugController，規範 Service 層例外處理，優化流水號高併發性能。
- **前端重構**：分離 CSS 檔案，清理 ESLint 警告並完成生產環境編譯測試。

### 📅 2026-05-21 | [Jira: POS-41] QR Code 自助點餐系統
- **自點流程**：新增桌台 Token UUID 欄位，支援掃碼並提供 waiter 一鍵確認、取消與結帳。
- **自助介面**：新增顧客 RWD 點餐頁，桌台管理支援 QR Code PNG 下載。

### 📅 2026-05-21 | [Jira: POS-33] WebSocket 即時通訊與桌台狀態推播
- **WebSocket 機制**：後端建置 STOMP Message Broker，前端封裝 useWebSocket 提供 5 秒自動重連。
- **狀態通知**：點單、狀態流轉、結帳、桌台清潔完成等事件即時通知與推播。

### 📅 2026-05-18 | [Jira: POS-23] 專用結帳功能與異常防護
- **結帳 API**：新增專用結帳端點，後端重計金額確保一致性，並提供錯誤自癒機制。

### 📅 2026-05-16 | [Jira: POS-22] 前端外場點餐介面與結帳流程
- **介面實作**：外場點餐 UI（OrderInterface），修復 dropdown 銷毀失效、z-index 遮罩殘留與彈窗重疊問題。

### 📅 2026-05-15 | [Jira: POS-21] 後端訂單系統 API
- **訂單 API**：訂單 CRUD、15 碼流水號生成，限制未付款訂單刪除與 SOLD_OUT 商品點購。

### 📅 2026-05-12 | [Jira: POS-18] 前端桌台管理 UI
- **桌台 UI**：卡片式呈現空閒、使用中、清潔中狀態。

### 📅 2026-05-10 | [Jira: POS-14] 後端桌台管理 API
- **桌台 API**：桌台 CRUD 與狀態流轉，整合 Bean Validation 中文提示。
