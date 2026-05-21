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
- **多訂單合併結帳與付款**：對 `OCCUPIED` 桌台點擊「結帳」，會拉取該桌台所有的 `PENDING` 訂單，於彈窗中展示消費明細並合併計價. 確認付款後併行將訂單改為 `PAID`，使桌台由後端連動轉為 `CLEANING`。
- **容錯與重置**：對於 `OCCUPIED` 桌台查無訂單的情境，提供「手動設為清潔中」的安全回退機制。
- **選單失效 Bug 修復與 DOM 優化**：解決了在「點餐成功跳回桌台頁」流程下，再次切換至無參數點餐頁時，右側「選擇桌台」下拉選單失效與無法點開的 Bug。
  - **自動清理 Modal Backdrop**：元件載入時自動清理可能因路由切換殘留的 modal 遮罩，確保事件正常穿透。
  - **CSS 層疊層級調整**：設定 `.cart-section` 為 relative 定位並提高 z-index。
  - **避免銷毀重構 DOM（Display 切換）**：將原先的 React 條件銷毀機制重構為使用 CSS `display: none` 隱藏，保留 `<select>` DOM 節點生命週期。
  - **移除硬性 Disabled 與加載體驗優化**：移成了 API 未完成加載前 `<select>` 處於 `disabled` 狀態的硬性限制，改為加載中顯示 `-- 資料載入中... --` 選項，避免使用者產生「選單被卡死無法互動」的錯覺。
  - **自訂彈窗代替 alert() 與重疊問題修復**：全面棄用阻塞式 `alert()`，替換為磨砂玻璃風格的 React 成功彈窗。同時修復了結帳成功時「結帳明細彈窗」與「成功彈窗」重疊的視覺 Bug（結帳成功時即時關閉明細彈窗，並使用 React Fragment 將成功彈窗移出相對定位容器，以避免 `z-index` 層疊堆疊限制）。
  - **安全與除錯代碼清理**：驗證通過後，已全數移除臨時加入的偵錯紅框、網頁實時診斷面板、錯誤監聽器及相關調試日誌。


### 5. 專用結帳功能 (Jira: POS-23)
- **後端專用結帳 API**：新增 `POST /api/orders/{id}/checkout` 端點。
  - **金額計算**：自動重新加總該訂單所有 `OrderItem` 的 `subtotal` 以確保金額一致。
  - **狀態流轉**：更新訂單狀態為 `PAID`，且結帳後桌台狀態將直接連動變更為 `CLEANING`（清潔中）。後續由服務生確認清潔完成後手動改回 `EMPTY`（空閒）。
- **前端結帳介面整合與異常防護**：修改 [TableList.jsx](file:///d:/Learing/project/antiPOSProject/frontend/src/components/admin/TableList.jsx) 的結帳流程，移除直接對狀態欄位進行 PATCH 的作法，改為呼叫新的 POST 結帳端點。另外，實作**錯誤回復與狀態自癒重整機制**，在結帳異常時自動拉取桌台最新的 `PENDING` 訂單清單，避免後續再次點擊時因重複呼叫已結帳成功的訂單而導致顯示「已結帳過」的衝突問題。

### 6. WebSocket 即時通訊 (Jira: POS-33)
- **後端 WebSocket 基礎建設 (POS-34)**：
  - 新增 `spring-boot-starter-websocket` 依賴至 [pom.xml](file:///d:/Learing/project/antiPOSProject/backend/pom.xml)。
  - 新增 [WebSocketConfig.java](file:///d:/Learing/project/antiPOSProject/backend/src/main/java/com/project/backend/common/WebSocketConfig.java)：啟用 `@EnableWebSocketMessageBroker`，設定 STOMP endpoint `/ws`（含 SockJS fallback）、Simple Broker `/topic`、Application Prefix `/app`。CORS 來源與 REST API 共用 `cors.allowed-origins` 設定。
- **訂單事件即時廣播 (POS-35)**：
  - 新增 [OrderEventDTO.java](file:///d:/Learing/project/antiPOSProject/backend/src/main/java/com/project/backend/dto/OrderEventDTO.java)：廣播事件 DTO（含 `event`、`orderId`、`orderNo`、`tableName`、`tableId`、`status`、`timestamp`）。
  - 修改 [OrderServiceImpl.java](file:///d:/Learing/project/antiPOSProject/backend/src/main/java/com/project/backend/service/impl/OrderServiceImpl.java)：注入 `SimpMessagingTemplate`，於訂單新增（`ORDER_CREATED`）、狀態更新（`ORDER_STATUS_CHANGED`）及結帳（`ORDER_STATUS_CHANGED`）三處自動廣播至 `/topic/orders`。
- **前端 WebSocket 即時訂閱 (POS-36)**：
  - 安裝 `@stomp/stompjs` 與 `sockjs-client` 前端依賴。
  - 新增 [useWebSocket.js](file:///d:/Learing/project/antiPOSProject/frontend/src/hooks/useWebSocket.js) 自訂 React Hook：封裝 STOMP over SockJS 連線管理，支援自動重連（5 秒延遲）、元件 unmount 自動斷線。
  - 修改 [TableList.jsx](file:///d:/Learing/project/antiPOSProject/frontend/src/components/admin/TableList.jsx) 及 [OrderInterface.jsx](file:///d:/Learing/project/antiPOSProject/frontend/src/components/admin/OrderInterface.jsx)：訂閱 `/topic/orders`，收到事件時自動刷新桌台狀態，實現桌台卡片配色（🟢🔴🟡）即時更新。
---

## 🧪 測試與驗證資源
- **自動化 E2E 測試**：
  - 桌台、商品與分類模組測試：`C:\Users\snown\.gemini\antigravity-ide\scratch\test_e2e.js` (包含 SQL 注入防護、XSS 攻擊阻擋等共 **76 項 API 邊緣條件測試皆 100% 通過**)。
  - 訂單系統模組測試：`C:\Users\snown\.gemini\antigravity-ide\brain\1df2973f-ed92-47fb-831a-2642f728deec\scratch\test_orders.js` (包含 15 碼自定義訂單編號格式、排除混淆字元、桌台狀態雙向連動、刪除限制與售罄驗證等 **8 大核心情境皆 100% 通過**)。
  - 結帳功能模組測試：`C:\Users\snown\.gemini\antigravity-ide\scratch\test_checkout.js` (包含重複結帳阻擋、明細加總計算、一桌多單之桌台狀態切換等，測試皆 100% 通過)。
  - WebSocket 即時通訊模組測試：`C:\Users\snown\.gemini\antigravity-ide\brain\bd1b8c98-dc4d-4591-892e-cdbb46697d1a\scratch\test_websocket.js` (包含 SockJS 連線、STOMP 握手、ORDER_CREATED/ORDER_STATUS_CHANGED 事件廣播、延遲驗證等 **17 項全部 100% 通過，廣播延遲 25ms**)。
- **Postman 匯入檔**：
  - 位置：[postman/antiPOS_API_Collection.json](file:///d:/Learing/project/antiPOSProject/postman/antiPOS_API_Collection.json)
  - 包含：全模組（分類、商品、桌台、訂單）共計 **62 個 API 測試案例**。

---

## 🌿 Git 分支狀態
- 當前分支：`POS-41` (QR Code 自助點餐系統，基於 `POS-37` 分支建立)。

## POS-33 Follow-up: Table Status WebSocket
- Updated [DiningTableServiceImpl.java](file:///d:/Learing/project/antiPOSProject/backend/src/main/java/com/project/backend/service/impl/DiningTableServiceImpl.java) to publish `TABLE_STATUS_CHANGED` to `/topic/orders` whenever a table status actually changes.
- This covers direct table status updates such as `CLEANING` -> `EMPTY` after cleaning is complete, so other connected clients refresh their table state immediately.
- Event payload includes `event`, `tableId`, `tableName`, `status`, `previousStatus`, and `timestamp`.

## 2026-05-21 POS-37 廚房顯示系統（KDS）
- **Jira 工單**：POS-37「廚房顯示系統（KDS）」已完成實作；需求為廚房頁即時顯示 `PENDING / PREPARING` 訂單並支援狀態更新。
- **後端狀態與 API**：
  - 訂單狀態擴充為 `PENDING / PREPARING / READY / PAID / CANCELLED`。
  - 新增 `GET /api/orders/kitchen`，專供 KDS 查詢 `PENDING / PREPARING` 訂單。
  - `GET /api/orders` 新增 `statuses` 逗號分隔查詢參數，供桌台結帳取回 `PENDING / PREPARING / READY` 未結帳訂單，避免 KDS 完成後的 `READY` 訂單漏結。
  - `PREPARING / READY` 視為活動中訂單，不允許直接刪除；取消訂單時也會檢查同桌是否仍有其他活動中訂單。
- **前端廚房看板**：
  - 新增 [KitchenDisplay.jsx](file:///d:/Learing/project/antiPOSProject/frontend/src/components/admin/KitchenDisplay.jsx)，路由為 `/admin/kitchen`。
  - 側邊欄新增「廚房看板」入口。
  - KDS 頁面透過既有 WebSocket `/topic/orders` 即時刷新。
  - 支援「開始製作」(`PENDING -> PREPARING`) 與「完成」(`PREPARING -> READY`)。
- **驗證結果**：
  - 後端 `mvn test` 通過，共 5 項測試通過。
  - 前端 `npm run build` 通過.
  - 前端 `npm run lint` 通過，僅剩既有 unused eslint-disable warning。

## 2026-05-21 POS-41 QR Code 自助點餐系統
- **Jira 工單**：POS-41「QR Code 自助點餐系統」已完成實作。
- **後端 API 與自點流程**：
  - 新增桌台 `token` UUID 欄位，實作透過 Token 取得桌台 API 及 QR Code PNG 二進位生成端點。
  - 支援 `order.require-staff-confirm` 設定開關，自點訂單初始狀態轉為 `PENDING_CONFIRM`，服務生審核確認後更新為 `PENDING`，外場手動點餐不受限制直接為 `PENDING`。
  - 實作 WebSocket 事件與 `PENDING_CONFIRM` 狀態相容，支援 KDS 即時接單。
- **前端自助點餐與審核**：
  - 桌台管理介面支援查看與下載專屬 PNG QR Code。
  - 新增顧客 RWD 點餐介面 [CustomerOrder.jsx](file:///d:/Learing/project/antiPOSProject/frontend/src/pages/CustomerOrder.jsx) (支援選單、客製化備註、購物車 Drawer、訂單送出與 WebSocket 即時狀態變更監聽)。
  - 新增後台服務員 [OrderList.jsx](file:///d:/Learing/project/antiPOSProject/frontend/src/components/admin/OrderList.jsx) (包含待確認、活動中、歷史訂單分頁，支援搜尋與一鍵確認、取消及結帳功能)。
- **驗證結果**：
  - 新增並執行 E2E 整合測試 `scratch/test_qrcode_ordering.js`，對上述完整情境進行自動化測試，100% 通過。
  - 後端 `mvn test` 通過，前端 `npm run lint` & `npm run build` 通過。
