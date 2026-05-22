<!-- 
[AI 讀寫規範]：
每次更新此檔案時，請嚴格保持以下結構：
1. 目前架構/功能現況
2. 已完成的工單與變更 (請附上日期與工單號)
-->

# antiPOS 專案開發進度總結 (Working Summary)

## 1. 目前架構/功能現況

### 📌 環境設定與連線資訊
- **資料庫**：採用本地 **MariaDB**。
  - 連線網址：`jdbc:mysql://localhost:3306/antipos` (帳密 `root`/`root`)。
  - 初始化：透過具有 `IF NOT EXISTS` 與 `INSERT IGNORE` 防重複載入設計的 `schema.sql` 與 `data.sql` 進行。
- **跨域 CORS 設定**：
  - 後端集中至 [WebMvcConfig.java](file:///d:/Learing/project/antiPOSProject/backend/src/main/java/com/project/backend/common/WebMvcConfig.java) 進行配置。
  - 環境變數檔 [frontend/.env](file:///d:/Learing/project/antiPOSProject/frontend/.env) 定義 `VITE_API_BASE_URL=http://localhost:8081/api`。
  - 統一於 [api.js](file:///d:/Learing/project/antiPOSProject/frontend/src/utils/api.js) 中導出 `API_BASE_URL`。

### 💻 後端架構
- **開發環境**：Spring Boot 3.2.5 + MyBatis + Lombok + Java 21。
- **安全與權限控制 (RBAC & JWT)**：
  - 整合 Spring Security 與無狀態 JWT 驗證。
  - 支持店員角色（`ADMIN`、`WAITER`、`KITCHEN`）與顧客角色（`CUSTOMER`）之安全認證與存取。
  - 透過全域過濾器 `JwtAuthenticationFilter` 解析 `Bearer` Token，並在安全配置中為 `/error` 路徑配置 `permitAll()` 防止二次權限阻擋衝突。
- **異常與錯誤處理**：
  - 採用 `GlobalExceptionHandler` 搭配統一格式的 `ApiResponse`。
  - 服務層 (Service) 例外已收斂為 mapping-compatible exceptions (如 `IllegalArgumentException`)，拋出時會自動轉化為 `400 Bad Request`，保障 API 的防護與穩定度。
- **即時通訊服務**：
  - 整合 `spring-boot-starter-websocket` 與 STOMP over SockJS。
  - 廣播主題包含為廚房與外場桌台設計的 `/topic/orders` (傳遞 `OrderEventDTO` 與 `TableStatusEvent` 事件載荷)，以及專供看板即時更新的 `/topic/dashboard`。
- **訂單編號生成**：
  - 採用 15 碼格式 `TW-YYMMDD-XXXXX`（台北時區 UTC+8，後五碼排除混淆字元 `I`, `O`, `L`, `U`），並採用 `ThreadLocalRandom` 優化高併發效能。

### 🎨 前端架構
- **開發環境**：React + Vite + Vanilla CSS。
- **認證與路由守護 (Route Guards)**：
  - 全域 `AuthContext` 狀態管理，採用 `localStorage` 同步讀寫機制，徹底排除父子組件 Effect 生命週期競態條件 (Race Condition)。
  - 封裝 `<ProtectedRoute>`，針對未登入用戶重定向至登入頁，權限不符時導向 `/403` 自定義無權限頁。
  - 統一攔截 `window.fetch` 以自動附帶 `Authorization: Bearer <token>` 標頭，並於 401 狀態時自動登出。
- **樣式分離設計**：
  - 所有 JSX 元件的樣式皆已徹底抽離至獨立的 CSS 檔案中（如 `TableList.css`, `CustomerOrder.css` 等），元件代碼乾淨清爽。
- **WebSocket 連線**：
  - 自訂 [useWebSocket.js](file:///d:/Learing/project/antiPOSProject/frontend/src/hooks/useWebSocket.js) React Hook，具備 5 秒延遲自動重連以及元件卸載 (unmount) 時自動斷開連線的功能。
- **管理後台與顧客介面路由**：
  - 看板管理 (`/admin/dashboard`)：暗色系玻璃磨砂風格即時營收數據、付款訂單數、客單價看板，結合動態 SVG 甜甜圈熱銷品項圖表，支援分類排行 Pill 按鈕切換以及單點/套餐銷售數據拆分標記展示。
  - 桌台管理 (`/admin/tables`)：依狀態（空閒 🟢、使用中 🔴、清潔中 🟡）動態呈現卡片配色，支援狀態快速流轉與 QR Code 下載。
  - 外場點餐 (`/admin/order`)：支援鎖定桌台、商品加點與數量備註，並具備 Modal 遮罩殘留清除與 CSS z-index 層級自動修正。
  - 訂單審核與歷史 (`/admin/orders`)：支援搜尋與分類分頁，提供一鍵審核自點訂單、取消及結帳功能。
  - 廚房看板 KDS (`/admin/kitchen`)：即時顯示準備中訂單，並可一鍵流轉製作狀態。
  - 顧客自助點餐頁 (`/order?token=...`)：顧客 RWD 點餐，包含購物車 Drawer 與 WebSocket 狀態即時更新監聽，並等待顧客認證 Session 準備就緒後再拉取選單，避免存取拒絕。

### 🧪 測試與驗證資源
- **自動化 E2E 測試**：
  - 分類、商品與桌台測試：`scratch/test_e2e.js` (含安全性注入防護，共 76 項 API 邊緣條件測試 100% 通過)。
  - 訂單模組測試：`brain/.../scratch/test_orders.js` (含桌台雙向連動、刪除限制與售罄驗證等 8 大核心情境 100% 通過)。
  - 結帳功能測試：`scratch/test_checkout.js` (含重複結帳阻擋、明細加總計算，100% 通過)。
  - WebSocket 測試：`brain/.../scratch/test_websocket.js` (含握手、事件廣播與延遲驗證共 17 項 100% 通過，廣播延遲 25ms)。
  - 自助點餐整合測試：`scratch/test_qrcode_ordering.js` (涵蓋顧客點餐、待確認、服務生審核、狀態連動與 KDS 接單全流程，100% 通過)。
  - 套餐與庫存統計整合測試：`scratch/test_combo_stock_and_stats.js` (含套餐項目扣減、自癒、即時銷售數據拆分統計與累計更新等驗證，100% 通過)。
- **安全單元測試**：
  - `JwtTokenProviderTest.java` (驗證管理員與顧客權限宣告載荷)。
- **Postman 集合檔案**：
  - 位置：[postman/antiPOS_API_Collection.json](file:///d:/Learing/project/antiPOSProject/postman/antiPOS_API_Collection.json)。
  - 包含全模組 62 個 API 測試案例。

---

## 2. 已完成的工單與變更

### 📅 2026-05-22 | [Jira: POS-55] 管理員即時營收與庫存數據看板 (Dashboard)
- **資料庫欄位設計與測試資料初始化**：
  - 修改 `schema.sql` 增加商品庫存 `stock` 與預警門檻 `stock_alert_threshold` 欄位。
  - 在 `bundle_item` 表中引入 `product_id` 欄位與外鍵約束，將固定套餐子項目直接關聯至對應商品。
  - 修改 `data.sql` 初始化預設庫存、警報數值，新增「貢丸湯」(ID 12) 並更新固定套餐項目 (A/B 套餐) 對應的 `product_id`。
- **後端實體與 MyBatis 映射**：
  - 更新 `Product.java` 屬性並在 `ProductMapper.xml` 映射新增庫存欄位，調整 `insert` 與 `update` SQL。
  - 在 `BundleItem.java` 與 `ProductMapper.xml` 的 `bundleItemResultMap` 中新增 `productId` 屬性映射。
- **即時看板數據 API 與 WebSocket 廣播**：
  - 建立 `DashboardDataDTO.java` 數據格式，並重構 `DashboardMapper.xml` 的 `getTodayTopProducts` SQL：透過 `LEFT JOIN` 同時統計「單點銷量」與「套餐內銷售量」，並加總為總銷量，移除 `LIMIT 5` 以便前端靈活對所有銷售商品進行分類排行與展示。
  - 實作 `DashboardServiceImpl.java` 利用台北時間進行數據運算與 WebSocket `/topic/dashboard` 廣播。
  - 開發 `DashboardController.java` 提供 `/api/dashboard/today` 端點，並在 `SecurityConfig.java` 限制為 `ADMIN` 角色存取。
- **庫存扣減時機、取消回補與即時連動機制**：
  - 修改 `OrderServiceImpl.java` 中的扣減時機：在點單或服務生審核完成（訂單轉為 `PENDING`）時即刻扣減庫存；在訂單取消（`CANCELLED`，且原狀態非 `PENDING_CONFIRM`）時自動回補庫存，並防止結帳/付款成功（`PAID`）時重複扣減。
  - 支援套餐/自選組合（Combo Options）之庫存連動，在訂單建立與取消時遞迴更新選定商品（透過 `selected_product_id`）的庫存數量。
  - **固定套餐子品項庫存與銷量統計自癒**：在 `createOrder` 時，若為固定套餐項目，則自動為其建立對應的 `OrderItemOption` 並記錄選定的商品 ID，使固定配餐項目也能正確連動庫存扣減/回補，並能在看板中被精確統計。
  - 實作商品售罄與上架自動流轉：庫存扣減為 0 時商品狀態自動設為 `SOLD_OUT`，回補庫存使數量大於 0 時，原售罄商品自動恢復為 `AVAILABLE`（僅限自動售罄之商品）。
  - 修改 `ProductServiceImpl.java`，在管理員手動調整庫存或變更售罄狀態時，觸發即時同步與 WebSocket 廣播。
- **前端即時看板 UI/UX (Premium Design)**：
  - 創建 `AdminDashboard.jsx` 看板頁面，以磨砂玻璃風格 (Glassmorphism) 設計今日營業額、付款訂單數與客單價卡片，並運用原生 SVG 實現具懸浮互動的甜甜圈熱銷品項圖表。
  - **分類 Tab 選擇器與單點/套餐銷售標記**：在「Top 5 熱銷品項」卡片頂部加入分類選擇器（全部、主餐、小菜、飲料），點選不同分類時動態呈現該分類的銷售排行；並在排行列表與圓餅圖懸停細節中，標註商品單點銷量與套餐內銷量，如 `紅茶 50 (單點 10 / 套餐 40)`。
  - 實作即時 Toast 提示與庫存警報清單連動，在 App.jsx 註冊 `/admin/dashboard` 路由並設定 `ADMIN` 自動跳轉。
- **驗證成果**：
  - 撰寫 `scratch/test_stock_lifecycle.js` 整合測試，完整覆蓋基本的庫存生命週期情境。
  - 新增 `scratch/test_combo_stock_and_stats.js` 整合測試，專門驗證「套餐項目扣減、自癒、即時銷售數據拆分統計功能」，測試 **100% 成功通過**。
  - 執行後端單元與整合測試（`.\mvnw test`）共 8 個測試案例 **100% 成功通過**。

### 📅 2026-05-22 | [Jira: POS-54] 系統權限控管與安全機制 (RBAC & JWT)
- **後端安全基礎建設與 JWT 整合**：
  - 引入 `spring-boot-starter-security` 與 `jjwt` 進行無狀態身分驗證。
  - 實作 `SecurityConfig` 設定全域 API 角色存取規則：開放 `/api/auth/**`、`/api/tables/token/*`、`/api/tables/*/qrcode`、`/ws/**` 等端點，並允許 `/error` 以免錯誤導引被阻攔。
  - 實作 `JwtAuthenticationFilter` 解析 `Bearer <token>` 請求頭，並注入 `SecurityContext`。
  - 實作 `JwtTokenProvider` 簽發與驗證管理員 JWT 以及顧客 `CUSTOMER` 暫時 JWT。
- **使用者認證模型與資料庫整合**：
  - 新增 `users` 資料表與對應 `User` 實體、Mapper 及 `CustomUserDetailsService`，使用 BCrypt 加密密碼，預設插入 `admin`、`waiter`、`kitchen` 用戶。
- **前端路由守護與 Race Condition 解決**：
  - 封裝 `<ProtectedRoute>` 依角色阻擋存取，不符權限重定向至 `/403` 頁面。
  - 重構 `AuthContext` 之 `login`、`logout` 與 `setCustomerSession` 使其同步讀寫 `localStorage`，徹底解決子組件 `useEffect` (請求選單 API) 先於父組件 (同步寫入 Token) 執行所導致的未授權 403 競態錯誤。
  - 調整 `CustomerOrder.jsx` 控制閥，待顧客 session 同步掛載至 context 後再請求選單與商品。
- **驗證成果**：
  - 新增 `JwtTokenProviderTest.java` 進行 Token 安全校驗。
  - `.\mvnw test` 通過所有安全及業務邏輯測試，`npm run lint` 完全無警告，`npm run build` 打包順暢。

### 📅 2026-05-22 | [Jira: POS-48] 結構化商品客製化選項與加價系統 (含套餐二次客製化)
- **資料庫設計與初期設定**：
  - 新增 `modifier_group` (修飾器群組)、`modifier_option` (客製化選項)、`product_modifier_group` (商品群組關聯)、`order_item_option` (訂單選項歷史) 等表。
  - 新增 `option_modifier_group` 關聯表，以設定父客製化選項 (如套餐) 所關聯的二級客製化群組 (如甜度、冰塊)。
  - 在 `order_item_option` 中新增 `parent_id` 欄位，用以維護子客製化選項對父客製化選項的歸屬。
  - 於 `data.sql` 中插入套餐關聯資料，將「升級 B 套餐 (燙青菜 + 紅茶)」關聯至「甜度」與「冰塊」群組。
- **後端架構與業務邏輯**：
  - 實體類新增對應屬性，擴充 MyBatis ResultMap 級聯加載一級與二級客製化群組。
  - 於 `OrderServiceImpl` 的 `createOrder` 方法中實作客製化防護驗證與動態加價計算，支援一級與二級客製化群組之 `minSelection`/`maxSelection` 遞迴驗證，並在訂單存檔時以正確的 `parentId` 層級關係存入資料庫。
- **套餐分類自選品項與補差額計算 (動態套餐項目)**：
  - **資料庫與測試資料**：修改 `schema.sql` 與 `data.sql`，為 `bundle_item` 引入 `target_category_id` (指定分類自選) 與 `base_allowance` (基本折抵額)；為 `order_item_option` 新增 `selected_product_id` 紀錄實際選定的自選商品。新增「升級 C 套餐 (自選小菜 + 自選飲料)」測試資料、小菜新品項 (黃金泡菜、皮蛋豆腐) 等。
  - **後端商務與驗證邏輯**：在 `OrderServiceImpl` 中檢驗自選商品的分類匹配度與供應狀態 (`AVAILABLE`)，並計算超額差額 `MAX(0, product.price - base_allowance)` 累加為套餐修飾加價，並在資料庫保存對應的 `selected_product_id` 以完成關聯紀錄。
  - **前端互動 UI**：在 `CustomerOrder` (前台自點) 與 `OrderInterface` (外場點餐) 引入動態商品分區按鈕 (Pills)，實時呈現各品項超額的額外補差價、將選定品項對應 ID 與二級客製化組合為正確的 JSON Payload 進行送單，並於 `TableList`、`OrderList` 及 `KitchenDisplay` (KDS) 正確轉譯並印出實際自選商品的名稱與加價（例如：`黃金泡菜(+$5)` 替代原本的分類佔位符）。
- **前端介面與客製化 Modal**：
  - 顧客自助點餐與外場點餐介面中，針對一級客製化選項下方新增二級客製化群組的嵌套展開與收合。
  - 實作切換或取消父選項時自動清除子選項選擇狀態的防錯邏輯，以及針對子選項的必選初始化設定。
  - 品項加總與購物車格式化展示優化，支援遞迴計價並以 `升級 B 套餐 (燙青菜 + 紅茶)(+$60) (無糖 / 去冰)` 格式呈現。
  - 於後台訂單管理（`OrderList`）渲染客製化細項。
- **廚房看板 (KDS) 套餐直列顯示**：
  - 修改 `KitchenDisplay` 的解析渲染邏輯，若品項為套餐升級，則自動解析為直列子項目（如 `- 燙青菜`、`- 紅茶 [無糖] [去冰]`），其餘一般客製化選項則維持以 Badge 形式呈現在下方，有效防範廚房漏看。
- **自動化測試驗證**：
  - 擴充 `scratch/test_modifiers.js` 整合測試，涵蓋商品選項查詢、防護限制、動態價格計算、錯誤傳參攔截，以及套餐二次客製化、動態自選套餐訂單建立、差額計算及分類防護驗證，測試 100% 通過。

### 📅 2026-05-21 | [Jira: POS-47] 第一階段專案審視與優化
- **後端優化**：
  - 刪除冗餘且具安全性疑慮的測試端點 `DebugController.java` 與空設定檔 `application.yml`。
  - 規範 Service 層例外處理，將通用 `RuntimeException` 改為丟出 `IllegalArgumentException`，使 API 能正確回傳 400 錯誤。
  - 微調訂單流水號產生器，將 `new Random()` 替換為 `ThreadLocalRandom.current()` 提升高併發性能。
- **前端樣式分離與 ESLint 清理**：
  - 抽取內嵌在 JSX 中的 CSS 樣式至獨立 CSS 檔案並導入（包含 `OrderList.css`, `TableList.css`, `KitchenDisplay.css`, `OrderInterface.css`, `CustomerOrder.css`）。
  - 移除多個前端檔案頂部未使用的 ESLint 註釋，改在 `useEffect` 中受影響的特定 state-modifying 呼叫行上方加上精準的 `// eslint-disable-next-line react-hooks/set-state-in-effect` 註解。
- **驗證成果**：
  - 後端 `.\mvnw test` 測試全數通過（共 5 項測試）。
  - 前端 `npm run lint` 檢測完全無警告與錯誤。
  - 前端 `npm run build` 打包與編譯順利完成。

### 📅 2026-05-21 | [Jira: POS-41] QR Code 自助點餐系統
- **後端 API 與自點流程**：
  - 於 `DiningTable` 新增桌台 `token` UUID 欄位，實作透過 Token 取得桌台詳情及 QR Code 二進位生成下載端點。
  - 支援 `order.require-staff-confirm` 設定開關，自點訂單初始狀態轉為 `PENDING_CONFIRM`，服務生審核確認後更新為 `PENDING`，外場手動點餐不受限制直接為 `PENDING`。
  - 實作 WebSocket 事件與 `PENDING_CONFIRM` 狀態相容，支援 KDS 即時接單。
- **前端自助點餐與審核**：
  - 桌台管理介面支援查看與下載專屬 PNG QR Code。
  - 新增顧客 RWD 點餐介面 `CustomerOrder.jsx`（支援選單、客製化備註、購物車 Drawer、訂單送出與 WebSocket 即時狀態變更監聽）。
  - 新增後台服務員 `OrderList.jsx`（包含待確認、活動中、歷史訂單分頁，支援搜尋與一鍵確認、取消及結帳功能）。
- **驗證成果**：
  - 新增整合測試 `scratch/test_qrcode_ordering.js`，100% 通過。

### 📅 2026-05-21 | [Jira: POS-33] WebSocket 即時通訊與桌台狀態推播
- **後端 WebSocket 基礎建設**：
  - 新增 `spring-boot-starter-websocket` 依賴。
  - 實作 `WebSocketConfig.java`：啟用 `@EnableWebSocketMessageBroker`，設定 STOMP endpoint `/ws`（含 SockJS fallback）、Simple Broker `/topic`、Application Prefix `/app`。
- **即時通知與廣播功能**：
  - 實作 `OrderEventDTO`，於訂單新增（`ORDER_CREATED`）、狀態更新（`ORDER_STATUS_CHANGED`）及結帳（`ORDER_STATUS_CHANGED`）時廣播至 `/topic/orders`。
  - 當桌台狀態實際改變時（如清潔完成 `CLEANING` ➔ `EMPTY`），廣播 `TABLE_STATUS_CHANGED` 進行自動化桌台卡片刷新。
- **前端 WebSocket Hook**：
  - 封裝 `useWebSocket.js`，支援 5 秒自動重連及 Unmount 清理，並整合至 `TableList.jsx` 與 `OrderInterface.jsx`。

### 📅 2026-05-18 | [Jira: POS-23] 專用結帳功能與異常防護
- **後端專用結帳 API**：
  - 新增 `POST /api/orders/{id}/checkout` 端點，由後端重新加總計算消費明細確保金額一致，並自動連動桌台狀態變更為 `CLEANING`。
- **異常防護與自癒**：
  - 在結帳發生衝突或重複點擊時，自動重新拉取桌台最新未結帳訂單，提供完善的錯誤自癒機制。

### 📅 2026-05-16 | [Jira: POS-22] 前端外場點餐介面與結帳流程
- **外場點餐元件**：
  - 新增 `OrderInterface.jsx`。
- **Bug 修復與互動體驗優化**：
  - 修復點餐返回後下拉選單失效 Bug（藉由 CSS `display: none` 取代 React 條件銷毀）。
  - 修復彈窗遮罩殘留與 z-index 重疊問題。
  - 將 `alert()` 替換為 React 自訂玻璃磨砂成功彈窗，並移除所有偵錯代碼。

### 📅 2026-05-15 | [Jira: POS-21] 後端訂單系統 API
- **訂單 API 實作**：
  - 包含 `Order` 與 `OrderItem` CRUD、狀態變更與聯表查詢明細 API (`/api/orders`)。
- **編號規則與狀態連動**：
  - 固定 15 碼 `TW-YYMMDD-XXXXX`（台北時間，排除易混淆字元）。
  - 建立一桌多單、新增付款與取消的桌台狀態流轉規則。
- **業務安全驗證**：
  - 阻擋購買 `SOLD_OUT`/`HIDDEN` 的下架或售完商品，限制未付款活動中訂單的直接刪除。

### 📅 2026-05-12 | [Jira: POS-18] 前端桌台管理 UI
- **實作元件**：`TableList.jsx`，卡片式 Grid 網格排版，依狀態變更配色（空閒 🟢、使用中 🔴、清潔中 🟡），並加入側邊欄入口。

### 📅 2026-05-10 | [Jira: POS-14] 後端桌台管理 API
- **實作內容**：桌台 CRUD 與狀態流轉，導入 `@Valid` Bean Validation 提供繁體中文出錯提示。
