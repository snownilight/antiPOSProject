# Git Commit 規範 (Git Commit Guidelines)

本專案採用 **「約定式提交 (Conventional Commits)」** 並結合 **外部工單追蹤 (如 Jira)** 進行管理。

## 1. Commit 訊息格式

```text
<type>(<scope>): [<Ticket-ID>] <subject>

<body>

<footer>
```

### 格式說明：
- **type**: 提交類型（必填，如 `feat`, `fix` 等）。
- **scope**: 影響範圍（選填），例如 `auth`, `api`, `ui`。
- **Ticket-ID**: Jira 等專案管理工具的工單號碼，請用中括號包起來，例如 `[PROJ-123]`。
- **subject**: 簡短描述這次的變更（必填）。
- **body**: 詳細描述變更的動機與內容（選填，與標題需空一行）。
- **footer**: 用於標註 Breaking Changes 或再次關聯 Issue（選填）。

## 2. 支援的 Type 類型
- `feat`: 新增功能 (Feature)
- `fix`: 修復 Bug
- `docs`: 僅修改文件 (Documentation)
- `style`: 程式碼排版或格式修改（不影響邏輯）
- `refactor`: 程式碼重構（既非新增功能，也非修復 Bug）
- `perf`: 效能優化 (Performance)
- `test`: 新增或修改測試案例
- `chore`: 建置過程或輔助工具的變動（如更新依賴）
- `ci`: CI/CD 相關腳本與設定變更

## 3. 實際範例

**⭐ 範例 1：新增功能並綁定 Jira 工單**
```text
feat(auth): [PROJ-101] 新增使用者 Google 登入功能

- 整合 Google OAuth2 API
- 在資料庫新增 google_id 欄位
```

**⭐ 範例 2：修復 Bug**
```text
fix(user-profile): [PROJ-205] 修復大頭貼上傳失敗的問題

修正了當圖片超過 2MB 時，後端沒有正確回傳 HTTP 400 錯誤的問題。
```

**⭐ 範例 3：未分 scope 的小修改**
```text
chore: [PROJ-302] 升級 Spring Boot 版本至 3.2.0
```
